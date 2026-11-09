// HomelyBites - Firebase Integration Module
// Supports both live Firebase Cloud Firestore and graceful zero-config offline/demo mode

class FirebaseService {
  constructor() {
    this.isConfigured = false;
    this.db = null;
    this.app = null;
    this.ordersCollection = 'homelybites_orders';
    this.productsCollection = 'homelybites_products';
    this.storageKey = 'homelybites_local_db';
    this.configStorageKey = 'homelybites_firebase_config';
  }

  async init() {
    // 1. Try loading config from backend API (/api/config)
    let config = null;
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.firebase && data.firebase.apiKey && data.firebase.projectId) {
          config = data.firebase;
        }
      }
    } catch (e) {
      console.warn('Could not fetch server config, checking localStorage...', e);
    }

    // 2. If not found in server env, check localStorage
    if (!config) {
      const saved = localStorage.getItem(this.configStorageKey);
      if (saved) {
        try {
          config = JSON.parse(saved);
        } catch (e) {
          console.error('Invalid saved firebase config', e);
        }
      }
    }

    if (config && config.apiKey && config.projectId) {
      return this.connectFirebase(config);
    } else {
      console.log('⚡ HomelyBites running in Instant Demo Mode (localStorage + REST backend). You can connect Firebase anytime from settings.');
      this.isConfigured = false;
      this.updateStatusBadge();
      return false;
    }
  }

  async connectFirebase(config) {
    try {
      // Load Firebase SDK dynamically if not loaded
      if (!window.firebase) {
        await this.loadFirebaseScripts();
      }

      if (!window.firebase.apps.length) {
        this.app = window.firebase.initializeApp(config);
      } else {
        this.app = window.firebase.app();
      }

      this.db = window.firebase.firestore();
      this.isConfigured = true;
      localStorage.setItem(this.configStorageKey, JSON.stringify(config));
      this.updateStatusBadge();
      console.log('✅ Firebase Cloud Firestore connected successfully for project:', config.projectId);
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      this.isConfigured = false;
      this.updateStatusBadge();
      throw error;
    }
  }

  loadFirebaseScripts() {
    return new Promise((resolve, reject) => {
      const appScript = document.createElement('script');
      appScript.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js';
      appScript.onload = () => {
        const firestoreScript = document.createElement('script');
        firestoreScript.src = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js';
        firestoreScript.onload = resolve;
        firestoreScript.onerror = reject;
        document.head.appendChild(firestoreScript);
      };
      appScript.onerror = reject;
      document.head.appendChild(appScript);
    });
  }

  disconnect() {
    localStorage.removeItem(this.configStorageKey);
    this.isConfigured = false;
    this.db = null;
    this.updateStatusBadge();
  }

  // Save new order to Firebase (or fallback to local / backend API)
  async saveOrder(order) {
    if (this.isConfigured && this.db) {
      try {
        await this.db.collection(this.ordersCollection).doc(order.id).set({
          ...order,
          savedToFirestoreAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Order synced to Firebase Firestore:', order.id);
      } catch (err) {
        console.error('Firebase save error, falling back to local:', err);
      }
    }

    // Always also notify backend REST API for persistence
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch (e) {
      console.warn('Server offline, saving locally in browser', e);
    }

    // Save to localStorage
    const localOrders = this.getLocalOrders();
    localOrders.unshift(order);
    localStorage.setItem('homelybites_orders', JSON.stringify(localOrders.slice(0, 50)));

    return order;
  }

  // Fetch orders
  async getOrders() {
    if (this.isConfigured && this.db) {
      try {
        const snapshot = await this.db.collection(this.ordersCollection).orderBy('createdAt', 'desc').limit(50).get();
        const orders = [];
        snapshot.forEach(doc => orders.push(doc.data()));
        if (orders.length > 0) return orders;
      } catch (err) {
        console.warn('Error reading from Firebase, falling back to local:', err);
      }
    }

    // Fallback: try server API
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.orders && data.orders.length > 0) return data.orders;
      }
    } catch (e) {
      // fallback to local storage
    }

    return this.getLocalOrders();
  }

  // Update order status
  async updateOrderStatus(orderId, newStatus) {
    if (this.isConfigured && this.db) {
      try {
        await this.db.collection(this.ordersCollection).doc(orderId).update({
          status: newStatus,
          lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error('Failed to update status in Firebase', e);
      }
    }

    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {}

    // Update in local storage
    const local = this.getLocalOrders();
    const item = local.find(o => o.id === orderId);
    if (item) {
      item.status = newStatus;
      localStorage.setItem('homelybites_orders', JSON.stringify(local));
    }
  }

  getLocalOrders() {
    try {
      const raw = localStorage.getItem('homelybites_orders');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  updateStatusBadge() {
    const badge = document.getElementById('firebase-status-badge');
    const dot = document.getElementById('firebase-status-dot');
    const text = document.getElementById('firebase-status-text');
    if (!badge || !dot || !text) return;

    if (this.isConfigured) {
      dot.className = 'status-dot online';
      text.textContent = 'Firebase Connected';
      badge.classList.add('connected');
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Demo Mode (Local DB)';
      badge.classList.remove('connected');
    }
  }
}

window.firebaseService = new FirebaseService();
