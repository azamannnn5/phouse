/* The P House page logic */
const P_ = {};
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
function distribute(total, names) {
  const out = {}; names.forEach(n => out[n] = 0);
  let left = total;
  if (total >= names.length) names.forEach(n => { out[n] = 1; left--; });
  while (left > 0) { out[names[rnd(names.length)]]++; left--; }
  const r = {}; Object.keys(out).forEach(k => { if (out[k] > 0) r[k] = out[k]; }); return r;
}
const orList = (arr, w) => { const a = arr.map(Number); const t = a.map(n => n + ' ' + w + (n === 1 ? '' : 's')); return t.length > 1 ? t.slice(0, -1).join(', ') + ' or ' + t[t.length - 1] : t[0]; };

/* ---------- test run helpers ---------- */
const KIT_CAT = { weed: 'Weed', carts: 'Dispos', nic: 'Nic', alcohol: 'Alcohol' };
const weedLabel = n => { const t = ((DB.pricing.weed || {}).tiers || []).find(x => Number(x.qty) === Number(n)); return t && t.label ? t.label : n + ' packs'; };
const partTitle = pt => pt.type === 'weed' ? weedLabel(pt.qty) + ' weed' : pt.type === 'carts' ? pt.qty + ' carts' : pt.type === 'nic' ? pt.qty + ' nic' : pt.qty + (Number(pt.qty) === 1 ? ' pack' : ' packs') + ' alcohol';
const brandRule = pt => pt.type === 'weed' ? orList(pt.slots, 'strain') : orList(pt.slots, 'brand');
const runGroup = r => (DB.kits.groups || []).find(g => Number(g.price) === Number(r.price));
const runAvail = r => !!(DB.kits.enabled && r && r.enabled && (!runGroup(r) || runGroup(r).enabled));
const groupAvail = g => !!(DB.kits.enabled && g.enabled);
const kitPool = pt => DB.products.filter(p => p.category === KIT_CAT[pt.type] && p.inStock);
const kitBlocks = l => (l.parts || []).map(pt => ({ h: pt.label, rows: (pt.slots || []).map(s => brandLine(s.name + (s.size ? ' ' + s.size : ''), s.picks)) }));
function kitLines(l) { const o = []; kitBlocks(l).forEach(b => { o.push(b.h + ':'); b.rows.forEach(r => o.push('  ' + r)); }); return o; }
const kitHtml = l => kitBlocks(l).map(b => '<div class="kb"><b>' + esc(b.h) + '</b>' + b.rows.map(r => '<div>' + esc(r) + '</div>').join('') + '</div>').join('');
const groupCard = (g, inCar) => {
  const card = '<a class="cat-card" href="testruns.html?g=' + g.price + '" aria-label="' + money(g.price) + ' test runs"><img src="' + esc(g.image) + '" alt="' + money(g.price) + '" loading="lazy"></a>';
  return inCar ? '<div class="car-item">' + card + '</div>' : card;
};

/* ---------- home ---------- */
P_.home = function () {
  const feat = orderedList('featured'), best = orderedList('best');
  const h = DB.pages.home;
  $('#main').innerHTML =
    '<section class="hero"><div class="wrap hero-grid"><div><h1>' + esc(h.title) + '</h1><p class="lead">' + esc(h.text) + '</p><a href="shop.html" class="btn btn-primary">' + esc(h.button) + '</a></div><div class="hero-img"><img src="assets/logo-circle.png" alt="The P House"></div></div></section>' +
    '<section class="section hairline"><div class="wrap"><div class="sec-head"><div><h2>Shop by category</h2></div></div>' + carousel(allCategoryCards()) + '<div class="sec-foot"><a class="btn btn-primary" href="shop.html">Shop category</a></div></div></section>' +
    '<section class="section hairline"><div class="wrap"><div class="sec-head"><div><h2>Featured products</h2></div></div>' + (feat.length ? carousel(feat.map(p => productCard(p, true)).join('')) : '<p class="empty">No featured products yet.</p>') + '<div class="sec-foot"><a class="btn btn-primary" href="shop.html">See products</a></div></div></section>' +
    '<section class="section hairline"><div class="wrap"><div class="sec-head"><div><h2>Best selling</h2></div></div>' + (best.length ? carousel(best.map(p => productCard(p, true)).join('')) : '<p class="empty">No best sellers yet.</p>') + '<div class="sec-foot"><a class="btn btn-primary" href="shop.html">See products</a></div></div></section>' +
    '<section class="section hairline"><div class="wrap"><div class="sec-head"><div><h2>Test Runs</h2><p>Fixed price bundles that cost less than buying each item alone.</p></div></div>' + carousel((DB.kits.groups || []).map(g => groupCard(g, true)).join('')) + '<div class="sec-foot"><a class="btn btn-primary" href="testruns.html">See test runs</a></div></div></section>' ;
  initCarousels();
};

P_.shop = function () {
  $('#main').innerHTML = '<section class="section"><div class="wrap">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html']]) + '<div class="sec-head"><div><h1 class="page-title">Shop</h1><p>Pick a category to start.</p></div></div>' + carousel(allCategoryCards()) + '</div></section>';
  initCarousels();
};

