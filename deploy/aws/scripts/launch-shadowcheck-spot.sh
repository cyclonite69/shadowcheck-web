#!/bin/bash
# ShadowCheck Spot Instance Launcher
# Usage: ./launch-shadowcheck-spot.sh

VOLUME_ID="vol-0f38f7789ac264d59"  # PostgreSQL data volume (optional)
EIP_ALLOC_ID="eipalloc-0a85ace4f0c10d738"  # Elastic IP allocation
TEMPLATE_NAME="shadowcheck-spot-template"
REGION="us-east-1"

echo "🚀 Launching ShadowCheck Spot Instance..."

# Launch instance from template
INSTANCE_ID=$(aws ec2 run-instances \
  --launch-template LaunchTemplateName=$TEMPLATE_NAME \
  --instance-market-options 'MarketType=spot,SpotOptions={MaxPrice=0.067,SpotInstanceType=persistent,InstanceInterruptionBehavior=stop}' \
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
