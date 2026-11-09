// HomelyBites - Kitchen Admin & Order Manager

class AdminManager {
  constructor() {
    this.orders = [];
  }

  async loadOrders() {
    const ordersContainer = document.getElementById('admin-orders-list');
    if (!ordersContainer) return;

    ordersContainer.innerHTML = '<div class="loader-spinner"></div><p style="text-align:center;">Fetching fresh orders...</p>';

    try {
      this.orders = await window.firebaseService.getOrders();
      this.renderOrders();
    } catch (err) {
      ordersContainer.innerHTML = `<p class="error-msg">Error loading orders: ${err.message}</p>`;
    }
  }

  renderOrders() {
    const container = document.getElementById('admin-orders-list');
    if (!container) return;

    if (!this.orders || this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🍳</span>
          <h3>No Orders Yet</h3>
          <p>When hungry customers place orders for homemade goodies, they will show up here in real-time!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.orders.map(order => `
      <div class="admin-order-card" data-order-id="${order.id}">
        <div class="admin-order-header">
          <div>
            <span class="order-id-badge">${order.id}</span>
            <span class="order-time">${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="status-selector-wrapper">
            <select class="admin-status-dropdown" onchange="window.adminManager.changeStatus('${order.id}', this.value)">
              <option value="Received" ${order.status === 'Received' ? 'selected' : ''}>⏳ Received</option>
              <option value="Kitchen Preparation" ${order.status === 'Kitchen Preparation' ? 'selected' : ''}>🍳 Cooking / Baking</option>
              <option value="Quality Packed" ${order.status === 'Quality Packed' ? 'selected' : ''}>📦 Quality Packed</option>
              <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>🛵 Out for Delivery</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>✅ Delivered</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
            </select>
          </div>
        </div>

        <div class="admin-order-customer">
          <strong>👤 ${escapeHtml(order.customer.name)}</strong> (${escapeHtml(order.customer.phone)})
          <div class="delivery-address">📍 ${escapeHtml(order.delivery.address)}, ${escapeHtml(order.delivery.city)} - ${escapeHtml(order.delivery.pincode)}</div>
          ${order.delivery.timeSlot ? `<div class="slot-badge">⏰ Slot: ${escapeHtml(order.delivery.timeSlot)}</div>` : ''}
          ${order.notes ? `<div class="chef-note-box">📝 Customer Note: "${escapeHtml(order.notes)}"</div>` : ''}
        </div>

        <div class="admin-order-items">
          ${order.items.map(item => `
            <div class="admin-order-item-row">
              <span><strong>${item.quantity}x</strong> ${escapeHtml(item.name)} <small>(${item.weight})</small></span>
              <span>₹${item.price * item.quantity}</span>
            </div>
          `).join('')}
        </div>

        <div class="admin-order-footer">
          <div>Payment: <strong>${order.paymentMethod}</strong> (${order.paymentStatus})</div>
          <div class="order-total-sum">Total: ₹${order.pricing.total}</div>
        </div>
      </div>
    `).join('');
  }

  async changeStatus(orderId, newStatus) {
    try {
      await window.firebaseService.updateOrderStatus(orderId, newStatus);
      const order = this.orders.find(o => o.id === orderId);
      if (order) order.status = newStatus;
      showToast(`Order ${orderId} moved to "${newStatus}"!`, 'success');
    } catch (e) {
      showToast(`Failed to update status: ${e.message}`, 'error');
    }
  }

  addNewProduct(form) {
    const name = form.productName.value.trim();
    const category = form.productCategory.value;
    const price = parseInt(form.productPrice.value, 10);
    const weight = form.productWeight.value.trim();
    const description = form.productDesc.value.trim();
    const chef = form.productChef.value.trim() || 'Master Home Chef';
    const image = form.productImage.value.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
    const ingredients = form.productIngredients.value.split(',').map(s => s.trim()).filter(Boolean);

    if (!name || !price) {
      showToast('Please provide a product name and price', 'error');
      return;
    }

    const newProduct = {
      id: `hb-custom-${Date.now()}`,
      name,
      category,
      price,
      originalPrice: Math.round(price * 1.15),
      weightOptions: [weight || 'Standard Pack'],
      selectedWeight: weight || 'Standard Pack',
      tagline: 'Artisanal kitchen creation',
      description,
      image,
      rating: 5.0,
      reviewsCount: 1,
      dietary: ['Vegetarian', 'Freshly Handcrafted'],
      stock: 15,
      batchInfo: 'Prepared today in small batch',
      ingredients: ingredients.length ? ingredients : ['Natural spices and home ingredients'],
      allergens: [],
      homeChef: chef
    };

    // Save to window.products and localStorage
    window.appProducts.unshift(newProduct);
    localStorage.setItem('homelybites_custom_products', JSON.stringify(
      window.appProducts.filter(p => p.id.startsWith('hb-custom-'))
    ));

    window.app.renderProducts();
    form.reset();
    showToast(`Added "${name}" to the live store!`, 'success');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.adminManager = new AdminManager();
