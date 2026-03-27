import os

import boto3

ec2 = boto3.client("ec2")

VOLUME_NAME = os.environ.get("VOLUME_NAME", "postgres-data-30gb")
EIP_ALLOC_ID = os.environ.get("EIP_ALLOC_ID", "eipalloc-REPLACE_ME")
DEVICE_NAME = os.environ.get("DEVICE_NAME", "/dev/sdf")
INSTANCE_NAME = os.environ.get("INSTANCE_NAME", "scs-ssm")
DETACH_WAIT_SECONDS = int(os.environ.get("DETACH_WAIT_SECONDS", "120"))


def get_instance(instance_id: str):
    resp = ec2.describe_instances(InstanceIds=[instance_id])
    return resp["Reservations"][0]["Instances"][0]


def find_volume():
    resp = ec2.describe_volumes(Filters=[{"Name": "tag:Name", "Values": [VOLUME_NAME]}])
    volumes = resp.get("Volumes", [])
    if not volumes:
        raise RuntimeError(f"Volume tagged Name={VOLUME_NAME} not found")
    return volumes[0]


def wait_for_volume_available(volume_id: str):
    waiter = ec2.get_waiter("volume_available")
    waiter.wait(
        VolumeIds=[volume_id],
        WaiterConfig={"Delay": 5, "MaxAttempts": max(1, DETACH_WAIT_SECONDS // 5)},
    )


def detach_if_needed(volume: dict, new_instance_id: str):
    for attachment in volume.get("Attachments", []):
        old_instance_id = attachment["InstanceId"]
        if old_instance_id == new_instance_id:
            return
        ec2.detach_volume(
            VolumeId=volume["VolumeId"],
            InstanceId=old_instance_id,
            Force=False,
        )
        wait_for_volume_available(volume["VolumeId"])


def attach_volume(volume_id: str, instance_id: str):
    ec2.attach_volume(
        VolumeId=volume_id,
        InstanceId=instance_id,
        Device=DEVICE_NAME,
    )


def associate_eip(instance_id: str):
    ec2.associate_address(
        InstanceId=instance_id,
        AllocationId=EIP_ALLOC_ID,
        AllowReassociation=True,
    )


def lambda_handler(event, context):
    detail = event.get("detail", {})
    instance_id = detail.get("EC2InstanceId") or detail.get("instance-id")
    if not instance_id:
        raise RuntimeError("No instance id found in event payload")

    instance = get_instance(instance_id)
    tags = {tag["Key"]: tag["Value"] for tag in instance.get("Tags", [])}
    if tags.get("Name") != INSTANCE_NAME:
        return {"ignored": True, "reason": "instance name does not match", "instance_id": instance_id}

    volume = find_volume()
    detach_if_needed(volume, instance_id)
    attach_volume(volume["VolumeId"], instance_id)
    associate_eip(instance_id)

    return {
        "ok": True,
        "instance_id": instance_id,
        "volume_id": volume["VolumeId"],
        "allocation_id": EIP_ALLOC_ID,
    }
