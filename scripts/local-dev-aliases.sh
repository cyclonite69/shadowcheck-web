#!/usr/bin/env bash
# Local ShadowCheck shell helpers

scroot() {
  cd /home/dbcooper/repos/shadowcheck-web || return 1
}

sclocal() {
  scroot || return 1
  docker compose up -d --build "$@"
}

scps() {
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

scdb() {
  docker exec -it shadowcheck_postgres_local psql -U shadowcheck_user -d shadowcheck_db "$@"
}

scdba() {
  docker exec -it shadowcheck_postgres_local psql -U shadowcheck_admin -d shadowcheck_db "$@"
}

export -f scroot
export -f sclocal
export -f scps
export -f scdb
export -f scdba

echo "Local ShadowCheck aliases loaded:"
echo "  scroot   - cd to the repo"
echo "  sclocal  - docker compose up -d --build"
echo "  scps     - formatted docker ps"
echo "  scdb     - psql as shadowcheck_user on local Postgres"
echo "  scdba    - psql as shadowcheck_admin on local Postgres"
