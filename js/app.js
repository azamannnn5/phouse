/* The P House core: data (Supabase or local), pricing, promos, cart, layout, popups, search, chat */
const API = '/.netlify/functions/';
let SB = false, API_STATE = 'none'; /* none: no backend (local test mode), live: backend answered, error: backend answered with a problem */
const LOCAL_KEY = 'pph_local_db_v5', CACHE_KEY = 'pph_cache_v5', CART_KEY = 'pph_cart_v5', AGE_KEY = 'pph_age';
const PAGE = document.body.dataset.page;
const clone = o => JSON.parse(JSON.stringify(o));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = n => Math.round(n * 100) / 100;
const money = n => { n = round2(n); return '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); };
const fmt = n => '$' + round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const sess = {
  get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};

/* ---------- data ---------- */
let DB = clone(window.DEFAULT_DB);
function fillDefaults(d) {
  const D = window.DEFAULT_DB;
  Object.keys(D).forEach(k => { if (d[k] == null) d[k] = clone(D[k]); });
  ['settings', 'form', 'kits', 'pages'].forEach(k => {
    if (Array.isArray(D[k]) || typeof D[k] !== 'object') return;
    Object.keys(D[k]).forEach(kk => { if (d[k][kk] == null) d[k][kk] = clone(D[k][kk]); });
  });
  return d;
}
async function sbLoad() {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3500);
  try {
    let r; try { r = await fetch(API + 'site-config', { cache: 'no-store', signal: ctl.signal }); } catch (x) { API_STATE = 'error'; SB = true; throw x; }
    if (r.status === 404) { API_STATE = 'none'; return null; }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) { API_STATE = 'error'; SB = true; throw new Error(j && j.error ? j.error : 'load ' + r.status); }
    API_STATE = 'live'; SB = true;
    return j.data || null;
  } finally { clearTimeout(t); }
}
const READY = (async () => {
  let d = null, source = 'default';
  try { d = await sbLoad(); if (d) { source = 'remote'; store.set(CACHE_KEY, d); } } catch (e) { d = store.get(CACHE_KEY); if (d) source = 'cache'; }
  if (!SB) { d = store.get(LOCAL_KEY); source = d ? 'local' : 'default'; }
  DB = fillDefaults(d || clone(window.DEFAULT_DB));
  window.DB_SOURCE = source;
})();
/* ordered lists for Featured and Best selling (order is set in admin) */
function orderedList(key) {
  const flag = DB.products.filter(p => p[key] && p.inStock), ids = ((DB.order || {})[key] || []);
  const pos = p => { const k = ids.indexOf(p.id); return k < 0 ? 1e6 : k; };
  return flag.map((p, i) => [p, i]).sort((x, y) => pos(x[0]) - pos(y[0]) || x[1] - y[1]).map(x => x[0]);
}
const picksText = pk => Object.entries(pk || {}).map(([n, c]) => n + ' x' + c).join(' + ');
const brandLine = (name, pk) => { const t = picksText(pk); return t ? name + ' - ' + t : name; };
const findProduct = id => DB.products.find(p => p.id === id);
const findRun = id => (DB.kits.runs || []).find(r => r.id === id);

