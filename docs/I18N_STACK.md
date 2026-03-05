## Internationalization Stack – FirstNightHotels

This document defines the internationalization (i18n) stack and file structure for FirstNightHotels, starting with English (en-GB) and German (de-DE).

### 1. Frontend stack (proposal)

Assuming a React + TypeScript frontend (with or without Next.js), we standardize on:

- **Library**: `i18next` with the official React bindings (`react-i18next`).
- **Message storage**: JSON files per locale and namespace.
  - Base directory: `locales/`
  - Locales: `en-GB`, `de-DE`
  - Namespaces (can grow over time):
    - `common` – navigation, generic UI strings, buttons.
    - `homepage` – homepage search, freshness filters.
    - `auth` – login, signup, password reset (later).

This choice keeps us framework-agnostic (works with plain React or Next.js) and is widely used and well-documented.

### 2. Backend/domain i18n (proposal)

For the backend (language still to be chosen), we will:

- Represent all user-facing error and validation messages via **message keys**, not inline strings.
- Store localized messages in JSON files under:
  - `backend/locales/en-GB/*.json`
  - `backend/locales/de-DE/*.json`
- The backend will:
  - Accept a locale hint via `Accept-Language` header or an explicit query parameter.
  - Use that locale to choose the appropriate message set when generating errors and domain messages.

The specific backend language/framework can integrate with these files via a small custom loader or an i18n library matching the chosen stack.

### 3. File structure summary

Planned i18n-related file layout in the repo:

- `locales/`
  - `en-GB/`
    - `common.json`
    - `homepage.json`
  - `de-DE/`
    - `common.json`
    - `homepage.json`
- `backend/locales/` (for later backend implementation)
  - `en-GB/`
    - `errors.json` (planned)
  - `de-DE/`
    - `errors.json` (planned)

Frontend and backend will share the same locale codes (`en-GB`, `de-DE`) and a consistent key naming convention (see locale structure docs).

