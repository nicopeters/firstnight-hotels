## Homepage Freshness Filters – Specification

This document defines the freshness-based filters for the FirstNightHotels homepage search experience and how they map to the underlying data model.

### 1. Core Freshness Dimensions

1. **Time since last renovation or opening**
   - Concept: “How old does this hotel feel today?”
   - Backed by:
     - `properties.last_renovation_year`
     - `properties.opening_year`
     - Derived `freshness_score` and `freshness_bucket`.

2. **Area-specific freshness**
   - Concept: “Which parts of the property are actually new?”
   - Backed by:
     - `property_renovations.scope` and `property_renovations.year`.
   - Example scopes:
     - `rooms`, `bathrooms`, `lobby`, `spa`, `common_areas`.

3. **Freshness vs price trade-off (ranking, not a hard filter)**
   - Concept: Let the user tell us whether to optimize primarily for price, for freshness, or a balance of both.
   - Implemented as:
     - A weighting parameter in the result ranking function (e.g. `alpha * normalized_price + beta * normalized_freshness_score`).

These three dimensions drive all UI elements described below.

### 2. Homepage Search – MVP Filter Set

The homepage should keep the first interaction extremely simple while still surfacing the unique “freshness” value proposition.

#### 2.1 Required input fields

- Destination (city / region text input with autocomplete).
- Check-in date.
- Check-out date.
- Number of guests (adults + optional children).

#### 2.2 Freshness controls on the homepage

1. **Primary toggle: “Only renovated in the last 5 years”**

   - Label: `Only hotels opened or renovated in the last 5 years`
   - Type: Boolean toggle.
   - Default: `off`.
   - Effect:
     - When `on`, only include properties where
       - `age_years <= 5`, where `age_years` is based on last renovation year if present, otherwise opening year.

2. **Preset chips for freshness buckets**

   - Shown directly under the search box as mutually exclusive chips:
     - `Ultra fresh (0–1 years)`
     - `Very fresh (1–3 years)`
     - `Fresh (3–5 years)`
     - `Avoid old stock (exclude 10+ years)`
   - Behavior:
     - At most one chip is active at a time.
     - Activating a chip automatically updates the freshness constraints:
       - `0–1`: `age_years <= 1`
       - `1–3`: `1 < age_years <= 3`
       - `3–5`: `3 < age_years <= 5`
       - `Avoid old stock`: `age_years <= 10` (or `freshness_bucket != '10+'` depending on implementation).
     - Chips and the “Only renovated in the last 5 years” toggle should stay consistent; e.g. if user selects `Ultra fresh (0–1 years)`, the toggle is implicitly satisfied.

3. **Optional: “Freshness vs price” slider (results ranking preference)**

   - Label: `Prioritize`
   - Values (3 discrete steps):
     - `Best price`
     - `Balanced`
     - `Freshness first`
   - Effect:
     - Does not filter; only affects sort order:
       - `Best price`: ranking primarily by (normalized) price, freshness as a tie-breaker.
       - `Balanced`: mix of price and freshness.
       - `Freshness first`: freshness score dominates; price as secondary.

For the initial MVP, you can ship with:

- The primary toggle, plus
- A minimal set of chips (e.g. only `0–3` and `3–5`) if needed.

### 3. Results Page – Extended Freshness Controls

On the search results page, you can expose more granular controls while reusing the same underlying dimensions.

#### 3.1 Time-based controls

1. **Slider: “Maximum years since last renovation”**

   - Label: `Maximum age since last renovation`
   - Range: `0–10` years (integer steps).
   - Default: `10` (no effective restriction).
   - Effect:
     - Filters properties to those with `age_years <= selected_value`.

2. **Checkbox: “Hide hotels with unknown freshness”**

   - Label: `Hide hotels with unknown freshness`
   - Default: `off`.
   - Effect:
     - When `on`, exclude properties where neither `opening_year` nor `last_renovation_year` is known.

#### 3.2 Area-specific freshness

- Multi-select checkboxes:
  - `New rooms`
  - `New bathrooms`
  - `New lobby / common areas`
- Effect:
  - For each selected area, require at least one `property_renovations` record in the last `X` years with matching `scope`.
  - `X` can be fixed (e.g. 5 years) or derived from the main time-based filter.

#### 3.3 Freshness vs price (ranking)

- Reuse the same 3-step slider from the homepage or move it into the “Sort by” controls:
  - `Sort by: Recommended (Balanced)`, `Freshness`, `Price`.

