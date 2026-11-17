# SecureGate Fresh Organization Setup - Implementation Notes

## Implemented in this revision
- Added `GET /api/setup/status`.
- Added one-time `POST /api/setup/initialize` guarded by a unique singleton setup-state document.
- First-time setup creates the eight system permissions, five system roles, one Super Admin, and one real `SYSTEM_INITIALIZED` audit event. It does not create demo employees or sample audit history.
- Setup checks that the target organization database has no users, roles, or permissions before creating records. It does not delete existing records.
- Failed setup attempts roll back only documents created by that request.
- Public `/api/auth/register` now returns 403. `/register` redirects to login.
- Login demo quick-fill credentials have been removed.
- Legacy destructive seed now refuses to run unless the selected database name contains `test`, in addition to its existing explicit opt-in and production guards.
- `.env.example` now points to `securegate_org_db` and retains a separate `securegate_test_db`.

## Required local environment
Create `server/.env` from `server/.env.example`, then set a fresh random `JWT_SECRET` (at least 32 characters). Keep:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/securegate_org_db
MONGODB_TEST_URI=mongodb://127.0.0.1:27017/securegate_test_db
```

Do not include or share `server/.env` in ZIP files.

## Important limitations / follow-up
- This revision implements the initial setup flow and disables public self-registration. It does not yet complete the separate dynamic-dashboard/employee-lifecycle review requested for later phases.
- MongoDB integration tests were not run in this build environment. The frontend JS/JSX files were parsed successfully, and backend source files passed Node syntax checks. A production Vite build could not be completed here because the uploaded `node_modules` contains Windows-specific optional Rollup binaries; run `npm install` in the local Windows project before building.
- The setup marker intentionally blocks repeat initialization. If the server process is forcibly terminated during initialization, an operator may need to inspect the `setupstates` collection and resolve the `initializing` marker before retrying. Do not manually delete it without checking whether setup-created records exist.