P_.products = function () {
  const cat = new URLSearchParams(location.search).get('cat') || 'Dispos';
  const c = DB.categories.find(x => x.name === cat);
  if (!c || !c.enabled) { location.replace('shop.html'); return; }
  $('#main').innerHTML = '<section class="section"><div class="wrap">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html'], [cat, '']]) + '<h1 class="page-title">' + esc(cat) + '</h1><div class="toolbar"><input class="search" id="q" type="search" placeholder="Search ' + esc(cat) + '"></div><div class="pgrid" id="grid"></div><p class="empty" id="none" hidden>No products found.</p></div></section>';
  const render = () => {
    const q = $('#q').value.trim().toLowerCase();
    const list = DB.products.filter(p => p.category === cat && p.name.toLowerCase().includes(q));
    $('#grid').innerHTML = list.map(p => productCard(p)).join(''); $('#none').hidden = list.length > 0;
  };
  $('#q').addEventListener('input', render); render();
};

/* ---------- product page ---------- */
P_.product = function () {
  const p = findProduct(new URLSearchParams(location.search).get('id'));
  const pc = p && DB.categories.find(c => c.name === p.category);
  if (!p || !p.inStock || (pc && !pc.enabled)) { location.replace('shop.html'); return; }
  const av = () => (p.flavors || []).filter(f => f.available);
  const hasFlavors = av().length > 0;
  const sel = { qty: 0, custom: false, mode: null, picks: {}, auto: false };
  let img = 0;
  const total = () => Object.values(sel.picks).reduce((a, b) => a + b, 0);
  const complete = () => sel.qty > 0 && (!hasFlavors || (sel.mode && total() === sel.qty && (sel.mode !== 'single' || Object.keys(sel.picks).length === 1)));
  const tiers = tierOptions(p), PS = priceSet(p), min = Number(PS.customMin) || 0, nn = noun(p);
  const reset = () => { sel.picks = {}; sel.mode = null; if (sel.qty === 1 && hasFlavors) sel.mode = 'single'; };
  const setQty = n => { n = Math.max(min, Math.floor(Number(n)) || min); sel.qty = n; reset(); };
  const rndPicks = mode => {
    const names = av().map(f => f.name);
    if (mode === 'single' || names.length < 2 || sel.qty < 2) { sel.mode = 'single'; sel.picks = { [names[rnd(names.length)]]: sel.qty }; }
    else { sel.mode = 'mixed'; sel.picks = distribute(sel.qty, shuffle(names).slice(0, Math.min(names.length, sel.qty, 2 + rnd(3)))); }
  };
  const lineTxt = () => esc(brandLine(itemName(p), sel.picks));
  const steps = () => {
    const out = [];
    out.push({
      key: 'qty', title: 'How many do you want?', hint: 'Pick a size. The price is shown on each one.', finish: 'Add to cart',
      body: () => '<div class="wz-opts">' + tiers.map(o => wzOpt({ act: 'tier', v: o.qty, label: esc(o.label), side: money(o.price), on: !sel.custom && sel.qty === o.qty, dis: !o.available })).join('') +
        (min > 0 ? wzOpt({ act: 'custom', label: 'Custom amount', sub: min + ' ' + unitName(p, 2) + ' or more', side: PS.customs && PS.customs.length ? 'Bulk rates' : money(PS.customRate) + ' each', on: sel.custom }) : '') + '</div>' +
        (min > 0 && sel.custom ? '<div class="cust"><div class="stepper"><button type="button" data-w="cq" data-v="-1" aria-label="Less">-</button><input id="cq" type="number" min="' + min + '" value="' + sel.qty + '" data-wc="cq" aria-label="Amount"><button type="button" data-w="cq" data-v="1" aria-label="More">+</button></div><small>' + sel.qty + ' ' + unitName(p, sel.qty) + ' - ' + money(priceFor(p, sel.qty)) + (customNote(p) ? '<br>' + customNote(p) : '') + '</small></div>' : ''),
      ok: () => sel.qty > 0 && (!sel.custom || sel.qty >= min),
      act: (a, el) => { if (a === 'tier') { sel.custom = false; sel.qty = +el.dataset.v; reset(); } else if (a === 'custom') { sel.custom = true; setQty(min); } else if (a === 'cq') setQty(sel.qty + +el.dataset.v); if (sel.auto && hasFlavors && sel.qty > 0) rndPicks(null); },
      change: (a, el) => { if (a === 'cq') { setQty(el.value); if (sel.auto && hasFlavors && sel.qty > 0) rndPicks(null); } }
    });
    if (hasFlavors && sel.qty > 1 && !sel.auto) out.push({
      key: 'mode', title: 'One ' + nn + ' or a mix?', hint: 'Pick for me chooses for you.',
      body: () => '<div class="wz-opts">' + wzOpt({ act: 'pfm', pfm: 1, label: 'Pick for me', sub: 'We choose a ' + nn + ' or a mix' }) + wzOpt({ act: 'mode', v: 'single', label: 'One ' + nn, sub: 'All ' + sel.qty + ' the same', on: sel.mode === 'single' }) + wzOpt({ act: 'mode', v: 'mixed', label: 'A mix', sub: 'Choose any combination', on: sel.mode === 'mixed' }) + '</div>',
      ok: () => !!sel.mode,
      act: (a, el) => { if (a === 'pfm') rndPicks(null); else if (a === 'mode') { if (sel.mode !== el.dataset.v) sel.picks = {}; sel.mode = el.dataset.v; } }
    });
    if (hasFlavors && sel.mode && !sel.auto) out.push({
      key: 'flv', title: sel.mode === 'single' ? 'Pick your ' + nn : 'Pick your ' + nn + 's', hint: sel.mode === 'mixed' ? 'Choose ' + sel.qty + ' in total.' : '',
      body: () => {
        const t = total(), full = t >= sel.qty;
        const list = av().map(f => sel.mode === 'single' ? wzOpt({ act: 'one', v: f.name, name: f.name, label: esc(f.name), on: !!sel.picks[f.name] }) : wzCount({ name: f.name, c: sel.picks[f.name] || 0, max: sel.qty, full }));
        return wzSearch(av().length > 6, 'Search ' + nn + 's') + (sel.mode === 'mixed' ? wzQtyBar(t, sel.qty) : '') + '<div class="wz-opts">' + wzOpt({ act: 'pfm', pfm: 1, label: 'Pick for me', sub: 'A random ' + (sel.mode === 'single' ? nn : 'mix') }) + list.join('') + '</div>';
      },
      ok: () => complete(),
      act: (a, el) => {
        if (a === 'pfm') rndPicks(sel.mode);
        else if (a === 'one') sel.picks = { [el.dataset.v]: sel.qty };
        else if (a === 'add') { if (total() < sel.qty) sel.picks[el.dataset.v] = (sel.picks[el.dataset.v] || 0) + 1; }
        else if (a === 'sub') { const n = el.dataset.v; if (sel.picks[n]) { sel.picks[n]--; if (!sel.picks[n]) delete sel.picks[n]; } }
      },
      change: (a, el) => { const n = el.dataset.v, other = total() - (sel.picks[n] || 0), v = Math.max(0, Math.min(sel.qty - other, Math.floor(Number(el.value)) || 0)); if (v) sel.picks[n] = v; else delete sel.picks[n]; }
    });
    out.push({
      key: 'review', title: 'Your order', hint: 'Check everything, then add it to your cart.', finish: 'Add to cart',
      body: () => '<div class="wz-sum"><div class="wz-row"><div><b>' + esc(itemName(p)) + '</b><small>' + (sel.custom ? sel.qty + ' ' + unitName(p, sel.qty) : esc(tierLabel(p, sel.qty))) + '</small></div><button type="button" class="wz-chg" data-w="go" data-v="qty">Change</button></div>' +
        (hasFlavors ? '<div class="wz-row"><div><b>' + (sel.mode === 'single' ? 'Your ' + nn : 'Your ' + nn + 's') + '</b><small>' + lineTxt() + '</small></div><button type="button" class="wz-chg" data-w="' + (sel.auto ? 'reroll' : 'go') + '" data-v="flv">' + (sel.auto ? 'Pick again' : 'Change') + '</button></div>' : '') +
        '<div class="wz-tot"><span>Total</span><b>' + money(priceFor(p, sel.qty)) + '</b></div></div>',
      ok: () => complete(),
      act: (a, el, api) => { if (a === 'go') api.goto(el.dataset.v); else if (a === 'reroll') rndPicks(null); }
    });
    return out;
  };
  const drawPage = () => {
    const im = p.images || [];
    $('#main').innerHTML = '<div class="wrap"><div style="padding-top:22px">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html'], [p.category, 'products.html?cat=' + encodeURIComponent(p.category)], [p.name, '']]) + '</div><div class="pd"><div><div class="pd-img">' + (im.length ? '<img src="' + esc(im[img]) + '" alt="' + esc(p.name) + '">' : '<div class="ph"></div>') + '</div>' +
      (im.length > 1 ? '<div class="thumbs">' + im.map((s, i) => '<button type="button" class="' + (i === img ? 'on' : '') + '" data-th="' + i + '"><img src="' + esc(s) + '" alt=""></button>').join('') + '</div>' : '') + '</div>' +
      '<div><span class="cat">' + esc(p.category) + '</span><h1>' + esc(p.name) + '</h1><p class="desc">' + esc(p.description || '') + '</p><div class="pl"><h3>Prices</h3><ul>' + tiers.map(o => '<li' + (o.available ? '' : ' class="off"') + '><span>' + esc(o.label) + '</span><b>' + money(o.price) + '</b></li>').join('') + (min > 0 ? '<li><span>' + min + '+ ' + unitName(p, 2) + '</span><b>' + (PS.customs && PS.customs.length ? 'Bulk rates' : money(PS.customRate) + ' each') + '</b></li>' : '') + '</ul></div>' +
      (hasFlavors ? '<p class="muted pl-n">' + av().length + ' ' + nn + (av().length === 1 ? '' : 's') + ' to choose from.</p>' : '') + '<div class="pd-btns"><button class="btn btn-primary add-btn" id="start" type="button">Create order</button>' + (hasFlavors ? '<button class="btn btn-light add-btn" id="startAuto" type="button">Create order for me</button>' : '') + '</div></div></div></div>';
  };
  drawPage();
  $('#main').addEventListener('click', e => {
    const th = e.target.closest('[data-th]'); if (th) { img = +th.dataset.th; drawPage(); return; }
    if (e.target.id === 'start' || e.target.id === 'startAuto') {
      sel.qty = 0; sel.custom = false; sel.mode = null; sel.picks = {}; sel.auto = e.target.id === 'startAuto';
      openWizard({
        title: itemName(p), steps,
        finish: () => { addToCart({ pid: p.id, qty: sel.qty, mode: sel.mode, picks: clone(sel.picks) }); return { title: 'Added to your cart', text: itemName(p) + ' is in your cart.', btns: [{ label: 'View cart', href: 'cart.html', cls: 'btn-primary' }, { label: 'Keep shopping', cls: 'btn-light' }] }; }
      });
    }
  });
};

