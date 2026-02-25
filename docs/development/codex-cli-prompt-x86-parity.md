# Codex CLI Prompt: x86 Docker Parity + Filter Fixes (Radio Types First)

Use this prompt in Codex CLI to enforce local `linux/amd64` parity with EC2 and then fix filters in phased order, starting with radio-type filters.

```text
You are working in the shadowcheck-web repository.

Primary goals:
1) Make local Docker execution match EC2 x86_64 runtime as closely as possible by forcing linux/amd64 where needed (including Apple Silicon hosts).
2) Achieve test parity so local runs the same suites/order as CI/EC2 with consistent pass/fail behavior.
3) Fix all filter bugs/regressions, starting with radio-type filters first, then all remaining filter types.

Constraints:
- Keep changes minimal and reviewable.
- Do not change production behavior unless required for parity or bug fixes.
- Use Conventional Commit messages.
- Update docs in docs/development for every new workflow command.
- Prefer test-first fixes for filter regressions.
- For now, require standard DNS resolution from inside containers. Do not rely on custom DNS hacks; unblock/fix outbound DNS on port 53 if currently restricted.
- If local parity uses the EC2-hosted database, require proper SSL configuration with the correct CA/certificate chain mounted into containers and referenced by DB SSL settings.

Repository context to use:
- Local compose files:
  - docker-compose.yml
  - docker-compose.dev.yml
  - docker/infrastructure/docker-compose.postgres.yml
- EC2/AWS compose and Docker config:
  - deploy/aws/configs/docker-compose.yml
  - deploy/aws/configs/docker-compose-separated.yml
  - deploy/aws/docker-compose-aws.yml
  - deploy/aws/docker/docker-compose.fullstack.yml
  - deploy/aws/docker/docker-compose.simple.yml
  - deploy/aws/docker/Dockerfile.backend
  - deploy/aws/docker/Dockerfile.frontend
- App scripts:
  - npm run lint
  - npm test
  - npm run test:integration
  - npm run lint:boundaries

Execution plan:

A) Enforce x86 Docker parity locally
- Audit all Dockerfiles and compose definitions listed above.
- Ensure local services that should match EC2 specify platform linux/amd64.
- If broad changes are risky, create a local override file (for example docker-compose.x86.yml) that sets platform without altering default behavior.
- Ensure container DNS behavior matches standard Docker networking expectations:
  - Containers must resolve public and internal hostnames via normal resolver flow.
  - Remove or disable any local firewall/network rule that blocks container egress DNS (UDP/TCP 53) during parity/testing.
  - Document whether Docker default DNS, host resolver, or explicit dns settings are used, and why.
- If buildx is needed, document exact commands and prerequisites.
- Verify architecture and DNS from running containers (for example uname -m, nslookup/dig/getent hosts, docker inspect image architecture).

B) Build a reproducible parity test workflow
- Identify CI/EC2 test order and mirror it locally.
- Create one command sequence (or script) that does:
  1. build/start x86 containers,
  2. wait for dependencies and readiness,
  3. run lint + boundaries + unit + integration tests in EC2 order.
- Make failures actionable with clear logs and exit behavior.
- Document common failure modes (DB readiness, env drift, migrations, shared network issues, missing/invalid DB SSL certs).

B.1) EC2 database SSL parity requirements
- When targeting EC2 DB from local containers:
  - Obtain the correct server CA bundle/certificate chain used by the EC2 DB endpoint.
  - Mount cert files into containers at a stable path (for example /app/certs).
  - Configure DB SSL env vars/options so verification is enabled (not sslmode=disable).
  - Add a pre-test connectivity check that fails fast on TLS validation errors.
- Document exact setup commands and required env vars (for example DB_SSL, DB_SSL_CA_PATH, sslmode/sslrootcert equivalents).

C) Fix filters, radio-type first
- Inventory filter types and code paths across:
  - client filter state/UI
  - API query parsing/validation
  - repository/SQL filtering logic
  - test coverage
- Start with radio-type filters:
  - reproduce bug(s),
  - add/adjust failing tests first,
  - implement fixes across affected layers,
  - validate combined-filter behavior and regressions.
- Continue filter-by-filter until all known filter issues are fixed with tests.

D) Validation and deliverables
- Run the full local x86 parity workflow and report results.
- Summarize:
  - Docker parity changes,
  - filter fixes completed (radio first),
  - test evidence,
  - remaining gaps/risk.
- Update docs/development with exact parity commands.

Expected outputs:
- Docker/compose updates enabling local linux/amd64 parity with EC2.
- Reliable local parity test workflow.
- Filter fixes with tests (radio types first, then all others).
- Clear docs and Conventional Commit history.
```

## Suggested Codex CLI kickoff

```bash
codex "Execute docs/development/codex-cli-prompt-x86-parity.md. First enforce local linux/amd64 parity with EC2, then fix filter bugs starting with radio-type filters, and provide test evidence."
```
