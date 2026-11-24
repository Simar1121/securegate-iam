# Start SecureGate from the existing Kubernetes deployment and open the browser.
# Run from the repository root in PowerShell: .\start-securegate.ps1

$ErrorActionPreference = 'Stop'
$Namespace = 'securegate'
$Service = 'frontend'
$LocalPort = 8082
$RemotePort = 80
$Url = "http://localhost:$LocalPort"

Write-Host "SecureGate launcher" -ForegroundColor Cyan

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  throw "kubectl was not found. Install Docker Desktop Kubernetes or add kubectl to PATH."
}

$context = kubectl config current-context 2>$null
if ($LASTEXITCODE -ne 0 -or $context -ne 'docker-desktop') {
  throw "Expected Kubernetes context 'docker-desktop'. Current context: $context. Switch context before continuing."
}

$frontend = kubectl get deployment frontend -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
$backend = kubectl get deployment backend -n $Namespace -o jsonpath='{.status.readyReplicas}' 2>$null
if ($LASTEXITCODE -ne 0 -or [int]$frontend -lt 1 -or [int]$backend -lt 1) {
  throw "SecureGate frontend/backend are not ready in namespace '$Namespace'. Check: kubectl get pods -n $Namespace"
}

$listener = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
      Write-Host "SecureGate is already available at $Url" -ForegroundColor Green
      Start-Process $Url
      exit 0
    }
  } catch {}
  throw "Port $LocalPort is already in use by another process. Close that process or change LocalPort in this script."
}

$command = 'kubectl port-forward service/{0} {1}:{2} -n {3}' -f $Service, $LocalPort, $RemotePort, $Namespace
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit','-Command', $command) -PassThru
Write-Host "Starting frontend port-forward (PID $($process.Id))..." -ForegroundColor Yellow

$ready = $false
for ($i = 0; $i -lt 25; $i++) {
  Start-Sleep -Milliseconds 400
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
}

if (-not $ready) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "SecureGate did not respond at $Url. Check the port-forward terminal and Kubernetes frontend service."
}

Write-Host "SecureGate is ready: $Url" -ForegroundColor Green
Start-Process $Url
Write-Host "Keep the port-forward PowerShell window open while using SecureGate." -ForegroundColor Gray
