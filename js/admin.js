/* The P House admin: talks to the site functions (falls back to this browser when no backend is present) */
const A = { sec: 'products', ed: null, isNew: false, ps: 'dispos', q: '', cat: '', user: null, open: {} };
const SECS = [
  ['products', 'Products', 'Add, edit and remove the products customers can order.'],
  ['featured', 'Featured and best sellers', 'Tick which products show in Featured products and Best selling on the home page.'],
  ['categories', 'Categories', 'Show or hide the shop categories and change their pictures.'],
  ['testruns', 'Test Runs', 'Turn Test Runs on or off and manage the bundles, prices and rules.'],
  ['promos', 'Promos and pop-ups', 'Discount codes, banner messages and pop-ups. Discount numbers here change the real prices.'],
  ['pricing', 'Pricing', 'Quantity prices and bulk rates for each price list.'],
  ['payments', 'Payments', 'Turn payment methods on or off. A method that is off is hidden from customers.'],
  ['orderform', 'Order form', 'Change what customers fill in when they place an order.'],
  ['pages', 'Pages and text', 'Edit the text on the Home, About and FAQ pages.'],
  ['contact', 'Contact and links', 'Order number and the social links shown in the footer and contact page.'],
  ['settings', 'Settings', 'Live chat, footer text, password and backup.']
];
const PSN = { dispos: 'Dispos and Nic', weed: 'Weed' };
const psName = k => PSN[k] || (DB.pricing[k] && DB.pricing[k].name) || k;
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/* ---------- storage / auth ---------- */
const TOK_KEY = 'pph_admin_tok';
async function api(name, body, tok) {
  const r = await fetch(API + name, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && tok) { sess.del(TOK_KEY); throw new Error(j.error || 'Signed out. Reload and sign in again.'); }
  if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
  return j;
}
function getToken() { const s = sess.get(TOK_KEY); if (!s || s.exp < Date.now()) throw new Error('Session expired. Reload and sign in again.'); return s.token; }
let saveTimer = null, saving = 0;
function setStatus(t, bad) { ['#status', '#status2'].forEach(s => { const e = $(s); if (e) { e.textContent = t; e.className = 'status' + (bad ? ' bad' : ''); } }); }
function persist() { setStatus('Saving...'); clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 500); }
async function doSave() {
  saving++;
  try {
    if (SB) {
      await api('admin-save', { data: DB }, getToken());
      store.set(CACHE_KEY, DB);
    } else if (!store.set(LOCAL_KEY, DB)) throw new Error('Browser storage is full. Remove large pictures.');
    setStatus('All changes saved');
  } catch (e) { setStatus('Not saved: ' + e.message, true); } finally { saving--; }
}
window.addEventListener('beforeunload', e => { if (saving) { e.preventDefault(); e.returnValue = ''; } });

/* image upload: resize in the browser, then Supabase storage (or a data URL in local mode) */
function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image(); im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(b => res({ blob: b, dataUrl: c.toDataURL('image/jpeg', .85) }), 'image/jpeg', .85);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function blobB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); }); }
async function uploadImage(file, folder) {
  const out = await resizeImage(file, 1000);
  if (!SB) return out.dataUrl;
  const j = await api('admin-upload', { folder, contentType: 'image/jpeg', contentBase64: await blobB64(out.blob) }, getToken());
  return j.url;
}