/* ---------- test runs ---------- */
const kitIntro = () => '<p class="lead-s">' + esc(DB.kits.intro) + '</p>';
const runCard = r => {
  const ok = runAvail(r);
  return '<a class="kit-card" href="testrun.html?id=' + esc(r.id) + '"><div class="kit-top"><span class="kit-name">' + esc(r.name) + '</span><span class="kit-price">' + money(r.price) + '</span></div><ul class="kit-list">' + (r.parts || []).map(pt => '<li>' + esc(partTitle(pt)) + '</li>').join('') + '</ul><div class="kit-foot"><span class="btn btn-primary btn-sm">' + (ok ? 'Choose your picks' : 'View details') + '</span>' + (ok ? '' : '<span class="na-text">Not available</span>') + '</div></a>';
};
P_.testruns = function () {
  const k = DB.kits, gp = new URLSearchParams(location.search).get('g');
  const grp = gp && (k.groups || []).find(x => String(x.price) === gp);
  if (grp) {
    const runs = (k.runs || []).filter(r => Number(r.price) === Number(grp.price));
    $('#main').innerHTML = '<section class="section"><div class="wrap">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html'], ['Test Runs', 'testruns.html'], [money(grp.price), '']]) + '<h1 class="page-title">' + money(grp.price) + ' Test Runs</h1><p class="lead-s">' + (runs.length > 1 ? 'There are ' + runs.length + ' bundles at this price. Pick the one you like.' : 'Pick your bundle below.') + '</p>' + (groupAvail(grp) ? '' : '<p class="off-note">Not available right now. You can look, but picking is turned off.</p>') + '<div class="kit-grid">' + runs.map(runCard).join('') + '</div></div></section>';
    return;
  }
  $('#main').innerHTML = '<section class="section"><div class="wrap">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html'], ['Test Runs', '']]) + '<h1 class="page-title">Test Runs</h1>' + kitIntro() + (k.enabled ? '' : '<p class="off-note">Test Runs are not available right now. You can look around, and come back when they are back.</p>') + '<div class="kit-grid groups">' + (k.groups || []).map(g => '<div class="kit-card grp"><a href="testruns.html?g=' + g.price + '" class="grp-img"><img src="' + esc(g.image) + '" alt="' + money(g.price) + ' test runs" loading="lazy"></a><div class="kit-foot"><a class="btn btn-primary btn-sm" href="testruns.html?g=' + g.price + '">See ' + money(g.price) + ' test runs</a>' + (groupAvail(g) ? '' : '<span class="na-text">Not available</span>') + '</div></div>').join('') + '</div></div></section>';
};

