# ZeroGate Campus — Initial SRS/SDD Implementation Traceability

**Project identity:** ZeroGate Campus (B.Tech Capstone Project II, CS 4191)  
**Repository:** `Simar1121/securegate-iam` (implementation repository name: SecureGate)  
**Evidence branch reviewed:** `chore/zero-trust-hardening`  
**Evidence commit reviewed:** `641ac4883d5c54440c7f7fa5f608cb94612b1b5`  
**Baseline sources:** Submitted `SRS.pdf` and `ZeroGate_Campus_SDD_final.pdf` supplied in this project.  
**Purpose:** Initial source-backed gap register. This is not a claim of full SRS acceptance or production readiness.

## Status definitions

- **Implemented:** source evidence demonstrates the specified behaviour; automated evidence is identified where available.
- **Partial:** a related capability exists, but one or more explicit baseline requirements are absent or differ.
- **Missing:** inspected source does not implement the requirement.
- **Not verified:** the relevant source/test path has not yet been inspected deeply enough to make a reliable status claim.

A README statement or design diagram alone is not implementation evidence. Statuses below are scoped to the source files named; they do not imply exhaustive route-level verification.

## Executive findings

1. The submitted academic baseline is **ZeroGate Campus**, not SecureGate. The repository may retain the name `securegate-iam`; README and report-facing material should explicitly map the repository name to the canonical capstone name.
2. The SRS specifies seven user classes/roles. Organization bootstrap currently creates five role definitions: Super Admin, IT Administrator, HR Manager, Employee and Security Auditor. Faculty, Student and Department Admin are not created by the inspected bootstrap source.
3. The SRS risk boundaries are Low 0–30, Medium 31–60, High 61–80 and Critical 81–100. The current engine emits only Low/Medium/High, uses Low <30 and Medium >=30, and denies at >=70. Therefore score 30 and scores 61–69 do not map to the submitted SRS bands.
4. The SRS/SDD session target is a short-lived access JWT plus rotating refresh token, HTTP-only cookie, reuse detection and CSRF protection. Inspected runtime code issues a bearer JWT with configurable expiry defaulting to 7 days; the inspected models include revoked-token records but no refresh-token model. Refresh rotation and CSRF are not evidenced in the inspected source.
5. Device trust is partial: current persisted states are Trusted, Revoked and Blocked. The SRS/SDD additionally require Unverified and At Risk, distinct-person approval for promotion, and a server-issued signed device token. Current code binds sessions to a hashed browser identifier and checks the trusted device on protected requests; this is not hardware attestation or proof of the full target workflow.
6. Audit logging is present and sanitizes details, but the inspected schema/service have no previous/record hashes, chain-head serialization, verifier or append-only database enforcement. Audit writes are explicitly non-blocking on failure. Tamper-evident audit requirements are not met by the inspected implementation.
7. ABAC exists as an additional deny gate, not universal policy enforcement. Current inspected coverage includes user-management and self-service device list/revoke routes. The policy engine can return PERMIT, but middleware only blocks DENY; RBAC remains authoritative. The roadmap records publish/draft, immutable snapshots, approval and broader route coverage as not delivered.

## Traceability matrix — requirements with source evidence

