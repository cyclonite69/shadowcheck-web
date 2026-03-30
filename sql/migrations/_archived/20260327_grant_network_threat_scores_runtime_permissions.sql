-- Ensure the application runtime role can read and write threat scores.
-- This is required for ML scoring upserts and for refresh paths that still
-- evaluate objects under the runtime role on existing deployments.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.network_threat_scores TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.network_threat_scores_id_seq TO shadowcheck_user;
