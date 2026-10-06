/* Step-by-step order flow: one question per screen, Back / Cancel / Next, no progress bar */
const wzOpt = o => '<button type="button" class="wz-opt' + (o.pfm ? ' pfm' : '') + (o.on ? ' on' : '') + '" data-w="' + o.act + '"' + (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') + (o.name != null ? ' data-name="' + esc(String(o.name).toLowerCase()) + '"' : '') + (o.dis ? ' disabled' : '') + '><span class="wz-l"><b>' + o.label + '</b>' + (o.sub ? '<small>' + o.sub + '</small>' : '') + '</span>' + (o.side ? '<span class="wz-s">' + o.side + '</span>' : '') + '</button>';
const wzCount = o => '<div class="wz-opt cnt' + (o.c ? ' on' : '') + '" data-name="' + esc(String(o.name).toLowerCase()) + '"><span class="wz-l"><b>' + esc(o.name) + '</b></span><span class="ctl"><button type="button" data-w="sub" data-v="' + esc(o.name) + '"' + (o.c ? '' : ' disabled') + ' aria-label="Remove one">-</button><input class="cin" type="number" min="0" max="' + o.max + '" value="' + o.c + '" data-wc="cin" data-v="' + esc(o.name) + '" aria-label="Count for ' + esc(o.name) + '"><button type="button" data-w="add" data-v="' + esc(o.name) + '"' + (o.full ? ' disabled' : '') + ' aria-label="Add one">+</button></span></div>';
const wzSearch = (show, ph) => show ? '<input class="wz-search" type="search" data-wsearch="1" placeholder="' + esc(ph || 'Search') + '" autocomplete="off">' : '';
const wzQtyBar = (have, need) => '<div class="wz-meta"><span>Chosen</span><b>' + have + ' of ' + need + '</b></div>';
/* random pick that leans toward products marked Best selling, still different every time */
function wpickN(pool, n) {
  const res = []; let rest = pool.slice();
  while (res.length < n && rest.length) {
    const w = rest.map(p => (p.best ? 4 : 1)), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot, k = 0; while (k < w.length - 1 && r >= w[k]) { r -= w[k]; k++; }
    res.push(rest.splice(k, 1)[0]);
  }
  return res;
}
function openWizard(o) {
  const w = document.createElement('div'); w.className = 'wz'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
  document.body.appendChild(w); document.body.classList.add('wz-open');
  let i = o.start === 'last' ? Infinity : (o.start || 0), q = {}, done = null, lastKey = null;
  const close = () => { document.removeEventListener('keydown', onKey); w.remove(); document.body.classList.remove('wz-open'); if (o.onClose) o.onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const cur = () => { const st = o.steps(); if (i >= st.length) i = st.length - 1; if (i < 0) i = 0; return { st, s: st[i] }; };
  const filter = () => {
    const inp = w.querySelector('[data-wsearch]'); if (!inp) return;
    const v = inp.value.trim().toLowerCase(); let shown = 0;
    w.querySelectorAll('.wz-opt[data-name]').forEach(e => { const m = !v || e.dataset.name.includes(v); e.hidden = !m; if (m) shown++; });
    const none = w.querySelector('.wz-none'); if (none) none.hidden = shown > 0;
  };
  const draw = () => {
    if (done) {
      w.innerHTML = '<div class="wz-top"><span></span><span class="wz-t">' + esc(o.title || '') + '</span><span></span></div><div class="wz-body"><div class="wz-in wz-done"><h2>' + esc(done.title) + '</h2><p class="wz-hint">' + esc(done.text) + '</p></div></div><div class="wz-bot"><div class="wz-in wz-btns">' + (done.btns || []).map((b, k) => b.href ? '<a class="btn ' + (b.cls || 'btn-primary') + '" href="' + esc(b.href) + '">' + esc(b.label) + '</a>' : '<button type="button" class="btn ' + (b.cls || 'btn-light') + '" data-wz="close">' + esc(b.label) + '</button>').join('') + '</div></div>';
      return;
    }
    const { st, s } = cur(), last = i === st.length - 1;
    const old = w.querySelector('.wz-body'), keep = old && lastKey === s.key ? old.scrollTop : 0;
    w.innerHTML = '<div class="wz-top"><button type="button" class="wz-link" data-wz="back"' + (i ? '' : ' disabled') + '>Back</button><span class="wz-t">' + esc(o.title || '') + '</span><button type="button" class="wz-link" data-wz="cancel">Cancel</button></div>' +
      '<div class="wz-body"><div class="wz-in"><h2>' + esc(s.title) + '</h2>' + (s.hint ? '<p class="wz-hint">' + s.hint + '</p>' : '') + s.body() + '<p class="wz-none" hidden>Nothing found.</p></div></div>' +
      '<div class="wz-bot"><div class="wz-in"><button type="button" class="btn btn-primary wz-next" data-wz="next"' + (s.ok() ? '' : ' disabled') + '>' + (last ? esc(s.finish || 'Done') : 'Next') + '</button></div></div>';
    const nb = w.querySelector('.wz-body'); nb.scrollTop = keep;
    const inp = w.querySelector('[data-wsearch]'); if (inp) { inp.value = q[s.key] || ''; filter(); }
    if (lastKey !== s.key) { nb.scrollTop = 0; } lastKey = s.key;
  };
  const api = { goto: key => { const k = o.steps().findIndex(x => x.key === key); if (k >= 0) i = k; }, draw };
  w.addEventListener('click', e => {
    const z = e.target.closest('[data-wz]');
    if (z) {
      const a = z.dataset.wz;
      if (a === 'close' || a === 'cancel') { close(); return; }
      if (a === 'back') { if (i > 0) { i--; draw(); } return; }
      if (a === 'next') {
        const { st, s } = cur(); if (!s.ok()) return;
        if (i < st.length - 1) { i++; draw(); return; }
        const r = o.finish ? o.finish() : null; if (r) { done = r; draw(); } else close();
      }
      return;
    }
    const a = e.target.closest('[data-w]');
    if (a && !a.disabled) { const { s } = cur(); if (s.act) s.act(a.dataset.w, a, api); draw(); }
  });
  w.addEventListener('input', e => {
    if (e.target.matches('[data-wsearch]')) { q[cur().s.key] = e.target.value; filter(); return; }
    if (e.target.matches('[data-wi]')) { const { s } = cur(); if (s.input) s.input(e.target); const nb = w.querySelector('.wz-next'); if (nb) nb.disabled = !s.ok(); }
  });
  w.addEventListener('change', e => {
    if (e.target.matches('[data-wc]')) { const { s } = cur(); if (s.change) s.change(e.target.dataset.wc, e.target); draw(); }
  });
  draw();
  return { close, draw };
}