| SRS / SDD requirement | Submitted target | Repository evidence inspected | Status | Gap / next verification |
|---|---|---|---|---|
| SRS §1.1–1.2; SDD §1.1–1.3 — canonical identity and scope | ZeroGate Campus university IAM prototype | README identifies product as SecureGate employee/organizational IAM; roadmap title is SecureGate | Partial | Retain repo name if desired, but update README/report mapping and make campus scope explicit. |
| SRS §2.2 — seven user classes | Super Administrator, IT Administrator, Security Officer, Department Admin, Faculty, Student, Auditor | `server/src/controllers/setupController.js` creates five roles: Super Admin, IT Administrator, HR Manager, Employee, Security Auditor | Partial | Three required classes are absent from bootstrap. Security Officer, Department Admin, Faculty and Student need explicit role mapping/permissions; do not assume HR/Employee are equivalent. |
| SRS §3.1 FR-AUTH-01, 02, 05, 06, 08; §2.5 | Password sign-in; email identity; privileged TOTP MFA; step-up; lockout | `server/src/controllers/authController.js` implements password + email OTP, five-minute OTP, five attempts, resend cooldown, five failed-password attempts and 15-minute lockout | Partial | Email OTP is not TOTP. Verify privileged-only enforcement and step-up MFA; inspected code sends email OTP as the general login second factor. |
| SRS §3.1 FR-AUTH-02, 07, 09, 10 | Short-lived access JWT; rotating refresh cookie; reuse detection; CSRF; configurable session expiry | `server/src/models/User.js` issues JWT with `JWT_EXPIRES_IN || '7d'`; `authMiddleware.js` validates bearer JWT; `RevokedToken.js` stores revocation digests | Partial | No refresh-token model/rotation/reuse family or CSRF mechanism found in inspected source. Current access token default is seven days. Inspect all auth controller and frontend token handling before designing migration. |
| SRS §3.1 FR-AUTH-03, 11, 12 | Logout invalidation, configurable concurrent sessions, session termination, token renewal on privilege change | `RevokedToken.js`, `tokenVersion` in User and checks in `authMiddleware.js` | Partial | Token revocation/version checks exist. Dedicated session collection, concurrent-session policy and administrator session-management workflow not evidenced. |
| SRS §3.2 FR-IAM-01–10 | Campus identity lifecycle, status Pending/Active/Suspended/Deactivated, department hierarchy, scoped Department Admin | `User.js` has Active/Suspended/Deactivated; `setupController.js` creates employee-oriented role model; `userRoutes.js` applies RBAC + ABAC | Partial | Pending status and department hierarchy/scope enforcement are not evidenced in inspected model/routes. Verify controllers and all lifecycle routes. |
| SRS §3.3 FR-POL-01–11 | RBAC + subject/resource/action/context policy; deny-by-default; policy obligations; versions; continuous verification; fail-closed risk | `abacPolicyEngine.js`, `abacMiddleware.js`, `abacPolicyRoutes.js`, user/device routes | Partial | RBAC is prerequisite; ABAC middleware blocks DENY and fails closed on evaluator/store errors, but NOT_APPLICABLE proceeds. Route coverage is selective. No complete Allow/Deny/MFA/Approval/Restrict obligation engine or continuous re-evaluation evidenced. |
| SRS §3.4 FR-DEV-01–09 | Unverified/Trusted/At Risk/Blocked; separate-person trust approval; signed device token; device lifecycle | `Device.js` stores Trusted/Revoked/Blocked; `authMiddleware.js` checks device binding and Trusted state; device controller revokes own device | Partial | Unverified and At Risk states, separate-person approval and server-issued signed device token are not evidenced. A client-provided random device identifier hashed with server secret is an application binding, not hardware attestation. |
| SRS §3.5 FR-RISK-01–08 | Explainable 0–100 score; four specified bands and responses; recorded assessment; configurable weights; capped failed-login contribution | `riskEngine.js`; `test/riskEngine.test.js`; roadmap | Partial | Formula and reason codes exist; current three-band mapping conflicts with four-band SRS. No configurable risk weights/config model evidenced in inspected paths. Tests cover selected values, not every SRS boundary. |
| SRS §3.6 — JIT access | Time-limited access request, approver controls, self-approval prevention, expiry/revoke and audit | No access-request, JIT-grant or expiry worker/model/route appears in inspected server tree | Missing (in inspected tree) | Implement request/approval/grant/expiry/revoke with scope and audit; confirm no implementation elsewhere before finalizing. |
| SRS §3.7 / SDD policy simulation | Non-enforcing simulation against sample subjects/devices/context/resources | README and roadmap identify `/api/abac-policies/simulate`; `abacPolicyEngine.js` is deterministic | Partial | ABAC simulation exists; verify request schema, saved run records, parity with live enforcement and UI against SRS acceptance criteria. |
| SRS §3.8 / SDD audit design | Append-only audit records with hash chain, verification, export and retention | `AuditLog.js` stores event metadata/details; `auditService.js` sanitizes details and saves events | Partial | No `prevHash`/`recordHash`, chain head, verifier or insert-only DB role. Audit failure is caught and returns null; determine which high-risk operations must fail/alert if audit persistence fails. |
| SRS §4 / SDD §4 — REST interface | Documented endpoints for all campus IAM capabilities | Existing Express routes include auth, users, roles, permissions, devices, audit, setup and ABAC | Partial | JIT, risk config/events, policy versions/publish, simulation history, incidents/alerts and audit verification endpoints not evidenced in inspected route tree. |
| SRS §5 — non-functional security/reliability/privacy | Least privilege, deny-by-default, MFA privileged operations, safe errors, rate limits, health/readiness, privacy and retention | Auth middleware, RBAC middleware, ABAC fail-closed middleware, input/controller validations exist | Not verified | Needs dedicated requirement-by-requirement tests and config review: CORS/proxy, rate limits per sensitive endpoint, CSRF, retention, response times, readiness and error leakage. |
| SRS §6 — logical collections | users, roles, permissions, rolePermissions, departments, resources, policies/versions, devices, sessions, refreshTokens, riskEvents, accessRequests, jitGrants, auditLogs, simulationRuns, mfaSecrets, systemConfig, alerts, incidents | Inspected server model tree contains User, Role, Permission, Device, RevokedToken, AuditLog, AuthChallenge, Invitation, AdminSeat, SetupState, AbacPolicy | Partial | Several required logical collections are not present as dedicated models in inspected tree. Some concepts may be represented differently; map explicitly rather than assume equivalence. |

## Verified risk-band mismatch

The inspected implementation in `server/src/services/riskEngine.js` maps:
- score <30 → Low
- score 30–69 → Medium
- score >=70 → High and DENY

The submitted SRS §3.5 FR-RISK-04 specifies:
- 0–30 → Low / allow subject to policy
- 31–60 → Medium / require MFA
- 61–80 → High / deny or admin review
- 81–100 → Critical / deny with incident alert

