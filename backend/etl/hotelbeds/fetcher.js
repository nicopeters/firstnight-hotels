/**
 * Fetches hotels from Hotelbeds Content API.
 */

const { get } = require("./client");

/**
 * @param {object} opts
 * @param {number} [opts.from=1]
 * @param {number} [opts.to=100]
 * @param {string} [opts.language=ENG]
 * @param {string} [opts.lastUpdateTime] - optional YYYY-MM-DD for incremental
 * @param {string} apiKey
 * @param {string} secret
 * @returns {Promise<{ hotels: object[] }>}
 */
async function fetchHotels(opts, apiKey, secret) {
  const from = opts.from ?? 1;
  const to = opts.to ?? 100;
  const language = opts.language ?? "ENG";

  const params = {
    fields: "all",
    language,
    from: String(from),
    to: String(to),
  };
  if (opts.lastUpdateTime) {
    params.lastUpdateTime = opts.lastUpdateTime;
  }

  const data = await get(apiKey, secret, "/hotels", params);

  // API may return { hotels: [...] } or { hotels: { hotel: [...] } }; adapt if structure differs
  let hotels = data.hotels ?? data.hotel ?? [];
  if (hotels && !Array.isArray(hotels) && typeof hotels === "object") {
    hotels = hotels.hotel ?? hotels.hotels ?? [];
  }
  return { hotels: Array.isArray(hotels) ? hotels : [] };
}

module.exports = { fetchHotels };