/* ---------- pricing ---------- */
const priceSet = p => (DB.pricing && DB.pricing[(p && p.priceSet) || 'dispos']) || { tiers: [], customMin: 0, customRate: 0, unit: 'pc' };
const itemName = p => p.name + (p.sizeTag ? ' ' + p.sizeTag : '');
const noun = p => (p && p.noun) || ((p && p.priceSet === 'weed') ? 'strain' : 'flavor');
const unitName = (p, n) => { const u = priceSet(p).unit || 'pc'; return u === 'pc' ? 'pc' : (Number(n) === 1 ? u : u + 's'); };
const sortedTiers = p => (priceSet(p).tiers || []).slice().sort((a, b) => a.qty - b.qty);
function customRate(ps, n) {
  if (ps.customs && ps.customs.length) {
    const c = ps.customs.slice().sort((a, b) => a.min - b.min).filter(x => n >= x.min).pop();
    return c ? Number(c.rate) || 0 : null;
  }
  return (Number(ps.customMin) > 0 && n >= ps.customMin) ? (Number(ps.customRate) || 0) : null;
}
const customNote = p => { const ps = priceSet(p); return ps.customs && ps.customs.length ? ps.customs.slice().sort((a, b) => a.min - b.min).map(c => c.min + '+ ' + money(c.rate) + ' each').join(' / ') : ''; };
/* exact pack = pack price. In between: per piece rate, never above the next pack and never below the previous pack */
function priceFor(p, n) {
  if (!p) return 0; n = Number(n);
  const ps = priceSet(p), tiers = sortedTiers(p), ex = tiers.find(t => Number(t.qty) === n);
  if (ex) return Number(ex.price) || 0;
  const r = customRate(ps, n); if (r == null) return 0;
  let price = n * r;
  const next = tiers.find(t => t.qty > n), prev = tiers.filter(t => t.qty < n).pop();
  if (next) price = Math.min(price, Number(next.price) || 0);
  if (prev) price = Math.max(price, Number(prev.price) || 0);
  return round2(price);
}
/* tier choices for a product: named boxes replace the plain label */
function tierOptions(p) {
  const unit = priceSet(p).unit || 'pc';
  return sortedTiers(p).filter(t => Number(t.qty) >= (Number(p.minTier) || 0)).map(t => {
    const box = (p.boxes || []).find(b => Number(b.count) === Number(t.qty));
    const plain = t.label ? t.label : t.qty + ' ' + unit;
    const label = box ? (/\d/.test(box.name) ? box.name : box.name + ' (' + t.qty + ' ' + unit + ')') : plain;
    return { qty: Number(t.qty), price: Number(t.price), label, available: box ? !!box.available : true };
  });
}
const tierLabel = (p, qty) => { const o = tierOptions(p).find(x => x.qty === Number(qty)); return o ? o.label : qty + ' ' + unitName(p, qty); };

/* ---------- cart ---------- */
let CART = store.get(CART_KEY) || [];
function saveCart() { store.set(CART_KEY, CART); updateBag(); }
const lineRun = l => l.kit ? findRun(l.kid) : null;
const linePrice = l => l.kit ? (lineRun(l) ? Number(lineRun(l).price) || 0 : 0) : priceFor(findProduct(l.pid), l.qty);
const lineValid = l => l.kit ? !!lineRun(l) : !!findProduct(l.pid);
const lineEligible = l => l.kit ? !!(lineRun(l) && lineRun(l).promoEligible) : true;
function addToCart(line) { line.id = 'l' + Date.now() + Math.random().toString(36).slice(2, 6); CART.push(line); saveCart(); }
const cartSubtotal = () => CART.reduce((a, l) => a + (lineValid(l) ? linePrice(l) : 0), 0);
const cartEligible = () => CART.reduce((a, l) => a + (lineValid(l) && lineEligible(l) ? linePrice(l) : 0), 0);
function updateBag() {
  const el = $('#bagCount'); if (!el) return;
  const n = CART.length; el.textContent = n; el.classList.toggle('zero', n === 0);
}

/* ---------- promos (logic is driven by the promo values) ---------- */
function computeDiscount(total, eligible, payment, code) {
  const res = { percent: 0, amount: 0, label: '', codeMsg: '', codeOk: false };
  const c = (code || '').trim().toLowerCase();
  (DB.promos || []).filter(p => p.active).forEach(p => {
    const pct = Number(p.percent) || 0, min = Number(p.minOrder) || 0;
    if (p.type === 'payment') {
      if (payment && p.payment === payment && total >= min && pct > res.percent) { res.percent = pct; res.label = p.label || (p.payment + ' ' + pct + '% off'); }
    } else if (c && (p.code || '').trim().toLowerCase() === c) {
      if (total >= min) { res.codeOk = true; res.codeMsg = 'Promo code applied.'; if (pct > res.percent) { res.percent = pct; res.label = p.label || ('Promo code ' + pct + '% off'); } }
      else { res.codeMsg = 'This code needs an order of ' + fmt(min) + ' or more.'; }
    }
  });
  if (c && !res.codeOk && !res.codeMsg) res.codeMsg = 'That promo code is not valid.';
  res.amount = Math.round(eligible * res.percent) / 100;
  return res;
}
const fillTokens = (t, p) => String(t || '').replace(/\{percent\}/g, p ? Number(p.percent) || 0 : '').replace(/\{min\}/g, p ? money(Number(p.minOrder) || 0) : '').replace(/\{code\}/g, p ? (p.code || '') : '');
function bannerMsgs() {
  return (DB.banner || []).filter(b => b && b.active !== false).map(b => {
    if (b.promo) { const p = (DB.promos || []).find(x => x.id === b.promo); if (!p || !p.active) return ''; return fillTokens(b.text, p); }
    return b.text;
  }).filter(Boolean);
}