P_.testrun = function () {
  const r = findRun(new URLSearchParams(location.search).get('id'));
  if (!r) { location.replace('testruns.html'); return; }
  const avail = runAvail(r);
  const S = (r.parts || []).map(pt => ({ n: pt.slots.length === 1 ? pt.slots[0] : 0, items: [] }));
  const initItems = s => { s.items = Array.from({ length: s.n }, () => ({ pid: '', picks: {} })); };
  S.forEach(initItems);
  const prod = id => findProduct(id);
  const shareOf = (pt, s, it) => { const per = pt.qty / s.n; if (pt.type === 'alcohol') return per * ((prod(it.pid) || {}).packSize || 12); return per; };
  const shareText = (pt, s, it) => pt.type === 'weed' ? weedLabel(pt.qty / s.n) : pt.type === 'alcohol' ? (pt.qty / s.n) + (pt.qty / s.n === 1 ? ' pack' : ' packs') + (it.pid ? ' (' + shareOf(pt, s, it) + ' bottles)' : '') : (pt.qty / s.n) + (pt.type === 'carts' ? ' carts' : ' nic');
  const flv = pr => (pr.flavors || []).filter(f => f.available);
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const itemOk = (pt, s, it) => {
    const pr = prod(it.pid); if (!pr) return false;
    if (!flv(pr).length) return true;
    const need = shareOf(pt, s, it);
    return pt.type === 'weed' ? (Object.keys(it.picks).length === 1 && sum(it.picks) === need) : sum(it.picks) === need;
  };
  const partOk = (pt, s) => s.n > 0 && s.items.length === s.n && s.items.every(it => itemOk(pt, s, it)) && new Set(s.items.map(i => i.pid)).size === s.n;
  const allOk = () => r.parts.every((pt, i) => partOk(pt, S[i]));
  const setN = (i, n) => { S[i].n = n; initItems(S[i]); };
  const randItemPicks = (pt, s, it) => {
    const pr = prod(it.pid), fl = flv(pr).map(f => f.name); it.picks = {};
    if (!fl.length) return; const need = shareOf(pt, s, it);
    if (pt.type === 'weed') { it.picks = { [fl[rnd(fl.length)]]: need }; return; }
    const single = fl.length === 1 || Math.random() < .35;
    it.picks = single ? { [fl[rnd(fl.length)]]: need } : distribute(need, shuffle(fl).slice(0, Math.min(fl.length, need, 2 + rnd(3))));
  };
  const randPart = i => {
    const pt = r.parts[i], pool = kitPool(pt); if (!pool.length) return;
    const opts = pt.slots.filter(n => n <= pool.length); if (!opts.length) return;
    setN(i, opts[rnd(opts.length)]);
    const brands = wpickN(pool, S[i].n);
    S[i].items.forEach((it, j) => { it.pid = brands[j].id; randItemPicks(pt, S[i], it); });
  };
  const word = pt => pt.type === 'weed' ? 'weed' : pt.type === 'carts' ? 'carts' : pt.type === 'nic' ? 'nic' : 'alcohol';
  const steps = () => {
    const out = [];
    r.parts.forEach((pt, i) => {
      const s = S[i], multi = pt.slots.length > 1, t = partTitle(pt);
      if (multi) out.push({
        key: 'c' + i, title: 'How many brands for your ' + word(pt) + '?', hint: esc(t) + '. You can choose ' + esc(brandRule(pt).replace('strain', 'brand')) + '. Everything is split evenly.',
        body: () => '<div class="wz-opts">' + wzOpt({ act: 'pfm', pfm: 1, label: 'Pick for me', sub: 'We choose the brands and the ' + (pt.type === 'weed' ? 'strains' : 'flavors') }) + pt.slots.map(n => wzOpt({ act: 'n', v: n, label: n + (n > 1 ? ' brands' : ' brand'), sub: pt.type === 'weed' ? n === 1 ? 'All in one strain' : weedLabel(pt.qty / n) + ' each' : (pt.qty / n) + ' each', on: s.n === n })).join('') + '</div>',
        ok: () => s.n > 0,
        act: (a, el) => { if (a === 'pfm') randPart(i); else if (a === 'n') { if (s.n !== +el.dataset.v) setN(i, +el.dataset.v); } }
      });
      for (let j = 0; j < s.n; j++) {
        const it = s.items[j], pool = kitPool(pt), lab = (s.n > 1 ? ' ' + (j + 1) + ' of ' + s.n : '');
        out.push({
          key: 'b' + i + '_' + j, title: 'Pick your ' + word(pt) + ' brand' + lab, hint: esc(t) + ': ' + esc(shareText(pt, s, it)) + (s.n > 1 ? ' from this brand' : ''),
          body: () => {
            const taken = s.items.map((x, jj) => jj !== j ? x.pid : '').filter(Boolean);
            return wzSearch(pool.length > 6, 'Search brands') + '<div class="wz-opts">' + wzOpt({ act: 'pfm', pfm: 1, label: 'Pick for me', sub: 'We choose a brand and what you get' }) + pool.map(p => wzOpt({ act: 'brand', v: p.id, name: p.name, label: esc(p.name), on: p.id === it.pid, dis: taken.includes(p.id) })).join('') + '</div>';
          },
          ok: () => !!it.pid,
          act: (a, el) => {
            if (a === 'pfm') { const taken = s.items.map((x, jj) => jj !== j ? x.pid : '').filter(Boolean); const b = wpickN(pool.filter(p => !taken.includes(p.id)), 1)[0]; if (b) { it.pid = b.id; randItemPicks(pt, s, it); } }
            else if (a === 'brand') { if (it.pid !== el.dataset.v) { it.pid = el.dataset.v; it.picks = {}; } }
          }
        });
        const pr = prod(it.pid);
        if (pr && flv(pr).length) {
          const need = shareOf(pt, s, it), nnn = noun(pr);
          out.push({
            key: 'f' + i + '_' + j, title: pt.type === 'weed' ? 'Pick your strain from ' + pr.name : 'Pick your ' + nnn + 's from ' + pr.name, hint: pt.type === 'weed' ? esc(shareText(pt, s, it)) + '. Choose one strain.' : 'Choose ' + need + ' in total.',
            body: () => {
              const have = sum(it.picks);
              const list = flv(pr).map(f => pt.type === 'weed' ? wzOpt({ act: 'one', v: f.name, name: f.name, label: esc(f.name), on: !!it.picks[f.name] }) : wzCount({ name: f.name, c: it.picks[f.name] || 0, max: need, full: have >= need }));
              return wzSearch(flv(pr).length > 6, 'Search ' + nnn + 's') + (pt.type === 'weed' ? '' : wzQtyBar(have, need)) + '<div class="wz-opts">' + wzOpt({ act: 'pfm', pfm: 1, label: 'Pick for me', sub: 'A random ' + (pt.type === 'weed' ? 'strain' : 'mix') }) + list.join('') + '</div>';
            },
            ok: () => itemOk(pt, s, it),
            act: (a, el) => {
              if (a === 'pfm') randItemPicks(pt, s, it);
              else if (a === 'one') it.picks = { [el.dataset.v]: need };
              else if (a === 'add') { if (sum(it.picks) < need) it.picks[el.dataset.v] = (it.picks[el.dataset.v] || 0) + 1; }
              else if (a === 'sub') { const n = el.dataset.v; if (it.picks[n]) { it.picks[n]--; if (!it.picks[n]) delete it.picks[n]; } }
            },
            change: (a, el) => { const n = el.dataset.v, other = sum(it.picks) - (it.picks[n] || 0), v = Math.max(0, Math.min(need - other, Math.floor(Number(el.value)) || 0)); if (v) it.picks[n] = v; else delete it.picks[n]; }
          });
        }
      }
    });
    out.push({
      key: 'review', title: 'Your Test Run', hint: 'Check everything, then add it to your cart.', finish: 'Add to cart',
      body: () => '<div class="wz-sum"><div class="wz-row"><div><b>' + esc(r.name) + '</b><small>Test Run</small></div></div>' + r.parts.map((pt, i) => {
        const items = S[i].items.filter(it => it.pid).map(it => esc(brandLine(prod(it.pid).name, it.picks)));
        return '<div class="wz-row"><div><b>' + esc(partTitle(pt)) + '</b><small>' + (items.length ? items.join('<br>') : 'Not chosen yet') + '</small></div><button type="button" class="wz-chg" data-w="go" data-v="' + (pt.slots.length > 1 ? 'c' + i : 'b' + i + '_0') + '">Change</button></div>';
      }).join('') + '<div class="wz-tot"><span>Total</span><b>' + money(r.price) + '</b></div></div>',
      ok: () => allOk(),
      act: (a, el, api) => { if (a === 'go') api.goto(el.dataset.v); }
    });
    return out;
  };
  const reset = () => { r.parts.forEach((pt, i) => setN(i, pt.slots.length === 1 ? pt.slots[0] : 0)); };
  const launch = last => openWizard({
    title: r.name, steps, start: last ? 'last' : 0,
    finish: () => {
      addToCart({ kit: true, kid: r.id, parts: r.parts.map((pt, i) => ({ type: pt.type, label: partTitle(pt), slots: S[i].items.map(it => { const pr = prod(it.pid); return { pid: it.pid, name: pr.name, size: pr.sizeTag || '', picks: clone(it.picks) }; }) })) });
      reset(); return { title: 'Added to your cart', text: r.name + ' is in your cart.', btns: [{ label: 'View cart', href: 'cart.html', cls: 'btn-primary' }, { label: 'Keep shopping', cls: 'btn-light' }] };
    },
    onClose: () => {}
  });
  $('#main').innerHTML = '<section class="section"><div class="wrap narrow-w">' + crumbs([['Home', 'index.html'], ['Shop', 'shop.html'], ['Test Runs', 'testruns.html'], [money(r.price), 'testruns.html?g=' + r.price], [r.name, '']]) + '<span class="cat">Test Run</span><h1 class="page-title">' + esc(r.name) + '</h1><p class="kit-price-l">' + money(r.price) + '</p>' + (avail ? '' : '<p class="off-note">Not available right now. You can look, but ordering is turned off.</p>') +
    '<div class="kit-inc"><h3>What is in the box</h3><ul>' + r.parts.map(pt => '<li>' + esc(partTitle(pt)) + '<small>You can choose ' + esc(brandRule(pt)) + '</small></li>').join('') + '</ul></div>' +
    '<div class="kit-act"><button type="button" class="btn btn-primary" id="kstart"' + (avail ? '' : ' disabled') + '>Create order</button><button type="button" class="btn btn-light" id="kall"' + (avail ? '' : ' disabled') + '>Pick everything for me</button></div></div></section>';
  $('#kstart').onclick = () => { if (avail) { reset(); launch(false); } };
  $('#kall').onclick = () => { if (!avail) return; reset(); r.parts.forEach((pt, i) => randPart(i)); launch(true); };
};