Concrete boundary mismatches:
- 30 is Medium in code but Low in SRS.
- 31–60 is Medium in both, but SRS requires MFA; inspected engine returns ALLOW for Medium.
- 61–69 is Medium in code but High in SRS.
- 70–80 is High in code and High in SRS, but no Critical band at 81+ exists.
- The current engine denies at >=70, while SRS differentiates High and Critical response actions.

**Do not change thresholds or enforcement until the team/faculty confirms whether the submitted SRS is the binding acceptance baseline.** If it is, implement the four-band mapping with boundary tests and explicit policy response handling.

## Priority implementation sequence

### P0 — close requirements and safety-critical design gaps
1. Confirm SRS/SDD are the approved, binding baseline and obtain team/faculty decisions for role mapping, risk-band response and session migration.
2. Add a route-to-requirement/permission inventory for every protected API and negative tests for missing, foreign-scope and denied access.
3. Complete audit redaction tests and decide which critical writes must not proceed when audit persistence fails.
4. Verify session revocation, password-change invalidation, device revocation and OTP replay/attempt/expiry tests against the current implementation.

### P1 — implement baseline capabilities in small, testable slices
1. Model the seven campus roles and department hierarchy with explicit permission matrices; preserve existing user data and provide a reviewed migration plan.
2. Implement four risk bands and band-specific actions (MFA, review, deny, incident) with boundary tests at 0, 30, 31, 60, 61, 80, 81 and 100.
3. Design refresh-token rotation, family reuse detection, cookie/CSRF strategy and short-lived access JWT migration; do not invalidate existing sessions unexpectedly.
4. Extend device lifecycle with Unverified and At Risk, approval by a different actor, and signed server-issued device token; document prototype limits.
5. Implement JIT requests, two-person/self-approval rules where required, grant scope, expiry/revocation and audit.

### P2 — assurance and completeness
1. Implement audit hash chaining with canonical serialization, concurrency-safe chain-head updates, tamper tests and a verifier; separately protect/anchor chain checkpoints.
2. Add policy draft/publish, immutable snapshots, approvals and simulation parity.
3. Add alerts/incidents, risk-event persistence/configuration and SRS-required audit verification/export.
4. Add frontend and end-to-end tests for the full campus actor workflows and the SRS acceptance scenarios.

## Decisions required before changing behaviour

| Decision | Why it matters | Safe default until approved |
|---|---|---|
| Are the submitted SRS/SDD the binding evaluation baseline? | Determines whether implementation must conform or documents can be formally revised. | Treat submitted baseline as binding for gap reporting; do not silently edit it. |
| How do HR Manager and Employee map to Department Admin, Faculty and Student? | Role names imply different authority/scope; aliases may create privilege errors. | Do not alias; keep seven roles as target requirements and mark three absent. |
| Should risk follow the submitted four bands and actions? | Threshold/action changes alter login outcomes and may lock out users. | Preserve current runtime until approved; document mismatch. |
| Approve access JWT/refresh cookie/CSRF migration? | Requires coordinated backend/frontend/session rollout. | Do not rotate schema or invalidate sessions without migration plan. |
| What constitutes a valid device approval/signature in an academic prototype? | A browser identifier is not hardware attestation. | Explicitly label current trust as application-level only. |
| Which audit events are mandatory and what is the failure policy? | Non-blocking audit writes can leave privileged actions without durable evidence. | Alert and test; do not claim tamper evidence. |

## Evidence inspected

Repository source at commit `641ac4883d5c54440c7f7fa5f608cb94612b1b5`:
- `server/src/controllers/setupController.js` — role bootstrap and initial Super Admin.
- `server/src/controllers/authController.js` — password + email OTP, challenge expiry/attempt controls, invitation flow.
- `server/src/models/User.js` — account fields and JWT issuance (default seven days).
- `server/src/middleware/authMiddleware.js` — bearer JWT verification, token version/revocation and device binding.
- `server/src/models/RevokedToken.js` — revoked token digest records.
- `server/src/models/Device.js` and `server/src/controllers/deviceController.js` — device state and self-revocation.
- `server/src/services/riskEngine.js` and `server/test/riskEngine.test.js` — scoring and current three-level mapping.
- `server/src/services/abacPolicyEngine.js`, `server/src/middleware/abacMiddleware.js`, `server/src/routes/userRoutes.js`, `server/src/routes/deviceRoutes.js` — ABAC semantics and route coverage.
- `server/src/models/AuditLog.js` and `server/src/services/auditService.js` — audit persistence and sanitization.
- `server/src/models` and `server/src/routes` tree — current model/route inventory.
- `SECUREGATE_ENGINEERING_ROADMAP.md` and `README.md` — declared current status and limitations.

## Verification still outstanding

This is an initial static source review, not a full runtime audit. Before marking requirements Implemented:
- Run focused tests in the isolated test database and capture exact commit/test output.
- Inspect all relevant controllers, route mounts, frontend flows and environment configuration.
- Verify every SRS requirement ID, including requirements not yet individually enumerated above.
- Confirm no uninspected model/route or external service implements a listed capability.
- Review migration and rollback plans before any schema/session/role change.