/* ---------- icons ---------- */
const BAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l1 12.5h-15L5.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>';
const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const CHEV = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
const SOCIAL = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077'
};
const socialLinks = (cls) => {
  const ls = ((DB.settings || {}).links || []).filter(l => l.on && l.url && SOCIAL[l.id]);
  return ls.length ? '<div class="social ' + (cls || '') + '">' + ls.map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" aria-label="' + esc(l.label) + '" title="' + esc(l.label) + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="' + SOCIAL[l.id] + '"/></svg></a>').join('') + '</div>' : '';
};
const linkUrl = id => { const l = ((DB.settings || {}).links || []).find(x => x.id === id); return l && l.url ? l.url : ''; };

/* breadcrumbs: Home / Shop / Dispos / Turn */
function crumbs(list) {
  return '<nav class="crumbs" aria-label="Breadcrumb">' + list.map((c, i) => i === list.length - 1 ? '<span>' + esc(c[0]) + '</span>' : '<a href="' + esc(c[1]) + '">' + esc(c[0]) + '</a><i>/</i>').join('') + '</nav>';
}

/* ---------- layout ---------- */
let bannerTimer = null;
function renderLayout() {
  const msgs = bannerMsgs();
  $('#banner').className = 'banner'; $('#banner').hidden = !msgs.length;
  $('#banner').innerHTML = msgs.map((m, i) => '<span class="' + (i === 0 ? 'on' : '') + '">' + esc(m) + '</span>').join('');
  clearInterval(bannerTimer);
  if (msgs.length > 1) { let i = 0; const sp = $$('#banner span'); bannerTimer = setInterval(() => { sp[i].classList.remove('on'); i = (i + 1) % sp.length; sp[i].classList.add('on'); }, 4500); }
  const nav = [['index.html', 'HOME', 'home'], ['shop.html', 'SHOP', 'shop'], ['testruns.html', 'TEST RUNS', 'testruns'], ['about.html', 'ABOUT', 'about']];
  const active = ['products', 'product'].includes(PAGE) ? 'shop' : PAGE === 'testrun' ? 'testruns' : PAGE;
  const h = $('#siteHeader'); h.className = 'site-header';
  h.innerHTML = '<div class="logo-row"><a href="index.html" aria-label="The P House home"><img src="assets/logo-wordmark.png" alt="The P House"></a></div>';
  h.insertAdjacentHTML('afterend', '<div class="menu-bar"><div class="menu-in"><nav class="menu">' + nav.map(n => '<a href="' + n[0] + '"' + (n[2] === active ? ' class="active"' : '') + '>' + n[1] + '</a>').join('') + '</nav><div class="menu-tools"><button class="tool-btn" id="searchBtn" type="button" aria-label="Search">' + SEARCH_SVG + '</button><a class="tool-btn bag" href="cart.html" aria-label="Cart">' + BAG_SVG + '<span id="bagCount" class="bag-count zero">0</span></a></div></div></div>');
  const f = $('#siteFooter'); f.className = 'site-footer';
  f.innerHTML = '<div class="foot"><div><img class="flogo" src="assets/logo-wordmark-white.png" alt="The P House"><p>' + esc((DB.settings || {}).footerText || '') + '</p>' + socialLinks('light') + '</div>' +
    '<div><h4>Explore</h4><ul><li><a href="shop.html">Shop</a></li><li><a href="testruns.html">Test Runs</a></li><li><a href="about.html">About</a></li><li><a href="faq.html">FAQ</a></li><li><a href="contact.html">Contact Us</a></li><li><a href="cart.html">Cart</a></li></ul></div>' +
    '<div><h4>Orders</h4><ul><li>Order requests are sent by WhatsApp</li><li>Delivery details are confirmed with you directly</li></ul></div></div>' +
    '<div class="foot-bot"><span>&copy; 2026 The P House. All rights reserved.</span><span>Must be 21 or older to purchase.</span></div>';
  updateBag();
  $('#searchBtn').onclick = openSearch;
}

