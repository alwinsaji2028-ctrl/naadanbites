const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// OpenShift & Kubernetes Liveness & Readiness Probes
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`
  });
});

app.get('/readyz', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: 'homelybites-store',
    version: '1.0.0'
  });
});

// Environment config endpoint (safely exposes public Firebase client config if provided in OpenShift Secret/ConfigMap)
app.get('/api/config', (req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
    },
    clusterInfo: {
      environment: process.env.NODE_ENV || 'production',
      deployedOn: process.env.OPENSHIFT_BUILD_NAME || 'OpenShift Container Platform'
    }
  });
});

// In-Memory store as server-side persistence fallback
let ordersDb = [];

// Orders API
app.get('/api/orders', (req, res) => {
  res.json({ success: true, count: ordersDb.length, orders: ordersDb });
});

app.get('/api/orders/:id', (req, res) => {
  const order = ordersDb.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  res.json({ success: true, order });
});

app.post('/api/orders', (req, res) => {
  const { customer, items, pricing, delivery, notes, paymentMethod } = req.body;
  if (!items || !items.length || !customer || !customer.name || !customer.phone) {
    return res.status(400).json({ success: false, message: 'Missing required order details' });
  }

  const orderId = `HB-${Math.floor(100000 + Math.random() * 900000)}`;
  const newOrder = {
    id: orderId,
    customer,
    items,
    pricing,
    delivery,
    notes: notes || '',
    paymentMethod: paymentMethod || 'Cash on Delivery',
    paymentStatus: paymentMethod === 'Online / UPI' ? 'Paid' : 'Pending on Delivery',
    status: 'Received', // Received -> Kitchen Preparation -> Quality Packed -> Out for Delivery -> Delivered
    createdAt: new Date().toISOString(),
    statusHistory: [
      { status: 'Received', timestamp: new Date().toISOString(), message: 'Order received by the kitchen' }
    ]
  };

  ordersDb.unshift(newOrder);
  // Keep last 100 orders in memory
  if (ordersDb.length > 100) ordersDb.pop();

  res.status(201).json({ success: true, order: newOrder });
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { status, message } = req.body;
  const order = ordersDb.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const validStatuses = ['Received', 'Kitchen Preparation', 'Quality Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  order.status = status;
  order.statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    message: message || `Order status updated to ${status}`
  });

  res.json({ success: true, order });
});

// Serve frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(` Homemade Food Store Server (HomelyBites)`);
  console.log(` Running on: http://${HOST}:${PORT}`);
  console.log(` Health Probe: http://${HOST}:${PORT}/healthz`);
  console.log(` Ready Probe:  http://${HOST}:${PORT}/readyz`);
  console.log(`===============================================`);
});

