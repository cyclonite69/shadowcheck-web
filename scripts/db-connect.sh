#!/bin/bash
cd ~/ShadowCheckStatic
PWD=$(node -e "const ks = require('./src/services/keyringService'); ks.getCredential('db_password').then(p => process.stdout.write(p));")
docker exec -e PGPASSWORD="$PWD" -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db