/* ---------- popups (age gate style) ---------- */
function popupCard(o) {
  const g = document.createElement('div'); g.className = 'age-gate';
  g.innerHTML = '<div class="age-card" role="dialog" aria-modal="true">' + (o.close ? '<button class="pop-x" type="button" aria-label="Close">&times;</button>' : '') + '<img src="assets/logo-circle-white.png" alt="The P House"><p class="tagline">Your Plug\'s house</p>' + (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + (o.text ? '<p class="age-txt">' + esc(o.text) + '</p>' : '') + '<div class="age-act">' + o.actions + '</div></div>';
  document.body.appendChild(g); document.body.style.overflow = 'hidden';
  const done = () => { g.remove(); document.body.style.overflow = ''; };
  return { el: g, done };
}
function ageGate() {
  return new Promise(res => {
    if (PAGE === 'admin' || store.get(AGE_KEY)) { res(); return; }
    const p = popupCard({ title: 'Are you 21 or older?', text: 'You must be of legal age to enter this site.', actions: '<button class="btn btn-white" id="ageYes" type="button">Yes, I am 21+</button><button class="btn btn-line" id="ageNo" type="button">No</button>' });
    $('#ageYes').onclick = () => { store.set(AGE_KEY, true); p.done(); res(); };
    $('#ageNo').onclick = () => { window.location.replace('https://www.google.com'); };
  });
}
function runPopups() {
  if (PAGE === 'admin') return;
  const q = [];
  const k = DB.kits || {};
  if (k.enabled && k.popupOn && PAGE !== 'testruns' && PAGE !== 'testrun') q.push({ id: 'kits', title: (k.popup || {}).title, text: '', button: (k.popup || {}).button || 'See test runs', href: 'testruns.html', delay: Number(k.popupDelay) || 8 });
  (DB.popups || []).filter(p => p.active).forEach(p => q.push({ id: p.id, title: p.title, text: p.text, button: p.button, href: p.link, delay: Number(p.delay) || 8 }));
  const queue = q.filter(p => !sess.get('pph_pop_' + p.id));
  let i = 0;
  const next = () => {
    if (i >= queue.length) return;
    const o = queue[i++];
    setTimeout(() => {
      sess.set('pph_pop_' + o.id, 1);
      const p = popupCard({ close: true, title: o.title, text: o.text, actions: (o.button && o.href ? '<a class="btn btn-white" href="' + esc(o.href) + '">' + esc(o.button) + '</a>' : '') });
      const close = () => { p.done(); next(); };
      $('.pop-x', p.el).onclick = close;
      p.el.addEventListener('click', e => { if (e.target === p.el) close(); });
    }, o.delay * 1000);
  };
  next();
}
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------- live chat (Smartsupp) ---------- */
function loadChat() {
  const s = DB.settings || {};
  if (PAGE === 'admin' || !s.chatEnabled || !s.chatKey) return;
  window._smartsupp = window._smartsupp || {}; window._smartsupp.key = s.chatKey;
  if (window.smartsupp) return;
  (function (d) {
    var s, c, o = window.smartsupp = function () { o._.push(arguments); }; o._ = [];
    s = d.getElementsByTagName('script')[0]; c = d.createElement('script');
    c.type = 'text/javascript'; c.charset = 'utf-8'; c.async = true;
    c.src = 'https://www.smartsuppchat.com/loader.js?'; s.parentNode.insertBefore(c, s);
  })(document);
}

/* ---------- site wide search ---------- */
function openSearch() {
  if ($('.search-ov')) return;
  const ov = document.createElement('div'); ov.className = 'search-ov';
  ov.innerHTML = '<div class="search-box"><div class="search-top"><input id="gq" type="search" placeholder="Search products, flavors and test runs" autocomplete="off"><button type="button" class="pop-x dark" id="gx" aria-label="Close">&times;</button></div><div class="search-res" id="gr"><p class="muted">Start typing to search.</p></div></div>';
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const close = () => { ov.remove(); document.body.style.overflow = ''; };
  $('#gx').onclick = close; ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
  const input = $('#gq'); input.focus();
  input.addEventListener('input', () => {
    const toks = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean), out = $('#gr');
    if (!toks.length) { out.innerHTML = '<p class="muted">Start typing to search.</p>'; return; }
    const hit = [];
    DB.products.forEach(p => {
      const cat = DB.categories.find(c => c.name === p.category);
      if (cat && !cat.enabled) return;
      const fl = (p.flavors || []).map(f => f.name);
      const hay = (p.name + ' ' + p.category + ' ' + fl.join(' ')).toLowerCase();
      if (toks.every(t => hay.includes(t))) {
        const m = fl.find(f => toks.some(t => f.toLowerCase().includes(t)) && !p.name.toLowerCase().includes(toks[0]));
        hit.push({ href: p.inStock ? 'product.html?id=' + encodeURIComponent(p.id) : '', img: (p.images || [])[0], name: p.name, sub: p.category + (m ? ' / ' + m : '') + (p.inStock ? '' : ' (not available)') });
      }
    });
    (DB.kits.runs || []).forEach(r => { if (toks.every(t => ('test run ' + r.name + ' ' + r.price).toLowerCase().includes(t))) hit.push({ href: 'testrun.html?id=' + r.id, img: ((DB.kits.groups || []).find(g => g.price === r.price) || {}).image, name: 'Test Run ' + r.name, sub: money(r.price) }); });
    out.innerHTML = hit.length ? hit.slice(0, 16).map(h => '<' + (h.href ? 'a href="' + esc(h.href) + '"' : 'div') + ' class="sr">' + (h.img ? '<img src="' + esc(h.img) + '" alt="">' : '<span class="ph"></span>') + '<span><b>' + esc(h.name) + '</b><small>' + esc(h.sub) + '</small></span></' + (h.href ? 'a' : 'div') + '>').join('') : '<p class="muted">Nothing found. Try another word.</p>';
  });
}

