## ETL & Update Plan for Provider Data

This document outlines how to import and maintain hotel content from external providers (e.g. Booking.com, Hotelbeds, RateHawk, GIATA, pipeline providers) into the FirstNightHotels database.

The focus is on:
- Batch **initial imports** of hotel static content.
- **Incremental updates** (deltas).
- **Freshness extraction** (opening/renovation years) and score computation.
- Monitoring and operational concerns.

### 1. High-Level Architecture

Conceptual components:

1. **Provider Fetcher**  
   - Talks to each provider’s Content API (Booking.com, Hotelbeds, RateHawk, GIATA, pipeline providers).
   - Handles pagination, rate limiting, retries, and authentication.

2. **Normalizer / Mapper**  
   - Maps raw provider JSON into canonical `Property`, `PropertyRenovation`, and `ProviderProperty` records.
   - Applies heuristics to extract potential opening/renovation years.

3. **Golden Record Builder**  
   - Consolidates multiple provider records referring to the same physical property into a single canonical `Property`.
   - Uses GIATA MultiCodes (and similar mapping sources) plus address/geo/name heuristics.
   - Applies **field-level precedence rules** (e.g. “trusted pipeline provider” > “manual” > “GIATA” > “Booking.com” > “others”) for critical fields like renovation years.

4. **Persistence Layer**  
   - Upserts to PostgreSQL based on provider IDs and internal `property_id`.
   - Maintains `provider_properties` mappings and any GIATA IDs.

5. **Freshness Scorer**  
   - Periodic job that recomputes `freshness_score` and `freshness_bucket` on `properties`.

6. **Monitoring & Admin Tools**  
   - Dashboards for import success rates, error counts, and data coverage.
   - Internal view to inspect raw provider payload vs. normalized data per property and see how the Golden Record was derived.

### 2. Initial Import (Per Provider)

Goal: Build the first full snapshot of European hotels and serviced apartments, starting with a primary OTA/content provider (e.g. Booking.com) and extending to others over time.

**Steps:**

1. **Scope selection**
   - Start with a limited geography (e.g. 2–3 cities or 1–2 countries).
   - Filter by property type if the provider supports it (e.g. only hotels/aparthotels).

2. **Batch fetching**
   - Use provider’s bulk/content endpoints (e.g. “get all hotels” with pagination).
   - Respect rate limits, implement backoff/retry.
   - Store raw responses (at least temporarily) for debugging.

3. **Normalization**
   - For each provider hotel record:
     - Find or create a preliminary `Property` record (before Golden Record consolidation).
       - Match by existing `provider_properties` mapping, or
       - Use a simple heuristic (city + address + name) if needed.
     - Insert/Update:
       - `properties` (core fields like name, type, geo, etc.) – or a staging structure if desired.
       - `provider_properties` (link provider + provider_hotel_id → property_id, store `provider_raw`).
   - Leave cross-provider merging and renovation extraction to dedicated steps (see below).

4. **Post-import validation**
   - Check counts:
     - Number of properties fetched vs. stored.
     - Errors per page or per request.
   - Spot-check sample properties in the DB vs. provider console/docs.

### 3. Incremental Updates

Once the initial snapshot is in place, keep it in sync:

1. **Change feeds or “modified since” filters**
   - If the provider offers “last modified since” parameters or incremental endpoints, use them.
   - Otherwise, periodically re-fetch in smaller batches and compare hashes/updated timestamps.

2. **Update logic**
   - For each updated provider record:
     - Find `provider_properties` by `(provider_id, provider_hotel_id)`.
     - Update the linked `properties` record with any changed fields (e.g. name, address, geo).
     - Optionally store a diff or updated `provider_raw`.

3. **Soft delete / deactivation**
   - If a property disappears or becomes inactive in the provider feed:
     - Mark it as `active = false` in `properties` (add this flag if needed).
     - Keep the record for historical data and to avoid ID reuse issues.

### 4. Freshness Extraction (Opening & Renovation Years)

Because providers usually do not offer fully standardized renovation fields, this step is critical.

1. **Explicit fields (if available)**
   - Some providers (e.g. Booking.com Property/Profile APIs) expose fields like `built_year`, `last_renovation_year` or similar.
   - Map them directly to:
     - `opening_year`
     - `last_major_renovation_year`
     - `last_soft_renovation_year` (when available)
   - For rebrandings/flag changes, map known dates to `last_rebranding_year`.

2. **Heuristics / NLP on descriptions**
   - Run a text-processing job over:
     - Hotel descriptions.
     - Room descriptions.
     - Marketing texts returned in `provider_raw`.
   - Look for patterns like:
     - “renovated in 2022”, “fully refurbished in 2019”.
     - “opened in 2021”, “newly built hotel”.
   - Extract candidate years and scopes (rooms, lobby, etc.).
   - Write:
     - `property_renovations` entries with `source = 'nlp_inferred'`.
     - Update `opening_year` / `last_renovation_year` when confidence is high.

3. **Manual curation**
   - For high-impact properties (top search results, key cities), allow:
     - Manual overrides of `opening_year` and `last_renovation_year`.
     - Manual addition of `property_renovations` entries.
   - Store these as `source = 'manual'`.

### 5. Freshness Scoring Job

Run a periodic job (e.g. daily or weekly):

1. Select all properties with at least one of:
   - `opening_year` not null, or
   - `last_major_renovation_year` not null, or
   - `last_soft_renovation_year` not null.

2. For each property, compute:
   - `age_years` based on the rules in `DATA_MODEL_PROPERTIES.md` (prefer major, then soft, then opening).
   - `freshness_score` (e.g. `10 - min(age_years, 10)`).
   - `freshness_bucket` (e.g. `0-1`, `1-3`, `3-5`, `5+`, or `unknown`).

3. Update `properties` (or `property_scores`, if used).

4. Optionally log:
   - Distribution of buckets by city/country.
   - Number of properties with unknown freshness (to guide data quality work).

### 6. Scheduling & Infrastructure

- Use a lightweight job runner (e.g. a cron-based worker, or a queue system like Sidekiq/Bull/RQ, depending on chosen backend stack).
- Suggested jobs:
  - `provider:<name>:full-import` (rare, only for re-seeding or new regions).
  - `provider:<name>:delta-import` (frequent, e.g. hourly/daily).
  - `freshness:extract-from-text` (batch NLP run, can be more expensive and run less often).
  - `freshness:recompute-scores` (e.g. daily).

### 7. Monitoring & Observability

For each provider and job type:

- Track metrics such as:
  - Number of properties fetched per run.
  - Number of successful vs. failed updates.
  - Average response times and error rates from provider APIs.
- Alert on:
  - Sudden drop to zero in fetched records.
  - Error rates above a threshold.
  - Large increases in unknown freshness properties.

### 8. Admin & Debug Tools (Internal)

Build simple internal views (later, in the admin UI) that show:

- For a given property:
  - Core fields from `properties`.
  - All `property_renovations` entries with sources.
  - All `provider_properties` and their `provider_raw` excerpts.
- For a given provider:
  - Total mapped properties.
  - Recent import runs and error logs.

This will be critical to:

- Debug mapping issues.
- Understand why a certain property has (or does not have) a high freshness score.

