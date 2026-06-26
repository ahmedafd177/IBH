/* ═══════════════════════════════════════
   CHECKOUT — multi-step wizard
   Step 1: Account  (guest / sign-in / register / Google)
   Step 2: Delivery (zone + address)
   Step 3: Payment  (M-Pesa / COD / Card)
   Step 4: Confirmation
   ═══════════════════════════════════════ */
const Checkout = (() => {

  /* ── state ── */
  let _items     = [];
  let _step      = 1;
  let _authMode  = 'guest';
  let _user      = null;
  let _zone      = null;
  let _zones     = [];   // loaded from DB; falls back to Config.DELIVERY_ZONES
  let _address   = '';
  let _notes     = '';
  let _payMethod = 'mpesa';
  let _buyNow    = false;

  /* ── load delivery zones from DB, fall back to Config if empty ── */
  async function _loadZones() {
    try {
      const dbAreas = await API.getDeliveryAreas();
      if (dbAreas && dbAreas.length) {
        _zones = dbAreas.map(a => ({ label: a.name, fee: Number(a.price) }));
      } else {
        _zones = Config.DELIVERY_ZONES;
      }
    } catch {
      _zones = Config.DELIVERY_ZONES;
    }
  }

  /* ── entry: from cart ── */
  async function open(items, { buyNow = false } = {}) {
    _items   = items;
    _buyNow  = buyNow;
    _user    = _savedUser();
    _step    = _user ? 2 : 1;
    App.closeCart();
    await _loadZones();
    _zone = _zone && _zones.find(z => z.label === _zone.label) ? _zone : _zones[0];
    _render();
    document.getElementById('checkout-overlay').classList.add('open');
    document.getElementById('checkout-modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /* ── entry: Buy Now ── */
  async function buyNow(productId) {
    const p = await API.getProduct(productId);
    if (!p) return;
    App.closeProductModal();
    open([{
      id: p.id, qty: 1, name: p.name, brand: p.brand,
      price: p.price, emoji: p.emoji, imageMain: p.imageMain || null, subcat: p.subcat,
    }], { buyNow: true });
  }

  /* ── helpers ── */
  function _savedUser() {
    try {
      /* 1. Checkout-specific account (guest / checkout login) */
      const co = JSON.parse(localStorage.getItem('ibh_account')) || null;
      if (co) return co;
      /* 2. Fall back to Auth module session (header sign-in) */
      const au = JSON.parse(localStorage.getItem('ibh_user')) || null;
      if (au) return { type: 'account', name: au.name, phone: au.phone || '', email: au.email || '' };
      return null;
    } catch { return null; }
  }
  function _sub() { return _items.reduce((s, c) => s + c.price * c.qty, 0); }

  /* ── RENDER ── */
  function _render() {
    const body = document.getElementById('checkout-modal-body');
    if (!body) return;
    body.innerHTML = `${_progressBar()}<div id="co-step-body">${_stepBody()}</div>`;
    _bind();
  }

  function _progressBar() {
    const labels = ['Account', 'Delivery', 'Payment'];
    return `
      <div class="co-steps">
        ${labels.map((label, i) => {
          const n = i + 1;
          const cls = _step > n ? 'done' : _step === n ? 'active' : '';
          const isClickable = n <= _step ? 'clickable' : '';
          return `
            <button class="co-step-item ${cls} ${isClickable}" data-step="${n}" type="button" ${n <= _step ? '' : 'disabled'}>
              <div class="co-step-dot">${_step > n ? '✓' : n}</div>
              <div class="co-step-lbl">${label}</div>
            </button>
            ${i < 2 ? `<div class="co-step-line ${_step > n ? 'done' : ''}"></div>` : ''}`;
        }).join('')}
      </div>`;
  }

  function _stepBody() {
    if (_step === 1) return _step1();
    if (_step === 2) return _step2();
    if (_step === 3) return _step3();
    return '';
  }

  /* ═══════════════════════════════
     STEP 1 — ACCOUNT
     ═══════════════════════════════ */
  function _step1() {
    return `
      <div class="co-section">
        <h3 class="co-title">How would you like to continue?</h3>
        <div class="co-auth-grid">
          <button class="co-auth-card ${_authMode==='guest'?'active':''}" data-auth-mode="guest">
            <span class="co-auth-icon">👤</span>
            <strong>Guest</strong>
            <small>Quick &amp; easy</small>
          </button>
          <button class="co-auth-card ${_authMode==='login'?'active':''}" data-auth-mode="login">
            <span class="co-auth-icon">🔑</span>
            <strong>Sign In</strong>
            <small>Existing account</small>
          </button>
          <button class="co-auth-card ${_authMode==='register'?'active':''}" data-auth-mode="register">
            <span class="co-auth-icon">✨</span>
            <strong>Register</strong>
            <small>Create account</small>
          </button>
        </div>

        <div class="co-or"><span>or continue with</span></div>

        <button class="btn-google" id="btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <div id="co-auth-form">${_authForm()}</div>
      </div>`;
  }

  function _authForm() {
    const m = _authMode;
    if (m === 'guest') return `
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="auth-name" type="text" class="form-control" placeholder="Jane Wanjiku" autocomplete="name">
        </div>
        <div class="form-group">
          <label>Phone <span class="req">*</span></label>
          <input id="auth-phone" type="tel" class="form-control" placeholder="07XX XXX XXX" autocomplete="tel">
        </div>
      </div>
      <div class="form-group">
        <label>Email <span class="opt">optional</span></label>
        <input id="auth-email" type="email" class="form-control" placeholder="jane@example.com" autocomplete="email">
      </div>
      <button class="btn btn-primary btn-block" id="auth-submit">Continue to Delivery →</button>`;

    if (m === 'login') return `
      <div class="form-group">
        <label>Phone <span class="req">*</span></label>
        <input id="auth-phone" type="tel" class="form-control" placeholder="07XX XXX XXX" autocomplete="tel">
      </div>
      <div class="form-group">
        <label>Password <span class="req">*</span></label>
        <input id="auth-pass" type="password" class="form-control" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-block" id="auth-submit">Sign In →</button>`;

    /* register */
    return `
      <div class="form-row">
        <div class="form-group">
          <label>Full Name <span class="req">*</span></label>
          <input id="auth-name" type="text" class="form-control" placeholder="Jane Wanjiku" autocomplete="name">
        </div>
        <div class="form-group">
          <label>Phone <span class="req">*</span></label>
          <input id="auth-phone" type="tel" class="form-control" placeholder="07XX XXX XXX" autocomplete="tel">
        </div>
      </div>
      <div class="form-group">
        <label>Email <span class="req">*</span></label>
        <input id="auth-email" type="email" class="form-control" placeholder="jane@example.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label>Password <span class="req">*</span></label>
        <input id="auth-pass" type="password" class="form-control" placeholder="Min. 6 characters" autocomplete="new-password">
      </div>
      <button class="btn btn-primary btn-block" id="auth-submit">Create Account →</button>`;
  }

  /* ═══════════════════════════════
     STEP 2 — DELIVERY
     ═══════════════════════════════ */
  function _step2() {
    const z     = _zone || _zones[0] || Config.DELIVERY_ZONES[0];
    const zones = _zones.length ? _zones : Config.DELIVERY_ZONES;
    return `
      <div class="co-section">
        <h3 class="co-title">${_user ? `Hi ${_user.name.split(' ')[0]}! 👋` : 'Delivery Details'}</h3>
        ${_user ? `
          <div class="co-user-pill">
            <span>${_user.type === 'google' ? '🔵' : '👤'} ${_user.name}${_user.phone ? ' · '+_user.phone : ''}</span>
            <button class="co-signout" id="co-signout">Change</button>
          </div>` : ''}

        <div class="form-group">
          <label>Delivery Town / Zone <span class="req">*</span></label>
          <select id="co-zone-sel" class="form-control">
            ${zones.map(zo => `
              <option value="${zo.fee}" data-label="${zo.label}" ${z.label===zo.label?'selected':''}>
                ${zo.label} — ${zo.fee === 0 ? 'FREE' : 'KES '+zo.fee.toLocaleString()}
              </option>`).join('')}
          </select>
          <!-- Selected zone badge -->
          <div id="co-zone-badge" class="co-zone-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span id="co-zone-badge-text">${z.label}</span>
            <strong id="co-zone-badge-fee" style="margin-left:auto;color:${z.fee===0?'var(--ok)':'var(--blue-d)'}">
              ${z.fee === 0 ? 'FREE' : 'KES '+z.fee.toLocaleString()}
            </strong>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>First Name <span class="req">*</span></label>
            <input id="co-fname" type="text" class="form-control"
              placeholder="Jane" value="${_user?.name?.split(' ')[0] || ''}" autocomplete="given-name">
          </div>
          <div class="form-group">
            <label>Last Name <span class="req">*</span></label>
            <input id="co-lname" type="text" class="form-control"
              placeholder="Wanjiku" value="${_user?.name?.split(' ').slice(1).join(' ') || ''}" autocomplete="family-name">
          </div>
        </div>

        <div class="form-group">
          <label>Building / Estate / Street <span class="req">*</span></label>
          <input id="co-address" type="text" class="form-control"
            placeholder="e.g. ABC Plaza, Westlands Ave"
            value="${_address}" autocomplete="street-address">
        </div>

        <div class="form-group">
          <label>Phone Number <span class="req">*</span></label>
          <input id="co-del-phone" type="tel" class="form-control"
            placeholder="07XX XXX XXX" value="${_user?.phone || ''}" autocomplete="tel">
        </div>

        <div class="form-group">
          <label>Email <span class="opt">optional</span></label>
          <input id="co-del-email" type="email" class="form-control"
            placeholder="jane@example.com" value="${_user?.email || ''}" autocomplete="email">
        </div>

        <div class="form-group">
          <label>Delivery Notes <span class="opt">optional</span></label>
          <input id="co-notes" type="text" class="form-control"
            value="${_notes}"
            placeholder="e.g. Call when you arrive, gate code…">
        </div>

        <div id="co-bd-wrap">${_breakdown(_sub(), z.fee)}</div>
        <div class="co-nav">
          ${!_user ? `<button class="btn btn-ghost" id="co-back">← Back</button>` : '<span></span>'}
          <button class="btn btn-primary" id="co-next">Continue to Payment →</button>
        </div>
      </div>`;
  }

  /* ═══════════════════════════════
     STEP 3 — PAYMENT
     ═══════════════════════════════ */
  function _step3() {
    const total = _sub() + (_zone?.fee ?? 0);
    return `
      <div class="co-section">
        <h3 class="co-title">Payment Method</h3>
        <div class="co-pay-methods">
          ${Config.PAYMENT_METHODS.map(m => `
            <button class="co-pay-card ${_payMethod===m.id?'active':''}" data-pay="${m.id}">
              <span class="co-pay-icon">${m.icon}</span>
              <strong>${m.label}</strong>
              <small>${m.sub}</small>
            </button>`).join('')}
        </div>
        <div id="co-pay-detail"></div>
        ${_breakdown(_sub(), _zone?.fee ?? 0)}
        <div class="co-nav">
          <button class="btn btn-ghost" id="co-back">← Back</button>
          <button class="btn btn-primary co-place-btn" id="co-place-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Pay KES ${total.toLocaleString()}
          </button>
        </div>
      </div>`;
  }

  function _renderPayDetail() {
    const el    = document.getElementById('co-pay-detail');
    if (!el) return;
    const total = _sub() + (_zone?.fee ?? 0);

    if (_payMethod === 'mpesa') {
      el.innerHTML = `
        <div class="mpesa-box">
          <div class="mpesa-header">
            <span class="mpesa-logo-text">M-PESA</span>
            <span class="mpesa-powered">Lipa na M-PESA</span>
          </div>
          <ol class="mpesa-steps">
            <li>Dial <strong>*334#</strong> or open <strong>M-PESA app</strong></li>
            <li>Select <strong>Lipa na M-PESA → Buy Goods</strong></li>
            <li>Enter Till: <span class="mpesa-val">${Config.MPESA_TILL}</span> &nbsp;·&nbsp; ${Config.MPESA_NAME}</li>
            <li>Enter Amount: <span class="mpesa-val">KES ${total.toLocaleString()}</span></li>
            <li>Enter PIN and confirm</li>
          </ol>
          <div class="form-group" style="margin-top:1rem">
            <label>Your M-PESA Phone Number <span class="req">*</span></label>
            <input id="co-mpesa-phone" type="tel" class="form-control"
              placeholder="07XX XXX XXX"
              value="${_user?.phone || ''}">
          </div>
          <div class="form-group">
            <label>M-PESA Transaction Code <span class="req">*</span>
              <span class="opt"> — from your confirmation SMS</span>
            </label>
            <input id="co-mpesa-ref" type="text" class="form-control mpesa-ref-input"
              placeholder="e.g. RGK89FH7TZ"
              oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')">
          </div>
        </div>`;

    } else if (_payMethod === 'card') {
      el.innerHTML = `
        <div class="co-card-form">
          <div class="form-group">
            <label>Card Number</label>
            <input type="text" class="form-control" placeholder="1234  5678  9012  3456" maxlength="19"
              oninput="this.value=this.value.replace(/\\D/g,'').replace(/(.{4})/g,'$1 ').trim()">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Expiry</label>
              <input type="text" class="form-control" placeholder="MM / YY" maxlength="7"
                oninput="let v=this.value.replace(/\\D/g,'');if(v.length>=3)v=v.slice(0,2)+' / '+v.slice(2,4);this.value=v">
            </div>
            <div class="form-group">
              <label>CVV</label>
              <input type="password" class="form-control" placeholder="•••" maxlength="4">
            </div>
          </div>
          <div class="form-group">
            <label>Name on Card</label>
            <input type="text" class="form-control" placeholder="JANE WANJIKU" style="text-transform:uppercase"
              oninput="this.value=this.value.toUpperCase()">
          </div>
        </div>`;

    } else {
      /* Cash on Delivery */
      el.innerHTML = `
        <div class="co-cod-box">
          <div class="co-cod-emoji">🛵</div>
          <p><strong>Pay when your order is delivered.</strong></p>
          <p style="color:var(--n-600)">Please have <strong>KES ${total.toLocaleString()}</strong> ready for our rider.</p>
        </div>`;
    }
  }

  /* ═══════════════════════════════
     STEP 4 — CONFIRMATION
     ═══════════════════════════════ */
  function _renderConfirmation(order) {
    const sub   = _sub();
    const fee   = _zone?.fee ?? 0;
    const total = sub + fee;
    const first = _user?.name?.split(' ')[0] || 'there';

    document.getElementById('checkout-modal-body').innerHTML = `
      <div class="co-confirm">
        <div class="co-confirm-icon">🎉</div>
        <h2 class="co-confirm-title">Order Confirmed!</h2>
        <p class="co-confirm-sub">Thank you, <strong>${first}</strong>! We've received your order.</p>
        <div class="co-order-id-chip">${order.id}</div>

        ${_payMethod === 'mpesa' ? `
          <div class="co-confirm-note">
            📱 M-PESA payment recorded. Our team will verify within 5 minutes.
          </div>` : ''}
        ${_payMethod === 'cod' ? `
          <div class="co-confirm-note co-confirm-note-green">
            🛵 Our rider will contact you at <strong>${_user?.phone || 'your number'}</strong> shortly.
          </div>` : ''}

        <div class="co-confirm-items">
          ${_items.map(c => `
            <div class="co-ci-row">
              <span>${c.emoji || ''} ${c.name} ×${c.qty}</span>
              <span>KES ${(c.price * c.qty).toLocaleString()}</span>
            </div>`).join('')}
          <div class="co-ci-row co-ci-del">
            <span>🛵 Delivery · ${_zone?.label || ''}</span>
            <span>${fee === 0 ? '<span style="color:var(--ok);font-weight:700">FREE</span>' : 'KES '+fee.toLocaleString()}</span>
          </div>
          <div class="co-ci-row co-ci-total">
            <span>Total Paid</span>
            <span>KES ${total.toLocaleString()}</span>
          </div>
        </div>

        <div class="co-confirm-actions">
          <button class="btn btn-primary" id="co-print-receipt">
            🧾 Print Receipt
          </button>
          <button class="btn btn-ghost" onclick="App.closeCheckoutModal()">
            Continue Shopping →
          </button>
        </div>
      </div>`;

    const printBtn = document.getElementById('co-print-receipt');
    if (printBtn) printBtn.addEventListener('click', () => _printReceipt(order, total));
  }

  function _printReceipt(order, total) {
    const fee  = _zone?.fee ?? 0;
    const sub  = total - fee;
    const win  = window.open('', '_blank', 'width=600,height=800');
    const date = new Date().toLocaleString('en-KE');
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt ${order.id}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:2rem;max-width:480px;margin:0 auto;color:#111}
      .hd{text-align:center;border-bottom:2px solid #1455A4;padding-bottom:1rem;margin-bottom:1rem}
      .hd h1{color:#1455A4;font-size:1.4rem}
      .hd p{font-size:.8rem;color:#555}
      .oid{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;padding:.5rem 1rem;text-align:center;font-weight:700;font-size:.95rem;color:#1E40AF;margin:.75rem 0}
      table{width:100%;border-collapse:collapse;margin:.75rem 0;font-size:.875rem}
      td{padding:.4rem .25rem;border-bottom:1px solid #EEE}
      td:last-child{text-align:right;font-weight:600}
      .tot{font-weight:700;font-size:1rem;color:#1455A4}
      .ft{text-align:center;margin-top:1.5rem;font-size:.75rem;color:#888}
      @media print{button{display:none}}
    </style></head><body>
    <div class="hd">
      <h1>Inspiring Beauty Hub</h1>
      <p>Order Receipt · ${date}</p>
    </div>
    <div class="oid">${order.id}</div>
    <p style="font-size:.8rem;color:#555;margin-bottom:.5rem">
      Customer: ${_user?.name || 'Guest'} · ${_user?.phone || ''}<br>
      Delivery: ${_address} (${_zone?.label || ''})
    </p>
    <table>
      <thead><tr><td><b>Item</b></td><td><b>Qty</b></td><td><b>Price</b></td></tr></thead>
      <tbody>
        ${_items.map(c => `<tr><td>${c.name}</td><td>${c.qty}</td><td>KES ${(c.price*c.qty).toLocaleString()}</td></tr>`).join('')}
        <tr><td colspan="2">Subtotal</td><td>KES ${sub.toLocaleString()}</td></tr>
        <tr><td colspan="2">Delivery</td><td>${fee===0?'FREE':'KES '+fee.toLocaleString()}</td></tr>
        <tr class="tot"><td colspan="2"><b>TOTAL</b></td><td>KES ${total.toLocaleString()}</td></tr>
      </tbody>
    </table>
    <p style="font-size:.8rem">Payment: ${_payMethod.toUpperCase()}</p>
    <div class="ft">
      Thank you for shopping at Inspiring Beauty Hub!<br>
      Eastleigh · CBD · Westlands &nbsp;|&nbsp; info@ibh.co.ke
    </div>
    <br><button onclick="window.print()" style="width:100%;padding:.75rem;background:#1455A4;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer">🖨️ Print</button>
    </body></html>`);
    win.document.close();
  }

  /* ── price breakdown ── */
  function _breakdown(sub, fee) {
    const total = sub + fee;
    return `
      <div class="co-breakdown">
        ${_items.map(c => `
          <div class="co-bd-row">
            <span>${c.imageMain ? `<img src="${c.imageMain}" class="co-bd-img" alt="">` : c.emoji} ${c.name} ×${c.qty}</span>
            <span>KES ${(c.price*c.qty).toLocaleString()}</span>
          </div>`).join('')}
        <div class="co-bd-row co-bd-sep">
          <span>Delivery · ${(_zone || _zones[0] || Config.DELIVERY_ZONES[0]).label}</span>
          <span>${fee===0 ? '<b style="color:var(--ok)">FREE</b>' : 'KES '+fee.toLocaleString()}</span>
        </div>
        <div class="co-bd-row co-bd-total">
          <span>Total</span>
          <span>KES ${total.toLocaleString()}</span>
        </div>
      </div>`;
  }

  /* ═══════════════════════════════
     EVENT BINDING
     ═══════════════════════════════ */
  function _bind() {
    /* Step indicator navigation — allow clicking to go back */
    document.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const targetStep = parseInt(btn.dataset.step);
        if (targetStep <= _step) {
          _step = targetStep;
          _render();
        }
      });
    });

    /* Step 1 — auth mode switch via event delegation */
    const authModeButtons = document.querySelectorAll('[data-auth-mode]');
    authModeButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _authMode = btn.dataset.authMode;
        authModeButtons.forEach(b => b.classList.toggle('active', b === btn));
        const formEl = document.getElementById('co-auth-form');
        if (formEl) {
          formEl.innerHTML = _authForm();
          _bindAuthSubmit();
        }
      });
    });
    _bindAuthSubmit();

    /* Google button */
    const googleBtn = document.getElementById('btn-google');
    if (googleBtn) googleBtn.addEventListener('click', e => {
      e.stopPropagation();
      _triggerGoogle();
    });

    /* Step 2 — zone change updates breakdown and badge */
    const zoneSelect = document.getElementById('co-zone-sel');
    if (zoneSelect) {
      zoneSelect.addEventListener('change', e => {
        e.stopPropagation();
        const opt = e.target.options[e.target.selectedIndex];
        _zone = { label: opt.dataset.label, fee: Number(e.target.value) };
        const bdWrap = document.getElementById('co-bd-wrap');
        if (bdWrap) bdWrap.innerHTML = _breakdown(_sub(), _zone.fee);
        const badge = document.getElementById('co-zone-badge-text');
        const feeBadge = document.getElementById('co-zone-badge-fee');
        if (badge) badge.textContent = _zone.label;
        if (feeBadge) {
          feeBadge.textContent = _zone.fee === 0 ? 'FREE' : `KES ${_zone.fee.toLocaleString()}`;
          feeBadge.style.color = _zone.fee === 0 ? 'var(--ok)' : 'var(--blue-d)';
        }
      });
    }

    const backBtn = document.getElementById('co-back');
    if (backBtn) {
      backBtn.addEventListener('click', e => {
        e.stopPropagation();
        _step--;
        _render();
      });
    }

    const nextBtn = document.getElementById('co-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        _submitDelivery();
      });
    }

    const signoutBtn = document.getElementById('co-signout');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', e => {
        e.stopPropagation();
        _user = null;
        localStorage.removeItem('ibh_account');
        /* Also sign out of Auth session so header updates */
        if (typeof Auth !== 'undefined') Auth.signOut();
        else {
          localStorage.removeItem('ibh_session');
          localStorage.removeItem('ibh_user');
        }
        _step = 1;
        _render();
      });
    }

    /* Step 3 — pay method */
    const payCards = document.querySelectorAll('[data-pay]');
    payCards.forEach(card => {
      card.addEventListener('click', e => {
        e.stopPropagation();
        _payMethod = card.dataset.pay;
        payCards.forEach(c => c.classList.toggle('active', c === card));
        _renderPayDetail();
        _bindPlaceOrder();
      });
    });
    _renderPayDetail();
    _bindPlaceOrder();
  }

  function _bindAuthSubmit() {
    const submitBtn = document.getElementById('auth-submit');
    if (!submitBtn) return;
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    const newBtn = document.getElementById('auth-submit');
    if (newBtn) {
      newBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        _submitAuth();
      });
    }
  }

  function _bindPlaceOrder() {
    const btn = document.getElementById('co-place-btn');
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    const newBtn = document.getElementById('co-place-btn');
    if (newBtn) {
      newBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        _placeOrder(e);
      });
    }
  }

  /* ═══════════════════════════════
     AUTH
     ═══════════════════════════════ */
  async function _submitAuth(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const name  = document.getElementById('auth-name')?.value?.trim() || '';
    const phone = document.getElementById('auth-phone')?.value?.trim() || '';
    const email = document.getElementById('auth-email')?.value?.trim() || '';
    const pass  = document.getElementById('auth-pass')?.value || '';

    if (!phone) { App.toast('Phone number required', 'error'); return; }

    if (_authMode === 'guest') {
      if (!name) { App.toast('Full name required', 'error'); return; }
      _user = { type: 'guest', name, phone, email: email || '' };
      localStorage.setItem('ibh_account', JSON.stringify(_user));
      _step = 2;
      _render();
      return;
    }

    if (_authMode === 'register') {
      if (!name || !email || !pass) { App.toast('All fields are required', 'error'); return; }
      if (pass.length < 6) { App.toast('Password must be at least 6 characters', 'error'); return; }

      const btn = document.getElementById('auth-submit');
      if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

      if (Config.USE_LOCAL_STORAGE) {
        const all = JSON.parse(localStorage.getItem('ibh_accounts') || '[]');
        if (all.find(a => a.phone === phone)) {
          App.toast('Account already exists — please Sign In', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
          return;
        }
        all.push({ name, phone, email, pw: btoa(pass) });
        localStorage.setItem('ibh_accounts', JSON.stringify(all));
        _user = { type: 'account', name, phone, email };
      } else {
        try {
          const r = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password: pass }),
          });
          const data = await r.json();
          if (!r.ok) {
            App.toast(data.error || 'Registration failed', 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
            return;
          }
          _user = { type: 'account', name, phone, email };
          /* Sync auth session so header shows user name */
          if (data.token) {
            localStorage.setItem('ibh_session', data.token);
            localStorage.setItem('ibh_user', JSON.stringify({ name, phone, email, role: data.role }));
            document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').textContent = name.split(' ')[0]);
            document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').style.display = '');
          }
        } catch (err) {
          App.toast('Network error — try again', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
          return;
        }
      }
      localStorage.setItem('ibh_account', JSON.stringify(_user));
      App.toast(`Account created! Welcome, ${name.split(' ')[0]} 🎉`, 'success');
      _step = 2;
      _render();
      return;
    }

    /* login */
    if (!pass) { App.toast('Password required', 'error'); return; }
    const btn = document.getElementById('auth-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

    if (Config.USE_LOCAL_STORAGE) {
      const all = JSON.parse(localStorage.getItem('ibh_accounts') || '[]');
      const acc = all.find(a => a.phone === phone && a.pw === btoa(pass));
      if (!acc) {
        App.toast('Incorrect phone or password', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
        return;
      }
      _user = { type: 'account', name: acc.name, phone, email: acc.email };
    } else {
      try {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password: pass }),
        });
        const data = await r.json();
        if (!r.ok) {
          App.toast(data.error || 'Login failed', 'error');
          if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
          return;
        }
        _user = { type: 'account', name: data.name, phone, email: data.email };
        /* Sync auth session so header shows user name */
        if (data.token) {
          localStorage.setItem('ibh_session', data.token);
          localStorage.setItem('ibh_user', JSON.stringify({ name: data.name, phone, email: data.email, role: data.role }));
          document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').textContent = data.name.split(' ')[0]);
          document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').style.display = '');
        }
      } catch (err) {
        App.toast('Network error — try again', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
        return;
      }
    }
    localStorage.setItem('ibh_account', JSON.stringify(_user));
    App.toast(`Welcome back, ${_user.name.split(' ')[0]}! 👋`, 'success');
    _step = 2;
    _render();
  }

  /* ── Google Sign-In ── */
  function _triggerGoogle() {
    if (!Config.GOOGLE_CLIENT_ID) {
      App.toast('Google Sign-In is not configured. Please use Guest or Create Account.', 'error');
      return;
    }
    if (!window.google?.accounts?.id) {
      App.toast('Google Sign-In is still loading — please try again in a moment', 'error');
      return;
    }
    google.accounts.id.initialize({ client_id: Config.GOOGLE_CLIENT_ID, callback: _onGoogle });
    google.accounts.id.prompt(n => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        /* One Tap blocked — show a small popup */
        const overlay = document.createElement('div');
        overlay.id = 'g-popup';
        overlay.className = 'co-google-popup';
        overlay.innerHTML = `
          <div class="co-google-popup-inner">
            <p style="font-weight:600;margin-bottom:.875rem;text-align:center">Sign in with Google</p>
            <div id="g-btn-target"></div>
            <button class="btn btn-ghost btn-block" style="margin-top:.75rem"
              onclick="document.getElementById('g-popup').remove()">Cancel</button>
          </div>`;
        document.body.appendChild(overlay);
        google.accounts.id.renderButton(
          document.getElementById('g-btn-target'),
          { theme: 'outline', size: 'large', width: 260 }
        );
      }
    });
  }

  async function _onGoogle(response) {
    document.getElementById('g-popup')?.remove();
    try {
      /* Decode JWT payload client-side for quick display */
      const b64 = response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const p   = JSON.parse(atob(b64));
      _user = { type: 'google', name: p.name, email: p.email, phone: '', picture: p.picture || '' };
      localStorage.setItem('ibh_account', JSON.stringify(_user));

      /* Verify with server and get a proper session token */
      if (!Config.USE_LOCAL_STORAGE) {
        try {
          const r    = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
          });
          const data = await r.json();
          if (r.ok && data.token) {
            localStorage.setItem('ibh_session', data.token);
            localStorage.setItem('ibh_user', JSON.stringify({ name: data.name, phone: data.phone || '', email: data.email, role: data.role }));
            document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').textContent = data.name.split(' ')[0]);
            document.getElementById('auth-btn-label') && (document.getElementById('auth-btn-label').style.display = '');
          }
        } catch {}
      }

      App.toast(`Signed in as ${_user.name.split(' ')[0]} ✓`, 'success');
      _step = 2; _render();
    } catch { App.toast('Google Sign-In failed — try again', 'error'); }
  }

  /* ═══════════════════════════════
     DELIVERY
     ═══════════════════════════════ */
  function _submitDelivery(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const fname    = document.getElementById('co-fname')?.value?.trim() || '';
    const lname    = document.getElementById('co-lname')?.value?.trim() || '';
    const delPhone = document.getElementById('co-del-phone')?.value?.trim() || '';
    const delEmail = document.getElementById('co-del-email')?.value?.trim() || '';
    _address = document.getElementById('co-address')?.value?.trim() || '';
    _notes   = document.getElementById('co-notes')?.value?.trim() || '';

    if (!_address) { App.toast('Please enter your delivery address', 'error'); return; }
    if (!delPhone) { App.toast('Please enter your phone number', 'error'); return; }

    const zoneEl = document.getElementById('co-zone-sel');
    if (zoneEl) {
      const opt = zoneEl.options[zoneEl.selectedIndex];
      _zone = { label: opt.dataset.label, fee: Number(zoneEl.value) };
    }

    /* update user with delivery details */
    if (!_user) {
      _user = { type: 'guest', name: `${fname} ${lname}`.trim() || 'Guest', phone: delPhone, email: delEmail };
    } else {
      if (fname || lname) _user.name = `${fname} ${lname}`.trim() || _user.name;
      if (delPhone) _user.phone = delPhone;
      if (delEmail) _user.email = delEmail;
    }

    _step = 3;
    _render();
  }

  /* ═══════════════════════════════
     PLACE ORDER
     ═══════════════════════════════ */
  async function _placeOrder(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    const total = _sub() + (_zone?.fee ?? 0);

    if (_payMethod === 'mpesa') {
      const mpPhone = document.getElementById('co-mpesa-phone')?.value?.trim();
      const mpRef   = document.getElementById('co-mpesa-ref')?.value?.trim();
      if (!mpPhone) { App.toast('Enter your M-PESA phone number', 'error'); return; }
      if (!mpRef)   { App.toast('Enter your M-PESA transaction code', 'error'); return; }
    }

    const btn = document.getElementById('co-place-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Processing…'; }

    try {
      await new Promise(r => setTimeout(r, 1500));

      const mpesaPhone = document.getElementById('co-mpesa-phone')?.value?.trim() || '';
      const mpesaRef   = document.getElementById('co-mpesa-ref')?.value?.trim() || '';

      const order = await API.createOrder({
        customer: {
          name:    _user?.name    || 'Guest',
          phone:   _user?.phone   || mpesaPhone,
          email:   _user?.email   || '',
          address: _address,
          zone:    _zone?.label   || '',
          notes:   _notes,
        },
        items:    _items,
        total,
        payment:  _payMethod,
        mpesaRef,
      });

      if (!_buyNow) {
        API.saveCart([]);
        Cart.updateBadge();
        Cart.render();
      }

      _renderConfirmation(order);
    } catch (err) {
      console.error('Order error:', err);
      App.toast('Error creating order — try again', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '🔒 Pay KES ' + total.toLocaleString(); }
    }
  }

  return { open, buyNow };
})();
