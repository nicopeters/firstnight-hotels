const express = require("express");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

// Prefer Scalingo-specific env var if present, fall back to generic DATABASE_URL.
const databaseUrl =
  process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL;

let pool;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    // SSL is required on Scalingo Postgres in most setups.
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : {
            rejectUnauthorized: false,
          },
  });
} else {
  console.warn(
    "No database URL configured. Set SCALINGO_POSTGRESQL_URL or DATABASE_URL."
  );
}

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "API is running" });
});

app.get("/db-check", async (req, res) => {
  if (!pool) {
    return res.status(500).json({
      ok: false,
      error: "Database URL not configured",
    });
  }

  try {
    const result = await pool.query("SELECT 1");
    res.json({
      ok: true,
      result: result.rows[0],
    });
  } catch (error) {
    console.error("Database connectivity check failed:", error);
    res.status(500).json({
      ok: false,
      error: "Database connectivity check failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`FirstNightHotels API listening on port ${PORT}`);
});

