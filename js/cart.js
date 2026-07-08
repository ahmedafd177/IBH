/* ═══════════════════════════════════════
   CART — state, drawer, badge
   Checkout is handled by checkout.js
   ═══════════════════════════════════════ */
const Cart = (() => {

  /* ── badge ── */
  function updateBadge() {
    const total = API.getCart().reduce((s, c) => s + c.qty, 0);
    document.querySelectorAll('#cart-count, #cart-drawer-count').forEach(el => {
      el.textContent = total;
      el.hidden = total === 0;
    });
  }

  /* ── add ── */
  async function add(id, qty = 1) {
    const p = await API.getProduct(id);
    if (!p) return;
    const cart = API.getCart();
    const ex   = cart.find(c => c.id === id);
    if (ex) {
      ex.qty += qty;
    } else {
      cart.push({
        id, qty,
        name: p.name, brand: p.brand, price: p.price,
        emoji: p.emoji, subcat: p.subcat, imageMain: p.imageMain || null,
      });
    }
    API.saveCart(cart);
    updateBadge();
    render();
    App.toast(`${p.name} added to cart`, 'success');
    /* Open the cart drawer so the user sees what they added */
    open();
  }

  /* ── remove ── */
  function remove(id) {
    API.saveCart(API.getCart().filter(c => c.id !== id));
    updateBadge(); render();
  }

  /* ── qty change ── */
  function changeQty(id, delta) {
    const cart = API.getCart();
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    API.saveCart(cart);
    updateBadge(); render();
  }

  /* ── render drawer ── */
  function render() {
    const cart = API.getCart();
    const body = document.getElementById('cart-items');
    const foot = document.getElementById('cart-footer');
    if (!body) return;

    if (!cart.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛍️</div>
          <h3>Your cart is empty</h3>
          <p>Add something beautiful</p>
          <button class="btn btn-primary btn-sm" style="margin-top:.75rem"
            data-action="shop-all" data-close-cart>Browse Products</button>
        </div>`;
      if (foot) foot.innerHTML = '';
      return;
    }

    body.innerHTML = cart.map(c => `
      <div class="cart-item">
        <div class="ci-img" aria-hidden="true">
          ${c.imageMain
            ? `<img src="${c.imageMain}" alt="${c.name}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">`
            : `<span>${c.emoji}</span>`}
        </div>
        <div class="ci-info">
          <div class="ci-brand">${c.brand}</div>
          <div class="ci-name">${c.name}</div>
          <div class="ci-sub">${c.subcat}</div>
          <div class="ci-qty-row">
            <button class="ci-qty-btn" data-qty="${c.id}" data-d="-1">−</button>
            <span class="ci-qty-val">${c.qty}</span>
            <button class="ci-qty-btn" data-qty="${c.id}" data-d="1">+</button>
            <button class="ci-remove" data-rm="${c.id}">Remove</button>
          </div>
        </div>
        <div class="ci-price">
          <strong>KES ${(c.price * c.qty).toLocaleString()}</strong>
          <small>@KES ${c.price.toLocaleString()}</small>
        </div>
      </div>`).join('');

    const sub = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const FREE_DEL_THRESHOLD = 3000;
    const remaining = Math.max(0, FREE_DEL_THRESHOLD - sub);
    const pct = Math.min(100, Math.round((sub / FREE_DEL_THRESHOLD) * 100));
    const freeDelHtml = sub >= FREE_DEL_THRESHOLD
      ? `<div class="cart-free-del">
           <div class="cart-free-del-label"><span>🎉 You qualify for free delivery!</span></div>
           <div class="cart-free-del-track"><div class="cart-free-del-fill" style="width:100%"></div></div>
         </div>`
      : `<div class="cart-free-del">
           <div class="cart-free-del-label">
             <span>Add <b>KES ${remaining.toLocaleString()}</b> more for free delivery</span>
             <span>${pct}%</span>
           </div>
           <div class="cart-free-del-track"><div class="cart-free-del-fill" style="width:${pct}%"></div></div>
         </div>`;
    if (foot) foot.innerHTML = `
      ${freeDelHtml}
      <div class="cart-subtotal-row">
        <span>Subtotal (${cart.reduce((s,c)=>s+c.qty,0)} item${cart.reduce((s,c)=>s+c.qty,0)!==1?'s':''})</span>
        <strong>KES ${sub.toLocaleString()}</strong>
      </div>
      <div class="cart-delivery-note">🛵 Delivery calculated at checkout</div>
      <button class="checkout-btn" data-cart-checkout>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        Checkout — KES ${sub.toLocaleString()}
      </button>`;
  }

  /* ── open drawer ── */
  function open() {
    render();
    document.getElementById('drawer-overlay').classList.add('open');
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-drawer').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /* ── open checkout ── */
  function openCheckout() {
    const cart = API.getCart();
    if (!cart.length) { App.toast('Your cart is empty', 'error'); return; }
    Checkout.open(cart);
  }

  return { add, remove, changeQty, render, open, updateBadge, openCheckout };
})();
