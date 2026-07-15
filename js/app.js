/* ═══════════════════════════════════════
   APP — bootstrap, navigation, events, toast
   ═══════════════════════════════════════ */
const App = (() => {
  let _shopVisible     = false;
  let _brandsVisible   = false;
  let _wishlistVisible = false;

  /* ── URL helpers ── */
  function _setUrl(path) {
    if (window.location.pathname !== path) history.pushState({ path }, '', path);
  }

  async function _dispatchRoute() {
    const p = window.location.pathname.replace(/\/$/, '') || '/';
    if      (p === '/brands')        await showBrands();
    else if (p === '/wishlist')      await showWishlistPage();
    else if (p === '/about')         showAbout();
    else if (p === '/terms')         showTerms();
    else if (p === '/perfume')       await showShop({ cat: 'perfume' }, 'Perfumes',  'Perfume');
    else if (p === '/hair')          await showShop({ cat: 'hair' },    'Hair Care', 'Hair Care');
    else if (p === '/body')          await showShop({ cat: 'body' },    'Body Care', 'Body Care');
    else if (p === '/shop')          await showShop({}, 'All Products', 'Shop');
    else if (p.startsWith('/product/')) {
      const pid = parseInt(p.split('/')[2], 10);
      if (pid) await showProductDetail(pid);
      else showHome();
    }
    else showHome();
  }

  /* ── Toast ──
     Each toast owns its own dismiss timer so multiple toasts (e.g.
     deleting several brands in a row) stack and each auto-dismisses
     independently, instead of a later toast cancelling an earlier
     one's timer and leaving it stuck on screen. */
  function toast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  /* ── Hide / show page sections ── */
  const HOME_SECTIONS = ['new-arrivals', 'trending', 'most-sell', 'why-ibh', 'brands-section', 'hero'];

  function _hideAll() {
    [...HOME_SECTIONS, 'shop', 'brands-page', 'wishlist-page', 'about-page', 'terms-page', 'product-detail'].forEach(id => {
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
    populateBrandsShowcase();
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
    _populateShopSidebar(filters);
    const count = await Products.renderGrid(document.getElementById('shop-grid'), filters);
    document.getElementById('shop-empty').hidden = count > 0;
  }

  async function _populateShopSidebar(activeFilters) {
    const sidebar = document.getElementById('shop-sidebar');
    if (!sidebar) return;
    const inner = sidebar.querySelector('.shop-sidebar-inner');
    if (!inner) return;
    const [brands, cats] = await Promise.all([
      API.getBrandsAsync().catch(() => []),
      API.getCategoriesAsync().catch(() => []),
    ]);
    const activeBrand = activeFilters?.brand || '';
    const activeCat   = activeFilters?.cat   || '';
    const catLabels = { perfume: 'Perfume', hair: 'Hair Care', body: 'Body Care' };
    const catsHtml = ['perfume', 'hair', 'body'].map(c => `
      <a href="#" class="sidebar-filter-item${activeCat === c ? ' active' : ''}" data-sidebar-cat="${c}">
        ${catLabels[c]}
      </a>`).join('');
    const brandLink = (b) => {
      const letter = (b.name || '?')[0].toUpperCase();
      const avatar = b.image
        ? `<img src="${b.image}" alt="${b.name}" class="sidebar-brand-avatar">`
        : `<span class="sidebar-brand-letter">${letter}</span>`;
      return `<a href="#" class="sidebar-filter-item sidebar-brand-item${activeBrand === b.name ? ' active' : ''}" data-sidebar-brand="${b.name}">
        <span class="sidebar-brand-icon">${avatar}</span>${b.name}
      </a>`;
    };

    /* When a brand is selected, pin it above a collapsed "Other brands"
       list and collapse Categories too, so the shopper isn't scanning an
       unrelated full list — everything stays reachable via the toggle. */
    const activeBrandObj = activeBrand ? brands.find(b => b.name === activeBrand) : null;
    const otherBrands     = activeBrandObj ? brands.filter(b => b.name !== activeBrand) : brands;
    const brandsHtml      = otherBrands.map(brandLink).join('');

    const catItems = `
      <a href="#" class="sidebar-filter-item${!activeCat ? ' active' : ''}" data-sidebar-cat="">All</a>
      ${catsHtml}`;

    const categoriesSection = activeBrandObj ? `
      <details class="sidebar-section sidebar-collapse">
        <summary class="sidebar-section-title">Categories</summary>
        ${catItems}
      </details>` : `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Categories</div>
        ${catItems}
      </div>`;

    const brandsSection = activeBrandObj ? `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Brand</div>
        ${brandLink(activeBrandObj)}
        <details class="sidebar-collapse">
          <summary>Other brands (${otherBrands.length})</summary>
          ${brandsHtml || '<p class="sidebar-empty">No other brands found</p>'}
        </details>
      </div>` : `
      <div class="sidebar-section">
        <div class="sidebar-section-title">Brands</div>
        ${brandsHtml || '<p class="sidebar-empty">No brands found</p>'}
      </div>`;

    inner.innerHTML = categoriesSection + brandsSection;
  }

  /* ── Product Detail Page ── */
  async function showProductDetail(id) {
    _setUrl(`/product/${id}`);
    _hideAll();
    const section = document.getElementById('product-detail');
    if (!section) return;
    section.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const body = document.getElementById('pdp-body');
    body.innerHTML = `<p style="text-align:center;padding:3rem;color:var(--n-400)">Loading…</p>`;

    const p = await API.getProduct(id);
    if (!p) { body.innerHTML = `<p style="text-align:center;padding:3rem">Product not found.</p>`; return; }

    const wish  = API.getWishlist();
    const loved = wish.includes(p.id);
    const disc  = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const allImgs = [p.imageMain, p.imageAlt1, p.imageAlt2].filter(Boolean);
    const galleryHtml = allImgs.length > 1 ? `
      <div class="pdp-gallery">
        ${allImgs.map((src, i) => `<img src="${src}" alt="${p.name}" class="pdp-gallery-thumb${i === 0 ? ' active' : ''}" loading="lazy">`).join('')}
      </div>` : '';
    const imgAreaHtml = p.imageMain
      ? `<div class="pdp-img-wrap">
          <img src="${p.imageMain}" alt="${p.name}" class="pdp-img-main" id="pdp-main-img" loading="lazy">
          ${galleryHtml}
         </div>`
      : `<div class="pdp-img-emoji" aria-hidden="true">${p.emoji}</div>`;

    body.innerHTML = `
      <div class="pdp-grid">
        ${imgAreaHtml}
        <div class="pdp-info">
          <div class="pd-brand">${p.brand}</div>
          <h1 class="pdp-name" id="pdp-h">${p.name}</h1>
          ${(p.isHot || p.isOnSale) ? `<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.625rem">
            ${p.isHot    ? `<span class="badge badge-hot">🔥 Hot</span>`   : ''}
            ${p.isOnSale ? `<span class="badge badge-sale">On Sale</span>` : ''}
          </div>` : ''}
          <div class="pd-stars" aria-label="${p.rating} stars">
            ${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))}
            <span style="font-size:.75rem;color:var(--n-400);font-family:var(--f-body)"> ${p.rating} · ${p.stock} in stock</span>
          </div>
          <div class="pd-price" style="font-size:1.75rem;margin:.75rem 0 .25rem">
            KES ${p.price.toLocaleString()}
            ${disc ? `<span class="pd-disc">${disc}% OFF</span>` : ''}
          </div>
          ${p.oldPrice ? `<div class="pd-old">Was KES ${p.oldPrice.toLocaleString()}</div>` : ''}
          <p class="pd-desc" id="pdp-desc" style="margin:.875rem 0">${p.desc || ''}</p>
          <div class="pd-info" style="margin:.75rem 0">
            <span>Category: <strong>${p.subcat}</strong></span>
            <span>Gender: <strong>${p.gender}</strong></span>
          </div>
          <span class="pd-var-label">Size</span>
          <div class="pd-var-btns" id="pdp-sizes">
            ${p.sizes.map((s, i) => `<button class="pd-var-btn${i === 0 ? ' active' : ''}"
              onclick="this.closest('#pdp-sizes').querySelectorAll('.pd-var-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${s}</button>`).join('')}
          </div>
          <div class="pd-actions" style="margin-top:1.25rem">
            <button class="pd-buy-now" data-buy-id="${p.id}">⚡ Buy Now</button>
            <button class="pd-add" data-add-id="${p.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Add to Cart
            </button>
            <button class="pd-wish-btn" data-wish-id="${p.id}" title="Wishlist" aria-label="Add to wishlist">
              ${loved ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      </div>
      <div id="pdp-recs-wrap" style="margin-top:2.5rem;padding-top:2rem;border-top:1.5px solid var(--n-100)">
        <p style="font-size:.875rem;font-weight:700;color:var(--n-800);margin:0 0 1rem">You Might Also Like</p>
        <div id="pdp-recs" class="products-grid"></div>
      </div>
      <div id="pdp-reviews-wrap" style="margin-top:2.5rem;padding-top:2rem;border-top:1.5px solid var(--n-100)">
        <p style="font-size:.75rem;color:var(--n-400);text-align:center">Loading reviews…</p>
      </div>`;

    /* Gallery thumb swap */
    section.querySelectorAll('.pdp-gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const main = document.getElementById('pdp-main-img');
        if (main) {
          main.src = thumb.src;
          section.querySelectorAll('.pdp-gallery-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        }
      });
    });

    /* Recommended products */
    API.getProducts({ cat: p.cat }).then(all => {
      const similar = all.filter(x => x.id !== p.id && x.isVisible !== false).slice(0, 8);
      const recsEl = document.getElementById('pdp-recs');
      const recsWrap = document.getElementById('pdp-recs-wrap');
      if (!recsEl || !similar.length) { recsWrap?.remove(); return; }
      const w = API.getWishlist();
      recsEl.innerHTML = similar.map(sp => Products.card(sp, w)).join('');
    }).catch(() => document.getElementById('pdp-recs-wrap')?.remove());

    /* Reviews */
    const reviewsWrap = document.getElementById('pdp-reviews-wrap');
    if (reviewsWrap) {
      const user = (typeof Auth !== 'undefined') ? Auth.currentUser() : null;
      Products._loadAndRenderReviews(p.id, reviewsWrap, user);
    }
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

  /* ── Terms & Conditions page ── */
  function showTerms() {
    _setUrl('/terms');
    _hideAll();
    const termsPage = document.getElementById('terms-page');
    if (termsPage) termsPage.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Brands showcase grid on homepage ── */
  async function populateBrandsShowcase() {
    const grid = document.getElementById('brands-showcase-grid');
    if (!grid) return;
    const brands = await API.getBrandsAsync();
    if (!brands.length) return;
    grid.innerHTML = brands.map(b => {
      const letter = (b.name || '?')[0].toUpperCase();
      const avatar = b.image
        ? `<img src="${b.image}" alt="${b.name}" loading="lazy">`
        : `<span class="brand-card-letter">${letter}</span>`;
      return `
        <button class="brand-card" data-brand-nav="${b.name}" aria-label="Shop ${b.name}">
          <div class="brand-card-avatar">${avatar}</div>
          <span class="brand-card-name">${b.name}</span>
        </button>`;
    }).join('');
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
    const products = await API.getProducts();

    /* Build subcat groups from actual product data */
    const groups = { perfume: new Set(), hair: new Set(), body: new Set() };
    products.forEach(p => { if (groups[p.cat]) groups[p.cat].add(p.subcat); });

    const catMeta = {
      perfume: { label: 'Perfume',   emoji: '🌸' },
      hair:    { label: 'Hair Care', emoji: '💇' },
      body:    { label: 'Body Care', emoji: '🧴' },
    };

    /* Desktop mega menu columns */
    ['perfume','hair','body'].forEach(cat => {
      const list = document.getElementById(`cats-mega-list-${cat}`);
      if (!list) return;
      const items = [...groups[cat]].sort();
      list.innerHTML = items.map(name =>
        `<li><a href="#" data-cat="${cat}" data-filter="subcat:${name}">${name}</a></li>`
      ).join('');
    });

    /* Mobile: 3-section accordion chips */
    const mobCatList = document.getElementById('mobile-cats-list');
    if (mobCatList) {
      mobCatList.innerHTML = ['perfume','hair','body'].map(cat => {
        const { label, emoji } = catMeta[cat];
        const items = [...groups[cat]].sort();
        if (!items.length) return '';
        return `
          <div class="mob-cats-group">
            <p class="mob-cats-group-label">${emoji} ${label}</p>
            <div class="mob-cats-chips">
              ${items.map(name =>
                `<a href="#" class="mob-cat-chip" data-cat="${cat}" data-filter="subcat:${name}">${name}</a>`
              ).join('')}
              <a href="#" class="mob-cat-chip mob-cat-chip--all" data-cat="${cat}">All ${label} →</a>
            </div>
          </div>`;
      }).join('');
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
  const DEFAULT_HERO_BG = 'https://qfijtemeburiqtkzfbnt.supabase.co/storage/v1/object/public/uploads/hero-bg.mp4';

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
        list.innerHTML = `<div class="search-no-results">Item not found — no results for "${q}"</div>`;
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
    document.body.style.overflow = open ? 'hidden' : '';
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

  async function _loadActivePromo() {
    try {
      const [settings, coupons] = await Promise.all([
        API.getSettings().catch(() => ({})),
        API.getCoupons(false).catch(() => []),
      ]);

      /* Sync hero background from DB so it works across devices/browsers */
      if (settings.hero_bg) {
        const stored = localStorage.getItem('ibh_hero_bg');
        if (stored !== settings.hero_bg) {
          localStorage.setItem('ibh_hero_bg', settings.hero_bg);
          applyHeroBg();
        }
      }

      const notifEl = document.querySelector('.notif-text');
      if (!notifEl) return;

      /* Admin-set announcement takes priority when active */
      if (settings.notif_active === '1' && settings.notif_text) {
        const badge = settings.notif_badge || 'OFFER';
        notifEl.innerHTML = `<span class="notif-badge">${badge}</span> ${settings.notif_text}`;
        return;
      }
      /* Fall back to active featured coupon */
      const c = coupons[0];
      if (c) {
        const disc = c.type === 'percent' ? `${c.value}% off` : `KES ${c.value} off`;
        const min  = c.min_order > 0 ? ` (min KES ${Number(c.min_order).toLocaleString()})` : '';
        notifEl.innerHTML = `<span class="notif-badge">PROMO</span> Use code <strong>${c.code}</strong> — ${disc}${min} at checkout!`;
      }
    } catch {}
  }

  /* expose so admin settings panel can trigger a live refresh */
  function _reloadNotif() { _loadActivePromo(); }

  /* ── Header scroll effect ── */
  function onScroll() {
    document.getElementById('header').classList.toggle('scrolled', window.scrollY > 60);
  }

  /* ── Event delegation: main clickable ── */
  function handleClick(e) {
    const t = e.target;

    /* Direct add-to-cart button on product card */
    const directAddBtn = t.closest('[data-add-direct]');
    if (directAddBtn) {
      e.preventDefault(); e.stopPropagation();
      const pid = Number(directAddBtn.dataset.addDirect);
      Cart.add(pid, 1);
      const orig = directAddBtn.innerHTML;
      directAddBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Added!';
      directAddBtn.style.cssText += ';background:var(--ok);color:#fff';
      setTimeout(() => { directAddBtn.innerHTML = orig; directAddBtn.style.background = ''; directAddBtn.style.color = ''; }, 1400);
      return;
    }

    /* Product card click — Quick View opens modal; body/name click goes to detail page */
    const card = t.closest('.pcard');
    if (card && !t.closest('.pcard-wish') && !t.closest('[data-add-direct]') && !t.closest('[data-buy-id]')) {
      if (t.closest('.pcard-qv')) {
        Products.openModal(Number(card.dataset.productId));
      } else {
        showProductDetail(Number(card.dataset.productId));
      }
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

    /* "View All Brands" link on homepage */
    if (t.closest('[data-page="brands"]')) {
      e.preventDefault();
      showShop({}, 'All Products', 'Our Brands');
      return;
    }

    /* Brand item click (nav dropdown or brands showcase) */
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

    /* Add to cart from product modal */
    const addBtn = t.closest('[data-add-id]');
    if (addBtn) {
      e.preventDefault(); e.stopPropagation();
      Cart.add(Number(addBtn.dataset.addId), 1);
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
      if (act === 'show-terms') { e.preventDefault(); showTerms(); toggleMobileMenu(false); }
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
        closeSearch();
        showProductDetail(Number(srItem.dataset.productId));
      }
      if (srItem.dataset.searchAll) {
        showShop({ search: srItem.dataset.searchAll }, srItem.dataset.searchAll, 'Search');
        closeSearch();
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

    /* Auth (customer sign-in) */
    if (typeof Auth !== 'undefined') Auth.init();

    /* Route: dispatch based on current URL, then render data */
    await _dispatchRoute();
    window.addEventListener('popstate', () => _dispatchRoute());

    /* Render home sections (grids populate in background even if hidden) */
    await refreshHome();

    /* Populate Brands nav dropdown */
    await populateNavBrands();

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
    _loadActivePromo();

    /* Logo → always go home from any page */
    document.getElementById('logo-link').addEventListener('click', e => {
      e.preventDefault();
      showHome();
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

    /* ── Search overlay ── */
    const searchOverlay  = document.getElementById('search-overlay');
    const searchInput    = document.getElementById('search-input');
    const searchClose    = document.getElementById('search-overlay-close');
    const searchBackdrop = document.getElementById('search-overlay-backdrop');
    const searchToggle   = document.getElementById('search-toggle');

    function openSearch() {
      searchOverlay.classList.add('open');
      searchOverlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('search-open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => searchInput?.focus(), 120);
    }
    function closeSearch() {
      searchOverlay.classList.remove('open');
      searchOverlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('search-open');
      document.body.style.overflow = '';
      document.getElementById('search-results').hidden = true;
      if (searchInput) searchInput.value = '';
    }

    searchToggle?.addEventListener('click', openSearch);
    searchClose?.addEventListener('click', closeSearch);
    searchBackdrop?.addEventListener('click', closeSearch);

    searchInput?.addEventListener('input', () => handleSearch(searchInput.value));
    searchInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        showShop({ search: searchInput.value }, searchInput.value, 'Search');
        closeSearch();
      }
      if (e.key === 'Escape') closeSearch();
    });

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
    document.getElementById('terms-back')?.addEventListener('click', showHome);

    /* Product detail page back button */
    document.getElementById('pdp-back')?.addEventListener('click', () => history.back());

    /* Shop sidebar filter clicks */
    document.getElementById('shop-sidebar')?.addEventListener('click', e => {
      const item = e.target.closest('.sidebar-filter-item');
      if (!item) return;
      e.preventDefault();
      if ('sidebarCat' in item.dataset) {
        const cat = item.dataset.sidebarCat;
        if (cat) showShop({ cat }, { perfume: 'Perfumes', hair: 'Hair Care', body: 'Body Care' }[cat] || cat, 'Shop');
        else showShop({}, 'All Products', 'Shop');
      } else if ('sidebarBrand' in item.dataset) {
        showShop({ brand: item.dataset.sidebarBrand }, item.dataset.sidebarBrand, 'Brand');
      }
    });

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
          showShop({ search: mobileSearch.value }, mobileSearch.value, 'Search');
          document.getElementById('search-results').hidden = true;
          toggleMobileMenu(false);
        }
      });
    }

    /* ── Track Order ── */
    const trackBtn    = document.getElementById('track-order-btn');
    const trackOverlay = document.getElementById('track-order-overlay');
    const trackClose  = document.getElementById('track-order-close');
    const trackSearch = document.getElementById('track-order-btn-search');
    const trackInput  = document.getElementById('track-order-input');

    function _openTrackModal() {
      trackOverlay?.classList.add('open');
      document.getElementById('track-order-modal')?.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      setTimeout(() => trackInput?.focus(), 80);
    }
    function _closeTrackModal() {
      trackOverlay?.classList.remove('open');
      document.getElementById('track-order-modal')?.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    trackBtn?.addEventListener('click', _openTrackModal);
    trackClose?.addEventListener('click', _closeTrackModal);
    trackOverlay?.addEventListener('click', e => { if (e.target === trackOverlay) _closeTrackModal(); });

    const trackPhoneInput = document.getElementById('track-phone-input');

    async function _doTrackOrder() {
      const orderId = trackInput?.value.trim().toUpperCase();
      const phone   = trackPhoneInput?.value.trim().replace(/\s+/g, '');
      const out     = document.getElementById('track-order-result');

      if (!orderId || !phone) {
        out.innerHTML = `<p style="color:var(--err);font-size:.875rem;text-align:center">Please enter both your phone number and order ID</p>`;
        return;
      }
      out.innerHTML = `<p style="text-align:center;color:var(--n-400);font-size:.875rem">Searching…</p>`;
      try {
        /* Search by order ID — then verify phone matches */
        const orders = await fetch(`${Config.BASE_URL}/orders?search=${encodeURIComponent(orderId)}`).then(r => r.json());

        const normPhone = phone.replace(/\s+/g, '').replace(/^\+254/, '0').replace(/^254/, '0');
        const order = orders.find(o =>
          o.id.toUpperCase() === orderId &&
          (o.customer?.phone || '').replace(/\s+/g, '').replace(/^\+254/, '0').replace(/^254/, '0').includes(normPhone.slice(-9))
        );

        if (!order) {
          out.innerHTML = `<div style="text-align:center;padding:1rem 0">
            <div style="font-size:2rem;margin-bottom:.5rem">🔍</div>
            <p style="font-weight:600;color:var(--n-800);margin-bottom:.25rem">Order not found</p>
            <p style="font-size:.8125rem;color:var(--n-500)">No order matched your details. Check your phone number or order ID and try again.</p>
          </div>`;
          return;
        }
        const statusColors = { confirmed:'var(--ok-bg)', pending:'var(--warn-bg)', processing:'var(--info-bg)', delivered:'#BBF7D0', cancelled:'var(--err-bg)' };
        const statusText   = { confirmed:'#065F46', pending:'#92400E', processing:'#1E40AF', delivered:'#14532D', cancelled:'#991B1B' };
        const statusIcons  = { confirmed:'✅', pending:'⏳', processing:'📦', delivered:'🎉', cancelled:'❌' };
        const s = order.status || 'confirmed';
        out.innerHTML = `
          <div style="border:1.5px solid var(--n-200);border-radius:var(--r-lg);overflow:hidden">
            <div style="padding:1rem 1.25rem;background:${statusColors[s]||'var(--n-100)'};display:flex;align-items:center;gap:.75rem">
              <span style="font-size:1.5rem">${statusIcons[s]||'📦'}</span>
              <div>
                <p style="font-weight:700;color:${statusText[s]||'var(--n-800)'};font-size:.9375rem;margin:0">${s.charAt(0).toUpperCase()+s.slice(1)}</p>
                <p style="font-size:.75rem;color:${statusText[s]||'var(--n-600)'};margin:0;opacity:.8">${order.date} ${order.time||''}</p>
              </div>
              <span style="margin-left:auto;background:#fff;border-radius:var(--r-pill);padding:.2rem .75rem;font-size:.6875rem;font-weight:700;color:var(--blue-d)">${order.id}</span>
            </div>
            <div style="padding:1rem 1.25rem">
              <p style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--n-500);margin:0 0 .5rem">Items (${(order.items||[]).length})</p>
              ${(order.items||[]).map(i=>`
                <div style="display:flex;justify-content:space-between;font-size:.8125rem;padding:.3rem 0;border-bottom:1px solid var(--n-100)">
                  <span>${i.emoji||''} ${i.name} ×${i.qty}</span>
                  <span style="font-weight:600">KES ${((i.price||0)*(i.qty||1)).toLocaleString()}</span>
                </div>`).join('')}
              <div style="display:flex;justify-content:space-between;font-size:.875rem;font-weight:700;color:var(--blue-d);padding:.625rem 0 0">
                <span>Total</span><span>KES ${(order.total||0).toLocaleString()}</span>
              </div>
            </div>
          </div>`;
      } catch {
        out.innerHTML = `<p style="color:var(--err);font-size:.875rem;text-align:center">Could not look up order. Please try again.</p>`;
      }
    }

    trackSearch?.addEventListener('click', _doTrackOrder);
    trackInput?.addEventListener('keydown', e => { if (e.key === 'Enter') _doTrackOrder(); });
    trackPhoneInput?.addEventListener('keydown', e => { if (e.key === 'Enter') _doTrackOrder(); });

    /* Back to top */
    const backTopBtn = document.getElementById('back-to-top');
    if (backTopBtn) {
      window.addEventListener('scroll', () => {
        backTopBtn.classList.toggle('visible', window.scrollY > 300);
      }, { passive: true });
      backTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /* Delegated clicks */
    document.addEventListener('click', handleClick);

    /* Keyboard accessibility for product cards and brand cards */
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = document.activeElement.closest('.pcard');
        if (card) { e.preventDefault(); showProductDetail(Number(card.dataset.productId)); }
      }
      if (e.key === 'Escape') {
        closeCart(); closeProductModal(); closeCheckoutModal();
        _closeTrackModal();
        toggleMobileMenu(false);
        document.getElementById('search-results').hidden = true;
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
    showProductDetail,
    applyHeroBg,
    closeCart,
    closeProductModal,
    closeCheckoutModal,
    _reloadNotif,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
