# ZeroGate Campus / SecureGate — Implementation Reconciliation

**Baseline:** submitted ZeroGate Campus SRS and SDD (Capstone Project II, CS 4191, NIIT University, Academic Year 2026–27).  
**Repository:** `Simar1121/securegate-iam`, branch `chore/zero-trust-hardening`.  
**Review date:** 24 November 2026.

## Purpose and naming

The submitted SRS/SDD identifies **ZeroGate Campus** as the canonical academic project name. The implementation repository and running application use **SecureGate**. This document treats SecureGate as the implementation of the ZeroGate Campus project; it does not silently rename the submitted baseline.

## Evidence standard

- **Implemented (source-backed):** described by current repository source or workflow configuration.
- **Partially implemented:** a working subset exists, but the SRS scope is broader.
- **Not verified:** available evidence is insufficient to claim completion.
- **Not implemented / target gap:** the source or current project documentation explicitly identifies the capability as future work or absent.

A green Jenkins build is evidence that the configured pipeline completed, not proof that every SRS acceptance criterion has been met. The Jenkins UI screenshot supplied on 24 November 2026 shows recent green builds #14–#21 and job health **stable**. Detailed stage-level evidence for #21 was not supplied in this review.

## Current implementation summary

### Confirmed implementation areas

- MERN application: React 18/Vite client, Express 4/Node.js backend, MongoDB/Mongoose persistence.
- Password + mandatory email OTP login flow; OTP challenge handling is described in the repository documentation as hashed, time-limited and single-use.
- Invitation-based employee onboarding; invited users establish their own passwords.
- RBAC and server-side permission middleware.
- Device registration/binding and self-service device revocation.
- Risk assessment service with normalized 0–100 scores and four classification bands matching the submitted SRS: Low 0–30, Medium 31–60, High 61–80, Critical 81–100.
- Risk-event persistence and security alert/incident workflows are described in the implementation documentation.
- ABAC policy administration and simulation UI for Super Admin.
- ABAC engine supports PERMIT/DENY policy definitions, allowlisted attributes and operators. **Enforcement is deny-only and limited to selected user-management and self-service device routes**; RBAC remains the grant authority.
- Docker Compose application stack, GitHub Actions Docker/security workflow, local Jenkins Declarative Pipeline, Kubernetes deployment.
- Jenkins build-history screenshot: builds #14–#21 shown successful/green; job reports stable. Stage-by-stage build #21 was not independently inspected.

### Important distinctions

1. Risk classification and risk enforcement are separate. The risk service maps all four SRS bands and emits recommended actions. Its source explicitly preserves the existing login enforcement threshold: High/Critical are denied; Medium's REQUIRE_MFA recommendation is not wired to a separate risk-triggered step-up challenge.
2. ABAC PERMIT is not an independent grant. A PERMIT or NOT_APPLICABLE result does not override RBAC.
3. ABAC is not universal across all protected APIs. Current documented coverage is selected user-management routes and device list/revoke endpoints.
4. The policy simulator is non-enforcing and does not modify live policy state.
5. The local Kubernetes deployment and the cloud-production deployment requirements are distinct. A running local cluster does not establish a publicly hosted HTTPS production environment.

## SRS/SDD reconciliation matrix

