CREATE OR REPLACE FUNCTION app.fn_get_agency_offices_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom_3857
  ),
  features AS (
    SELECT
      a.id,
      a.agency,
      a.office_type,
      a.name,
      COALESCE(a.normalized_address_line1, a.address_line1) AS address_line1,
      a.city,
      a.state,
      COALESCE(a.normalized_postal_code, a.postal_code) AS postal_code,
      COALESCE(a.normalized_phone_display, a.phone) AS phone,
      a.parent_office,
      a.website,
      ST_AsMVTGeom(
        ST_Transform(a.location::geometry, 3857),
        bounds.geom_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.agency_offices AS a
    CROSS JOIN bounds
    WHERE a.location IS NOT NULL
      AND a.location && ST_Transform(bounds.geom_3857, 4326)::geography
  )
  SELECT ST_AsMVT(features, 'agency_offices', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_agency_offices_tile(integer, integer, integer) TO shadowcheck_user;
