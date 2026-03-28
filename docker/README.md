# Local Docker

Use the root compose file for a self-contained local stack:

```bash
docker compose up -d
```

What it starts:

- `postgres` on `127.0.0.1:5432`
- `redis` on `127.0.0.1:6379`
- `api` on `127.0.0.1:3001`
- `frontend` on `http://127.0.0.1:8080`

Local Docker uses `DB_HOST=postgres` automatically. No `.env` file is required for
the DB host wiring. If you run the backend on your host instead of inside Docker,
set `DB_HOST=localhost` explicitly.

Passwords are not hardcoded in compose:

- `db_password` still comes from `secretsManager.getOrThrow('db_password')`
- `db_admin_password` still comes from `secretsManager.get('db_admin_password')`

Preferred local secrets approach:

- keep production secrets in AWS Secrets Manager
- mount `${HOME}/.aws` into the API container read-only
- export `AWS_PROFILE` / `AWS_REGION` on the host before `docker compose up`

In the common case, you only need:

```bash
export AWS_PROFILE=shadowcheck-sso
export AWS_REGION=us-east-1
docker compose up -d --force-recreate api
```

The default AWS Secrets Manager secret name is:

```bash
shadowcheck/config
```

If you use a non-default secret name, also export:

```bash
export SHADOWCHECK_AWS_SECRET=your/real/secret-name
```

The `${HOME}/.aws` mount is read-only by design. Refresh SSO or any other local
AWS credentials on the host first, then recreate the API container so it reads the
updated files. This keeps local Docker from writing secret material into mounted
credential files.

Alternative local Docker credentials path:

- export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`
  directly in your shell before `docker compose up`
- this works without the shared-config mount as long as the credentials have access
  to `shadowcheck/config`

Local-only mock secrets path:

- if you intentionally do not use AWS Secrets Manager, export `DB_PASSWORD`,
  `DB_ADMIN_PASSWORD`, `MAPBOX_TOKEN`, `OPENCAGE_API_KEY`, and any other required
  secrets explicitly in your shell before starting the compose stack
- do not commit those values to `.env`

Common Secrets Manager keys:

- `db_password`
- `db_admin_password`
- `mapbox_token`
- `opencage_api_key`
- `google_maps_api_key`
- `locationiq_api_key`
- `smarty_auth_id`
- `smarty_auth_token`

The local API container also defaults to:

```bash
NODE_OPTIONS=--max-old-space-size=2048
```

to avoid V8 heap pressure during heavier local admin/geospatial usage. Override it
in your shell if you want a different local heap size.

Production EC2 keeps its explicit deployed database host in `.env`, for example:

```bash
DB_HOST=34.204.161.164
```

S3 backup bucket names are configuration, not secrets:

- local Docker can export `S3_BACKUP_BUCKET` in the shell when needed
- EC2 can inject it via `.env` or AWS SSM Parameter Store during rebuild/bootstrap
- do not store `S3_BACKUP_BUCKET` in AWS Secrets Manager

Typical local restore flow:

```bash
docker compose up -d postgres redis api
export AWS_PROFILE=shadowcheck-sso
export AWS_REGION=us-east-1
export S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
./scripts/fetch-latest-s3-backup.sh
./scripts/restore-local-backup.sh ./backups/s3/<latest-backup>.dump
```

If `api/v2/networks/filtered` or explorer pages fail after restore, refresh the
materialized view used by those endpoints:

```bash
docker exec shadowcheck_postgres_local psql -U shadowcheck_user -d shadowcheck_db -c \
  "REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;"
```

Local shell helpers are also available:

```bash
source ./scripts/local-dev-aliases.sh
```

This gives you:

- `scroot` to jump to the repo
- `sclocal` to run `docker compose up -d --build`
- `scapi` to recreate the local `api` container with
  `AWS_PROFILE=shadowcheck-sso`, `AWS_REGION=us-east-1`,
  and `SHADOWCHECK_AWS_SECRET=shadowcheck/config`
- `scgrafana` to fetch Grafana secrets from AWS, sync the local `grafana_reader`
  role, and start local Grafana on `http://localhost:8080/grafana/`
- `scps` for formatted container status
- `scdb` for `psql` as `shadowcheck_user`
- `scdba` for `psql` as `shadowcheck_admin`

If you call `sclocal api`, the helper will refuse to run unless
`AWS_PROFILE`, `AWS_REGION`, and `SHADOWCHECK_AWS_SECRET` are already set.

To start local Grafana directly without shell aliases:

```bash
AWS_PROFILE=shadowcheck-sso \
AWS_REGION=us-east-1 \
SHADOWCHECK_AWS_SECRET=shadowcheck/config \
bash ./scripts/start-local-grafana.sh
```

Local Grafana uses:

- App/embed URL: `http://localhost:8080/grafana/`
- Upstream listener: `http://127.0.0.1:3002/`
- Username: `grafanaadmin`
- Password: `grafana_admin_password` from `shadowcheck/config`

The local startup script force-syncs `grafana_admin_password` into Grafana itself
with `grafana cli`, so the stored password matches Secrets Manager even when the
Grafana data volume already exists.

If the existing local Grafana volume was initialized with a different admin username,
the username may remain unchanged until that local Grafana data volume is recreated.

The monitoring page embeds Grafana through the frontend proxy, so local iframe
testing should use `http://localhost:8080/monitoring` rather than going directly
to port `3002`.