/* ---------- cart ---------- */
P_.cart = function () {
  const F = DB.form;
  const state = { name: '', phone: '', loc: '', timeMode: 'asap', time: '', pay: '', code: '', notes: '' };
  const saved = store.get('pph_form'); if (saved) Object.assign(state, saved);
  const keep = () => store.set('pph_form', state);
  const flavorLines = l => Object.entries(l.picks || {}).map(([n, c]) => n + ' x' + c);
  const kitOk = l => runAvail(lineRun(l));
  const draw = () => {
    CART = CART.filter(lineValid); saveCart();
    if (!CART.length) { $('#main').innerHTML = '<section class="section"><div class="wrap">' + crumbs([['Home', 'index.html'], ['Cart', '']]) + '<h1 class="page-title">Your cart</h1><div class="cart-empty"><p>Your cart is empty.</p><a class="btn btn-primary" href="shop.html">Start shopping</a></div></div></section>'; return; }
    const sub = cartSubtotal();
    $('#main').innerHTML = '<section class="section"><div class="wrap narrow-w">' + crumbs([['Home', 'index.html'], ['Cart', '']]) + '<h1 class="page-title" style="margin-bottom:24px">Your cart</h1><div class="panel"><div id="lines"></div><div class="sum"><div class="row total"><span>Subtotal</span><span>' + fmt(sub) + '</span></div></div></div><p class="pay-note">' + esc(F.payNote) + '</p><div class="btn-row"><button class="btn btn-primary" id="place" type="button">Place order</button><a class="btn btn-light" href="shop.html">Keep shopping</a><button class="btn btn-ghost" id="clearCart" type="button">Clear cart</button></div><p class="note" id="msg"></p></div></section>';
    drawLines();
  };
  const drawLines = () => {
    $('#lines').innerHTML = CART.map((l, i) => {
      if (l.kit) {
        const r = lineRun(l), ok = kitOk(l), g = runGroup(r);
        return '<div class="line"><div class="th">' + (g && g.image ? '<img src="' + esc(g.image) + '" alt="">' : '') + '</div><div><div class="l-name">Test Run: ' + esc(r.name) + '</div><div class="l-meta">' + money(r.price) + (ok ? '' : ' - Not available right now') + '</div><div class="l-fl">' + kitHtml(l) + '</div></div><div class="l-side">' + fmt(r.price) + '<button class="rm" data-rm="' + i + '">Remove</button></div></div>';
      }
      const p = findProduct(l.pid), fl = flavorLines(l);
      return '<div class="line"><div class="th">' + (p.images && p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div><div><div class="l-name">' + esc(itemName(p)) + '</div><div class="l-meta">' + esc(tierLabel(p, l.qty)) + ' - ' + money(linePrice(l)) + '</div>' + (fl.length ? '<div class="l-fl"><div>' + esc(fl.join(' + ')) + '</div></div>' : '') + '</div><div class="l-side">' + fmt(linePrice(l)) + '<button class="rm" data-rm="' + i + '">Remove</button></div></div>';
    }).join('');
  };
  const niceTime = s => { const [h, m] = s.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM'); };
  const timeText = () => state.timeMode === 'later' && state.time ? niceTime(state.time) : F.time.asap;
  const disc = () => { const sub = cartSubtotal(); return { sub, d: computeDiscount(sub, cartEligible(), state.pay, F.code.on ? state.code : '') }; };
  const orderText = () => {
    const { sub, d } = disc();
    const items = CART.map(l => {
      if (l.kit) { const r = lineRun(l); return '- Test Run: ' + r.name + ' | ' + fmt(r.price) + '\n' + kitLines(l).map(x => '    ' + x).join('\n'); }
      const p = findProduct(l.pid), fl = flavorLines(l); return '- ' + itemName(p) + ' | ' + tierLabel(p, l.qty) + ' | ' + fmt(linePrice(l)) + (fl.length ? '\n    ' + fl.join(' + ') : '');
    }).join('\n');
    return 'NEW ORDER REQUEST, THE P HOUSE\n\nItems:\n' + items + '\n\nSubtotal: ' + fmt(sub) + (d.percent ? '\nDiscount: ' + d.label + ' (' + d.percent + '%) -' + fmt(d.amount) : '') + '\nTotal: ' + fmt(sub - d.amount) + '\n\nName: ' + state.name + '\nPhone: ' + state.phone + '\nDelivery location: ' + state.loc + (F.time.on ? '\nDelivery time: ' + timeText() : '') + '\nPayment method: ' + state.pay + ' (payment before delivery)' + (F.code.on && state.code.trim() ? '\nPromo code: ' + state.code.trim() : '') + (F.notes.on && state.notes.trim() ? '\nNotes: ' + state.notes.trim() : '');
  };
  const fieldHtml = (id, label, type, val, extra) => '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + type + '" value="' + esc(val) + '" data-wi="' + id + '"' + (extra || '') + '></div>';
  const steps = () => {
    const out = [];
    out.push({
      key: 'who', title: 'Who is this order for?', hint: 'We use this to reach you about your order.',
      body: () => fieldHtml('f-name', F.name.label, 'text', state.name, ' autocomplete="name"') + fieldHtml('f-phone', F.phone.label, 'tel', state.phone, ' autocomplete="tel"'),
      ok: () => !!state.name.trim() && !!state.phone.trim(),
      input: el => { if (el.id === 'f-name') state.name = el.value; else if (el.id === 'f-phone') state.phone = el.value; keep(); }
    });
    out.push({
      key: 'where', title: 'Where should we deliver?', hint: F.time.on ? '' : '',
      body: () => fieldHtml('f-loc', F.loc.label, 'text', state.loc, ' autocomplete="street-address"') + (F.time.on ? '<div class="field"><label>' + esc(F.time.label) + '</label><div class="wz-opts">' + wzOpt({ act: 'asap', label: esc(F.time.asap), on: state.timeMode === 'asap' }) + wzOpt({ act: 'later', label: esc(F.time.later), on: state.timeMode === 'later' }) + '</div></div>' + (state.timeMode === 'later' ? '<div class="field" style="margin-top:12px"><label for="f-time">Time</label><input id="f-time" type="time" value="' + esc(state.time) + '" data-wi="t"></div>' : '') : ''),
      ok: () => !!state.loc.trim() && (!F.time.on || state.timeMode === 'asap' || !!state.time),
      input: el => { if (el.id === 'f-loc') state.loc = el.value; else if (el.id === 'f-time') state.time = el.value; keep(); },
      act: a => { if (a === 'asap' || a === 'later') { state.timeMode = a; keep(); } }
    });
    if (F.code.on || F.notes.on) out.push({
      key: 'extra', title: 'Anything else?', hint: 'Both are optional. You can skip this step.',
      body: () => (F.code.on ? fieldHtml('f-code', F.code.label, 'text', state.code, ' autocomplete="off"') + '<p class="note" id="codeMsg" style="margin:-6px 0 14px"></p>' : '') + (F.notes.on ? '<div class="field"><label for="f-notes">' + esc(F.notes.label) + '</label><textarea id="f-notes" rows="3" data-wi="n">' + esc(state.notes) + '</textarea></div>' : ''),
      ok: () => true,
      input: el => { if (el.id === 'f-code') { state.code = el.value; const d = disc().d, cm = document.getElementById('codeMsg'); if (cm) { cm.textContent = d.codeMsg || ''; cm.className = 'note' + (state.code.trim() && !d.codeOk ? ' bad' : ''); } } else if (el.id === 'f-notes') state.notes = el.value; keep(); }
    });
    out.push({
      key: 'pay', title: 'How will you pay?', hint: 'Payment is made before delivery.',
      body: () => {
        const sub = cartSubtotal();
        const m = (DB.payments || []).find(x => x.name === state.pay); if (m && (!m.enabled || sub < (Number(m.minOrder) || 0))) state.pay = '';
        return '<div class="wz-opts">' + (DB.payments || []).filter(x => x.enabled).map(x => {
          const dis = sub < (Number(x.minOrder) || 0), promo = (DB.promos || []).find(pr => pr.active && pr.type === 'payment' && pr.payment === x.name);
          const note = x.note ? x.note + (dis ? ' (orders of ' + fmt(x.minOrder) + ' or more)' : '') : (dis ? 'Orders of ' + fmt(x.minOrder) + ' or more' : '');
          return wzOpt({ act: 'pay', v: x.name, label: esc(x.name), sub: esc(note), side: promo && !dis ? esc(promo.percent) + '% off' : '', on: state.pay === x.name, dis });
        }).join('') + '</div>';
      },
      ok: () => !!state.pay, act: (a, el) => { if (a === 'pay') { state.pay = el.dataset.v; keep(); } }
    });
    out.push({
      key: 'review', title: 'Check your order', hint: esc(F.payNote), finish: 'Send order on WhatsApp',
      body: () => {
        const { sub, d } = disc();
        const lines = CART.map(l => { if (l.kit) { const r = lineRun(l); return '<div class="wz-row"><div><b>Test Run: ' + esc(r.name) + '</b><small>' + kitBlocks(l).map(b => '<b class="kh">' + esc(b.h) + '</b>' + b.rows.map(esc).join('<br>')).join('<br>') + '</small></div><b>' + fmt(r.price) + '</b></div>'; } const p = findProduct(l.pid), fl = flavorLines(l); return '<div class="wz-row"><div><b>' + esc(itemName(p)) + '</b><small>' + esc(tierLabel(p, l.qty)) + (fl.length ? '<br>' + esc(fl.join(' + ')) : '') + '</small></div><b>' + fmt(linePrice(l)) + '</b></div>'; }).join('');
        const info = (label, val, key) => '<div class="wz-row"><div><b>' + label + '</b><small>' + esc(val) + '</small></div><button type="button" class="wz-chg" data-w="go" data-v="' + key + '">Change</button></div>';
        return '<div class="wz-sum">' + lines + '<div class="wz-row line-t"><div><b>Subtotal</b></div><b>' + fmt(sub) + '</b></div>' + (d.percent ? '<div class="wz-row"><div><b>' + esc(d.label) + ' (' + d.percent + '%)</b></div><b>-' + fmt(d.amount) + '</b></div>' : '') + '<div class="wz-tot"><span>Total</span><b>' + fmt(sub - d.amount) + '</b></div></div>' +
          '<div class="wz-sum">' + info('Name and phone', state.name + ', ' + state.phone, 'who') + info('Delivery', state.loc + (F.time.on ? ', ' + timeText() : ''), 'where') + info('Payment', state.pay, 'pay') + '</div>';
      },
      ok: () => true, act: (a, el, api) => { if (a === 'go') api.goto(el.dataset.v); }
    });
    return out;
  };
  const finish = () => {
    if (CART.some(l => l.kit && !kitOk(l))) return { title: 'Cannot send yet', text: 'A Test Run in your cart is not available right now. Remove it from your cart and try again.', btns: [{ label: 'Close', cls: 'btn-primary' }] };
    const num = ((DB.settings || {}).whatsapp || '').replace(/\D/g, '');
    if (!num) return { title: 'WhatsApp is not set up', text: 'Please try again later.', btns: [{ label: 'Close', cls: 'btn-primary' }] };
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(orderText()), '_blank');
    return { title: 'Your order is ready in WhatsApp', text: 'Press send in WhatsApp. We reply with payment details. If WhatsApp did not open, press the button again.', btns: [{ label: 'Open WhatsApp again', cls: 'btn-primary', href: 'https://wa.me/' + num + '?text=' + encodeURIComponent(orderText()) }, { label: 'Close', cls: 'btn-light' }] };
  };
  draw();
  $('#main').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'); if (rm) { CART.splice(+rm.dataset.rm, 1); saveCart(); draw(); return; }
    if (e.target.id === 'clearCart') { if (confirm('Remove everything from your cart?')) { CART = []; saveCart(); draw(); } return; }
    if (e.target.id === 'place') {
      if (CART.some(l => l.kit && !kitOk(l))) { const m = $('#msg'); m.className = 'note bad'; m.textContent = 'Remove the Test Runs that are not available before ordering.'; return; }
      openWizard({ title: 'Your order', steps, finish });
    }
  });
};

