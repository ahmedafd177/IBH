/* ═══════════════════════════════════════
   API — data access layer
   localStorage mode: USE_LOCAL_STORAGE = true (default)
   Backend mode: set USE_LOCAL_STORAGE = false and BASE_URL in config.js
   The server auto-switches this by intercepting /js/config.js
   ═══════════════════════════════════════ */
const API = (() => {
  const { LS_KEYS: K } = Config;
  const ls = () => Config.USE_LOCAL_STORAGE;

  /* ── localStorage helpers ── */
  const lsGet = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const lsSet = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  /* ── fetch helpers ── */
  const api = async (path, opts = {}) => {
    const res = await fetch(`${Config.BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body,
    });
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
  };

  /* ── initialise if first visit ── */
  function init() {
    if (!ls()) return; // backend handles seeding
    if (!lsGet(K.PRODUCTS))   lsSet(K.PRODUCTS,   SeedData.products);
    if (!lsGet(K.BRANDS))     lsSet(K.BRANDS,     SeedData.brands);
    if (!lsGet(K.CATEGORIES)) lsSet(K.CATEGORIES, SeedData.categories);
    if (!lsGet(K.CART))       lsSet(K.CART,       []);
    if (!lsGet(K.WISHLIST))   lsSet(K.WISHLIST,   []);
    if (!lsGet(K.ORDERS))     lsSet(K.ORDERS,     []);
  }

  /* ─────────────── PRODUCTS ─────────────── */

  async function getProducts(filters = {}) {
    if (ls()) {
      let ps = lsGet(K.PRODUCTS) || [];
      if (!filters.admin)  ps = ps.filter(p => p.isVisible !== false);
      if (filters.cat)     ps = ps.filter(p => p.cat === filters.cat);
      if (filters.brand)   ps = ps.filter(p => p.brand === filters.brand);
      if (filters.gender)  ps = ps.filter(p => p.gender === filters.gender || p.gender === 'All');
      if (filters.subcat)  ps = ps.filter(p => p.subcat === filters.subcat);
      if (filters.isNew)   ps = ps.filter(p => p.isNew);
      if (filters.isTrend) ps = ps.filter(p => p.isTrend);
      if (filters.isFeat)  ps = ps.filter(p => p.isFeat);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        ps = ps.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.subcat.toLowerCase().includes(q) ||
          (p.gender || '').toLowerCase().includes(q)
        );
      }
      return ps;
    }
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, v); });
    return api(`/products?${params}`);
  }

  async function getProduct(id) {
    if (ls()) {
      const ps = lsGet(K.PRODUCTS) || [];
      return ps.find(p => p.id === id) || null;
    }
    return api(`/products/${id}`);
  }

  async function addProduct(product) {
    if (ls()) {
      const ps = lsGet(K.PRODUCTS) || [];
      const np = { ...product, id: Date.now(), rating: 4.5, isVisible: product.isVisible !== false };
      ps.unshift(np);
      lsSet(K.PRODUCTS, ps);
      return np;
    }
    return api('/products', { method: 'POST', body: product });
  }

  async function updateProduct(id, data) {
    if (ls()) {
      const ps = lsGet(K.PRODUCTS) || [];
      const idx = ps.findIndex(p => p.id === id);
      if (idx > -1) { ps[idx] = { ...ps[idx], ...data }; lsSet(K.PRODUCTS, ps); }
      return ps[idx];
    }
    return api(`/products/${id}`, { method: 'PUT', body: data });
  }

  async function deleteProduct(id) {
    if (ls()) {
      lsSet(K.PRODUCTS, (lsGet(K.PRODUCTS) || []).filter(p => p.id !== id));
      return;
    }
    return api(`/products/${id}`, { method: 'DELETE' });
  }

  /* ─────────────── BRANDS ─────────────── */

  function _migrateBrands(brands) {
    if (!brands || !brands.length) return SeedData.brands;
    if (typeof brands[0] === 'string') {
      const migrated = brands.map(name => ({ name, image: null }));
      lsSet(K.BRANDS, migrated);
      return migrated;
    }
    return brands;
  }

  function getBrands() {
    if (ls()) return _migrateBrands(lsGet(K.BRANDS));
    return []; // overridden by async version below
  }

  async function getBrandsAsync() {
    if (ls()) return _migrateBrands(lsGet(K.BRANDS));
    return api('/brands');
  }

  function saveBrands(brands) {
    lsSet(K.BRANDS, brands);
  }

  async function addBrand({ name, image = null }) {
    if (ls()) {
      const brands = getBrands();
      if (brands.find(b => b.name === name)) return;
      brands.push({ name, image });
      lsSet(K.BRANDS, brands);
      return { name, image };
    }
    return api('/brands', { method: 'POST', body: { name, image } });
  }

  async function updateBrand(oldName, { name, image }) {
    if (ls()) {
      let brands = getBrands();
      const idx = brands.findIndex(b => b.name === oldName);
      if (idx > -1) { brands[idx] = { name, image }; lsSet(K.BRANDS, brands); }
      if (oldName !== name) {
        const ps = lsGet(K.PRODUCTS) || [];
        ps.forEach(p => { if (p.brand === oldName) p.brand = name; });
        lsSet(K.PRODUCTS, ps);
      }
      return brands[idx];
    }
    const brand = getBrands().find(b => b.name === oldName);
    const id = brand?.id;
    return api(`/brands/${id}`, { method: 'PUT', body: { oldName, name, image } });
  }

  async function deleteBrand(name) {
    if (ls()) {
      lsSet(K.BRANDS, getBrands().filter(b => b.name !== name));
      return;
    }
    const brands = await getBrandsAsync();
    const brand = brands.find(b => b.name === name);
    if (brand?.id) return api(`/brands/${brand.id}`, { method: 'DELETE' });
  }

  /* ─────────────── CATEGORIES ─────────────── */

  function getCategories() {
    if (!ls()) return [];
    const cats = lsGet(K.CATEGORIES);
    return (cats && cats.length > 0) ? cats : SeedData.categories;
  }

  async function getCategoriesAsync() {
    if (!ls()) return api('/categories');
    const cats = lsGet(K.CATEGORIES);
    return (cats && cats.length > 0) ? cats : SeedData.categories;
  }

  function saveCategories(cats) {
    lsSet(K.CATEGORIES, cats);
  }

  async function updateCategory(oldName, newName) {
    if (ls()) {
      const cats = getCategories();
      const idx = cats.indexOf(oldName);
      if (idx > -1) { cats[idx] = newName; lsSet(K.CATEGORIES, cats); }
      const ps = lsGet(K.PRODUCTS) || [];
      ps.forEach(p => { if (p.subcat === oldName) p.subcat = newName; });
      lsSet(K.PRODUCTS, ps);
      return;
    }
    return api('/categories/rename', { method: 'POST', body: { oldName, newName } });
  }

  async function addCategory(name) {
    if (ls()) {
      const cats = getCategories();
      if (cats.includes(name)) throw new Error('Category already exists');
      cats.push(name);
      lsSet(K.CATEGORIES, cats);
      return { name };
    }
    return api('/categories', { method: 'POST', body: { name } });
  }

  async function deleteCategory(name) {
    if (ls()) {
      lsSet(K.CATEGORIES, getCategories().filter(c => c !== name));
      return;
    }
    const cats = await getCategoriesAsync();
    const cat = cats.find(c => c.name === name || c === name);
    const id = cat?.id || encodeURIComponent(name);
    return api(`/categories/${id}`, { method: 'DELETE' });
  }

  /* ─────────────── MAIN CATEGORIES ─────────────── */
  const _mainCatsFallback = [
    { id: 1, slug: 'perfume', name: 'Perfume',   image: null },
    { id: 2, slug: 'hair',    name: 'Hair Care',  image: null },
    { id: 3, slug: 'body',    name: 'Body Care',  image: null },
  ];

  async function getMainCategoriesAsync() {
    if (ls()) return _mainCatsFallback;
    return api('/main-categories');
  }

  async function updateMainCategory(id, data) {
    if (ls()) return data;
    return api(`/main-categories/${id}`, { method: 'PUT', body: data });
  }

  /* ─────────────── CART ─────────────── */
  function getCart()      { return lsGet(K.CART) || []; }
  function saveCart(cart) { lsSet(K.CART, cart); }

  /* ─────────────── WISHLIST ─────────────── */
  function getWishlist()       { return lsGet(K.WISHLIST) || []; }
  function saveWishlist(wish)  { lsSet(K.WISHLIST, wish); }

  /* ─────────────── ORDERS ─────────────── */
  async function getOrders(filters = {}) {
    if (ls()) {
      let orders = lsGet(K.ORDERS) || [];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        orders = orders.filter(o =>
          o.id.toLowerCase().includes(q) ||
          (o.customer?.phone || '').includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q)
        );
      }
      if (filters.status) orders = orders.filter(o => o.status === filters.status);
      if (filters.date)   orders = orders.filter(o => o.date === filters.date);
      return orders;
    }
    const params = new URLSearchParams(filters);
    return api(`/orders?${params}`);
  }

  async function createOrder(order) {
    if (ls()) {
      const orders = lsGet(K.ORDERS) || [];
      const newOrder = {
        ...order,
        id:     'IBH-' + Date.now(),
        status: 'confirmed',
        date:   new Date().toLocaleDateString('en-KE'),
        time:   new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
      };
      orders.unshift(newOrder);
      lsSet(K.ORDERS, orders);
      return newOrder;
    }
    return api('/orders', { method: 'POST', body: order });
  }

  async function updateOrderStatus(id, status) {
    if (ls()) {
      const orders = lsGet(K.ORDERS) || [];
      const o = orders.find(x => x.id === id);
      if (o) { o.status = status; lsSet(K.ORDERS, orders); }
      return;
    }
    return api(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
  }

  /* ─────────────── USERS ─────────────── */
  async function createUser({ name, phone, email = '', role = 'customer', password = 'ibh2025' }) {
    if (ls()) {
      const accounts = JSON.parse(localStorage.getItem('ibh_accounts') || '[]');
      if (accounts.find(a => a.phone === phone)) throw new Error('Phone already registered');
      const u = { id: Date.now(), name, phone, email, role, orderCount: 0, totalSpent: 0, lastOrder: '' };
      accounts.push({ ...u, pw: btoa(password) });
      localStorage.setItem('ibh_accounts', JSON.stringify(accounts));
      return u;
    }
    return api('/users', { method: 'POST', body: { name, phone, email, role, password } });
  }

  async function updateUserRole(id, role, extra = {}) {
    if (ls()) {
      const accounts = JSON.parse(localStorage.getItem('ibh_accounts') || '[]');
      const a = accounts.find(x => String(x.id) === String(id) || x.phone === id);
      if (a) { Object.assign(a, { role, ...extra }); localStorage.setItem('ibh_accounts', JSON.stringify(accounts)); }
      return;
    }
    return api(`/users/${id}`, { method: 'PUT', body: { role, ...extra } });
  }

  async function deleteUser(id) {
    if (ls()) {
      const accounts = JSON.parse(localStorage.getItem('ibh_accounts') || '[]');
      localStorage.setItem('ibh_accounts', JSON.stringify(accounts.filter(a => String(a.id) !== String(id) && a.phone !== id)));
      return;
    }
    return api(`/users/${id}`, { method: 'DELETE' });
  }

  async function getUsers() {
    if (ls()) {
      const orders = lsGet(K.ORDERS) || [];
      const map = {};
      orders.forEach(o => {
        const phone = o.customer?.phone || (typeof o.customer === 'string' ? o.customer : '');
        if (!phone) return;
        if (!map[phone]) map[phone] = {
          name: o.customer?.name || o.customer || 'Unknown',
          phone,
          email: o.customer?.email || '',
          orderCount: 0, totalSpent: 0, lastOrder: '',
        };
        map[phone].orderCount++;
        map[phone].totalSpent += o.total || 0;
        if (!map[phone].lastOrder || o.date > map[phone].lastOrder) map[phone].lastOrder = o.date;
      });
      return Object.values(map).sort((a, b) => b.orderCount - a.orderCount);
    }
    return api('/users');
  }

  /* ─────────────── FILE UPLOAD ─────────────── */
  async function uploadImage(file) {
    if (ls()) {
      /* localStorage mode: base64 data URL */
      return new Promise((resolve, reject) => {
        if (file.size > 2 * 1024 * 1024) {
          reject(new Error('Image must be under 2 MB (localStorage limit)'));
          return;
        }
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${Config.BASE_URL}/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  }

  return {
    init,
    getProducts, getProduct, addProduct, updateProduct, deleteProduct,
    getBrands, getBrandsAsync, saveBrands, addBrand, updateBrand, deleteBrand,
    getCategories, getCategoriesAsync, saveCategories, addCategory, updateCategory, deleteCategory,
    getMainCategoriesAsync, updateMainCategory,
    getCart, saveCart,
    getWishlist, saveWishlist,
    getOrders, createOrder, updateOrderStatus,
    getUsers, createUser, updateUserRole, deleteUser,
    uploadImage,
  };
})();