| Area | Current evidence | Status against SRS |
|---|---|---|
| MERN + MongoDB | Current package manifests and repository architecture | Implemented |
| Password + email OTP | Repository auth design and security suite description | Implemented; manual negative-path evidence not independently reviewed |
| Rotating refresh-token cookie + reuse detection | SRS target; repository describes JWT sessions, logout blacklist and session invalidation | Not verified / design mismatch to reconcile |
| Seven campus roles | SRS defines Super Admin, IT Admin, Security Officer, Department Admin, Faculty, Student, Auditor | Partial: current bootstrap role set is five roles; role mapping requires faculty decision |
| RBAC | Permission model and server middleware | Implemented; complete role-by-role direct API matrix not independently verified |
| Employee lifecycle | Invitation, password setup, activation/suspension/deactivation documented | Partial pending full expiry/replay/resend/duplicate and delivery-failure test evidence |
| ABAC | Policy manager, simulator, engine, selected route middleware | Partial: deny-only and selected routes |
| Four risk bands | `server/src/services/riskEngine.js` classifies Low/Medium/High/Critical | Implemented classification; adaptive actions partial |
| Risk-triggered step-up MFA | Medium recommends REQUIRE_MFA; source says enforcement not wired | Not implemented |
| Device trust | Device registration/binding/revocation and selected ABAC device enforcement | Partial against full SRS (separate-person trust promotion and hardware attestation are not established) |
| JIT access requests and grants | SRS defines request/approval/expiry/revocation | Not verified in current implementation evidence |
| Policy obligations and publishing | Current ABAC supports PERMIT/DENY; README identifies draft/publish approvals and immutable history as future work | Partial / target gap |
| Continuous verification | SRS requires event-triggered re-evaluation during active sessions | Not verified |
| Tamper-evident audit hash chain | SRS requires prevHash/recordHash and insert-only control; README describes audit logging but not verified hash-chain enforcement | Not verified / target gap |
| Alerts and incidents | Security operations API and risk-event persistence documented | Implemented in part; role mapping differs from SRS |
| Docker / CI / Jenkins | Docker Compose, GitHub Actions, Jenkinsfile; Jenkins screenshot shows stable green history | Implemented; detailed #21 stage evidence pending |
| Kubernetes | Local Kubernetes deployment observed in project operations | Implemented locally; production cluster status not claimed |
| Cloud HTTPS deployment | Jira issue marked Done, but this review did not independently validate public URL, TLS certificate or external invitation flow | Not verified |
| Documentation | SRS, SDD and report source files available; this reconciliation added | In progress / final review required |

## Risk bands implemented in the risk service

| Score | Classification | Recommendation |
|---:|---|---|
| 0–30 | Low | ALLOW |
| 31–60 | Medium | REQUIRE_MFA |
| 61–80 | High | DENY_OR_ADMIN_REVIEW |
| 81–100 | Critical | DENY_AND_ALERT |

The risk engine is heuristic decision support. The source code states that the recommended Medium-band step-up action is not currently wired to a separate challenge. Do not describe the score as proof of malicious intent.

## Key implementation limitations to disclose

- The current role set is not the seven-role academic target.
- Refresh-token rotation, reuse detection and CSRF requirements need source-level verification before claiming SRS conformance.
- JIT access, full policy obligations, policy publishing/approval, continuous verification and hash-chain audit integrity are not established by the evidence reviewed.
- Risk-triggered step-up MFA is not implemented.
- ABAC coverage is selective and deny-only.
- Browser/device signals are not hardware-rooted attestation.
- SMTP delivery and externally reachable invitation links depend on deployment configuration.
- The project is an academic prototype, not a certified production identity provider.

## Recommended completion order

1. Freeze and preserve the current database and deployment; retain the verified backup.
2. Run the complete backend test command only against the dedicated test database: `npm test` from `server`.
3. Inspect Jenkins build #21 stage view and archive its console output/test evidence.
4. Execute role-by-role API authorization tests and auth/device negative-path tests.
5. Decide with the faculty mentor whether the seven-role SRS is still binding or whether a documented role mapping/change request is acceptable.
6. Decide the session target (rotating refresh cookie vs current session/JWT design) before changing auth code.
7. Prioritize risk-triggered step-up MFA, JIT, audit integrity, continuous verification and expanded ABAC only after design approval.
8. Reconcile SRS/SDD and final report to the approved scope, with a signed change record for deferred requirements.

## Safety constraints

- Never run destructive tests against `securegate_org_db`.
- Use a dedicated database whose name contains `test` for the security regression suite.
- Preserve the original MongoDB 7 deployment/PVC and the restored MongoDB 8 deployment/PVC.
- Do not run `docker compose down -v` against the user's application or Jenkins stacks.
- Keep real secrets out of Git, screenshots, logs and submitted documents.
