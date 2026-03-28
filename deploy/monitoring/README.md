# ShadowCheck Monitoring Stack

Standalone Grafana stack. Runs independently of the main app.
For the current AWS deployment, Grafana joins Docker host networking because the
main ShadowCheck services also run in `host` network mode.

## Start

```bash
git pull --rebase origin master
SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config \
  --region us-east-1 \
  --query SecretString \
  --output text)"
export GRAFANA_ADMIN_PASSWORD="$(jq -r '.grafana_admin_password' <<<"$SECRET_JSON")"
export GRAFANA_READER_PASSWORD="$(jq -r '.grafana_reader_password' <<<"$SECRET_JSON")"
export GRAFANA_ADMIN_USER="${GRAFANA_ADMIN_USER:-grafanaadmin}"
export GF_SERVER_ROOT_URL="https://34.204.161.164/grafana/"
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d shadowcheck_grafana
```

## Stop

```bash
docker compose -f docker-compose.monitoring.yml down
```

## Access

- Grafana: http://34.204.161.164:3002
- Login: `grafanaadmin` with the runtime `GRAFANA_ADMIN_PASSWORD` secret from AWS Secrets Manager

For existing Grafana volumes, the password should be force-synced into Grafana with
`grafana cli admin reset-admin-password` during deploy/rotation. Legacy EC2 installs
that were initialized before the username default changed may still use login
`admin` instead of `grafanaadmin`.

## Datasource

Pre-wired to shadowcheck_postgres via provisioning.
`GRAFANA_READER_PASSWORD` is injected from the shell environment at container startup.
In AWS deployments, source it from Secrets Manager before starting Grafana.
Because the deployed containers use `host` networking, Grafana connects to
Postgres at `127.0.0.1:5432`.
The provisioned datasource uses the least-privilege `grafana_reader` role.

## Secrets

Do not write Grafana or database credentials to disk.
Source them from AWS Secrets Manager into the shell only for the duration of the
deployment command.

Recommended secret keys in `shadowcheck/config`:

- `grafana_admin_password`
- `grafana_reader_password`

Recommended runtime env:

- `GRAFANA_ADMIN_USER=grafanaadmin`

To generate/rotate both keys and sync the PostgreSQL `grafana_reader` role:

```bash
GF_SERVER_ROOT_URL="https://34.204.161.164/grafana/" \
./deploy/aws/scripts/rotate-grafana-passwords.sh
```

## Enable Slow Query Panel (optional)

Run once:

```bash
export DB_PASSWORD="$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config \
  --region us-east-1 \
  --query SecretString \
  --output text | jq -r '.db_password')"
docker exec \
  -e PGPASSWORD="$DB_PASSWORD" \
  shadowcheck_postgres \
  psql -h 127.0.0.1 -U shadowcheck_user -d shadowcheck_db \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

Then add `-c shared_preload_libraries=pg_stat_statements` to your postgres
service command in docker-compose.yml and restart postgres.

## Adding New Dashboards

Drop `.json` files into:
`deploy/monitoring/grafana/provisioning/dashboards/`
Grafana picks them up within 30 seconds.
