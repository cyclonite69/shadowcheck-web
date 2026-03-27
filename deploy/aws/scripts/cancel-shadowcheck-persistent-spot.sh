#!/usr/bin/env bash
set -euo pipefail

# Lists or cancels the legacy persistent Spot request from the old launcher.
# Default mode is dry-run listing. Pass --cancel to cancel.

REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-shadowcheck-sso}"
LAUNCH_GROUP="${SCS_SPOT_LAUNCH_GROUP:-shadowcheck}"
MODE="${1:-list}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

require_command aws

REQUEST_IDS="$(
  aws ec2 describe-spot-instance-requests \
    --region "$REGION" \
    --profile "$PROFILE" \
    --filters "Name=launch-group,Values=$LAUNCH_GROUP" \
    --query 'SpotInstanceRequests[].SpotInstanceRequestId' \
    --output text
)"

if [[ -z "$REQUEST_IDS" || "$REQUEST_IDS" == "None" ]]; then
  echo "No persistent Spot requests found for launch group: $LAUNCH_GROUP"
  exit 0
fi

echo "Found Spot request(s): $REQUEST_IDS"
aws ec2 describe-spot-instance-requests \
  --region "$REGION" \
  --profile "$PROFILE" \
  --spot-instance-request-ids $REQUEST_IDS \
  --output table

if [[ "$MODE" != "--cancel" ]]; then
  echo
  echo "Dry run only. Re-run with --cancel to cancel these request(s)."
  exit 0
fi

aws ec2 cancel-spot-instance-requests \
  --region "$REGION" \
  --profile "$PROFILE" \
  --spot-instance-request-ids $REQUEST_IDS

echo "Cancelled Spot request(s): $REQUEST_IDS"
