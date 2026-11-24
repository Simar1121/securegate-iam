# Start the existing SecureGate Kubernetes stack after a Windows restart.
# Run from the repository root: .\start-securegate.ps1
# This script does NOT build images, reset databases, or delete Kubernetes resources.

$ErrorActionPreference = 'Stop'
$Namespace = 'securegate'
$LocalPort = 8082
$RemotePort = 80
$Url = "http://localhost:$LocalPort"
$HealthUrl = "$Url/api/health"
$DockerDesktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

Write-Host '=== SecureGate startup ===' -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker CLI was not found in PATH. Repair/reinstall Docker Desktop before continuing."
}

# 1. Start Docker Desktop if its engine is not already available.
$dockerReady = $false
try {
  docker info *> $null
  $dockerReady = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $dockerReady) {
  if (-not (Test-Path $DockerDesktopExe)) {
    throw "Docker Desktop was not found at '$DockerDesktopExe'. Open Docker Desktop manually and rerun this script."
  }
  Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
  Start-Process -FilePath $DockerDesktopExe
  for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep -Seconds 2
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
  }
}
if (-not $dockerReady) {
  throw "Docker Desktop did not become ready within 6 minutes. Check Docker Desktop, then rerun this script."
}
Write-Host "Docker Desktop is ready." -ForegroundColor Green

# 2. Select the existing Docker Desktop Kubernetes context.
$contexts = kubectl config get-contexts -o name 2>$null
if ($LASTEXITCODE -ne 0 -or $contexts -notcontains 'docker-desktop') {
  throw "The 'docker-desktop' Kubernetes context is missing. Enable Kubernetes in Docker Desktop."
}
$currentContext = kubectl config current-context 2>$null
if ($currentContext -ne 'docker-desktop') {
  Write-Host "Switching kubectl context to docker-desktop..." -ForegroundColor Yellow
  kubectl config use-context docker-desktop
  if ($LASTEXITCODE -ne 0) { throw "Could not select docker-desktop Kubernetes context." }
}

# 3. Wait for Kubernetes to start, then wait for the existing database and app.
Write-Host "Waiting for Docker Desktop Kubernetes..." -ForegroundColor Yellow
$clusterReady = $false
for ($i = 0; $i -lt 90; $i++) {
  kubectl get nodes *> $null
  if ($LASTEXITCODE -eq 0) { $clusterReady = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $clusterReady) {
  throw "Kubernetes did not become ready within 3 minutes. Check Docker Desktop > Kubernetes."
}
kubectl wait --for=condition=Ready nodes --all --timeout=180s
if ($LASTEXITCODE -ne 0) { throw "The Kubernetes node is not Ready. Rerun after Docker Desktop finishes starting." }

foreach ($deployment in @('mongodb-83', 'backend', 'frontend')) {
  Write-Host "Waiting for deployment/$deployment..." -ForegroundColor Yellow
  kubectl rollout status "deployment/$deployment" -n $Namespace --timeout=240s
  if ($LASTEXITCODE -ne 0) {
    kubectl get pods -n $Namespace -o wide
    throw "deployment/$deployment is not ready. No database or Kubernetes resources were deleted."
  }
}
Write-Host "SecureGate frontend, backend, and MongoDB are ready." -ForegroundColor Green

# 4. Reuse a healthy port-forward or create one in a separate PowerShell window.
$listener = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  try {
    $health = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 4
    if ($health.StatusCode -eq 200) {
      Write-Host "Existing SecureGate port-forward is healthy." -ForegroundColor Green
      Start-Process $Url
      exit 0
    }
  } catch {}
  throw "Port $LocalPort is occupied but SecureGate health check failed. Close the stale port-forward window and rerun."
}

$portForwardCommand = 'kubectl port-forward service/frontend {0}:{1} -n {2}' -f $LocalPort, $RemotePort, $Namespace
$portForward = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-Command', $portForwardCommand) -PassThru
Write-Host "Starting frontend port-forward (PID $($portForward.Id))..." -ForegroundColor Yellow

$apiReady = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    if ($health.StatusCode -eq 200) { $apiReady = $true; break }
  } catch {}
}
if (-not $apiReady) {
  throw "Port-forward started but API health check failed. Inspect its PowerShell window. Do not reset MongoDB."
}

Write-Host "SecureGate is READY: $Url" -ForegroundColor Green
Start-Process $Url
Write-Host "Keep the port-forward PowerShell window open while using SecureGate." -ForegroundColor Gray
