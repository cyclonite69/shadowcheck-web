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
the DB host wiring.

Passwords are not hardcoded in compose:

- `db_password` still comes from `secretsManager.getOrThrow('db_password')`
- `db_admin_password` still comes from `secretsManager.get('db_admin_password')`

To let the API container reach AWS Secrets Manager with your normal local AWS login,
the compose file mounts `${HOME}/.aws` into the API container and enables AWS
shared-config loading. In the common case, you only need:

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

The `${HOME}/.aws` mount is writable on purpose so AWS SSO can refresh its local cache.
If that mount is read-only, Secrets Manager access from the API container will fail even
though the profile and cache files are present.

If you do not want to use AWS Secrets Manager locally, export `DB_PASSWORD`,
`DB_ADMIN_PASSWORD`, `MAPBOX_TOKEN`, and any other required secrets explicitly in
your shell before starting the compose stack.

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
- `scps` for formatted container status
- `scdb` for `psql` as `shadowcheck_user`
- `scdba` for `psql` as `shadowcheck_admin`

If you call `sclocal api`, the helper will refuse to run unless
`AWS_PROFILE`, `AWS_REGION`, and `SHADOWCHECK_AWS_SECRET` are already set.
