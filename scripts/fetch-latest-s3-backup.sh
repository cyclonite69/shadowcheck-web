#!/usr/bin/env bash
set -euo pipefail

BUCKET="${S3_BACKUP_BUCKET:-}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
OUT_DIR="${1:-./backups/s3}"
PREFIX="${S3_BACKUP_PREFIX:-backups/}"

if [[ -z "$BUCKET" ]]; then
  echo "S3_BACKUP_BUCKET is not set." >&2
  echo "Set it in your shell before running this script." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

LATEST_KEY="$(
  aws s3api list-objects-v2 \
    --bucket "$BUCKET" \
    --prefix "$PREFIX" \
    --query 'reverse(sort_by(Contents[?ends_with(Key, `.dump`)], &LastModified))[0].Key' \
    --output text \
    --region "$AWS_REGION"
)"

if [[ -z "$LATEST_KEY" || "$LATEST_KEY" == "None" ]]; then
  echo "No .dump backups found in s3://$BUCKET/$PREFIX" >&2
  exit 1
fi

DEST_PATH="$OUT_DIR/$(basename "$LATEST_KEY")"

echo "Downloading latest backup:"
echo "  bucket: s3://$BUCKET"
echo "  key:    $LATEST_KEY"
echo "  dest:   $DEST_PATH"

aws s3 cp "s3://$BUCKET/$LATEST_KEY" "$DEST_PATH" --region "$AWS_REGION"

echo "Saved: $DEST_PATH"
