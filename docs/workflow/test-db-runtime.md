# Test/Sandbox DB Runtime Workflow

This document describes how to use, verify, and maintain the isolated test/sandbox runtime environment. This configuration allows you to run the ShadowCheck application against the `shadowcheck_test` database without risking writes or mutations to the production/main database (`shadowcheck_db`).

---

## Architecture Overview

- **Main Environment**:
  - Frontend: `http://localhost:8080`
  - API: `http://localhost:3001`
  - Database: `shadowcheck_db`
  - Redis: DB index `0`, session cookie `session_token`

- **Test/Sandbox Environment**:
  - Frontend: `http://localhost:8081`
  - API: `http://localhost:3002`
  - Database: `shadowcheck_test`
  - Redis: DB index `1`, session cookie `shadowcheck_session_test`
  - UI Indicator: A persistent amber banner (`TEST DATABASE ACTIVE`) at the top of every screen.

---

## Workflow Commands

### 1. Starting the Test Stack

The test stack connects to the main postgres and redis containers. Make sure the main infrastructure is up first, then run the test compose:

```bash
# Start main infrastructure (Postgres, Redis)
docker compose up -d postgres redis

# Build and start the test runtime containers
docker compose -f docker-compose.test.yml up -d --build
```

### 2. Verification

To verify that the test runtime is correctly isolated and pointing to the test database:

- **API Health Check Probe**:
  Verify the database name returned by the healthcheck endpoint on port `3002`:

  ```bash
  curl -s http://127.0.0.1:3002/health | jq .database
  # Expected output: "shadowcheck_test"
  ```

- **Frontend Visual Verification**:
  Open `http://localhost:8081` in your browser. Verify that a persistent amber warning banner is visible at the top:
  `⚠️ TEST DATABASE ACTIVE — Target: shadowcheck_test (API Port: 3002) — SANDBOX`

### 3. Resetting/Cloning the Test Database

Create a test clone only when `shadowcheck_test` does not already exist. The
script refuses a remote Docker context, requires an explicit confirmation of
the local `shadowcheck_db` source, and never drops an existing destination:

```bash
./scripts/clone-local-test-db.sh shadowcheck_db shadowcheck_test \
  --confirm-local-source=shadowcheck_db
```

The script connects to the `postgres` maintenance database throughout. That
connection must stay outside the template database so it remains available
while `shadowcheck_db` rejects connections. Before cloning, the script checks
for unexpected application sessions, disables new source connections,
terminates existing source client sessions, and waits up to 15 seconds for the
source to reach zero client connections. It restores source connections on
success and on failure. It does not run against production or delete a
pre-existing test database. Other maintenance sessions connected to `postgres`
are outside the source-session filter and remain available; pgAdmin sessions
connected directly to `shadowcheck_db` are terminated because PostgreSQL
requires the template source to have no active connections.

### 4. Stopping the Test Stack

To stop and remove test containers without affecting the main database:

```bash
docker compose -f docker-compose.test.yml down
```

---

## Security Safeguards

1. **No Mixed Cookies**: The session cookie name is isolated (`shadowcheck_session_test`), so logging into test doesn't invalidate or clash with your main environment session.
2. **No Redis Contamination**: Cache keys and sessions reside on Redis DB `1`, completely separated from DB `0`.
3. **Hardcoded Ports**: The compose configurations bind to fixed ports (`8081` and `3002`), eliminating confusion.
