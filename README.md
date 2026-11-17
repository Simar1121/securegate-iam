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