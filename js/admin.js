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
      case 'orders':      content.innerHTML = await buildOrders();      break;
      case 'products':    content.innerHTML = await buildProducts();    break;
      case 'brands':      content.innerHTML = await buildBrands();      break;
      case 'categories':  content.innerHTML = await buildCategories();  break;
      case 'add-product': content.innerHTML = await buildAddProduct();  _editingId = null; break;
      case 'users':       content.innerHTML = await buildUsers();       break;
      case 'settings':    content.innerHTML = buildSettings();          break;
    }
    bindTabEvents(tab);
  }

  /* ═══════════════════════════
     ORDERS
  ═══════════════════════════ */
  async function buildOrders() {
    const allOrders = await API.getOrders();
    const products  = await API.getProducts({ admin: true });
    const rev     = allOrders.reduce((s, o) => s + o.total, 0);
    const pending = allOrders.filter(o => ['pending', 'confirmed'].includes(o.status)).length;
    const orders  = applyOrderFilters(allOrders);

    return `
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

        <!-- Filters -->
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
              <th>Order ID</th><th>Customer</th><th>Items</th>
              <th>Total</th><th>Payment</th><th>Status</th><th>Update</th><th>Invoice</th>
            </tr></thead>
            <tbody id="orders-tbody">
              ${buildOrdersRows(orders)}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function buildOrdersRows(orders) {
    if (!orders.length) return `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--n-400)">No orders match the current filters.</td></tr>`;
    return orders.map(o => `
      <tr>
        <td><strong style="color:var(--blue)">${o.id}</strong><br>
          <span style="font-size:.7rem;color:var(--n-400)">${o.date} ${o.time || ''}</span></td>
        <td>${o.customer?.name || o.customer || '—'}<br>
          <span style="font-size:.7rem;color:var(--n-400)">${o.customer?.phone || ''}</span></td>
        <td>${o.items?.length || 0} item${(o.items?.length || 0) !== 1 ? 's' : ''}</td>
        <td><strong>KES ${(o.total || 0).toLocaleString()}</strong></td>
        <td><span style="text-transform:uppercase;font-size:.6875rem;font-weight:600">${o.payment || '—'}</span></td>
        <td><span class="pill pill-${o.status}">${o.status}</span></td>
        <td>
          <select class="status-select" data-order-id="${o.id}">
            ${['pending','confirmed','processing','delivered','cancelled']
              .map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <button class="admin-btn admin-btn-primary" data-invoice="${o.id}" style="white-space:nowrap">🖨 Invoice</button>
        </td>
      </tr>`).join('');
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
     PRODUCTS
  ═══════════════════════════ */
  async function buildProducts() {
    const ps = await API.getProducts({ admin: true });
    return `
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Products (${ps.length})</h4>
          <button class="admin-btn admin-btn-primary" onclick="Admin.switchTab('add-product')">+ Add Product</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Image</th><th>Name</th><th>Brand</th><th>Category</th><th>Price</th><th>Stock</th><th>Visible</th><th>Actions</th></tr></thead>
            <tbody>
              ${ps.map(p => `
                <tr>
                  <td>${p.imageMain
                    ? `<img src="${p.imageMain}" alt="${p.name}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;">`
                    : `<span style="font-size:1.375rem">${p.emoji}</span>`}
                  </td>
                  <td><strong>${p.name}</strong><br><span style="font-size:.7rem;color:var(--n-400)">${p.gender}</span></td>
                  <td>${p.brand}</td>
                  <td>${p.subcat}</td>
                  <td>KES ${p.price.toLocaleString()}${p.oldPrice ? `<br><span style="font-size:.7rem;color:var(--n-400);text-decoration:line-through">KES ${p.oldPrice.toLocaleString()}</span>` : ''}</td>
                  <td>${p.stock}</td>
                  <td><span class="pill ${p.isVisible !== false ? 'pill-confirmed' : 'pill-cancelled'}">${p.isVisible !== false ? 'Yes' : 'Hidden'}</span></td>
                  <td style="white-space:nowrap">
                    <button class="admin-btn admin-btn-primary" data-edit-product="${p.id}" style="margin-right:.375rem">Edit</button>
                    <button class="admin-btn admin-btn-danger" data-del-product="${p.id}">Delete</button>
                  </td>
                </tr>`).join('')}
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
  async function buildCategories() {
    const cats = API.getCategories();
    return `
      <div class="admin-card">
        <div class="admin-card-head">
          <h4>Categories (${cats.length})</h4>
          <button class="admin-btn admin-btn-primary" id="add-cat-btn">+ Add Category</button>
        </div>
        <div class="chips-wrap" id="cats-chips">
          ${cats.map(c => `
            <div class="chip">
              <span class="chip-label">${c}</span>
              <button class="chip-action chip-edit" data-edit-cat="${c}" title="Rename" style="color:var(--blue);margin-left:.25rem">✎</button>
              <button class="chip-del" data-del-cat="${c}" title="Delete">×</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     ADD / EDIT PRODUCT
  ═══════════════════════════ */
  async function buildAddProduct(prefill = null) {
    const brands = await API.getBrandsAsync();
    const cats   = API.getCategories();
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
          <label>Main Image <span style="font-weight:400;color:var(--n-400)">(primary)</span></label>
          <div class="img-upload-group">
            <input id="ap-img-main" type="url" placeholder="Paste image URL…" value="${v('imageMain')}">
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
        <p class="admin-section-label" style="margin-top:.5rem">Product Details</p>
        <div class="form-row">
          <div class="form-group"><label>Product Name</label><input id="ap-name" type="text" placeholder="Dior Sauvage 100ml" value="${v('name')}"></div>
          <div class="form-group"><label>Brand</label>
            <select id="ap-brand"><option value="">Select Brand</option>${selBrand}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <select id="ap-cat">
              <option value="">Select</option>
              <option value="perfume"${v('cat') === 'perfume' ? ' selected' : ''}>Perfume</option>
              <option value="hair"${v('cat') === 'hair' ? ' selected' : ''}>Hair Care</option>
              <option value="body"${v('cat') === 'body' ? ' selected' : ''}>Body Care</option>
            </select>
          </div>
          <div class="form-group"><label>Subcategory</label>
            <select id="ap-subcat"><option value="">Select</option>${selCat}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Gender</label>
            <select id="ap-gender">
              <option value="">Select</option>
              ${['Male','Female','Unisex','Children','All'].map(g =>
                `<option${g === v('gender') ? ' selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Emoji Icon <span style="font-weight:400;color:var(--n-400)">(fallback)</span></label>
            <input id="ap-emoji" type="text" placeholder="🌸" maxlength="4" value="${v('emoji')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Price (KES)</label><input id="ap-price" type="number" min="0" placeholder="5000" value="${v('price')}"></div>
          <div class="form-group"><label>Old Price (KES, optional)</label><input id="ap-old-price" type="number" min="0" placeholder="Leave blank if no discount" value="${v('oldPrice') || ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Stock</label><input id="ap-stock" type="number" min="0" placeholder="10" value="${v('stock')}"></div>
          <div class="form-group"><label>Sizes (comma separated)</label><input id="ap-sizes" type="text" placeholder="50ml, 100ml" value="${prefill?.sizes?.join(', ') || ''}"></div>
        </div>
        <div class="form-group"><label>Description</label><textarea id="ap-desc" rows="3" placeholder="Brief product description…" style="resize:vertical">${v('desc')}</textarea></div>

        <!-- Flags -->
        <div class="form-group">
          <div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
            <label class="flag-label"><input type="checkbox" id="ap-new"     ${checked('isNew')}>   New Arrival</label>
            <label class="flag-label"><input type="checkbox" id="ap-trend"   ${checked('isTrend')}> Trending</label>
            <label class="flag-label"><input type="checkbox" id="ap-feat"    ${checked('isFeat')}>  Best Seller</label>
            <label class="flag-label visibility-flag">
              <input type="checkbox" id="ap-visible" ${prefill ? (prefill.isVisible !== false ? 'checked' : '') : 'checked'}>
              <span>Visible on Store</span>
            </label>
          </div>
        </div>

        <button class="admin-btn admin-btn-success" id="save-product-btn" style="padding:.625rem 1.5rem;font-size:.875rem">
          ${prefill ? '✓ Update Product' : '✓ Save Product'}
        </button>
      </div>`;
  }

  /* ═══════════════════════════
     USERS
  ═══════════════════════════ */
  async function buildUsers() {
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
      <div class="admin-card">
        <div class="admin-card-head"><h4>Customers (${users.length})</h4></div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Orders</th><th>Total Spent</th><th>Last Order</th></tr></thead>
            <tbody>
              ${users.length ? users.map(u => `
                <tr>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.phone}</td>
                  <td>${u.email || <span style="color:var(--n-400)">—</span>}</td>
                  <td><span class="pill pill-confirmed">${u.orderCount}</span></td>
                  <td><strong>KES ${u.totalSpent.toLocaleString()}</strong></td>
                  <td>${u.lastOrder || '—'}</td>
                </tr>`).join('')
              : `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--n-400)">No customers yet. Orders will appear here.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ═══════════════════════════
     SETTINGS
  ═══════════════════════════ */
  function buildSettings() {
    const heroBg = localStorage.getItem('ibh_hero_bg') || '';
    return `
      <div class="admin-card">
        <div class="admin-card-head"><h4>Hero Section Background</h4></div>
        <div class="form-group">
          <label>Background Image or Video URL</label>
          <div class="img-upload-group">
            <input id="hero-bg-url" type="url" value="${heroBg}" placeholder="https://… (.jpg, .png, .mp4, .webm)">
            <label class="img-upload-file-btn">📎 Upload<input type="file" id="hero-bg-file" accept="image/*,video/*" hidden></label>
          </div>
          <div class="img-preview-wrap" id="hero-bg-preview" style="margin-top:.625rem"></div>
          <p style="font-size:.75rem;color:var(--n-400);margin-top:.375rem">
            Supports images (JPG, PNG, WebP) and videos (MP4, WebM). Leave blank for the default gradient.
          </p>
        </div>
        <button class="admin-btn admin-btn-success" id="save-settings-btn" style="padding:.625rem 1.5rem">✓ Save</button>
        ${heroBg ? `<button class="admin-btn admin-btn-danger" id="clear-settings-btn" style="padding:.625rem 1.5rem;margin-left:.5rem">✕ Remove</button>` : ''}
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
    const rows = (o.items || []).map(item => `
      <tr>
        <td>${item.emoji || ''}  ${item.name}</td>
        <td style="color:#666">${item.brand || ''}</td>
        <td style="text-align:center">${item.size || '—'}</td>
        <td style="text-align:center">${item.qty || 1}</td>
        <td style="text-align:right">KES ${(item.price || 0).toLocaleString()}</td>
        <td style="text-align:right;font-weight:700">KES ${((item.price || 0) * (item.qty || 1)).toLocaleString()}</td>
      </tr>`).join('');

    const shipping = (o.total || 0) > 5000 ? 0 : 200;
    const subtotal = (o.total || 0) - shipping;

    const win = window.open('', '_blank', 'width=860,height=700');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Invoice — ${o.id}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;padding:2rem;max-width:800px;margin:0 auto;font-size:14px}
        .no-print{text-align:center;margin-bottom:1.5rem}
        .print-btn{background:#1455A4;color:#fff;border:none;padding:.625rem 1.75rem;border-radius:6px;font-size:.875rem;cursor:pointer}
        .inv-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1455A4;padding-bottom:1.25rem;margin-bottom:1.5rem}
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
        td{padding:.75rem .75rem;border-bottom:1px solid #E8ECF4;font-size:.8125rem;vertical-align:middle}
        tr:last-child td{border-bottom:none}
        .totals-wrap{display:flex;justify-content:flex-end}
        .totals{width:260px}
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
        <div>
          <div class="inv-brand-name">Inspiring Beauty Hub</div>
          <div class="inv-tagline">Premium Fragrances &amp; Beauty · Nairobi, Kenya</div>
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
          <div class="inv-detail">info@ibh.co.ke</div>
          <div class="inv-detail">+254 700 000 000</div>
        </div>
        <div>
          <div class="inv-label">Bill To</div>
          <div class="inv-name">${o.customer?.name || o.customer || 'Customer'}</div>
          ${o.customer?.phone ? `<div class="inv-detail">${o.customer.phone}</div>` : ''}
          ${o.customer?.email ? `<div class="inv-detail">${o.customer.email}</div>` : ''}
        </div>
      </div>
      <table>
        <thead><tr><th>Product</th><th>Brand</th><th>Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-wrap">
        <div class="totals">
          <div class="tot-row"><span>Subtotal</span><span>KES ${subtotal.toLocaleString()}</span></div>
          <div class="tot-row"><span>Delivery</span><span>${shipping ? `KES ${shipping}` : 'Free'}</span></div>
          <div class="tot-row"><span>Payment</span><span style="text-transform:uppercase;font-size:.6875rem;font-weight:600">${o.payment || '—'}</span></div>
          <div class="tot-row grand"><span>Total</span><span>KES ${(o.total || 0).toLocaleString()}</span></div>
        </div>
      </div>
      <div class="inv-footer">Thank you for shopping at Inspiring Beauty Hub · www.ibh.co.ke</div>
    </body></html>`);
    win.document.close();
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
        document.getElementById('orders-tbody').innerHTML = buildOrdersRows(applyOrderFilters(allOrders));
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
      c.querySelectorAll('[data-del-product]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this product?')) return;
          await API.deleteProduct(Number(btn.dataset.delProduct));
          App.toast('Product deleted');
          switchTab('products');
          App.refreshHome();
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
        btn.addEventListener('click', async () => {
          if (!confirm(`Delete brand "${btn.dataset.delBrand}"?`)) return;
          await API.deleteBrand(btn.dataset.delBrand);
          App.toast('Brand deleted');
          switchTab('brands');
        });
      });
    }

    /* ── Categories ── */
    if (tab === 'categories') {
      document.getElementById('add-cat-btn')?.addEventListener('click', () => {
        const name = prompt('Category name:');
        if (!name?.trim()) return;
        const cats = API.getCategories();
        if (cats.includes(name)) { App.toast('Already exists', 'error'); return; }
        cats.push(name); API.saveCategories(cats);
        switchTab('categories'); App.toast(`Category added`, 'success');
      });

      c.querySelectorAll('.chip-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const oldName = btn.dataset.editCat;
          const chip    = btn.closest('.chip');
          const label   = chip.querySelector('.chip-label');
          if (chip.querySelector('.chip-rename-input')) return; // already editing
          chip.innerHTML = `
            <input class="chip-rename-input" value="${oldName}" style="border:1px solid var(--blue);border-radius:4px;padding:2px 6px;font-size:.8125rem;width:120px">
            <button class="chip-action chip-save-edit" style="color:var(--ok);font-weight:700;margin-left:4px">✓</button>
            <button class="chip-action chip-cancel-edit" style="color:var(--err);margin-left:2px">✕</button>`;
          chip.querySelector('.chip-save-edit').addEventListener('click', async () => {
            const newName = chip.querySelector('.chip-rename-input').value.trim();
            if (!newName || newName === oldName) { switchTab('categories'); return; }
            await API.updateCategory(oldName, newName);
            App.toast(`Category renamed`, 'success');
            App.refreshHome();
            switchTab('categories');
          });
          chip.querySelector('.chip-cancel-edit').addEventListener('click', () => switchTab('categories'));
        });
      });

      c.querySelectorAll('[data-del-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cats = API.getCategories().filter(c => c !== btn.dataset.delCat);
          API.saveCategories(cats); switchTab('categories');
        });
      });
    }

    /* ── Add / Edit Product ── */
    if (tab === 'add-product') {
      setupImageInput('ap-img-main', 'ap-img-main-file', 'ap-img-main-preview');
      setupImageInput('ap-img-alt1', 'ap-img-alt1-file', 'ap-img-alt1-preview');
      setupImageInput('ap-img-alt2', 'ap-img-alt2-file', 'ap-img-alt2-preview');

      document.getElementById('save-product-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('ap-name').value.trim();
        if (!name) { App.toast('Enter a product name', 'error'); return; }
        const price = Number(document.getElementById('ap-price').value) || 0;
        const op    = document.getElementById('ap-old-price').value;
        const data  = {
          name,
          brand:      document.getElementById('ap-brand').value,
          cat:        document.getElementById('ap-cat').value,
          subcat:     document.getElementById('ap-subcat').value,
          gender:     document.getElementById('ap-gender').value,
          emoji:      document.getElementById('ap-emoji').value || '🛍️',
          imageMain:  document.getElementById('ap-img-main').value.trim() || null,
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

    /* ── Settings ── */
    if (tab === 'settings') {
      setupImageInput('hero-bg-url', 'hero-bg-file', 'hero-bg-preview');

      document.getElementById('save-settings-btn')?.addEventListener('click', () => {
        const url = document.getElementById('hero-bg-url').value.trim();
        localStorage.setItem('ibh_hero_bg', url);
        App.applyHeroBg();
        App.toast('Settings saved', 'success');
        switchTab('settings');
      });

      document.getElementById('clear-settings-btn')?.addEventListener('click', () => {
        localStorage.removeItem('ibh_hero_bg');
        App.applyHeroBg();
        App.toast('Background removed');
        switchTab('settings');
      });
    }
  }

  /* ── Bind order table row events (re-usable after re-filter) ── */
  function bindOrderTableEvents() {
    const c = document.getElementById('admin-content');
    c?.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        await API.updateOrderStatus(sel.dataset.orderId, sel.value);
        App.toast('Status updated', 'success');
      });
    });
    c?.querySelectorAll('[data-invoice]').forEach(btn => {
      btn.addEventListener('click', () => generateInvoice(btn.dataset.invoice));
    });
  }

  return { open, close, switchTab };
})();
