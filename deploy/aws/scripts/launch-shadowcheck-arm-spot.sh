#!/usr/bin/env bash
set -euo pipefail

# Robust single-node ARM Spot launcher for ShadowCheck.
# Keeps the existing single-AZ EBS + Elastic IP model, but avoids persistent
# Spot requests and can try multiple allowed ARM instance types in order.

REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-shadowcheck-sso}"
TEMPLATE_NAME="${SCS_LAUNCH_TEMPLATE_NAME:-shadowcheck-spot-template}"
VOLUME_TAG_NAME="${SCS_VOLUME_TAG_NAME:-postgres-data-30gb}"
INSTANCE_NAME_TAG="${SCS_INSTANCE_NAME_TAG:-scs-ssm}"
INSTANCE_ROLE_TAG="${SCS_INSTANCE_ROLE_TAG:-shadowcheck}"
EIP_ALLOC_ID="${SCS_EIP_ALLOC_ID:-eipalloc-0a85ace4f0c10d738}"
DEVICE_NAME="${SCS_VOLUME_DEVICE_NAME:-/dev/sdf}"
TERMINATE_DISPLACED="${SCS_TERMINATE_DISPLACED:-1}"
WAIT_FOR_SSM_SECONDS="${SCS_WAIT_FOR_SSM_SECONDS:-20}"

DEFAULT_INSTANCE_TYPES=("m7g.large" "m6g.large" "c7g.large" "c6g.large")
if [[ $# -gt 0 ]]; then
  INSTANCE_TYPES=("$@")
else
  INSTANCE_TYPES=("${DEFAULT_INSTANCE_TYPES[@]}")
fi

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

aws_cli() {
  aws --profile "$PROFILE" --region "$REGION" "$@"
}

wait_for_ssm() {
  local instance_id="$1"
  local deadline=$((SECONDS + WAIT_FOR_SSM_SECONDS))
  while (( SECONDS < deadline )); do
    local ping
    ping="$(
      aws_cli ssm describe-instance-information \
        --filters "Key=InstanceIds,Values=$instance_id" \
        --query 'InstanceInformationList[0].PingStatus' \
        --output text 2>/dev/null || true
    )"
    if [[ "$ping" == "Online" ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

cleanup_failed_launch() {
  local instance_id="${1:-}"
  if [[ -n "$instance_id" && "$instance_id" != "None" ]]; then
    log "Cleaning up failed replacement instance $instance_id ..."
    aws_cli ec2 terminate-instances --instance-ids "$instance_id" >/dev/null || true
  fi
}

launch_candidate() {
  local instance_type="$1"
  aws_cli ec2 run-instances \
    --launch-template "LaunchTemplateName=$TEMPLATE_NAME" \
    --instance-type "$instance_type" \
    --placement "AvailabilityZone=$VOLUME_AZ" \
    --instance-market-options '{"MarketType":"spot","SpotOptions":{"SpotInstanceType":"one-time","InstanceInterruptionBehavior":"terminate"}}' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME_TAG},{Key=Role,Value=$INSTANCE_ROLE_TAG}]" \
    --query 'Instances[0].InstanceId' \
    --output text
}

require_command aws

log "Using AWS profile: $PROFILE"
log "Region: $REGION"

VOLUME_ID="$(
  aws_cli ec2 describe-volumes \
    --filters "Name=tag:Name,Values=$VOLUME_TAG_NAME" \
    --query 'Volumes[0].VolumeId' \
    --output text
)"
[[ -n "$VOLUME_ID" && "$VOLUME_ID" != "None" ]] || die "Could not find EBS volume tagged Name=$VOLUME_TAG_NAME"

VOLUME_AZ="$(
  aws_cli ec2 describe-volumes \
    --volume-ids "$VOLUME_ID" \
    --query 'Volumes[0].AvailabilityZone' \
    --output text
)"
[[ -n "$VOLUME_AZ" && "$VOLUME_AZ" != "None" ]] || die "Could not determine AZ for volume $VOLUME_ID"

log "Using volume: $VOLUME_ID"
log "Volume AZ: $VOLUME_AZ"
log "Candidate ARM types: ${INSTANCE_TYPES[*]}"

ATTACHED_INSTANCE="$(
  aws_cli ec2 describe-volumes \
    --volume-ids "$VOLUME_ID" \
    --query 'Volumes[0].Attachments[0].InstanceId' \
    --output text
)"
if [[ "$ATTACHED_INSTANCE" == "None" ]]; then
  ATTACHED_INSTANCE=""
