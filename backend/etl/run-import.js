#!/usr/bin/env node
/**
 * ETL import CLI: fetches hotels from Hotelbeds and persists to DB.
 *
 * Env: HOTELBEDS_API_KEY, HOTELBEDS_SHARED_SECRET, DATABASE_URL (or SCALINGO_POSTGRESQL_URL)
 * Optional: ETL_FROM, ETL_TO, ETL_LANGUAGE (defaults: 1, 100, ENG)
 *
 * Test tier limits: 8 req/4s rate limit, 50 requests/day quota. Each run = 1 API request.
 */

const {
  hasHotelbedsCredentials,
  hotelbedsApiKey,
  hotelbedsSecret,
  getPool,
} = require("./config");
const { fetchHotels } = require("./hotelbeds/fetcher");
const { mapHotelToProperty } = require("./hotelbeds/normalizer");
const {
  getHotelbedsProviderId,
  upsertProviderProperty,
} = require("./persistence");

async function main() {
  if (!hasHotelbedsCredentials()) {
    console.error(
      "Missing Hotelbeds credentials. Set HOTELBEDS_API_KEY and HOTELBEDS_SHARED_SECRET."
    );
    process.exitCode = 1;
    return;
  }

  const from = parseInt(process.env.ETL_FROM ?? "1", 10);
  const to = parseInt(process.env.ETL_TO ?? "100", 10);
  const language = process.env.ETL_LANGUAGE ?? "ENG";

  console.log(`[etl] Fetching hotels from=${from} to=${to} language=${language}`);

  const pool = getPool();
  const providerId = await getHotelbedsProviderId(pool);

  const { hotels } = await fetchHotels(
    { from, to, language },
    hotelbedsApiKey,
    hotelbedsSecret
  );

  console.log(`[etl] Fetched ${hotels.length} hotels`);

  let ok = 0;
  let err = 0;

  for (const raw of hotels) {
    try {
      const { property, providerProperty } = mapHotelToProperty(raw);
      await upsertProviderProperty(providerId, providerProperty, property, pool);
      ok++;
    } catch (e) {
      console.error(`[etl] Failed to persist hotel ${raw.code ?? raw.hotelCode ?? "?"}:`, e.message);
      err++;
    }
  }

  console.log(`[etl] Done. ok=${ok} err=${err}`);
  await pool.end();
}

main().catch((e) => {
  console.error("[etl] Fatal:", e);
  process.exitCode = 1;
});
