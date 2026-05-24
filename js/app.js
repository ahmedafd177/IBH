/* ═══════════════════════════════════════
   APP — bootstrap, navigation, events, toast
   ═══════════════════════════════════════ */
const App = (() => {
  let _toastTimer;
  let _shopVisible    = false;
  let _brandsVisible  = false;

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
    [...HOME_SECTIONS, 'shop', 'brands-page'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    _shopVisible   = false;
    _brandsVisible = false;
  }

  /* ── Home sections ── */
  async function refreshHome() {
    await Products.renderGrid(document.getElementById('new-arrivals-grid'), { isNew: true }, 8);
    await renderTrending('all');
    await renderMostSell('all');
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
    _hideAll();
    HOME_SECTIONS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = false;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Populate Brands nav dropdown ── */
  function populateNavBrands() {
    const grid = document.getElementById('nav-brands-grid');
    if (!grid) return;
    const brands = API.getBrands();
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
  }

  /* ── Brands page ── */
  async function showBrands() {
    _hideAll();
    document.getElementById('brands-page').hidden = false;
    _brandsVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const brands   = API.getBrands();
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

    /* Brand card click (brands page) */
    const brandCard = t.closest('[data-brand-select]');
    if (brandCard) {
      const brand = brandCard.dataset.brandSelect;
      showShop({ brand }, brand, 'Brand');
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
      refreshHome();
      const inWish = wish.includes(id);
      if (inWish) toast('Added to wishlist ❤️'); else toast('Removed from wishlist');
      const countEl = document.getElementById('wishlist-count');
      countEl.textContent = wish.length;
      countEl.hidden = wish.length === 0;
      return;
    }

    /* Add to cart */
    const addBtn = t.closest('[data-add-id]');
    if (addBtn && !addBtn.classList.contains('pd-add')) {
      e.preventDefault(); e.stopPropagation();
      Cart.add(Number(addBtn.dataset.addId));
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
      let filters  = { cat };
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
      if (act === 'shop-all')    showShop({}, 'All Products', 'Shop');
      if (act === 'view-brands') showBrands();
      if (act === 'show-brands') { showBrands(); toggleMobileMenu(false); }
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

    /* Render home sections */
    await refreshHome();

    /* Populate Brands nav dropdown */
    populateNavBrands();

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

    /* Cart */
    document.getElementById('cart-btn').addEventListener('click', Cart.open);
    document.getElementById('cart-close').addEventListener('click', closeCart);
    document.getElementById('drawer-overlay').addEventListener('click', closeCart);

    /* Modals close */
    document.getElementById('product-overlay').addEventListener('click', closeProductModal);
    document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
    document.getElementById('checkout-overlay').addEventListener('click', closeCheckoutModal);
    document.getElementById('checkout-modal-close').addEventListener('click', closeCheckoutModal);

    /* Admin — open panel (index.html only; admin.html navigates directly) */
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
      });
    }

    /* Wishlist panel */
    document.getElementById('wishlist-btn').addEventListener('click', () => {
      const wish = API.getWishlist();
      if (!wish.length) { toast('Your wishlist is empty', 'error'); return; }
      showShop({ search: '' }, 'Wishlist', 'Your Wishlist').then(() => {
        API.getProducts().then(all => {
          const ps   = all.filter(p => wish.includes(p.id));
          const grid = document.getElementById('shop-grid');
          grid.innerHTML = ps.map(p => Products.card(p, wish)).join('');
        });
      });
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
    applyHeroBg,
    closeCart,
    closeProductModal,
    closeCheckoutModal,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
