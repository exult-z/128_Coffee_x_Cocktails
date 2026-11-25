/* 1.28 Coffee x Cocktails — reservation.js
   Reservation, contact and event-hosting forms -> localStorage. No server needed. */

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
     RESERVATION + CONTACT + EVENT-HOSTING FORMS
       #reservationForm  -> c128_reservations
       #contactForm      -> c128_inquiries
       #spaceForm        -> c128_space_inquiries
     ========================================================================== */
  const { KEYS } = C128;
  const USE_BROWSER_ALERT = false;   // true = also/instead use a pop-up alert() rather than the page's green success banner
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ALLOWED_DAYS = [3, 4, 5, 6];  // Wed–Sat

  function $(id) { return document.getElementById(id); }
  function clearInvalid(form) { form.querySelectorAll('.form-group').forEach(g => g.classList.remove('invalid')); }
  function flag(input) { if (input && input.parentElement) input.parentElement.classList.add('invalid'); return false; }

  function showSuccess(el, message, ms) {
    if (USE_BROWSER_ALERT || !el) alert(message);
    if (el) {
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, ms || 4000);
    }
  }
  function storageError() {
    alert('Sorry, your browser blocked saving this form (private mode or storage disabled). Please try another browser.');
  }

  /* ---------- Cocktail bar reservation ---------- */
  function initReservation() {
    const form = $('reservationForm');
    if (!form) return;

    const today = C128.todayISO();
    if ($('date')) $('date').setAttribute('min', today);

    form.addEventListener('submit', e => {
      e.preventDefault();
      clearInvalid(form);
      if ($('agreeError')) $('agreeError').style.display = 'none';

      const fullName = $('fullName'), email = $('email'), phone = $('phone'), birthdate = $('birthdate');
      const date = $('date'), time = $('time'), guests = $('guests'), agree = $('agree'), poetry = $('poetry');
      let valid = true;

      if (fullName.value.trim().length < 2) valid = flag(fullName);
      if (!EMAIL_RE.test(email.value.trim())) valid = flag(email);
      if (!/^[0-9]{10,13}$/.test(phone.value.trim())) valid = flag(phone);

      if (!birthdate.value) valid = flag(birthdate);
      else {
        const bd = new Date(birthdate.value + 'T00:00:00'), now = new Date();
        let age = now.getFullYear() - bd.getFullYear();
        const m = now.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
        if (isNaN(age) || age < 18) valid = flag(birthdate);
      }

      if (!date.value) valid = flag(date);
      else {
        const d = new Date(date.value + 'T00:00:00');
        if (!ALLOWED_DAYS.includes(d.getDay()) || date.value < today) valid = flag(date);
      }

      if (!time.value) valid = flag(time);
      else if (Number(time.value.split(':')[0]) < 18) valid = flag(time);

      if (!guests.value || Number(guests.value) < 1 || Number(guests.value) > 8) valid = flag(guests);
      if (!agree.checked) {
        if ($('agreeError')) $('agreeError').style.display = 'block';
        valid = false;
      }
      if (!valid) return;

      const saved = C128.add(KEYS.reservations, {
        name: fullName.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim(),
        instagram: $('instagram') ? $('instagram').value.trim() : '',
        birthdate: birthdate.value,
        res_date: date.value,
        res_time: time.value,
        guests: Number(guests.value),
        poetry: !!(poetry && poetry.checked),
        notes: $('notes') ? $('notes').value.trim() : ''
      });
      if (!saved) return storageError();

      form.reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showSuccess($('successMsg'), "Reservation received! We'll confirm via email or IG within 24 hours.", 6000);
    });
  }

  /* ---------- Contact form ---------- */
  function initContact() {
    const form = $('contactForm');
    if (!form) return;

    form.addEventListener('submit', e => {
      e.preventDefault();
      clearInvalid(form);
      const name = $('cName'), email = $('cEmail'), message = $('cMessage');
      let valid = true;

      if (name.value.trim().length < 2) valid = flag(name);
      if (!EMAIL_RE.test(email.value.trim())) valid = flag(email);
      if (message.value.trim().length < 10) valid = flag(message);
      if (!valid) return;

      const saved = C128.add(KEYS.inquiries, {
        name: name.value.trim(),
        email: email.value.trim(),
        message: message.value.trim()
      });
      if (!saved) return storageError();

      form.reset();
      showSuccess($('contactSuccess'), "Message sent! We'll get back to you soon.");
    });
  }

  /* ---------- Event hosting / coffee cart form ---------- */
  function initSpace() {
    const form = $('spaceForm');
    if (!form) return;

    form.addEventListener('submit', e => {
      e.preventDefault();
      clearInvalid(form);
      const name = $('sName'), email = $('sEmail'), message = $('sMessage');

      if (!name.value.trim() || !EMAIL_RE.test(email.value.trim()) || !message.value.trim()) {
        alert('Please fill out all required fields (name, a valid email, and a message).');
        return;
      }

      const saved = C128.add(KEYS.spaceInquiries, {
        name: name.value.trim(),
        email: email.value.trim(),
        phone: $('sPhone') ? $('sPhone').value.trim() : '',
        event_type: $('sType') ? $('sType').value : '',
        event_date: $('sDate') ? $('sDate').value : '',
        message: message.value.trim()
      });
      if (!saved) return storageError();

      form.reset();
      showSuccess($('spaceSuccess'), "Request sent! We'll get back to you soon.");
    });
  }

  function boot() { initReservation(); initContact(); initSpace(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
