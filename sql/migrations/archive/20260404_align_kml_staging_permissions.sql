-- Align KML staging permissions with the app/runtime privilege model.
--
-- Runtime policy:
-- - shadowcheck_admin owns migrations, ETL, and staging-table writes
-- - shadowcheck_user remains read-mostly with only targeted write exceptions

REVOKE INSERT, UPDATE, DELETE ON TABLE app.kml_files FROM shadowcheck_user;
REVOKE INSERT, UPDATE, DELETE ON TABLE app.kml_points FROM shadowcheck_user;

GRANT SELECT ON TABLE app.kml_files TO shadowcheck_user;
GRANT SELECT ON TABLE app.kml_points TO shadowcheck_user;

-- Keep sequence usage available for compatibility with generic metadata checks.
GRANT USAGE ON SEQUENCE app.kml_files_id_seq TO shadowcheck_user;
GRANT USAGE ON SEQUENCE app.kml_points_id_seq TO shadowcheck_user;
