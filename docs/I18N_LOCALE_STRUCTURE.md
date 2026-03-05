## Locale Key Structure and Namespaces

This document defines the naming conventions and directory layout for locale files in FirstNightHotels.

### 1. Locale codes

- English (United Kingdom): `en-GB`
- German (Germany): `de-DE`

These codes are used consistently in:

- Frontend locale folders under `locales/`.
- Backend locale folders under `backend/locales/`.

### 2. Frontend namespaces

Frontend messages are split by feature areas into JSON files per locale:

```text
locales/
  en-GB/
    common.json     # shared navigation and generic UI
    homepage.json   # homepage search + freshness filters
  de-DE/
    common.json
    homepage.json
``+

#### 2.1 `common` namespace

Contains strings that are reused across multiple pages:

- Global navigation:
  - `nav.home`
  - `nav.search`
  - `nav.about`
  - `nav.language`
- Generic actions:
  - `action.search`
  - `action.close`
  - `action.cancel`
  - `action.apply`
- Generic labels:
  - `label.guests`
  - `label.checkIn`
  - `label.checkOut`

#### 2.2 `homepage` namespace

Contains homepage-specific strings, especially for the search box and freshness filters:

- Titles and subtitles:
  - `homepage.title`
  - `homepage.subtitle`
- Search form labels:
  - `homepage.search.destinationLabel`
  - `homepage.search.dateLabel`
  - `homepage.search.guestsLabel`
- Freshness toggle and chips:
  - `homepage.freshness.toggle.label`
  - `homepage.freshness.chip.ultraFresh`
  - `homepage.freshness.chip.veryFresh`
  - `homepage.freshness.chip.fresh`
  - `homepage.freshness.chip.avoidOldStock`
- Freshness vs price:
  - `homepage.freshness.preference.label`
  - `homepage.freshness.preference.price`
  - `homepage.freshness.preference.balanced`
  - `homepage.freshness.preference.freshness`

Additional namespaces like `auth` can be added later following the same pattern.

### 3. Backend namespaces

Backend messages are organized by category:

```text
backend/locales/
  en-GB/
    errors.json     # validation and domain errors
  de-DE/
    errors.json
```

Example keys in `errors.json`:

- `error.validation.required`
- `error.validation.invalidDateRange`
- `error.search.destinationUnsupported`

### 4. Key naming conventions

- Use **dot-separated** paths: `section.subsection.key`.
- Group by **feature** rather than by component name.
- Use **lowerCamelCase** for the last segment, e.g. `freshnessBucketUnknown`.

Examples:

- `homepage.search.title`
- `homepage.freshness.chip.ultraFresh`
- `filters.freshness.hideUnknown`
- `error.validation.required`

### 5. Adding new strings

When adding a new UI string:

1. Choose the appropriate namespace (`common`, `homepage`, or future ones).
2. Add the key to both `en-GB` and `de-DE` JSON files.
3. Use the key in code via the chosen i18n library (`t('homepage.search.title')`, etc.).
4. If a translation is not yet available, temporarily copy the English value into `de-DE` and update later.\n*** End Patch```}"/>
