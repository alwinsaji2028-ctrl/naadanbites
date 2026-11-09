# ==============================================================================
# HomelyBites - OpenShift Automated Deployment Script (PowerShell)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🍲 HomelyBites Homemade Food - OpenShift Deployer" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve oc CLI
$ocCmd = "oc"
if (-not (Get-Command oc -ErrorAction SilentlyContinue)) {
    if (Test-Path "$PSScriptRoot\bin\oc.exe") {
        $ocCmd = "$PSScriptRoot\bin\oc.exe"
        Write-Host "✔ Found OpenShift CLI at: $ocCmd" -ForegroundColor Green
    } else {
        Write-Host "❌ OpenShift CLI ('oc') not found. Please install oc or run from the repo root." -ForegroundColor Red
        Exit 1
    }
}

# 2. Check OpenShift Login status
Write-Host "`n[1/4] Checking OpenShift cluster connection..." -ForegroundColor Cyan
$currentUser = & $ocCmd whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ You are not currently logged into OpenShift!" -ForegroundColor Yellow
    Write-Host "Please login first using your OpenShift Web Console token:" -ForegroundColor White
    Write-Host "Example: & `"$ocCmd`" login --token=sha256~... --server=https://api.your-cluster:6443" -ForegroundColor Gray
    Exit 1
}

$currentProject = & $ocCmd project -q 2>&1
Write-Host "✔ Connected as: $currentUser" -ForegroundColor Green
Write-Host "✔ Active OpenShift Project / Namespace: $currentProject" -ForegroundColor Green

# 3. Create or switch to project
$projectName = Read-Host "`nEnter OpenShift Project to deploy to (Press ENTER to use '$currentProject')"
if ([string]::IsNullOrWhiteSpace($projectName)) {
    $projectName = $currentProject
} else {
    & $ocCmd project $projectName 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating new OpenShift project '$projectName'..." -ForegroundColor Cyan
        & $ocCmd new-project $projectName
    }
}

# 4. Choose Deployment Method
Write-Host "`n[2/4] Select OpenShift Deployment Strategy:" -ForegroundColor Cyan
Write-Host "  1) OpenShift Internal Build (Recommended: Builds container inside OpenShift from local files, no local Docker needed)" -ForegroundColor White
Write-Host "  2) OpenShift Source-to-Image (S2I Node.js runtime)" -ForegroundColor White
Write-Host "  3) Apply Pre-packaged Kubernetes / OpenShift YAMLs (openshift/all-in-one.yaml)" -ForegroundColor White

$choice = Read-Host "Choose strategy [1, 2, or 3] (Default: 1)"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

if ($choice -eq "1") {
    Write-Host "`n[3/4] Initiating OpenShift Binary Docker Build..." -ForegroundColor Cyan
    
    # Check if BuildConfig exists, create if not
    $bcExists = & $ocCmd get bc/homelybites -n $projectName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating BuildConfig 'homelybites' in $projectName..." -ForegroundColor Gray
        & $ocCmd new-build --name=homelybites --binary --strategy=docker -n $projectName
    }

    Write-Host "Uploading local workspace and building container in cluster..." -ForegroundColor Yellow
    & $ocCmd start-build homelybites --from-dir=. --follow -n $projectName

    # Create app if deployment does not exist
    $dcExists = & $ocCmd get deployment/homelybites -n $projectName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating Deployment from build image..." -ForegroundColor Cyan
        & $ocCmd new-app homelybites -n $projectName
    }

    # Expose service with route
    $routeExists = & $ocCmd get route/homelybites -n $projectName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Exposing service with HTTPS Edge Route..." -ForegroundColor Cyan
        & $ocCmd create route edge homelybites --service=homelybites --port=8080 -n $projectName
    }

} elseif ($choice -eq "2") {
    Write-Host "`n[3/4] Deploying using Node.js S2I Builder..." -ForegroundColor Cyan
    & $ocCmd new-app nodejs:20~. --name=homelybites -n $projectName
    & $ocCmd expose svc/homelybites -n $projectName
} else {
    Write-Host "`n[3/4] Applying manifests from openshift/all-in-one.yaml..." -ForegroundColor Cyan
    & $ocCmd apply -f "$PSScriptRoot\openshift\all-in-one.yaml" -n $projectName
}

# 5. Fetch Public Route URL
Write-Host "`n[4/4] Fetching public application Route URL..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$routeHost = & $ocCmd get route homelybites -n $projectName -o jsonpath='{.spec.host}' 2>$null

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " 🎉 HomelyBites Successfully Deployed to OpenShift!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
if ($routeHost) {
    $url = "https://$routeHost"
    Write-Host "🌐 Your live website URL: $url" -ForegroundColor Yellow
    Write-Host "🩺 Health check probe:   $url/healthz" -ForegroundColor Gray
} else {
    Write-Host "Run the following to view your route URL:" -ForegroundColor White
    Write-Host "& `"$ocCmd`" get routes -n $projectName" -ForegroundColor Yellow
}

