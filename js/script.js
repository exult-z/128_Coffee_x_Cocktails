/* ============================
   1.28 COFFEE X COCKTAILS
   General Script
   ============================ */

// ---- MOBILE MENU TOGGLE ----
function toggleMenu() {
  const nav = document.querySelector('.nav-links');
  nav.classList.toggle('show');
}

// ---- ON PAGE LOAD ----
document.addEventListener('DOMContentLoaded', () => {
  // Highlight active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

  // Load featured items on homepage
  if (document.getElementById('featuredGrid')) {
    loadFeaturedItems();
  }

  // Load promo preview on homepage
  if (document.getElementById('promoText')) {
    loadPromoPreview();
  }
});

// ============================
// FEATURED PRODUCTS
// ============================
function loadFeaturedItems() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  // Pull from menu items (uses versioned getter from menu.js)
  const menu = typeof getMenuItems === 'function' ? getMenuItems() : [];
  const featured = menu.filter(item => item.featured).slice(0, 4); // limit to 4

  if (featured.length === 0) {
    grid.innerHTML = `
      <p style="text-align:center; grid-column:1/-1; color:#888; padding:2rem;">
        No featured items yet.
      </p>
    `;
    return;
  }

  grid.innerHTML = featured.map(item => `
    <div class="card item-card">
      <img src="${item.image}" alt="${item.name}"
           onerror="fallbackImg(this,'${item.category}')"
           style="height:150px; object-fit:cover; width:100%; display:block; background:var(--cream);" />
      <div class="card-body">
        <div class="item-row">
          <h3>${item.name}</h3>
          <span class="price">₱${item.price}</span>
        </div>
        <p>${item.description}</p>
      </div>
    </div>
  `).join('');
}

// ============================
// PROMO / EVENTS PREVIEW
// ============================
function loadPromoPreview() {
  const box = document.getElementById('promoText');
  if (!box) return;

  const promos = JSON.parse(localStorage.getItem('promos')) || [];
  const events = JSON.parse(localStorage.getItem('events')) || [];
  const first = [...promos, ...events][0];

  if (!first) {
    box.innerHTML = `<h2>New things brewing</h2>
      <p>Follow us on social media for upcoming promos and events.</p>`;
    return;
  }
  box.innerHTML = `<h2>${first.title}</h2>
    <p>${first.desc || first.date || ''}</p>`;
}


// ============================
// FUN EXTRAS
// ============================
document.documentElement.classList.add('js');

// Menu items have no photos yet: if an image file is missing, remove it so the card stays text-only.
function fallbackImg(img) { img.remove(); }

// "Open now?" badge (Manila time)
const CAFE_HRS = { 1: [600, 1320], 2: [600, 1320], 3: [600, 1320], 4: [720, 1440], 5: [720, 1440], 6: [720, 1380] };
const BAR_HRS  = { 3: [1080, 1440], 4: [1080, 1440], 5: [1080, 1560], 6: [1080, 1560] };
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function fmtHour(min) { const h = Math.floor(min / 60) % 24; return ((h + 11) % 12 + 1) + (h >= 12 ? 'PM' : 'AM'); }
function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return { d: DAY_NAMES.indexOf(get('weekday')), m: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
}
function isOpenNow(hrs, d, m) {
  const t = hrs[d];
  if (t && m >= t[0] && m < t[1]) return true;
  const y = hrs[(d + 6) % 7];                       // yesterday's late session (e.g. Fri bar until 2AM)
  return !!(y && y[1] > 1440 && m + 1440 < y[1]);
}
function updateOpenBadge() {
  const el = document.getElementById('openBadge');
  if (!el) return;
  const { d, m } = manilaNow();
  const cafe = isOpenNow(CAFE_HRS, d, m), bar = isOpenNow(BAR_HRS, d, m);
  el.classList.toggle('is-open', cafe || bar);
  el.classList.toggle('is-closed', !(cafe || bar));
  if (cafe && bar) el.textContent = '🟢 Open now: café & cocktail bar';
  else if (bar) el.textContent = '🟢 Cocktail bar is open now';
  else if (cafe) el.textContent = '🟢 Café open now · until ' + fmtHour(CAFE_HRS[d][1]);
  else {
    for (let i = 0; i < 8; i++) {
      const day = (d + i) % 7, s = CAFE_HRS[day];
      if (s && (i > 0 || m < s[0])) {
        el.textContent = '🌙 Closed right now · opens ' + (i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAY_NAMES[day]) + ' at ' + fmtHour(s[0]);
        break;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateOpenBadge();
  setInterval(updateOpenBadge, 60000);
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  els.forEach(e => io.observe(e));
});
