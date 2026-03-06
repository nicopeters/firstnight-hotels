/**
 * ETL configuration: env vars and DB pool.
 */

const { Pool } = require("pg");

const databaseUrl =
  process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL;

const hotelbedsApiKey = process.env.HOTELBEDS_API_KEY;
const hotelbedsSecret = process.env.HOTELBEDS_SHARED_SECRET;

function hasHotelbedsCredentials() {
  return Boolean(hotelbedsApiKey && hotelbedsSecret);
}

let pool = null;

function getPool() {
  if (!pool) {
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL or SCALINGO_POSTGRESQL_URL not set. Cannot connect to database."
      );
    }
    const isLocalhost =
      /localhost|127\.0\.0\.1/.test(databaseUrl) ||
      process.env.PGSSLMODE === "disable";
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

module.exports = {
  databaseUrl,
  hotelbedsApiKey,
  hotelbedsSecret,
  hasHotelbedsCredentials,
  getPool,
};
