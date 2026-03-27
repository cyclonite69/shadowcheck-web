#!/usr/bin/env bash
set -euo pipefail

# Creates or updates a staged single-AZ mixed-instance ARM Spot ASG.
# Review all placeholders and variables before running.

REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-shadowcheck-sso}"

ASG_NAME="${SCS_ASG_NAME:-shadowcheck-arm-spot-asg}"
LAUNCH_TEMPLATE_NAME="${SCS_LAUNCH_TEMPLATE_NAME:-shadowcheck-spot-template}"
LAUNCH_TEMPLATE_VERSION="${SCS_LAUNCH_TEMPLATE_VERSION:-\$Latest}"
SUBNET_ID="${SCS_SUBNET_ID:-SUBNET_ID_HERE}"

MIN_SIZE="${SCS_MIN_SIZE:-1}"
MAX_SIZE="${SCS_MAX_SIZE:-1}"
DESIRED_CAPACITY="${SCS_DESIRED_CAPACITY:-0}"

INSTANCE_TYPES_JSON="${SCS_INSTANCE_TYPES_JSON:-[
  {\"InstanceType\":\"m7g.large\"},
  {\"InstanceType\":\"m6g.large\"},
  {\"InstanceType\":\"c7g.large\"},
  {\"InstanceType\":\"c6g.large\"}
]}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

require_command aws

if [[ "$SUBNET_ID" == "SUBNET_ID_HERE" ]]; then
  echo "ERROR: Set SCS_SUBNET_ID to the subnet in the same AZ as the DB EBS volume." >&2
  exit 1
fi

MIXED_INSTANCES_POLICY="$(cat <<JSON
{
  "LaunchTemplate": {
    "LaunchTemplateSpecification": {
      "LaunchTemplateName": "$LAUNCH_TEMPLATE_NAME",
      "Version": "$LAUNCH_TEMPLATE_VERSION"
    },
    "Overrides": $INSTANCE_TYPES_JSON
  },
  "InstancesDistribution": {
    "OnDemandBaseCapacity": 0,
    "OnDemandPercentageAboveBaseCapacity": 0,
    "SpotAllocationStrategy": "price-capacity-optimized"
  }
}
JSON
)"

EXISTS="$(
  aws autoscaling describe-auto-scaling-groups \
    --region "$REGION" \
    --profile "$PROFILE" \
    --auto-scaling-group-names "$ASG_NAME" \
    --query 'AutoScalingGroups[0].AutoScalingGroupName' \
    --output text 2>/dev/null || true
)"

if [[ "$EXISTS" == "$ASG_NAME" ]]; then
  echo "Updating ASG: $ASG_NAME"
  aws autoscaling update-auto-scaling-group \
    --region "$REGION" \
    --profile "$PROFILE" \
    --auto-scaling-group-name "$ASG_NAME" \
    --min-size "$MIN_SIZE" \
    --max-size "$MAX_SIZE" \
    --desired-capacity "$DESIRED_CAPACITY" \
    --vpc-zone-identifier "$SUBNET_ID" \
    --capacity-rebalance \
    --mixed-instances-policy "$MIXED_INSTANCES_POLICY"
else
  echo "Creating ASG: $ASG_NAME"
  aws autoscaling create-auto-scaling-group \
    --region "$REGION" \
    --profile "$PROFILE" \
    --auto-scaling-group-name "$ASG_NAME" \
    --min-size "$MIN_SIZE" \
    --max-size "$MAX_SIZE" \
    --desired-capacity "$DESIRED_CAPACITY" \
    --vpc-zone-identifier "$SUBNET_ID" \
    --capacity-rebalance \
    --mixed-instances-policy "$MIXED_INSTANCES_POLICY" \
    --tags \
      "ResourceId=$ASG_NAME,ResourceType=auto-scaling-group,Key=Name,Value=scs-ssm,PropagateAtLaunch=true" \
      "ResourceId=$ASG_NAME,ResourceType=auto-scaling-group,Key=Role,Value=shadowcheck,PropagateAtLaunch=true"
fi

echo
echo "ASG staged:"
echo "  Name:             $ASG_NAME"
echo "  Launch Template:  $LAUNCH_TEMPLATE_NAME ($LAUNCH_TEMPLATE_VERSION)"
echo "  Subnet:           $SUBNET_ID"
echo "  Desired Capacity: $DESIRED_CAPACITY"
echo
echo "Inspect with:"
echo "  aws autoscaling describe-auto-scaling-groups --region $REGION --profile $PROFILE --auto-scaling-group-names $ASG_NAME"