/* ---------- scroll reveal ---------- */
function initReveal(root) {
  const els = $$('.reveal-me, .sec-head, .hero-grid > div, .car, .pgrid .pcard, .kit-card, .step, .panel, .faq-item, .about-grid .prose > *, .contact-wrap .cform, .pd > div, .line, .sec-foot, .crumbs, .page-title', root || document);
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08, rootMargin: '0px 0px -30px 0px' });
  els.forEach((el, i) => {
    if (el.classList.contains('rv')) return;
    el.classList.add('rv');
    const sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    el.style.transitionDelay = Math.min(sib, 8) * 55 + 'ms';
    io.observe(el);
  });
}

/* ---------- carousel (swipe, manual, no highlight effect) ---------- */
function carousel(html) {
  return '<div class="car"><button class="car-btn prev" aria-label="Previous">' + CHEV(-1) + '</button><div class="car-track">' + html + '</div><button class="car-btn next" aria-label="Next">' + CHEV(1) + '</button></div>';
}
function initCarousels(root) {
  $$('.car', root).forEach(car => {
    const tr = $('.car-track', car), step = () => { const it = $('.car-item', tr); return it ? it.offsetWidth + 20 : 240; };
    $('.prev', car).onclick = () => tr.scrollBy({ left: -step() * 2, behavior: 'smooth' });
    $('.next', car).onclick = () => tr.scrollBy({ left: step() * 2, behavior: 'smooth' });
  });
}

/* ---------- cards ---------- */
function productCard(p, inCar) {
  const out = !p.inStock;
  const img = p.images && p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy">' : '<div class="ph"></div>';
  const inner = '<div class="pc-img">' + img + (out ? '<span class="na">Not Available</span>' : '') + '</div><span class="pc-name">' + esc(p.name) + '</span><span class="shop-btn">Shop</span>';
  const card = out ? '<div class="pcard is-out" aria-disabled="true">' + inner + '</div>' : '<a class="pcard" href="product.html?id=' + encodeURIComponent(p.id) + '">' + inner + '</a>';
  return inCar ? '<div class="car-item">' + card + '</div>' : card;
}
function categoryCard(c) {
  const img = c.image ? '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '" loading="lazy">' : '';
  const card = c.enabled ? '<a class="cat-card" href="products.html?cat=' + encodeURIComponent(c.name) + '" aria-label="' + esc(c.name) + '">' + img + '</a>' : '<div class="cat-card off" aria-disabled="true" aria-label="' + esc(c.name) + ' (coming soon)">' + img + '</div>';
  return '<div class="car-item">' + card + '</div>';
}
/* Test Runs is never faded or locked, even when switched off */
const allCategoryCards = () => DB.categories.map(categoryCard).join('');
