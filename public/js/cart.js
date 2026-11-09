// HomelyBites - Shopping Cart & Business Logic Engine

class ShoppingCart {
  constructor() {
    this.items = [];
    this.coupon = null;
    this.includeEcoJarDeposit = true;
    this.ecoJarDepositFee = 30; // ₹30 refundable glass jar deposit
    this.freeDeliveryThreshold = 499; // Free delivery above ₹499
    this.baseDeliveryFee = 40;
    this.storageKey = 'homelybites_cart';
    this.loadCart();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(this.storageKey);
      this.items = data ? JSON.parse(data) : [];
    } catch (e) {
      this.items = [];
    }
    this.notifyUpdate();
  }

  saveCart() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    this.notifyUpdate();
  }

  addItem(product, selectedWeight = null) {
    const weight = selectedWeight || product.selectedWeight || (product.weightOptions ? product.weightOptions[0] : 'Standard');
    const existingIndex = this.items.findIndex(
      item => item.id === product.id && item.weight === weight
    );

    if (existingIndex > -1) {
      // Check stock limit
      if (this.items[existingIndex].quantity < (product.stock || 20)) {
        this.items[existingIndex].quantity += 1;
      } else {
        return { success: false, message: `Only ${product.stock} units available for this fresh batch.` };
      }
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
        weight: weight,
        quantity: 1,
        stock: product.stock || 20,
        homeChef: product.homeChef
      });
    }

    this.saveCart();
    return { success: true, message: `Added "${product.name}" to your basket!` };
  }

  updateQuantity(index, newQty) {
    if (index >= 0 && index < this.items.length) {
      if (newQty <= 0) {
        this.removeItem(index);
      } else {
        const item = this.items[index];
        if (newQty <= item.stock) {
          item.quantity = newQty;
          this.saveCart();
        } else {
          return { success: false, message: `Maximum available batch quantity is ${item.stock}.` };
        }
      }
    }
    return { success: true };
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.saveCart();
    }
  }

  clear() {
    this.items = [];
    this.coupon = null;
    this.saveCart();
  }

  toggleEcoJar(enabled) {
    this.includeEcoJarDeposit = enabled;
    this.notifyUpdate();
  }

  applyCoupon(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      this.coupon = null;
      this.notifyUpdate();
      return { success: false, message: 'Please enter a coupon code' };
    }

    const validCoupons = {
      'HOMEMADE10': { type: 'percent', value: 10, label: '10% Off Home Chefs Special' },
      'FIRSTBITE': { type: 'flat', value: 50, minOrder: 300, label: '₹50 Off First Bite' },
      'FREESHIP': { type: 'free_delivery', value: 0, label: 'Free Delivery Anywhere' }
    };

    if (validCoupons[cleanCode]) {
      const c = validCoupons[cleanCode];
      const subtotal = this.getSubtotal();
      if (c.minOrder && subtotal < c.minOrder) {
        return { success: false, message: `Coupon requires minimum order of ₹${c.minOrder}` };
      }
      this.coupon = { code: cleanCode, ...c };
      this.notifyUpdate();
      return { success: true, message: `Coupon ${cleanCode} applied! ${c.label}` };
    } else {
      return { success: false, message: 'Invalid coupon code. Try HOMEMADE10 or FIRSTBITE' };
    }
  }

  removeCoupon() {
    this.coupon = null;
    this.notifyUpdate();
  }

  getCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  getDeliveryFee() {
    if (this.items.length === 0) return 0;
    if (this.coupon && this.coupon.type === 'free_delivery') return 0;
    return this.getSubtotal() >= this.freeDeliveryThreshold ? 0 : this.baseDeliveryFee;
  }

  getDiscount() {
    const subtotal = this.getSubtotal();
    if (!this.coupon || subtotal === 0) return 0;

    if (this.coupon.type === 'percent') {
      return Math.round((subtotal * this.coupon.value) / 100);
    }
    if (this.coupon.type === 'flat') {
      return Math.min(this.coupon.value, subtotal);
    }
    return 0;
  }

  getEcoDeposit() {
    return (this.includeEcoJarDeposit && this.items.length > 0) ? this.ecoJarDepositFee : 0;
  }

  getTotal() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    const discount = this.getDiscount();
    const delivery = this.getDeliveryFee();
    const ecoDeposit = this.getEcoDeposit();
    return Math.max(0, subtotal - discount + delivery + ecoDeposit);
  }

  getProgressToFreeDelivery() {
    const subtotal = this.getSubtotal();
    const needed = Math.max(0, this.freeDeliveryThreshold - subtotal);
    const percent = Math.min(100, Math.round((subtotal / this.freeDeliveryThreshold) * 100));
    return { subtotal, needed, percent, isFree: subtotal >= this.freeDeliveryThreshold };
  }

  notifyUpdate() {
    const event = new CustomEvent('cart-updated', {
      detail: {
        items: this.items,
        count: this.getCount(),
        subtotal: this.getSubtotal(),
        discount: this.getDiscount(),
        deliveryFee: this.getDeliveryFee(),
        ecoDeposit: this.getEcoDeposit(),
        total: this.getTotal(),
        coupon: this.coupon,
        progress: this.getProgressToFreeDelivery()
      }
    });
    window.dispatchEvent(event);
  }
}

window.cart = new ShoppingCart();
