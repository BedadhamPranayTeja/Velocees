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
    initHeroCarousel();
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
  const CURRENT_STORE_VERSION = 'v6_assets_and_brand_dirs';

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

  // --- HERO CAROUSEL CONTROLLER ---
  let currentHeroSlide = 0;
  const TOTAL_HERO_SLIDES = 3;
  let heroAutoTimer = null;
  const HERO_SLIDE_DURATION = 5500;

  function initHeroCarousel() {
    const carouselSection = document.getElementById('heroCarousel');
    if (!carouselSection) return;

    startHeroAutoTimer();

    // Pause on hover
    carouselSection.addEventListener('mouseenter', stopHeroAutoTimer);
    carouselSection.addEventListener('mouseleave', startHeroAutoTimer);

    // Touch swipe support for mobile
    let touchStartX = 0;
    carouselSection.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].screenX;
      }
    }, { passive: true });

    carouselSection.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
          if (diff < 0) {
            nextHeroSlide();
          } else {
            prevHeroSlide();
          }
        }
      }
    }, { passive: true });
  }

  function startHeroAutoTimer() {
    stopHeroAutoTimer();
    heroAutoTimer = setInterval(() => {
      nextHeroSlide();
    }, HERO_SLIDE_DURATION);
  }

  function stopHeroAutoTimer() {
    if (heroAutoTimer) {
      clearInterval(heroAutoTimer);
      heroAutoTimer = null;
    }
  }

  function goToHeroSlide(index) {
    currentHeroSlide = (index + TOTAL_HERO_SLIDES) % TOTAL_HERO_SLIDES;
    updateHeroSlideDOM();
    startHeroAutoTimer();
  }

  function nextHeroSlide() {
    goToHeroSlide(currentHeroSlide + 1);
  }

  function prevHeroSlide() {
    goToHeroSlide(currentHeroSlide - 1);
  }

  function updateHeroSlideDOM() {
    const slides = document.querySelectorAll('#heroCarouselTrack .carousel-slide');
    const pills = document.querySelectorAll('.carousel-indicators-bar .indicator-pill');

    slides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === currentHeroSlide);
    });

    pills.forEach((pill, idx) => {
      pill.classList.toggle('active', idx === currentHeroSlide);
    });
  }

  function switchHero(scent) {
    if (scent === 'unspoken') {
      goToHeroSlide(1);
    } else {
      goToHeroSlide(0);
    }
  }

  function saveProductsStore() {
    localStorage.setItem('velocees_products_store', JSON.stringify(products));
    updateAdminStats();
  }

  function updateAdminStats() {
    const allCountEl = document.getElementById('allCount');
    if (allCountEl) allCountEl.textContent = products.length;
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
      } else if (currentCategory === 'bestseller') {
        filtered = filtered.filter(p => (p.rating >= 4.8) || (p.badge && (p.badge.includes('SIGNATURE') || p.badge.includes('BORDEAUX'))));
      } else if (currentCategory === 'gift-sets') {
        filtered = filtered.filter(p => p.category === 'gift-sets' || (p.name && p.name.toLowerCase().includes('discovery')) || (p.badge && p.badge.toLowerCase().includes('discovery')));
      } else if (currentCategory === 'women') {
        filtered = filtered.filter(p => p.category === 'women' || (p.gender && p.gender.toLowerCase().includes('women')));
      } else if (currentCategory === 'men') {
        filtered = filtered.filter(p => p.category === 'men' || (p.gender && p.gender.toLowerCase().includes('men')));
      } else if (currentCategory === 'unisex') {
        filtered = filtered.filter(p => p.category === 'unisex' || (p.gender && p.gender.toLowerCase().includes('unisex')));
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

  // --- CATEGORY SUB-NAV / LINK FILTERING ---
  function filterByNav(category, clickedElement) {
    currentCategory = category || 'all';

    // Synchronize Sub-Nav Links
    const subnavLinks = document.querySelectorAll('.subnav-link, .nav-link');
    subnavLinks.forEach(link => {
      const targetCat = link.getAttribute('data-subnav') || link.getAttribute('data-category');
      if (targetCat === currentCategory) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Synchronize Catalog Category Pills
    const pills = document.querySelectorAll('.pill-btn');
    pills.forEach(pill => {
      const pillCat = pill.getAttribute('data-category');
      if (pillCat === currentCategory) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    renderProducts();

    // Smooth scroll to catalog
    const catalogEl = document.getElementById('catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Category pills filter
    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.getAttribute('data-category');

        // Synchronize Sub-Nav Links
        const subnavLinks = document.querySelectorAll('.subnav-link, .nav-link');
        subnavLinks.forEach(link => {
          const targetCat = link.getAttribute('data-subnav') || link.getAttribute('data-category');
          if (targetCat === currentCategory) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });

        renderProducts();
      });
    });

    // Sort select
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });

    // Search inputs (Desktop & Mobile)
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        const mobInput = document.getElementById('mobileSearchInput');
        if (mobInput) mobInput.value = searchQuery;
        renderProducts();
      });
    }

    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
      mobileSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        if (searchInput) searchInput.value = searchQuery;
        renderProducts();
      });
    }

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
        concentration: "35% French Fragrance Oil",
        category: "men",
        gender: "Men & Unisex",
        badge: "SIGNATURE NOIR",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 4.9,
        reviewsCount: 1840,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/laventra.jpg",
        tagline: "The Black Velvet Enigma. Bold, aristocratic, and fiercely magnetic.",
        description: "Draped in tactile midnight black velvet and crowned with a knurled gold cap, LAVENTRA by VELOCEES DE SCENT is an olfactory statement of commanding presence.",
        notes: { top: "French Lavender, Black Pepper", heart: "Smoked Haitian Vetiver, Leather", base: "Precious Amber, Tonka Bean" },
        longevity: "14+ Hours (Beast Mode)",
        sillage: "Heavy Room-Filling Projection",
        occasion: "Evening Galas & High-Stakes Meetings",
        inStock: true,
        stockCount: 65
      },
      {
        id: "vd-unspoken",
        name: "UNSPOKEN",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "women",
        gender: "Women & Unisex",
        badge: "BORDEAUX VELVET",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 5.0,
        reviewsCount: 2190,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/unspoken.jpg",
        tagline: "Some things are felt, never spoken. Seductive, warm, and intoxicating.",
        description: "Encased in rich royal bordeaux wine velvet, UNSPOKEN whispers secrets of forbidden romance and nocturnal passion.",
        notes: { top: "Crushed Saffron, Candied Plum", heart: "Crimson Rose Velvet, Cinnamon", base: "Madagascar Vanilla, Ambergris" },
        longevity: "14+ Hours (Eternal Trail)",
        sillage: "Intoxicating & Seductive",
        occasion: "Date Nights & Special Milestones",
        inStock: true,
        stockCount: 58
      },
      {
        id: "vd-oud-royale",
        name: "OUD ROYALE",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "men",
        gender: "Men & Unisex",
        badge: "EMERALD MAJESTY",
        price: 999,
        mrp: 1699,
        discount: "41% OFF",
        rating: 4.9,
        reviewsCount: 1620,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/oud-royale.jpg",
        tagline: "The Sovereign Scent of Kings. Smoky Cambodian Oud meets Golden Frankincense.",
        description: "Cloaked in deep regal emerald green velvet, OUD ROYALE is an imperial fragrance crafted for individuals of sovereign power.",
        notes: { top: "Green Cardamom, Pink Peppercorn", heart: "Smoked Cambodian Oud, Frankincense", base: "Ambergris, Atlas Cedar" },
        longevity: "16+ Hours (Eternal Sillage)",
        sillage: "Majestic Room-Commanding Presence",
        occasion: "Royalty Galas & Red Carpets",
        inStock: true,
        stockCount: 42
      },
      {
        id: "vd-azur-imperial",
        name: "AZUR IMPERIAL",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "men",
        gender: "Men & Unisex",
        badge: "MIDNIGHT AZUR",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 4.8,
        reviewsCount: 1450,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/azur-imperial.jpg",
        tagline: "Deep Oceanic Radiance. Crisp Mediterranean Sea Salt, Frosted Mint & Blue Sage.",
        description: "Draped in midnight royal navy blue velvet, AZUR IMPERIAL captures the untamed majesty of Mediterranean night waters.",
        notes: { top: "Sicilian Bergamot, Frosted Mint", heart: "Blue Coastal Sage, Geranium", base: "French Oakmoss, Ambroxan" },
        longevity: "12+ Hours (All-Day Freshness)",
        sillage: "Crisp Magnetic Trail",
        occasion: "Daily Luxury, Yachting & Summer Evenings",
        inStock: true,
        stockCount: 78
      },
      {
        id: "vd-rose-velours",
        name: "ROSE VELOURS",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "women",
        gender: "Women & Unisex",
        badge: "PARISIAN BLUSH",
        price: 899,
        mrp: 1499,
        discount: "40% OFF",
        rating: 4.9,
        reviewsCount: 1980,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/rose-velours.jpg",
        tagline: "Velvet Petals at Twilight. Turkish Rose Absolu steeped in Spiced Praline.",
        description: "Enveloped in delicate dusty rose blush velvet, ROSE VELOURS is a poetic ode to Parisian romance.",
        notes: { top: "Grasse Rosebuds, Lychee Nectar", heart: "Turkish Rose, Caramel Praline", base: "White Musk, Cashmere Woods" },
        longevity: "14+ Hours (Romantic Aura)",
        sillage: "Graceful Whispering Radiance",
        occasion: "Spring Brunches & Candlelit Dinners",
        inStock: true,
        stockCount: 54
      },
      {
        id: "vd-ambre-dor",
        name: "AMBRE D'OR",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "unisex",
        gender: "Unisex",
        badge: "LIQUID GOLD",
        price: 949,
        mrp: 1599,
        discount: "40% OFF",
        rating: 5.0,
        reviewsCount: 1730,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/ambre-dor.jpg",
        tagline: "Sun-drenched Golden Warmth. Resinous Baltic Amber, Honeycomb & Smoked Tonka.",
        description: "Swathed in rich cognac caramel velvet, AMBRE D'OR glows with molten golden decadence.",
        notes: { top: "Mountain Honey, Cinnamon Bark", heart: "Baltic Amber, Toasted Tonka", base: "Bourbon Vanilla, Cashmeran" },
        longevity: "15+ Hours (Hypnotic Sillage)",
        sillage: "Warm Enveloping Cloud",
        occasion: "Fireside Evenings & Luxury Soirées",
        inStock: true,
        stockCount: 49
      },
      {
        id: "vd-iris-noir",
        name: "IRIS NOIR",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "women",
        gender: "Women & Unisex",
        badge: "ROYAL AMETHYST",
        price: 949,
        mrp: 1599,
        discount: "40% OFF",
        rating: 4.9,
        reviewsCount: 1390,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/iris-noir.jpg",
        tagline: "The Velvet Royalty of Florence. Powdery Tuscan Orris, Black Violet & Suede.",
        description: "Draped in imperial royal amethyst purple velvet, IRIS NOIR is an aristocratic perfume of unmatched refinement.",
        notes: { top: "Midnight Violet, Blackcurrant", heart: "Florentine Orris Butter, Heliotrope", base: "Indonesian Patchouli, Suede" },
        longevity: "14+ Hours (Noble Trail)",
        sillage: "Sublime Powdery Elegance",
        occasion: "Opera Nights & Couture Evenings",
        inStock: true,
        stockCount: 38
      },
      {
        id: "vd-santal-blanc",
        name: "SANTAL BLANC",
        brand: "VELOCEES DE SCENT 🖤",
        type: "Extrait De Parfum",
        concentration: "35% French Fragrance Oil",
        category: "unisex",
        gender: "Unisex",
        badge: "WHITE SILK",
        price: 999,
        mrp: 1699,
        discount: "41% OFF",
        rating: 4.9,
        reviewsCount: 1510,
        sizes: ["50 ML"],
        defaultSize: "50 ML",
        image: "assets/santal-blanc.jpg",
        tagline: "Pure Sacred Serenity. Creamy Mysore Sandalwood enveloped in White Coconut & Musk.",
        description: "Encased in pure ivory silk cream velvet, SANTAL BLANC evokes meditative peace and clean luxury.",
        notes: { top: "White Cardamom, Coconut Water", heart: "Mysore Sandalwood, Violet Leaf", base: "Clean Sheer Musk, Cedar" },
        longevity: "14+ Hours (Clean Luxury)",
        sillage: "Intimate Skin-Scent Radiance",
        occasion: "Morning Meditations & High-End Casual Wear",
        inStock: true,
        stockCount: 60
      }
    ];
  }

  function toggleMobileSearch(forceState) {
    const dropdown = document.getElementById('mobileSearchDropdown');
    const input = document.getElementById('mobileSearchInput');
    if (!dropdown) return;

    if (typeof forceState === 'boolean') {
      dropdown.classList.toggle('open', forceState);
    } else {
      dropdown.classList.toggle('open');
    }

    if (dropdown.classList.contains('open') && input) {
      setTimeout(() => input.focus(), 80);
    }
  }

  // --- FOOTER & NEWSLETTER HELPERS ---
  function subscribeNewsletter(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('newsletterEmailInput');
    if (!input || !input.value) return;

    const email = input.value.trim();
    try {
      const subs = JSON.parse(localStorage.getItem('velocees_subscribers') || '[]');
      if (!subs.includes(email)) {
        subs.push(email);
        localStorage.setItem('velocees_subscribers', JSON.stringify(subs));
      }
    } catch (err) {}

    // Automatically copy promo code LUXE15
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('LUXE15').catch(() => {});
    }

    input.value = '';
    showToast(`✨ Welcome to the Maison! Code LUXE15 (15% OFF) copied to clipboard.`);
  }

  function searchFromFooter(term) {
    searchQuery = term;
    if (searchInput) searchInput.value = term;
    const mobInput = document.getElementById('mobileSearchInput');
    if (mobInput) mobInput.value = term;
    renderProducts();

    const catalogEl = document.getElementById('catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function showPolicyToast(type) {
    const policies = {
      'terms': 'Terms & Conditions: All VELOCEES DE SCENT extraits are handcrafted with 35% oil concentration. Non-refundable once unsealed.',
      'privacy': 'Privacy Policy: We maintain encrypted 256-bit client records and never share your details with third parties.',
      'return': '7-Day Olfactory Guarantee: Damaged or defective deliveries are replaced with complimentary express dispatch.',
      'shipping': 'Express Shipping: All domestic orders dispatched within 24h via BlueDart & Delhivery VIP Air.',
      'bulk': 'Corporate Gifting: Bespoke engraved bottles & GST invoices available for quantities > 10 units.',
      'tracking': 'Live Tracking: Enter your Order ID received via WhatsApp / SMS into your VIP portal.',
      'faq': 'FAQ: Our Extrait de Parfums offer 14-16 hours longevity with 35% oil concentration.',
      'investor': 'Investor Relations: Maison VELOCEES is privately held under VD Haute Parfumerie Atelier.',
      'newsroom': 'Newsroom: VELOCEES DE SCENT featured for redefining pocket-friendly luxury parfums.'
    };
    showToast(policies[type] || 'Maison policy details updated in your client portal.');
  }

  // Expose namespace to window for HTML onclick attributes safely
  window.velocees = Object.assign(window.velocees || {}, {
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
    closeAdminModal,
    deleteProduct,
    exportProductsJSON,
    resetToSeedJSON,
    switchHero,
    goToHeroSlide,
    nextHeroSlide,
    prevHeroSlide,
    toggleMobileSearch,
    subscribeNewsletter,
    searchFromFooter,
    showPolicyToast,
    filterByNav
  });

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
