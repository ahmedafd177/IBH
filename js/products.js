/* ═══════════════════════════════════════
   PRODUCTS — rendering, filtering, modal
   ═══════════════════════════════════════ */
const Products = (() => {

  /* ── product image or emoji ── */
  function imgOrEmoji(p, size = 'card') {
    if (p.imageMain) {
      const h = size === 'modal' ? 'pd-img-photo' : 'pcard-img-photo';
      return `<img src="${p.imageMain}" alt="${p.name}" class="${h}" loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span aria-hidden="true" class="pcard-img-emoji" style="display:none">${p.emoji}</span>`;
    }
    return `<span aria-hidden="true" class="${size === 'modal' ? 'pd-img-emoji' : 'pcard-img-emoji'}">${p.emoji}</span>`;
  }

  /* ── Build a product card ── */
  function card(p, wishlist = []) {
    const loved  = wishlist.includes(p.id);
    const badges = [
      p.isNew    ? `<span class="badge badge-new">New</span>`   : '',
      p.isTrend  ? `<span class="badge badge-hot">🔥 Hot</span>` : '',
      p.isFeat   ? `<span class="badge badge-feat">⭐ Best</span>` : '',
      p.oldPrice ? `<span class="badge badge-sale">Sale</span>` : '',
    ].filter(Boolean).join('');

    return `
      <article class="pcard" data-product-id="${p.id}" role="button" tabindex="0" aria-label="${p.name}">
        <div class="pcard-img">
          ${imgOrEmoji(p, 'card')}
          <div class="pcard-badges">${badges}</div>
          <button class="pcard-wish${loved ? ' loved' : ''}"
            data-wish-id="${p.id}" title="${loved ? 'Remove from wishlist' : 'Add to wishlist'}"
            aria-label="Wishlist" aria-pressed="${loved}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${loved ? 'currentColor' : 'none'}"
              stroke="currentColor" stroke-width="2" style="color:${loved ? 'var(--err)' : 'var(--n-400)'}">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
        <div class="pcard-body">
          <div class="pcard-brand">${p.brand}</div>
          <div class="pcard-name">${p.name}</div>
          <div class="pcard-meta">${p.subcat} · ${p.gender}</div>
          <div class="pcard-foot">
            <div>
              <div class="pcard-price">KES ${p.price.toLocaleString()}</div>
              ${p.oldPrice ? `<div class="pcard-old">KES ${p.oldPrice.toLocaleString()}</div>` : ''}
            </div>
            <div class="pcard-qty-selector" data-product-id="${p.id}" style="display:none;flex;gap:0.25rem;align-items:center">
              <button class="pcard-qty-btn" data-qty-action="minus" title="Decrease quantity">−</button>
              <input type="number" class="pcard-qty-input" value="1" min="1" max="${p.stock}" style="width:40px;text-align:center;padding:0.25rem;border:1px solid var(--n-300);border-radius:var(--r-sm);font-size:0.875rem">
              <button class="pcard-qty-btn" data-qty-action="plus" title="Increase quantity">+</button>
              <button class="pcard-add" data-add-id="${p.id}" style="margin-left:auto;padding:0.4rem 0.75rem;font-size:0.75rem">Add</button>
            </div>
            <button class="pcard-add-qty" data-product-id="${p.id}" style="display:flex">+ Add</button>
          </div>
        </div>
      </article>`;
  }

  /* ── Render a list into a grid element ── */
  async function renderGrid(container, filters = {}, limit = null) {
    if (!container) return;
    const wish = API.getWishlist();
    let ps = await API.getProducts(filters);
    if (limit) ps = ps.slice(0, limit);
    container.innerHTML = ps.length
      ? ps.map(p => card(p, wish)).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
           <span class="empty-icon">🔍</span>
           <h3>No products found</h3>
           <p>Try adjusting your search or filter</p>
         </div>`;
    return ps.length;
  }

  /* ── Open product detail modal ── */
  async function openModal(id) {
    const p = await API.getProduct(id);
    if (!p) return;
    const wish  = API.getWishlist();
    const loved = wish.includes(p.id);
    const disc  = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

    /* Build image gallery — main image is always first thumb */
    const allImgs = [p.imageMain, p.imageAlt1, p.imageAlt2].filter(Boolean);
    const galleryHtml = allImgs.length > 1 ? `
      <div class="pd-gallery">
        ${allImgs.map((src, i) => `<img src="${src}" alt="${p.name}" class="pd-gallery-thumb${i === 0 ? ' active' : ''}" loading="lazy">`).join('')}
      </div>` : '';

    const imgAreaHtml = p.imageMain
      ? `<div class="pd-img-wrap">
          <img src="${p.imageMain}" alt="${p.name}" class="pd-img-photo" id="pd-main-img" loading="lazy">
          ${galleryHtml}
         </div>`
      : `<div class="pd-img" aria-hidden="true">${p.emoji}</div>`;

    document.getElementById('product-modal-body').innerHTML = `
      <div class="pd-grid">
        ${imgAreaHtml}
        <div class="pd-detail">
          <div class="pd-brand">${p.brand}</div>
          <h2 class="pd-name">${p.name}</h2>
          <div class="pd-stars" aria-label="${p.rating} stars">
            ${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))}
            <span style="font-size:.75rem;color:var(--n-400);font-family:var(--f-body)"> ${p.rating} · ${p.stock} in stock</span>
          </div>
          <div class="pd-price">
            KES ${p.price.toLocaleString()}
            ${disc ? `<span class="pd-disc">${disc}% OFF</span>` : ''}
          </div>
          ${p.oldPrice ? `<div class="pd-old">Was KES ${p.oldPrice.toLocaleString()}</div>` : ''}
          <p class="pd-desc">${p.desc}</p>
          <div class="pd-info">
            <span>Category: <strong>${p.subcat}</strong></span>
            <span>Gender: <strong>${p.gender}</strong></span>
          </div>
          <span class="pd-var-label">Size</span>
          <div class="pd-var-btns">
            ${p.sizes.map((s, i) => `<button class="pd-var-btn${i === 0 ? ' active' : ''}"
              onclick="this.closest('.pd-var-btns').querySelectorAll('.pd-var-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${s}</button>`).join('')}
          </div>
          <div class="pd-actions">
            <button class="pd-buy-now" data-buy-id="${p.id}">
              ⚡ Buy Now
            </button>
            <button class="pd-add" data-add-id="${p.id}" data-close-modal>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Add to Cart
            </button>
            <button class="pd-wish-btn" data-wish-id="${p.id}" title="Wishlist" aria-label="Wishlist">
              ${loved ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      </div>`;

    /* Gallery thumb click — swap main image + active state */
    const thumbs = document.querySelectorAll('.pd-gallery-thumb');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const main = document.getElementById('pd-main-img');
        if (main) {
          main.src = thumb.src;
          thumbs.forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        }
      });
    });

    document.getElementById('product-overlay').classList.add('open');
    document.getElementById('product-modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  return { card, renderGrid, openModal };
})();
