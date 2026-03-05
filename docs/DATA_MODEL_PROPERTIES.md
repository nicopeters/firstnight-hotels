## Data Model for Properties, Renovations, and Provider Mappings

This document describes a first normalized PostgreSQL-oriented data model for FirstNightHotels. The goal is to:

- Represent **properties** (hotels, aparthotels, serviced apartments) in a provider-agnostic way.
- Track **renovation history** and compute a **freshness score**.
- Maintain **mappings to external providers** like Hotelbeds, RateHawk, GIATA, Amadeus.

### 1. Core Entities (ER Overview)

Conceptual entity relationships:

- `Property` 1—* `PropertyRenovation`
- `Property` 1—* `ProviderProperty` *—1 `Provider`

### 2. Table: `properties`

Represents a hotel or apartment-style accommodation as FirstNightHotels sees it.

```sql
CREATE TABLE properties (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Classification
    type                    TEXT NOT NULL CHECK (type IN ('hotel', 'aparthotel', 'serviced_apartment')),
    name                    TEXT NOT NULL,
    brand                   TEXT,
    chain                   TEXT,

    -- Location
    country_code            CHAR(2) NOT NULL,
    city                    TEXT NOT NULL,
    address_line1           TEXT,
    address_line2           TEXT,
    postal_code             TEXT,
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,

    -- Meta: structural and cosmetic timeline
    opening_year            INTEGER,  -- year of first opening / initial operation
    last_major_renovation_year INTEGER, -- last structural / full-scope renovation
    last_soft_renovation_year  INTEGER, -- last cosmetic refresh (rooms, carpets, paint, etc.)
    last_rebranding_year       INTEGER, -- year of last brand/flag change (often implies a PIP)

    -- Derived freshness
    freshness_score         NUMERIC(4,2),   -- e.g. 0.00–10.00
    freshness_bucket        TEXT,           -- e.g. '0-1', '1-3', '3-5', '5+'

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Notes:

- `type` allows us to treat hotels and serviced apartments uniformly while still distinguishing them in filters.
- The year fields are optional (nullable) and will be filled via:
  - explicit provider fields where available (e.g. `built_year`, `last_renovation_year` from OTAs);
  - pipeline/project providers (e.g. TOPHOTELPROJECTS) for planned or recent openings/renovations;
  - heuristics (NLP / regex on descriptions);
  - manual overrides for curated properties.

### 3. Table: `property_renovations`

Stores more granular renovation events that can be shown in a timeline.

```sql
CREATE TABLE property_renovations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    year            INTEGER NOT NULL,
    scope           TEXT NOT NULL,      -- e.g. 'rooms', 'bathrooms', 'lobby', 'spa', 'facade'
    description     TEXT,               -- short free-text explanation

    source          TEXT NOT NULL,      -- e.g. 'provider', 'nlp_inferred', 'manual'
    source_details  JSONB,             -- raw info or provider-specific reference

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Examples:

- 2022, `rooms` – “All guest rooms refurbished with new bathrooms” (`source = 'provider'`).
- 2020, `lobby` – “Lobby redesigned” (`source = 'nlp_inferred'`, `source_details` contains matched sentence).

### 3.1 Table: `property_renovation_texts`

Stores raw textual descriptions related to openings and renovations that we may later use for quality control, NLP, or audits.

```sql
CREATE TABLE property_renovation_texts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    source_type     TEXT NOT NULL,   -- e.g. 'booking', 'hotel_website', 'news_article'
    source_name     TEXT,            -- e.g. 'Booking.com', 'Official site'
    source_url      TEXT,            -- optional: URL of the source
    language        TEXT,            -- e.g. 'en', 'de'

    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    raw_text        TEXT NOT NULL,   -- original or lightly processed text snippet

    extracted_years JSONB,           -- optional; inferred years and metadata
    notes           TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Notes:

- This table is intentionally **redundant** with respect to structured data:
  - It does not drive the user-facing experience directly.
  - Instead, it serves as an audit trail and training ground for improved extraction heuristics/ML models.
- `extracted_years` can store structures like:
  - `[{"year": 2022, "confidence": 0.9, "phrase": "fully renovated in 2022"}]`.

### 4. Table: `providers`

Registry of external data providers.

```sql
CREATE TABLE providers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,  -- e.g. 'hotelbeds', 'ratehawk', 'giata', 'amadeus'
    kind        TEXT NOT NULL CHECK (kind IN ('bedsbank', 'gds', 'ota', 'content_only')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5. Table: `provider_properties`

Links a property in our system to a record in a provider’s system.

```sql
CREATE TABLE provider_properties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_id         INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    provider_hotel_id   TEXT NOT NULL,

    property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Optional: store some denormalized info for debugging or fallback
    provider_raw        JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (provider_id, provider_hotel_id)
);
```

This table allows:

- Mapping multiple providers to the same `property`.
- Inspecting raw provider payload per hotel for debugging and future backfills.

### 6. Table: `property_scores` (optional extension)

If we want to track multiple algorithmic scores separately (not only freshness), we can move `freshness_score` into a separate table.

```sql
CREATE TABLE property_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    kind            TEXT NOT NULL,      -- e.g. 'freshness', 'location_quality'
    value           NUMERIC(6,3) NOT NULL,
    bucket          TEXT,               -- e.g. '0-1', '1-3', ...

    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB,             -- algorithm version, parameters, debug info

    UNIQUE (property_id, kind)
);
```

For the MVP we can keep `freshness_score` and `freshness_bucket` directly on `properties` and introduce `property_scores` later when needed.

### 7. Freshness Score Concept

High-level idea (exact formula can evolve later):

- Define `reference_year` as the year of computation (e.g. current calendar year).
- Derive multiple age metrics:
  - `age_major_years` = `reference_year - last_major_renovation_year` (if available).
  - `age_soft_years`  = `reference_year - last_soft_renovation_year` (if available).
  - `age_opening_years` = `reference_year - opening_year` (if available).
- Define a primary `age_years` for freshness:
  - Prefer `age_major_years` if present.
  - Else fall back to `age_soft_years`.
  - Else fall back to `age_opening_years`.
  - Else `NULL`.
- Map `age_years` to:
  - `freshness_bucket`:
    - `0–1` years → “ultra fresh”
    - `1–3` years → “very fresh”
    - `3–5` years → “fresh”
    - `5+` years → “aging”
  - `freshness_score`:
    - e.g. `score = 10 - min(age_years, 10)` (capped at 0 for 10+ years).

This can initially be implemented as a batch job that:

- Calculates or updates `freshness_score` and `freshness_bucket` for all properties with at least one relevant year value.
- Leaves properties without any year info either:
  - with `NULL` freshness; or
  - in a separate “unknown” bucket that can be filtered out or down-ranked.

### 8. How This Supports Multiple Providers

- Provider-specific quirks and fields live in importer code and `provider_raw`.
- The **canonical** representation is always `properties` + `property_renovations`.
- Adding a second provider or GIATA later:
  - creates more rows in `provider_properties`;
  - may add/merge `PropertyRenovation` rows (or trigger re-computation of year fields);
  - does **not** require schema changes in the core tables.

