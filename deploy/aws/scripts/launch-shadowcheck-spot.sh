#!/bin/bash
# ShadowCheck Spot Instance Launcher
# Usage: ./launch-shadowcheck-spot.sh [instance-type]
# Example: ./launch-shadowcheck-spot.sh m6g.large

# Configuration
REGION="us-east-1"
TEMPLATE_NAME="shadowcheck-spot-template"
EIP_ALLOC_ID="eipalloc-0a85ace4f0c10d738"
INSTANCE_TYPE="${1:-t4g.large}"

# 🔍 Find the data volume by tag instead of hardcoded ID
echo "🔍 Searching for ShadowCheck data volume..."
VOLUME_ID=$(aws ec2 describe-volumes \
  --filters "Name=tag:Name,Values=postgres-data-30gb" \
  --region $REGION \
  --query 'Volumes[0].VolumeId' \
  --output text)

if [ -z "$VOLUME_ID" ] || [ "$VOLUME_ID" == "None" ]; then
  echo "❌ ERROR: Could not find volume with tag Name=postgres-data-30gb"
  exit 1
fi
echo "✅ Found volume: $VOLUME_ID"

echo "🚀 Launching ShadowCheck Spot Instance..."
echo "Instance type: $INSTANCE_TYPE"

# 0. Check if volume is attached to another instance and detach it
if [ -n "$VOLUME_ID" ]; then
  ATTACHED_INSTANCE=$(aws ec2 describe-volumes --volume-ids "$VOLUME_ID" --region $REGION --query 'Volumes[0].Attachments[0].InstanceId' --output text)
  if [ "$ATTACHED_INSTANCE" != "None" ]; then
    echo "📦 Volume $VOLUME_ID is attached to $ATTACHED_INSTANCE"
    
    # Check instance state
    STATE=$(aws ec2 describe-instances --instance-ids "$ATTACHED_INSTANCE" --region $REGION --query 'Reservations[0].Instances[0].State.Name' --output text)
    if [ "$STATE" = "running" ]; then
      echo "🛑 Stopping instance $ATTACHED_INSTANCE to ensure safe volume detachment..."
      aws ec2 stop-instances --instance-ids "$ATTACHED_INSTANCE" --region $REGION > /dev/null
      aws ec2 wait instance-stopped --instance-ids "$ATTACHED_INSTANCE" --region $REGION
      echo "✅ Instance stopped"
    fi

    echo "📦 Detaching volume..."
    aws ec2 detach-volume --volume-id "$VOLUME_ID" --region $REGION > /dev/null
    echo "⏳ Waiting for detachment..."
    aws ec2 wait volume-available --volume-ids "$VOLUME_ID" --region $REGION
    echo "✅ Volume available"
  fi
fi

# 1. Get volume AZ to ensure instance is launched in the same zone
echo "🔍 Checking volume $VOLUME_ID..."
VOLUME_AZ=$(aws ec2 describe-volumes --volume-ids "$VOLUME_ID" --region $REGION --query 'Volumes[0].AvailabilityZone' --output text)
echo "📍 Volume is in $VOLUME_AZ"

# 2. Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --launch-template LaunchTemplateName=$TEMPLATE_NAME \
  --instance-type "$INSTANCE_TYPE" \
  --placement "AvailabilityZone=$VOLUME_AZ" \
  --instance-market-options 'MarketType=spot,SpotOptions={MaxPrice=0.067,SpotInstanceType=persistent,InstanceInterruptionBehavior=stop}' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=scs-ssm}]" \
  --region $REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✅ Instance launched: $INSTANCE_ID"
echo "⏳ Waiting for instance to start..."

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

echo "✅ Instance is running"

# Get instance AZ
INSTANCE_AZ=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
  --output text)

echo "📍 Instance AZ: $INSTANCE_AZ"

# Attach data volume if in same AZ
if [ -n "$VOLUME_ID" ]; then
  VOLUME_AZ=$(aws ec2 describe-volumes \
    --volume-ids $VOLUME_ID \
    --region $REGION \
    --query 'Volumes[0].AvailabilityZone' \
    --output text)
  
  if [ "$INSTANCE_AZ" = "$VOLUME_AZ" ]; then
    echo "📦 Attaching PostgreSQL data volume..."
    aws ec2 attach-volume \
      --volume-id $VOLUME_ID \
      --instance-id $INSTANCE_ID \
      --device /dev/sdf \
      --region $REGION > /dev/null
    echo "✅ Volume attached"
  else
    echo "⚠️  Volume in $VOLUME_AZ, instance in $INSTANCE_AZ - skipping volume attachment"
    echo "   Deploy will start with fresh database"
  fi
fi

# Associate Elastic IP
echo "🌐 Associating Elastic IP..."
aws ec2 associate-address \
  --instance-id $INSTANCE_ID \
  --allocation-id $EIP_ALLOC_ID \
  --region $REGION > /dev/null

PUBLIC_IP=$(aws ec2 describe-addresses \
  --allocation-ids $EIP_ALLOC_ID \
  --region $REGION \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "✅ Elastic IP associated: $PUBLIC_IP"
echo "⏳ Waiting for SSM agent..."

# Wait for SSM to be ready
sleep 15

echo ""
echo "✅ ShadowCheck Spot Instance Ready!"
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP:   $PUBLIC_IP"
echo "Region/AZ:   $REGION / $INSTANCE_AZ"
echo ""
echo "Connect: aws ssm start-session --target $INSTANCE_ID --region $REGION"
echo ""
