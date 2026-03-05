## Golden Record Model – Properties and Providers

This document describes how FirstNightHotels builds a **Golden Record** for each physical property (hotel or apartment-style accommodation) from multiple external providers.

### 1. Goals

- Represent each real-world property exactly once in our core `properties` table.
- Consolidate data from:
  - Primary OTA/content providers (e.g. Booking.com, Hotelbeds, RateHawk).
  - Mapping/content hubs (e.g. GIATA).
  - Pipeline/project providers (e.g. TOPHOTELPROJECTS, HotelMarketData).
  - Manual curation and internal corrections.
- Protect high-quality, manually-validated renovation data from being overwritten by less reliable feeds (**Domain Update Lock** behavior).

### 2. Identifiers and mapping

- **Internal primary key**: `properties.id` (UUID) – FirstNight’s own property ID.
- **External IDs** are stored in `provider_properties`:
  - `provider_id` (e.g. `booking`, `hotelbeds`, `giata`, `thp`).
  - `provider_hotel_id` (or provider-specific property key).
  - Optional `giata_id` column (if GIATA is modeled directly in `provider_properties` or as a separate mapping field).

The Golden Record builder relies on:

- `provider_properties` rows.
- GIATA MultiCodes (or similar) to detect that multiple provider IDs refer to the same real-world property.
- Fallback heuristics (name + address + geo) when mapping data is missing or ambiguous.

### 3. Data sources and trust levels

For critical fields such as `opening_year`, `last_major_renovation_year`, `last_soft_renovation_year`, and `last_rebranding_year`, different sources have different levels of trust:

From highest to lowest (example ordering; can be refined later):

1. **Manual curation**  
   - Directly entered or corrected by FirstNight staff.
   - Source: `property_renovations.source = 'manual'`.

2. **Pipeline/project providers**  
   - TOPHOTELPROJECTS, HotelMarketData, similar.
   - Provide explicit data on new builds, major renovations, rebrandings.

3. **GIATA / mapping/content hubs**  
   - Aggregated and normalized content across many channels.

4. **Primary OTA/content provider**  
   - Booking.com, Hotelbeds, RateHawk.
   - Fields like `built_year`, `last_renovation_year` from their proprietary APIs.

5. **Heuristic/NLP extraction**  
   - Derived from free text (OTA descriptions, reviews, marketing copy).

This ordering defines how conflicts are resolved when multiple sources provide different values for the same field.

### 4. Field-level precedence rules

For each year-type field on `properties`:

- `opening_year`:
  - Prefer:
    1. Manual.
    2. Pipeline/project providers (first opening).
    3. GIATA/aggregated content, if explicit.
    4. OTA fields (`built_year` or similar).
    5. NLP/heuristics as a last resort.

- `last_major_renovation_year`:
  - Prefer:
    1. Manual entries for major renovations.
    2. Pipeline/project providers when the project type indicates a major renovation.
    3. GIATA or OTA fields explicitly labeled as structural/major renovation year.
    4. NLP/heuristics from text with high confidence.

- `last_soft_renovation_year`:
  - Prefer:
    1. Manual records tagged as soft/cosmetic.
    2. NLP/heuristics that clearly indicate cosmetic updates (e.g. “new beds and carpets in 2023”).

- `last_rebranding_year`:
  - Prefer:
    1. Manual confirmation of brand/flag change.
    2. Pipeline/project providers or GIATA if they track rebrandings explicitly.
    3. OTA content where brand change is clearly indicated and date can be inferred.

When a new data point arrives:

- The Golden Record builder checks the **source trust level** and either:
  - Updates the field (if the new source is higher or equal trust and the value is newer/more precise).
  - Ignores the update (if the current value comes from a higher-trust source and should be locked).

### 5. Golden Record build flow (conceptual)

At a high level:

1. **Ingest provider data**  
   - ETL jobs fetch raw content from providers and populate `provider_properties` and (optionally) staging tables.

2. **Resolve identity**  
   - Use GIATA MultiCodes (if available) and provider IDs to group records that belong to the same real-world property.
   - Apply heuristics on name/address/geo for uncertain cases, possibly flagging them for manual review.

3. **Merge into a single Property**  
   - For each group of external IDs:
     - Select or create a `properties.id`.
     - Merge attributes (name, location, classification) using simple rules (e.g. prefer OTA display name, but keep alternatives for search).
     - Merge time-based fields (opening and renovation years) using the precedence rules above.
     - Generate or update `PropertyRenovation` entries for each major/soft renovation event, tagged with the appropriate `source`.

4. **Apply Domain Update Lock semantics**  
   - If a field is marked as locked due to manual or higher-trust input, lower-trust updates are not allowed to overwrite it.

5. **Recompute freshness metrics**  
   - After merging, run or queue a job to recompute `freshness_score` and `freshness_bucket` for the affected properties.

### 6. Admin/debug visibility

The admin UI should expose, per property:

- The Golden Record (final fields from `properties`).
- All contributing `provider_properties` rows (Booking.com, Hotelbeds, GIATA, THP, etc.).
- The sequence of updates and which source “won” for each critical field.
- Flags for conflicts or low-confidence merges that may need manual review.

This transparency is essential for:

- Trusting the freshness metrics.
- Debugging data anomalies when suppliers disagree.

