# ShadowCheck Monitoring Stack

Standalone Grafana stack. Runs independently of the main app.

## Start

```bash
git pull --rebase origin master
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
DB_PASSWORD injected from .env — no manual Grafana configuration needed.

## Enable Slow Query Panel (optional)

Run once:

```bash
docker exec \
  -e PGPASSWORD="$(grep DB_PASSWORD .env | cut -d= -f2)" \
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
