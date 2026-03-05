## Hotel & Apartment Data Providers – Shortlist

This document summarizes a first shortlist of external data providers suitable for a **Europe-focused metasearch MVP** (hotels + serviced apartments) for FirstNightHotels.

The overall strategy is **hybrid**:

- Use one or two **OTA / content providers** for volume and transactional data.
- Use specialized **mapping and content hubs** (GIATA, similar) to create a clean, de-duplicated property graph.
- Optionally enrich with **pipeline/project data providers** (e.g. TOPHOTELPROJECTS) to get early signals about openings and major renovations.

### 1. Booking.com – Property & Content APIs

- **Type**: OTA with very large inventory and rich content.
- **Coverage**:
  - Largest inventory for hotels, apartments, aparthotels in Europe.
  - Very strong presence in DACH and Western Europe.
- **APIs** (high-level):
  - Property profile/content APIs exposing:
    - Structural information such as **built_year** (original construction year).
    - Potential **last_renovation_year** or similar renovation-related fields (terminology depends on the exact API version).
    - Property type (hotel, apartment, aparthotel).
  - Availability/booking APIs (for live prices and inventory).
- **Pros**:
  - Excellent for a **Phase 1 MVP** focused on Europe due to inventory depth.
  - Built-in fields for opening/renovation years reduce the need for pure heuristic extraction.
  - Strong apartment/serviced-apartment coverage.
- **Cons / Risks**:
  - API access and usage terms need to be aligned with Booking’s partner program.
  - Data model and SLAs are controlled by a single OTA; mapping to other providers still needed later.

### 2. Hotelbeds – Hotels Content API

- **Type**: Bedbank / wholesaler with rich hotel content.
- **Coverage**: Global; strong coverage in European city and leisure destinations.
- **API**: REST/JSON Content API for hotel **static data**.
- **Key content fields** (based on docs):
  - Hotel names, addresses, geocodes.
  - Category / star rating, chain information.
  - Facilities, policies, descriptions, nearby attractions.
  - Images per hotel and per room type.
- **Pros**:
  - Mature API and documentation.
  - Designed for static content sync, suitable for building an internal property database.
  - Widely used in the industry; easier to hire people who know it.
- **Cons / Risks**:
  - Commercial agreement required; not fully self-service.
  - No explicit “renovation year” field in standard content – likely requires heuristics on descriptions.

### 3. RateHawk – Content & Booking API

- **Type**: Aggregator / B2B OTA with unified content and booking APIs.
- **Coverage**:
  - ~2.9M+ accommodations across 220+ countries.
  - Includes hotels, apartments, guest houses, etc. – good fit for hotels + serviced apartments.
- **API**:
  - RESTful APIs for accommodation content and booking.
  - Supports filters by region, star rating, property type, and more.
  - Incremental updates (retrieve only newly added/modified content).
- **Pros**:
  - Very broad inventory including many apartment-style properties.
  - Incremental content feeds simplify keeping the local DB up to date.
  - Sandbox and structured integration process.
- **Cons / Risks**:
  - Requires account manager / B2B relationship; not an anonymous self-service API.
  - Renovation information not a first-class concept; will need heuristics.

### 4. GIATA – Content & Mapping (MultiCodes, Open Content Link)

- **Type**: Content and mapping provider (no prices/availability, focus on static hotel data and ID mapping).
- **Coverage**:
  - 1M+ properties across 500+ content providers.
  - Focus on de-duplication and standardized hotel content.
- **APIs**:
  - **Open Content Link**: detailed property data (names, locations, ratings, addresses, contact info, URLs, images, room types, amenities).
  - **MultiCodes**: mapping across many provider IDs (e.g. link Hotelbeds/RateHawk/others to a single GIATA ID).
- **Pros**:
  - Excellent for building a **clean, de-duplicated property graph** across multiple suppliers.
  - Strong static content and images.
  - Reduces effort for matching the same hotel across providers.
- **Cons / Risks**:
  - Additional cost layer on top of main suppliers.
  - Focus is general hotel content, not specifically renovation history.

### 5. Amadeus Self-Service Hotel APIs

- **Type**: GDS-style platform with self-service REST APIs.
- **Coverage**:
  - ~150k+ bookable hotels in the self-service program (GDS + third parties).
  - Strong in aviation/rail; hotel coverage okay but not as wide as dedicated bedbanks.
- **APIs**:
  - **Hotel List API**: hotel list with names, addresses, geocodes, time zones, and filters.
  - **Hotel Search & Booking APIs**: live prices and availability.
  - **Hotel Ratings API**: sentiment-based ratings from reviews for multiple aspects.
- **Pros**:
  - True self-service with clear pricing and developer onboarding.
  - Ratings API could complement a freshness-focused score later.
  - Good documentation and SDKs.
- **Cons / Risks**:
  - Focus is more on real-time search & booking than on deep static content.
  - Coverage and depth for apartments/serviced apartments more limited than RateHawk/Hotelbeds.

### 6. Pipeline / Project Data Providers (Renovation & Openings)

These providers do **not** supply bookable inventory, but track construction, renovation, and rebranding projects. They are highly relevant for the **future/just-opened** end of the freshness spectrum.

#### TOPHOTELPROJECTS (THP)

- **Type**: Global project and pipeline database for hotels.
- **Content**:
  - New builds, major renovations, rebrandings.
  - Project stages from planning to pre-opening.
- **Relevance for FirstNightHotels**:
  - Early access to information about upcoming openings and large-scale renovations.
  - Allows us to mark properties as “opening soon” or “recently opened” before they are fully visible in OTA feeds.

#### HotelMarketData

- **Type**: Renovation/construction project tracker with strong DACH/US focus.
- **Content**:
  - Renovation leads, investment volumes, ownership changes.
- **Relevance**:
  - Valuable for understanding where significant capex flows into existing properties (i.e. likely major renovations).

#### Lodging Econometrics

- **Type**: Global pipeline analytics and trend provider.
- **Relevance**:
  - More strategic/aggregated; helpful for market-level insights and planning, less for individual property freshness.

### 7. High-level conclusions for MVP

- For a **Phase 1 MVP** with focus on **Europe, metasearch, hotels + serviced apartments**:
  - Start with **Booking.com** as the **primary content + inventory source** due to coverage and existing structural fields like built/renovation year.
  - Optionally test **Hotelbeds** or **RateHawk** as alternative or complementary suppliers.
  - Plan for **GIATA** as a Phase 2 mapping/content hub to unify multiple suppliers into a clean Golden Record per property.
  - Treat **pipeline providers** (TOPHOTELPROJECTS, HotelMarketData, Lodging Econometrics) as Phase 2/3 data sources to enrich renovation timelines and future openings.
- Renovation / freshness data is still **not fully standardized**, even with better fields:
  - Freshness will rely on a mix of:
    - Explicit provider fields (`built_year`, `last_renovation_year`, etc.) when present.
    - Heuristics and NLP on descriptions, marketing texts, and possibly reviews.
    - Pipeline/project data from specialized providers.
    - Manual overrides for curated properties in the early stages.


