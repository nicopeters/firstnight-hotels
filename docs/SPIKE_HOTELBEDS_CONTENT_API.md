## Spike: Hotelbeds Hotels Content API → FirstNightHotels Data Model

This document sketches a small technical spike to evaluate Hotelbeds’ hotel content for renovation “freshness” signals and to validate the proposed data model.

### 1. Goals of the Spike

- Connect to the **Hotelbeds Hotels Content API** (sandbox or test environment).
- Fetch hotel content for a **small, focused geography** (e.g. one city).
- Map a subset of fields into the proposed schema:
  - `properties`
  - `provider_properties`
  - (optionally) `property_renovations`
- Inspect real descriptions to understand:
  - Whether there are explicit fields for build/renovation years.
  - How often renovation language appears in free text.

The spike can be implemented in any backend language (e.g. Node.js/TypeScript or Python); below is a language-agnostic outline plus a Python-flavoured example.

### 2. Prerequisites

- Hotelbeds developer account and API key/credentials.
- Access to the Hotels **Content API** in a test/sandbox environment.
- A local PostgreSQL instance with at least:
  - `properties`
  - `provider_properties`

### 3. Example: Fetching Hotels by Destination (Pseudo-code)

The exact endpoints and parameters may evolve; consult the latest Hotelbeds docs. Conceptually:

```python
import requests
import uuid

HOTELBEDS_API_KEY = "YOUR_API_KEY"
HOTELBEDS_SHARED_SECRET = "YOUR_SHARED_SECRET"
BASE_URL = "https://api.test.hotelbeds.com/hotel-content-api/1.0"

def build_headers():
    return {
        "Api-key": HOTELBEDS_API_KEY,
        "Accept": "application/json",
        # Some versions require an X-Signature header based on key + secret + timestamp
        # "X-Signature": generate_signature(HOTELBEDS_API_KEY, HOTELBEDS_SHARED_SECRET),
    }

def fetch_hotels(page=1, destination_code="BER"):  # example: Berlin
    url = f"{BASE_URL}/hotels"
    params = {
        "destinationCode": destination_code,
        "from": (page - 1) * 100,
        "to": page * 100 - 1,
        "fields": "all",   # or limit to what we need
        "language": "ENG",
    }
    response = requests.get(url, headers=build_headers(), params=params, timeout=30)
    response.raise_for_status()
    return response.json()
```

The spike should:

- Handle **basic pagination** (e.g. pages of 100 hotels).
- Log how many hotels are returned and how many pages are needed for the chosen destination.

### 4. Mapping to the Data Model

For each hotel record in the response:

1. Extract core fields:

   - `name`, `category`, `address`, `geoCode`, etc.
   - Map to `properties`:
     - `type`: infer from category / accommodation type (e.g. map certain categories to `aparthotel`).
     - `name`, `country_code`, `city`, `address_*`, `latitude`, `longitude`.

2. Create or update the `properties` row.

3. Insert or update the corresponding `provider_properties` row:

   - `provider_id`: ID of the `hotelbeds` row in `providers`.
   - `provider_hotel_id`: Hotelbeds’ internal hotel ID.
   - `provider_raw`: store the raw hotel JSON (or a trimmed version) for analysis.

Pseudo-code:

```python
def map_hotel_to_property(hotel_json):
    # Extract some basic fields; adjust names based on actual API shape
    hotel_id = hotel_json["code"]
    name = hotel_json["name"]["content"]
    country = hotel_json["countryCode"]
    city = hotel_json.get("city", {}).get("content", "")
    geo = hotel_json.get("coordinates", {})

    # Upsert into properties (pseudo-code; replace with real DB calls)
    property_id = upsert_property(
        type=infer_property_type(hotel_json),
        name=name,
        country_code=country,
        city=city,
        address_line1=extract_address_line1(hotel_json),
        latitude=geo.get("latitude"),
        longitude=geo.get("longitude"),
    )

    upsert_provider_property(
        provider_name="hotelbeds",
        provider_hotel_id=hotel_id,
        property_id=property_id,
        provider_raw=hotel_json,
    )
```

### 5. Evaluating Renovation Information

Once a few hundred hotels are imported for a test destination:

1. Inspect hotel descriptions:
   - Look at description fields like `description`, `rooms`, `facilities`.
   - Search for patterns like:
     - “renovated in 20XX”
     - “refurbished in 20XX”
     - “opened in 20XX”

2. Quick heuristic approach (offline / one-off script):

```python
import re

RENOVATION_PATTERN = re.compile(r"(renovated|refurbished|modernized|opened)\s+in\s+(\d{4})", re.IGNORECASE)

def extract_renovation_years(text: str):
    years = []
    for match in RENOVATION_PATTERN.finditer(text or ""):
        verb, year = match.groups()
        years.append((verb.lower(), int(year)))
    return years
```

3. For hotels where a year is found:
   - Create `property_renovations` entries with `source = 'nlp_inferred'`.
   - Set `opening_year` or `last_renovation_year` on `properties` when the signal is clear.

4. Produce simple metrics:
   - Percentage of hotels where any year could be extracted.
   - Distribution of renovation years (how many in the last 1/3/5 years).

### 6. Output of the Spike

At the end of the spike, you should have:

- A small subset of hotels (e.g. in one city) persisted in PostgreSQL.
- A sense of:
  - How often explicit or implied renovation information appears.
  - Whether descriptions are rich enough to support a freshness-based UX.
- A few example properties where:
  - The renovation timeline is correctly reconstructed.
  - The computed `freshness_score` matches human intuition.

This will inform:

- Whether Hotelbeds alone is sufficient as a first provider.
- How much effort will be needed on NLP/heuristics and manual curation.

