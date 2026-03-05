## Locale Handling – Frontend and Backend

This document describes how the active locale is determined and propagated across the FirstNightHotels stack.

### 1. Supported locales

- `en-GB` (English, United Kingdom)
- `de-DE` (German, Germany)

Default locale: `en-GB`.

### 2. Frontend locale determination

#### 2.1 URL vs. implicit locale (MVP choice)

For the MVP we keep routing simple and:

- Do **not** encode the locale into the URL yet (no `/en/...` vs `/de/...`).
- Determine the initial locale on the client based on:
  1. A stored preference in `localStorage` (if present), otherwise
  2. The browser language (`navigator.language`), mapped to `en-GB` or `de-DE`, otherwise
  3. Fallback to `en-GB`.

This keeps the implementation lightweight while still respecting user preference.

We can move to locale-prefixed URLs later without changing the locale file structure.

#### 2.2 Language switcher behavior

- There is a visible language switcher in the main navigation:
  - Options: `English` / `Deutsch`.
- When the user selects a language:
  - Update the current locale in the frontend state (e.g. React context).
  - Persist the choice to `localStorage` (e.g. key `firstnight.locale`).
  - Optionally send the new locale to the backend with subsequent API calls.

### 3. Backend locale handling

#### 3.1 Incoming locale hint

Each request from the frontend to the backend should include a locale hint:

- Preferred option: HTTP header `Accept-Language` with values like `en-GB` or `de-DE`.
- Alternative/additional option: explicit query parameter or JSON field, e.g. `?locale=en-GB`.

The backend:

- Parses the hint.
- Normalizes it to one of the supported locales (`en-GB` or `de-DE`).
- Falls back to `en-GB` if an unsupported locale is requested.

#### 3.2 Using the locale in backend responses

For user-facing messages (e.g. validation errors):

- Backend looks up message keys in:
  - `backend/locales/<locale>/errors.json`
- Example:
  - For a missing required field, use `error.validation.required` and resolve it into the correct language.

For purely machine-oriented fields, the backend continues to send language-neutral data (e.g. enums, codes).

### 4. Frontend–Backend contract

- The frontend is responsible for:
  - Choosing and storing the active locale.
  - Including the locale in outgoing API requests (header or parameter).
  - Rendering UI labels via `locales/<locale>/*.json` and the chosen i18n library.
- The backend is responsible for:
  - Respecting the locale hint.
  - Localizing error and domain messages where relevant.

### 5. Fallback strategy

- If a translation key is missing in `de-DE`, the frontend and backend should:
  - Fall back to `en-GB` for that specific key.
  - Optionally log a warning in development to catch missing translations early.

This ensures that the UI never shows empty or broken labels, even while translations are still being completed.

