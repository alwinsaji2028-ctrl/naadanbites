// HomelyBites - Main Application Controller

window.appProducts = [...INITIAL_PRODUCTS];

class App {
  constructor() {
    this.currentCategory = 'all';
    this.currentDietary = 'all';
    this.searchQuery = '';
    this.sortBy = 'featured';
    this.init();
  }

  async init() {
    // Load custom products if any
    try {
      const custom = localStorage.getItem('homelybites_custom_products');
      if (custom) {
        const parsed = JSON.parse(custom);
        window.appProducts = [...parsed, ...INITIAL_PRODUCTS];
      }
    } catch (e) {}

    // Init Firebase
    await window.firebaseService.init();

    // Event Listeners
    this.setupEventListeners();

    // Render initial catalog
    this.renderProducts();
    this.updateCartUI();

    // Check URL parameters for direct order tracking (e.g. ?track=HB-123456)
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('track');
    if (trackId) {
      this.openTrackOrderModal(trackId);
    }
  }

  setupEventListeners() {
    // Listen to cart updates
    window.addEventListener('cart-updated', () => this.updateCartUI());

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderProducts();
      });
    }

    // Category buttons
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentCategory = e.currentTarget.dataset.category;
        this.renderProducts();
      });
    });

    // Dietary filter pills
    document.querySelectorAll('.dietary-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dietary-pill').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentDietary = e.currentTarget.dataset.diet;
        this.renderProducts();
      });
    });

    // Sort Dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderProducts();
      });
    }

    // Eco-jar checkbox
    const ecoCheckbox = document.getElementById('eco-jar-checkbox');
    if (ecoCheckbox) {
      ecoCheckbox.addEventListener('change', (e) => {
        window.cart.toggleEcoJar(e.target.checked);
      });
    }

    // Payment method selector in checkout
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const upiBox = document.getElementById('upi-payment-details');
        if (upiBox) {
          upiBox.style.display = e.target.value === 'Online / UPI' ? 'block' : 'none';
        }
      });
    });
  }

  getFilteredProducts() {
    let list = [...window.appProducts];

    // Filter by Category
    if (this.currentCategory !== 'all') {
      list = list.filter(p => p.category === this.currentCategory);
    }

    // Filter by Dietary preference
    if (this.currentDietary !== 'all') {
      list = list.filter(p => p.dietary && p.dietary.includes(this.currentDietary));
    }

    // Filter by Search Query
    if (this.searchQuery) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(this.searchQuery) ||
        p.description.toLowerCase().includes(this.searchQuery) ||
        (p.homeChef && p.homeChef.toLowerCase().includes(this.searchQuery)) ||
        (p.ingredients && p.ingredients.some(ing => ing.toLowerCase().includes(this.searchQuery)))
      );
    }

    // Sort
    if (this.sortBy === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }

  renderProducts() {
    const grid = document.getElementById('products-grid');
    const countEl = document.getElementById('results-count');
    if (!grid) return;

    const products = this.getFilteredProducts();
    if (countEl) countEl.textContent = `${products.length} homemade treats found`;

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="no-products-state">
          <div class="empty-emoji">🍲</div>
          <h3>No homemade dishes matched your search</h3>
          <p>Try searching for mango pickle, nankhatai, spices, or clear your filters.</p>
          <button class="btn btn-secondary" onclick="window.app.resetFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => {
      const isLowStock = product.stock <= 5;
      return `
        <article class="product-card" id="card-${product.id}">
          <div class="product-image-container">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'" />
            <div class="badge-overlay">
              ${product.batchInfo ? `<span class="badge fresh-badge">🌱 ${product.batchInfo}</span>` : ''}
              ${isLowStock ? `<span class="badge urgency-badge">⚡ Only ${product.stock} left!</span>` : ''}
            </div>
            <button class="quick-view-btn" onclick="window.app.showProductDetails('${product.id}')" title="View Ingredients & Nutrition">🔍 Details</button>
          </div>

          <div class="product-body">
            <div class="product-meta">
              <span class="chef-credit">👩‍🍳 By ${escapeHtml(product.homeChef || 'Local Home Chef')}</span>
              <span class="rating-star">★ ${product.rating} <small>(${product.reviewsCount})</small></span>
            </div>

            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            <p class="product-tagline">${escapeHtml(product.tagline || product.description.substring(0, 65) + '...')}</p>

            <div class="dietary-tags-list">
              ${(product.dietary || []).slice(0, 3).map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
            </div>

            <div class="weight-selector-row">
              <label>Pack Size:</label>
              <select id="weight-select-${product.id}" class="weight-dropdown">
                ${(product.weightOptions || ['Standard']).map(opt => `
                  <option value="${opt}" ${opt === product.selectedWeight ? 'selected' : ''}>${opt}</option>
                `).join('')}
              </select>
            </div>

            <div class="product-card-footer">
              <div class="price-box">
                <span class="current-price">₹${product.price}</span>
                ${product.originalPrice ? `<span class="original-price">₹${product.originalPrice}</span>` : ''}
              </div>
              <button class="btn btn-primary add-to-cart-btn" onclick="window.app.handleAddToCart('${product.id}')">
                <span class="btn-icon">🛒</span> Add to Basket
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  handleAddToCart(productId) {
    const product = window.appProducts.find(p => p.id === productId);
    if (!product) return;

    const selectEl = document.getElementById(`weight-select-${productId}`);
    const selectedWeight = selectEl ? selectEl.value : null;

    const res = window.cart.addItem(product, selectedWeight);
    if (res.success) {
      showToast(res.message, 'success');
      // Visual feedback on card
      const card = document.getElementById(`card-${productId}`);
      if (card) {
        card.classList.add('item-added-animation');
        setTimeout(() => card.classList.remove('item-added-animation'), 600);
      }
    } else {
      showToast(res.message, 'warning');
    }
  }

  updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const drawerList = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const deliveryEl = document.getElementById('cart-delivery');
    const ecoEl = document.getElementById('cart-eco-deposit');
    const totalEl = document.getElementById('cart-total');
    const emptyState = document.getElementById('cart-empty-state');
    const filledState = document.getElementById('cart-filled-state');
    const progressFill = document.getElementById('free-shipping-progress');
    const progressText = document.getElementById('free-shipping-text');

    const count = window.cart.getCount();
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if (!drawerList) return;

    if (count === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (filledState) filledState.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (filledState) filledState.style.display = 'block';

    // Free delivery progress
    const progress = window.cart.getProgressToFreeDelivery();
    if (progressFill && progressText) {
      progressFill.style.width = `${progress.percent}%`;
      if (progress.isFree) {
        progressText.innerHTML = `🎉 <strong>Congratulations!</strong> You unlocked FREE Home Delivery!`;
        progressFill.classList.add('unlocked');
      } else {
        progressText.innerHTML = `Add <strong>₹${progress.needed}</strong> more homemade treats for <strong>FREE Delivery</strong>`;
        progressFill.classList.remove('unlocked');
      }
    }

    // Render Cart Items
    drawerList.innerHTML = window.cart.items.map((item, idx) => `
      <div class="cart-item-row">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" class="cart-item-thumb" />
        <div class="cart-item-info">
          <h4>${escapeHtml(item.name)}</h4>
          <span class="cart-item-weight">📦 Size: ${item.weight}</span>
          <div class="cart-item-price">₹${item.price} each</div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-control">
            <button class="qty-btn" onclick="window.cart.updateQuantity(${idx}, ${item.quantity - 1})">-</button>
            <span class="qty-num">${item.quantity}</span>
            <button class="qty-btn" onclick="window.cart.updateQuantity(${idx}, ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-btn" onclick="window.cart.removeItem(${idx})" title="Remove item">🗑️</button>
          <div class="cart-row-total">₹${item.price * item.quantity}</div>
        </div>
      </div>
    `).join('');

    // Summary totals
    if (subtotalEl) subtotalEl.textContent = `₹${window.cart.getSubtotal()}`;
    if (discountEl) discountEl.textContent = `-₹${window.cart.getDiscount()}`;
    if (deliveryEl) deliveryEl.textContent = window.cart.getDeliveryFee() === 0 ? 'FREE' : `₹${window.cart.getDeliveryFee()}`;
    if (ecoEl) ecoEl.textContent = `₹${window.cart.getEcoDeposit()}`;
    if (totalEl) totalEl.textContent = `₹${window.cart.getTotal()}`;

    // Coupon pill UI
    const couponRow = document.getElementById('applied-coupon-row');
    const couponName = document.getElementById('applied-coupon-name');
    if (couponRow && couponName) {
      if (window.cart.coupon) {
        couponRow.style.display = 'flex';
        couponName.textContent = `${window.cart.coupon.code} (${window.cart.coupon.label})`;
      } else {
        couponRow.style.display = 'none';
      }
    }
  }

  showProductDetails(productId) {
    const product = window.appProducts.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('product-detail-modal');
    const body = document.getElementById('product-detail-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="product-modal-grid">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" class="modal-product-img" />
        <div class="modal-product-content">
          <span class="modal-chef-badge">👩‍🍳 Master Home Chef: ${escapeHtml(product.homeChef || 'Certified Kitchen')}</span>
          <h2>${escapeHtml(product.name)}</h2>
          <p class="modal-description">${escapeHtml(product.description)}</p>

          <div class="modal-section">
            <h4>🌿 Pure Homemade Ingredients:</h4>
            <div class="ingredients-tags">
              ${(product.ingredients || []).map(ing => `<span class="ingredient-badge">✓ ${escapeHtml(ing)}</span>`).join('')}
            </div>
          </div>

          ${product.allergens && product.allergens.length ? `
            <div class="modal-section allergen-box">
              <strong>⚠️ Allergen Notice:</strong> Contains ${product.allergens.join(', ')}
            </div>
          ` : ''}

          <div class="modal-section purity-guarantee">
            <h4>🍯 The HomelyBites Quality Pledge:</h4>
            <ul>
              <li>100% Free of artificial coloring, taste enhancers (MSG), and chemical preservatives.</li>
              <li>Hand-ground spices on traditional stone mills to protect natural volatile oils.</li>
              <li>Packed fresh in sanitized, food-grade airtight glass jars.</li>
            </ul>
          </div>

          <div class="modal-cta-row">
            <div class="price-large">₹${product.price}</div>
            <button class="btn btn-primary btn-large" onclick="window.app.handleAddToCart('${product.id}'); window.app.closeModal('product-detail-modal');">
              🛒 Add to My Basket
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  applyCouponCode() {
    const input = document.getElementById('coupon-input');
    if (!input) return;
    const res = window.cart.applyCoupon(input.value);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) input.value = '';
  }

  removeCouponCode() {
    window.cart.removeCoupon();
    showToast('Coupon removed', 'info');
  }

  openCheckoutModal() {
    if (window.cart.items.length === 0) {
      showToast('Your basket is empty! Add homemade delicacies first.', 'warning');
      return;
    }
    this.closeCartDrawer();
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      document.getElementById('checkout-modal-total').textContent = `₹${window.cart.getTotal()}`;
      modal.classList.add('open');
    }
  }

  async submitOrder(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById('place-order-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Placing Homemade Order...';
    }

    const orderData = {
      customer: {
        name: form.customerName.value.trim(),
        phone: form.customerPhone.value.trim(),
        email: form.customerEmail.value.trim()
      },
      delivery: {
        address: form.customerAddress.value.trim(),
        landmark: form.customerLandmark.value.trim() || '',
        city: form.customerCity.value.trim(),
        pincode: form.customerPincode.value.trim(),
        deliveryDate: form.deliveryDate.value || new Date().toISOString().split('T')[0],
        timeSlot: form.deliverySlot.value
      },
      items: [...window.cart.items],
      pricing: {
        subtotal: window.cart.getSubtotal(),
        discount: window.cart.getDiscount(),
        deliveryFee: window.cart.getDeliveryFee(),
        ecoDeposit: window.cart.getEcoDeposit(),
        total: window.cart.getTotal(),
        coupon: window.cart.coupon ? window.cart.coupon.code : null
      },
      notes: form.customerNotes.value.trim(),
      paymentMethod: form.paymentMethod.value
    };

    try {
      const savedOrder = await window.firebaseService.saveOrder(orderData);
      window.cart.clear();
      this.closeModal('checkout-modal');
      this.showOrderConfirmation(savedOrder);
      showToast(`Order #${savedOrder.id} successfully placed!`, 'success');
    } catch (err) {
      console.error('Order submission failed:', err);
      showToast(`Failed to place order: ${err.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✨ Confirm & Place Homemade Order';
      }
    }
  }

  showOrderConfirmation(order) {
    const modal = document.getElementById('order-confirmation-modal');
    const container = document.getElementById('order-confirmation-content');
    if (!modal || !container) return;

    container.innerHTML = `
      <div class="order-success-card">
        <div class="success-icon">🎉</div>
        <h2>Thank You, ${escapeHtml(order.customer.name)}!</h2>
        <p class="success-subtitle">Our home chefs have received your order and are preparing it with love.</p>
        
        <div class="order-id-highlight">
          <span>Your Tracking Order ID:</span>
          <strong>${order.id}</strong>
        </div>

        <div class="order-summary-box">
          <div class="order-summary-row">
            <span>Estimated Delivery:</span>
            <strong>${order.delivery.deliveryDate} (${order.delivery.timeSlot})</strong>
          </div>
          <div class="order-summary-row">
            <span>Deliver To:</span>
            <span>${escapeHtml(order.delivery.address)}, ${escapeHtml(order.delivery.city)}</span>
          </div>
          <div class="order-summary-row">
            <span>Payment Mode:</span>
            <strong>${order.paymentMethod} (₹${order.pricing.total})</strong>
          </div>
        </div>

        <div class="order-items-mini-list">
          <h4>Items Ordered:</h4>
          ${order.items.map(item => `
            <div class="mini-item-row">
              <span>${item.quantity}x ${escapeHtml(item.name)} (${item.weight})</span>
              <span>₹${item.price * item.quantity}</span>
            </div>
          `).join('')}
        </div>

        <div class="action-buttons-group">
          <button class="btn btn-primary" onclick="window.app.openTrackOrderModal('${order.id}')">
            📍 Track Live Status
          </button>
          <button class="btn btn-secondary" onclick="window.app.closeModal('order-confirmation-modal')">
            Back to Store
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
  }

  async openTrackOrderModal(prefillOrderId = '') {
    const modal = document.getElementById('track-order-modal');
    if (!modal) return;
    this.closeModal('order-confirmation-modal');
    modal.classList.add('open');

    if (prefillOrderId) {
      const input = document.getElementById('track-order-input');
      if (input) {
        input.value = prefillOrderId;
        this.trackOrderById(prefillOrderId);
      }
    }
  }

  async trackOrderById(orderId = null) {
    const input = document.getElementById('track-order-input');
    const id = (orderId || (input ? input.value : '')).trim();
    const resultBox = document.getElementById('track-order-result');

    if (!id) {
      showToast('Please enter an Order ID (e.g. HB-892412)', 'error');
      return;
    }

    if (resultBox) {
      resultBox.innerHTML = '<div class="loader-spinner"></div><p style="text-align:center;">Looking up kitchen tracker...</p>';
    }

    try {
      const orders = await window.firebaseService.getOrders();
      const order = orders.find(o => o.id.toLowerCase() === id.toLowerCase());

      if (!order) {
        resultBox.innerHTML = `
          <div class="not-found-tracker">
            <span class="warning-icon">🔍</span>
            <h4>Order "${escapeHtml(id)}" Not Found</h4>
            <p>Please double-check the Order ID from your confirmation screen.</p>
          </div>
        `;
        return;
      }

      const stages = [
        { key: 'Received', label: 'Order Received', desc: 'Home kitchen confirmed' },
        { key: 'Kitchen Preparation', label: 'Cooking with Love', desc: 'Artisanal ingredients cooking' },
        { key: 'Quality Packed', label: 'Sterilized Packaging', desc: 'Airtight glass jars sealed' },
        { key: 'Out for Delivery', label: 'Out for Delivery', desc: 'On its way to your doorstep' },
        { key: 'Delivered', label: 'Delivered', desc: 'Enjoy authentic home food!' }
      ];

      const currentStageIndex = stages.findIndex(s => s.key === order.status);
      const activeIdx = currentStageIndex >= 0 ? currentStageIndex : 0;

      resultBox.innerHTML = `
        <div class="tracker-card">
          <div class="tracker-header">
            <div>
              <h3>Order ${order.id}</h3>
              <p>Placed on ${new Date(order.createdAt).toLocaleDateString()} at ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div class="tracker-badge-status">${order.status}</div>
          </div>

          <div class="stepper-track">
            ${stages.map((stage, idx) => {
              const isDone = idx <= activeIdx;
              const isCurrent = idx === activeIdx;
              return `
                <div class="step-item ${isDone ? 'completed' : ''} ${isCurrent ? 'active-pulse' : ''}">
                  <div class="step-circle">${isDone ? '✓' : idx + 1}</div>
                  <div class="step-label">
                    <strong>${stage.label}</strong>
                    <small>${stage.desc}</small>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="tracker-details-grid">
            <div>
              <strong>Delivery Slot:</strong>
              <div>${order.delivery.deliveryDate} (${order.delivery.timeSlot})</div>
            </div>
            <div>
              <strong>Destination:</strong>
              <div>${escapeHtml(order.delivery.address)}, ${escapeHtml(order.delivery.city)}</div>
            </div>
            <div>
              <strong>Amount:</strong>
              <div>₹${order.pricing.total} (${order.paymentMethod})</div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      resultBox.innerHTML = `<p class="error-msg">Error retrieving order: ${e.message}</p>`;
    }
  }

  // Modals & Drawers
  toggleCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer && overlay) {
      drawer.classList.toggle('open');
      overlay.classList.toggle('open');
    }
  }

  closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('open');
  }

  resetFilters() {
    this.currentCategory = 'all';
    this.currentDietary = 'all';
    this.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.category === 'all'));
    document.querySelectorAll('.dietary-pill').forEach(b => b.classList.toggle('active', b.dataset.diet === 'all'));
    this.renderProducts();
  }

  // Firebase Configuration Modal
  openFirebaseModal() {
    const modal = document.getElementById('firebase-modal');
    if (!modal) return;

    const saved = localStorage.getItem('homelybites_firebase_config');
    if (saved) {
      try {
        const c = JSON.parse(saved);
        document.getElementById('fb-api-key').value = c.apiKey || '';
        document.getElementById('fb-auth-domain').value = c.authDomain || '';
        document.getElementById('fb-project-id').value = c.projectId || '';
        document.getElementById('fb-storage-bucket').value = c.storageBucket || '';
        document.getElementById('fb-messaging-sender-id').value = c.messagingSenderId || '';
        document.getElementById('fb-app-id').value = c.appId || '';
      } catch (e) {}
    }

    modal.classList.add('open');
  }

  async saveFirebaseConfig(event) {
    event.preventDefault();
    const btn = document.getElementById('connect-fb-btn');
    btn.disabled = true;
    btn.innerHTML = 'Testing Connection...';

    const config = {
      apiKey: document.getElementById('fb-api-key').value.trim(),
      authDomain: document.getElementById('fb-auth-domain').value.trim(),
      projectId: document.getElementById('fb-project-id').value.trim(),
      storageBucket: document.getElementById('fb-storage-bucket').value.trim(),
      messagingSenderId: document.getElementById('fb-messaging-sender-id').value.trim(),
      appId: document.getElementById('fb-app-id').value.trim()
    };

    try {
      await window.firebaseService.connectFirebase(config);
      showToast('🎉 Connected to Google Firebase Cloud Firestore successfully!', 'success');
      this.closeModal('firebase-modal');
    } catch (err) {
      showToast(`Firebase error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save & Connect to Firebase';
    }
  }

  disconnectFirebase() {
    window.firebaseService.disconnect();
    showToast('Switched back to Instant Demo Database mode', 'info');
    this.closeModal('firebase-modal');
  }
}

// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

window.app = new App();

