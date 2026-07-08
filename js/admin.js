/* ═══════════════════════════════════════
   ADMIN — dashboard panel
   ═══════════════════════════════════════ */
const Admin = (() => {

  /* ── module state ── */
  let _tab        = 'orders';
  let _editingId  = null;
  let _orderSearch = '';
  let _orderStatus = '';
  let _orderDate   = '';
  let _productSearch = '';
  let _cachedStaff    = [];
  let _cachedBranches = [];
  let _orderMenuOutsideClickBound = false;

  /* ─── open / close (index.html overlay; not used in admin.html) ─── */
  async function open() {
    document.getElementById('admin-overlay')?.classList.add('open');
    const panel = document.getElementById('admin-panel');
    if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
    document.body.style.overflow = 'hidden';
    await switchTab(_tab);
  }

  function close() {
    document.getElementById('admin-overlay')?.classList.remove('open');
    const panel = document.getElementById('admin-panel');
    if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    document.body.style.overflow = '';
  }

  /* ─── tab switch ─── */
  async function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll('.admin-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tab));
    const content = document.getElementById('admin-content');
    switch (tab) {
      case 'orders':      content.innerHTML = await buildOrders();         break;
      case 'products':    content.innerHTML = await buildProducts();       break;
      case 'brands':      content.innerHTML = await buildBrands();         break;
      case 'categories':  content.innerHTML = await buildCategories();     break;
      case 'add-product': content.innerHTML = await buildAddProduct();  _editingId = null; break;
      case 'users':       content.innerHTML = await buildUsers();          break;
      case 'delivery':    content.innerHTML = await buildDeliveryAreas();  break;
      case 'branches':    content.innerHTML = await buildBranches();       break;
      case 'coupons':     content.innerHTML = await buildCoupons();        break;
      case 'settings':    content.innerHTML = await buildSettings();       break;
    }
    bindTabEvents(tab);
  }

  /* ═══════════════════════════
     ORDERS
  ═══════════════════════════ */
  async function buildOrders() {
    const [allOrders, products, allStaff, allBranches] = await Promise.all([
      API.getOrders(), API.getProducts({ admin: true }), API.getUsers(), API.getBranches(),
    ]);
    _cachedStaff    = allStaff;
    _cachedBranches = allBranches;
    const rev     = allOrders.reduce((s, o) => s + o.total, 0);
    const pending = allOrders.filter(o => ['pending', 'confirmed'].includes(o.status)).length;
    const orders  = applyOrderFilters(allOrders);

    const user = window.AdminUser || {};
    const branchBanner = user.role === 'branch_manager'
      ? `<div style="background:var(--blue-xl);border:1.5px solid var(--blue-l);border-radius:var(--r-md);padding:.625rem 1rem;margin-bottom:1rem;font-size:.8125rem;font-weight:600;color:var(--blue-d)">
           📍 Branch: ${user.branch || '—'} — You can only see orders assigned to your branch.
         </div>`
      : '';

    return `
      ${branchBanner}
      <div class="admin-stats">
        <div class="admin-stat"><div class="admin-stat-icon">📦</div><div class="admin-stat-num">${allOrders.length}</div><div class="admin-stat-label">Total Orders</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">💰</div><div class="admin-stat-num">KES ${rev.toLocaleString()}</div><div class="admin-stat-label">Revenue</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">🛍️</div><div class="admin-stat-num">${products.length}</div><div class="admin-stat-label">Products</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">⏳</div><div class="admin-stat-num">${pending}</div><div class="admin-stat-label">Pending</div></div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Orders ${orders.length < allOrders.length ? `<span style="color:var(--blue)">(${orders.length} of ${allOrders.length})</span>` : `(${allOrders.length})`}</h4>
        </div>

        <div class="order-filters">
          <input  id="ord-search"  class="order-filter-input" type="search"  placeholder="Search order #, name, phone…" value="${_orderSearch}">
          <select id="ord-status"  class="order-filter-input">
            <option value="">All Statuses</option>
            ${['pending','confirmed','processing','delivered','cancelled']
              .map(s => `<option${s === _orderStatus ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
          <input  id="ord-date"    class="order-filter-input" type="date" value="${_orderDate}" title="Filter by date">
          ${_orderSearch || _orderStatus || _orderDate
            ? `<button class="admin-btn" id="ord-clear" style="background:var(--err-bg);color:var(--err)">✕ Clear</button>` : ''}
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>#</th><th>Order ID</th><th>Customer</th><th>Items</th>
              <th>Total</th><th>Branch</th><th>Assigned To</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody id="orders-tbody">
              ${buildOrdersRows(orders, allStaff, allBranches)}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function buildOrdersRows(orders, allStaff = [], allBranches = []) {
    if (!orders.length) return `<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--n-400)">No orders match the current filters.</td></tr>`;
    const user    = window.AdminUser || {};
    const isAdmin = user.role !== 'branch_manager';
    const branchNames = allBranches.length
      ? allBranches.map(b => b.name)
      : (window.Config?.BRANCHES || []).map(b => b.name);
    return orders.map((o, idx) => {
      const staffOpts = allStaff.filter(s => ['staff','branch_manager','admin'].includes(s.role))
        .map(s => `<option value="${s.id}" data-name="${s.name}"${s.id === o.assigned_to ? ' selected' : ''}>${s.name} (${s.role})</option>`).join('');
      const unpaid = o.payment_status !== 'paid';
      return `
      <tr>
        <td style="color:var(--n-400);font-size:.75rem;font-weight:600">${idx + 1}</td>
        <td>
          <strong style="color:var(--blue);font-size:.8125rem">${o.id}</strong><br>
          <span style="font-size:.6875rem;color:var(--n-400)">${o.date} ${o.time || ''}</span>
        </td>
        <td>
          <strong style="font-size:.8125rem">${o.customer?.name || o.customer || '—'}</strong><br>
          <span style="font-size:.6875rem;color:var(--n-400)">${o.customer?.phone || ''}</span>
          ${o.customer?.zone ? `<br><span style="font-size:.6rem;color:var(--n-400)">${o.customer.zone}</span>` : ''}
        </td>
        <td>
          <span class="pill pill-processing" style="font-size:.6rem">${o.items?.length || 0} item${(o.items?.length || 0) !== 1 ? 's' : ''}</span>
        </td>
        <td>
          <strong>KES ${(o.total || 0).toLocaleString()}</strong>
          ${unpaid ? `<br><span style="font-size:.625rem;color:#F59E0B" title="${o.payment || ''} — unpaid">⚠ Unpaid</span>` : ''}
        </td>
        <td>
          ${isAdmin
            ? `<select class="status-select branch-select" data-branch-order-id="${o.id}" style="font-size:.7rem;padding:.25rem .4rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);outline:none;max-width:110px">
                <option value="">Unassigned</option>
                ${branchNames.map(b => `<option${b === o.branch ? ' selected' : ''}>${b}</option>`).join('')}
               </select>`
            : `<span style="font-size:.75rem;color:var(--n-600)">${o.branch || '—'}</span>`}
        </td>
        <td>
          ${isAdmin
            ? `<select class="staff-assign-select" data-assign-order-id="${o.id}" style="font-size:.7rem;padding:.25rem .4rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);outline:none;max-width:130px">
                <option value="">Unassigned</option>
                ${staffOpts}
               </select>`
            : `<span style="font-size:.75rem;color:var(--n-600)">${o.assigned_name || '—'}</span>`}
        </td>
        <td>
          <select class="status-select" data-order-id="${o.id}">
            ${['pending','confirmed','processing','delivered','cancelled']
              .map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td style="white-space:nowrap;position:relative">
          <button class="admin-btn btn-sm" data-view-order="${o.id}" title="View full order"
            style="background:var(--blue-xl);color:var(--blue);padding:.35rem .5rem">👁</button>
          <button class="admin-btn btn-sm" data-notes-order="${o.id}" title="Notes"
            style="background:var(--n-100);color:var(--n-700);margin-left:.25rem;padding:.35rem .5rem">📝</button>
          <button class="admin-btn admin-btn-primary btn-sm" data-invoice="${o.id}" title="Print invoice"
            style="margin-left:.25rem;padding:.35rem .5rem">🖨</button>
          <button class="admin-btn btn-sm" data-order-menu-toggle="${o.id}" title="More actions"
            style="background:var(--n-100);color:var(--n-700);margin-left:.25rem;padding:.35rem .5rem">⋮</button>
          <div data-order-menu="${o.id}" style="display:none;position:absolute;right:.875rem;top:100%;z-index:50;background:var(--white);border:1px solid var(--n-200);border-radius:var(--r-md);box-shadow:var(--sh-lg);min-width:140px;overflow:hidden">
            <button data-delete-order="${o.id}" style="display:flex;align-items:center;gap:.4rem;width:100%;padding:.5rem .75rem;background:none;border:none;text-align:left;font-size:.8125rem;color:var(--err);cursor:pointer">🗑 Delete Order</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function applyOrderFilters(orders) {
    return orders.filter(o => {
      const q = _orderSearch.toLowerCase();
      const matchSearch = !q ||
        o.id.toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q);
      const matchStatus = !_orderStatus || o.status === _orderStatus;
      const matchDate   = !_orderDate   || o.date === _orderDate;
      return matchSearch && matchStatus && matchDate;
    });
  }

  /* ═══════════════════════════
     ORDER DETAIL — full page
  ═══════════════════════════ */
  function renderOrderNotesHtml(list) {
    return list.length
      ? list.map(n => `
          <div style="padding:.6rem .75rem;background:${n.is_internal ? '#FEF9C3' : 'var(--n-50)'};border-radius:var(--r-md);border:1px solid ${n.is_internal ? '#F59E0B' : 'var(--n-200)'};margin-bottom:.375rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
              <strong style="font-size:.75rem;color:var(--blue-d)">${n.author_name}</strong>
              <div style="display:flex;gap:.375rem;align-items:center">
                ${n.is_internal ? `<span style="font-size:.6rem;background:#F59E0B;color:#fff;padding:.1rem .4rem;border-radius:999px">Admin Only</span>` : ''}
                <span style="font-size:.6875rem;color:var(--n-400)">${n.created_at?.slice(0,16).replace('T',' ') || ''}</span>
              </div>
            </div>
            <p style="font-size:.8rem;color:var(--n-700);margin:0">${n.note}</p>
          </div>`).join('')
      : `<p style="color:var(--n-400);font-size:.8rem;text-align:center;padding:.75rem">No notes yet</p>`;
  }

  async function showOrderDetail(orderId) {
    const content = document.getElementById('admin-content');
    content.innerHTML = `<div class="admin-card" style="text-align:center;padding:2.5rem;color:var(--n-400)">Loading order…</div>`;
    const [orders, notes] = await Promise.all([API.getOrders(), API.getOrderNotes(orderId)]);
    const o = orders.find(x => x.id === orderId);
    if (!o) { content.innerHTML = `<div class="admin-card" style="text-align:center;padding:2.5rem;color:var(--n-400)">Order not found.</div>`; return; }
    content.innerHTML = buildOrderDetail(o, notes);
    bindOrderDetailEvents(o);
  }

  function buildOrderDetail(o, notes) {
    const itemsHtml = (o.items || []).map(item => `
      <tr>
        <td style="padding:.4rem .5rem;border-bottom:1px solid var(--n-100)">
          <div style="display:flex;align-items:center;gap:.5rem">
            ${item.imageMain
              ? `<img src="${item.imageMain}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0" onerror="this.style.display='none'">`
              : `<span style="font-size:1rem">${item.emoji || '📦'}</span>`}
            <div>
              <div style="font-size:.8rem">${item.name}</div>
              ${item.brand ? `<div style="font-size:.7rem;color:var(--n-400)">${item.brand}${item.size ? ' · ' + item.size : ''}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:.4rem .5rem;text-align:center;border-bottom:1px solid var(--n-100);font-size:.8rem">${item.qty}</td>
        <td style="padding:.4rem .5rem;text-align:right;border-bottom:1px solid var(--n-100);font-size:.8rem;font-weight:600">KES ${((item.price||0)*(item.qty||1)).toLocaleString()}</td>
      </tr>`).join('');

    return `
      <div class="admin-card" style="max-width:720px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">
          <div>
            <button id="odm-back" class="admin-btn" style="background:var(--n-100);color:var(--n-700);margin-bottom:.75rem">← Back to Orders</button>
            <h3 style="font-size:1.125rem;font-weight:700;color:var(--blue-d)">${o.id}</h3>
            <span style="font-size:.75rem;color:var(--n-400)">${o.date} ${o.time || ''}</span>
          </div>
          <span class="pill pill-${o.status}" style="font-size:.75rem">${o.status}</span>
        </div>

        <div style="background:var(--n-50);border-radius:var(--r-lg);padding:.875rem;margin-bottom:.875rem;font-size:.8125rem;line-height:1.8">
          <p><strong>Customer:</strong> ${o.customer?.name || '—'}</p>
          <p><strong>Phone:</strong> ${o.customer?.phone || '—'}</p>
          ${o.customer?.email ? `<p><strong>Email:</strong> ${o.customer.email}</p>` : ''}
          <p><strong>Zone:</strong> ${o.customer?.zone || '—'}</p>
          <p><strong>Address:</strong> ${o.customer?.address || '—'}</p>
          ${o.customer?.notes ? `<p><strong>Delivery Notes:</strong> ${o.customer.notes}</p>` : ''}
          <p><strong>Payment:</strong> <span style="text-transform:uppercase;font-weight:600">${o.payment || '—'}</span> · ${o.payment_status === 'paid' ? '<span style="color:var(--ok)">✅ Paid</span>' : '<span style="color:#F59E0B">⚠ Unpaid</span>'}</p>
          ${o.mpesa_ref ? `<p><strong>M-PESA Ref:</strong> ${o.mpesa_ref}</p>` : ''}
          ${o.coupon_code ? `<p><strong>Coupon:</strong> ${o.coupon_code} (−KES ${(o.coupon_discount||0).toLocaleString()})</p>` : ''}
          ${o.branch ? `<p><strong>Branch:</strong> ${o.branch}</p>` : ''}
          ${o.assigned_name ? `<p><strong>Staff:</strong> ${o.assigned_name}</p>` : ''}
        </div>

        <div style="margin-bottom:.875rem">
          <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--n-500);margin-bottom:.5rem">📦 ${(o.items||[]).length} item${(o.items||[]).length!==1?'s':''} · KES ${(o.total||0).toLocaleString()}</p>
          <div style="border:1px solid var(--n-100);border-radius:var(--r-md);overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:var(--n-100)">
                <th style="padding:.4rem .5rem;text-align:left;font-size:.7rem;text-transform:uppercase;color:var(--n-500)">Product</th>
                <th style="padding:.4rem .5rem;text-align:center;font-size:.7rem;text-transform:uppercase;color:var(--n-500)">Qty</th>
                <th style="padding:.4rem .5rem;text-align:right;font-size:.7rem;text-transform:uppercase;color:var(--n-500)">Total</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
        </div>

        <div style="background:var(--n-50);border-radius:var(--r-lg);padding:.875rem;margin-bottom:.875rem">
          <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--n-500);margin-bottom:.5rem">Update Status</p>
          <div style="display:flex;gap:.5rem">
            <select id="odm-status-sel" style="flex:1;padding:.4rem .75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.875rem;outline:none;background:var(--white)">
              ${['pending','confirmed','processing','delivered','cancelled']
                .map(s => `<option${s===o.status?' selected':''}>${s}</option>`).join('')}
            </select>
            <button class="admin-btn admin-btn-primary" id="odm-save-status">Save</button>
          </div>
        </div>

        <div style="margin-bottom:.875rem">
          <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--n-500);margin-bottom:.5rem">📝 Notes</p>
          <div id="odm-notes-list" style="max-height:200px;overflow-y:auto;margin-bottom:.5rem">${renderOrderNotesHtml(notes)}</div>
          <textarea id="odm-note-text" rows="2" placeholder="Add a note…"
            style="width:100%;border:1.5px solid var(--n-200);border-radius:var(--r-md);padding:.5rem .75rem;font-size:.8125rem;font-family:inherit;resize:vertical;outline:none"></textarea>
          <div style="display:flex;gap:.5rem;align-items:center;margin-top:.375rem">
            <label style="display:flex;align-items:center;gap:.375rem;font-size:.75rem;color:var(--n-600);cursor:pointer">
              <input type="checkbox" id="odm-note-internal"> Admin only
            </label>
            <button class="admin-btn admin-btn-primary btn-sm" id="odm-save-note" style="margin-left:auto">Add Note</button>
          </div>
        </div>

        <div style="display:flex;gap:.625rem;flex-wrap:wrap;padding-top:.75rem;border-top:1px solid var(--n-100)">
          ${o.payment_status !== 'paid' && o.payment === 'cod'
            ? `<button class="admin-btn admin-btn-primary" id="odm-confirm-payment" style="background:var(--ok)">💵 Confirm Paid</button>`
            : ''}
          <button class="admin-btn admin-btn-primary" id="odm-print">🖨 Print Invoice</button>
          <button class="admin-btn" id="odm-back-btn" style="background:var(--n-100);color:var(--n-700)">← Back to Orders</button>
        </div>
      </div>`;
  }

  function bindOrderDetailEvents(o) {
    const back = () => switchTab('orders');
    document.getElementById('odm-back').addEventListener('click', back);
    document.getElementById('odm-back-btn').addEventListener('click', back);
    document.getElementById('odm-print').addEventListener('click', () => generateInvoice(o.id));

    document.getElementById('odm-confirm-payment')?.addEventListener('click', async () => {
      try {
        await fetch(`${Config.BASE_URL}/orders/${encodeURIComponent(o.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('ibh_session')}`,
          },
          body: JSON.stringify({ payment_status: 'paid', status: 'delivered' }),
        });
        App.toast(`Order ${o.id} — payment confirmed ✅`, 'success');
        await showOrderDetail(o.id);
      } catch { App.toast('Failed to confirm payment', 'error'); }
    });

    document.getElementById('odm-save-status').addEventListener('click', async () => {
      const status = document.getElementById('odm-status-sel').value;
      await API.updateOrderStatus(o.id, status);
      o.status = status;
      App.toast('Status updated', 'success');
    });

    document.getElementById('odm-save-note').addEventListener('click', async () => {
      const note = document.getElementById('odm-note-text').value.trim();
      const internal = document.getElementById('odm-note-internal').checked;
      if (!note) return;
      await API.addOrderNote(o.id, note, internal);
      const updated = await API.getOrderNotes(o.id);
      document.getElementById('odm-notes-list').innerHTML = renderOrderNotesHtml(updated);
      document.getElementById('odm-note-text').value = '';
      App.toast('Note saved', 'success');
    });
  }

  /* ═══════════════════════════
     PRODUCTS
  ═══════════════════════════ */
  async function buildProducts() {
    const allPs = await API.getProducts({ admin: true });
    const ps = _productSearch
      ? allPs.filter(p =>
          p.name.toLowerCase().includes(_productSearch.toLowerCase()) ||
          p.brand.toLowerCase().includes(_productSearch.toLowerCase()) ||
          p.subcat.toLowerCase().includes(_productSearch.toLowerCase())
        )
      : allPs;

    return `
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Products <span style="color:var(--blue)">(${ps.length}${_productSearch ? ' of ' + allPs.length : ' total'})</span></h4>
          <button class="admin-btn admin-btn-primary" onclick="Admin.switchTab('add-product')">+ Add Product</button>
        </div>

        <!-- Search Filter -->
        <div class="product-filters" style="margin-bottom:1.25rem">
          <input id="prod-search" class="product-filter-input" type="search" placeholder="Search by name, brand, or category…" value="${_productSearch}" style="flex:1;padding:0.75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:0.875rem">
          ${_productSearch ? `<button class="admin-btn" id="prod-clear" style="background:var(--err-bg);color:var(--err);margin-left:0.5rem">✕ Clear</button>` : ''}
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Image</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Visible</th><th>Actions</th></tr></thead>
            <tbody>
              ${ps.length ? ps.map((p, idx) => `
                <tr>
                  <td style="color:var(--n-400);font-size:.75rem;font-weight:600">${idx + 1}</td>
                  <td>${p.imageMain
                    ? `<img src="${p.imageMain}" alt="${p.name}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;">`
                    : `<span style="font-size:1.375rem">${p.emoji}</span>`}
                  </td>
                  <td><strong>${p.name}</strong><br><span style="font-size:.7rem;color:var(--n-400)">${p.gender}</span></td>
                  <td>${p.brand}</td>
                  <td><span class="pill pill-processing" style="font-size:.6rem">${p.subcat}</span></td>
                  <td>KES ${p.price.toLocaleString()}${p.oldPrice ? `<br><span style="font-size:.7rem;color:var(--n-400);text-decoration:line-through">KES ${p.oldPrice.toLocaleString()}</span>` : ''}</td>
                  <td><span class="pill ${p.stock > 0 ? 'pill-confirmed' : 'pill-cancelled'}">${p.stock}</span></td>
                  <td><span class="pill ${p.isVisible !== false ? 'pill-confirmed' : 'pill-cancelled'}">${p.isVisible !== false ? 'Yes' : 'Hidden'}</span></td>
                  <td style="white-space:nowrap">
                    <button class="admin-btn admin-btn-primary btn-sm" data-edit-product="${p.id}" style="margin-right:.375rem">Edit</button>
                    <button class="admin-btn admin-btn-danger btn-sm" data-del-product="${p.id}">Delete</button>
                  </td>
                </tr>`).join('')
              : `<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--n-400)">No products match "${_productSearch}"</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     BRANDS
  ═══════════════════════════ */
  async function buildBrands() {
    const brands = await API.getBrandsAsync();
    return `
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Brands (${brands.length})</h4>
        </div>

        <!-- Add brand form -->
        <div class="brand-add-form admin-card" style="margin-bottom:0">
          <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--n-600);margin-bottom:.75rem">Add New Brand</p>
          <div class="form-row">
            <div class="form-group" style="margin:0">
              <label>Brand Name</label>
              <input id="new-brand-name" type="text" placeholder="e.g. Gucci">
            </div>
            <div class="form-group" style="margin:0">
              <label>Brand Logo / Image</label>
              <div class="img-upload-group">
                <input id="new-brand-img-url" type="url" placeholder="Paste URL…">
                <label class="img-upload-file-btn">
                  📎 Upload
                  <input type="file" id="new-brand-img-file" accept="image/*" hidden>
                </label>
              </div>
              <div class="img-preview-wrap" id="new-brand-img-preview"></div>
            </div>
          </div>
          <button class="admin-btn admin-btn-success" id="add-brand-btn" style="margin-top:.75rem">+ Add Brand</button>
        </div>

        <div class="brand-admin-grid" id="brands-grid" style="margin-top:1.25rem">
          ${brands.map(b => buildBrandCard(b)).join('')}
        </div>
      </div>`;
  }

  function buildBrandCard(b) {
    return `
      <div class="brand-admin-card" data-brand-name="${b.name}">
        <div class="brand-admin-img">
          ${b.image
            ? `<img src="${b.image}" alt="${b.name}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`
            : `<span style="font-size:1.75rem;font-weight:800;color:var(--blue)">${b.name[0]}</span>`}
        </div>
        <div class="brand-admin-name">${b.name}</div>
        <div class="brand-admin-actions">
          <button class="admin-btn admin-btn-primary btn-sm" data-edit-brand="${b.name}">Edit</button>
          <button class="admin-btn admin-btn-danger btn-sm"  data-del-brand="${b.name}">Delete</button>
        </div>
      </div>`;
  }

  function buildBrandEditCard(b) {
    return `
      <div class="brand-admin-card brand-admin-card--edit" data-editing-brand="${b.name}">
        <div class="form-group" style="margin-bottom:.5rem">
          <label>Name</label>
          <input class="brand-edit-name" type="text" value="${b.name}">
        </div>
        <div class="form-group" style="margin-bottom:.5rem">
          <label>Logo / Image</label>
          <div class="img-upload-group">
            <input class="brand-edit-img-url" type="url" placeholder="URL…" value="${b.image || ''}">
            <label class="img-upload-file-btn">📎
              <input type="file" class="brand-edit-img-file" accept="image/*" hidden>
            </label>
          </div>
          <div class="img-preview-wrap brand-edit-preview"></div>
        </div>
        <div style="display:flex;gap:.375rem">
          <button class="admin-btn admin-btn-success btn-sm brand-save-btn" data-orig-name="${b.name}">Save</button>
          <button class="admin-btn btn-sm brand-cancel-btn">Cancel</button>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     CATEGORIES
  ═══════════════════════════ */
  const _mainCatEmoji = { perfume: '🌸', hair: '💆', body: '🧴' };

  function buildMainCatCard(mc) {
    return `
      <div class="brand-admin-card" data-main-cat-id="${mc.id}" data-main-cat-slug="${mc.slug}">
        <div class="brand-admin-img" style="background:var(--blue-xl)">
          ${mc.image
            ? `<img src="${mc.image}" alt="${mc.name}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`
            : `<span style="font-size:2rem">${_mainCatEmoji[mc.slug] || mc.name[0]}</span>`}
        </div>
        <div class="brand-admin-name">${mc.name}</div>
        <div class="brand-admin-actions">
          <button class="admin-btn admin-btn-primary btn-sm" data-edit-main-cat="${mc.id}">Edit Logo</button>
        </div>
      </div>`;
  }

  async function buildCategories() {
    const [mainCats, raw] = await Promise.all([
      API.getMainCategoriesAsync(),
      API.getCategoriesAsync(),
    ]);
    const cats = raw.map(c => typeof c === 'string' ? { id: null, name: c } : c);
    return `
      <!-- Main Categories -->
      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head">
          <h4>Main Categories (3)</h4>
          <span style="font-size:.75rem;color:var(--n-400)">Upload logo for each main category</span>
        </div>
        <div class="brand-admin-grid" id="main-cats-grid">
          ${mainCats.map(mc => buildMainCatCard(mc)).join('')}
        </div>
      </div>

      <!-- Subcategories -->
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Subcategories (${cats.length})</h4>
        </div>

        <div style="display:flex;gap:.625rem;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap">
          <input id="new-cat-name" type="text" placeholder="New subcategory name…"
            style="flex:1;min-width:180px;border:1.5px solid var(--n-200);border-radius:var(--r-md);padding:.5rem .75rem;font-size:.875rem;outline:none;color:var(--n-900)">
          <button class="admin-btn admin-btn-success" id="add-cat-btn">+ Add Subcategory</button>
        </div>

        <div class="brand-admin-grid" id="cats-grid">
          ${cats.length ? cats.map(c => `
            <div class="brand-admin-card" data-cat-id="${c.id || ''}" data-cat-name="${c.name}">
              <div class="brand-admin-img" style="background:var(--blue-xl)">
                <span style="font-size:1.25rem;font-weight:800;color:var(--blue)">${c.name[0].toUpperCase()}</span>
              </div>
              <div class="brand-admin-name">${c.name}</div>
              <div class="brand-admin-actions">
                <button class="admin-btn admin-btn-primary btn-sm" data-edit-cat="${c.name}">Edit</button>
                <button class="admin-btn admin-btn-danger btn-sm" data-del-cat="${c.id || c.name}">Delete</button>
              </div>
            </div>`).join('')
          : `<p style="color:var(--n-400);font-size:.875rem;grid-column:1/-1">No subcategories yet. Add one above.</p>`}
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     ADD / EDIT PRODUCT
  ═══════════════════════════ */
  async function buildAddProduct(prefill = null) {
    const brands  = await API.getBrandsAsync();
    const rawCats = await API.getCategoriesAsync();
    const cats    = rawCats.map(c => typeof c === 'string' ? c : c.name);
    const v      = key => prefill ? (prefill[key] ?? '') : '';
    const checked = key => prefill?.[key] ? 'checked' : '';
    const selBrand = brands.map(b =>
      `<option value="${b.name}"${b.name === v('brand') ? ' selected' : ''}>${b.name}</option>`).join('');
    const selCat = cats.map(c =>
      `<option${c === v('subcat') ? ' selected' : ''}>${c}</option>`).join('');

    return `
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>${prefill ? 'Edit Product' : 'Add New Product'}</h4>
          ${prefill ? `<span style="font-size:.75rem;color:var(--n-400)">ID: ${prefill.id}</span>` : ''}
        </div>

        <!-- Images -->
        <p class="admin-section-label">Product Images</p>
        <div class="form-group">
          <label>Main Image <span style="color:var(--err)">*</span> <span style="font-weight:400;color:var(--n-400)">(primary)</span></label>
          <div class="img-upload-group">
            <input id="ap-img-main" type="url" placeholder="Paste image URL…" value="${v('imageMain')}" required>
            <label class="img-upload-file-btn">📎 Upload<input type="file" id="ap-img-main-file" accept="image/*" hidden></label>
          </div>
          <div class="img-preview-wrap" id="ap-img-main-preview"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Additional Image 1</label>
            <div class="img-upload-group">
              <input id="ap-img-alt1" type="url" placeholder="Paste URL…" value="${v('imageAlt1')}">
              <label class="img-upload-file-btn">📎<input type="file" id="ap-img-alt1-file" accept="image/*" hidden></label>
            </div>
            <div class="img-preview-wrap" id="ap-img-alt1-preview"></div>
          </div>
          <div class="form-group">
            <label>Additional Image 2</label>
            <div class="img-upload-group">
              <input id="ap-img-alt2" type="url" placeholder="Paste URL…" value="${v('imageAlt2')}">
              <label class="img-upload-file-btn">📎<input type="file" id="ap-img-alt2-file" accept="image/*" hidden></label>
            </div>
            <div class="img-preview-wrap" id="ap-img-alt2-preview"></div>
          </div>
        </div>

        <!-- Details -->
        <p class="admin-section-label" style="margin-top:.5rem">Product Details <span style="font-size:.6875rem;font-weight:400;color:var(--err)">* required</span></p>
        <div class="form-row">
          <div class="form-group"><label>Product Name <span style="color:var(--err)">*</span></label><input id="ap-name" type="text" placeholder="Dior Sauvage 100ml" value="${v('name')}" required></div>
          <div class="form-group"><label>Brand <span style="color:var(--err)">*</span></label>
            <select id="ap-brand" required><option value="">Select Brand</option>${selBrand}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Category <span style="color:var(--err)">*</span></label>
            <select id="ap-cat" required>
              <option value="">Select</option>
              <option value="perfume"${v('cat') === 'perfume' ? ' selected' : ''}>Perfume</option>
              <option value="hair"${v('cat') === 'hair' ? ' selected' : ''}>Hair Care</option>
              <option value="body"${v('cat') === 'body' ? ' selected' : ''}>Body Care</option>
            </select>
          </div>
          <div class="form-group"><label>Subcategory <span style="color:var(--err)">*</span></label>
            <select id="ap-subcat" required><option value="">Select</option>${selCat}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Gender <span style="color:var(--err)">*</span></label>
            <select id="ap-gender" required>
              <option value="">Select</option>
              ${['Male','Female','Unisex','Children','All'].map(g =>
                `<option${g === v('gender') ? ' selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Emoji Icon <span style="font-weight:400;color:var(--n-400)">(fallback, optional)</span></label>
            <input id="ap-emoji" type="text" placeholder="🌸" maxlength="4" value="${v('emoji')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Price (KES) <span style="color:var(--err)">*</span></label><input id="ap-price" type="number" min="0" placeholder="5000" value="${v('price')}" required></div>
          <div class="form-group"><label>Old Price (KES) <span style="font-weight:400;color:var(--n-400)">(optional, for discount)</span></label><input id="ap-old-price" type="number" min="0" placeholder="Leave blank if no discount" value="${v('oldPrice') || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Stock <span style="color:var(--err)">*</span></label><input id="ap-stock" type="number" min="0" placeholder="10" value="${v('stock')}" required></div>
          <div class="form-group"><label>Sizes <span style="font-weight:400;color:var(--n-400)">(comma separated, optional)</span></label><input id="ap-sizes" type="text" placeholder="50ml, 100ml" value="${prefill?.sizes?.join(', ') || ''}"></div>
        </div>
        <div class="form-group"><label>Description <span style="color:var(--err)">*</span></label><textarea id="ap-desc" rows="3" placeholder="Brief product description…" style="resize:vertical" required>${v('desc')}</textarea></div>

        <!-- Flags -->
        <div class="form-group">
          <div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
            <label class="flag-label"><input type="checkbox" id="ap-new"     ${checked('isNew')}>    New Arrival</label>
            <label class="flag-label"><input type="checkbox" id="ap-trend"   ${checked('isTrend')}> Trending</label>
            <label class="flag-label"><input type="checkbox" id="ap-feat"    ${checked('isFeat')}>  Best Seller</label>
            <label class="flag-label"><input type="checkbox" id="ap-on-sale" ${checked('isOnSale')}> On Sale</label>
            <label class="flag-label"><input type="checkbox" id="ap-hot"     ${checked('isHot')}>   Hot</label>
            <label class="flag-label visibility-flag">
              <input type="checkbox" id="ap-visible" ${prefill ? (prefill.isVisible !== false ? 'checked' : '') : 'checked'}>
              <span>Visible on Store</span>
            </label>
          </div>
        </div>

        <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap">
          <button class="admin-btn admin-btn-success" id="save-product-btn" style="padding:.625rem 1.5rem;font-size:.875rem">
            ${prefill ? '✓ Update Product' : '✓ Save Product'}
          </button>
          ${prefill ? `<button class="admin-btn" id="cancel-edit-product-btn" style="padding:.625rem 1.25rem;font-size:.875rem;background:var(--n-100);color:var(--n-700)">✕ Cancel</button>` : ''}
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     USERS
  ═══════════════════════════ */
  async function buildUsers() {
    const isAdmin = window.AdminUser?.role === 'admin';
    const users = await API.getUsers();
    const totalRevenue  = users.reduce((s, u) => s + u.totalSpent, 0);
    const totalOrders   = users.reduce((s, u) => s + u.orderCount, 0);
    const avgOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

    return `
      <div class="admin-stats">
        <div class="admin-stat"><div class="admin-stat-icon">👤</div><div class="admin-stat-num">${users.length}</div><div class="admin-stat-label">Customers</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">📦</div><div class="admin-stat-num">${totalOrders}</div><div class="admin-stat-label">Total Orders</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">💰</div><div class="admin-stat-num">KES ${totalRevenue.toLocaleString()}</div><div class="admin-stat-label">Revenue</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">🧾</div><div class="admin-stat-num">KES ${avgOrderValue.toLocaleString()}</div><div class="admin-stat-label">Avg Order</div></div>
      </div>

      ${isAdmin ? `
      <!-- Create new user — admin only -->
      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>Create Admin / Staff User</h4></div>
        <div class="form-row">
          <div class="form-group" style="margin:0"><label>Full Name</label><input id="nu-name" type="text" placeholder="Jane Wanjiku"></div>
          <div class="form-group" style="margin:0"><label>Phone</label><input id="nu-phone" type="tel" placeholder="0700000000"></div>
        </div>
        <div class="form-row" style="margin-top:.625rem">
          <div class="form-group" style="margin:0"><label>Email</label><input id="nu-email" type="email" placeholder="jane@ibh.co.ke"></div>
          <div class="form-group" style="margin:0">
            <label>Role</label>
            <select id="nu-role" onchange="document.getElementById('nu-branch-wrap').style.display=this.value==='branch_manager'?'':'none'">
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div id="nu-branch-wrap" style="display:none;margin-top:.625rem">
          <div class="form-group" style="margin:0">
            <label>Assign Branch <span style="color:var(--err)">*</span></label>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.5rem;margin-top:.375rem" id="nu-branch-cards">
              ${(window.Config?.BRANCHES || []).map(b => `
                <label style="display:flex;flex-direction:column;gap:.25rem;padding:.625rem .875rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);cursor:pointer;transition:border-color .15s,background .15s" class="branch-card-label">
                  <span style="display:flex;align-items:center;gap:.375rem">
                    <input type="radio" name="nu-branch-radio" value="${b.name}" class="nu-branch-radio" style="accent-color:var(--blue)">
                    <strong style="font-size:.8125rem;color:var(--n-900)">${b.name}</strong>
                  </span>
                  ${b.phone ? `<span style="font-size:.6875rem;color:var(--n-500);padding-left:1.25rem">${b.phone}</span>` : ''}
                </label>`).join('')}
            </div>
            <input type="hidden" id="nu-branch" value="">
          </div>
        </div>
        <button class="admin-btn admin-btn-success" id="create-user-btn" style="margin-top:.75rem">+ Create User</button>
      </div>
      ` : ''}

      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Customers <span style="color:var(--blue)">(${users.length})</span></h4>
          <input id="user-search" type="search" placeholder="Search name, phone…"
            style="padding:.4rem .75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;outline:none;width:200px">
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Orders</th><th>Total Spent</th><th>Last Order</th><th>Actions</th></tr></thead>
            <tbody id="users-tbody">
              ${users.length ? users.map((u, i) => `
                <tr data-user-id="${u.id}" data-user-phone="${u.phone}" data-user-branch="${u.branch || ''}">
                  <td style="color:var(--n-400);font-size:.75rem">${i + 1}</td>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.phone}</td>
                  <td>${u.email || '<span style="color:var(--n-400)">—</span>'}</td>
                  <td>
                    <span class="pill pill-${u.role === 'admin' ? 'confirmed' : u.role === 'staff' ? 'pending' : 'cancelled'}"
                      style="text-transform:capitalize">${u.role || 'customer'}</span>
                  </td>
                  <td><span class="pill pill-confirmed">${u.orderCount}</span></td>
                  <td><strong>KES ${u.totalSpent.toLocaleString()}</strong></td>
                  <td>${u.lastOrder || '—'}</td>
                  <td style="display:flex;gap:.375rem;flex-wrap:wrap">
                    <button class="admin-btn admin-btn-primary btn-sm" data-edit-user="${u.id}">Edit</button>
                    ${isAdmin ? `<button class="admin-btn btn-sm" data-reset-pw="${u.id}" data-reset-pw-name="${u.name}" style="background:#FEF3C7;color:#92400E">🔑 Reset PW</button>` : ''}
                    <button class="admin-btn admin-btn-danger btn-sm"  data-del-user="${u.id}">Delete</button>
                  </td>
                </tr>`).join('')
              : `<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--n-400)">No users yet. Create one above.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     DELIVERY AREAS
  ═══════════════════════════ */
  async function buildDeliveryAreas() {
    const areas = await API.getDeliveryAreas();
    const totalAreas = areas.length;
    const freeCount  = areas.filter(a => Number(a.price) === 0).length;

    return `
      <div class="admin-stats">
        <div class="admin-stat"><div class="admin-stat-icon">📍</div><div class="admin-stat-num">${totalAreas}</div><div class="admin-stat-label">Total Zones</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">🆓</div><div class="admin-stat-num">${freeCount}</div><div class="admin-stat-label">Free Delivery Zones</div></div>
        <div class="admin-stat"><div class="admin-stat-icon">💸</div><div class="admin-stat-num">${totalAreas - freeCount}</div><div class="admin-stat-label">Paid Delivery Zones</div></div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Delivery Areas &amp; Prices</h4>
          <span style="font-size:.75rem;color:var(--n-400)">Set delivery cost per area / zone</span>
        </div>

        <!-- Add form -->
        <div class="form-row" style="margin-bottom:1.25rem;align-items:flex-end">
          <div class="form-group" style="margin:0">
            <label>Area / Zone Name</label>
            <input id="da-name" type="text" placeholder="e.g. Westlands">
          </div>
          <div class="form-group" style="margin:0">
            <label>Delivery Price (KES) — enter 0 for free</label>
            <input id="da-price" type="number" min="0" step="0.01" placeholder="e.g. 200">
          </div>
          <button class="admin-btn admin-btn-success" id="add-da-btn" style="height:fit-content;margin-top:auto">+ Add Area</button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table" id="da-table">
            <thead><tr>
              <th>#</th><th>Area / Zone</th><th>Delivery Price (KES)</th><th>Actions</th>
            </tr></thead>
            <tbody id="da-tbody">
              ${buildDeliveryAreaRows(areas)}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function buildDeliveryAreaRows(areas) {
    if (!areas.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:2.5rem;color:var(--n-400)">No delivery areas yet. Add one above.</td></tr>`;
    }
    return areas.map((a, i) => `
      <tr data-area-id="${a.id}">
        <td style="color:var(--n-400);font-size:.75rem;font-weight:600">${i + 1}</td>
        <td><strong>${a.name}</strong></td>
        <td>
          ${Number(a.price) === 0
            ? '<span class="pill pill-confirmed">Free</span>'
            : `KES ${Number(a.price).toLocaleString()}`}
        </td>
        <td style="white-space:nowrap">
          <button class="admin-btn admin-btn-primary btn-sm" data-edit-da="${a.id}" style="margin-right:.375rem">Edit</button>
          <button class="admin-btn admin-btn-danger btn-sm"  data-del-da="${a.id}">Delete</button>
        </td>
      </tr>`).join('');
  }

  /* ═══════════════════════════
     COUPONS
  ═══════════════════════════ */
  async function buildCoupons() {
    const coupons = await API.getCoupons(true);
    const fmt = c => {
      const disc  = c.type === 'percent' ? `${c.value}% off` : `KES ${c.value} off`;
      const min   = c.min_order > 0 ? `min KES ${c.min_order.toLocaleString()}` : 'no minimum';
      const uses  = c.max_uses > 0 ? `${c.uses}/${c.max_uses} uses` : `${c.uses} uses`;
      const exp   = c.expires_at ? c.expires_at : 'No expiry';
      const badge = c.is_active
        ? `<span class="pill pill-success" style="font-size:.6875rem">Active</span>`
        : `<span class="pill" style="font-size:.6875rem;background:var(--n-100);color:var(--n-500)">Inactive</span>`;
      return `<tr>
        <td>${c.id}</td>
        <td><strong style="font-family:monospace;letter-spacing:.05em">${c.code}</strong></td>
        <td>${disc}</td>
        <td>${min}</td>
        <td>${uses}</td>
        <td>${exp}</td>
        <td>${badge}</td>
        <td style="white-space:nowrap">
          <button class="admin-btn btn-sm" data-toggle-coupon="${c.id}" data-active="${c.is_active}"
            style="background:${c.is_active ? 'var(--n-100)' : 'var(--blue-xl)'};color:${c.is_active ? 'var(--n-600)' : 'var(--blue)'}">
            ${c.is_active ? 'Disable' : 'Enable'}
          </button>
          <button class="admin-btn btn-sm admin-btn-danger" data-del-coupon="${c.id}" style="margin-left:.25rem">Delete</button>
        </td>
      </tr>`;
    };
    return `
      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>Coupon / Promo Codes (${coupons.length})</h4></div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Code</th><th>Discount</th><th>Min Order</th><th>Uses</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${coupons.length ? coupons.map(fmt).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--n-400);padding:1.5rem">No coupons yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head"><h4>Add New Coupon</h4></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem;padding:0 1rem 1rem">
          <div class="form-group" style="margin:0">
            <label>Code <span style="color:var(--err)">*</span></label>
            <input id="cp-code" type="text" class="form-control" placeholder="e.g. SAVE20" style="text-transform:uppercase">
          </div>
          <div class="form-group" style="margin:0">
            <label>Type</label>
            <select id="cp-type" class="form-control">
              <option value="percent">Percent (%) off</option>
              <option value="fixed">Fixed (KES) off</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label>Value <span style="color:var(--err)">*</span></label>
            <input id="cp-value" type="number" min="0" step="0.01" class="form-control" placeholder="e.g. 10">
          </div>
          <div class="form-group" style="margin:0">
            <label>Min Order (KES)</label>
            <input id="cp-min" type="number" min="0" step="1" class="form-control" placeholder="0 = none" value="0">
          </div>
          <div class="form-group" style="margin:0">
            <label>Max Uses</label>
            <input id="cp-maxuses" type="number" min="0" step="1" class="form-control" placeholder="0 = unlimited" value="0">
          </div>
          <div class="form-group" style="margin:0">
            <label>Expires</label>
            <input id="cp-expires" type="date" class="form-control">
          </div>
        </div>
        <div style="padding:.25rem 1rem 1rem">
          <button class="admin-btn admin-btn-primary" id="add-coupon-btn">+ Add Coupon</button>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     BRANCHES
  ═══════════════════════════ */
  async function buildBranches() {
    const branches = await API.getBranches();
    const rows = branches.length
      ? branches.map(b => `
          <tr data-branch-id="${b.id}">
            <td>${b.id}</td>
            <td><strong>${b.name}</strong></td>
            <td>${b.location || '—'}</td>
            <td>${b.phone || '—'}</td>
            <td style="white-space:nowrap">
              <button class="admin-btn btn-sm" data-edit-branch="${b.id}">Edit</button>
              <button class="admin-btn btn-sm admin-btn-danger" data-del-branch="${b.id}" style="margin-left:.25rem">Delete</button>
            </td>
          </tr>`)
        .join('')
      : `<tr><td colspan="5" style="text-align:center;color:var(--n-400);padding:1.5rem">No branches yet. Add one below.</td></tr>`;

    return `
      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>Branches (${branches.length})</h4></div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Branch Name</th><th>Location</th><th>Phone</th><th>Actions</th></tr></thead>
            <tbody id="branches-tbody">${rows}</tbody>
          </table>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-head"><h4>Add Branch</h4></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;padding:0 1rem 1rem">
          <div class="form-group" style="margin:0">
            <label>Branch Name <span style="color:var(--err)">*</span></label>
            <input id="br-name" class="form-control" placeholder="e.g. Eastleigh Branch">
          </div>
          <div class="form-group" style="margin:0">
            <label>Location / Address</label>
            <input id="br-location" class="form-control" placeholder="e.g. Eastleigh, Nairobi">
          </div>
          <div class="form-group" style="margin:0">
            <label>Phone</label>
            <input id="br-phone" class="form-control" type="tel" placeholder="+254 700 000 001">
          </div>
        </div>
        <div style="padding:.25rem 1rem 1rem">
          <button class="admin-btn admin-btn-primary" id="add-branch-btn">+ Add Branch</button>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     SETTINGS
  ═══════════════════════════ */
  async function buildSettings() {
    const heroBg   = localStorage.getItem('ibh_hero_bg')   || '';
    const heroLogo = localStorage.getItem('ibh_hero_logo') || '';
    const s = await API.getSettings().catch(() => ({}));
    const notifText    = s.notif_text    || '';
    const notifActive  = s.notif_active  === '1';
    const notifBadge   = s.notif_badge   || 'OFFER';
    const orderEmails  = (s.order_notification_emails || '').split(',').map(e => e.trim()).filter(Boolean);
    return `
      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>📧 Order Notification Emails</h4></div>
        <div style="padding:.25rem 1rem .75rem">
          <p style="font-size:.8125rem;color:var(--n-500);margin-bottom:.75rem">
            Every address below gets an email when a new order comes in. One per line. Leave blank to fall back to
            every Admin / Staff / Branch Manager account's email automatically.
          </p>
          <textarea id="order-notif-emails" rows="4" placeholder="jane@ibh.co.ke&#10;east@ibh.co.ke"
            style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;font-family:inherit;resize:vertical;outline:none">${orderEmails.join('\n')}</textarea>
          <p style="font-size:.75rem;color:#92400E;background:#FEF3C7;border-radius:var(--r-md);padding:.5rem .625rem;margin-top:.625rem;line-height:1.5">
            ⚠ Until a sending domain is verified in Resend, emails only deliver to the address that owns the Resend account
            (currently ahmedafd180@gmail.com). Other addresses added here will be skipped until you verify a domain at
            resend.com/domains.
          </p>
          <button class="admin-btn admin-btn-primary" id="save-order-notif-btn" style="margin-top:.75rem">✓ Save Recipients</button>
        </div>
      </div>

      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>📢 Notification Bar Announcement</h4></div>
        <div style="padding:.25rem 1rem .75rem">
          <p style="font-size:.8125rem;color:var(--n-500);margin-bottom:.75rem">This text shows at the top of the store. Leave blank to auto-show an active coupon instead.</p>
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem">
            <label style="display:flex;align-items:center;gap:.375rem;font-size:.875rem;font-weight:600;cursor:pointer">
              <input type="checkbox" id="notif-active-chk" ${notifActive ? 'checked' : ''}
                style="width:16px;height:16px;accent-color:var(--blue)">
              Show notification bar
            </label>
          </div>
          <div style="display:grid;grid-template-columns:100px 1fr;gap:.625rem;margin-bottom:.75rem">
            <div class="form-group" style="margin:0">
              <label>Badge Label</label>
              <input id="notif-badge" class="form-control" value="${notifBadge}" placeholder="OFFER">
            </div>
            <div class="form-group" style="margin:0">
              <label>Announcement Text</label>
              <input id="notif-text" class="form-control" value="${notifText}"
                placeholder="e.g. Free delivery within CBD — Shop now!">
            </div>
          </div>
          <button class="admin-btn admin-btn-primary" id="save-notif-btn">✓ Save Announcement</button>
        </div>
      </div>

      <div class="admin-card" style="margin-bottom:1.25rem">
        <div class="admin-card-head"><h4>Hero Section Background</h4></div>
        <div class="form-group">
          <label>Background Image or Video</label>
          <div class="img-upload-group">
            <input id="hero-bg-url" type="url" value="${heroBg}" placeholder="https://… (.jpg, .png, .mp4, .webm)">
            <label class="img-upload-file-btn">📎 Upload<input type="file" id="hero-bg-file" accept="image/*,video/*" hidden></label>
          </div>
          <div class="img-preview-wrap" id="hero-bg-preview" style="margin-top:.625rem"></div>
          <p style="font-size:.75rem;color:var(--n-400);margin-top:.375rem">Supports images (JPG, PNG, WebP) and videos (MP4, WebM). Leave blank for the default video.</p>
        </div>
        <div class="form-row" style="margin-top:.5rem">
          <button class="admin-btn admin-btn-success" id="save-settings-btn" style="padding:.625rem 1.5rem">✓ Save Background</button>
          ${heroBg ? `<button class="admin-btn admin-btn-danger" id="clear-settings-btn" style="padding:.625rem 1.5rem">✕ Reset to Default</button>` : ''}
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head"><h4>M-Pesa &amp; Payment Settings</h4></div>
        <div class="form-row">
          <div class="form-group" style="margin:0">
            <label>M-Pesa Till / Paybill Number</label>
            <input type="text" id="mpesa-till" placeholder="123456" value="${window.Config?.MPESA_TILL || ''}">
          </div>
          <div class="form-group" style="margin:0">
            <label>M-Pesa Business Name</label>
            <input type="text" id="mpesa-name" placeholder="Inspiring Beauty Hub" value="${window.Config?.MPESA_NAME || ''}">
          </div>
        </div>
        <button class="admin-btn admin-btn-success" id="save-mpesa-btn" style="margin-top:.75rem;padding:.625rem 1.5rem">✓ Save M-Pesa Settings</button>
      </div>`;
  }

  /* ═══════════════════════════
     INVOICE
  ═══════════════════════════ */
  async function generateInvoice(orderId) {
    const orders = await API.getOrders();
    const o = orders.find(x => x.id === orderId);
    if (!o) return;

    const statusColors = {
      confirmed: '#D1FAE5', pending: '#FEF3C7',
      delivered: '#DBEAFE', cancelled: '#FEE2E2', processing: '#E0E7FF',
    };
    const statusText = {
      confirmed: '#065F46', pending: '#92400E',
      delivered: '#1E40AF', cancelled: '#991B1B', processing: '#3730A3',
    };

    const itemsSubtotal = (o.items || []).reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
    const couponDiscount = o.coupon_discount || 0;
    const deliveryFee   = Math.max(0, (o.total || 0) - itemsSubtotal + couponDiscount);
    const logoUrl       = window.location.origin + '/assets/images/logo.jpeg';

    const rows = (o.items || []).map(item => `
      <tr>
        <td style="vertical-align:middle">
          <div style="display:flex;align-items:center;gap:.625rem">
            ${item.imageMain
              ? `<img src="${item.imageMain}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;border:1px solid #E8ECF4" onerror="this.style.display='none'">`
              : `<span style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#F1F5FF;border-radius:6px;font-size:1.25rem;flex-shrink:0">${item.emoji || '📦'}</span>`}
            <span>${item.name}</span>
          </div>
        </td>
        <td style="color:#666;vertical-align:middle">${item.brand || ''}</td>
        <td style="text-align:center;vertical-align:middle">${item.size || '—'}</td>
        <td style="text-align:center;vertical-align:middle">${item.qty || 1}</td>
        <td style="text-align:right;vertical-align:middle">KES ${(item.price || 0).toLocaleString()}</td>
        <td style="text-align:right;font-weight:700;vertical-align:middle">KES ${((item.price || 0) * (item.qty || 1)).toLocaleString()}</td>
      </tr>`).join('');

    const win = window.open('', '_blank', 'width=860,height=720');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Invoice — ${o.id}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:2rem;max-width:800px;margin:0 auto;font-size:14px}
        .no-print{text-align:center;margin-bottom:1.5rem}
        .print-btn{background:#1455A4;color:#fff;border:none;padding:.625rem 1.75rem;border-radius:6px;font-size:.875rem;cursor:pointer}
        .inv-header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1455A4;padding-bottom:1.25rem;margin-bottom:1.5rem}
        .inv-logo-wrap{display:flex;align-items:center;gap:.875rem}
        .inv-logo{width:56px;height:56px;object-fit:contain;border-radius:8px}
        .inv-brand-name{font-size:1.375rem;font-weight:800;color:#1455A4;line-height:1.1}
        .inv-tagline{font-size:.6875rem;color:#888;margin-top:2px}
        .inv-meta{text-align:right}
        .inv-id{font-size:1.125rem;font-weight:700;color:#1455A4}
        .inv-date{font-size:.8125rem;color:#666;margin-top:3px}
        .status-badge{display:inline-block;padding:3px 10px;border-radius:100px;font-size:.6875rem;font-weight:700;text-transform:uppercase;margin-top:6px;background:${statusColors[o.status]||'#E0E7FF'};color:${statusText[o.status]||'#1455A4'}}
        .inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-bottom:1.5rem}
        .inv-label{font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#aaa;margin-bottom:.375rem}
        .inv-name{font-size:.9375rem;font-weight:700}
        .inv-detail{font-size:.8125rem;color:#555;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:1.25rem}
        th{text-align:left;padding:.5rem .75rem;background:#F1F5FF;font-size:.6875rem;text-transform:uppercase;letter-spacing:.08em;color:#666}
        td{padding:.625rem .75rem;border-bottom:1px solid #E8ECF4;font-size:.8125rem}
        tr:last-child td{border-bottom:none}
        .totals-wrap{display:flex;justify-content:flex-end}
        .totals{width:280px}
        .tot-row{display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid #E8ECF4;font-size:.8125rem}
        .tot-row.grand{border-top:2px solid #1455A4;border-bottom:none;font-size:.9375rem;font-weight:800;color:#1455A4;padding-top:.5rem}
        .inv-footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #E8ECF4;text-align:center;font-size:.6875rem;color:#aaa}
        @media print{.no-print{display:none}body{padding:0}}
      </style>
    </head><body>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
      <div class="inv-header">
        <div class="inv-logo-wrap">
          <img src="${logoUrl}" alt="IBH" class="inv-logo" onerror="this.style.display='none'">
          <div>
            <div class="inv-brand-name">Inspiring Beauty Hub</div>
            <div class="inv-tagline">Premium Fragrances &amp; Beauty · Nairobi, Kenya</div>
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-id">INVOICE ${o.id}</div>
          <div class="inv-date">${o.date} ${o.time || ''}</div>
          <div><span class="status-badge">${o.status}</span></div>
        </div>
      </div>
      <div class="inv-parties">
        <div>
          <div class="inv-label">From</div>
          <div class="inv-name">Inspiring Beauty Hub</div>
          <div class="inv-detail">inspiringbeautyhub@gmail.com</div>
          <div class="inv-detail">+254 758 284 018</div>
          ${o.branch ? `<div class="inv-detail">Branch: ${o.branch}</div>` : ''}
        </div>
        <div>
          <div class="inv-label">Bill To</div>
          <div class="inv-name">${o.customer?.name || o.customer || 'Customer'}</div>
          ${o.customer?.phone ? `<div class="inv-detail">${o.customer.phone}</div>` : ''}
          ${o.customer?.email ? `<div class="inv-detail">${o.customer.email}</div>` : ''}
          ${o.customer?.zone ? `<div class="inv-detail">Zone: ${o.customer.zone}</div>` : ''}
          ${o.customer?.address ? `<div class="inv-detail">${o.customer.address}</div>` : ''}
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="min-width:200px">Product</th>
          <th>Brand</th>
          <th>Size</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Subtotal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-wrap">
        <div class="totals">
          <div class="tot-row"><span>Items Subtotal</span><span>KES ${itemsSubtotal.toLocaleString()}</span></div>
          ${couponDiscount > 0 ? `<div class="tot-row" style="color:#16A34A"><span>Coupon${o.coupon_code ? ' ('+o.coupon_code+')' : ''}</span><span>−KES ${couponDiscount.toLocaleString()}</span></div>` : ''}
          <div class="tot-row"><span>Delivery</span><span>${deliveryFee > 0 ? `KES ${deliveryFee.toLocaleString()}` : '<span style="color:#16A34A">Free</span>'}</span></div>
          <div class="tot-row"><span>Payment Method</span><span style="text-transform:uppercase;font-size:.6875rem;font-weight:600">${o.payment || '—'}</span></div>
          <div class="tot-row grand"><span>Total</span><span>KES ${(o.total || 0).toLocaleString()}</span></div>
        </div>
      </div>
      <div class="inv-footer">Thank you for shopping at Inspiring Beauty Hub · www.ibh.co.ke</div>
    </body></html>`);
    win.document.close();
  }

  /* ═══════════════════════════
     CONFIRM MODAL
  ═══════════════════════════ */
  function _showConfirm({ title = 'Confirm Delete', body, confirmLabel = 'Delete', onConfirm }) {
    document.getElementById('admin-confirm-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'admin-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)';
    overlay.innerHTML = `
      <div style="background:var(--white);border-radius:var(--r-xl);max-width:400px;width:100%;padding:2rem 1.75rem;box-shadow:var(--sh-xl);text-align:center">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--err-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;flex-shrink:0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </div>
        <h3 style="font-size:1rem;font-weight:700;color:var(--n-900);margin-bottom:.5rem">${title}</h3>
        <p style="font-size:.875rem;color:var(--n-500);margin-bottom:1.75rem;line-height:1.55">${body}</p>
        <div style="display:flex;gap:.75rem;justify-content:center">
          <button id="admin-confirm-cancel" class="admin-btn" style="padding:.625rem 1.5rem;background:var(--n-100);color:var(--n-700);font-weight:600">Cancel</button>
          <button id="admin-confirm-ok"     class="admin-btn admin-btn-danger" style="padding:.625rem 1.5rem;font-weight:600">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(); });
    document.getElementById('admin-confirm-cancel').addEventListener('click', cleanup);
    document.getElementById('admin-confirm-ok').addEventListener('click', () => { cleanup(); onConfirm(); });
  }

  /* ═══════════════════════════
     RESET PASSWORD MODAL
  ═══════════════════════════ */
  function _randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  function showResetPasswordModal(id, name) {
    document.getElementById('reset-pw-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'reset-pw-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)';
    overlay.innerHTML = `
      <div style="background:var(--white);border-radius:var(--r-xl);max-width:380px;width:100%;padding:1.75rem;box-shadow:var(--sh-xl)">
        <h3 style="font-size:1rem;font-weight:700;color:var(--n-900);margin-bottom:.25rem">Reset Password</h3>
        <p style="font-size:.8125rem;color:var(--n-500);margin-bottom:1rem">Set a new password for <strong>${name}</strong>. Share it with them securely — this does not send an email.</p>
        <div class="form-group" style="margin:0">
          <label>New Password</label>
          <div style="display:flex;gap:.375rem">
            <input id="rpw-input" type="text" value="${_randomPassword()}" minlength="6"
              style="flex:1;padding:.5rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.875rem;outline:none;font-family:monospace">
            <button id="rpw-generate" class="admin-btn" title="Generate new random password" style="padding:.5rem .625rem">🎲</button>
          </div>
        </div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.25rem">
          <button id="rpw-cancel" class="admin-btn" style="padding:.5rem 1.25rem;background:var(--n-100);color:var(--n-700);font-weight:600">Cancel</button>
          <button id="rpw-save" class="admin-btn admin-btn-success" style="padding:.5rem 1.25rem;font-weight:600">Reset Password</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(); });
    document.getElementById('rpw-cancel').addEventListener('click', cleanup);
    document.getElementById('rpw-generate').addEventListener('click', () => {
      document.getElementById('rpw-input').value = _randomPassword();
    });
    document.getElementById('rpw-save').addEventListener('click', async () => {
      const password = document.getElementById('rpw-input').value.trim();
      if (password.length < 6) { App.toast('Password must be at least 6 characters', 'error'); return; }
      try {
        await API.resetUserPassword(id, password);
        cleanup();
        App.toast(`Password reset for ${name}`, 'success');
      } catch {
        App.toast('Failed to reset password', 'error');
      }
    });
  }

  /* ═══════════════════════════
     IMAGE UPLOAD HELPER
  ═══════════════════════════ */
  function setupImageInput(urlInputId, fileInputId, previewId) {
    const urlInput  = document.getElementById(urlInputId);
    const fileInput = document.getElementById(fileInputId);
    const preview   = document.getElementById(previewId);
    if (!urlInput || !preview) return;

    const show = src => {
      if (!src) { preview.innerHTML = ''; return; }
      if (src.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
        preview.innerHTML = `<video src="${src}" style="max-width:100%;max-height:100px;border-radius:8px" muted></video>`;
      } else {
        preview.innerHTML = `<img src="${src}" alt="Preview" style="max-width:100%;max-height:100px;border-radius:8px;object-fit:contain"
          onerror="this.parentNode.innerHTML='<span style=\\'color:var(--err);font-size:.75rem\\'>⚠ Could not load</span>'">`;
      }
    };

    urlInput.addEventListener('input', () => show(urlInput.value.trim()));
    if (urlInput.value) show(urlInput.value.trim());

    if (!fileInput) return;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const src = await API.uploadImage(file);
        urlInput.value = src;
        show(src);
      } catch (err) {
        App.toast(err.message || 'Upload failed', 'error');
      }
    });
  }

  /* ═══════════════════════════
     EVENT BINDING
  ═══════════════════════════ */
  function bindTabEvents(tab) {
    const c = document.getElementById('admin-content');

    /* ── Orders ── */
    if (tab === 'orders') {
      const searchIn = document.getElementById('ord-search');
      const statusIn = document.getElementById('ord-status');
      const dateIn   = document.getElementById('ord-date');
      const clearBtn = document.getElementById('ord-clear');

      const refilter = async () => {
        _orderSearch = searchIn?.value || '';
        _orderStatus = statusIn?.value || '';
        _orderDate   = dateIn?.value   || '';
        const allOrders = await API.getOrders();
        document.getElementById('orders-tbody').innerHTML = buildOrdersRows(applyOrderFilters(allOrders), _cachedStaff, _cachedBranches);
        bindOrderTableEvents();
      };

      searchIn?.addEventListener('input',  refilter);
      statusIn?.addEventListener('change', refilter);
      dateIn?.addEventListener('change',   refilter);
      clearBtn?.addEventListener('click', () => {
        _orderSearch = _orderStatus = _orderDate = '';
        switchTab('orders');
      });

      bindOrderTableEvents();
    }

    /* ── Products ── */
    if (tab === 'products') {
      const searchIn = document.getElementById('prod-search');
      const clearBtn = document.getElementById('prod-clear');

      const refilter = async () => {
        _productSearch = searchIn?.value || '';
        switchTab('products');
      };

      searchIn?.addEventListener('input', refilter);
      clearBtn?.addEventListener('click', () => {
        _productSearch = '';
        switchTab('products');
      });

      c.querySelectorAll('[data-del-product]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = Number(btn.dataset.delProduct);
          const name = btn.closest('tr')?.querySelector('td:nth-child(3) strong')?.textContent || 'this product';
          _showConfirm({
            title: 'Delete Product?',
            body: `Are you sure you want to delete <strong>"${name}"</strong>?<br>This action cannot be undone.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              await API.deleteProduct(id);
              App.toast('Product deleted');
              switchTab('products');
              App.refreshHome();
            },
          });
        });
      });

      c.querySelectorAll('[data-edit-product]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.editProduct);
          const p  = await API.getProduct(id);
          if (!p) return;
          _editingId = id;
          c.innerHTML = await buildAddProduct(p);
          document.querySelectorAll('.admin-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === 'add-product'));
          bindTabEvents('add-product');
        });
      });
    }

    /* ── Brands ── */
    if (tab === 'brands') {
      setupImageInput('new-brand-img-url', 'new-brand-img-file', 'new-brand-img-preview');

      document.getElementById('add-brand-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('new-brand-name').value.trim();
        if (!name) { App.toast('Enter a brand name', 'error'); return; }
        const image = document.getElementById('new-brand-img-url').value.trim() || null;
        const brands = await API.getBrandsAsync();
        if (brands.find(b => b.name === name)) { App.toast('Brand already exists', 'error'); return; }
        await API.addBrand({ name, image });
        App.toast(`Brand "${name}" added`, 'success');
        switchTab('brands');
      });

      /* Edit brand → replace card with edit form */
      c.querySelectorAll('[data-edit-brand]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const brands = await API.getBrandsAsync();
          const brand  = brands.find(b => b.name === btn.dataset.editBrand);
          if (!brand) return;
          const card = btn.closest('.brand-admin-card');
          card.outerHTML = buildBrandEditCard(brand);
          /* bind events on the new edit form */
          const editCard = c.querySelector(`[data-editing-brand="${brand.name}"]`);
          if (!editCard) return;
          const urlIn  = editCard.querySelector('.brand-edit-img-url');
          const fileIn = editCard.querySelector('.brand-edit-img-file');
          const prev   = editCard.querySelector('.brand-edit-preview');
          if (urlIn && prev) {
            const showPrev = src => {
              prev.innerHTML = src ? `<img src="${src}" style="max-height:80px;border-radius:6px;object-fit:contain">` : '';
            };
            urlIn.addEventListener('input', () => showPrev(urlIn.value.trim()));
            if (urlIn.value) showPrev(urlIn.value.trim());
            if (fileIn) {
              fileIn.addEventListener('change', async () => {
                const f = fileIn.files[0]; if (!f) return;
                try { const src = await API.uploadImage(f); urlIn.value = src; showPrev(src); }
                catch (e) { App.toast(e.message, 'error'); }
              });
            }
          }
          editCard.querySelector('.brand-save-btn')?.addEventListener('click', async () => {
            const origName = editCard.dataset.editingBrand;
            const newName  = editCard.querySelector('.brand-edit-name').value.trim();
            const newImg   = editCard.querySelector('.brand-edit-img-url').value.trim() || null;
            if (!newName) { App.toast('Enter a brand name', 'error'); return; }
            await API.updateBrand(origName, { name: newName, image: newImg });
            App.toast(`Brand updated`, 'success');
            App.refreshHome();
            switchTab('brands');
          });
          editCard.querySelector('.brand-cancel-btn')?.addEventListener('click', () => switchTab('brands'));
        });
      });

      c.querySelectorAll('[data-del-brand]').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.delBrand;
          _showConfirm({
            title: 'Delete Brand?',
            body: `Are you sure you want to delete brand <strong>"${name}"</strong>?<br>This cannot be undone.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              await API.deleteBrand(name);
              App.toast('Brand deleted');
              switchTab('brands');
            },
          });
        });
      });
    }

    /* ── Categories ── */
    if (tab === 'categories') {
      const catInput = document.getElementById('new-cat-name');

      const doAddCat = async () => {
        const name = catInput?.value.trim();
        if (!name) { App.toast('Enter a category name', 'error'); return; }
        try {
          await API.addCategory(name);
          App.toast(`Category "${name}" added`, 'success');
          App.refreshHome && App.refreshHome();
          switchTab('categories');
        } catch (e) {
          App.toast(e.message || 'Already exists', 'error');
        }
      };

      document.getElementById('add-cat-btn')?.addEventListener('click', doAddCat);
      catInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doAddCat(); });

      c.querySelectorAll('[data-edit-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const oldName = btn.dataset.editCat;
          const card    = btn.closest('.brand-admin-card');
          if (!card) return;
          card.innerHTML = `
            <div class="form-group" style="margin-bottom:.5rem;width:100%">
              <label>Name</label>
              <input class="cat-rename-input" type="text" value="${oldName}"
                style="width:100%;border:1.5px solid var(--blue);border-radius:var(--r-md);padding:.45rem .625rem;font-size:.8125rem;outline:none">
            </div>
            <div style="display:flex;gap:.375rem">
              <button class="admin-btn admin-btn-success btn-sm cat-save-btn">✓ Save</button>
              <button class="admin-btn btn-sm cat-cancel-btn">Cancel</button>
            </div>`;
          card.querySelector('.cat-save-btn').addEventListener('click', async () => {
            const newName = card.querySelector('.cat-rename-input').value.trim();
            if (!newName || newName === oldName) { switchTab('categories'); return; }
            await API.updateCategory(oldName, newName);
            App.toast('Category renamed', 'success');
            App.refreshHome && App.refreshHome();
            switchTab('categories');
          });
          card.querySelector('.cat-cancel-btn').addEventListener('click', () => switchTab('categories'));
        });
      });

      c.querySelectorAll('[data-del-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val  = btn.dataset.delCat;
          const card = btn.closest('[data-cat-name]');
          const name = card?.dataset.catName || val;
          _showConfirm({
            title: 'Delete Category?',
            body: `Are you sure you want to delete category <strong>"${name}"</strong>?<br>This cannot be undone.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              if (!isNaN(val) && val !== '') {
                await API.deleteCategory(name);
              } else {
                await API.deleteCategory(val);
              }
              App.toast('Category deleted');
              App.refreshHome && App.refreshHome();
              switchTab('categories');
            },
          });
        });
      });

      /* ── Main Category logo edit ── */
      c.querySelectorAll('[data-edit-main-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = btn.dataset.editMainCat;
          const card = btn.closest('[data-main-cat-id]');
          if (!card) return;
          const slug = card.dataset.mainCatSlug;
          const name = card.querySelector('.brand-admin-name')?.textContent || '';
          card.innerHTML = `
            <div class="form-group" style="margin-bottom:.5rem;width:100%">
              <label>${name} Logo</label>
              <div class="img-upload-group">
                <input class="mc-img-url" type="url" placeholder="Paste URL…">
                <label class="img-upload-file-btn">📎
                  <input type="file" class="mc-img-file" accept="image/*" hidden>
                </label>
              </div>
              <div class="img-preview-wrap mc-img-preview"></div>
            </div>
            <div style="display:flex;gap:.375rem">
              <button class="admin-btn admin-btn-success btn-sm mc-save-btn">✓ Save</button>
              <button class="admin-btn btn-sm mc-cancel-btn">Cancel</button>
            </div>`;
          const urlIn   = card.querySelector('.mc-img-url');
          const fileIn  = card.querySelector('.mc-img-file');
          const preview = card.querySelector('.mc-img-preview');
          urlIn.addEventListener('input', () => {
            const v = urlIn.value.trim();
            preview.innerHTML = v ? `<img src="${v}" style="max-height:60px;border-radius:6px">` : '';
          });
          fileIn.addEventListener('change', async () => {
            if (!fileIn.files[0]) return;
            const url = await API.uploadImage(fileIn.files[0]);
            urlIn.value = url;
            preview.innerHTML = `<img src="${url}" style="max-height:60px;border-radius:6px">`;
          });
          card.querySelector('.mc-save-btn').addEventListener('click', async () => {
            const image = urlIn.value.trim() || null;
            await API.updateMainCategory(id, { image });
            App.toast(`${name} logo updated`, 'success');
            switchTab('categories');
          });
          card.querySelector('.mc-cancel-btn').addEventListener('click', () => switchTab('categories'));
        });
      });
    }

    /* ── Add / Edit Product ── */
    if (tab === 'add-product') {
      setupImageInput('ap-img-main', 'ap-img-main-file', 'ap-img-main-preview');
      setupImageInput('ap-img-alt1', 'ap-img-alt1-file', 'ap-img-alt1-preview');
      setupImageInput('ap-img-alt2', 'ap-img-alt2-file', 'ap-img-alt2-preview');

      document.getElementById('cancel-edit-product-btn')?.addEventListener('click', () => {
        _editingId = null;
        switchTab('products');
      });

      document.getElementById('save-product-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('ap-name').value.trim();
        if (!name) { App.toast('Enter a product name', 'error'); return; }
        const imageMain = document.getElementById('ap-img-main').value.trim();
        if (!imageMain) { App.toast('Main image is required', 'error'); document.getElementById('ap-img-main').focus(); return; }
        const price = Number(document.getElementById('ap-price').value) || 0;
        const op    = document.getElementById('ap-old-price').value;
        const data  = {
          name,
          brand:      document.getElementById('ap-brand').value,
          cat:        document.getElementById('ap-cat').value,
          subcat:     document.getElementById('ap-subcat').value,
          gender:     document.getElementById('ap-gender').value,
          emoji:      document.getElementById('ap-emoji').value || '🛍️',
          imageMain,
          imageAlt1:  document.getElementById('ap-img-alt1').value.trim() || null,
          imageAlt2:  document.getElementById('ap-img-alt2').value.trim() || null,
          price,
          oldPrice:   op ? Number(op) : null,
          stock:      Number(document.getElementById('ap-stock').value) || 0,
          sizes:      document.getElementById('ap-sizes').value.split(',').map(s => s.trim()).filter(Boolean),
          desc:       document.getElementById('ap-desc').value,
          isNew:      document.getElementById('ap-new').checked,
          isTrend:    document.getElementById('ap-trend').checked,
          isFeat:     document.getElementById('ap-feat').checked,
          isOnSale:   document.getElementById('ap-on-sale').checked,
          isHot:      document.getElementById('ap-hot').checked,
          isVisible:  document.getElementById('ap-visible').checked,
        };

        if (_editingId !== null) {
          await API.updateProduct(_editingId, data);
          App.toast('Product updated!', 'success');
          _editingId = null;
        } else {
          await API.addProduct(data);
          /* auto-add new brand if not in list */
          const brands = await API.getBrandsAsync();
          if (data.brand && !brands.find(b => b.name === data.brand)) {
            await API.addBrand({ name: data.brand, image: null });
          }
          App.toast('Product added!', 'success');
        }
        App.refreshHome();
        switchTab('products');
      });
    }

    /* ── Users ── */
    if (tab === 'users') {
      /* Search filter */
      document.getElementById('user-search')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#users-tbody tr').forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });

      /* Branch card radio → update hidden input + highlight selected */
      document.querySelectorAll('.nu-branch-radio').forEach(radio => {
        radio.addEventListener('change', () => {
          document.getElementById('nu-branch').value = radio.value;
          document.querySelectorAll('.branch-card-label').forEach(lbl => {
            const isSelected = lbl.querySelector('.nu-branch-radio') === radio;
            lbl.style.borderColor = isSelected ? 'var(--blue)' : 'var(--n-200)';
            lbl.style.background  = isSelected ? 'var(--blue-xl)' : '';
          });
        });
      });

      /* Create user */
      document.getElementById('create-user-btn')?.addEventListener('click', async () => {
        const name   = document.getElementById('nu-name').value.trim();
        const phone  = document.getElementById('nu-phone').value.trim();
        const email  = document.getElementById('nu-email').value.trim();
        const role   = document.getElementById('nu-role').value;
        const branch = document.getElementById('nu-branch')?.value || '';
        if (!name || !phone) { App.toast('Name and phone required', 'error'); return; }
        if (role === 'branch_manager' && !branch) { App.toast('Select a branch for this Branch Manager', 'error'); return; }
        try {
          await API.createUser({ name, phone, email, role, branch });
          App.toast(`User "${name}" created`, 'success');
          switchTab('users');
        } catch (e) {
          App.toast(e.message || 'User already exists', 'error');
        }
      });

      /* Edit user — inline row form */
      c.querySelectorAll('[data-edit-user]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id     = btn.dataset.editUser;
          const row    = btn.closest('tr');
          if (!row) return;
          const name   = row.querySelector('td:nth-child(2)')?.textContent.trim() || '';
          const phone  = row.dataset.userPhone || '';
          const email  = row.querySelector('td:nth-child(4)')?.textContent.trim().replace('—','') || '';
          const role   = row.querySelector('.pill')?.textContent.trim().toLowerCase().replace(' ','_') || 'customer';
          const branch = row.dataset.userBranch || '';
          const branchOptions = (window.Config?.BRANCHES || [])
            .map(b => `<option value="${b.name}"${b.name === branch ? ' selected' : ''}>${b.name}</option>`).join('');

          row.innerHTML = `
            <td colspan="9">
              <div style="display:flex;gap:.625rem;align-items:flex-end;flex-wrap:wrap;padding:.5rem 0">
                <div class="form-group" style="margin:0;min-width:140px">
                  <label>Name</label>
                  <input class="eu-name" type="text" value="${name}" style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--blue);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div class="form-group" style="margin:0;min-width:160px">
                  <label>Email</label>
                  <input class="eu-email" type="email" value="${email}" style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div class="form-group" style="margin:0">
                  <label>Role</label>
                  <select class="eu-role" style="padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem"
                    onchange="this.closest('div').querySelector('.eu-branch-wrap').style.display=this.value==='branch_manager'?'':'none'">
                    <option value="customer"       ${role==='customer'       ?'selected':''}>Customer</option>
                    <option value="staff"          ${role==='staff'          ?'selected':''}>Staff</option>
                    <option value="branch_manager" ${role==='branch_manager' ?'selected':''}>Branch Manager</option>
                    <option value="admin"          ${role==='admin'          ?'selected':''}>Admin</option>
                  </select>
                </div>
                <div class="eu-branch-wrap form-group" style="margin:0;display:${role==='branch_manager'?'':'none'}">
                  <label>Branch</label>
                  <select class="eu-branch" style="padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem">
                    <option value="">Select…</option>${branchOptions}
                  </select>
                </div>
                <div style="display:flex;gap:.375rem">
                  <button class="admin-btn admin-btn-success btn-sm eu-save-btn">✓ Save</button>
                  <button class="admin-btn btn-sm eu-cancel-btn">Cancel</button>
                </div>
                <span style="font-size:.75rem;color:var(--n-400);align-self:center">${phone}</span>
              </div>
            </td>`;
          row.querySelector('.eu-save-btn').addEventListener('click', async () => {
            const newRole = row.querySelector('.eu-role').value;
            const newBranch = row.querySelector('.eu-branch')?.value || '';
            if (newRole === 'branch_manager' && !newBranch) {
              App.toast('Select a branch for Branch Manager', 'error'); return;
            }
            try {
              await API.updateUserRole(id, newRole, {
                name:   row.querySelector('.eu-name').value.trim(),
                email:  row.querySelector('.eu-email').value.trim(),
                branch: newBranch,
              });
              App.toast('User updated', 'success');
              switchTab('users');
            } catch { App.toast('Update failed', 'error'); }
          });
          row.querySelector('.eu-cancel-btn').addEventListener('click', () => switchTab('users'));
        });
      });

      /* Reset password */
      c.querySelectorAll('[data-reset-pw]').forEach(btn => {
        btn.addEventListener('click', () => {
          showResetPasswordModal(btn.dataset.resetPw, btn.dataset.resetPwName);
        });
      });

      /* Delete user */
      c.querySelectorAll('[data-del-user]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = btn.dataset.delUser;
          const name = btn.closest('tr')?.querySelector('td:nth-child(2)')?.textContent.trim() || id;
          _showConfirm({
            title: 'Delete User?',
            body: `Are you sure you want to delete user <strong>"${name}"</strong>?<br>All their data will be removed permanently.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              try {
                await API.deleteUser(id);
                App.toast('User deleted');
                switchTab('users');
              } catch { App.toast('Delete failed', 'error'); }
            },
          });
        });
      });
    }

    /* ── Delivery Areas ── */
    if (tab === 'delivery') {
      const nameIn  = document.getElementById('da-name');
      const priceIn = document.getElementById('da-price');

      const doAdd = async () => {
        const name  = nameIn?.value.trim();
        const price = priceIn?.value;
        if (!name)         { App.toast('Enter an area name', 'error'); return; }
        if (price === '')  { App.toast('Enter a delivery price (0 for free)', 'error'); return; }
        try {
          await API.addDeliveryArea({ name, price: Number(price) });
          App.toast(`Area "${name}" added`, 'success');
          switchTab('delivery');
        } catch (e) {
          App.toast(e.message || 'Area already exists', 'error');
        }
      };

      document.getElementById('add-da-btn')?.addEventListener('click', doAdd);
      nameIn?.addEventListener('keydown',  e => { if (e.key === 'Enter') doAdd(); });
      priceIn?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

      /* Edit row inline */
      c.querySelectorAll('[data-edit-da]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id  = btn.dataset.editDa;
          const row = btn.closest('tr');
          if (!row) return;
          const name  = row.querySelector('td:nth-child(2)')?.textContent.trim() || '';
          const priceText = row.querySelector('td:nth-child(3)')?.textContent.trim() || '0';
          const price = priceText === 'Free' ? 0 : Number(priceText.replace(/[^0-9.]/g, ''));
          row.innerHTML = `
            <td colspan="4">
              <div style="display:flex;gap:.625rem;align-items:flex-end;flex-wrap:wrap;padding:.5rem 0">
                <div class="form-group" style="margin:0;min-width:160px">
                  <label>Area Name</label>
                  <input class="da-edit-name" type="text" value="${name}"
                    style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--blue);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div class="form-group" style="margin:0;min-width:140px">
                  <label>Price (KES)</label>
                  <input class="da-edit-price" type="number" min="0" step="0.01" value="${price}"
                    style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div style="display:flex;gap:.375rem">
                  <button class="admin-btn admin-btn-success btn-sm da-save-btn">✓ Save</button>
                  <button class="admin-btn btn-sm da-cancel-btn">Cancel</button>
                </div>
              </div>
            </td>`;
          row.querySelector('.da-save-btn').addEventListener('click', async () => {
            const newName  = row.querySelector('.da-edit-name').value.trim();
            const newPrice = row.querySelector('.da-edit-price').value;
            if (!newName) { App.toast('Enter an area name', 'error'); return; }
            try {
              await API.updateDeliveryArea(id, { name: newName, price: Number(newPrice) });
              App.toast('Area updated', 'success');
              switchTab('delivery');
            } catch { App.toast('Update failed', 'error'); }
          });
          row.querySelector('.da-cancel-btn').addEventListener('click', () => switchTab('delivery'));
        });
      });

      /* Delete */
      c.querySelectorAll('[data-del-da]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = btn.dataset.delDa;
          const name = btn.closest('tr')?.querySelector('td:nth-child(2)')?.textContent.trim() || id;
          _showConfirm({
            title: 'Delete Delivery Area?',
            body: `Are you sure you want to remove <strong>"${name}"</strong>?<br>Customers will no longer see this delivery zone.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              await API.deleteDeliveryArea(id);
              App.toast('Area deleted');
              switchTab('delivery');
            },
          });
        });
      });
    }

    /* ── Coupons ── */
    if (tab === 'coupons') {
      document.getElementById('cp-code')?.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/\s/g, '');
      });

      document.getElementById('add-coupon-btn')?.addEventListener('click', async () => {
        const code    = document.getElementById('cp-code')?.value.trim().toUpperCase();
        const type    = document.getElementById('cp-type')?.value || 'percent';
        const value   = document.getElementById('cp-value')?.value;
        const min     = document.getElementById('cp-min')?.value || '0';
        const maxU    = document.getElementById('cp-maxuses')?.value || '0';
        const expires = document.getElementById('cp-expires')?.value || null;
        if (!code)  { App.toast('Enter a coupon code', 'error');    return; }
        if (!value) { App.toast('Enter a discount value', 'error'); return; }
        try {
          await API.addCoupon({ code, type, value: Number(value), min_order: Number(min), max_uses: Number(maxU), expires_at: expires });
          App.toast(`Coupon "${code}" created`, 'success');
          switchTab('coupons');
        } catch (e) { App.toast(e.message || 'Code already exists', 'error'); }
      });

      c.querySelectorAll('[data-toggle-coupon]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id     = btn.dataset.toggleCoupon;
          const active = btn.dataset.active === '1';
          await API.updateCoupon(id, { is_active: active ? 0 : 1 });
          App.toast(active ? 'Coupon disabled' : 'Coupon enabled', 'success');
          switchTab('coupons');
        });
      });

      c.querySelectorAll('[data-del-coupon]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.delCoupon;
          _showConfirm({
            title: 'Delete Coupon?',
            body: 'This coupon will be permanently removed.',
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              await API.deleteCoupon(id);
              App.toast('Coupon deleted');
              switchTab('coupons');
            },
          });
        });
      });
    }

    /* ── Branches ── */
    if (tab === 'branches') {
      document.getElementById('add-branch-btn')?.addEventListener('click', async () => {
        const name     = document.getElementById('br-name')?.value.trim();
        const location = document.getElementById('br-location')?.value.trim() || '';
        const phone    = document.getElementById('br-phone')?.value.trim() || '';
        if (!name) { App.toast('Enter a branch name', 'error'); return; }
        try {
          await API.addBranch({ name, location, phone });
          App.toast(`Branch "${name}" added`, 'success');
          switchTab('branches');
        } catch (e) { App.toast(e.message || 'Branch already exists', 'error'); }
      });

      c.querySelectorAll('[data-edit-branch]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id  = btn.dataset.editBranch;
          const row = btn.closest('tr');
          if (!row) return;
          const name     = row.querySelector('td:nth-child(2)')?.textContent.trim() || '';
          const location = row.querySelector('td:nth-child(3)')?.textContent.replace('—','').trim() || '';
          const phone    = row.querySelector('td:nth-child(4)')?.textContent.replace('—','').trim() || '';
          row.innerHTML = `
            <td colspan="5">
              <div style="display:flex;gap:.625rem;flex-wrap:wrap;align-items:flex-end;padding:.375rem 0">
                <div class="form-group" style="margin:0;min-width:160px">
                  <label>Name</label>
                  <input class="br-edit-name" value="${name}" style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--blue);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div class="form-group" style="margin:0;min-width:160px">
                  <label>Location</label>
                  <input class="br-edit-loc" value="${location}" style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div class="form-group" style="margin:0;min-width:140px">
                  <label>Phone</label>
                  <input class="br-edit-phone" value="${phone}" style="width:100%;padding:.4rem .625rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;outline:none">
                </div>
                <div style="display:flex;gap:.375rem">
                  <button class="admin-btn admin-btn-success btn-sm br-save-btn">✓ Save</button>
                  <button class="admin-btn btn-sm br-cancel-btn">Cancel</button>
                </div>
              </div>
            </td>`;
          row.querySelector('.br-save-btn').addEventListener('click', async () => {
            await API.updateBranch(id, {
              name:     row.querySelector('.br-edit-name').value.trim(),
              location: row.querySelector('.br-edit-loc').value.trim(),
              phone:    row.querySelector('.br-edit-phone').value.trim(),
            });
            App.toast('Branch updated', 'success');
            switchTab('branches');
          });
          row.querySelector('.br-cancel-btn').addEventListener('click', () => switchTab('branches'));
        });
      });

      c.querySelectorAll('[data-del-branch]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id   = btn.dataset.delBranch;
          const name = btn.closest('tr')?.querySelector('td:nth-child(2)')?.textContent.trim() || id;
          _showConfirm({
            title: 'Delete Branch?',
            body: `Remove <strong>"${name}"</strong>? This will not delete the staff assigned to it.`,
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
              await API.deleteBranch(id);
              App.toast('Branch deleted');
              switchTab('branches');
            },
          });
        });
      });
    }

    /* ── Settings ── */
    if (tab === 'settings') {
      setupImageInput('hero-bg-url', 'hero-bg-file', 'hero-bg-preview');

      document.getElementById('save-order-notif-btn')?.addEventListener('click', async () => {
        const emails = document.getElementById('order-notif-emails')?.value
          .split('\n').map(e => e.trim()).filter(Boolean);
        await API.saveSettings({ order_notification_emails: emails.join(',') });
        App.toast('Order notification recipients saved', 'success');
      });

      document.getElementById('save-notif-btn')?.addEventListener('click', async () => {
        const text   = document.getElementById('notif-text')?.value.trim() || '';
        const active = document.getElementById('notif-active-chk')?.checked ? '1' : '0';
        const badge  = document.getElementById('notif-badge')?.value.trim() || 'OFFER';
        await API.saveSettings({ notif_text: text, notif_active: active, notif_badge: badge });
        App.toast('Announcement saved', 'success');
        if (typeof App !== 'undefined' && App._reloadNotif) App._reloadNotif();
      });

      document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
        const url = document.getElementById('hero-bg-url').value.trim();
        if (url) {
          localStorage.setItem('ibh_hero_bg', url);
          await API.saveSettings({ hero_bg: url }).catch(() => {});
        }
        App.applyHeroBg();
        App.toast('Background saved — will appear on the home page', 'success');
        switchTab('settings');
      });

      document.getElementById('clear-settings-btn')?.addEventListener('click', async () => {
        localStorage.removeItem('ibh_hero_bg');
        await API.saveSettings({ hero_bg: '' }).catch(() => {});
        App.applyHeroBg();
        App.toast('Background removed — default video restored');
        switchTab('settings');
      });

      document.getElementById('save-mpesa-btn')?.addEventListener('click', () => {
        const till = document.getElementById('mpesa-till')?.value.trim();
        const name = document.getElementById('mpesa-name')?.value.trim();
        if (till) localStorage.setItem('ibh_mpesa_till', till);
        if (name) localStorage.setItem('ibh_mpesa_name', name);
        App.toast('M-Pesa settings saved', 'success');
      });
    }
  }

  /* ── Bind order table row events (re-usable after re-filter) ── */
  function bindOrderTableEvents() {
    const c = document.getElementById('admin-content');
    c?.querySelectorAll('.status-select[data-order-id]').forEach(sel => {
      sel.addEventListener('change', async () => {
        await API.updateOrderStatus(sel.dataset.orderId, sel.value);
        App.toast('Status updated', 'success');
      });
    });

    /* Branch assignment (admin only) */
    c?.querySelectorAll('.branch-select[data-branch-order-id]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id     = sel.dataset.branchOrderId;
        const branch = sel.value || null;
        try {
          await fetch(`${Config.BASE_URL}/orders/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ibh_session')}` },
            body: JSON.stringify({ branch }),
          });
          App.toast('Branch assigned', 'success');
        } catch { App.toast('Failed to assign branch', 'error'); }
      });
    });

    /* Staff assignment */
    c?.querySelectorAll('.staff-assign-select[data-assign-order-id]').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id          = sel.dataset.assignOrderId;
        const assigned_to = sel.value ? Number(sel.value) : null;
        const opt         = sel.options[sel.selectedIndex];
        const name        = assigned_to ? (opt.dataset.name || opt.text) : null;
        try {
          await fetch(`${Config.BASE_URL}/orders/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ibh_session')}` },
            body: JSON.stringify({ assigned_to, assigned_name: name }),
          });
          App.toast(assigned_to ? `Assigned to ${name}` : 'Assignment cleared', 'success');
        } catch { App.toast('Failed to assign staff', 'error'); }
      });
    });

    /* Notes modal */
    c?.querySelectorAll('[data-notes-order]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id    = btn.dataset.notesOrder;
        const notes = await API.getOrderNotes(id);
        const existing = document.getElementById('notes-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'notes-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px)';
        const renderNotes = (list) => list.length
          ? list.map(n => `
              <div style="padding:.75rem;background:${n.is_internal ? '#FEF9C3' : 'var(--n-50)'};border-radius:var(--r-md);border:1px solid ${n.is_internal ? '#F59E0B' : 'var(--n-200)'};margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem">
                  <strong style="font-size:.8125rem;color:var(--blue-d)">${n.author_name}</strong>
                  <div style="display:flex;gap:.375rem;align-items:center">
                    ${n.is_internal ? `<span style="font-size:.625rem;background:#F59E0B;color:#fff;padding:.1rem .4rem;border-radius:999px">Admin Only</span>` : ''}
                    <span style="font-size:.6875rem;color:var(--n-400)">${n.created_at?.slice(0,16).replace('T',' ') || ''}</span>
                  </div>
                </div>
                <p style="font-size:.8125rem;color:var(--n-700);margin:0">${n.note}</p>
              </div>`)
            .join('')
          : `<p style="color:var(--n-400);font-size:.8125rem;text-align:center;padding:1rem">No notes yet</p>`;

        modal.innerHTML = `
          <div style="background:var(--white);border-radius:var(--r-xl);max-width:520px;width:100%;padding:1.5rem;max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--sh-xl)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
              <h3 style="font-size:1rem;font-weight:700;color:var(--blue-d)">📝 Notes — ${id}</h3>
              <button id="notes-modal-close" style="background:var(--n-100);border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:1.125rem">×</button>
            </div>
            <div id="notes-list" style="flex:1;overflow-y:auto;max-height:340px;margin-bottom:1rem">${renderNotes(notes)}</div>
            <div style="border-top:1px solid var(--n-200);padding-top:.875rem">
              <textarea id="new-note-text" rows="3" placeholder="Add a note…"
                style="width:100%;border:1.5px solid var(--n-200);border-radius:var(--r-md);padding:.5rem .75rem;font-size:.8125rem;font-family:inherit;resize:vertical;outline:none"></textarea>
              <div style="display:flex;gap:.5rem;align-items:center;margin-top:.5rem">
                <label style="display:flex;align-items:center;gap:.375rem;font-size:.75rem;color:var(--n-600);cursor:pointer">
                  <input type="checkbox" id="note-internal"> Admin only
                </label>
                <button class="admin-btn admin-btn-primary" id="save-note-btn" style="margin-left:auto">Add Note</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.getElementById('notes-modal-close').addEventListener('click', () => modal.remove());
        document.getElementById('save-note-btn').addEventListener('click', async () => {
          const note = document.getElementById('new-note-text').value.trim();
          const internal = document.getElementById('note-internal').checked;
          if (!note) return;
          await API.addOrderNote(id, note, internal);
          const updated = await API.getOrderNotes(id);
          document.getElementById('notes-list').innerHTML = renderNotes(updated);
          document.getElementById('new-note-text').value = '';
          App.toast('Note saved', 'success');
        });
      });
    });
    c?.querySelectorAll('[data-invoice]').forEach(btn => {
      btn.addEventListener('click', () => generateInvoice(btn.dataset.invoice));
    });
    c?.querySelectorAll('[data-view-order]').forEach(btn => {
      btn.addEventListener('click', () => showOrderDetail(btn.dataset.viewOrder));
    });

    /* More-actions (⋮) menu — delete order */
    const closeAllOrderMenus = () => document.querySelectorAll('[data-order-menu]').forEach(m => m.style.display = 'none');
    c?.querySelectorAll('[data-order-menu-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = c.querySelector(`[data-order-menu="${btn.dataset.orderMenuToggle}"]`);
        const wasOpen = menu.style.display === 'block';
        closeAllOrderMenus();
        menu.style.display = wasOpen ? 'none' : 'block';
      });
    });
    if (!_orderMenuOutsideClickBound) {
      document.addEventListener('click', closeAllOrderMenus);
      _orderMenuOutsideClickBound = true;
    }

    c?.querySelectorAll('[data-delete-order]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteOrder;
        closeAllOrderMenus();
        _showConfirm({
          title: 'Delete Order?',
          body: `Order ${id} will be permanently removed. This cannot be undone.`,
          confirmLabel: 'Yes, Delete',
          onConfirm: async () => {
            try {
              await API.deleteOrder(id);
              App.toast('Order deleted');
              switchTab('orders');
            } catch {
              App.toast('Failed to delete order', 'error');
            }
          },
        });
      });
    });
  }

  function _printInvoice(id) { generateInvoice(id); }

  return { open, close, switchTab, _printInvoice };
})();
