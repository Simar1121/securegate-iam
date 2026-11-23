# SecureGate — Identity & Access Management System

**SecureGate** is a MERN-stack Identity and Access Management (IAM) application designed to manage organizational identities, employee lifecycles, role-based access control, permissions and security audit events.

The project focuses on secure authentication, least-privilege authorization, centralized identity management and security monitoring.

> **Development status:** Active development. Features and documentation are updated incrementally as the project evolves.

---

## 1. Project Overview

SecureGate aims to provide a centralized platform for managing an organization's users and access privileges.

The application is being developed with the following objectives:

- Centralized employee identity management.
- Secure authentication and session management.
- Role-Based Access Control (RBAC).
- Permission-based authorization.
- Employee onboarding and account lifecycle management.
- Security event monitoring and audit logging.
- Administrative dashboards and access governance.
- Automated testing and CI/CD integration.

---

## 2. Technology Stack

### Frontend
- React.js 18
- Vite
- Tailwind CSS
- React Router
- Axios
- Lucide React

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JSON Web Tokens (JWT)
- bcryptjs
- Helmet
- Express Rate Limit

### Development and DevOps Roadmap
- Git and GitHub — Version control
- Jira — Project and sprint management
- Docker — Application containerization
- Jenkins — Continuous Integration and Continuous Delivery

The DevOps integrations are planned development milestones and should not be considered completed until implemented and tested.

---

## 3. Core Modules

### 3.1 Authentication and Identity Security
- JWT-based authentication.
- Secure password hashing.
- Protected application routes.
- Password change functionality.
- Session revocation.
- Account lockout protection.
- Suspended-account restrictions.

### 3.2 First-Time Organization Setup
- Initial organization initialization.
- First Super Admin account creation.
- Automatic initialization of standard roles and permissions.
- Prevention of repeated initial administrator registration.
- No predefined employee accounts.

### 3.3 Employee Lifecycle Management
- Employee onboarding.
- Employee profile management.
- Department and job-title assignment.
- Role assignment.
- Account activation and suspension.
- Employee directory and search.

### 3.4 Role-Based Access Control
The planned standard roles are:

1. Super Admin
2. IT Administrator
3. HR Manager
4. Employee
5. Security Auditor

Access is controlled through role assignments and associated permissions.

### 3.5 Permission Management
The permission model includes capabilities such as:

- `users:read`
- `users:create`
- `users:update`
- `users:delete`
- `roles:manage`
- `permissions:manage`
- `audit:read`
- `settings:manage`

### 3.6 Security Audit Logging
The application records security-relevant activities, including:

- Authentication events.
- Employee management activities.
- Role and permission changes.
- Password changes.
- Account lockouts.
- Blocked privilege escalation attempts.

Sensitive credentials and authentication tokens must never be stored in audit event details.

### 3.7 Administrative Dashboard
The dashboard is intended to display database-driven information:

- Total employees.
- Active employees.
- Suspended employees.
- Role distribution.
- Department distribution.
- Recent security events.

All displayed statistics should be derived from actual application data rather than hardcoded demo records.

---

## 4. Project Architecture

```text
securegate/
│
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── layouts/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   │
│   ├── .env.example
│   ├── package.json
│   ├── testBackend.js
│   └── test

---

## Security hardening: email MFA, invitations and trusted devices

The authentication flow is being implemented as a two-step process:

1. The user submits their registered email address or employee ID and password.
2. SecureGate emails a six-digit OTP to the registered mailbox.
3. The OTP is valid for five minutes, single-use, limited to five attempts and protected by a resend cooldown.
4. Only successful OTP verification can establish an authenticated session.

OTP values are stored as keyed digests. The first-factor response contains an opaque challenge identifier, not an access token. Existing JWTs issued before mandatory MFA are rejected.

### Employee onboarding

Administrators create an employee record without setting the employee's password. SecureGate emails a one-time invitation link. The invited employee verifies the mailbox and creates their own password. Invitation links expire after 24 hours and can be resent by an authorized administrator.

### Administrator governance

- Exactly one Super Admin is created through initial organization setup.
- The sole Super Admin cannot be created again, demoted, suspended, deactivated or deleted through the employee-management endpoints.
- A maximum of three IT Administrators can be appointed.
- Only the Super Admin can appoint, promote or delete IT Administrators.
- Super Admin and IT Administrator are the only roles allowed to create employee accounts.
- IT Administrators cannot create or promote other administrators.

Administrator seat records are maintained separately from existing user records. Existing employee records are not reset or deleted by this feature.

### Device trust and login risk assessment

After successful email OTP verification, SecureGate registers the browser device and evaluates its context. The initial risk model considers new devices, changed IP addresses, changed user agents, previously revoked devices and incorrect OTP attempts. High-risk sign-ins are blocked.

Access tokens contain a device binding. The backend checks the device's current trust state on protected requests, so revoking a device also invalidates sessions bound to it. Users can inspect and revoke their other trusted devices in Profile → Password & Security.

### Gmail SMTP configuration

Use a Gmail account dedicated to application mail. Enable Google 2-Step Verification and create a Google App Password. Do not use the account's regular Gmail password, and do not commit credentials.

Configure the following in `server/.env` (the names and placeholders are also listed in `server/.env.example`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-securegate-sender@gmail.com
SMTP_APP_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
EMAIL_FROM=SecureGate IAM <your-securegate-sender@gmail.com>
FRONTEND_URL=http://localhost:5173
```

