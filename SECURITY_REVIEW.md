# SecureGate Security Review and Remediation Notes

This document records the additional source changes made after comparing the original ZIP with the latest Antigravity ZIP.

## Changes applied

- Removed the hardcoded JWT-secret fallback and require a configured secret of at least 32 characters at server startup and token verification.
- Require JWTs to contain the expected identity, expiry, issue-time and token-version claims.
- Check server-side token revocation on every protected request.
- Store newly revoked JWTs as SHA-256 digests rather than reusable bearer-token strings. Legacy plaintext revocation records remain readable for compatibility.
- Reject users whose assigned role is missing or inactive, including Super Admin accounts assigned to an inactive role.
- Add an authorization helper for routes requiring any one of several permissions.
- Restrict role and permission catalog reads to users with relevant management or user-provisioning permissions.
- Prevent non-Super-Admins from assigning roles whose permissions exceed their own permission set; privileged roles and privileged permission bundles remain Super-Admin-only.
- Protect privileged administrator accounts from HR/lower-privilege profile and status changes.
- Invalidate sessions for users assigned to a role whenever that role is updated.
- Require explicit opt-in before destructive seeding in every environment; disable seeding in production.
- Clear revoked-token records when explicitly reseeding a disposable development database.
- Make security integration tests require a separate MongoDB database whose name contains `test`, and run them on port 5010 rather than reusing the development server.
- Remove automatic seeding from the ordinary backend smoke-test command.
- Sanitize audit metadata and use Express's normalized client IP rather than trusting arbitrary `X-Forwarded-For` input.
- Add setup and safety instructions to the README.

## Verification performed here

- All backend JavaScript files passed `node --check`.
- All frontend JS/JSX files passed Babel parser syntax checks.
- The inactive-role middleware checks were exercised directly and returned 403 for all tested middleware variants.
- The destructive seed guard was exercised without the explicit opt-in flag and correctly refused to run.
- The security test runner was exercised without `MONGODB_TEST_URI` and correctly refused to start.

## Verification limitations

- A live MongoDB integration suite was not run in this environment because a MongoDB server is not available here. Configure `MONGODB_TEST_URI` to a disposable test database and run `npm run test:security` on your machine.
- A production frontend build could not be completed in this Linux environment because the uploaded `node_modules` were installed for Windows and did not contain Rollup's Linux optional binary. On Windows, run `npm install` in `client` and then `npm run build` from the client folder.
- This project is a basic IAM application with RBAC, authentication and audit functionality. It should not be described as a complete Zero Trust implementation yet.
- Application-level append-only audit logging is not tamper-proof against a database administrator. Stronger production assurance requires restricted database privileges and external immutable log storage.

## Important environment note

The ZIP intentionally excludes `server/.env`. Copy your local environment configuration into the new project, generate a new unique `JWT_SECRET`, and never commit or share `.env`. The uploaded archive contained an environment file, so rotate its JWT secret before continuing to use that environment.
