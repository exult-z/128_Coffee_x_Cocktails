/* 1.28 Coffee x Cocktails — feedback.js
   Reviews page: renders from localStorage, saves new reviews instantly. No server needed. */

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
     REVIEWS PAGE  (#reviewsList, #feedbackForm, #reviewerName, #rating,
                    #reviewText, #feedbackSuccess)
     ========================================================================== */
  const { KEYS, esc, fmtDate } = C128;
  const HEADING = '<h2 style="text-align:center; color:var(--coffee-dark); margin-bottom:1rem;">What Our Customers Say</h2>';

  function renderReviews() {
    const list = document.getElementById('reviewsList');
    if (!list) return;

    const reviews = C128.read(KEYS.reviews).slice().sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) || (Number(b.id) || 0) - (Number(a.id) || 0));

    if (!reviews.length) {
      list.innerHTML = HEADING + `
        <div class="review-card" style="text-align:center;">
          <p>No reviews yet — be the first to share your experience!</p>
        </div>`;
      return;
    }

    list.innerHTML = HEADING + reviews.map(r => {
      const stars = '⭐'.repeat(Math.min(5, Math.max(0, parseInt(r.rating, 10) || 0)));
      return `
        <div class="review-card">
          <div class="stars">${stars}</div>
          <p>${esc(r.text)}</p>
          <p class="reviewer">— ${esc(r.name)} <small style="color:#999;">(${esc(fmtDate(r.date))})</small></p>
        </div>`;
    }).join('');
  }

  function initFeedbackForm() {
    const form = document.getElementById('feedbackForm');
    if (!form) return;

    form.addEventListener('submit', e => {
      e.preventDefault();
      form.querySelectorAll('.form-group').forEach(g => g.classList.remove('invalid'));

      const name = document.getElementById('reviewerName');
      const rating = document.getElementById('rating');
      const text = document.getElementById('reviewText');
      let valid = true;

      if (name.value.trim().length < 2) { name.parentElement.classList.add('invalid'); valid = false; }
      if (!rating.value) { rating.parentElement.classList.add('invalid'); valid = false; }
      if (text.value.trim().length < 10) { text.parentElement.classList.add('invalid'); valid = false; }
      if (!valid) return;

      const saved = C128.add(KEYS.reviews, {
        name: name.value.trim().slice(0, 60),
        rating: parseInt(rating.value, 10),
        text: text.value.trim().slice(0, 1000),
        date: C128.todayISO()
      });
      if (!saved) {
        alert('Sorry, your browser blocked saving the review (private mode or storage disabled).');
        return;
      }

      form.reset();
      renderReviews();                                   // show it instantly
      const ok = document.getElementById('feedbackSuccess');
      if (ok) {
        ok.style.display = 'block';
        setTimeout(() => { ok.style.display = 'none'; }, 4000);
      }
    });
  }

  function boot() {
    initFeedbackForm();
    // Load sample reviews from data.json the first time, then render from localStorage.
    C128.seed().then(renderReviews);
    renderReviews();                                     // render right away if reviews are already saved
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
