#!/bin/bash
set -euo pipefail
# Refresh threat scoring materialized view
# Run daily at 3 AM via cron: 0 3 * * * /path/to/refresh-threat-scores.sh

set -e

LOG_FILE="/var/log/shadowcheck/threat-refresh.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] Starting threat score refresh..." | tee -a "$LOG_FILE"

# Refresh the materialized view
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c \
  "REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;" 2>&1 | tee -a "$LOG_FILE"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Threat score refresh completed!" | tee -a "$LOG_FILE"

# Optional: Send notification
# curl -X POST https://your-notification-endpoint \
#   -d "Threat scores refreshed at $TIMESTAMP"
