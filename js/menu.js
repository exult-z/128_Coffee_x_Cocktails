/* 1.28 Coffee x Cocktails — menu.js
   Menu page (search + category filter), homepage featured items / promo band, events page.
   Data: data.json (seed) + localStorage. No server needed. */

(function () {
  'use strict';

  /* ==========================================================================
     SHARED STORAGE HELPER  (identical block in menu.js, feedback.js,
     reservation.js and admin.js so every page works on its own)
     --------------------------------------------------------------------------
     data.json  -> seeds localStorage the first time (menu, promos, events,
                   sample reviews). After that, localStorage is the "database".
     ========================================================================== */
  const C128 = window.C128 || (window.C128 = (function () {
    const KEYS = {
      menu: 'c128_menu',
      promotions: 'c128_promotions',
      events: 'c128_events',
      reviews: 'c128_reviews',
      reservations: 'c128_reservations',
      inquiries: 'c128_inquiries',
      spaceInquiries: 'c128_space_inquiries'
    };
    const VERSION_KEY = 'c128_data_version';

    function rawGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

    function read(key) {
      try { const v = JSON.parse(rawGet(key)); return Array.isArray(v) ? v : []; }
      catch (e) { return []; }
    }
    function write(key, list) { return rawSet(key, JSON.stringify(list)); }
    function nextId(list) { return list.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1; }

    // Adds one record (auto id + timestamp). Returns the saved record, or null if the browser blocked storage.
    function add(key, record) {
      const list = read(key);
      const saved = Object.assign({ id: nextId(list), created_at: new Date().toISOString() }, record);
      list.push(saved);
      return write(key, list) ? saved : null;
    }
    // Removes one record by id. Returns true if storage was updated.
    function remove(key, id) {
      return write(key, read(key).filter(r => String(r.id) !== String(id)));
    }

    // Escape anything coming from users / storage before it goes into innerHTML.
    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      ));
    }

    function todayISO() {            // local date, not UTC
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function fmtDate(iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
      if (!m) return iso || '';
      return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function fmtTime(t) {
      const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
      if (!m) return t || '';
      const h = +m[1];
      return ((h + 11) % 12 + 1) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM');
    }

    // Loads data.json once per page and seeds localStorage.
    //  - menu / promotions / events: (re)seeded when missing, or when "version" in data.json changes
    //  - reviews: seeded only when missing (so deleted/added reviews are never overwritten)
    // Always resolves (true = data.json loaded, false = offline/failed; saved data is still usable).
    let seeding = null;
    function seed() {
      if (seeding) return seeding;
      seeding = fetch('data.json', { cache: 'no-cache' })
        .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(data => {
          const version = String(data.version == null ? 1 : data.version);
          const changed = rawGet(VERSION_KEY) !== version;
          ['menu', 'promotions', 'events'].forEach(name => {
            if (changed || rawGet(KEYS[name]) === null) write(KEYS[name], Array.isArray(data[name]) ? data[name] : []);
          });
          if (rawGet(KEYS.reviews) === null) write(KEYS.reviews, Array.isArray(data.reviews) ? data.reviews : []);
          rawSet(VERSION_KEY, version);
          return true;
        })
        .catch(err => {
          console.warn('[1.28] Could not load data.json - using saved data only. (Open the site through GitHub Pages or a local server, not by double-clicking the file.)', err);
          return false;
        });
      return seeding;
    }

    return { KEYS, read, write, add, remove, esc, todayISO, fmtDate, fmtTime, seed };
  })());

  /* ==========================================================================
     MENU PAGE  (#searchInput, #categoryFilter, #menuGrid)
     ========================================================================== */
  const { KEYS, esc, fmtDate, fmtTime } = C128;
  const EMPTY_STYLE = 'grid-column:1/-1; text-align:center; color:#888; padding:2rem;';

  let allItems = [];
  let dataLoaded = true;

  function menuCard(item) {
    const img = item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.remove()" />`
      : '';
    return `
      <div class="card">
        ${img}
        <div class="card-body">
          ${item.tag ? `<span class="tag">${esc(item.tag)}</span>` : ''}
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description)}</p>
          <p class="price">₱${esc(item.price)}</p>
          <small style="color:#888;">${esc(item.category)}</small>
        </div>
      </div>`;
  }

  function renderMenu(items) {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;

    if (!allItems.length) {
      grid.innerHTML = dataLoaded
        ? `<p style="${EMPTY_STYLE}">The menu is empty right now. Please check back soon!</p>`
        : `<p style="${EMPTY_STYLE}">We couldn't load the menu right now. Please refresh the page.</p>`;
      return;
    }
    if (!items.length) {
      grid.innerHTML = `<p style="${EMPTY_STYLE}">No items match your search.</p>`;
      return;
    }
    grid.innerHTML = items.map(menuCard).join('');
  }

  function applyFilters() {
    const searchEl = document.getElementById('searchInput');
    const catEl = document.getElementById('categoryFilter');
    const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const category = catEl ? catEl.value : 'All';

    renderMenu(allItems.filter(item => {
      const inCategory = category === 'All' || item.category === category;
      const inSearch = !query || [item.name, item.description, item.category, item.tag]
        .some(v => String(v || '').toLowerCase().includes(query));
      return inCategory && inSearch;
    }));
  }

  function initMenuPage() {
    const grid = document.getElementById('menuGrid');
    if (!grid) return;
    grid.innerHTML = `<p style="${EMPTY_STYLE}">Loading menu…</p>`;

    C128.seed().then(ok => {
      dataLoaded = ok;
      allItems = C128.read(KEYS.menu);
      applyFilters();
    });

    const searchEl = document.getElementById('searchInput');
    const catEl = document.getElementById('categoryFilter');
    if (searchEl) searchEl.addEventListener('input', applyFilters);
    if (catEl) catEl.addEventListener('change', applyFilters);
  }

  /* ==========================================================================
     HOMEPAGE  (#featuredGrid, #promoText)
     ========================================================================== */
  function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    const featured = C128.read(KEYS.menu).filter(i => i.featured).slice(0, 4);

    if (!featured.length) {
      grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; color:#888; padding:2rem;">No featured items yet.</p>`;
      return;
    }
    grid.innerHTML = featured.map(item => `
      <div class="card item-card">
        ${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.remove()"
             style="height:150px; object-fit:cover; width:100%; display:block; background:var(--cream);" />` : ''}
        <div class="card-body">
          <div class="item-row">
            <h3>${esc(item.name)}</h3>
            <span class="price">₱${esc(item.price)}</span>
          </div>
          <p>${esc(item.description)}</p>
        </div>
      </div>`).join('');
  }

  function renderPromoPreview() {
    const box = document.getElementById('promoText');
    if (!box) return;
    const promo = C128.read(KEYS.promotions)[0];
    const event = upcomingEvents()[0];

    if (promo) {
      box.innerHTML = `<h2>${esc(promo.title)}</h2><p>${esc(promo.description || promo.schedule || '')}</p>`;
    } else if (event) {
      const when = [fmtDate(event.event_date), fmtTime(event.event_time)].filter(Boolean).join(' · ');
      box.innerHTML = `<h2>${esc(event.title)}</h2><p>${esc(when)}</p>`;
    } else {
      box.innerHTML = `<h2>New things brewing</h2>
        <p>Follow us on social media for upcoming promos and events.</p>`;
    }
  }

  /* ==========================================================================
     EVENTS PAGE  (#eventsContainer)
     ========================================================================== */
  function upcomingEvents() {
    const today = C128.todayISO();
    return C128.read(KEYS.events)
      .filter(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.event_date || '') || e.event_date >= today)   // hide past dated events
      .sort((a, b) => String(a.event_date || '9999').localeCompare(String(b.event_date || '9999')));
  }

  function renderEvents() {
    const box = document.getElementById('eventsContainer');
    if (!box) return;
    const items = [...upcomingEvents(), ...C128.read(KEYS.promotions)];

    if (!items.length) {
      box.innerHTML = `
        <div style="background:white; border-radius:14px; padding:3rem 2rem; box-shadow: var(--shadow); text-align:center; max-width:560px; margin:0 auto;">
          <div style="font-size:3.5rem; margin-bottom:1rem;">📅</div>
          <h3 style="color:var(--navy); font-weight:400; margin-bottom:0.6rem;">No special events scheduled right now</h3>
          <p style="color:#666; margin-bottom:1.8rem;">
            Follow us so you don't miss our next tasting night, live music session, or seasonal special.
          </p>
          <a href="https://www.instagram.com/1.28coffeexcocktails" target="_blank" rel="noopener" class="btn-primary">Follow on Instagram</a>
        </div>`;
      return;
    }

    box.innerHTML = `<div class="featured-grid">` + items.map(e => {
      const tag = e.event_date ? fmtDate(e.event_date) : (e.schedule || 'TBA');
      const detail = e.description || (e.event_time ? '🕒 ' + fmtTime(e.event_time) : '');
      return `
        <div class="card">
          <div class="card-body">
            <span class="tag">${esc(tag)}</span>
            <h3>${esc(e.title)}</h3>
            <p style="margin-top:0.5rem; color:#666;">${esc(detail)}</p>
          </div>
        </div>`;
    }).join('') + `</div>`;
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  // Keep the old script.js API working (it calls getMenuItems / loadFeaturedItems / loadPromoPreview).
  window.getMenuItems = () => C128.read(KEYS.menu);

  function boot() {
    // script.js (loaded after this file) calls these on DOMContentLoaded; point them at the data.json-backed versions.
    window.loadFeaturedItems = () => C128.seed().then(renderFeatured);
    window.loadPromoPreview = () => C128.seed().then(renderPromoPreview);

    initMenuPage();
    if (document.getElementById('featuredGrid') || document.getElementById('promoText') || document.getElementById('eventsContainer')) {
      C128.seed().then(() => { renderFeatured(); renderPromoPreview(); renderEvents(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
