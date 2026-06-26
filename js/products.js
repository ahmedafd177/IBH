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
      p.isNew    ? `<span class="badge badge-new">New</span>`          : '',
      p.isHot    ? `<span class="badge badge-hot">🔥 Hot</span>`      : '',
      p.isFeat   ? `<span class="badge badge-feat">⭐ Best</span>`    : '',
      p.isOnSale ? `<span class="badge badge-sale">On Sale</span>`    : '',
    ].filter(Boolean).join('');

    /* Build image layer — main + alt for hover swap */
    let imgHtml = '';
    if (p.imageMain) {
      imgHtml = `
        <img src="${p.imageMain}" alt="${p.name}" class="pcard-img-photo pcard-img-main" loading="lazy"
          onerror="this.style.display='none'">
        ${p.imageAlt1 ? `<img src="${p.imageAlt1}" alt="${p.name}" class="pcard-img-photo pcard-img-alt" loading="lazy" onerror="this.style.display='none'">` : ''}`;
    } else {
      imgHtml = `<span aria-hidden="true" class="pcard-img-emoji">${p.emoji}</span>`;
    }

    return `
      <article class="pcard" data-product-id="${p.id}" role="button" tabindex="0" aria-label="${p.name}">
        <div class="pcard-img${p.imageAlt1 ? ' has-alt' : ''}">
          ${imgHtml}
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
        <div class="pcard-body" data-open-id="${p.id}">
          <div class="pcard-brand">${p.brand}</div>
          <div class="pcard-name">${p.name}</div>
          <div class="pcard-meta">${p.subcat} · ${p.gender}</div>
          <div class="pcard-foot">
            <div>
              <div class="pcard-price">KES ${p.price.toLocaleString()}</div>
              ${p.oldPrice ? `<div class="pcard-old">KES ${p.oldPrice.toLocaleString()}</div>` : ''}
            </div>
            <button class="pcard-add-direct" data-add-direct="${p.id}" aria-label="Add to cart">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="M19 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
              + Add
            </button>
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

  /* ── Stars HTML helper ── */
  function _starsHtml(rating, interactive = false, name = '') {
    if (interactive) {
      return [1,2,3,4,5].map(n => `
        <label style="cursor:pointer;font-size:1.375rem;color:var(--n-300);transition:color .1s" class="rv-star-lbl">
          <input type="radio" name="${name}" value="${n}" style="display:none" required>
          <span class="rv-star" data-val="${n}">★</span>
        </label>`).join('');
    }
    const full = Math.round(rating || 0);
    return [1,2,3,4,5].map(n => `<span style="color:${n<=full?'#FBBF24':'var(--n-300)'};font-size:1rem">★</span>`).join('');
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
          ${(p.isHot || p.isOnSale) ? `<div style="display:flex;gap:.375rem;flex-wrap:wrap;margin-bottom:.625rem">
            ${p.isHot    ? `<span class="badge badge-hot">🔥 Hot</span>`   : ''}
            ${p.isOnSale ? `<span class="badge badge-sale">On Sale</span>` : ''}
          </div>` : ''}
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

    /* ── Reviews section ── */
    const modalBody = document.getElementById('product-modal-body');
    const reviewSection = document.createElement('div');
    reviewSection.id = 'pd-reviews-section';
    reviewSection.style.cssText = 'margin-top:1.5rem;padding-top:1.5rem;border-top:1.5px solid var(--n-100)';
    reviewSection.innerHTML = `<p style="font-size:.75rem;color:var(--n-400);text-align:center">Loading reviews…</p>`;
    modalBody.appendChild(reviewSection);

    _loadAndRenderReviews(p.id, reviewSection);

    document.getElementById('product-overlay').classList.add('open');
    document.getElementById('product-modal').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  async function _loadAndRenderReviews(productId, container) {
    const { reviews = [], avg, count } = await API.getReviews(productId).catch(() => ({ reviews: [], avg: null, count: 0 }));

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
        <h3 style="font-size:.9375rem;font-weight:700;color:var(--n-900);margin:0">
          Customer Reviews ${count > 0 ? `<span style="font-size:.75rem;color:var(--n-400);font-weight:400">(${count})</span>` : ''}
        </h3>
        ${avg ? `<div style="display:flex;align-items:center;gap:.375rem">
          ${_starsHtml(avg)}
          <span style="font-size:.875rem;font-weight:700;color:var(--n-800)">${avg.toFixed(1)}</span>
        </div>` : ''}
      </div>

      ${reviews.length ? reviews.map(r => `
        <div style="padding:.875rem 0;border-bottom:1px solid var(--n-100)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.375rem">
            <div style="display:flex;align-items:center;gap:.5rem">
              <div style="width:30px;height:30px;border-radius:50%;background:var(--blue-xl);display:flex;align-items:center;justify-content:center;font-size:.6875rem;font-weight:700;color:var(--blue)">${r.name.charAt(0).toUpperCase()}</div>
              <strong style="font-size:.8125rem;color:var(--n-900)">${r.name}</strong>
            </div>
            <div>${_starsHtml(r.rating)}</div>
          </div>
          ${r.comment ? `<p style="font-size:.8125rem;color:var(--n-600);margin:0;line-height:1.55">${r.comment}</p>` : ''}
          <p style="font-size:.6875rem;color:var(--n-400);margin:.375rem 0 0">${new Date(r.created_at).toLocaleDateString('en-KE',{year:'numeric',month:'short',day:'numeric'})}</p>
        </div>`).join('')
      : `<p style="font-size:.875rem;color:var(--n-400);text-align:center;padding:.75rem 0">No reviews yet — be the first!</p>`}

      <!-- Write a review -->
      <div style="margin-top:1.25rem;padding:1rem;background:var(--n-50);border-radius:var(--r-lg);border:1.5px solid var(--n-200)" id="pd-review-form-wrap">
        <p style="font-size:.8125rem;font-weight:700;color:var(--n-800);margin:0 0 .75rem">Leave a Review</p>
        <div style="margin-bottom:.625rem">
          <label style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--n-600);display:block;margin-bottom:.375rem">Your Name</label>
          <input id="rv-name" type="text" placeholder="e.g. Jane W." maxlength="60"
            style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;font-family:inherit;outline:none;color:var(--n-900);box-sizing:border-box;transition:border-color .2s"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--n-200)'">
        </div>
        <div style="margin-bottom:.625rem">
          <label style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--n-600);display:block;margin-bottom:.375rem">Rating</label>
          <div style="display:flex;gap:.125rem" id="rv-stars-wrap">
            ${_starsHtml(0, true, 'rv-rating')}
          </div>
        </div>
        <div style="margin-bottom:.75rem">
          <label style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--n-600);display:block;margin-bottom:.375rem">Comment <span style="font-weight:400;color:var(--n-400)">(optional)</span></label>
          <textarea id="rv-comment" rows="2" placeholder="Share your experience…" maxlength="400"
            style="width:100%;padding:.5rem .75rem;border:1.5px solid var(--n-200);border-radius:var(--r-md);font-size:.8125rem;font-family:inherit;outline:none;color:var(--n-900);resize:vertical;box-sizing:border-box;transition:border-color .2s"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--n-200)'"></textarea>
        </div>
        <button id="rv-submit-btn" class="btn btn-primary" style="width:100%;padding:.625rem">Submit Review</button>
        <div id="rv-error" style="display:none;color:var(--err);font-size:.8125rem;margin-top:.5rem;text-align:center"></div>
      </div>`;

    /* Star hover + select */
    const stars = container.querySelectorAll('.rv-star-lbl');
    let _selectedRating = 0;
    stars.forEach((lbl, i) => {
      const star = lbl.querySelector('.rv-star');
      lbl.addEventListener('mouseenter', () => {
        stars.forEach((l, j) => l.querySelector('.rv-star').style.color = j <= i ? '#FBBF24' : 'var(--n-300)');
      });
      lbl.addEventListener('mouseleave', () => {
        stars.forEach((l, j) => l.querySelector('.rv-star').style.color = j < _selectedRating ? '#FBBF24' : 'var(--n-300)');
      });
      lbl.addEventListener('click', () => {
        _selectedRating = i + 1;
        lbl.querySelector('input').checked = true;
        stars.forEach((l, j) => l.querySelector('.rv-star').style.color = j < _selectedRating ? '#FBBF24' : 'var(--n-300)');
      });
    });

    /* Submit */
    container.querySelector('#rv-submit-btn')?.addEventListener('click', async () => {
      const name    = container.querySelector('#rv-name')?.value.trim();
      const comment = container.querySelector('#rv-comment')?.value.trim();
      const errEl   = container.querySelector('#rv-error');
      if (!name)            { errEl.textContent = 'Please enter your name';   errEl.style.display=''; return; }
      if (!_selectedRating) { errEl.textContent = 'Please select a rating';   errEl.style.display=''; return; }
      errEl.style.display = 'none';
      const btn = container.querySelector('#rv-submit-btn');
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        await API.addReview({ product_id: productId, name, rating: _selectedRating, comment });
        container.querySelector('#pd-review-form-wrap').innerHTML = `
          <div style="text-align:center;padding:.75rem 0">
            <div style="font-size:2rem;margin-bottom:.375rem">🎉</div>
            <p style="font-weight:700;color:var(--ok);margin:0">Thank you for your review!</p>
          </div>`;
        _loadAndRenderReviews(productId, container);
      } catch {
        btn.disabled = false; btn.textContent = 'Submit Review';
        errEl.textContent = 'Failed to submit — please try again'; errEl.style.display = '';
      }
    });
  }

  return { card, renderGrid, openModal };
})();
