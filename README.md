# 🍲 HomelyBites - Handcrafted Homemade Food Platform

An interactive full-stack e-commerce web application for authentic homemade food products (sun-ripened pickles, artisan breads, heritage sweets, stone-ground spices, and healthy snacks). Features rich business logic, Google Firebase Cloud database integration, and production-ready Red Hat OpenShift deployment manifests.

---

## 🌟 Key Features & Business Logic

### 1. Interactive Storefront
- **Artisan Catalog**: 8+ hand-crafted homemade food specialties with real imagery, ingredient lists, home chef stories, and batch freshness timestamps.
- **Category & Dietary Filtering**: Filter by category (*Pickles & Chutneys, Oven Bakes, Sweets, Spices, Snacks*) or dietary labels (*Vegetarian, Vegan, Gluten-Free, Organic, Zero Preservatives*).
- **Dynamic Pack Sizes**: Select different weights (e.g. 200g, 500g, 1kg) with live price updates.
- **Search & Sort**: Real-time multi-attribute search and sorting (by rating, price low-to-high, price high-to-low).

### 2. Shopping Basket & Smart Business Rules
- **Free Delivery Calculator**: Dynamic progress bar calculating remaining amount needed to qualify for FREE home delivery (threshold: ₹499).
- **Eco-friendly Glass Jar Deposit**: Optional refundable deposit (₹30) for sterilized reusable glass jars.
- **Promo Coupon Engine**:
  - `HOMEMADE10` — 10% discount on entire order.
  - `FIRSTBITE` — Flat ₹50 off on orders above ₹300.
  - `FREESHIP` — Free home delivery on any order size.
- **Batch Quantity Limiter**: Automatically respects small-batch inventory caps per product.

### 3. Complete Checkout & Order Lifecycle
- **Delivery Scheduling**: Specific delivery date selection and time windows (*Morning 9-12 AM, Afternoon 1-4 PM, Evening 5-8 PM*).
- **Flexible Payments**: Cash/Pay on Delivery, or simulated Instant UPI QR Code.
- **Live Order Confirmation**: Instant receipt with unique tracking ID (e.g. `#HB-892412`).
- **Real-Time Order Tracker**: 5-stage animated visual stepper:
  1. *Order Received*
  2. *Cooking with Love*
  3. *Quality Packed*
  4. *Out for Delivery*
  5. *Delivered*

### 4. Kitchen Admin Hub (Maker Dashboard)
- Live incoming order queue with one-click status transition buttons.
- In-browser form to publish new homemade creations directly to the live store.

### 5. Dual-Mode Database Architecture (Firebase & Local)
- **Instant Demo Mode**: Works 100% out of the box with zero external setup using `localStorage` and the Express REST backend.
- **Live Google Firebase**: Click the **⚙️ Firebase** badge in the header or set environment variables to seamlessly sync orders and products with your Google Cloud Firestore project.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the Node.js server
npm start
```

Visit `http://localhost:8080` in your browser.

- Storefront: `http://localhost:8080`
- OpenShift Health Probe: `http://localhost:8080/healthz`
- OpenShift Readiness Probe: `http://localhost:8080/readyz`

---

## 🔥 Connecting Google Firebase Firestore

You can connect Firebase in two simple ways:

### Method A: Through the UI
1. Click the **Firebase Status Pill** in the top navigation bar.
2. Enter your Firebase project keys:
   - `apiKey`
   - `projectId`
   - `appId`
3. Click **"Save & Connect to Firebase"**. All subsequent orders will sync directly to your Firestore collection (`homelybites_orders`).

### Method B: Via Environment Variables (or OpenShift ConfigMap)
Create a `.env` file in the project root:
```env
PORT=8080
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=1234567890
FIREBASE_APP_ID=1:1234567890:web:...
```

---

## ☸️ Deploying to Red Hat OpenShift

The project includes pre-configured OpenShift manifests under `openshift/` and an automated PowerShell script (`deploy-openshift.ps1`).

### Prerequisites
Make sure you are logged into your OpenShift cluster via the CLI:
```powershell
oc login --token=sha256~... --server=https://api.your-cluster:6443
```
*(Note: `oc.exe` is already installed in `./bin/oc.exe` and in your system PATH).*

---

### Method 1: Automated Script (Recommended)

In PowerShell, simply run:
```powershell
.\deploy-openshift.ps1
```
This script will:
1. Verify cluster connection (`oc whoami`).
2. Create/select your OpenShift Project.
3. Upload local code and build the container image inside OpenShift using OpenShift's internal BuildConfig (`--strategy=docker`).
4. Create the Deployment and Service on port 8080.
5. Create an HTTPS Edge-terminated Route and print your live public URL!

---

### Method 2: Manual CLI Deployment (Step-by-Step)

```bash
# 1. Switch to your desired project (or create one)
oc project my-food-store || oc new-project my-food-store

# 2. Create the Docker build config in OpenShift
oc new-build --name=homelybites --binary --strategy=docker

# 3. Stream local source to OpenShift to build the container
oc start-build homelybites --from-dir=. --follow

# 4. Deploy the application
oc new-app homelybites

# 5. Expose with secure HTTPS Route
oc create route edge homelybites --service=homelybites --port=8080

# 6. Retrieve public URL
oc get route homelybites
```

---

## 📂 Project Directory Structure

```text
├── Dockerfile                  # OpenShift compliant non-root containerfile
├── .dockerignore               # Build exclusion rules
├── package.json                # Express, CORS, and dependencies
├── server.js                   # Node.js backend with health/ready probes & APIs
├── deploy-openshift.ps1        # Interactive OpenShift deployer for Windows
├── deploy-openshift.sh         # Interactive OpenShift deployer for Linux/macOS
├── openshift/
│   ├── all-in-one.yaml         # Complete OpenShift manifest (ConfigMap + Deploy + Svc + Route)
│   ├── configmap.yaml          # Firebase & Node.js environment config
│   ├── deployment.yaml         # OpenShift Deployment with probes & resource quotas
│   ├── service.yaml            # ClusterIP Service (port 8080)
│   └── route.yaml              # TLS Edge Route for public HTTPS ingress
├── bin/
│   ├── oc.exe                  # Red Hat OpenShift CLI 4.22
│   └── kubectl.exe             # Kubernetes CLI 1.35
└── public/
    ├── index.html              # Main responsive storefront UI
    ├── css/
    │   └── styles.css          # Modern warm artisan styling
    └── js/
        ├── products-data.js    # Homemade catalog with photos & dietary badges
        ├── firebase-config.js  # Dual-mode Firebase Firestore sync & fallback engine
        ├── cart.js             # Business logic (discount rules, free shipping, eco-deposit)
        ├── admin.js            # Kitchen dashboard & order status manager
        └── app.js              # Application coordinator, modals & event handling
```
