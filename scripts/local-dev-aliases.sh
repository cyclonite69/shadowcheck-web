#!/usr/bin/env bash
# Local ShadowCheck shell helpers

scroot() {
  cd /home/dbcooper/repos/shadowcheck-web || return 1
}

sclocal() {
  scroot || return 1
  local wants_api=0
  for arg in "$@"; do
    if [ "$arg" = "api" ]; then
      wants_api=1
      break
    fi
  done

  if [ "$wants_api" -eq 1 ] && {
    [ -z "${AWS_PROFILE:-}" ] || [ -z "${AWS_REGION:-}" ] || [ -z "${SHADOWCHECK_AWS_SECRET:-}" ];
  }; then
    echo "sclocal: AWS-backed api requested, but AWS_PROFILE/AWS_REGION/SHADOWCHECK_AWS_SECRET is incomplete." >&2
    echo "Use 'scapi' or export the required env vars first." >&2
    return 1
  fi

  docker compose up -d --build "$@"
}

scapi() {
  scroot || return 1

  export AWS_PROFILE="${AWS_PROFILE:-shadowcheck-sso}"
  export AWS_REGION="${AWS_REGION:-us-east-1}"
  export SHADOWCHECK_AWS_SECRET="${SHADOWCHECK_AWS_SECRET:-shadowcheck/config}"

  docker compose up -d --build --force-recreate api "$@"
}

scgrafana() {
  scroot || return 1

  export AWS_PROFILE="${AWS_PROFILE:-shadowcheck-sso}"
  export AWS_REGION="${AWS_REGION:-us-east-1}"
  export SHADOWCHECK_AWS_SECRET="${SHADOWCHECK_AWS_SECRET:-shadowcheck/config}"

  bash ./scripts/start-local-grafana.sh "$@"
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

scsecrets() {
  scroot || return 1
  ./scripts/start-local-with-secrets.sh
}

export -f scroot
export -f sclocal
export -f scapi
export -f scgrafana
export -f scps
export -f scdb
export -f scdba
export -f scsecrets

echo "Local ShadowCheck aliases loaded:"
echo "  scroot   - cd to the repo"
echo "  sclocal  - docker compose up -d --build"
echo "  scapi    - recreate api with AWS_PROFILE/AWS_REGION/SHADOWCHECK_AWS_SECRET defaults"
echo "  scgrafana - start local Grafana with AWS-backed Grafana secrets and grafana_reader sync"
echo "  scps     - formatted docker ps"
echo "  scdb     - psql as shadowcheck_user on local Postgres"
echo "  scdba    - psql as shadowcheck_admin on local Postgres"
echo "  scsecrets - restart api & reload frontend so AWS secrets reload before you log in"