### 4. Mapping to the Data Model and Query Logic

This section sketches how the filters translate into SQL-level conditions based on the schema in `DATA_MODEL_PROPERTIES.md`.

#### 4.1 Derived `age_years`

For filtering, you do not need to store `age_years` explicitly; you can compute it or reuse it from a materialized column.

Example (PostgreSQL, using current year):

```sql
WITH base AS (
  SELECT
    p.*,
    EXTRACT(YEAR FROM CURRENT_DATE)::INT AS current_year,
    CASE
      WHEN p.last_renovation_year IS NOT NULL
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.last_renovation_year
      WHEN p.opening_year IS NOT NULL
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT - p.opening_year
      ELSE NULL
    END AS age_years
  FROM properties p
)
SELECT * FROM base
WHERE ...
```

If you maintain `freshness_bucket` and `freshness_score` via a batch job, you can instead filter directly on those columns.

#### 4.2 Implementing homepage toggle and chips

- **Toggle: Only hotels opened or renovated in the last 5 years**

```sql
-- inside the WHERE clause, assuming `age_years` from the CTE above
AND age_years IS NOT NULL
AND age_years <= 5
```

- **Chips (example: “Ultra fresh (0–1 years)”)**

```sql
AND age_years IS NOT NULL
AND age_years <= 1
```

For other chips, adjust the numeric ranges accordingly.

If you rely on `freshness_bucket`, you can instead do:

```sql
AND p.freshness_bucket IN ('0-1')            -- ultra fresh
-- or
AND p.freshness_bucket IN ('0-1', '1-3')     -- 0–3 years, etc.
```

#### 4.3 “Hide hotels with unknown freshness”

```sql
AND (p.opening_year IS NOT NULL OR p.last_renovation_year IS NOT NULL)
```

or, if you rely on `freshness_bucket`:

```sql
AND p.freshness_bucket IS NOT NULL
```

#### 4.4 Area-specific freshness (e.g. “New bathrooms”)

Assuming:

- `reference_year` is the current year.
- `max_age_years` is either a fixed value (e.g. 5) or taken from the main time filter.

```sql
AND EXISTS (
  SELECT 1
  FROM property_renovations pr
  WHERE pr.property_id = p.id
    AND pr.scope = 'bathrooms'
    AND pr.year >= (EXTRACT(YEAR FROM CURRENT_DATE)::INT - max_age_years)
)
```

For multiple scopes selected (e.g. “New rooms” AND “New bathrooms”), either:

- Require all of them (multiple `EXISTS`), or
- Relax to any of them (one `EXISTS` with `scope IN (...)`), depending on UX choice.

#### 4.5 Freshness vs price – ranking function

High-level idea:

- Compute normalized values:
  - `normalized_price` (0–1, where 0 = cheapest among current result set, 1 = most expensive).
  - `normalized_freshness` (0–1, where 0 = stalest, 1 = freshest).
- Combine with weights:

```text
score = alpha * normalized_price + beta * (1 - normalized_freshness)
```

- Example weight choices:
  - `Best price`: `alpha = 0.8`, `beta = 0.2`
  - `Balanced`: `alpha = 0.5`, `beta = 0.5`
  - `Freshness first`: `alpha = 0.2`, `beta = 0.8`

Results are then sorted ascending by `score` (lower is better).

### 5. Example User Scenarios

1. **“Weekend break, wants ultra new hotel”**
   - Homepage:
     - Destination: Berlin
     - Dates: chosen
     - Toggle: on
     - Chip: `Ultra fresh (0–1 years)`
   - Backend:
     - Filter properties to `age_years <= 1`.

2. **“Business trip, needs new bathrooms, flexible on lobby”**
   - Homepage:
     - Simple search with freshness toggle off (or `1–5 years` chip).
   - Results page:
     - Slider: `Maximum age since last renovation` = 7.
     - Checkbox: `New bathrooms` checked.
   - Backend:
     - Filter `age_years <= 7`.
     - `EXISTS` on `property_renovations` with `scope = 'bathrooms'` and `year >= current_year - 7`.

3. **“Price-sensitive traveler, but wants to avoid very old stock”**
   - Homepage:
     - Chip: `Avoid old stock (exclude 10+ years)`.
     - Slider/Sort: `Best price`.
   - Backend:
     - Filter `age_years <= 10` or exclude stale `freshness_bucket`.
     - Sort primarily by price with freshness as a tiebreaker.

