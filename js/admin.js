/* 1.28 Coffee x Cocktails — admin.js
   Admin dashboard: fake login (sessionStorage) + localStorage tables with working Delete buttons. */

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
     ADMIN DASHBOARD  (static "fake" login + localStorage tables)
     Login: admin / 128admin   (stored in sessionStorage key "adm_session",
     the same key the inline lock script in admin.html checks)
     NOTE: this is front-end only - fine for a class project, not real security.
     ========================================================================== */
  const { KEYS, esc, fmtDate, fmtTime } = C128;
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = '128admin';
  const SESSION_KEY = 'adm_session';
  const SESSION_MS = 20 * 60 * 1000;   // 20 minutes, matches admin.html

  const $ = id => document.getElementById(id);

  /* ---------- session ---------- */
  function isLoggedIn() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return !!(s && Date.now() - s.t < SESSION_MS);
    } catch (e) { return false; }
  }
  function touchSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ t: Date.now() })); } catch (e) {}
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    window.location.reload();
  }

  function initLogin() {
    const form = $('loginForm');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const user = $('loginUser').value.trim();
        const pass = $('loginPass').value;
        const err = $('loginError');

        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          touchSession();
          if (err) err.textContent = '';
          $('loginPass').value = '';
          document.documentElement.classList.remove('locked');
          loadAllTables();
        } else if (err) {
          err.textContent = 'Invalid username or password.';
        }
      });
    }
    const toggle = $('pwToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const p = $('loginPass');
        p.type = p.type === 'password' ? 'text' : 'password';
      });
    }
  }

  /* ---------- tables ---------- */
  const DELETE_BTN_STYLE = 'background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;';
  const multiline = v => `<span style="white-space:pre-wrap;">${esc(v)}</span>`;

  function ageFrom(birthdate) {
    const bd = new Date(birthdate + 'T00:00:00');
    if (!birthdate || isNaN(bd)) return '—';
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
    return age;
  }

  const TABLES = {
    menu: {
      key: KEYS.menu, selector: '#menuTable tbody', cols: 5, label: 'menu item',
      empty: 'No menu items yet. Click “+ Add New Item” to create one.',
      row: i => `<td>${esc(i.name)}</td><td>${esc(i.category)}</td><td>₱${esc(i.price)}</td><td>${i.featured ? '✅' : '—'}</td>`
    },
    promo: {
      key: KEYS.promotions, selector: '#promoTable tbody', cols: 4, label: 'promo',
      empty: 'No promotions yet.',
      row: p => `<td>${esc(p.title)}</td><td>${esc(p.schedule)}</td><td>${esc(p.description)}</td>`
    },
    event: {
      key: KEYS.events, selector: '#eventTable tbody', cols: 4, label: 'event',
      empty: 'No events yet.',
      row: e => `<td>${esc(e.title)}</td><td>${esc(e.event_date ? fmtDate(e.event_date) : '—')}</td><td>${esc(e.event_time ? fmtTime(e.event_time) : '—')}</td>`
    },
    reservation: {
      key: KEYS.reservations, selector: '#resTable tbody', cols: 7, label: 'reservation', newestFirst: true,
      empty: 'No reservations yet.',
      row: r => `
        <td>${esc(r.name)}${r.notes ? `<br><small style="color:#888;">${multiline(r.notes)}</small>` : ''}</td>
        <td>${esc(r.email)}<br><small style="color:#888;">${esc(r.phone)}${r.instagram ? ' · ' + esc(r.instagram) : ''}</small></td>
        <td>${esc(fmtDate(r.res_date))}<br><small style="color:#888;">${esc(fmtTime(r.res_time))}</small></td>
        <td>${esc(r.guests)}</td>
        <td>${esc(ageFrom(r.birthdate))}</td>
        <td>${r.poetry ? '✅' : '—'}</td>`
    },
    review: {
      key: KEYS.reviews, selector: '#revTable tbody', cols: 4, label: 'review', newestFirst: true,
      empty: 'No reviews yet.',
      row: r => `<td>${esc(r.name)}</td><td>${'⭐'.repeat(Math.min(5, Math.max(0, parseInt(r.rating, 10) || 0)))}</td><td>${multiline(r.text)}</td>`
    },
    inquiry: {
      key: KEYS.inquiries, selector: '#msgTable tbody', cols: 4, label: 'inquiry', newestFirst: true,
      empty: 'No inquiries yet.',
      row: m => `<td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${multiline(m.message)}</td>`
    },
    space: {
      key: KEYS.spaceInquiries, selector: '#spaceTable tbody', cols: 6, label: 'inquiry', newestFirst: true,
      empty: 'No event hosting inquiries yet.',
      row: m => `
        <td>${esc(m.name)}</td>
        <td>${esc(m.email)}${m.phone ? `<br><small style="color:#888;">${esc(m.phone)}</small>` : ''}</td>
        <td>${esc(m.event_type)}</td><td>${esc(m.event_date ? fmtDate(m.event_date) : '—')}</td><td>${multiline(m.message)}</td>`
    }
  };

  function renderTable(name) {
    const t = TABLES[name];
    const tbody = document.querySelector(t.selector);
    if (!tbody) return;

    let list = C128.read(t.key);
    if (t.newestFirst) list = list.slice().reverse();

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${t.cols}" style="text-align:center; color:#888; padding:1.5rem;">${t.empty}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr>${t.row(r)}
        <td><button type="button" data-delete="${name}" data-id="${esc(r.id)}" style="${DELETE_BTN_STYLE}">Delete</button></td>
      </tr>`).join('');
  }

  function loadAllTables() { Object.keys(TABLES).forEach(renderTable); }

  // One click handler for every Delete button in every table.
  document.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('button[data-delete]');
    if (!btn) return;
    if (!isLoggedIn()) { document.documentElement.classList.add('locked'); return; }

    const name = btn.dataset.delete;
    const t = TABLES[name];
    if (!t || !confirm(`Delete this ${t.label}?`)) return;

    if (!C128.remove(t.key, btn.dataset.id)) alert('Could not update saved data (browser storage blocked).');
    touchSession();
    renderTable(name);
  });

  /* ---------- tabs + modal (called from onclick="..." in admin.html) ---------- */
  function switchTab(e, tabId) {
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
    $(tabId).classList.add('active');
    (e.currentTarget || e.target).classList.add('active');
    loadAllTables();
  }
  function closeModal() { $('modal').style.display = 'none'; }

  function openModal(title, bodyHtml, onSave) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalSave').onclick = () => {
      if (!isLoggedIn()) { closeModal(); document.documentElement.classList.add('locked'); return; }
      if (onSave() === false) return;       // validation failed: keep the modal open
      touchSession();
      closeModal();
    };
    $('modal').style.display = 'flex';
  }

  function saveOrAlert(key, record) {
    if (C128.add(key, record)) return true;
    alert('Could not save (browser storage blocked).');
    return false;
  }

  function openMenuForm() {
    const cats = [...new Set(C128.read(KEYS.menu).map(i => i.category).filter(Boolean))];
    openModal('Add Menu Item', `
      <div class="form-group"><label>Name</label><input id="mName" /></div>
      <div class="form-group"><label>Category</label><input id="mCategory" list="mCategoryList" />
        <datalist id="mCategoryList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="form-group"><label>Price (₱)</label><input id="mPrice" type="number" min="0" /></div>
      <div class="form-group"><label>Description</label><textarea id="mDesc"></textarea></div>
      <div class="form-group"><label>Image filename (optional)</label><input id="mImage" placeholder="assets/photo.jpg" /></div>
      <div class="form-group"><label><input type="checkbox" id="mFeatured" /> Featured item</label></div>
      <div class="form-group"><label>Tag</label><input id="mTag" placeholder="e.g. ⭐ Must Try" /></div>
    `, () => {
      const name = $('mName').value.trim(), category = $('mCategory').value.trim();
      if (!name || !category) { alert('Please enter a name and a category.'); return false; }
      const saved = saveOrAlert(KEYS.menu, {
        name, category,
        price: parseInt($('mPrice').value, 10) || 0,
        description: $('mDesc').value.trim(),
        image: $('mImage').value.trim(),
        featured: $('mFeatured').checked,
        tag: $('mTag').value.trim()
      });
      if (saved) renderTable('menu');
      return saved;
    });
  }

  function openPromoForm() {
    openModal('Add Promotion', `
      <div class="form-group"><label>Title</label><input id="pTitle" /></div>
      <div class="form-group"><label>Schedule</label><input id="pSchedule" placeholder="e.g. Every Friday" /></div>
      <div class="form-group"><label>Description</label><textarea id="pDesc"></textarea></div>
    `, () => {
      const title = $('pTitle').value.trim();
      if (!title) { alert('Please enter a title.'); return false; }
      const saved = saveOrAlert(KEYS.promotions, {
        title, schedule: $('pSchedule').value.trim(), description: $('pDesc').value.trim()
      });
      if (saved) renderTable('promo');
      return saved;
    });
  }

  function openEventForm() {
    openModal('Add Event', `
      <div class="form-group"><label>Event Title</label><input id="eTitle" /></div>
      <div class="form-group"><label>Date</label><input id="eDate" type="date" /></div>
      <div class="form-group"><label>Time</label><input id="eTime" type="time" /></div>
    `, () => {
      const title = $('eTitle').value.trim();
      if (!title) { alert('Please enter an event title.'); return false; }
      const saved = saveOrAlert(KEYS.events, {
        title, event_date: $('eDate').value, event_time: $('eTime').value
      });
      if (saved) renderTable('event');
      return saved;
    });
  }

  // admin.html uses inline onclick="..." handlers, so these must be global.
  Object.assign(window, { switchTab, closeModal, openMenuForm, openPromoForm, openEventForm, logout, loadAllTables });

  /* ---------- boot ---------- */
  function boot() {
    initLogin();
    // Seed from data.json first (so the menu/promos/events/reviews tables are filled), then draw the tables.
    C128.seed().then(() => { if (isLoggedIn()) loadAllTables(); });
    // Reflect changes made on the public pages in another tab of this same browser.
    window.addEventListener('storage', () => { if (isLoggedIn()) loadAllTables(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
