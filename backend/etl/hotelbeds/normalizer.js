/**
 * Maps Hotelbeds hotel JSON to canonical Property and ProviderProperty.
 */

const PROPERTY_TYPES = ["hotel", "aparthotel", "serviced_apartment"];

function inferPropertyType(hotel) {
  const code = (
    hotel.categoryCode ??
    hotel.accommodationTypeCode ??
    hotel.type ??
    ""
  ).toUpperCase();
  if (code.includes("APT") || code.includes("APARTMENT")) return "aparthotel";
  if (code.includes("SERVICED") || code.includes("RESIDENCE")) return "serviced_apartment";
  return "hotel";
}

function safeStr(val) {
  if (val == null) return null;
  const s = typeof val === "string" ? val : val?.content ?? String(val);
  return s.trim() || null;
}

function safeNum(val) {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} hotel - raw Hotelbeds hotel object
 * @returns {{ property: object, providerProperty: object }}
 */
function mapHotelToProperty(hotel) {
  const code = String(hotel.code ?? hotel.hotelCode ?? "");
  const name = safeStr(hotel.name?.content ?? hotel.name) ?? "Unknown";
  const countryCode = (hotel.countryCode ?? hotel.country ?? "XX").slice(0, 2).toUpperCase();
  const city = safeStr(hotel.city?.content ?? hotel.city) ?? "Unknown";

  const coords = hotel.coordinates ?? hotel.geoCode ?? {};
  const latitude = safeNum(coords.latitude ?? coords.lat);
  const longitude = safeNum(coords.longitude ?? coords.long ?? coords.lng);

  const address = hotel.address ?? {};
  const addressContent = typeof address === "string" ? address : address.content;

  const chain = hotel.chain ?? {};
  const chainName = typeof chain === "string" ? chain : chain.name ?? chain.description?.content;

  const property = {
    type: inferPropertyType(hotel),
    name,
    brand: safeStr(chainName) ?? null,
    chain: safeStr(chain.code ?? chainName) ?? null,
    country_code: countryCode,
    city,
    address_line1: safeStr(addressContent ?? address.line1) ?? null,
    address_line2: safeStr(address.line2) ?? null,
    postal_code: safeStr(address.postalCode ?? address.zipCode) ?? null,
    latitude,
    longitude,
    opening_year: null,
    last_major_renovation_year: null,
    last_soft_renovation_year: null,
    last_rebranding_year: null,
  };

  const providerProperty = {
    provider_hotel_id: code,
    provider_raw: hotel,
  };

  return { property, providerProperty };
}

module.exports = { mapHotelToProperty, PROPERTY_TYPES };
