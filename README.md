# firstnight-hotels
Hotel search engine that prioritizes opening/renovation dates over star ratings

## Database migrations (Scalingo + PostgreSQL)

This repo uses `node-pg-migrate` to version and create the PostgreSQL schema.

### Local

- Set `DATABASE_URL` (e.g. `postgres://user:pass@localhost:5432/firstnight`).
- Run migrations:
  - `npm install`
  - `npm run migrate:up`

### Scalingo

- Ensure the app has a PostgreSQL addon attached (it provides `SCALINGO_POSTGRESQL_URL`).
- Set `DATABASE_URL` in the Scalingo environment so the migration tool can pick it up.
  - Recommended: set it to the same value as `SCALINGO_POSTGRESQL_URL`.
- On every deploy, Scalingo runs:
  - `postdeploy: npm run migrate:up` (see `Procfile`)

### Verify

- Check app logs to confirm the `postdeploy` hook succeeded.
- Call `GET /db-check` on the deployed app to verify DB connectivity.

## ETL (Hotelbeds import)

Import hotels from the Hotelbeds Content API:

```bash
export HOTELBEDS_API_KEY="your-api-key"
export HOTELBEDS_SHARED_SECRET="your-secret"
export DATABASE_URL="postgres://..."   # or SCALINGO_POSTGRESQL_URL on Scalingo

npm run etl:import
```

Optional env: `ETL_FROM`, `ETL_TO`, `ETL_LANGUAGE` (defaults: 1, 100, ENG).

**Test tier limits**: 8 requests per 4 seconds, 50 requests per day. Each run = 1 API request. Use small batches (e.g. to=100) while testing.
