#!/usr/bin/env bash
# ==============================================================================
# HomelyBites - OpenShift Automated Deployment Script (Bash)
# ==============================================================================
set -e

echo "=========================================================="
echo " 🍲 HomelyBites Homemade Food - OpenShift Deployer"
echo "=========================================================="

OC_CMD="oc"
if ! command -v oc &> /dev/null; then
    if [ -f "./bin/oc" ]; then
        OC_CMD="./bin/oc"
    else
        echo "❌ OpenShift CLI ('oc') not found in PATH."
        exit 1
    fi
fi

echo "[1/4] Checking OpenShift login..."
CURRENT_USER=$($OC_CMD whoami)
CURRENT_PROJECT=$($OC_CMD project -q 2>/dev/null || echo "default")
echo "✔ Logged in as: $CURRENT_USER"
echo "✔ Active Project: $CURRENT_PROJECT"

read -p "Enter OpenShift Project to deploy to [$CURRENT_PROJECT]: " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-$CURRENT_PROJECT}

$OC_CMD project "$PROJECT_NAME" 2>/dev/null || $OC_CMD new-project "$PROJECT_NAME"

echo "[2/4] Setting up BuildConfig in OpenShift..."
$OC_CMD get bc/homelybites -n "$PROJECT_NAME" 2>/dev/null || \
    $OC_CMD new-build --name=homelybites --binary --strategy=docker -n "$PROJECT_NAME"

echo "[3/4] Uploading workspace and building container in cluster..."
$OC_CMD start-build homelybites --from-dir=. --follow -n "$PROJECT_NAME"

$OC_CMD get deployment/homelybites -n "$PROJECT_NAME" 2>/dev/null || \
    $OC_CMD new-app homelybites -n "$PROJECT_NAME"

$OC_CMD get route/homelybites -n "$PROJECT_NAME" 2>/dev/null || \
    $OC_CMD create route edge homelybites --service=homelybites --port=8080 -n "$PROJECT_NAME"

echo "[4/4] Getting live Route URL..."
sleep 3
ROUTE_HOST=$($OC_CMD get route homelybites -n "$PROJECT_NAME" -o jsonpath='{.spec.host}')

echo "=========================================================="
echo " 🎉 Live URL: https://${ROUTE_HOST}"
echo "=========================================================="
