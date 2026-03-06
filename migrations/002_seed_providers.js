/**
 * Seed initial providers for ETL (e.g. hotelbeds).
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO providers (name, kind)
    VALUES ('hotelbeds', 'bedsbank')
    ON CONFLICT (name) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM providers WHERE name = 'hotelbeds';`);
};
