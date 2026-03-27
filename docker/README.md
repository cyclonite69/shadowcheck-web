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

To let the API container reach AWS Secrets Manager, run `docker compose up` with real
AWS credentials in your shell, for example `AWS_PROFILE`, `AWS_REGION`, or the
standard `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` variables. If you do not want
to use AWS Secrets Manager locally, export `DB_PASSWORD` and `DB_ADMIN_PASSWORD`
explicitly in your shell before starting the compose stack.

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
export S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
./scripts/fetch-latest-s3-backup.sh
./scripts/restore-local-backup.sh ./backups/s3/<latest-backup>.dump
```
