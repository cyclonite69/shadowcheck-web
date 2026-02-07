#!/bin/sh
# Auto-detect Docker socket GID and ensure the app user can access it.
# Falls back gracefully if the socket isn't mounted — PgAdmin controls
# will simply report "Docker CLI not available".

SOCKET=/var/run/docker.sock

if [ -S "$SOCKET" ]; then
  SOCK_GID=$(stat -c '%g' "$SOCKET" 2>/dev/null)
  if [ -n "$SOCK_GID" ] && [ "$SOCK_GID" != "0" ]; then
    # Create a group with the socket's GID if it doesn't exist, then add our user
    if ! getent group "$SOCK_GID" >/dev/null 2>&1; then
      addgroup -g "$SOCK_GID" -S dockersock 2>/dev/null || true
    fi
    SOCK_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1)
    # Use adduser instead of addgroup to avoid setgroups issue
    if [ -n "$SOCK_GROUP" ]; then
      adduser nodejs "$SOCK_GROUP" 2>/dev/null || true
    fi
  fi
fi

# Use su-exec without setting supplementary groups
exec dumb-init -- su-exec nodejs "$@"
