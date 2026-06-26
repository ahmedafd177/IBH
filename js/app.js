/* ═══════════════════════════════════════
   APP — bootstrap, navigation, events, toast
   ═══════════════════════════════════════ */
const App = (() => {
  let _toastTimer;
  let _shopVisible     = false;
  let _brandsVisible   = false;
  let _wishlistVisible = false;

  /* ── URL helpers ── */
  function _setUrl(path) {
    if (window.location.pathname !== path) history.pushState({ path }, '', path);
  }

  async function _dispatchRoute() {
    const p = window.location.pathname.replace(/\/$/, '') || '/';
    if      (p === '/brands')   await showBrands();
    else if (p === '/wishlist') await showWishlistPage();
    else if (p === '/about')    showAbout();
    else if (p === '/perfume')  await showShop({ cat: 'perfume' }, 'Perfumes',  'Perfume');
    else if (p === '/hair')     await showShop({ cat: 'hair' },    'Hair Care', 'Hair Care');
    else if (p === '/body')     await showShop({ cat: 'body' },    'Body Care', 'Body Care');
    else if (p === '/shop')     await showShop({}, 'All Products', 'Shop');
    else                        showHome();
  }

  /* ── Toast ── */
  function toast(msg, type = '') {
    clearTimeout(_toastTimer);
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    _toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  /* ── Hide / show page sections ── */
  const HOME_SECTIONS = ['new-arrivals', 'trending', 'most-sell', 'why-ibh', 'brands-section', 'hero'];

  function _hideAll() {
    [...HOME_SECTIONS, 'shop', 'brands-page', 'wishlist-page', 'about-page'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    _shopVisible     = false;
    _brandsVisible   = false;
    _wishlistVisible = false;
  }

  /* ── Home sections ── */
  async function refreshHome() {
    await Products.renderGrid(document.getElementById('new-arrivals-grid'), { isNew: true }, 8);
    await renderTrending('all');
    await renderMostSell('all');
    populateBrandsTicker();
    await populateNavBrands();
    await populateNavCategories();
    await populateNavDropdowns();
  }

  async function renderTrending(cat) {
    const filters = cat === 'all' ? { isTrend: true } : { isTrend: true, cat };
    await Products.renderGrid(document.getElementById('trending-grid'), filters, 8);
    document.querySelectorAll('#trending-filter-tabs .filter-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.filter === cat));
  }

  async function renderMostSell(cat) {
    const filters = cat === 'all' ? { isFeat: true } : { isFeat: true, cat };
    await Products.renderGrid(document.getElementById('most-sell-grid'), filters, 8);
    document.querySelectorAll('#most-sell-filter-tabs .filter-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.filter === cat));
  }

  /* ── Shop section ── */
  async function showShop(filters, title = 'Products', eyebrow = 'Shop') {
    const catUrls = { Perfumes: '/perfume', 'Hair Care': '/hair', 'Body Care': '/body', 'All Products': '/shop' };
    _setUrl(catUrls[title] || '/shop');
    _hideAll();
    document.getElementById('shop').hidden = false;
    document.getElementById('shop-h').textContent     = title;
    document.getElementById('shop-label').textContent = eyebrow;
    _shopVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const count = await Products.renderGrid(document.getElementById('shop-grid'), filters);
    document.getElementById('shop-empty').hidden = count > 0;
  }

  function showHome() {
    _setUrl('/');
    _hideAll();
    HOME_SECTIONS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = false;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── About page ── */
  function showAbout() {
    _setUrl('/about');
    _hideAll();
    const aboutPage = document.getElementById('about-page');
    if (aboutPage) aboutPage.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Populate Brands ticker (dynamic from API) ── */
  async function populateBrandsTicker() {
    const ticker = document.querySelector('.brands-ticker');
    if (!ticker) return;
    const brands = await API.getBrandsAsync();
    if (!brands.length) return;
    const spans = brands.map(b => `<span>${b.name}</span>`).join('');
    ticker.innerHTML = spans + spans; // doubled for seamless infinite-scroll loop
  }

  /* ── Populate Brands nav dropdown (async — loads from backend) ── */
  async function populateNavBrands() {
    const grid = document.getElementById('nav-brands-grid');
    if (!grid) return;
    const brands = await API.getBrandsAsync();
    grid.innerHTML = brands.map(brand => {
      const letter = brand.name[0].toUpperCase();
      const avatar = brand.image
        ? `<img src="${brand.image}" alt="${brand.name}">`
        : letter;
      return `
        <a href="#" class="nav-brand-item" data-brand-nav="${brand.name}" aria-label="${brand.name}">
          <div class="nav-brand-avatar">${avatar}</div>
          <span class="nav-brand-name">${brand.name}</span>
        </a>`;
    }).join('');
    /* also populate mobile brands sub-nav */
    const mobBrands = document.getElementById('mobile-brands-list');
    if (mobBrands) {
      mobBrands.innerHTML = brands.map(b =>
        `<a href="#" data-brand-nav="${b.name}">${b.name}</a>`
      ).join('');
    }
  }

  /* ── Populate dynamic Categories in nav and mobile ── */
  async function populateNavCategories() {
    const raw  = await API.getCategoriesAsync();
    const cats = raw.map(c => typeof c === 'string' ? c : c.name);
    /* desktop: Categories dropdown */
    const desktopList = document.getElementById('nav-categories-list');
    if (desktopList && cats.length) {
      desktopList.innerHTML = cats.map(name =>
        `<li><a href="#" data-filter="subcat:${name}">${name}</a></li>`
      ).join('');
    }
    /* mobile: categories sub-nav */
    const mobCatList = document.getElementById('mobile-cats-list');
    if (mobCatList) {
      mobCatList.innerHTML = cats.map(name =>
        `<a href="#" data-filter="subcat:${name}">${name}</a>`
      ).join('');
    }
  }

  /* ── Populate per-category dropdowns (subcats, genders, brands) from DB ── */
  async function populateNavDropdowns() {
    const genderLabels = { Male: "Men's", Female: "Women's", Unisex: 'Unisex', Children: 'Children', All: 'All' };

    const mainCats = [
      { slug: 'perfume', subcatHeading: 'By Type',  showGender: true  },
      { slug: 'hair',    subcatHeading: 'Products',  showGender: false },
      { slug: 'body',    subcatHeading: 'Products',  showGender: false },
    ];

    /* Fetch all data in parallel */
    const [allBrands, allProducts] = await Promise.all([
      API.getBrandsAsync(),
      API.getProducts(),
    ]);

    /* Build lookup: cat → Set of brands, cat → Set of subcats */
    const catBrandSet  = {};
    const catSubcatSet = {};
    allProducts.forEach(p => {
      if (!catBrandSet[p.cat])  catBrandSet[p.cat]  = new Set();
      if (!catSubcatSet[p.cat]) catSubcatSet[p.cat] = new Set();
      catBrandSet[p.cat].add(p.brand);
      catSubcatSet[p.cat].add(p.subcat);
    });

    for (const { slug, subcatHeading, showGender } of mainCats) {
      const inner = document.getElementById(`nav-dropdown-inner-${slug}`);
      if (!inner) continue;

      /* Subcats column */
      const subcats = [...(catSubcatSet[slug] || [])].sort();
      const subcatCol = subcats.length ? `
        <div class="dropdown-col">
          <p class="dropdown-heading">${subcatHeading}</p>
          <ul>
            ${subcats.map(s => `<li><a href="#" data-cat="${slug}" data-filter="subcat:${s}">${s}</a></li>`).join('')}
          </ul>
        </div>` : '';

      /* Gender column — distinct genders that actually exist in DB for this category */
      let genderCol = '';
      if (showGender) {
        const genders = [...new Set(
          allProducts
            .filter(p => p.cat === slug && p.gender && p.gender !== 'All')
            .map(p => p.gender)
        )].sort();
        if (genders.length) {
          genderCol = `
            <div class="dropdown-col">
              <p class="dropdown-heading">By Gender</p>
              <ul>
                ${genders.map(g =>
                  `<li><a href="#" data-cat="${slug}" data-filter="gender:${g}">${genderLabels[g] || g}</a></li>`
                ).join('')}
              </ul>
            </div>`;
        }
      }

      /* Brands column — only brands that have products in this category */
      const catBrands = allBrands.filter(b => catBrandSet[slug]?.has(b.name));
      const brandsCol = catBrands.length ? `
        <div class="dropdown-col">
          <p class="dropdown-heading">By Brand</p>
          <ul>
            ${catBrands.map(b => `<li><a href="#" data-cat="${slug}" data-filter="brand:${b.name}">${b.name}</a></li>`).join('')}
          </ul>
        </div>` : '';

      inner.innerHTML = subcatCol + genderCol + brandsCol;
    }
  }

  /* ── Wishlist page ── */
  async function showWishlistPage() {
    const wish = API.getWishlist();
    if (!wish.length) { toast('Your wishlist is empty', 'error'); showHome(); return; }
    _setUrl('/wishlist');
    _hideAll();
    const wishPage = document.getElementById('wishlist-page');
    if (!wishPage) {
      await showShop({}, 'My Wishlist', 'Wishlist');
      return;
    }
    wishPage.hidden  = false;
    _wishlistVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const all  = await API.getProducts();
    const ps   = all.filter(p => wish.includes(p.id));
    const grid = document.getElementById('wishlist-grid');
    if (grid) {
      grid.innerHTML = ps.length
        ? ps.map(p => Products.card(p, wish)).join('')
        : `<div class="empty-state" style="grid-column:1/-1">
             <span class="empty-icon">💔</span>
             <h3>Your wishlist is empty</h3>
             <p>Browse products and tap the heart icon to save favourites</p>
           </div>`;
    }
  }

  /* ── Brands page ── */
  async function showBrands() {
    _setUrl('/brands');
    _hideAll();
    document.getElementById('brands-page').hidden = false;
    _brandsVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const brands   = await API.getBrandsAsync();
    const products = await API.getProducts();
    const grid     = document.getElementById('brands-grid');

    grid.innerHTML = brands.map(brand => {
      const count  = products.filter(p => p.brand === brand.name).length;
      const letter = brand.name[0].toUpperCase();
      const avatar = brand.image
        ? `<img src="${brand.image}" alt="${brand.name}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`
        : letter;
      return `
        <div class="brand-card" data-brand-select="${brand.name}" role="button" tabindex="0" aria-label="${brand.name}">
          <div class="brand-card-letter">${avatar}</div>
          <div class="brand-card-name">${brand.name}</div>
          <div class="brand-card-count">${count} product${count !== 1 ? 's' : ''}</div>
        </div>`;
    }).join('');

    /* keyboard support for brand cards */
    grid.querySelectorAll('.brand-card').forEach(card => {
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showShop({ brand: card.dataset.brandSelect }, card.dataset.brandSelect, 'Brand');
        }
      });
    });
  }

  /* ── Hero background ── */
  const DEFAULT_HERO_BG = '/assets/videos/backgroud.mp4';

  function applyHeroBg() {
    const url    = (localStorage.getItem('ibh_hero_bg') || DEFAULT_HERO_BG).trim();
    const bgDiv  = document.getElementById('hero-bg');
    const video  = document.getElementById('hero-bg-video');
    const img    = document.getElementById('hero-bg-img');
    if (!bgDiv) return;

    bgDiv.classList.add('has-media');
    if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      if (img)   img.src  = '';
      if (video) { video.src = url; video.load(); }
    } else {
      if (video) video.src = '';
      if (img)   img.src   = url;
    }
  }

  /* ── Cart helpers ── */
  function closeCart() {
    document.getElementById('drawer-overlay').classList.remove('open');
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('cart-drawer').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Product modal close ── */
  function closeProductModal() {
    document.getElementById('product-overlay').classList.remove('open');
    document.getElementById('product-modal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Checkout modal close ── */
  function closeCheckoutModal() {
    document.getElementById('checkout-overlay').classList.remove('open');
    document.getElementById('checkout-modal').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ── Search ── */
  let _searchTimer;
  function handleSearch(q) {
    clearTimeout(_searchTimer);
    const results = document.getElementById('search-results');
    const list    = document.getElementById('search-results-list');
    if (!q.trim()) { results.hidden = true; return; }
    _searchTimer = setTimeout(async () => {
      const ps = await API.getProducts({ search: q });
      if (!ps.length) {
        list.innerHTML = `<div class="search-no-results">No results for "${q}"</div>`;
      } else {
        list.innerHTML = ps.slice(0, 6).map(p => `
          <div class="search-result-item" data-product-id="${p.id}">
            <div class="search-result-emoji">
              ${p.imageMain
                ? `<img src="${p.imageMain}" alt="${p.name}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">`
                : p.emoji}
            </div>
            <div class="search-result-info">
              <div class="search-result-name">${p.name}</div>
              <div class="search-result-brand">${p.brand} · ${p.subcat}</div>
            </div>
            <div class="search-result-price">KES ${p.price.toLocaleString()}</div>
          </div>`).join('') +
          (ps.length > 6 ? `<div class="search-result-item" data-search-all="${q}" style="justify-content:center;color:var(--blue);font-weight:600">
            View all ${ps.length} results →</div>` : '');
      }
      results.hidden = false;
    }, 300);
  }

  /* ── Mobile menu ── */
  function toggleMobileMenu(open) {
    document.getElementById('mobile-nav').classList.toggle('open', open);
    document.getElementById('mobile-overlay').classList.toggle('open', open);
    document.getElementById('menu-toggle').classList.toggle('open', open);
    document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
  }

  /* ── Notification bar ── */
  function dismissNotif() {
    const bar = document.getElementById('notif-bar');
    bar.style.maxHeight = bar.offsetHeight + 'px';
    requestAnimationFrame(() => {
      bar.style.transition = 'max-height .35s ease, opacity .35s ease';
      bar.style.maxHeight  = '0';
      bar.style.overflow   = 'hidden';
      bar.style.opacity    = '0';
    });
  }

  /* ── Header scroll effect ── */
  function onScroll() {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 60);
  }

  /* ── Event delegation: main clickable ── */
  function handleClick(e) {
    const t = e.target;

    /* Product card click */
    const card = t.closest('.pcard');
    if (card && !t.closest('.pcard-wish') && !t.closest('.pcard-add')) {
      Products.openModal(Number(card.dataset.productId));
      return;
    }

    /* Buy Now button (product modal) */
    const buyBtn = t.closest('[data-buy-id]');
    if (buyBtn) {
      Checkout.buyNow(Number(buyBtn.dataset.buyId));
      return;
    }

    /* Brand card click (brands page) */
    const brandCard = t.closest('[data-brand-select]');
    if (brandCard) {
      showShop({ brand: brandCard.dataset.brandSelect }, brandCard.dataset.brandSelect, 'Brand');
      return;
    }

    /* Brand item click (nav dropdown) */
    const brandNavItem = t.closest('[data-brand-nav]');
    if (brandNavItem) {
      e.preventDefault();
      showShop({ brand: brandNavItem.dataset.brandNav }, brandNavItem.dataset.brandNav, 'Brand');
      return;
    }

    /* Wishlist toggle */
    const wishBtn = t.closest('[data-wish-id]');
    if (wishBtn) {
      e.preventDefault(); e.stopPropagation();
      const id   = Number(wishBtn.dataset.wishId);
      const wish = API.getWishlist();
      const idx  = wish.indexOf(id);
      if (idx > -1) wish.splice(idx, 1); else wish.push(id);
      API.saveWishlist(wish);
      const inWish = wish.includes(id);
      toast(inWish ? 'Added to wishlist ❤️' : 'Removed from wishlist');
      const countEl = document.getElementById('wishlist-count');
      countEl.textContent = wish.length;
      countEl.hidden = wish.length === 0;
      if (_wishlistVisible) showWishlistPage(); else refreshHome();
      return;
    }

    /* Quantity selector toggle */
    const addQtyBtn = t.closest('[data-product-id].pcard-add-qty');
    if (addQtyBtn) {
      e.preventDefault(); e.stopPropagation();
      const productId = addQtyBtn.dataset.productId;
      const card = addQtyBtn.closest('.pcard');
      const selector = card?.querySelector('.pcard-qty-selector');
      const addBtn = card?.querySelector('.pcard-add-qty');
      if (selector && addBtn) {
        addBtn.style.display = 'none';
        selector.style.display = 'flex';
      }
      return;
    }

    /* Quantity +/- buttons */
    const qtyBtn = t.closest('.pcard-qty-btn');
    if (qtyBtn) {
      e.preventDefault(); e.stopPropagation();
      const input = qtyBtn.closest('.pcard-qty-selector')?.querySelector('.pcard-qty-input');
      if (input) {
        const action = qtyBtn.dataset.qtyAction;
        let val = parseInt(input.value) || 1;
        const max = parseInt(input.max) || 10;
        if (action === 'plus') val = Math.min(val + 1, max);
        if (action === 'minus') val = Math.max(val - 1, 1);
        input.value = val;
      }
      return;
    }

    /* Add to cart (product cards + product modal) */
    const addBtn = t.closest('[data-add-id]');
    if (addBtn) {
      e.preventDefault(); e.stopPropagation();
      let qty = 1;
      const input = addBtn.closest('.pcard-qty-selector')?.querySelector('.pcard-qty-input');
      if (input) qty = parseInt(input.value) || 1;

      const productId = Number(addBtn.dataset.addId);
      Cart.add(productId, qty);

      // Reset quantity selector if in card view
      const selector = addBtn.closest('.pcard-qty-selector');
      const addQtyBtn = addBtn.closest('.pcard')?.querySelector('.pcard-add-qty');
      if (selector && addQtyBtn) {
        selector.style.display = 'none';
        addQtyBtn.style.display = 'flex';
        if (input) input.value = '1';
      }

      if (addBtn.hasAttribute('data-close-modal')) closeProductModal();
      return;
    }

    /* Cart checkout button */
    if (t.closest('[data-cart-checkout]')) {
      Cart.openCheckout();
      return;
    }

    /* Cart qty / remove */
    if (t.closest('[data-qty]')) {
      const btn = t.closest('[data-qty]');
      Cart.changeQty(Number(btn.dataset.qty), Number(btn.dataset.d));
      return;
    }
    if (t.closest('[data-rm]')) {
      Cart.remove(Number(t.closest('[data-rm]').dataset.rm));
      return;
    }

    /* Nav category links */
    const catLink = t.closest('[data-cat]');
    if (catLink && catLink.dataset.cat) {
      e.preventDefault();
      const cat    = catLink.dataset.cat;
      const filter = catLink.dataset.filter;
      const filters = { cat };
      if (filter) {
        const [key, val] = filter.split(':');
        filters[key] = val;
      }
      const labels = { perfume: 'Perfumes', hair: 'Hair Care', body: 'Body Care' };
      showShop(filters, labels[cat] || cat, 'Shop');
      toggleMobileMenu(false);
      return;
    }

    /* Hero / section CTAs */
    const action = t.closest('[data-action]');
    if (action) {
      const act = action.dataset.action;
      if (act === 'shop-all') {
        if (action.hasAttribute('data-close-cart')) closeCart();
        showShop({}, 'All Products', 'Shop');
      }
      if (act === 'view-brands') showBrands();
      if (act === 'show-brands') { showBrands(); toggleMobileMenu(false); }
      if (act === 'show-about')  { e.preventDefault(); showAbout(); toggleMobileMenu(false); }
      return;
    }

    /* Footer / nav filter links */
    const filterLink = t.closest('[data-filter]');
    if (filterLink && filterLink.dataset.filter && !filterLink.dataset.cat) {
      e.preventDefault();
      const [key, val] = filterLink.dataset.filter.split(':');
      const filters = {}; filters[key] = key === 'isNew' || key === 'isTrend' || key === 'isFeat' ? true : val;
      showShop(filters, val || 'Products', 'Shop');
      return;
    }

    /* Search result item */
    const srItem = t.closest('.search-result-item');
    if (srItem) {
      if (srItem.dataset.productId) {
        Products.openModal(Number(srItem.dataset.productId));
        document.getElementById('search-results').hidden = true;
      }
      if (srItem.dataset.searchAll) {
        showShop({ search: srItem.dataset.searchAll }, `"${srItem.dataset.searchAll}"`, 'Search');
        document.getElementById('search-results').hidden = true;
      }
      return;
    }

    /* Admin tabs */
    const adminTab = t.closest('.admin-tab');
    if (adminTab && adminTab.dataset.tab) {
      Admin.switchTab(adminTab.dataset.tab);
      return;
    }
  }

  /* ── INIT ── */
  async function init() {
    API.init();

    /* Route: dispatch based on current URL, then render data */
    await _dispatchRoute();
    window.addEventListener('popstate', () => _dispatchRoute());

    /* Render home sections (grids populate in background even if hidden) */
    await refreshHome();

    /* Populate Brands nav dropdown */
    await populateNavBrands();

    /* Populate Brands ticker from stored brands */
    await populateBrandsTicker();

    /* Populate Categories nav dropdown */
    await populateNavCategories();

    /* Populate per-category dropdowns (subcats, genders, brands) */
    await populateNavDropdowns();

    /* Apply hero background if set */
    applyHeroBg();

    /* Update badge + wishlist count */
    Cart.updateBadge();
    const wish = API.getWishlist();
    const wc = document.getElementById('wishlist-count');
    wc.textContent = wish.length;
    wc.hidden = wish.length === 0;

    /* Header scroll */
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Close notification bar */
    document.getElementById('close-notif').addEventListener('click', dismissNotif);

    /* Logo → home */
    document.getElementById('logo-link').addEventListener('click', e => {
      e.preventDefault();
      if (_shopVisible || _brandsVisible) showHome();
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* Home nav link */
    document.getElementById('nav-home-link')?.addEventListener('click', e => {
      e.preventDefault();
      showHome();
      toggleMobileMenu(false);
    });

    /* Cart */
    document.getElementById('cart-btn').addEventListener('click', Cart.open);
    document.getElementById('cart-close').addEventListener('click', closeCart);
    document.getElementById('drawer-overlay').addEventListener('click', closeCart);

    /* Modals close — prevent closing when clicking inside modal */
    document.getElementById('product-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('product-overlay')) closeProductModal();
    });
    document.getElementById('product-modal-close').addEventListener('click', closeProductModal);

    document.getElementById('checkout-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('checkout-overlay')) closeCheckoutModal();
    });
    document.getElementById('checkout-modal-close').addEventListener('click', closeCheckoutModal);

    /* Admin — open panel (index.html only; admin.html navigates directly) */
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
      });
    }

    /* Wishlist panel */
    document.getElementById('wishlist-btn').addEventListener('click', showWishlistPage);
    document.getElementById('mobile-wishlist-btn')?.addEventListener('click', () => {
      toggleMobileMenu(false);
      showWishlistPage();
    });

    /* Mobile menu */
    document.getElementById('menu-toggle').addEventListener('click', () =>
      toggleMobileMenu(!document.getElementById('mobile-nav').classList.contains('open')));
    document.getElementById('mobile-close').addEventListener('click', () => toggleMobileMenu(false));
    document.getElementById('mobile-overlay').addEventListener('click', () => toggleMobileMenu(false));
    document.querySelectorAll('.mobile-nav-group-toggle').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.mobile-nav-group').classList.toggle('open'));
    });

    /* Search */
    const searchToggle = document.getElementById('search-toggle');
    const searchExpand = document.getElementById('search-expand');
    const searchInput  = document.getElementById('search-input');
    const searchClear  = document.getElementById('search-clear');
    searchToggle.addEventListener('click', () => {
      const isOpen = searchExpand.classList.toggle('open');
      searchToggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) searchInput.focus();
    });
    searchInput.addEventListener('input', () => handleSearch(searchInput.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        showShop({ search: searchInput.value }, `"${searchInput.value}"`, 'Search');
        document.getElementById('search-results').hidden = true;
        searchExpand.classList.remove('open');
      }
      if (e.key === 'Escape') {
        searchExpand.classList.remove('open');
        document.getElementById('search-results').hidden = true;
      }
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      document.getElementById('search-results').hidden = true;
      searchExpand.classList.remove('open');
      searchToggle.setAttribute('aria-expanded', 'false');
    });

    /* Brands ticker — click any brand name to view its products */
    const brandsTicker = document.querySelector('.brands-ticker-wrap');
    if (brandsTicker) {
      brandsTicker.addEventListener('click', e => {
        const span = e.target.closest('span');
        if (!span) return;
        const brand = span.textContent.trim();
        if (brand) showShop({ brand }, brand, 'Brand');
      });
    }

    /* Trending filter tabs */
    document.getElementById('trending-filter-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.filter-tab');
      if (tab) renderTrending(tab.dataset.filter);
    });

    /* Most-sell filter tabs */
    document.getElementById('most-sell-filter-tabs').addEventListener('click', e => {
      const tab = e.target.closest('.filter-tab');
      if (tab) renderMostSell(tab.dataset.filter);
    });

    /* Shop back button */
    document.getElementById('shop-back').addEventListener('click', showHome);

    /* Brands back button */
    document.getElementById('brands-back').addEventListener('click', showHome);

    /* Wishlist back button */
    document.getElementById('wishlist-back')?.addEventListener('click', showHome);

    /* About back button */
    document.getElementById('about-back')?.addEventListener('click', showHome);

    /* Mobile cart button */
    document.getElementById('mobile-cart-btn')?.addEventListener('click', () => {
      toggleMobileMenu(false);
      Cart.open();
    });

    /* Mobile home link */
    document.getElementById('mobile-home-link')?.addEventListener('click', e => {
      e.preventDefault();
      showHome();
      toggleMobileMenu(false);
    });

    /* Mobile search */
    const mobileSearch = document.getElementById('mobile-search-input');
    if (mobileSearch) {
      mobileSearch.addEventListener('input', () => handleSearch(mobileSearch.value));
      mobileSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter' && mobileSearch.value.trim()) {
          showShop({ search: mobileSearch.value }, `"${mobileSearch.value}"`, 'Search');
          document.getElementById('search-results').hidden = true;
          toggleMobileMenu(false);
        }
      });
    }

    /* Delegated clicks */
    document.addEventListener('click', handleClick);

    /* Keyboard accessibility for product cards and brand cards */
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = document.activeElement.closest('.pcard');
        if (card) { e.preventDefault(); Products.openModal(Number(card.dataset.productId)); }
      }
      if (e.key === 'Escape') {
        closeCart(); closeProductModal(); closeCheckoutModal();
        toggleMobileMenu(false);
        document.getElementById('search-results').hidden = true;
        searchExpand.classList.remove('open');
      }
    });
  }

  return {
    init,
    toast,
    refreshHome,
    renderTrending,
    renderMostSell,
    showShop,
    showHome,
    showBrands,
    showWishlistPage,
    showAbout,
    applyHeroBg,
    closeCart,
    closeProductModal,
    closeCheckoutModal,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