/* ---------- about, faq, contact ---------- */
P_.about = function () {
  const a = DB.pages.about;
  const body = (a.sections || []).map((s, i) => (s.h ? '<h2>' + esc(s.h) + '</h2>' : '') + '<p>' + esc(s.p) + '</p>').join('');
  $('#main').innerHTML = '<section class="wrap">' + '<div style="padding-top:22px">' + crumbs([['Home', 'index.html'], ['About', '']]) + '</div><div class="about-grid prose"><div><h1 class="page-title">' + esc(a.title) + '</h1>' + body + '</div><div><img src="assets/logo-circle.png" alt="The P House"></div></div></section>';
};
P_.faq = function () {
  $('#main').innerHTML = '<section class="section"><div class="narrow">' + crumbs([['Home', 'index.html'], ['FAQ', '']]) + '<h1 class="page-title">Frequently asked questions</h1><p class="lead-s">Quick answers about ordering, payment and delivery.</p><div class="faq">' + (DB.pages.faq || []).map(f => '<details class="faq-item"><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</div><div class="btn-row" style="margin-top:28px"><a class="btn btn-primary" href="contact.html">Still have a question? Contact us</a></div></div></section>';
};
P_.contact = function () {
  $('#main').innerHTML = '<section class="contact-wrap"><form id="cf" class="cform"><img class="lg" src="assets/logo-wordmark-white.png" alt="The P House"><h1>Contact us</h1><p class="sub">Questions about an order or a product? Send us a message.</p><div class="field"><label for="c-n">Name</label><input id="c-n" type="text" required></div><div class="field"><label for="c-p">Phone number</label><input id="c-p" type="tel" required></div><div class="field"><label for="c-m">Message</label><textarea id="c-m" rows="4" required></textarea></div><button class="btn" type="submit">Send on WhatsApp</button><p class="note" id="c-msg"></p>' + socialLinks('light center') + '</form></section>';
  $('#cf').addEventListener('submit', e => {
    e.preventDefault();
    const num = ((DB.settings || {}).whatsapp || '').replace(/\D/g, ''), m = $('#c-msg');
    if (!num) { m.className = 'note bad'; m.textContent = 'WhatsApp is not set up yet.'; return; }
    const t = 'Message from ' + $('#c-n').value + ' (' + $('#c-p').value + '):\n' + $('#c-m').value;
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(t), '_blank'); m.className = 'note'; m.textContent = 'Opening WhatsApp.';
  });
};

/* ---------- start ---------- */
if (PAGE !== 'admin') {
  READY.then(() => {
    renderLayout();
    if (P_[PAGE]) P_[PAGE]();
    initReveal();
    loadChat();
    ageGate().then(runPopups);
  });
}
