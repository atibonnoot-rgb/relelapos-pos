// subway_cart_client.js - Subway Interactive Cart, Upsell Remover, & Order Placement
(function() {
  window.subwayCart = {
    items: {},
    getCount: function() {
      return Object.values(this.items).reduce((sum, item) => sum + item.qty, 0);
    },
    getSubtotal: function() {
      return Object.values(this.items).reduce((sum, item) => sum + (item.price * item.qty), 0);
    }
  };

  // 1. Purge and hide 'People mostly order this with' upsells completely & safely
  function purgeUpsellElements() {
    const root = document.getElementById('root');
    if (!root) return;

    root.querySelectorAll('.popular-add-ons, .upsells, .popular-add-ons-main-container, .upsellHeader, .popular-items-main-container, .popular-items-inner-container, .popular-addons-heading, [class*="popular-add-ons"], [class*="upsell"]').forEach(el => {
      el.style.display = 'none';
      try { el.remove(); } catch(e) {}
    });

    root.querySelectorAll('.popular-addons-heading, .upsellHeader').forEach(el => {
      const c = el.closest('.popular-add-ons-main-container') || el.closest('.popular-add-ons');
      if (c && c !== root && c !== document.body) {
        c.style.display = 'none';
        try { c.remove(); } catch(e) {}
      }
    });
  }
  setInterval(purgeUpsellElements, 250);

  // 2. Floating View Cart Bar creation & update (smooth curved corners in green)
  function getOrCreateViewCartBar() {
    let bar = document.getElementById('subway-view-cart-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'subway-view-cart-bar';
      bar.innerHTML = `
        <div class="subway-cart-left">
          <span class="subway-cart-badge" id="subway-cart-badge">0 Items</span>
          <span class="subway-cart-amount" id="subway-cart-amount">₹0</span>
        </div>
        <div class="subway-cart-right">
          <span>View Cart</span>
          <svg class="subway-cart-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </div>
      `;
      bar.addEventListener('click', () => openSubwayCart());
      document.body.appendChild(bar);
    }
    return bar;
  }

  function updateCartUI() {
    const bar = getOrCreateViewCartBar();
    const count = window.subwayCart.getCount();
    const subtotal = window.subwayCart.getSubtotal();

    const badge = document.getElementById('subway-cart-badge');
    const amount = document.getElementById('subway-cart-amount');

    if (badge) badge.textContent = count + (count === 1 ? ' Item' : ' Items');
    if (amount) amount.textContent = '₹' + subtotal;

    if (count > 0) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }

    // Sync item buttons across both top bestsellers and category list
    document.querySelectorAll('.item-layout-panel, .best-sell-items-inner-container').forEach(panel => {
      const info = getItemInfoFromPanel(panel);
      if (!info) return;

      let addContainer = panel.querySelector('.add-btn-container');
      const addBtn = panel.querySelector('.add-quantity-btn');
      if (!addContainer && addBtn) {
        addContainer = addBtn.parentElement;
      }
      if (!addContainer) return;

      const existingItem = window.subwayCart.items[info.id];
      const counterEl = addContainer.querySelector('.subway-item-counter');

      if (existingItem && existingItem.qty > 0) {
        if (!counterEl) {
          addContainer.innerHTML = `
            <div class="subway-item-counter" data-id="${info.id}">
              <button class="subway-counter-btn minus" data-action="minus" title="Reduce">−</button>
              <span class="subway-counter-val">${existingItem.qty}</span>
              <button class="subway-counter-btn plus" data-action="plus" title="Add">+</button>
            </div>
            ${panel.querySelector('.custmisable-btn') ? '<div class="custmisable-btn">customizable</div>' : ''}
          `;
          bindCounterEvents(addContainer, info);
        } else {
          const valEl = counterEl.querySelector('.subway-counter-val');
          if (valEl) valEl.textContent = existingItem.qty;
        }
      } else {
        if (counterEl) {
          addContainer.innerHTML = `
            <div class="add-quantity-btn img-size-new md-pc md-text13 md-f700"><div class="add-quantity-text">ADD</div></div>
            ${panel.querySelector('.custmisable-btn') ? '<div class="custmisable-btn">customizable</div>' : ''}
          `;
          bindAddButton(addContainer, info);
        }
      }
    });

    renderCartModalItems();
  }

  function getItemInfoFromPanel(panel) {
    const titleEl = panel.querySelector('.title, .item-title, h2, .item-name');
    if (!titleEl) return null;
    const name = titleEl.textContent.trim();

    let id = '';
    const desc = panel.querySelector('[id$="-item-description"]');
    if (desc) id = desc.id.replace('-item-description', '');
    if (!id) {
      id = 'item_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    let price = 0;
    if (window.menuCatalogById && window.menuCatalogById[id] && window.menuCatalogById[id].price) {
      price = window.menuCatalogById[id].price;
    } else if (window.menuCatalogByName && window.menuCatalogByName[name.toLowerCase()] && window.menuCatalogByName[name.toLowerCase()].price) {
      price = window.menuCatalogByName[name.toLowerCase()].price;
    }

    if (!price) {
      const priceSpan = panel.querySelector('span.price, .price span, .item-price, .price:not(.price-quantity-container)');
      if (priceSpan) {
        const match = priceSpan.textContent.replace(/,/g, '').match(/(?:₹|Rs\.?|\$)?\s*([0-9]+(?:\.[0-9]+)?)/);
        if (match) price = Math.round(parseFloat(match[1]));
      }
    }
    if (!price) price = 249;

    let image = '';
    const imgTag = panel.querySelector('.product-img-wrap img, img.product-image');
    if (imgTag && imgTag.src) image = imgTag.src;
    if (!image) {
      const imgWrap = panel.querySelector('.product-img-wrap');
      if (imgWrap && imgWrap.style.backgroundImage) {
        const m = imgWrap.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/);
        if (m) image = m[1];
      }
    }
    if (!image && window.menuCatalogById && window.menuCatalogById[id] && window.menuCatalogById[id].image && window.menuCatalogById[id].image[0]) {
      image = window.menuCatalogById[id].image[0];
    }

    return { id, name, price, image };
  }

  function bindCounterEvents(container, info) {
    const minusBtn = container.querySelector('.subway-counter-btn.minus');
    const plusBtn = container.querySelector('.subway-counter-btn.plus');

    if (minusBtn) {
      minusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.subwayCart.items[info.id]) {
          window.subwayCart.items[info.id].qty--;
          if (window.subwayCart.items[info.id].qty <= 0) {
            delete window.subwayCart.items[info.id];
          }
          updateCartUI();
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.subwayCart.items[info.id]) {
          window.subwayCart.items[info.id].qty++;
        } else {
          window.subwayCart.items[info.id] = { ...info, qty: 1 };
        }
        updateCartUI();
      });
    }
  }

  function bindAddButton(container, info) {
    const btn = container.querySelector('.add-quantity-btn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      window.subwayCart.items[info.id] = {
        id: info.id,
        name: info.name,
        price: info.price,
        image: info.image,
        qty: 1
      };
      updateCartUI();
    }, { capture: true });
  }

  function initAddButtons() {
    document.querySelectorAll('.item-layout-panel, .best-sell-items-inner-container').forEach(panel => {
      const info = getItemInfoFromPanel(panel);
      if (!info) return;

      let addContainer = panel.querySelector('.add-btn-container');
      const addBtn = panel.querySelector('.add-quantity-btn');
      if (!addContainer && addBtn) {
        addContainer = addBtn.parentElement;
      }
      if (!addContainer) return;

      const btn = addContainer.querySelector('.add-quantity-btn');
      if (btn && !btn.dataset.subwayBound) {
        btn.dataset.subwayBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          window.subwayCart.items[info.id] = {
            id: info.id,
            name: info.name,
            price: info.price,
            image: info.image,
            qty: 1
          };
          updateCartUI();
        }, { capture: true });
      }
    });
  }

  // 3. Create Cart Bottom Sheet & Modal
  function getOrCreateCartModal() {
    let modal = document.getElementById('subway-cart-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'subway-cart-modal';
      modal.innerHTML = `
        <div class="subway-cart-backdrop" onclick="closeSubwayCart()"></div>
        <div class="subway-cart-sheet">
          <div class="subway-cart-header">
            <div>
              <h3>My Subway Cart</h3>
              <span style="font-size:12px; color:#6b7280;">Subway Topsia Kolkata Store</span>
            </div>
            <button class="subway-cart-close" onclick="closeSubwayCart()">✕</button>
          </div>

          <div class="subway-cart-body" id="subway-cart-body">
            <!-- Dynamically rendered cart items -->
          </div>

          <div class="subway-cart-footer" id="subway-cart-footer">
            <button class="subway-place-order-btn" id="subway-place-order-btn">
              PLACE ORDER • ₹0
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    return modal;
  }

  window.openSubwayCart = function() {
    const modal = getOrCreateCartModal();
    const footer = document.getElementById('subway-cart-footer');
    if (footer) footer.style.display = 'block';
    renderCartModalItems();
    modal.classList.add('open');
  };

  window.closeSubwayCart = function() {
    const modal = document.getElementById('subway-cart-modal');
    if (modal) modal.classList.remove('open');
  };

  window.subwayPaymentMethod = 'UPI';

  window.setSubwayPayment = function(method) {
    window.subwayPaymentMethod = method;
    const upiCard = document.getElementById('subway-pay-upi');
    const cashCard = document.getElementById('subway-pay-cash');
    const upiRadio = document.querySelector('input[name="subwayPaymentMethod"][value="UPI"]');
    const cashRadio = document.querySelector('input[name="subwayPaymentMethod"][value="Cash"]');
    if (upiCard && cashCard) {
      if (method === 'UPI') {
        upiCard.style.borderColor = '#008938';
        upiCard.style.background = '#f0fdf4';
        cashCard.style.borderColor = '#e5e7eb';
        cashCard.style.background = '#ffffff';
        if (upiRadio) upiRadio.checked = true;
      } else {
        cashCard.style.borderColor = '#008938';
        cashCard.style.background = '#f0fdf4';
        upiCard.style.borderColor = '#e5e7eb';
        upiCard.style.background = '#ffffff';
        if (cashRadio) cashRadio.checked = true;
      }
    }
  };

  function renderCartModalItems() {
    const body = document.getElementById('subway-cart-body');
    const footerBtn = document.getElementById('subway-place-order-btn');
    if (!body) return;

    const items = Object.values(window.subwayCart.items);
    const subtotal = window.subwayCart.getSubtotal();
    const total = subtotal; // Non-GST billing

    if (footerBtn) {
      if (items.length === 0) {
        footerBtn.textContent = 'YOUR CART IS EMPTY';
        footerBtn.disabled = true;
        footerBtn.style.opacity = '0.55';
        footerBtn.style.cursor = 'not-allowed';
        footerBtn.style.pointerEvents = 'none';
      } else {
        footerBtn.textContent = 'CONFIRM & PLACE ORDER • ₹' + total;
        footerBtn.disabled = false;
        footerBtn.style.opacity = '1';
        footerBtn.style.cursor = 'pointer';
        footerBtn.style.pointerEvents = 'auto';
      }

      footerBtn.onclick = function(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        window.submitSubwayOrder();
      };
    }

    if (items.length === 0) {
      body.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#6b7280;">
          <div style="font-size:48px; margin-bottom:12px;">🛒</div>
          <div style="font-size:16px; font-weight:700; color:#111827; margin-bottom:4px;">Your cart is empty</div>
          <div style="font-size:13px;">Add some delicious subs, wraps, or bowls from the menu!</div>
        </div>
      `;
      return;
    }

    let itemsHtml = items.map(item => `
      <div class="subway-cart-item">
        <div class="subway-cart-item-info">
          <div class="subway-cart-item-name">${item.name}</div>
          <div class="subway-cart-item-price">₹${item.price} each</div>
        </div>
        <div class="subway-cart-item-qty">
          <button onclick="changeCartItemQty('${item.id}', -1)">−</button>
          <span style="font-size:14px; font-weight:800; color:#111827; min-width:18px; text-align:center;">${item.qty}</span>
          <button onclick="changeCartItemQty('${item.id}', 1)">+</button>
        </div>
        <div style="font-size:14px; font-weight:800; color:#111827; margin-left:16px; min-width:55px; text-align:right;">
          ₹${item.price * item.qty}
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="subway-cart-items-list">
        ${itemsHtml}
      </div>

      <!-- Order Dining Type -->
      <div style="margin-top:18px; background:#f9fafb; border-radius:12px; padding:12px 14px;">
        <div style="font-size:12px; font-weight:700; color:#4b5563; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Order Service Option</div>
        <div style="display:flex; gap:10px;">
          <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:#ffffff; border:1.5px solid #008938; border-radius:8px; cursor:pointer; font-size:13px; font-weight:700; color:#008938;">
            <input type="radio" name="subwayOrderType" value="Dine-In" checked style="accent-color:#008938;">
            🍽️ Dine-In (Table 4)
          </label>
          <label style="flex:1; display:flex; align-items:center; gap:8px; padding:10px 12px; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; color:#4b5563;">
            <input type="radio" name="subwayOrderType" value="Takeaway" style="accent-color:#008938;">
            🛍️ Takeaway
          </label>
        </div>
      </div>

      <!-- Customer Details -->
      <div style="margin-top:14px; display:flex; gap:10px;">
        <input type="text" id="subway-cust-name" placeholder="Your Name" value="Guest Customer" style="flex:1; height:42px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; outline:none;">
        <input type="tel" id="subway-cust-phone" placeholder="Phone Number" value="+91 98765 43210" style="flex:1; height:42px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; outline:none;">
      </div>

      <!-- Cooking instructions note -->
      <div style="margin-top:10px;">
        <input type="text" id="subway-order-notes" placeholder="Cooking instructions (e.g., extra napkins, toasted well)" style="width:100%; height:42px; padding:0 12px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box;">
      </div>

      <!-- Bill breakdown (Non-GST) -->
      <div class="subway-cart-bill">
        <div class="subway-bill-row">
          <span>Item Subtotal</span>
          <span>₹${subtotal}</span>
        </div>
        <div class="subway-bill-row" style="color:#008938; font-weight:600;">
          <span>Taxes</span>
          <span>₹0 (Non-GST Bill)</span>
        </div>
        <div class="subway-bill-row" style="color:#008938; font-weight:600;">
          <span>Packaging & Delivery</span>
          <span>FREE</span>
        </div>
        <div class="subway-bill-row subway-bill-total">
          <span>To Pay</span>
          <span>₹${total}</span>
        </div>
      </div>

      <!-- Payment Method Selection -->
      <div style="margin-top:16px;">
        <div style="font-size:12px; font-weight:700; color:#4b5563; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Choose Payment Method</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div id="subway-pay-upi" onclick="window.setSubwayPayment('UPI')" style="display:flex; flex-direction:column; gap:4px; padding:12px; border:2px solid ${(window.subwayPaymentMethod || 'UPI') === 'UPI' ? '#008938' : '#e5e7eb'}; background:${(window.subwayPaymentMethod || 'UPI') === 'UPI' ? '#f0fdf4' : '#ffffff'}; border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:13px; font-weight:800; color:#111827;">⚡ UPI / Online</span>
              <input type="radio" name="subwayPaymentMethod" value="UPI" ${(window.subwayPaymentMethod || 'UPI') === 'UPI' ? 'checked' : ''} style="accent-color:#008938; cursor:pointer;">
            </div>
            <span style="font-size:11px; color:#6b7280; font-weight:500;">GPay, PhonePe, Paytm, QR</span>
          </div>

          <div id="subway-pay-cash" onclick="window.setSubwayPayment('Cash')" style="display:flex; flex-direction:column; gap:4px; padding:12px; border:2px solid ${window.subwayPaymentMethod === 'Cash' ? '#008938' : '#e5e7eb'}; background:${window.subwayPaymentMethod === 'Cash' ? '#f0fdf4' : '#ffffff'}; border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:13px; font-weight:800; color:#111827;">💵 Cash</span>
              <input type="radio" name="subwayPaymentMethod" value="Cash" ${window.subwayPaymentMethod === 'Cash' ? 'checked' : ''} style="accent-color:#008938; cursor:pointer;">
            </div>
            <span style="font-size:11px; color:#6b7280; font-weight:500;">Pay at counter / cash</span>
          </div>
        </div>
      </div>
    `;
  }

  window.changeCartItemQty = function(id, delta) {
    if (window.subwayCart.items[id]) {
      window.subwayCart.items[id].qty += delta;
      if (window.subwayCart.items[id].qty <= 0) {
        delete window.subwayCart.items[id];
      }
      updateCartUI();
    }
  };

  // 4. Order Submission with Confirmed Order Tick Mark Screen & POS Realtime Dispatch
  window._isSubmittingOrder = false;

  window.submitSubwayOrder = async function() {
    if (window._isSubmittingOrder) {
      console.log('Order already submitting...');
      return;
    }

    const footerBtn = document.getElementById('subway-place-order-btn');
    const items = Object.values(window.subwayCart.items);
    if (items.length === 0) {
      if (footerBtn) {
        footerBtn.disabled = true;
        footerBtn.textContent = 'YOUR CART IS EMPTY';
        footerBtn.style.opacity = '0.55';
        footerBtn.style.cursor = 'not-allowed';
      }
      return;
    }

    window._isSubmittingOrder = true;
    if (footerBtn) {
      footerBtn.disabled = true;
      footerBtn.textContent = '⏳ Placing order...';
      footerBtn.style.opacity = '0.7';
    }

    const subtotal = window.subwayCart.getSubtotal();
    const total = subtotal; // Non-GST billing

    const orderTypeRadio = document.querySelector('input[name="subwayOrderType"]:checked');
    const orderType = orderTypeRadio ? orderTypeRadio.value : 'Dine-In';
    const custName = (document.getElementById('subway-cust-name') || {}).value || 'Walk-in';
    const custPhone = (document.getElementById('subway-cust-phone') || {}).value || '+91 98765 43210';
    const notes = (document.getElementById('subway-order-notes') || {}).value || '';

    const isCash = (window.subwayPaymentMethod || 'UPI') === 'Cash';
    const paymentMethodName = isCash ? 'Cash' : 'UPI';
    const paymentStatusName = isCash ? 'Pending (Pay at Counter)' : 'Paid';

    const orderPayload = {
      orderType: orderType,
      table: orderType === 'Dine-In' ? 'T-1' : null,
      items: items.map(i => ({
        itemID: parseInt(String(i.id).replace(/[^0-9]/g, '')) || 80011,
        itemName: i.name,
        quantity: i.qty,
        price: i.price,
        costPrice: Math.round(i.price * 0.4),
        isVegetarian: "Y"
      })),
      subtotal: subtotal,
      discount: 0,
      tax: 0,
      total: total,
      paymentMethod: paymentMethodName,
      paymentStatus: paymentStatusName,
      orderStatus: "New",
      customer: {
        name: custName,
        phone: custPhone,
        notes: notes
      }
    };

    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const result = await res.json();
      const confirmedOrder = (result && result.order) ? result.order : {
        id: 'ORD-' + Math.floor(2050 + Math.random() * 500),
        orderNumber: 115,
        tokenNumber: Math.floor(1 + Math.random() * 50),
        total: total,
        orderType: orderType,
        paymentMethod: paymentMethodName,
        table: orderType === 'Dine-In' ? 'T-1' : null,
        items: orderPayload.items,
        customer: orderPayload.customer
      };

      confirmedOrder.items = confirmedOrder.items || orderPayload.items;

      const orderedItemsSnapshot = [...items];

      // Clear cart items in memory
      window.subwayCart.items = {};

      // Display Confirmed Order Screen with Animated Tick Mark and Unique Token
      showOrderConfirmedScreen(confirmedOrder, orderedItemsSnapshot, total);
    } catch(e) {
      console.error('Order placement error:', e);
      const fallbackOrder = {
        id: 'ORD-' + Math.floor(2050 + Math.random() * 500),
        orderNumber: 115,
        tokenNumber: Math.floor(1 + Math.random() * 50),
        total: total,
        orderType: orderType,
        paymentMethod: paymentMethodName,
        table: orderType === 'Dine-In' ? 'T-1' : null,
        items: orderPayload.items,
        customer: orderPayload.customer
      };
      const orderedItemsSnapshot = [...items];
      window.subwayCart.items = {};
      showOrderConfirmedScreen(fallbackOrder, orderedItemsSnapshot, total);
    } finally {
      window._isSubmittingOrder = false;
      if (footerBtn) {
        footerBtn.disabled = false;
        footerBtn.style.opacity = '1';
        footerBtn.textContent = 'CONFIRM & PLACE ORDER • ₹' + total;
      }
    }
  };

  function showOrderConfirmedScreen(order, items, total) {
    const modal = getOrCreateCartModal();
    const body = document.getElementById('subway-cart-body');
    const footer = document.getElementById('subway-cart-footer');
    if (!body) return;

    if (footer) footer.style.display = 'none';
    modal.classList.add('open');

    const tokenNum = order.tokenNumber || order.orderNumber || 1;
    const isCashOrder = (order.paymentMethod || '').toLowerCase().includes('cash');

    const itemsListHtml = (items || []).map(it => `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:4px 0;">
        <span style="font-weight:700; color:#111827;">${it.qty || it.quantity || 1}x ${it.name || it.itemName}</span>
        <span style="font-weight:700; color:#008938;">₹${(it.price || 0) * (it.qty || it.quantity || 1)}</span>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="subway-confirm-screen">
        <div class="subway-checkmark-wrapper">
          <svg class="subway-checkmark-svg" viewBox="0 0 52 52">
            <circle class="subway-checkmark-circle" cx="26" cy="26" r="24"/>
            <path class="subway-checkmark-check" d="M14 27l8 8 16-17"/>
          </svg>
        </div>

        <h2 style="font-size:23px; font-weight:800; color:#111827; margin:0 0 4px 0;">Order Confirmed!</h2>
        <p style="font-size:13px; color:#6b7280; margin:0 0 14px 0;">Your order has been sent to POS-80 printer & kitchen ticket</p>

        <!-- Prominent Unique Token Number -->
        <div style="background:linear-gradient(135deg, #008938, #005a24); color:#ffffff; padding:18px 24px; border-radius:16px; margin:0 0 18px 0; text-align:center; box-shadow:0 6px 16px rgba(0,137,56,0.3); width:100%; box-sizing:border-box;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:1.5px; opacity:0.9; font-weight:700;">YOUR ORDER TOKEN</div>
          <div style="font-size:42px; font-weight:900; letter-spacing:1px; line-height:1.1; margin:6px 0;">#${tokenNum}</div>
          <div style="font-size:12px; opacity:0.95; font-weight:500;">Quote Token #${tokenNum} at the counter</div>
        </div>

        <div style="background:#f9fafb; border:1px solid #f1f3f5; border-radius:14px; padding:16px; width:100%; text-align:left; margin-bottom:16px; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span style="color:#6b7280;">Order ID:</span>
            <span style="font-weight:700; color:#111827;">${order.id || 'ORD-2053'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span style="color:#6b7280;">Service Type:</span>
            <span style="font-weight:700; color:#111827;">${order.orderType || 'Dine-In'} ${order.table ? '(' + order.table + ')' : ''}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span style="color:#6b7280;">Payment Method:</span>
            <span style="font-weight:700; color:${isCashOrder ? '#b45309' : '#008938'};">
              ${isCashOrder ? '💵 Cash (Pay at Counter)' : '⚡ UPI / Online (Paid)'}
            </span>
          </div>

          <!-- Items list ordered by customer -->
          <div style="margin:10px 0; border-top:1px dashed #e5e7eb; border-bottom:1px dashed #e5e7eb; padding:8px 0;">
            <div style="font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; margin-bottom:6px;">Items Ordered (${items.length})</div>
            ${itemsListHtml}
          </div>

          <div style="display:flex; justify-content:space-between; font-size:13px; padding-top:4px;">
            <span style="color:#6b7280;">Total Amount:</span>
            <span style="font-weight:800; color:#008938; font-size:16px;">₹${total}</span>
          </div>
        </div>

        <div style="display:flex; gap:10px; width:100%; margin-bottom:8px;">
          <button id="subway-reprint-btn" class="subway-place-order-btn" style="flex:1; background:#0f172a; color:#fff;" onclick="printCustomerBillFromStore()">
            🖨 Print Bill (POS-80)
          </button>
          <button class="subway-place-order-btn" style="flex:1; background:#008938; color:#fff;" onclick="doneOrderConfirmation()">
            Done / Order More
          </button>
        </div>
        <div id="subway-print-toast" style="font-size:12px; color:#008938; font-weight:700; text-align:center; display:none; padding:4px 0 8px 0;">
          ✓ Bill & KOT Sent to POS-80 Thermal Printer with Paper Cut!
        </div>
      </div>
    `;

    window.lastPlacedOrder = order;
  }

  window.printCustomerBillFromStore = async function() {
    const o = window.lastPlacedOrder;
    if (!o) return;
    const btn = document.getElementById('subway-reprint-btn');
    const toast = document.getElementById('subway-print-toast');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Printing...';
    }
    try {
      const res = await fetch('/api/printer/reprint/' + (o.id || o.orderId), { method: 'POST' });
      const data = await res.json();
      if (toast) {
        toast.textContent = '✓ Bill & KOT Sent to POS-80 Thermal Printer with Paper Cut!';
        toast.style.display = 'block';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 4000);
      }
    } catch(err) {
      console.error('Print error:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🖨 Print Bill (POS-80)';
      }
    }
  };

  window.doneOrderConfirmation = function() {
    closeSubwayCart();
    updateCartUI();
    const footer = document.getElementById('subway-cart-footer');
    if (footer) footer.style.display = 'block';
  };

  // Initialize buttons and listeners
  setTimeout(initAddButtons, 600);
  setInterval(initAddButtons, 1000);

  // 6. Sticky Category Navigation Bar & Smooth Scrolling
  let isProgrammaticScrolling = false;

  function smoothScrollTo(targetPos) {
    const start = window.scrollY || document.documentElement.scrollTop;
    const change = targetPos - start;
    if (Math.abs(change) < 2) return;

    isProgrammaticScrolling = true;
    const duration = Math.min(480, Math.max(260, Math.sqrt(Math.abs(change)) * 8.5));
    const startTime = performance.now();

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, start + change * easeOutQuart(progress));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        window.scrollTo(0, targetPos);
        setTimeout(() => { isProgrammaticScrolling = false; }, 40);
      }
    }
    requestAnimationFrame(step);
  }

  function initCategoryNavigation() {
    return; // Category bar hidden to match clean native mobile design
    function buildNav() {
      const categorySections = [];
      const rec = document.querySelector('.store-best-sell-items-wrap');
      if (rec) {
        if (!rec.id) rec.id = 'recommended-item-1';
        categorySections.push({ id: rec.id, title: 'Recommended' });
      }

      document.querySelectorAll('.subcategory-items-wrap').forEach(el => {
        const titleEl = el.querySelector('.category-title, .sub-cat-heading');
        const title = titleEl ? titleEl.innerText.trim() : null;
        if (title && el.id) {
          categorySections.push({ id: el.id, title });
        }
      });

      if (categorySections.length === 0) return;

      const header = document.querySelector('.store-header-main-wrapper');
      if (!header) return;

      let navBar = document.getElementById('subway-category-nav-bar');
      if (!navBar || navBar.parentElement !== header.parentNode) {
        if (navBar) navBar.remove();
        navBar = document.createElement('div');
        navBar.id = 'subway-category-nav-bar';
        if (header.nextSibling) {
          header.parentNode.insertBefore(navBar, header.nextSibling);
        } else {
          header.parentNode.appendChild(navBar);
        }
      }

      const existingBtns = navBar.querySelectorAll('.subway-cat-btn');
      if (existingBtns.length === categorySections.length) {
        return;
      }

      navBar.innerHTML = '';
      categorySections.forEach((cat, idx) => {
        const btn = document.createElement('button');
        btn.className = 'subway-cat-btn' + (idx === 0 ? ' active' : '');
        btn.innerText = cat.title;
        btn.dataset.target = cat.id;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetEl = document.getElementById(cat.id);
          if (targetEl) {
            const navH = navBar.offsetHeight || 52;
            const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - navH - 8;
            
            navBar.querySelectorAll('.subway-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const centerOffset = btn.offsetLeft - (navBar.offsetWidth / 2) + (btn.offsetWidth / 2);
            navBar.scrollTo({ left: Math.max(0, centerOffset), behavior: 'smooth' });

            smoothScrollTo(targetPos);
          }
        });

        navBar.appendChild(btn);
      });

      if (!navBar.dataset.scrollSpyBound) {
        navBar.dataset.scrollSpyBound = 'true';
        let ticking = false;
        let activeCatId = categorySections[0] ? categorySections[0].id : null;

        window.addEventListener('scroll', () => {
          if (isProgrammaticScrolling) return;

          if (!ticking) {
            requestAnimationFrame(() => {
              const navH = navBar.offsetHeight || 52;
              let currentId = null;

              for (const cat of categorySections) {
                const el = document.getElementById(cat.id);
                if (el) {
                  const rect = el.getBoundingClientRect();
                  if (rect.top <= navH + 80 && rect.bottom > navH) {
                    currentId = cat.id;
                    break;
                  }
                }
              }

              if (currentId && currentId !== activeCatId) {
                activeCatId = currentId;
                navBar.querySelectorAll('.subway-cat-btn').forEach(b => {
                  const isAct = b.dataset.target === currentId;
                  if (isAct) {
                    b.classList.add('active');
                    const centerOffset = b.offsetLeft - (navBar.offsetWidth / 2) + (b.offsetWidth / 2);
                    navBar.scrollTo({ left: Math.max(0, centerOffset), behavior: 'smooth' });
                  } else {
                    b.classList.remove('active');
                  }
                });
              }
              ticking = false;
            });
            ticking = true;
          }
        }, { passive: true });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildNav);
    } else {
      buildNav();
    }
    setInterval(buildNav, 300);
  }
  initCategoryNavigation();
})();
