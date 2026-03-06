/**
 * Hotelbeds Content API HTTP client with X-Signature auth, retry, rate limit.
 */

const crypto = require("crypto");

const BASE_URL =
  process.env.HOTELBEDS_BASE_URL ||
  "https://api.test.hotelbeds.com/hotel-content-api/1.0";

// Test tier: 8 req / 4 sec. Use 600ms to stay safely under limit.
const RATE_LIMIT_MS = parseInt(process.env.HOTELBEDS_RATE_LIMIT_MS ?? "600", 10);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

let lastRequestTime = 0;

function buildSignature(apiKey, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const str = `${apiKey}${secret}${timestamp}`;
  return crypto.createHash("sha256").update(str).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
      }
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
}

/**
 * @param {string} apiKey
 * @param {string} secret
 * @param {string} path - e.g. "/hotels"
 * @param {Record<string, string>} [params] - query params
 * @returns {Promise<object>} parsed JSON
 */
async function get(apiKey, secret, path, params = {}) {
  await rateLimit();

  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}${search ? `?${search}` : ""}`;

  const signature = buildSignature(apiKey, secret);

  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      "Api-Key": apiKey,
      "X-Signature": signature,
      Accept: "application/json",
    },
  });

  return res.json();
}

module.exports = { get, BASE_URL };