/* ---------- small ui helpers ---------- */
const root = el => (el.dataset.root === 'e' ? A.ed : DB);
const rootAttr = r => (r === 'e' ? ' data-root="e"' : '');
const tg = (path, label, o) => { o = o || {}; const r = o.root; return '<label class="sw' + (o.dis ? ' dis' : '') + '"><input type="checkbox"' + (o.dis ? ' disabled' : '') + ' data-path="' + path + '" data-type="bool"' + rootAttr(r) + (o.re ? ' data-re="1"' : '') + ((getPath(r === 'e' ? A.ed : DB, path)) ? ' checked' : '') + '><i></i><span>' + esc(label) + '</span></label>'; };
const fld = (path, label, o) => {
  o = o || {}; const r = o.root, v = getPath(r === 'e' ? A.ed : DB, path), t = o.type || 'text';
  const attrs = ' data-path="' + path + '" data-type="' + (o.dt || (t === 'number' ? 'num' : 'str')) + '"' + rootAttr(r) + (o.re ? ' data-re="1"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (t === 'number' ? ' step="any"' : '');
  const val = o.dt === 'list' ? (v || []).join(', ') : v;
  return '<div class="f"><label>' + esc(label) + '</label>' + (t === 'area' ? '<textarea rows="' + (o.rows || 3) + '"' + attrs + '>' + esc(val) + '</textarea>' : '<input type="' + t + '"' + attrs + ' value="' + esc(val) + '">') + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</div>';
};
const slt = (path, label, opts, o) => { o = o || {}; const r = o.root, v = getPath(r === 'e' ? A.ed : DB, path); return '<div class="f"><label>' + esc(label) + '</label><select data-path="' + path + '" data-type="' + (o.dt || 'str') + '"' + rootAttr(r) + (o.re ? ' data-re="1"' : '') + '>' + opts.map(x => '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(v) ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select>' + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</div>'; };
const imgf = (path, label, o) => { o = o || {}; const v = getPath(o.root === 'e' ? A.ed : DB, path); return '<div class="f"><label>' + esc(label) + '</label><div class="imgf"><div class="pv">' + (v ? '<img src="' + esc(v) + '" alt="">' : '') + '</div><label class="btn btn-light btn-sm up">Upload picture<input type="file" accept="image/*" data-up="' + path + '"' + rootAttr(o.root) + ' hidden></label></div></div>'; };
const card = (title, desc, body, actions) => '<section class="card"><div class="card-h"><div><h3>' + esc(title) + '</h3>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '</div>' + (actions || '') + '</div>' + body + '</section>';
const btn = (act, label, extra, cls) => '<button type="button" class="btn ' + (cls || 'btn-light') + ' btn-sm" data-act="' + act + '"' + (extra || '') + '>' + label + '</button>';
const xbtn = (act, extra) => '<button type="button" class="x" data-act="' + act + '"' + (extra || '') + ' aria-label="Remove" title="Remove">&times;</button>';

/* ---------- ordering (drag a handle, or use the arrows) ---------- */
const stl = (key, i) => '<span class="stl"><span class="grip" data-grip="1" title="Drag to reorder" aria-label="Drag to reorder"></span><button type="button" class="mv" data-act="mv" data-k="' + key + '" data-i="' + i + '" data-d="-1" aria-label="Move up">&#9650;</button><button type="button" class="mv" data-act="mv" data-k="' + key + '" data-i="' + i + '" data-d="1" aria-label="Move down">&#9660;</button></span>';
const srt = (key, html, cls) => '<div class="srt' + (cls ? ' ' + cls : '') + '" data-srt="' + key + '">' + html + '</div>';
const arrSorter = get => ({ apply: order => { const a = get(), c = a.slice(); a.splice(0, a.length, ...order.map(n => c[+n])); } });
const SORT = {
  categories: arrSorter(() => DB.categories), groups: arrSorter(() => DB.kits.groups), runs: arrSorter(() => DB.kits.runs),
  faq: arrSorter(() => DB.pages.faq), sections: arrSorter(() => DB.pages.about.sections), payments: arrSorter(() => DB.payments),
  banner: arrSorter(() => DB.banner), promos: arrSorter(() => DB.promos), popups: arrSorter(() => DB.popups), links: arrSorter(() => DB.settings.links),
  products: { apply: order => { const pos = order.map(Number).sort((a, b) => a - b), old = DB.products.slice(); order.forEach((g, k) => { DB.products[pos[k]] = old[+g]; }); } },
  featured: { apply: order => { DB.order.featured = order.slice(); } },
  best: { apply: order => { DB.order.best = order.slice(); } }
};
function applySort(key, order) { if (SORT[key]) { SORT[key].apply(order); persist(); drawSec(); } }
const rowsOf = box => Array.from(box.children).filter(c => c.dataset.sr != null);

/* ---------- sections ---------- */
const S = {};
S.products = () => {
  const q = A.q.toLowerCase();
  const list = DB.products.map((p, i) => [p, i]).filter(([p]) => (!A.cat || p.category === A.cat) && (!q || p.name.toLowerCase().includes(q)));
  return card('Products', DB.products.length + ' products. Switch a product off to show it as not available.',
    '<div class="bar-row"><input class="search-a" id="pq" type="search" placeholder="Search products" value="' + esc(A.q) + '"><select id="pcat"><option value="">All categories</option>' + DB.categories.map(c => '<option' + (A.cat === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' + (A.cat && !A.q ? '<p class="hint-l" style="margin:-6px 0 12px">Drag the handle or use the arrows to set the order customers see in ' + esc(A.cat) + '.</p>' : '<p class="hint-l" style="margin:-6px 0 12px">Choose a category above to change the order of its products.</p>') + '<div class="rows"' + (A.cat && !A.q ? ' data-srt="products"' : '') + '>' +
    (list.length ? list.map(([p, i]) => '<div class="row-i"' + (A.cat && !A.q ? ' data-sr="' + i + '"' : '') + '>' + (A.cat && !A.q ? stl('products', i) : '') + '<div class="th">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div><div class="nm"><b>' + esc(p.name) + '</b><small>' + esc(p.category) + ' / ' + (p.flavors || []).length + ' flavors</small></div><div class="rt">' + tg('products.' + i + '.inStock', 'In stock') + btn('editprod', 'Edit', ' data-i="' + i + '"') + btn('delprod', 'Delete', ' data-i="' + i + '"', 'btn-danger') + '</div></div>').join('') : '<p class="empty-a">No products found.</p>') + '</div>',
    btn('addprod', 'Add product', '', 'btn-primary'));
};
const featTick = () => {
  const q = A.q.toLowerCase();
  const list = DB.products.map((p, i) => [p, i]).filter(([p]) => (!A.cat || p.category === A.cat) && (!q || p.name.toLowerCase().includes(q)));
  const nf = DB.products.filter(p => p.featured).length, nb = DB.products.filter(p => p.best).length;
  return card('Featured and best sellers', nf + ' featured and ' + nb + ' best sellers. Best sellers are also picked more often when a customer taps Pick for me.',
    '<div class="bar-row"><input class="search-a" id="pq" type="search" placeholder="Search products" value="' + esc(A.q) + '"><select id="pcat"><option value="">All categories</option>' + DB.categories.map(c => '<option' + (A.cat === c.name ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
    '<div class="chk-head"><span>Product</span><span>Featured</span><span>Best selling</span></div><div class="rows">' +
    (list.length ? list.map(([p, i]) => '<div class="row-i chk-row"><div class="th">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div><div class="nm"><b>' + esc(p.name) + '</b><small>' + esc(p.category) + '</small></div><label class="chk"><input type="checkbox" data-path="products.' + i + '.featured" data-type="bool" data-re="1"' + (p.featured ? ' checked' : '') + '><span>Featured</span></label><label class="chk"><input type="checkbox" data-path="products.' + i + '.best" data-type="bool" data-re="1"' + (p.best ? ' checked' : '') + '><span>Best selling</span></label></div>').join('') : '<p class="empty-a">No products found.</p>') + '</div>');
};
const ordCard = (key, title, desc) => {
  const list = orderedList(key);
  return card(title, desc, list.length ? srt(key, list.map(p => '<div class="row-i" data-sr="' + esc(p.id) + '">' + stl(key, esc(p.id)) + '<div class="th">' + ((p.images || [])[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '') + '</div><div class="nm"><b>' + esc(p.name) + '</b><small>' + esc(p.category) + '</small></div></div>').join(''), 'rows') : '<p class="empty-a">Nothing ticked yet.</p>');
};
S.featured = () => featTick() + ordCard('featured', 'Order of Featured products', 'Drag the handle or use the arrows. This is the order on the home page.') + ordCard('best', 'Order of Best selling', 'Drag the handle or use the arrows. This is the order on the home page.');
S.categories = () => card('Categories', 'Each category appears as a picture card in the shop. Switch one off to fade it and block it.',
  srt('categories', DB.categories.map((c, i) => '<div class="row-i" data-sr="' + i + '">' + stl('categories', i) + '<div class="th">' + (c.image ? '<img src="' + esc(c.image) + '" alt="">' : '') + '</div><div class="nm"><input type="text" value="' + esc(c.name) + '" data-cat="' + i + '" data-old="' + esc(c.name) + '" aria-label="Category name"></div><div class="rt">' + tg('categories.' + i + '.enabled', 'Available') + '<label class="btn btn-light btn-sm up">Picture<input type="file" accept="image/*" data-up="categories.' + i + '.image" hidden></label>' + btn('delcat', 'Delete', ' data-i="' + i + '"', 'btn-danger') + '</div></div>').join(''), 'rows'), btn('addcat', 'Add category', '', 'btn-primary'));

S.testruns = () => {
  const k = DB.kits, off = !k.enabled, D = { dis: off };
  const groups = card('Price cards', 'The picture cards customers see. Each price groups its bundles.', srt('groups', k.groups.map((g, i) => '<div class="row-i" data-sr="' + i + '">' + stl('groups', i) + '<div class="th">' + (g.image ? '<img src="' + esc(g.image) + '" alt="">' : '') + '</div><div class="nm">' + fld('kits.groups.' + i + '.price', 'Price ($)', { type: 'number', min: 0 }) + '</div><div class="rt">' + tg('kits.groups.' + i + '.enabled', 'Available', D) + '<label class="btn btn-light btn-sm up">Picture<input type="file" accept="image/*" data-up="kits.groups.' + i + '.image" hidden></label>' + btn('delgroup', 'Delete', ' data-i="' + i + '"', 'btn-danger') + '</div></div>').join(''), 'rows'), btn('addgroup', 'Add price card', '', 'btn-primary'));
  const runs = card('Bundles', 'Each bundle has a fixed price. Brand counts are how many different brands the customer may choose, split evenly.',
    srt('runs', k.runs.map((r, i) => '<details class="run" data-sr="' + i + '"' + (A.open['r' + i] ? ' open' : '') + ' data-k="r' + i + '"><summary>' + stl('runs', i) + '<span class="run-n">' + esc(r.name) + '</span><span class="run-p">' + money(r.price) + '</span></summary><div class="run-b"><div class="two">' + fld('kits.runs.' + i + '.name', 'Name') + fld('kits.runs.' + i + '.price', 'Price ($)', { type: 'number', min: 0 }) + '</div><div class="tgs">' + tg('kits.runs.' + i + '.enabled', 'Available', D) + tg('kits.runs.' + i + '.promoEligible', 'Promo codes and discounts apply') + '</div><h4>Contents</h4>' +
      r.parts.map((pt, j) => '<div class="part"><div class="three">' + slt('kits.runs.' + i + '.parts.' + j + '.type', 'Item', [['weed', 'Weed'], ['carts', 'Carts'], ['nic', 'Nic'], ['alcohol', 'Alcohol packs']]) + fld('kits.runs.' + i + '.parts.' + j + '.qty', pt.type === 'weed' ? 'Packs (2 = 1/4 oz, 8 = 1 oz)' : pt.type === 'alcohol' ? 'Packs' : 'How many', { type: 'number', min: 1, hint: pt.type === 'weed' ? 'Shows as ' + weedLabel(pt.qty) : '' }) + fld('kits.runs.' + i + '.parts.' + j + '.slots', 'Brand counts allowed', { dt: 'list', hint: 'Example: 1, 2. Each must divide the amount evenly.' }) + '</div>' + xbtn('delpart', ' data-i="' + i + '" data-j="' + j + '"') + '</div>').join('') +
      '<div class="acts">' + btn('addpart', 'Add item', ' data-i="' + i + '"') + btn('delrun', 'Delete bundle', ' data-i="' + i + '"', 'btn-danger') + '</div></div></details>').join('')), btn('addrun', 'Add bundle', '', 'btn-primary'));
  const main = card('Test Runs section', 'Turn this off and customers can still see the bundles, but everything is switched off: no picking, no ordering and no pop-up. Turn it back on to choose which price cards and bundles are available.',
    tg('kits.enabled', 'Test Runs available', { re: 1 }) + '<div class="gap"></div>' + fld('kits.intro', 'Intro text', { type: 'area', rows: 3 }));
  const pop = card('Test Runs pop-up', 'A pop-up like the age check that invites visitors to look at Test Runs. It only shows while Test Runs are available.',
    tg('kits.popupOn', 'Show the pop-up', D) + '<div class="two">' + fld('kits.popup.title', 'Pop-up text') + fld('kits.popup.button', 'Button text') + '</div>' + fld('kits.popupDelay', 'Seconds before it appears', { type: 'number', min: 1, hint: 'Counted from when the visitor lands on the page.' }));
  return main + (off ? '<p class="warn-b">Test Runs are off, so every price card, bundle and the pop-up are switched off for customers. Your choices below are kept and come back when you turn it on.</p>' : '') + pop + groups + runs;
};

S.promos = () => {
  const payOpts = DB.payments.map(m => [m.name, m.name]);
  const promos = card('Discounts and promo codes', 'A payment method discount applies when that method is chosen. A code discount applies when the code is entered. Discounts do not stack: the best one wins.',
    srt('promos', DB.promos.map((p, i) => '<div class="part" data-sr="' + i + '">' + stl('promos', i) + '<div class="three">' + fld('promos.' + i + '.label', 'Name') + slt('promos.' + i + '.type', 'Type', [['payment', 'Payment method'], ['code', 'Promo code']], { re: 1 }) + (p.type === 'payment' ? slt('promos.' + i + '.payment', 'Payment method', payOpts) : fld('promos.' + i + '.code', 'Code', { ph: 'PHOUSE20' })) + '</div><div class="three">' + fld('promos.' + i + '.percent', 'Percent off', { type: 'number', min: 0 }) + fld('promos.' + i + '.minOrder', 'Minimum order ($)', { type: 'number', min: 0 }) + '<div class="f"><label>Status</label>' + tg('promos.' + i + '.active', 'Active') + '</div></div>' + xbtn('delpromo', ' data-i="' + i + '"') + '</div>').join('')), btn('addpromo', 'Add discount', '', 'btn-primary'));
  const ban = card('Banner messages', 'The rotating messages at the top of the site. Link a message to a discount and use {percent}, {min} and {code} so the text always matches the real discount.',
    srt('banner', DB.banner.map((b, i) => '<div class="part" data-sr="' + i + '">' + stl('banner', i) + fld('banner.' + i + '.text', 'Message', { ph: 'Pay with Bitcoin and get {percent}% off' }) + '<div class="two">' + slt('banner.' + i + '.promo', 'Linked discount', [['', 'None (plain message)']].concat(DB.promos.map(p => [p.id, p.label || p.id]))) + '<div class="f"><label>Status</label>' + tg('banner.' + i + '.active', 'Show') + '</div></div>' + xbtn('delban', ' data-i="' + i + '"') + '</div>').join('')), btn('addban', 'Add message', '', 'btn-primary'));
  const pops = card('Pop-ups', 'Extra pop-ups that open once per visit, a few seconds after the visitor arrives. They use the same style as the age check.',
    DB.popups.length ? srt('popups', DB.popups.map((p, i) => '<div class="part" data-sr="' + i + '">' + stl('popups', i) + fld('popups.' + i + '.title', 'Title') + fld('popups.' + i + '.text', 'Text', { type: 'area', rows: 2 }) + '<div class="three">' + fld('popups.' + i + '.button', 'Button text') + fld('popups.' + i + '.link', 'Button link', { ph: 'shop.html', hint: 'A page like shop.html or a full web address.' }) + fld('popups.' + i + '.delay', 'Seconds before it appears', { type: 'number', min: 1 }) + '</div>' + tg('popups.' + i + '.active', 'Active') + xbtn('delpop', ' data-i="' + i + '"') + '</div>').join('')) : '<p class="empty-a">No extra pop-ups yet.</p>', btn('addpop', 'Add pop-up', '', 'btn-primary'));
  return promos + ban + pops;
};

S.pricing = () => {
  const ps = DB.pricing[A.ps] || (A.ps = 'dispos', DB.pricing.dispos), key = 'pricing.' + A.ps;
  const used = DB.products.filter(p => p.priceSet === A.ps).length;
  const sel = card('Price list', 'Each product uses one price list. Dispos and Nic share one. Alcohol brands have their own.',
    '<div class="two">' + '<div class="f"><label>Choose a list to edit</label><select id="pset">' + Object.keys(DB.pricing).map(k => '<option value="' + esc(k) + '"' + (k === A.ps ? ' selected' : '') + '>' + esc(psName(k)) + '</option>').join('') + '</select></div>' + fld(key + '.unit', 'Unit word', { hint: 'pc, pack or bottle' }) + '</div><p class="hint-l">' + used + ' products use this list.</p>', btn('addset', 'New price list', '', 'btn-primary') + (used || A.ps === 'dispos' || A.ps === 'weed' ? '' : btn('delset', 'Delete list', '', 'btn-danger')));
  const tiers = card('Quantity prices', 'Customers pick one of these quantities. A box or pack with the same number of pieces uses the price and shows the box name. Exact quantities always use the price here.',
    ps.tiers.map((t, i) => '<div class="part"><div class="three">' + fld(key + '.tiers.' + i + '.qty', 'Pieces', { type: 'number', min: 1 }) + fld(key + '.tiers.' + i + '.price', 'Price ($)', { type: 'number', min: 0 }) + fld(key + '.tiers.' + i + '.label', 'Label (optional)', { hint: 'Example: 1/2 oz' }) + '</div>' + xbtn('deltier', ' data-i="' + i + '"') + '</div>').join(''), btn('addtier', 'Add quantity', '', 'btn-primary'));
  const bulk = ps.customs ? card('Bulk rates', 'The price per piece from each quantity up. Between two packs the price is capped at the next pack price and never goes below the previous pack price.',
    ps.customs.map((c, i) => '<div class="part"><div class="two">' + fld(key + '.customs.' + i + '.min', 'From pieces', { type: 'number', min: 1 }) + fld(key + '.customs.' + i + '.rate', 'Price each ($)', { type: 'number', min: 0 }) + '</div>' + xbtn('delcust', ' data-i="' + i + '"') + '</div>').join(''), btn('addcust', 'Add rate', '', 'btn-primary') + btn('nobulk', 'Use one rate instead')) :
    card('Custom quantity', 'Lets customers enter any number from the minimum up at one price per piece. Set the minimum to 0 to turn it off.', '<div class="two">' + fld(key + '.customMin', 'Minimum pieces', { type: 'number', min: 0 }) + fld(key + '.customRate', 'Price each ($)', { type: 'number', min: 0 }) + '</div>', btn('usebulk', 'Use bulk rates instead'));
  return sel + tiers + bulk;
};

S.payments = () => card('Payment methods', 'Turn a method off and customers no longer see it. A minimum order blocks the method on small orders.',
  srt('payments', DB.payments.map((m, i) => '<div class="part" data-sr="' + i + '">' + stl('payments', i) + '<div class="three">' + fld('payments.' + i + '.name', 'Name') + fld('payments.' + i + '.note', 'Note shown to customers', { ph: '50% upfront' }) + fld('payments.' + i + '.minOrder', 'Minimum order ($)', { type: 'number', min: 0 }) + '</div>' + tg('payments.' + i + '.enabled', 'Available') + xbtn('delpay', ' data-i="' + i + '"') + '</div>').join('')), btn('addpay', 'Add payment method', '', 'btn-primary'));

S.orderform = () => {
  const f = DB.form;
  return card('Order form fields', 'The labels customers see. Name, phone, delivery location and payment are always required.',
    '<div class="two">' + fld('form.name.label', 'Name label') + fld('form.phone.label', 'Phone label') + fld('form.loc.label', 'Delivery location label') + fld('form.pay.label', 'Payment label') + '</div>') +
    card('Delivery time', 'Lets customers say when they want delivery: as soon as possible, or a time.', tg('form.time.on', 'Ask for delivery time') + '<div class="gap"></div>' + fld('form.time.label', 'Question') + '<div class="two">' + fld('form.time.asap', 'First option') + fld('form.time.later', 'Second option') + '</div>') +
    card('Optional fields', null, '<div class="two"><div>' + tg('form.code.on', 'Promo code field') + fld('form.code.label', 'Promo code label') + '</div><div>' + tg('form.notes.on', 'Notes field') + fld('form.notes.label', 'Notes label') + '</div></div>') +
    card('Payment note', 'Shown in the cart and on the last screen before the order is sent.', fld('form.payNote', 'Note', { type: 'area', rows: 3 }));
};

S.pages = () => card('Home page', null, fld('pages.home.title', 'Title') + fld('pages.home.text', 'Text', { type: 'area', rows: 3 }) + fld('pages.home.button', 'Button text')) +
  card('About page', 'Leave a heading empty for an opening paragraph.', fld('pages.about.title', 'Page title') + srt('sections', DB.pages.about.sections.map((s, i) => '<div class="part" data-sr="' + i + '">' + stl('sections', i) + fld('pages.about.sections.' + i + '.h', 'Heading') + fld('pages.about.sections.' + i + '.p', 'Paragraph', { type: 'area', rows: 3 }) + xbtn('delsec', ' data-i="' + i + '"') + '</div>').join('')), btn('addsec', 'Add section', '', 'btn-primary')) +
  card('FAQ', 'Questions and answers shown on the FAQ page.', srt('faq', DB.pages.faq.map((q, i) => '<div class="part" data-sr="' + i + '">' + stl('faq', i) + fld('pages.faq.' + i + '.q', 'Question') + fld('pages.faq.' + i + '.a', 'Answer', { type: 'area', rows: 3 }) + xbtn('delfaq', ' data-i="' + i + '"') + '</div>').join('')), btn('addfaq', 'Add question', '', 'btn-primary'));

S.contact = () => card('Order number', 'Orders and the contact form are sent to this WhatsApp number with the message filled in. Use digits only with the country code.', fld('settings.whatsapp', 'WhatsApp number', { ph: '17876198365', dt: 'digits' })) +
  card('Social links', 'The icons in the footer and on the Contact page. Switch one off to hide it. Drag to change the order.', srt('links', DB.settings.links.map((l, i) => '<div class="part" data-sr="' + i + '">' + stl('links', i) + '<div class="two">' + fld('settings.links.' + i + '.label', 'Name') + fld('settings.links.' + i + '.url', 'Link') + '</div>' + tg('settings.links.' + i + '.on', 'Show') + '</div>').join('')));

S.settings = () => card('Footer text', null, fld('settings.footerText', 'Text under the footer logo', { type: 'area', rows: 2 })) +
  card('Live chat', 'The Smartsupp chat bubble. It never shows on this admin page.', tg('settings.chatEnabled', 'Show live chat') + '<div class="gap"></div>' + fld('settings.chatKey', 'Smartsupp key')) +
  card('Account', SB ? 'The admin password is set in the host environment variable ADMIN_PASSWORD. To change it, edit that variable and redeploy.' : 'Not connected to the database yet, so changes are saved in this browser only.', '<div class="acts">' + btn('signout', 'Sign out') + '</div>') +
  card('Backup', 'Download everything as a file, restore from a file, or go back to the starting content.', '<div class="acts">' + btn('export', 'Download backup', '', 'btn-primary') + '<label class="btn btn-light btn-sm up">Restore from file<input type="file" accept="application/json" id="imp" hidden></label>' + btn('reset', 'Reset to starting content', '', 'btn-danger') + '</div>');

/* ---------- product editor ---------- */
function drawEditor() {
  const e = A.ed;
  const opts = DB.categories.map(c => [c.name, c.name]);
  $('#modalHost').innerHTML = '<div class="modal"><div class="modal-card"><div class="modal-h"><h2>' + (A.isNew ? 'Add product' : 'Edit product') + '</h2><button type="button" class="x" data-act="edclose" aria-label="Close">&times;</button></div>' +
    '<div class="two">' + fld('name', 'Name', { root: 'e' }) + slt('category', 'Category', opts, { root: 'e' }) + '</div>' +
    '<div class="two">' + slt('priceSet', 'Price list', Object.keys(DB.pricing).map(k => [k, psName(k)]), { root: 'e', hint: 'Decides the quantity prices.' }) + fld('sizeTag', 'Size tag (optional)', { root: 'e', hint: 'Shown after the name, like 2G or 50ml.' }) + '</div>' +
    '<div class="three">' + fld('minTier', 'Smallest quantity sold', { root: 'e', type: 'number', min: 0, hint: '0 means all quantities.' }) + fld('packSize', 'Bottles per pack (alcohol)', { root: 'e', type: 'number', min: 0 }) + slt('noun', 'Choice word', [['', 'Automatic'], ['flavor', 'flavor'], ['strain', 'strain'], ['expression', 'expression']], { root: 'e', hint: 'What the choices are called.' }) + '</div>' +
    fld('description', 'Description', { root: 'e', type: 'area', rows: 3 }) +
    '<div class="tgs">' + tg('inStock', 'In stock', { root: 'e' }) + tg('featured', 'Featured on home page', { root: 'e' }) + tg('best', 'Best selling', { root: 'e' }) + '</div>' +
    '<h4>Pictures</h4><div class="imgs">' + (e.images || []).map((s, i) => '<div class="im"><img src="' + esc(s) + '" alt="">' + (i ? '<button type="button" class="mk" data-act="imfirst" data-i="' + i + '">Make first</button>' : '<span class="mk on">First</span>') + '<button type="button" class="x" data-act="imdel" data-i="' + i + '" aria-label="Remove">&times;</button></div>').join('') + '<label class="im add up">+ Add<input type="file" accept="image/*" multiple data-upm="1" hidden></label></div>' +
    '<h4>Flavors <small class="cnt-s' + ((e.flavors || []).length > 10 ? ' warn' : '') + '">' + (e.flavors || []).length + ' of 10 recommended</small></h4><div class="rowsm">' + (e.flavors || []).map((f, i) => '<div class="rm-row"><input type="text" data-root="e" data-path="flavors.' + i + '.name" data-type="str" value="' + esc(f.name) + '" aria-label="Flavor name">' + tg('flavors.' + i + '.available', 'Available', { root: 'e' }) + xbtn('edfdel', ' data-i="' + i + '"') + '</div>').join('') + '</div>' + btn('edfadd', 'Add flavor') +
    '<h4>Boxes or packs</h4><p class="hint-l">A box with the same number of pieces as a quantity price replaces its label.</p><div class="rowsm">' + (e.boxes || []).map((b, i) => '<div class="rm-row"><input type="text" data-root="e" data-path="boxes.' + i + '.name" data-type="str" value="' + esc(b.name) + '" aria-label="Box name"><input class="nn" type="number" min="0" data-root="e" data-path="boxes.' + i + '.count" data-type="num" value="' + esc(b.count) + '" aria-label="Pieces">' + tg('boxes.' + i + '.available', 'Available', { root: 'e' }) + xbtn('edbdel', ' data-i="' + i + '"') + '</div>').join('') + '</div>' + btn('edbadd', 'Add box') +
    '<div class="modal-f"><p class="note bad" id="e-err" hidden></p><button class="btn btn-ghost" data-act="edclose" type="button">Cancel</button><button class="btn btn-primary" data-act="edsave" type="button">Save product</button></div></div></div>';
}
const blankProd = () => ({ id: '', name: '', category: (DB.categories[0] || {}).name || '', priceSet: (((DB.categories[0] || {}).name) === 'Weed' ? 'weed' : 'dispos'), sizeTag: '', minTier: 0, noun: '', description: '', images: [], inStock: true, featured: false, best: false, flavors: [], boxes: [] });

/* ---------- shell ---------- */
function drawShell() {
  const sec = SECS.find(s => s[0] === A.sec) || SECS[0];
  $('#app').innerHTML = '<header class="mbar"><button type="button" class="burger" data-act="menu" aria-label="Open menu" aria-expanded="false"><i></i><i></i><i></i></button><span class="mbar-t">' + esc(sec[1]) + '</span><span class="status" id="status2"></span></header><div class="scrim" data-act="menuclose"></div><div class="shell"><aside class="side" id="side"><div class="brand"><img src="assets/logo-wordmark.png" alt="The P House"><span>Admin</span></div><nav class="nav" id="nav">' + SECS.map(s => '<a href="#' + s[0] + '" data-sec="' + s[0] + '" class="' + (s[0] === A.sec ? 'on' : '') + '">' + esc(s[1]) + '</a>').join('') + '</nav></aside><div class="main"><header class="top"><div><h1>' + esc(sec[1]) + '</h1><p>' + esc(sec[2]) + '</p></div><div class="top-r"><span class="status" id="status">All changes saved</span><a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">View site</a></div></header>' + (!SB ? '<p class="warn-b">No database is connected, so changes are saved in this browser only (test mode).</p>' : API_STATE === 'error' ? '<p class="warn-b">The database could not be reached just now. Saving may fail until it is back.</p>' : '') + '<div id="content"></div></div></div><div id="modalHost"></div>';
  drawSec();
}
function drawSec() {
  const y = window.scrollY, c = $('#content'); if (!c) return;
  c.innerHTML = S[A.sec]();
  window.scrollTo(0, y);
}
function showLogin(msg) {
  document.body.classList.add('login-pg');
  $('#app').innerHTML = '<div class="login"><form id="lf" class="login-card"><img src="assets/logo-wordmark.png" alt="The P House"><h1>Admin sign in</h1><div class="f"><label for="lp">Password</label><input id="lp" type="password" autocomplete="current-password" required>' + (SB ? '' : '<small>Test mode: no database connected. The test password is admin123.</small>') + '</div><button class="btn btn-primary" type="submit" style="width:100%">Sign in</button><p class="note bad" id="lerr"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</p></form></div>';
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault(); const err = $('#lerr'); err.hidden = true;
    try {
      if (SB) { const j = await api('admin-login', { password: $('#lp').value }); sess.set(TOK_KEY, j); }
      else { if ($('#lp').value !== 'admin123') throw new Error('Wrong password.'); sess.set('pph_local_admin', 1); }
      document.body.classList.remove('login-pg'); drawShell();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  });
}

/* ---------- events ---------- */
function onField(el, ev) {
  const r = root(el), t = el.dataset.type;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (t === 'num') v = Number(v) || 0;
  else if (t === 'list') v = String(v).split(/[,\s]+/).map(Number).filter(n => n > 0);
  else if (t === 'digits') v = String(v).replace(/\D/g, '');
  setPath(r, el.dataset.path, v);
  if (r === A.ed && A.isNew && el.dataset.path === 'category' && !(A.ed.priceSet || '').startsWith('alc-')) { A.ed.priceSet = v === 'Weed' ? 'weed' : 'dispos'; A.ed.noun = ''; el.dataset.re = '1'; }
  if (r === DB) persist();
  if (el.dataset.re && ev === 'change') { if (r === DB) drawSec(); else drawEditor(); }
}
function bindDrag() {
  let d = null, raf = 0;
  const move = e => {
    if (!d) return; d.y = e.clientY;
    const rows = rowsOf(d.box).filter(r => r !== d.row);
    for (const r of rows) { const b = r.getBoundingClientRect(); if (d.y > b.top && d.y < b.bottom) { if (d.y > b.top + b.height / 2) r.after(d.row); else r.before(d.row); break; } }
  };
  const scroll = () => { if (!d) return; const h = innerHeight; if (d.y < 90) scrollBy(0, -14); else if (d.y > h - 90) scrollBy(0, 14); raf = requestAnimationFrame(scroll); };
  const end = () => {
    if (!d) return; cancelAnimationFrame(raf);
    const { box, row } = d; row.classList.remove('dragging'); document.body.classList.remove('is-drag'); d = null;
    applySort(box.dataset.srt, rowsOf(box).map(r => r.dataset.sr));
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end);
  };
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest('[data-grip]'); if (!g) return;
    const row = g.closest('[data-sr]'), box = row && row.parentElement; if (!box || !box.dataset.srt) return;
    e.preventDefault(); d = { row, box, y: e.clientY }; row.classList.add('dragging'); document.body.classList.add('is-drag');
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    raf = requestAnimationFrame(scroll);
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-grip]')) { e.preventDefault(); e.stopPropagation(); } }, true);
}
function bind() {
  bindDrag();
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset && el.dataset.path && el.type !== 'checkbox' && el.tagName !== 'SELECT') onField(el, 'input');
    if (el.id === 'pq') { A.q = el.value; const p = el.selectionStart; drawSec(); const n = $('#pq'); if (n) { n.focus(); n.setSelectionRange(p, p); } }
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.dataset && el.dataset.path && (el.type === 'checkbox' || el.tagName === 'SELECT' || el.dataset.type === 'num' || el.dataset.re)) { onField(el, 'change'); if (el.type === 'checkbox' && !el.dataset.re && el.closest('#content') && /^kits\.runs\./.test(el.dataset.path) === false) { /* no redraw needed */ } }
    if (el.id === 'pcat') { A.cat = el.value; drawSec(); }
    if (el.id === 'pset') { A.ps = el.value; drawSec(); }
    if (el.dataset && el.dataset.cat !== undefined) {
      const i = +el.dataset.cat, old = DB.categories[i].name, nn = el.value.trim(); if (!nn) { el.value = old; return; }
      DB.categories[i].name = nn; DB.products.forEach(p => { if (p.category === old) p.category = nn; }); persist();
    }
    if (el.dataset && el.dataset.up) {
      const f = el.files[0]; if (!f) return;
      try { setStatus('Uploading...'); const url = await uploadImage(f, 'site'); setPath(root(el), el.dataset.up, url); if (root(el) === DB) { persist(); drawSec(); } else drawEditor(); } catch (x) { setStatus(x.message, true); }
      el.value = '';
    }
    if (el.dataset && el.dataset.upm) {
      try { setStatus('Uploading...'); for (const f of Array.from(el.files)) { const url = await uploadImage(f, 'products'); A.ed.images.push(url); } setStatus('Uploaded. Press Save product.'); drawEditor(); } catch (x) { setStatus(x.message, true); }
    }
    if (el.id === 'imp') {
      const f = el.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); if (!j.products || !j.categories) throw new Error('This file is not a backup.'); DB = fillDefaults(j); persist(); drawSec(); setStatus('Backup restored'); } catch (x) { setStatus(x.message, true); }
    }
  });
  document.addEventListener('toggle', e => { const d = e.target; if (d.tagName === 'DETAILS' && d.dataset.k) A.open[d.dataset.k] = d.open; }, true);
  document.addEventListener('click', async e => {
    const nv = e.target.closest('[data-sec]');
    if (nv) { e.preventDefault(); document.body.classList.remove('menu-open'); A.sec = nv.dataset.sec; A.q = ''; history.replaceState(null, '', '#' + A.sec); drawShell(); window.scrollTo(0, 0); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, i = +b.dataset.i, j = +b.dataset.j;
    const redo = () => { persist(); drawSec(); };
    const ask = m => confirm(m);
    switch (act) {
      case 'mv': { const box = b.closest('[data-srt]'); if (!box) return; const rows = rowsOf(box), at = rows.findIndex(r => r.contains(b)), to = at + (+b.dataset.d); if (at < 0 || to < 0 || to >= rows.length) return; const order = rows.map(r => r.dataset.sr); order.splice(to, 0, order.splice(at, 1)[0]); applySort(box.dataset.srt, order); return; }
      case 'menu': document.body.classList.toggle('menu-open'); b.setAttribute('aria-expanded', document.body.classList.contains('menu-open')); return;
      case 'menuclose': document.body.classList.remove('menu-open'); return;
      case 'addprod': A.ed = blankProd(); A.isNew = true; drawEditor(); return;
      case 'editprod': A.ed = clone(DB.products[i]); A.ed.index = i; A.isNew = false; if (A.ed.packSize == null) A.ed.packSize = 0; drawEditor(); return;
      case 'delprod': if (ask('Delete ' + DB.products[i].name + '? This cannot be undone.')) { const id = DB.products[i].id; DB.products.splice(i, 1); CART = CART.filter(l => l.pid !== id); saveCart(); redo(); } return;
      case 'edclose': A.ed = null; $('#modalHost').innerHTML = ''; return;
      case 'imdel': A.ed.images.splice(i, 1); drawEditor(); return;
      case 'imfirst': A.ed.images.unshift(A.ed.images.splice(i, 1)[0]); drawEditor(); return;
      case 'edfadd': A.ed.flavors.push({ name: '', available: true }); drawEditor(); return;
      case 'edfdel': A.ed.flavors.splice(i, 1); drawEditor(); return;
      case 'edbadd': A.ed.boxes.push({ name: '', count: 0, available: true }); drawEditor(); return;
      case 'edbdel': A.ed.boxes.splice(i, 1); drawEditor(); return;
      case 'edsave': {
        const x = A.ed, err = $('#e-err'); x.name = (x.name || '').trim();
        if (!x.name) { err.textContent = 'Please enter a name.'; err.hidden = false; return; }
        x.flavors = (x.flavors || []).filter(f => f.name.trim()); x.boxes = (x.boxes || []).filter(bx => bx.name.trim());
        if (!x.packSize) delete x.packSize;
        if (A.isNew) { let id = slug(x.name), n = 2; while (DB.products.some(p => p.id === id)) id = slug(x.name) + '-' + n++; x.id = id; delete x.index; DB.products.push(x); }
        else { const idx = x.index; delete x.index; DB.products[idx] = x; }
        persist(); A.ed = null; $('#modalHost').innerHTML = ''; drawSec(); return;
      }
      case 'addcat': DB.categories.push({ name: 'New category', enabled: true, image: '' }); redo(); return;
      case 'delcat': if (ask('Delete this category? Products in it stay but will not be shown.')) { DB.categories.splice(i, 1); redo(); } return;
      case 'addgroup': DB.kits.groups.push({ price: 100, image: '', enabled: true }); redo(); return;
      case 'delgroup': if (ask('Delete this price card?')) { DB.kits.groups.splice(i, 1); redo(); } return;
      case 'addrun': A.open['r' + DB.kits.runs.length] = true; DB.kits.runs.push({ id: uid('run'), name: 'New bundle', price: 100, enabled: true, promoEligible: false, parts: [{ type: 'carts', qty: 10, slots: [1, 2] }] }); redo(); return;
      case 'delrun': if (ask('Delete this bundle?')) { DB.kits.runs.splice(i, 1); redo(); } return;
      case 'addpart': DB.kits.runs[i].parts.push({ type: 'carts', qty: 10, slots: [1] }); redo(); return;
      case 'delpart': DB.kits.runs[i].parts.splice(j, 1); redo(); return;
      case 'addpromo': DB.promos.push({ id: uid('p'), label: 'New discount', type: 'code', payment: '', code: '', percent: 10, minOrder: 0, active: true }); redo(); return;
      case 'delpromo': if (ask('Delete this discount?')) { const id = DB.promos[i].id; DB.promos.splice(i, 1); DB.banner.forEach(bn => { if (bn.promo === id) bn.promo = ''; }); redo(); } return;
      case 'addban': DB.banner.push({ id: uid('b'), text: 'New message', active: true, promo: '' }); redo(); return;
      case 'delban': DB.banner.splice(i, 1); redo(); return;
      case 'addpop': DB.popups.push({ id: uid('pop'), title: 'New pop-up', text: '', button: 'Learn more', link: 'shop.html', active: false, delay: 8 }); redo(); return;
      case 'delpop': DB.popups.splice(i, 1); redo(); return;
      case 'addset': { const n = prompt('Name for the new price list'); if (n && n.trim()) { const k = 'list-' + slug(n); DB.pricing[k] = { name: n.trim(), tiers: [{ qty: 1, price: 0 }], customMin: 0, customRate: 0, unit: 'pc' }; A.ps = k; redo(); } return; }
      case 'delset': if (ask('Delete this price list?')) { delete DB.pricing[A.ps]; A.ps = 'dispos'; redo(); } return;
      case 'addtier': priceCur().tiers.push({ qty: 1, price: 0 }); redo(); return;
      case 'deltier': priceCur().tiers.splice(i, 1); redo(); return;
      case 'addcust': priceCur().customs.push({ min: 1, rate: 0 }); syncCustMin(); redo(); return;
      case 'delcust': priceCur().customs.splice(i, 1); syncCustMin(); redo(); return;
      case 'usebulk': { const ps = priceCur(); ps.customs = ps.customMin > 0 ? [{ min: ps.customMin, rate: ps.customRate }] : [{ min: 1, rate: 0 }]; syncCustMin(); redo(); return; }
      case 'nobulk': { const ps = priceCur(); const c = (ps.customs || [])[0]; delete ps.customs; ps.customMin = c ? c.min : 0; ps.customRate = c ? c.rate : 0; redo(); return; }
      case 'addpay': DB.payments.push({ name: 'New method', enabled: true, note: '', minOrder: 0 }); redo(); return;
      case 'delpay': if (ask('Delete this payment method?')) { const n = DB.payments[i].name; DB.payments.splice(i, 1); DB.promos = DB.promos.filter(p => !(p.type === 'payment' && p.payment === n)); redo(); } return;
      case 'addsec': DB.pages.about.sections.push({ h: 'New heading', p: '' }); redo(); return;
      case 'delsec': DB.pages.about.sections.splice(i, 1); redo(); return;
      case 'addfaq': DB.pages.faq.push({ q: 'New question', a: '' }); redo(); return;
      case 'delfaq': DB.pages.faq.splice(i, 1); redo(); return;
      case 'export': { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' })); a.download = 'the-p-house-backup.json'; a.click(); return; }
      case 'reset': if (ask('Replace everything with the starting content? Your changes will be lost.')) { DB = clone(window.DEFAULT_DB); persist(); drawSec(); } return;
      case 'signout': sess.del(TOK_KEY); sess.del('pph_local_admin'); location.reload(); return;
    }
  });
}
const priceCur = () => DB.pricing[A.ps];
const syncCustMin = () => { const ps = priceCur(); if (ps.customs) { ps.customMin = ps.customs.length ? Math.min.apply(null, ps.customs.map(c => c.min)) : 0; ps.customRate = (ps.customs[0] || {}).rate || 0; } };

/* ---------- start ---------- */
(async () => {
  await READY;
  bind();
  if (location.hash && SECS.some(s => '#' + s[0] === location.hash)) A.sec = location.hash.slice(1);
  let ok = false;
  if (SB) { try { getToken(); ok = true; } catch (e) { ok = false; } }
  else ok = !!sess.get('pph_local_admin');
  if (ok) drawShell(); else showLogin();
})();
