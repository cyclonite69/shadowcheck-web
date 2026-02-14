#!/bin/bash
# Show what's actually in the database RIGHT NOW

echo "=== Tables in PUBLIC schema ==="
docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -c "\dt public.*"

echo ""
echo "=== Tables in APP schema ==="
docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -c "\dt app.*"

echo ""
echo "=== ALL schemas in database ==="
docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -c "\dn+"

echo ""
echo "=== Table counts ==="
docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -c "
SELECT 
  schemaname, 
  COUNT(*) as table_count 
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname 
ORDER BY schemaname;"

echo ""
echo "=== Check for Kismet-style tables ==="
docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -c "
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%kismet%' 
   OR tablename IN ('devices', 'data_sources', 'packets', 'alerts')
ORDER BY schemaname, tablename;"
