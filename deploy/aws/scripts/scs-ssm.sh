#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
INSTANCE_ID="${1:-${SCS_INSTANCE_ID:-}}"
INSTANCE_NAME_TAG="${SCS_INSTANCE_NAME_TAG:-scs-ssm}"
EXPLICIT_PROFILE="${AWS_PROFILE:-}"
PROFILE=""

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

ensure_login() {
  local candidate
  local candidates=()

  if [[ -n "$EXPLICIT_PROFILE" ]]; then
    candidates+=("$EXPLICIT_PROFILE")
  fi
  candidates+=("shadowcheck-sso" "shadowcheck")

  for candidate in "${candidates[@]}"; do
    if aws sts get-caller-identity --profile "$candidate" >/dev/null 2>&1; then
      PROFILE="$candidate"
      return 0
    fi
  done

  PROFILE="${candidates[0]}"
  echo "AWS SSO session is missing or expired for profile '$PROFILE'."
  echo "Opening AWS SSO login..."
  aws sso login --profile "$PROFILE"
}

resolve_instance_id() {
  if [[ -n "$INSTANCE_ID" ]]; then
    echo "$INSTANCE_ID"
    return 0
  fi

  local resolved
  resolved="$(
    aws ec2 describe-instances \
      --region "$REGION" \
      --profile "$PROFILE" \
      --filters "Name=tag:Name,Values=$INSTANCE_NAME_TAG" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
      --query "Reservations[].Instances[] | sort_by(@, &LaunchTime) | [-1].InstanceId" \
      --output text
  )"

  if [[ -z "$resolved" || "$resolved" == "None" ]]; then
    echo "ERROR: Could not resolve an EC2 instance tagged Name=$INSTANCE_NAME_TAG." >&2
    echo "Pass an explicit instance id: scs-ssm i-xxxxxxxxxxxxxxxxx" >&2
    exit 1
  fi

  echo "$resolved"
}

start_session() {
  aws ssm start-session --target "$1" --region "$REGION" --profile "$PROFILE"
}

require_command aws
require_command session-manager-plugin

ensure_login
TARGET_INSTANCE_ID="$(resolve_instance_id)"

echo "Connecting to instance: $TARGET_INSTANCE_ID"

if ! start_session "$TARGET_INSTANCE_ID"; then
  echo "Initial SSM session failed. Refreshing AWS SSO login and retrying once..."
  aws sso login --profile "$PROFILE"
  start_session "$TARGET_INSTANCE_ID"
fi
