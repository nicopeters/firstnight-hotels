## Hotel Data Provider Selection – Criteria and Initial Scoring

This document defines selection criteria for hotel content providers and applies an initial qualitative scoring to the current shortlist:

- Booking.com
- Hotelbeds
- RateHawk
- GIATA
- Amadeus Self-Service

Scoring scale (qualitative for now):
- `+++` strong
- `++` good
- `+` acceptable
- `–` weak/uncertain

### 1. Coverage & Inventory Fit

**What matters for FirstNightHotels:**
- Strong coverage in **Europe**, especially city and leisure destinations.
- Good representation of **hotels + serviced apartments/aparthotels** (not only classic hotels).
- Reasonable depth (not only a thin slice of properties per city).

**Assessment:**

| Provider    | Europe coverage | Apartments / aparthotels | Comment |
|------------|-----------------|---------------------------|---------|
| Booking.com| `+++`           | `+++`                     | Extremely strong coverage, especially in Europe; excellent for hotels + apartments. |
| Hotelbeds  | `+++`           | `++`                      | Very strong European hotel network, decent aparthotel coverage. |
| RateHawk   | `+++`           | `+++`                     | 2.9M+ accommodations including many apartments and guest houses. |
| GIATA      | `+++`           | `++`                      | Excellent breadth but as a content/mapping layer, not a booking source. |
| Amadeus    | `++`            | `+`                       | Solid for bookable hotels, less strong for apartments/serviced apartments. |

### 2. Data Fields for Freshness (Opening/Renovation)

**What matters:**
- Explicit fields for **opening year** and/or **last renovation year**.
- Consistent population of these fields across a meaningful share of properties.
- Rich descriptions and room/facility texts that can be mined for renovation signals.

**Assessment (based on public docs and industry knowledge):**

| Provider    | Explicit opening/renovation fields | Description quality | Overall freshness potential |
|------------|-------------------------------------|---------------------|-----------------------------|
| Booking.com| `++`                                | `+++`               | `+++` – explicit built/renovation fields in some APIs + rich descriptions. |
| Hotelbeds  | `+`                                 | `+++`               | `++` – rich descriptions, but explicit renovation fields not standard. |
| RateHawk   | `+`                                 | `++`                | `++` – broad content; likely similar heuristic needs as Hotelbeds. |
| GIATA      | `+`                                 | `+++`               | `++` – high-quality standardized content, helpful for NLP and heuristics. |
| Amadeus    | `–`                                 | `++`                | `+` – focus is more on availability and ratings than renovation metadata. |

**Implication:** No provider gives “freshness” out of the box. We should:
- Prefer providers with rich, well-structured descriptions and room/facility data.
- Plan for **NLP/heuristics + manual curation** on top.

### 3. Legal & Commercial Aspects

**What matters:**
- Clear contracts for **caching and using content** (texts, images) in our own UI.
- Ability to operate as a **metasearch** (deep-linking to provider) rather than mandatory full OTA model.
- Commercial terms realistic for an early-stage startup.

**Assessment (high-level, subject to contract review):**

| Provider    | Startup-friendliness | Content usage rights clarity | Comment |
|------------|----------------------|------------------------------|---------|
| Booking.com| `++`                 | `++`                         | Strong partner ecosystem; needs careful reading of content usage terms. |
| Hotelbeds  | `++`                 | `++`                         | Common in startup OTAs/meta; needs negotiation but standard patterns exist. |
| RateHawk   | `++`                 | `++`                         | B2B focus; API partners are a core use case. |
| GIATA      | `++`                 | `+++`                        | Very clear value prop around licensed content and mapping. |
| Amadeus    | `+`                  | `++`                         | Self-service is good, but some content usage restrictions for caching/branding. |

### 4. API Quality & Developer Experience

**What matters:**
- REST/JSON APIs with good documentation and examples.
- Sandbox or test environments.
- Support for incremental updates / change data.
- Reasonable rate limits and support channels.

**Assessment:**

| Provider    | Docs & DX | Incremental updates | Sandbox / test | Overall |
|------------|-----------|---------------------|----------------|---------|
| Booking.com| `++`      | `++`                | `++`           | `++`    |
| Hotelbeds  | `++`      | `++`                | `++`           | `++`    |
| RateHawk   | `++`      | `+++`               | `++`           | `+++`   |
| GIATA      | `++`      | `++`                | `+`            | `++`    |
| Amadeus    | `+++`     | `+`                 | `+++`          | `++`    |

### 5. Cost & Strategic Control (Qualitative)

**What matters:**
- Ability to start **lean** (few providers) and increase complexity later.
- Avoid being locked into a single provider’s commercial and technical stack forever.
- Make it easy to **add a second provider later**, possibly with GIATA mapping.

**Assessment:**

| Provider    | Entry cost/complexity | Lock-in risk | Role in long-term architecture |
|------------|------------------------|--------------|--------------------------------|
| Booking.com| `+++`                  | `++`         | Phase 1 backbone for Europe; must mitigate single-supplier risk via mapping. |
| Hotelbeds  | `++`                   | `++`         | Strong candidate as an additional or alternative supplier. |
| RateHawk   | `++`                   | `++`         | Similarly strong; slightly different commercial profile. |
| GIATA      | `+`                    | `+++`        | Great strategic asset once multi-supplier is needed (Golden Record). |
| Amadeus    | `+`                    | `+`          | Can be used tactically, but unlikely to be the core backbone. |

### 6. Initial Recommendation for MVP

For a **Europe-focused metasearch MVP (hotels + serviced apartments)**:

- **Phase 1** – Start with **exactly one main content + inventory provider**:
  - Prefer **Booking.com** as the initial backbone due to inventory and explicit year fields.
  - Optionally evaluate **Hotelbeds** or **RateHawk** in pilot markets as alternatives.
- Plan the **data model and ETL layer** from day one so that:
  - Provider-specific fields are isolated behind a `ProviderProperty` layer.
  - The core `Property` and `PropertyRenovation` models stay provider-agnostic.
  - Adding GIATA, TOPHOTELPROJECTS, or additional suppliers later does not require rewriting the product.
- Treat **GIATA** as a **Phase 2** upgrade when:
  - You add a second supplier.
  - You need robust cross-provider mapping and de-duplication (Golden Record).
- Consider **pipeline providers** (TOPHOTELPROJECTS, HotelMarketData, etc.) as **Phase 2/3** for:
  - Future openings and major renovations.
  - Deepening the renovation timeline beyond OTA-provided data.
- Keep **Amadeus** in mind mainly for:
  - Hotel ratings.
  - Specific legacy/GDS-heavy markets where you need additional coverage.