Use port 587 with STARTTLS (`SMTP_SECURE=false`) or port 465 with implicit TLS (`SMTP_SECURE=true`). `FRONTEND_URL` must be the URL the invited employee can actually reach. For LAN demonstrations, use the host computer's reachable LAN address; for deployment, use the deployed frontend origin.

The backend uses Nodemailer 10.6.0 and requires Node.js 20 or later. After pulling the branch, run `npm install` in the `server` directory to install dependencies.

### Security test coverage

The security audit suite now exercises password-plus-OTP login, OTP replay rejection, invitation acceptance, trusted device registration and revocation, legacy-token rejection, administrator seat limits and protection of the sole Super Admin.

Run it only against a separate disposable MongoDB database whose name contains `test`, for example `securegate_test_db`. Never point the destructive security test suite at `securegate_org_db`.


---

## Docker local environment

SecureGate can run as a containerized local stack using Docker Compose:

- **Frontend:** React production build served by Nginx at `http://localhost:8080`.
- **Backend:** Express API at `http://localhost:5001/api` (also reached through the frontend's same-origin `/api` proxy).
- **MongoDB:** Isolated MongoDB 7 container, available to MongoDB Compass at `mongodb://localhost:27018` with the credentials configured in the root `.env` file.

### Data safety

The Docker stack uses a separate MongoDB container, a persistent Docker volume named `securegate_docker_mongodb_data`, and the databases `securegate_docker_db` and `securegate_docker_test_db`.

It does **not** connect to, import, reset, or replace the Windows-host `securegate_org_db` database. The Docker MongoDB service maps to host port `27018` so the existing local MongoDB service on port `27017` remains untouched.

### First-time setup on Windows PowerShell

1. Start Docker Desktop and wait until the Docker Engine is running.
2. From the repository root, create the root Docker environment file if it does not already exist:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item docker.env.example .env }
   ```

3. Edit the root `.env` file and replace `MONGO_INITDB_ROOT_PASSWORD` with a unique random alphanumeric password of at least 32 characters. Keep that value stable for this Docker volume.
4. Ensure `server/.env` exists. If it does not, copy `server/.env.example` to `server/.env`, then configure a strong `JWT_SECRET` and your Gmail SMTP App Password. Do not overwrite an existing `server/.env`.
5. Start the containers:

   ```powershell
   docker compose up --build -d
   ```

6. Check service health:

   ```powershell
   docker compose ps
   docker compose logs -f backend
   ```

7. Open `http://localhost:8080`. This Docker database is separate and starts empty, so complete the initial organization setup to create its first Super Admin. Invitation and OTP emails use the SMTP settings from `server/.env`.

### Containerized security test suite

The test runner is isolated from the application image and only targets `securegate_docker_test_db`:

```powershell
docker compose --profile test run --rm backend-test
```

### Stop the local stack

```powershell
docker compose down
```

This stops and removes the containers but preserves the named MongoDB volume. Do not use `docker compose down --volumes` for your local environment unless you intentionally want to delete the Docker MongoDB data.

### Automated Docker validation

GitHub Actions runs the Docker Compose validation, builds the frontend/backend/test images, runs the backend security suite against the isolated Docker test database, and smoke-tests the frontend and API through Nginx on pushes to the development branches and pull requests targeting `develop`.

The workflow builds and tests images only; it does not publish them to Docker Hub. Registry publishing can be configured separately when a Docker Hub account and repository secrets are ready.


### Local Jenkins CI

The repository includes a local Jenkins controller and an automated Declarative Pipeline. On Windows, use Docker Desktop with Linux containers enabled.

1. Start Jenkins:

   ~~~powershell
   docker compose -f jenkins-compose.yml config --quiet
   docker compose -f jenkins-compose.yml up --build -d
   ~~~

2. Open http://localhost:8081 and complete the Jenkins setup wizard.
3. Create a Multibranch Pipeline job, add the GitHub repository https://github.com/Simar1121/securegate-iam, set the script path to Jenkinsfile, and enable periodic branch indexing (for example, every 5 minutes). Include the develop and feature/secure-onboarding-2fa branches.

Each build generates fresh random MongoDB and JWT secrets in temporary, permission-restricted workspace environment files. The backend security suite runs with NODE_ENV=test, so login OTP and invitation messages use the in-memory test outbox and no real SMTP account is needed for CI. No production Gmail credentials are loaded into the test job.

The pipeline creates a unique MongoDB volume for each build by using a temporary Compose override. Cleanup removes only that build's disposable test volume; it does not touch the persistent volume used by the regular local SecureGate Docker stack. Temporary environment files are removed after the build.

Jenkins uses a separate, TLS-protected Docker-in-Docker engine. Its web interface is bound to 127.0.0.1:8081; the Docker daemon is not published to the Windows host. Because nested bridge-container DNS can fail in some Docker Desktop environments, the DinD service mounts `jenkins/dind-resolv.conf` read-only so the daemon itself can resolve external registries without depending on the embedded `127.0.0.11` forwarder. The pipeline creates a dedicated BuildKit builder using the DinD host network and grants the `network.host` build entitlement only to image-build steps. It first stores the DinD TLS endpoint in a named Docker context so Buildx can create its builder with the mounted client certificates, then checks Docker Hub and npm registry connectivity before their respective image pulls and dependency installs. Jenkins data is retained in dedicated Docker volumes.
