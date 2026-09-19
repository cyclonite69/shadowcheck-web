#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ ${EUID} -ne 0 ]]; then
  echo 'This installer must run as root via sudo.' >&2
  exit 1
fi

install -d -m 0755 /etc/shadowcheck
install -m 0644 "${REPO_ROOT}/deploy/systemd/alpr-sync.service" /etc/systemd/system/alpr-sync.service
install -m 0644 "${REPO_ROOT}/deploy/systemd/alpr-sync.timer" /etc/systemd/system/alpr-sync.timer

systemctl daemon-reload
systemctl enable --now alpr-sync.timer

echo 'ALPR systemd timer installed and enabled.'
