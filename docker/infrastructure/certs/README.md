## Certificate Handling

ShadowCheck no longer keeps deployable TLS certificates in this repository.

Canonical server certificate location on the EC2 EBS volume:

- `/var/lib/postgresql/certs/shadowcheck.crt`
- `/var/lib/postgresql/certs/shadowcheck.key`

`deploy/aws/scripts/scs_rebuild.sh` treats that pair as the only persistent certificate for:

- nginx / frontend TLS
- pgAdmin TLS
- PostgreSQL SSL

On first deploy, `scs_rebuild.sh` generates a 10-year self-signed certificate for the instance public IP and writes it to the canonical EBS path. On later runs, it reuses the existing pair as-is and can back it up to `s3://${S3_BUCKET}/certs/` when `S3_BUCKET` is configured.

Local helper usage:

- `certs/generate-cert.sh` writes to `/var/lib/postgresql/certs/` when run on the server without an explicit `CERT_DIR`.
- The same script writes to `docker/infrastructure/certs/local/` when run locally without an explicit `CERT_DIR`.
- `docker/infrastructure/certs/local/` is gitignored and intended only for local experiments.

If you need nginx-style filenames in an explicit target directory, run the helper with `CERT_DIR=/path/to/certs`. In that compatibility mode it writes `server.crt` and `server.key`.