fi

if [[ -n "$ATTACHED_INSTANCE" ]]; then
  ATTACHED_STATE="$(
    aws_cli ec2 describe-instances \
      --instance-ids "$ATTACHED_INSTANCE" \
      --query 'Reservations[0].Instances[0].State.Name' \
      --output text
  )"
  log "Current volume owner: $ATTACHED_INSTANCE ($ATTACHED_STATE)"
else
  ATTACHED_STATE=""
  log "Volume is currently detached"
fi

NEW_INSTANCE_ID=""
NEW_INSTANCE_TYPE=""

for candidate in "${INSTANCE_TYPES[@]}"; do
  log "Trying Spot launch with instance type: $candidate"
  if NEW_INSTANCE_ID="$(launch_candidate "$candidate" 2>/tmp/shadowcheck_spot_launch.err)"; then
    NEW_INSTANCE_TYPE="$candidate"
    log "Launch accepted: $NEW_INSTANCE_ID ($candidate)"
    break
  fi
  log "Launch failed for $candidate"
  sed -n '1,12p' /tmp/shadowcheck_spot_launch.err || true
done

[[ -n "$NEW_INSTANCE_ID" ]] || die "Unable to launch any candidate Spot instance in $VOLUME_AZ"

trap 'cleanup_failed_launch "$NEW_INSTANCE_ID"' ERR

log "Waiting for instance to enter running state ..."
aws_cli ec2 wait instance-running --instance-ids "$NEW_INSTANCE_ID"

if [[ -n "$ATTACHED_INSTANCE" && "$ATTACHED_INSTANCE" != "$NEW_INSTANCE_ID" ]]; then
  if [[ "$ATTACHED_STATE" == "running" || "$ATTACHED_STATE" == "pending" ]]; then
    log "Stopping displaced instance $ATTACHED_INSTANCE before volume handoff ..."
    aws_cli ec2 stop-instances --instance-ids "$ATTACHED_INSTANCE" >/dev/null
    aws_cli ec2 wait instance-stopped --instance-ids "$ATTACHED_INSTANCE"
  fi

  log "Detaching volume $VOLUME_ID from $ATTACHED_INSTANCE ..."
  aws_cli ec2 detach-volume --volume-id "$VOLUME_ID" --instance-id "$ATTACHED_INSTANCE" >/dev/null
  aws_cli ec2 wait volume-available --volume-ids "$VOLUME_ID"
fi

log "Attaching volume $VOLUME_ID to $NEW_INSTANCE_ID as $DEVICE_NAME ..."
aws_cli ec2 attach-volume \
  --volume-id "$VOLUME_ID" \
  --instance-id "$NEW_INSTANCE_ID" \
  --device "$DEVICE_NAME" >/dev/null
aws_cli ec2 wait volume-in-use --volume-ids "$VOLUME_ID"

log "Associating Elastic IP $EIP_ALLOC_ID ..."
aws_cli ec2 associate-address \
  --instance-id "$NEW_INSTANCE_ID" \
  --allocation-id "$EIP_ALLOC_ID" \
  --allow-reassociation >/dev/null

PUBLIC_IP="$(
  aws_cli ec2 describe-addresses \
    --allocation-ids "$EIP_ALLOC_ID" \
    --query 'Addresses[0].PublicIp' \
    --output text
)"

if [[ -n "$ATTACHED_INSTANCE" && "$ATTACHED_INSTANCE" != "$NEW_INSTANCE_ID" && "$TERMINATE_DISPLACED" == "1" ]]; then
  log "Terminating displaced instance $ATTACHED_INSTANCE ..."
  aws_cli ec2 terminate-instances --instance-ids "$ATTACHED_INSTANCE" >/dev/null || true
fi

trap - ERR

log "Waiting briefly for SSM registration ..."
if wait_for_ssm "$NEW_INSTANCE_ID"; then
  SSM_STATUS="Online"
else
  SSM_STATUS="Pending"
fi

cat <<EOF

ShadowCheck replacement instance is ready.

Instance ID:   $NEW_INSTANCE_ID
Instance Type: $NEW_INSTANCE_TYPE
Public IP:     $PUBLIC_IP
Volume:        $VOLUME_ID
Region / AZ:   $REGION / $VOLUME_AZ
SSM Status:    $SSM_STATUS

Connect:
  aws ssm start-session --profile $PROFILE --region $REGION --target $NEW_INSTANCE_ID

Next on-instance steps:
  scs_rebuild
EOF
