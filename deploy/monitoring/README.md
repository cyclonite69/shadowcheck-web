# ShadowCheck Monitoring Stack

Standalone Grafana stack. Runs independently of the main app.
For the current AWS deployment, Grafana joins Docker host networking because the
main ShadowCheck services also run in `host` network mode.

## Start

```bash
git pull --rebase origin master
export DB_PASSWORD="$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config \
  --region us-east-1 \
  --query SecretString \
  --output text | jq -r '.db_password')"
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d shadowcheck_grafana
```

## Stop

```bash
docker compose -f docker-compose.monitoring.yml down
```

## Access

- Grafana: http://34.204.161.164:3002
- Login: admin / admin (change after first login)

## Datasource

Pre-wired to shadowcheck_postgres via provisioning.
DB_PASSWORD is injected from the shell environment.
In AWS deployments, source it from Secrets Manager before starting Grafana.
Because the deployed containers use `host` networking, Grafana connects to
Postgres at `127.0.0.1:5432`.

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
