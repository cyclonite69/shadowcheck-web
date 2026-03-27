# ARM Spot ASG Cutover Plan

This document stages, but does not execute, the migration from the current
single-instance persistent Spot request to a single-AZ mixed-instance ARM Spot
Auto Scaling Group.

## Goals

- Stay ARM-only
- Keep all instance choices at or below the `m7g.large` on-demand price cap
- Preserve the existing single EBS PostgreSQL data volume
- Preserve the existing Elastic IP
- Improve replacement behavior after Spot interruption

## Allowed Instance Types

- `m7g.large`
- `m6g.large`
- `c7g.large`
- `c6g.large`

## Important Constraint

The PostgreSQL EBS volume is AZ-bound. Because of that, the first ASG version
must stay in a single subnet within the same AZ as `postgres-data-30gb`.

This gives:

- mixed-instance resilience within one AZ
- automatic instance replacement

This does not give:

- multi-AZ high availability

## New Artifacts

- Script: [create-shadowcheck-asg.sh](/home/dbcooper/repos/shadowcheck-web/deploy/aws/scripts/create-shadowcheck-asg.sh)
- Script: [cancel-shadowcheck-persistent-spot.sh](/home/dbcooper/repos/shadowcheck-web/deploy/aws/scripts/cancel-shadowcheck-persistent-spot.sh)
- Lambda scaffold: [lambda_function.py](/home/dbcooper/repos/shadowcheck-web/deploy/aws/lambda/attach-shadowcheck-resources/lambda_function.py)
- Lambda IAM policy: [policy.json](/home/dbcooper/repos/shadowcheck-web/deploy/aws/lambda/attach-shadowcheck-resources/policy.json)

## Safe Cutover Sequence

1. Identify the AZ of `postgres-data-30gb`
2. Choose the subnet in that same AZ
3. Prepare a new launch template version
4. Create the Lambda role and function
5. Create the EventBridge rule and Lambda target
6. Create the ASG with desired capacity `0`
7. Review the ASG configuration
8. Scale the ASG to desired capacity `1`
9. Verify:
   - instance launches
   - EBS volume attaches
   - Elastic IP attaches
   - SSM is online
   - app is healthy
10. Cancel the old persistent Spot request

## Validation Commands

```bash
aws autoscaling describe-auto-scaling-groups \
  --region us-east-1 \
  --profile shadowcheck-sso \
  --auto-scaling-group-names shadowcheck-arm-spot-asg
```

```bash
./deploy/aws/scripts/cancel-shadowcheck-persistent-spot.sh
```

## Risks

- Volume attach race during replacement
- Instance boots before the data volume mount is ready
- Old persistent Spot request not cancelled after cutover
- Wrong subnet/AZ selected for the ASG

## Recommendation

Do not cut over while the current instance is healthy unless you are prepared
to watch the full replacement flow end to end.
