# SecureGate — Deployment and Operations Runbook

**Review date:** 24 November 2026  
**Repository branch:** `chore/zero-trust-hardening`

## Runtime topology observed

- Kubernetes context: `docker-desktop`
- Namespace: `securegate`
- Frontend service exposed locally through port-forward: `http://localhost:8082`
- API health endpoint through frontend proxy: `http://localhost:8082/api/health`
- Backend service: ClusterIP on port 5000
- Restored application database: MongoDB 8.3.17 deployment/service `mongodb-83`
- Backend connection target: `mongodb-83:27017/securegate_org_db`
- Original MongoDB 7.0 deployment/PVC is retained separately and must not be deleted.

## Start the local Kubernetes application

1. Start Docker Desktop and wait for Kubernetes to become available.
2. Open PowerShell in the repository root.
3. Run:

```powershell
.start-securegate.ps1
```

The launcher selects the Docker Desktop context, waits for the application deployments, starts a frontend port-forward window on port 8082, checks the API health endpoint and opens the browser. Keep the port-forward window open while using the application.

Expected health response: HTTP 200 with JSON status `online`.

If the app shows Network Error, first verify that the port-forward terminal is still running. Do not reset or recreate the database to fix a stopped port-forward.

## Kubernetes inspection commands

```powershell
kubectl config current-context
kubectl get pods -n securegate
kubectl get deployments -n securegate
kubectl get services -n securegate
kubectl rollout status deployment/backend -n securegate
kubectl rollout status deployment/frontend -n securegate
Invoke-WebRequest http://localhost:8082/api/health -UseBasicParsing
```

## Jenkins

Jenkins UI: `http://localhost:8081`

Compose services observed running:
- Jenkins controller: `securegate-jenkins-jenkins-1`
- TLS Docker-in-Docker engine: `securegate-jenkins-docker-1`

Build history screenshot supplied 24 November 2026 showed builds #14–#21 green and job health Stable. Earlier builds #11–#13 were red. Inspect build #21's stage view/console output when archiving formal evidence; the screenshot alone does not expose stage logs.

Do not stop/recreate Jenkins containers or remove Jenkins volumes during routine application troubleshooting. Never run `docker compose down -v` for the Jenkins stack.

## Docker Compose local stack (separate from Kubernetes)

The repository README documents a separate Compose environment:
- Frontend Nginx: `http://localhost:8080`
- Backend API: `http://localhost:5001/api`
- MongoDB host mapping: `localhost:27018`
- Persistent named data volume: `securegate_docker_mongodb_data`

This is a separate MongoDB instance and must not be confused with the restored Kubernetes application database or Windows-host MongoDB.

Before first start, create the root `.env` from `docker.env.example` only if it does not already exist, then set unique credentials. Do not overwrite an existing `server/.env`.

```powershell
if (-not (Test-Path .env)) { Copy-Item docker.env.example .env }
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Stop without deleting persistent data:

```powershell
docker compose down
```

Do not append `--volumes` unless intentionally deleting that separate Compose database.

## Backend test suite

From `server`:

```powershell
npm test
```

The package scripts run risk unit tests, ABAC/policy/device tests, and the security integration audit. Run only against a disposable test MongoDB database such as `securegate_test_db`. Never point the destructive integration suite at `securegate_org_db`.

## Backup and recovery

A verified archive backup was recorded at:

`server/securegate-backup-20261124T135821Z/securegate_org_db.archive.gz`

The archive was gzip-validated and restored into an isolated scratch database for a restore check (61 documents across 14 collections were observed). Keep the archive unchanged and make a fresh backup before any future migration or destructive operation.

## Secrets and operational security

- Never commit `.env`, SMTP app passwords, JWT secrets, MongoDB passwords, kubeconfig credentials or private keys.
- Use `server/.env.example` as the variable-name reference; never replace an existing populated `server/.env` automatically.
- Avoid printing Kubernetes Secret values or environment variables containing credentials.
- Use a dedicated Gmail App Password if SMTP is configured; never use a regular Gmail password.
- Use a reachable deployed frontend URL for invitation links; localhost is only suitable for local testing.

## Rollback principles

1. Stop before changing any database resource.
2. Preserve the current deployment image tag and manifests.
3. Roll back application deployments only after identifying the known-good image.
4. Do not delete PVCs/PVs or named volumes as part of application rollback.
5. Verify API health and login after rollback.
