/**
 * VELOCEES DE SCENT 🖤 — Core E-Commerce Logic & JSON Store
 * Zero-Database JSON Persistence (localStorage + products.json seed)
 * Complete Admin/User Switcher & Interactive Cart System
 */

(function () {
  'use strict';

  // --- STATE ---
  let products = [];
  let cart = [];
  let wishlist = new Set();
  let currentCategory = 'all';
  let currentSort = 'featured';
  let searchQuery = '';
  let isAdminMode = false;
  let activeCoupon = null;

  // Pre-configured coupons
  const COUPONS = {
    'LUXE15': { discountPercent: 15, description: '15% Off Your Entire Order' },
    'VDLOVE': { discountFlat: 200, minCart: 999, description: '₹200 Off Orders above ₹999' },
    'FIRST10': { discountPercent: 10, description: '10% Off First Purchase' }
  };

  // --- DOM ELEMENTS ---
  const productsGrid = document.getElementById('productsGrid');
  const categoryPills = document.querySelectorAll('.pill-btn');
  const sortSelect = document.getElementById('sortSelect');
  const searchInput = document.getElementById('searchInput');
  const cartToggleBtn = document.getElementById('cartToggleBtn');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const cartBadgeCount = document.getElementById('cartBadgeCount');
  const wishlistBadgeCount = document.getElementById('wishlistBadgeCount');
  const subtotalEl = document.getElementById('subtotalVal');
  const discountRow = document.getElementById('discountRow');
  const discountVal = document.getElementById('discountVal');
  const grandTotalEl = document.getElementById('grandTotalVal');
  const freeShippingText = document.getElementById('freeShippingText');
  const freeShippingFill = document.getElementById('freeShippingFill');
  const couponInput = document.getElementById('couponInput');
  const applyCouponBtn = document.getElementById('applyCouponBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');

  // Floating Mode Elements
  const floatingModeSwitch = document.getElementById('floatingModeSwitch');
  const currentModeText = document.getElementById('currentModeText');
  const adminBanner = document.getElementById('adminBanner');
  const adminAddBtn = document.getElementById('adminAddBtn');
  const adminExportBtn = document.getElementById('adminExportBtn');
  const adminResetBtn = document.getElementById('adminResetBtn');
  const adminStatsText = document.getElementById('adminStatsText');

  // Modals
  const productDetailModal = document.getElementById('productDetailModal');
  const modalDetailBody = document.getElementById('modalDetailBody');
  const adminFormModal = document.getElementById('adminFormModal');
  const adminProductForm = document.getElementById('adminProductForm');
  const adminModalTitle = document.getElementById('adminModalTitle');
  const checkoutModal = document.getElementById('checkoutModal');
  const toastMsg = document.getElementById('toastMsg');

  // --- INITIALIZATION ---
  async function init() {
    loadWishlist();
    loadCart();
    checkLoggedInUser();
    await loadProductsJSON();
    setupEventListeners();
    renderProducts();
    updateCartUI();
  }

  function checkLoggedInUser() {
    try {
      const saved = localStorage.getItem('velocees_user');
      if (saved) {
        const u = JSON.parse(saved);
        const btn = document.getElementById('accountHeaderBtn');
        if (btn && u && u.name) {
          btn.title = `VIP Account: ${u.name} (Click to manage)`;
          btn.style.borderColor = 'var(--color-gold-300)';
          btn.style.boxShadow = 'var(--glow-gold-sm)';
          btn.innerHTML = `<span style="font-size: 0.72rem; font-weight: 700; color: var(--color-gold-300);">${u.name.charAt(0).toUpperCase()}</span>`;
        }
      }
    } catch (e) {}
  }

  // --- JSON STORE LOGIC ---
  const CURRENT_STORE_VERSION = 'v3_only_real_products';

  async function loadProductsJSON() {
    const cached = localStorage.getItem('velocees_products_store');
    const version = localStorage.getItem('velocees_store_version');

    if (cached && version === CURRENT_STORE_VERSION) {
      try {
        products = JSON.parse(cached);
        console.log('Loaded products from local JSON store:', products.length);
        updateAdminStats();
        return;
      } catch (e) {
        console.error('Failed to parse cached JSON store, reloading seed...', e);
      }
    }

    // Fetch initial seed from products.json
    try {
      const res = await fetch('products.json');
      products = await res.json();
      localStorage.setItem('velocees_store_version', CURRENT_STORE_VERSION);
      saveProductsStore();
      console.log('Loaded seed products.json:', products.length);
    } catch (err) {
      console.warn('Could not fetch products.json, using fallback inline seed', err);
      products = getFallbackProducts();
      saveProductsStore();
    }
    updateAdminStats();
  }

  function switchHero(scent) {
    const img = document.getElementById('heroBottleImg');
    const title = document.getElementById('heroBottleTitle');
    const sub = document.getElementById('heroBottleSub');
    const btn = document.getElementById('heroBuyBtn');
    const btnLav = document.getElementById('heroBtnLaventra');
    const btnUn = document.getElementById('heroBtnUnspoken');

    if (scent === 'unspoken') {
      if (img) img.src = 'unspoken.jpg';
      if (title) title.textContent = 'UNSPOKEN';
      if (sub) sub.innerHTML = '50 ML &bull; Bordeaux Velvet Extrait &bull; 35% Oil';
      if (btn) btn.setAttribute('onclick', "window.velocees.addToCart('vd-unspoken', '50 ML', true);");
      if (btnLav) btnLav.classList.remove('active');
      if (btnUn) btnUn.classList.add('active');
    } else {
      if (img) img.src = 'laventra.jpg';
      if (title) title.textContent = 'LAVENTRA';
      if (sub) sub.innerHTML = '50 ML &bull; Black Velvet Extrait &bull; 35% Oil';
      if (btn) btn.setAttribute('onclick', "window.velocees.addToCart('vd-laventra', '50 ML', true);");
      if (btnLav) btnLav.classList.add('active');
      if (btnUn) btnUn.classList.remove('active');
    }
  }

  function saveProductsStore() {
    localStorage.setItem('velocees_products_store', JSON.stringify(products));
    updateAdminStats();
  }

  function updateAdminStats() {
    if (!adminStatsText) return;
    const totalInventoryValue = products.reduce((acc, p) => acc + (p.price * (p.stockCount || 20)), 0);
    adminStatsText.textContent = `Catalog: ${products.length} Fragrances | Total Stock: ${products.reduce((acc, p) => acc + (p.stockCount || 0), 0)} bottles | Inventory Value: ₹${totalInventoryValue.toLocaleString('en-IN')}`;
  }

  // --- CART MANAGEMENT ---
  function loadCart() {
    try {
      const saved = localStorage.getItem('velocees_cart');
      if (saved) cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem('velocees_cart', JSON.stringify(cart));
    updateCartUI();
  }

  function addToCart(productId, selectedSize, buyNow = false) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const size = selectedSize || product.defaultSize || '50 ML';
    const existingIndex = cart.findIndex(item => item.id === productId && item.size === size);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        size: size,
        type: product.type,
        quantity: 1
      });
    }

    saveCart();
    showToast(`Added ${product.name} (${size}) to Bag 🖤`);

    // Auto open bag on Add to Bag / Add to Cart
    if (productDetailModal && productDetailModal.classList.contains('open')) {
      closeProductDetail();
    }
    openCartDrawer();
  }

  function updateQuantity(index, delta) {
    if (!cart[index]) return;
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
      showToast('Item removed from Bag');
    }
    saveCart();
  }

  function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    showToast('Item removed from Bag');
  }

  function updateCartUI() {
    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    if (cartBadgeCount) cartBadgeCount.textContent = totalCount;
    const mobBadge = document.getElementById('mobCartBadge');
    if (mobBadge) mobBadge.textContent = totalCount;

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="cart-empty-state">
          <svg viewBox="0 0 24 24"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H7c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.66-1.34 3-3 3z"/></svg>
          <p>Your Fragrance Bag is Empty</p>
          <button class="btn-primary" onclick="window.velocees.closeCart();" style="margin: 0 auto;">Discover Scents</button>
        </div>
      `;
      subtotalEl.textContent = '₹0';
      grandTotalEl.textContent = '₹0';
      if (discountRow) discountRow.style.display = 'none';
      freeShippingFill.style.width = '0%';
      freeShippingText.innerHTML = 'Add <strong>₹999</strong> to unlock Free Discovery Vial + Express Shipping';
      return;
    }

    // Render items
    cartItemsContainer.innerHTML = cart.map((item, idx) => `
      <div class="cart-item-row">
        <div class="cart-item-img">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <div class="cart-item-size">${item.type} &bull; ${item.size}</div>
          <div class="cart-qty-control">
            <button class="qty-btn" onclick="window.velocees.updateQuantity(${idx}, -1)">&minus;</button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="window.velocees.updateQuantity(${idx}, 1)">&plus;</button>
          </div>
        </div>
        <div class="cart-item-price-side">
          <div class="cart-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
          <button class="remove-cart-btn" onclick="window.velocees.removeFromCart(${idx})">Remove</button>
        </div>
      </div>
    `).join('');

    // Totals calculation
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

    // Free delivery progress (Target ₹999)
    const target = 999;
    const progress = Math.min(100, Math.round((subtotal / target) * 100));
    freeShippingFill.style.width = `${progress}%`;
    if (subtotal >= target) {
      freeShippingText.innerHTML = '🎉 <strong>Unlocked:</strong> Free Deluxe Discovery Vial + Free Express Shipping!';
    } else {
      const remaining = target - subtotal;
      freeShippingText.innerHTML = `Add <strong>₹${remaining.toLocaleString('en-IN')}</strong> more for Free Discovery Vial + Free Shipping!`;
    }

    // Discount handling
    let discount = 0;
    if (activeCoupon) {
      if (activeCoupon.discountPercent) {
        discount = Math.round((subtotal * activeCoupon.discountPercent) / 100);
      } else if (activeCoupon.discountFlat && subtotal >= (activeCoupon.minCart || 0)) {
        discount = activeCoupon.discountFlat;
      }
    }

    if (discount > 0) {
      discountRow.style.display = 'flex';
      discountVal.textContent = `-₹${discount.toLocaleString('en-IN')}`;
    } else {
      discountRow.style.display = 'none';
    }

    const grandTotal = Math.max(0, subtotal - discount);
    grandTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
  }

  function applyCoupon() {
    const code = couponInput.value.trim().toUpperCase();
    if (!code) {
      showToast('Please enter a coupon code');
      return;
    }

    if (COUPONS[code]) {
      activeCoupon = COUPONS[code];
      showToast(`Coupon '${code}' Applied: ${activeCoupon.description}`);
      updateCartUI();
    } else {
      showToast('Invalid Coupon. Try LUXE15 or VDLOVE');
    }
  }

  function openCartDrawer() {
    cartDrawerOverlay.classList.add('open');
  }

  function closeCartDrawer() {
    cartDrawerOverlay.classList.remove('open');
  }

  // --- WISHLIST MANAGEMENT ---
  function loadWishlist() {
    try {
      const saved = localStorage.getItem('velocees_wishlist');
      if (saved) wishlist = new Set(JSON.parse(saved));
      wishlistBadgeCount.textContent = wishlist.size;
    } catch (e) {
      wishlist = new Set();
    }
  }

  function toggleWishlist(productId, btnElement) {
    if (wishlist.has(productId)) {
      wishlist.delete(productId);
      if (btnElement) btnElement.classList.remove('active');
      showToast('Removed from Wishlist');
    } else {
      wishlist.add(productId);
      if (btnElement) btnElement.classList.add('active');
      showToast('Saved to Wishlist ❤️');
    }
    localStorage.setItem('velocees_wishlist', JSON.stringify([...wishlist]));
    wishlistBadgeCount.textContent = wishlist.size;
  }

  // --- PRODUCT CATALOG RENDERING ---
  function renderProducts() {
    let filtered = [...products];

    // Category filter
    if (currentCategory !== 'all') {
      if (currentCategory === 'under-899') {
        filtered = filtered.filter(p => p.price <= 899);
      } else {
        filtered = filtered.filter(p => p.category === currentCategory);
      }
    }

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        (p.notes && (
          (p.notes.top && p.notes.top.toLowerCase().includes(q)) ||
          (p.notes.heart && p.notes.heart.toLowerCase().includes(q)) ||
          (p.notes.base && p.notes.base.toLowerCase().includes(q))
        ))
      );
    }

    // Sorting
    if (currentSort === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    // Render HTML
    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--color-text-muted);">
          <h3 style="font-family: var(--font-serif); font-size: 1.8rem; color: var(--color-gold-300); margin-bottom: 8px;">No Fragrances Found</h3>
          <p>No products match your active search or filters. Try clearing your search.</p>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = filtered.map(p => {
      const isFav = wishlist.has(p.id);
      const topNote = p.notes ? p.notes.top : 'Artisanal Essence';

      return `
        <div class="product-card" data-id="${p.id}">
          <!-- Admin Action Bar (only visible in Admin mode via CSS) -->
          <div class="admin-card-bar">
            <button class="admin-card-btn admin-edit-btn" onclick="window.velocees.openEditModal('${p.id}')">✏️ Edit</button>
            <button class="admin-card-btn admin-delete-btn" onclick="window.velocees.deleteProduct('${p.id}')">🗑️ Delete</button>
          </div>

          <div class="product-image-box" onclick="window.velocees.openProductDetail('${p.id}')">
            ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
            <button class="wishlist-heart-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); window.velocees.toggleWishlist('${p.id}', this)" title="Add to Wishlist">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </div>

          <div class="product-info">
            <div class="product-meta-row">
              <span class="product-type">${p.type}</span>
              <span class="product-rating">★ ${p.rating} <span style="color: var(--color-text-muted); font-size: 0.72rem;">(${p.reviewsCount})</span></span>
            </div>

            <h3 class="product-name" onclick="window.velocees.openProductDetail('${p.id}')">${p.name}</h3>
            <p class="product-tagline">${p.tagline}</p>

            <div class="product-notes-preview">
              <span>Top Notes:</span> ${topNote}
            </div>

            <!-- Size selector chips -->
            <div class="size-selector-row" id="sizes-${p.id}">
              ${(p.sizes || ['100ml', '50ml']).map((s, idx) => `
                <button class="size-chip ${s === (p.defaultSize || '100ml') ? 'selected' : ''}" onclick="window.velocees.selectSize('${p.id}', '${s}', this)">${s}</button>
              `).join('')}
            </div>

            <div class="product-bottom-row">
              <div class="price-lockup">
                <span class="current-price">₹${p.price.toLocaleString('en-IN')}</span>
                ${p.mrp ? `<span class="mrp-price">₹${p.mrp.toLocaleString('en-IN')}</span>` : ''}
                ${p.discount ? `<span class="discount-pill">${p.discount}</span>` : ''}
              </div>

              <div class="card-cta-group">
                <button class="btn-card-cart" onclick="window.velocees.addCurrentSizeToCart('${p.id}', false)">Add to Bag</button>
                <button class="btn-card-buy" onclick="window.velocees.addCurrentSizeToCart('${p.id}', true)">Buy Now</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function selectSize(productId, size, btn) {
    const parent = document.getElementById(`sizes-${productId}`);
    if (parent) {
      parent.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
    }
  }

  function getSelectedSize(productId) {
    const parent = document.getElementById(`sizes-${productId}`);
    if (parent) {
      const selected = parent.querySelector('.size-chip.selected');
      if (selected) return selected.textContent.trim();
    }
    const product = products.find(p => p.id === productId);
    return product ? (product.defaultSize || '100ml') : '100ml';
  }

  function addCurrentSizeToCart(productId, buyNow) {
    const size = getSelectedSize(productId);
    addToCart(productId, size, buyNow);
  }

  // --- PRODUCT DETAIL MODAL ---
  function openProductDetail(productId) {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    modalDetailBody.innerHTML = `
      <div class="product-modal-grid">
        <div class="modal-perfume-img-box">
          <img src="${p.image}" alt="${p.name}">
        </div>

        <div>
          <div style="font-size: 0.72rem; letter-spacing: 2.5px; text-transform: uppercase; color: var(--color-gold-400); margin-bottom: 6px;">
            ${p.brand} &bull; ${p.concentration || p.type}
          </div>
          <h2 style="font-family: var(--font-serif); font-size: 2.2rem; color: var(--color-text-primary); margin-bottom: 8px;">
            ${p.name}
          </h2>
          <div style="font-size: 0.85rem; color: var(--color-gold-300); margin-bottom: 16px;">
            ★ ${p.rating} / 5.0 &bull; ${p.reviewsCount} Verified Olfactory Reviews
          </div>

          <p style="font-size: 0.95rem; color: var(--color-text-secondary); line-height: 1.7; margin-bottom: 20px;">
            ${p.description}
          </p>

          <!-- Scent Pyramid -->
          <div class="pyramid-card">
            <h4 style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--color-gold-200); margin-bottom: 12px; letter-spacing: 1px;">
              Pyramide Olfactive &bull; Fragrance Notes
            </h4>
            <div class="pyramid-tier">
              <div class="tier-label">🌿 Top Notes (First 30 Mins)</div>
              <div class="tier-notes">${p.notes ? p.notes.top : 'Bergamot, Saffron'}</div>
            </div>
            <div class="pyramid-tier">
              <div class="tier-label">🌹 Heart Notes (2 - 6 Hours)</div>
              <div class="tier-notes">${p.notes ? p.notes.heart : 'Damask Rose, Smoky Leather'}</div>
            </div>
            <div class="pyramid-tier">
              <div class="tier-label">🪵 Base Notes (6 - 14+ Hours)</div>
              <div class="tier-notes">${p.notes ? p.notes.base : 'Cambodian Oud, Amber, Bourbon Vanilla'}</div>
            </div>
          </div>

          <!-- Longevity & Sillage Specs -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 0.8rem;">
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px solid var(--border-gold-subtle);">
              <div style="color: var(--color-gold-300); text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.7rem;">Longevity</div>
              <div style="color: #fff; font-weight: 600;">${p.longevity || '12+ Hours'}</div>
            </div>
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px solid var(--border-gold-subtle);">
              <div style="color: var(--color-gold-300); text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.7rem;">Sillage Projection</div>
              <div style="color: #fff; font-weight: 600;">${p.sillage || 'Heavy Projection'}</div>
            </div>
          </div>

          <!-- Price & Purchase -->
          <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px;">
            <span style="font-family: var(--font-serif); font-size: 2rem; color: var(--color-gold-300); font-weight: 600;">
              ₹${p.price.toLocaleString('en-IN')}
            </span>
            ${p.mrp ? `<span style="color: var(--color-text-muted); text-decoration: line-through; font-size: 1rem;">₹${p.mrp.toLocaleString('en-IN')}</span>` : ''}
            ${p.discount ? `<span class="discount-pill">${p.discount}</span>` : ''}
          </div>

          <div style="display: flex; gap: 12px;">
            <button class="btn-primary" style="flex: 1;" onclick="window.velocees.addToCart('${p.id}', '${p.defaultSize || '100ml'}', true)">
              Add to Bag &bull; ₹${p.price}
            </button>
            <button class="btn-secondary" onclick="window.velocees.toggleWishlist('${p.id}');">
              Wishlist ❤️
            </button>
          </div>
        </div>
      </div>
    `;

    productDetailModal.classList.add('open');
  }

  function closeProductDetail() {
    productDetailModal.classList.remove('open');
  }

  // --- FLOATING ADMIN / USER TOGGLE LOGIC ---
  function toggleAdminMode() {
    isAdminMode = !isAdminMode;
    document.body.classList.toggle('admin-mode-active', isAdminMode);

    if (isAdminMode) {
      currentModeText.textContent = 'Admin';
      showToast('⚡ Switched to Admin Studio Mode');
    } else {
      currentModeText.textContent = 'User';
      showToast('🛍️ Switched to Customer Storefront Mode');
    }
    renderProducts();
    updateAdminStats();
  }

  // --- ADMIN CRUD OPERATIONS ---
  function openAddModal() {
    adminModalTitle.textContent = 'Add New Haute Fragrance';
    adminProductForm.reset();
    document.getElementById('editProductId').value = '';
    adminFormModal.classList.add('open');
  }

  function openEditModal(productId) {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    adminModalTitle.textContent = `Edit Fragrance: ${p.name}`;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('inputName').value = p.name || '';
    document.getElementById('inputType').value = p.type || 'Extrait De Parfum';
    document.getElementById('inputCategory').value = p.category || 'men';
    document.getElementById('inputPrice').value = p.price || 899;
    document.getElementById('inputMrp').value = p.mrp || 1499;
    document.getElementById('inputBadge').value = p.badge || '';
    document.getElementById('inputImage').value = p.image || 'laventra.jpg';
    document.getElementById('inputTagline').value = p.tagline || '';
    document.getElementById('inputDesc').value = p.description || '';
    document.getElementById('inputTopNotes').value = p.notes ? p.notes.top : '';
    document.getElementById('inputHeartNotes').value = p.notes ? p.notes.heart : '';
    document.getElementById('inputBaseNotes').value = p.notes ? p.notes.base : '';

    adminFormModal.classList.add('open');
  }

  function closeAdminModal() {
    adminFormModal.classList.remove('open');
  }

  function handleAdminFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editProductId').value;
    const name = document.getElementById('inputName').value.trim();
    const type = document.getElementById('inputType').value.trim();
    const category = document.getElementById('inputCategory').value;
    const price = parseInt(document.getElementById('inputPrice').value) || 899;
    const mrp = parseInt(document.getElementById('inputMrp').value) || 1499;
    const badge = document.getElementById('inputBadge').value.trim();
    const image = document.getElementById('inputImage').value.trim() || 'laventra.jpg';
    const tagline = document.getElementById('inputTagline').value.trim();
    const description = document.getElementById('inputDesc').value.trim();
    const top = document.getElementById('inputTopNotes').value.trim();
    const heart = document.getElementById('inputHeartNotes').value.trim();
    const base = document.getElementById('inputBaseNotes').value.trim();

    const discountVal = mrp > price ? `${Math.round(((mrp - price) / mrp) * 100)}% OFF` : '';

    if (id) {
      // Edit existing product
      const p = products.find(prod => prod.id === id);
      if (p) {
        p.name = name;
        p.type = type;
        p.category = category;
        p.price = price;
        p.mrp = mrp;
        p.discount = discountVal;
        p.badge = badge;
        p.image = image;
        p.tagline = tagline;
        p.description = description;
        p.notes = { top, heart, base };
        showToast(`Updated '${name}' in JSON store`);
      }
    } else {
      // Create new product
      const newProduct = {
        id: 'vd-' + Date.now().toString(36),
        name: name,
        brand: 'VELOCEES DE SCENT 🖤',
        type: type,
        concentration: '32% Fragrance Oil',
        category: category,
        gender: category.toUpperCase(),
        badge: badge || 'NEW ARRIVAL',
        price: price,
        mrp: mrp,
        discount: discountVal,
        rating: 5.0,
        reviewsCount: 1,
        sizes: ['100ml', '50ml', 'Travel 20ml'],
        defaultSize: '100ml',
        image: image,
        tagline: tagline,
        description: description,
        notes: { top, heart, base },
        longevity: '14+ Hours',
        sillage: 'Heavy Projection',
        occasion: 'All Occasions',
        inStock: true,
        stockCount: 50
      };
      products.unshift(newProduct);
      showToast(`Added new fragrance '${name}' to JSON store!`);
    }

    saveProductsStore();
    renderProducts();
    closeAdminModal();
  }

  function deleteProduct(productId) {
    const idx = products.findIndex(p => p.id === productId);
    if (idx === -1) return;

    if (confirm(`Are you sure you want to delete '${products[idx].name}' from the store?`)) {
      const removedName = products[idx].name;
      products.splice(idx, 1);
      saveProductsStore();
      renderProducts();
      showToast(`Deleted '${removedName}' from JSON store`);
    }
  }

  // --- EXPORT & RESET JSON STORE ---
  function exportProductsJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'products.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported products.json successfully! 📥');
  }

  async function resetToSeedJSON() {
    if (confirm('Reset catalog to the default seed products.json? All local additions/edits will revert.')) {
      localStorage.removeItem('velocees_products_store');
      await loadProductsJSON();
      renderProducts();
      showToast('Reverted to default seed products.json');
    }
  }

  // --- CHECKOUT SIMULATION ---
  function openCheckoutModal() {
    if (cart.length === 0) {
      showToast('Your Bag is empty!');
      return;
    }
    closeCartDrawer();
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    let discount = 0;
    if (activeCoupon) {
      if (activeCoupon.discountPercent) discount = Math.round((subtotal * activeCoupon.discountPercent) / 100);
      else if (activeCoupon.discountFlat && subtotal >= (activeCoupon.minCart || 0)) discount = activeCoupon.discountFlat;
    }
    const finalTotal = Math.max(0, subtotal - discount);

    document.getElementById('checkoutSummaryTotal').textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
    document.getElementById('checkoutItemCount').textContent = cart.reduce((a, b) => a + b.quantity, 0);
    checkoutModal.classList.add('open');
  }

  function closeCheckoutModal() {
    checkoutModal.classList.remove('open');
  }

  function confirmOrder(e) {
    e.preventDefault();
    const orderId = 'VD-' + Math.floor(100000 + Math.random() * 900000);
    closeCheckoutModal();
    cart = [];
    activeCoupon = null;
    saveCart();

    alert(`🖤 Thank you for choosing VELOCEES DE SCENT!\n\nYour Order #${orderId} has been confirmed.\nOur perfumery atelier will prepare your bespoke package with complementary discovery vials.\n\nA confirmation has been simulated.`);
    showToast(`Order #${orderId} Placed Successfully! ✨`);
  }

  // --- TOAST HELPER ---
  function showToast(message) {
    toastMsg.textContent = message;
    toastMsg.classList.add('show');
    setTimeout(() => {
      toastMsg.classList.remove('show');
    }, 3200);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Category pills filter
    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.getAttribute('data-category');
        renderProducts();
      });
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderProducts();
    });

    // Cart Drawer triggers
    cartToggleBtn.addEventListener('click', openCartDrawer);
    cartCloseBtn.addEventListener('click', closeCartDrawer);
    cartDrawerOverlay.addEventListener('click', (e) => {
      if (e.target === cartDrawerOverlay) closeCartDrawer();
    });

    // Coupons & Checkout
    applyCouponBtn.addEventListener('click', applyCoupon);
    checkoutBtn.addEventListener('click', openCheckoutModal);

    // Floating Mode Toggle
    floatingModeSwitch.addEventListener('click', toggleAdminMode);

    // Admin Banner Buttons
    adminAddBtn.addEventListener('click', openAddModal);
    adminExportBtn.addEventListener('click', exportProductsJSON);
    adminResetBtn.addEventListener('click', resetToSeedJSON);

    // Admin Form
    adminProductForm.addEventListener('submit', handleAdminFormSubmit);
    document.getElementById('adminCloseModalBtn').addEventListener('click', closeAdminModal);

    // Checkout Form
    document.getElementById('checkoutForm').addEventListener('submit', confirmOrder);
    document.getElementById('closeCheckoutBtn').addEventListener('click', closeCheckoutModal);

    // Modal background close
    [productDetailModal, adminFormModal, checkoutModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    // Product detail modal close
    document.getElementById('modalDetailCloseBtn').addEventListener('click', closeProductDetail);
  }

  // --- FALLBACK INLINE SEED ---
  function getFallbackProducts() {
    return [
      {
        id: "vd-laventra",
        name: "LAVENTRA",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        category: "men",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 4.9,
        reviewsCount: 1840,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "laventra.jpg",
        tagline: "The Black Velvet Enigma. Bold, aristocratic, and fiercely magnetic.",
        description: "Draped in tactile midnight black velvet and crowned with a knurled gold cap, LAVENTRA by VELOCEES DE SCENT is an olfactory statement of commanding presence.",
        notes: { top: "French Lavender, Black Pepper", heart: "Smoked Haitian Vetiver, Leather", base: "Precious Amber, Tonka Bean" }
      },
      {
        id: "vd-unspoken",
        name: "UNSPOKEN",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        category: "unisex",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 5.0,
        reviewsCount: 2190,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "unspoken.jpg",
        tagline: "Some things are felt, never spoken. Seductive, warm, and intoxicating.",
        description: "Encased in rich royal bordeaux wine velvet, UNSPOKEN whispers secrets of forbidden romance and nocturnal passion.",
        notes: { top: "Crushed Saffron, Candied Plum", heart: "Crimson Rose Velvet, Cinnamon", base: "Madagascar Vanilla, Ambergris" }
      }
    ];
  }

  // Expose namespace to window for HTML onclick attributes
  window.velocees = {
    addToCart,
    addCurrentSizeToCart,
    selectSize,
    updateQuantity,
    removeFromCart,
    openCart: openCartDrawer,
    closeCart: closeCartDrawer,
    toggleWishlist,
    openProductDetail,
    closeProductDetail,
    toggleAdminMode,
    openAddModal,
    openEditModal,
    deleteProduct,
    exportProductsJSON,
    resetToSeedJSON,
    switchHero
  };

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
