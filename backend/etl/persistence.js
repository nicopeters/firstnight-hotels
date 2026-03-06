/**
 * Upserts properties and provider_properties.
 */

const { getPool } = require("./config");

async function getHotelbedsProviderId(pool) {
  const res = await pool.query(
    "SELECT id FROM providers WHERE name = $1",
    ["hotelbeds"]
  );
  if (res.rows.length === 0) {
    throw new Error("Provider 'hotelbeds' not found. Run migrations first.");
  }
  return res.rows[0].id;
}

/**
 * Insert a new property.
 */
async function insertProperty(property, pool = null) {
  const db = pool ?? getPool();

  const res = await db.query(
    `INSERT INTO properties (
      type, name, brand, chain,
      country_code, city, address_line1, address_line2, postal_code,
      latitude, longitude,
      opening_year, last_major_renovation_year, last_soft_renovation_year, last_rebranding_year
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id`,
    [
      property.type,
      property.name,
      property.brand,
      property.chain,
      property.country_code,
      property.city,
      property.address_line1,
      property.address_line2,
      property.postal_code,
      property.latitude,
      property.longitude,
      property.opening_year,
      property.last_major_renovation_year,
      property.last_soft_renovation_year,
      property.last_rebranding_year,
    ]
  );

  return res.rows[0].id;
}

/**
 * Update an existing property.
 */
async function updateProperty(propertyId, property, pool = null) {
  const db = pool ?? getPool();

  await db.query(
    `UPDATE properties SET
      type = $1, name = $2, brand = $3, chain = $4,
      country_code = $5, city = $6, address_line1 = $7, address_line2 = $8, postal_code = $9,
      latitude = $10, longitude = $11,
      opening_year = $12, last_major_renovation_year = $13, last_soft_renovation_year = $14, last_rebranding_year = $15,
      updated_at = now()
    WHERE id = $16`,
    [
      property.type,
      property.name,
      property.brand,
      property.chain,
      property.country_code,
      property.city,
      property.address_line1,
      property.address_line2,
      property.postal_code,
      property.latitude,
      property.longitude,
      property.opening_year,
      property.last_major_renovation_year,
      property.last_soft_renovation_year,
      property.last_rebranding_year,
      propertyId,
    ]
  );
}

/**
 * @param {number} providerId
 * @param {object} providerProperty - { provider_hotel_id, provider_raw }
 * @param {object} property - canonical property
 * @param {import('pg').Pool} [pool]
 */
async function upsertProviderProperty(
  providerId,
  providerProperty,
  property,
  pool = null
) {
  const db = pool ?? getPool();

  const existing = await db.query(
    `SELECT property_id FROM provider_properties
     WHERE provider_id = $1 AND provider_hotel_id = $2`,
    [providerId, providerProperty.provider_hotel_id]
  );

  if (existing.rows.length > 0) {
    const propertyId = existing.rows[0].property_id;
    await updateProperty(propertyId, property, db);
    await db.query(
      `UPDATE provider_properties SET provider_raw = $1, updated_at = now()
       WHERE provider_id = $2 AND provider_hotel_id = $3`,
      [JSON.stringify(providerProperty.provider_raw), providerId, providerProperty.provider_hotel_id]
    );
    return propertyId;
  }

  const propertyId = await insertProperty(property, db);
  await db.query(
    `INSERT INTO provider_properties (provider_id, provider_hotel_id, property_id, provider_raw)
     VALUES ($1, $2, $3, $4)`,
    [
      providerId,
      providerProperty.provider_hotel_id,
      propertyId,
      JSON.stringify(providerProperty.provider_raw),
    ]
  );
  return propertyId;
}

module.exports = {
  getHotelbedsProviderId,
  insertProperty,
  updateProperty,
  upsertProviderProperty,
};
