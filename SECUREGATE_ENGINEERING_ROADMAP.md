# SecureGate Engineering Roadmap and Security Decision Register

**Branch:** `chore/zero-trust-hardening`  
**Baseline:** `f071a3f6284bcc1b278b9df81001166ca834568c` (risk-test baseline); ABAC work is layered on the same hardening branch.  
**Purpose:** Track implementation evidence and prevent the academic specification from overstating the running system.

## Delivered in this branch

- Added dependency-free Node.js built-in test coverage for the deterministic risk engine.
- Covered stable trusted-device context, new-device score, IP/user-agent changes, OTP attempt cap, deny threshold, blocked/revoked device hard-deny and score clamping.
- Added `npm run test:risk`.
- Integrated risk unit tests into the existing backend `npm test` command so the Docker CI test runner executes them before the destructive integration suite.
- The integration suite retains its dedicated test-database name guard. Do not point it at the organization database.

## Delivered in this branch — ABAC foundation\n\n- Added a versioned `AbacPolicy` MongoDB model with enabled state, priority, effect, action/resource matching, conditions, and creator/updater references.\n- Added an allowlisted attribute vocabulary and typed comparison operators; missing/unknown attributes do not satisfy a condition.\n- Added deny-overrides policy evaluation and explicit `NOT_APPLICABLE` results. A non-match does not grant access: current RBAC middleware remains authoritative.\n- Added Super Admin-only policy CRUD and a simulation endpoint at `/api/abac-policies`; simulation does not mutate active policies or grant access.\n- Added eight deterministic ABAC unit tests and included them in the backend `npm test` sequence.\n- Added a deny-overrides ABAC middleware to user-management routes (read, create, update, delete, status change, and invitation resend). RBAC remains the prerequisite; ABAC can add a deny but cannot grant access by itself.\n- **Not yet delivered:** policy publish/draft workflow, immutable historical snapshots, approval, broader route coverage, and scenario UI. Do not describe ABAC as universally enforced across every API.\n\n## Current security behaviour (source-verified)

| Area | Current behaviour | Engineering note |
|---|---|---|
| Authentication | Password first factor followed by email OTP; token issued only after OTP verification. | Keep challenge expiry, attempt and resend limits covered by integration tests. |
| Invitation | One-time hashed invitation token, 24-hour expiry. | Verify email delivery and replay/expiry paths in integration tests. |
| Administrator governance | One-time first Super Admin; sole-Super-Admin protection; maximum three IT Administrators. | Maintain invariant tests around every user/role/status mutation. |
| Authorization | RBAC role-to-permission middleware. | Build a route-to-permission matrix and negative tests for every privileged route. |
| Device trust | Hashed browser/device identifier with Trusted/Revoked/Blocked state. | Application-level identifier is not hardware attestation. |
| Risk scoring | New device +35; changed IP +15; changed user-agent +15; OTP failures +10 each capped +40; blocked/revoked = 100. | Current levels: Low <30, Medium 30–69, High >=70; deny >=70. |
| Audit | Actor/action/target/outcome/context event records. | Current schema does not prove tamper-evident hash chaining. |

## Priority 0 — release safety

1. Get a successful Trivy filesystem scan and dependency audit on the exact release commit.
2. Add route-level allow/deny tests for every route in the SDD.
3. Verify audit redaction for password, OTP, invitation token, bearer JWT and SMTP credentials.
4. Verify JWT expiry, token-version invalidation, logout/revocation and device binding against middleware.
5. Confirm production CORS, proxy trust and rate-limit configuration; never trust arbitrary forwarded headers.

## Priority 1 — align specification and implementation

Before changing behaviour, create explicit decision records and update source, tests, SRS, SDD and README together:

- **Roles:** submitted baseline lists seven actors/roles; current README lists five standard roles (Super Admin, IT Administrator, HR Manager, Employee, Security Auditor). Confirm whether faculty/student/department administration are represented by HR/Employee or must become distinct roles.
- **Risk bands:** submitted target uses four bands; current engine uses three. Do not silently change thresholds. Select one model and add boundary tests at every transition.
- **Session design:** current README says seven-day JWT expiry; submitted design expects short-lived access JWT plus rotating refresh token. Inspect runtime token issuance and storage before selecting a migration.
- **ABAC:** define subject, resource, action and environment attributes; implement deny-by-default evaluation and versioned policies.
- **Policy simulation:** execute proposed policy against fixed scenario input without publishing or mutating active policy.
- **JIT:** add approval, grant scope, expiry, revocation and audit events.
- **Continuous verification:** re-check user state, device state, token version and relevant risk context on protected requests.

## Priority 2 — audit assurance

A hash chain should only be claimed after all of the following exist:

1. Canonical, deterministic serialization of an audit event.
2. `previousHash` and `recordHash` stored for each event.
3. Atomic chain-head update or serialized append mechanism to avoid concurrent fork/race.
4. A verifier that detects altered, removed, reordered and inserted records.
5. A test that tampers with a record and proves verification fails.
6. Database permissions or external immutable storage that limit privileged rewriting.

A hash chain alone does not protect against an attacker who can rewrite the entire chain and its trusted head. Anchor checkpoints outside the application database for stronger assurance.

## Priority 3 — operations and DevSecOps

- Resolve local Jenkins Docker-in-Docker TLS by comparing CA fingerprints in DinD and Jenkins containers, verifying server/client certs and inspecting the Docker context. Preserve existing Jenkins volumes.
- Add a repeatable backup/restore rehearsal and document rollback.
- Add browser end-to-end tests for first setup, invitation, MFA, role denial, device revocation and audit view.
- Add API contract documentation (OpenAPI) from actual route/controller schemas.
- Add SBOM generation and image scanning before any registry publish.
- Pin third-party actions to reviewed immutable commit SHAs after confirming their official release and compatibility.

## Data safety rules

- Never run the destructive security integration suite against an organization database.
- Never use `docker compose down --volumes`, `docker volume prune` or manual volume deletion as a generic Jenkins/MongoDB troubleshooting step.
- Keep local host MongoDB and Docker MongoDB isolated.
- Preserve Jenkins home, certificate and Docker data volumes until backed up and inspected.
- Do not merge the hardening branch into `develop` until required checks pass and a human reviews the diff.
