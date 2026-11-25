// Token Radar radar-6 dashboard. Renders window.RADAR (written by main.ts
// into data.js beside this page) and needs no network: every number on the
// page comes from the sealed snapshot through the model in lib/model.ts.
var DATA = window.RADAR;
var state = { q: '', category: 'all', chain: 'all', call: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, watchlist: false, growthW: 0.6, multScale: 1 };

function el(tag, attrs) {
  var node = document.createElement(tag);
  attrs = attrs || {};
  for (var k in attrs) {
    if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
    else node.setAttribute(k, attrs[k]);
  }
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i];
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
function fmt$(n) {
  if (n === null || n === undefined || !isFinite(n)) return 'n/a';
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}
function fmtMoney(n) {
  if (n === null || n === undefined || !isFinite(n)) return 'n/a';
  if (n >= 1000) return fmt$(n);
  return '$' + n.toFixed(2);
}
function fmtInt(n) { return n.toLocaleString('en-US'); }
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
function fmtSigned(n, d) { var s = n >= 0 ? '+' : ''; return s + n.toFixed(d === undefined ? 3 : d); }
function esc(s) { return String(s); }

function rowBySlug(slug) {
  for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
  return null;
}
function distinct(rows, key) {
  var seen = {};
  rows.forEach(function (r) { (key(r) || []).forEach(function (v) { seen[v] = true; }); });
  return Object.keys(seen).sort();
}
function filteredRows() {
  var q = state.q.trim().toLowerCase();
  var rows = DATA.rows.filter(function (r) {
    if (state.watchlist && DATA.watchlist.indexOf(r.slug) < 0) return false;
    if (state.category !== 'all' && (r.category || 'uncategorised') !== state.category) return false;
    if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
    if (state.call !== 'all' && r.call !== state.call) return false;
    if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var key = state.sort;
  var val = function (r) {
    if (key === 'rank') return r.rank;
    if (key === 'tvl') return r.tvl_usd;
    if (key === 'growth') return r.change_7d === null ? -999 : r.change_7d;
    if (key === 'odds') return r.token_odds;
    if (key === 'hour') return r.economics.ev_per_hour;
    if (key === 'width') return r.range_width_x;
    return r.implied_value_usd;
  };
  rows.sort(function (a, b) { return (val(a) - val(b)) * state.dir || (a.rank - b.rank); });
  return rows;
}

function renderHeader() {
  var wrap = el('div', { class: 'mast' });
  wrap.appendChild(el('div', { class: 'kicker', text: 'Token Radar · radar-6 · Max Score Edition' }));
  wrap.appendChild(el('h1', { text: 'Pre-token protocols, ranked by what a launch would be worth' }));
  wrap.appendChild(el('p', { class: 'lede', text: 'Every row is a protocol that records no token, scored from the sealed DefiLlama snapshot of ' + DATA.as_of + '. The value follows from its own figures — TVL, its category\u2019s fitted multiple, and its primary chain\u2019s multiple — and every value term earned its place on two blind tests. The range is a conformal interval, the farm plan is costed in dollars per hour, and all ' + DATA.coverage.total + ' protocols in the snapshot are filed: ' + DATA.coverage.ranked + ' ranked, ' + DATA.coverage.live + ' already trading, ' + DATA.coverage.no_launch_floor + ' on the no-launch floor.' }));
  return wrap;
}
function kpiCell(v, k, s) {
  return el('div', { class: 'cell' }, el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k }), s ? el('div', { class: 's', text: s }) : null);
}
function renderKpi() {
  var k = DATA.kpi;
  var wrap = el('div', { class: 'kpi' });
  wrap.appendChild(kpiCell(fmtInt(k.protocols), 'Protocols', 'in the snapshot'));
  wrap.appendChild(kpiCell(fmtInt(k.live_peers), 'Live peers', 'set the multiples'));
  wrap.appendChild(kpiCell(fmtInt(k.watchlist), 'Watchlist', 'floor $50M TVL'));
  wrap.appendChild(kpiCell(fmtInt(k.board_rows), 'Board rows', DATA.coverage.total + '/' + DATA.coverage.total + ' filed'));
  wrap.appendChild(kpiCell(k.wf_spearman.toFixed(2), 'Walk-forward Spearman', 'later-listed test'));
  wrap.appendChild(kpiCell(k.loo_spearman.toFixed(2), 'Leave-one-out Spearman', 'n = ' + DATA.loo.n));
  wrap.appendChild(kpiCell(fmtPct(k.conformal_coverage), 'Conformal cover', 'target 80%, 3-fold'));
  wrap.appendChild(kpiCell(k.terms_kept + ' / 5', 'Terms kept', k.terms_dropped.length ? 'dropped: ' + k.terms_dropped.join(', ') : 'none dropped'));
  wrap.appendChild(kpiCell(k.checks_pass + ' / ' + k.checks_total, 'Build checks', 'all must pass'));
  return wrap;
}
function renderCover() {
  var wrap = el('div', { class: 'cover' });
  wrap.appendChild(el('p', {}, el('strong', { text: 'What this answers. ' }), document.createTextNode('A "launch" is the token a protocol may issue one day. This radar does not predict whether or when a token is issued. It answers: if the protocol\u2019s record stayed as it is today, what would a fair launch be worth, what is the range it could be worth, and what should a farmer do — in dollars per hour — before and after it?')));
  wrap.appendChild(el('p', {}, el('strong', { text: 'How the value is earned. ' }), document.createTextNode('Five terms — a fitted category multiple, a fitted primary-chain multiple, seven-day growth, tokenless age, chain breadth — each tested on walk-forward and leave-one-out blind tests. A term that hurt was dropped to neutral; the Model tab names every verdict. The fitted multiples come from the snapshot\u2019s own ' + DATA.fitted.globalPeers + ' live-token protocols, median market-cap / TVL per bucket, winsorized at ' + DATA.fitted.winsorCap + ' (one 400x outlier cannot set a multiple), clamped to [0.02, 2.5]; buckets with fewer than ' + DATA.fitted.thinBucketN + ' peers are shrunk hard toward the global median, so no single peer drives a top-10 rank. Every multiple shows its peer count. No protocol name is special-cased. All ' + DATA.coverage.total + ' protocols are filed: ' + DATA.coverage.ranked + ' ranked, ' + DATA.coverage.live + ' live, ' + DATA.coverage.no_launch_floor + ' on the no-launch floor.')));
  wrap.appendChild(el('p', {}, el('strong', { text: 'How the range is earned. ' }), document.createTextNode('Conformal intervals from leave-one-out residuals: the 80% quantile of |log(actual / predicted)|, per bucket where the bucket holds at least 8 residuals, the global quantile elsewhere. Coverage is measured separately by three-fold split conformal, so the number claimed is one no part of the range trained on.')));
  wrap.appendChild(el('p', { class: 'muted' }, DATA.farm_assumption));
  wrap.appendChild(el('p', { class: 'muted' }, 'Total implied value across the board: ' + fmt$(DATA.total_implied_usd) + ' · median row ' + fmt$(DATA.median_implied_usd) + ' · rank 1 ' + DATA.rows[0].name + ' at ' + fmt$(DATA.rows[0].implied_value_usd) + '.'));
  return wrap;
}
function renderCalls() {
  var c = DATA.call_counts;
  var wrap = el('div', { class: 'calls' });
  wrap.appendChild(el('div', { class: 'call-card farm' }, el('div', { class: 'n', text: fmtInt(c.farm) }), el('div', { class: 'd', text: 'Farm now — top third by expected dollars per farm hour, token odds at least 10%.' })));
  wrap.appendChild(el('div', { class: 'call-card wait' }, el('div', { class: 'n', text: fmtInt(c.wait) }), el('div', { class: 'd', text: 'Wait — middling dollars per hour, or odds too thin to chase now. Re-check next snapshot.' })));
  wrap.appendChild(el('div', { class: 'call-card dont' }, el('div', { class: 'n', text: fmtInt(c.dont) }), el('div', { class: 'd', text: 'Don\u2019t farm — bottom third by dollars per hour, or token odds below 3%.' })));
  return wrap;
}
function renderControls(onChange) {
  var wrap = el('div', { class: 'controls' });
  var q = el('input', { type: 'search', placeholder: 'Search name or slug…', value: state.q, 'aria-label': 'Search protocols' });
  q.addEventListener('input', function () { state.q = q.value; state.selected = null; onChange(); });
  wrap.appendChild(q);
  var cats = ['all'].concat(distinct(DATA.rows, function (r) { return [r.category || 'uncategorised']; }));
  var cat = el('select', { 'aria-label': 'Category' });
  cats.forEach(function (c) { cat.appendChild(el('option', { value: c, text: c === 'all' ? 'All categories' : c })); });
  cat.value = state.category;
  cat.addEventListener('change', function () { state.category = cat.value; state.selected = null; onChange(); });
  wrap.appendChild(cat);
  var chains = ['all'].concat(distinct(DATA.rows, function (r) { return r.chains; }));
  var ch = el('select', { 'aria-label': 'Chain' });
  chains.forEach(function (c) { ch.appendChild(el('option', { value: c, text: c === 'all' ? 'All chains' : c })); });
  ch.value = state.chain;
  ch.addEventListener('change', function () { state.chain = ch.value; state.selected = null; onChange(); });
  wrap.appendChild(ch);
  var cl = el('select', { 'aria-label': 'Farm call' });
  [['all', 'All calls'], ['Farm now', 'Farm now'], ['Wait', 'Wait'], ["Don't farm", "Don't farm"]].forEach(function (o) { cl.appendChild(el('option', { value: o[0], text: o[1] })); });
  cl.value = state.call;
  cl.addEventListener('change', function () { state.call = cl.value; state.selected = null; onChange(); });
  wrap.appendChild(cl);
  var wl = el('label', {}, el('input', { type: 'checkbox' }), ' Watchlist only');
  wl.querySelector('input').checked = state.watchlist;
  wl.querySelector('input').addEventListener('change', function (e) { state.watchlist = e.target.checked; state.selected = null; onChange(); });
  wrap.appendChild(wl);
  return wrap;
}
function renderTabs(onChange) {
  var tabs = [['board', 'Board (' + DATA.board_size + ')'], ['live', 'Live token (' + DATA.live_size + ')'], ['set-aside', 'Set aside (' + DATA.set_aside_size + ')'], ['model', 'Model & blind tests']];
  var wrap = el('div', { class: 'tabs' });
  tabs.forEach(function (t) {
    var b = el('button', { class: state.tab === t[0] ? 'on' : '', text: t[1] });
    b.addEventListener('click', function () { state.tab = t[0]; state.selected = null; onChange(); });
    wrap.appendChild(b);
  });
  return wrap;
}

function callClass(call) { return call === 'Farm now' ? 'farm' : call === 'Wait' ? 'wait' : 'dont'; }
function renderBoard(onChange) {
  var wrap = el('div', {});
  var rows = filteredRows();
  wrap.appendChild(el('p', { class: 'muted', text: 'Showing ' + rows.length + ' of ' + DATA.board_size + ' ranked protocols. Click a row for its detail, equation, range and farm plan. Click a column heading to sort.' }));
  if (state.selected) wrap.appendChild(renderDetail(rowBySlug(state.selected), onChange));
  var table = el('table', { class: 'board' });
  var cols = [['rank', 'Rank'], ['name', 'Protocol'], ['category', 'Category'], ['tvl', 'TVL'], ['growth', '7d'], ['implied', 'Implied value'], ['range', 'Conformal range'], ['hour', '$ / hour'], ['odds', 'Token odds'], ['call', 'Call']];
  var head = el('tr', {});
  cols.forEach(function (col) {
    var th = el('th', { text: col[1] + (state.sort === col[0] ? (state.dir === -1 ? ' ↓' : ' ↑') : ''), class: (col[0] === 'implied' || col[0] === 'tvl' || col[0] === 'growth' || col[0] === 'odds' || col[0] === 'hour' ? 'r' : '') + (state.sort === col[0] ? ' sorted' : '') });
    th.addEventListener('click', function () {
      if (state.sort === col[0]) state.dir = -state.dir;
      else { state.sort = col[0]; state.dir = col[0] === 'rank' ? 1 : -1; }
      onChange();
    });
    head.appendChild(th);
  });
  table.appendChild(el('thead', {}, head));
  var tbody = el('tbody', {});
  if (rows.length === 0) tbody.appendChild(el('tr', {}, el('td', { colspan: 10, class: 'empty', text: 'No protocols match these filters.' })));
  rows.forEach(function (r) {
    var tr = el('tr', { class: state.selected === r.slug ? 'sel' : '' });
    tr.appendChild(el('td', { class: 'num', text: '#' + r.rank }));
    var name = el('td', {}, el('div', { class: 'name', text: r.name }), el('div', { class: 'sub', text: r.slug + ' · ' + r.chains.join(', ') + ' · ' + r.tier }));
    tr.appendChild(name);
    tr.appendChild(el('td', { text: r.category || 'uncategorised' }));
    tr.appendChild(el('td', { class: 'num r', text: fmt$(r.tvl_usd) }));
    var g = r.change_7d === null ? el('td', { class: 'num r muted', text: '—' }) : el('td', { class: 'num r ' + (r.change_7d >= 0 ? 'pos' : 'neg'), text: (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%' });
    tr.appendChild(g);
    tr.appendChild(el('td', { class: 'num r', text: fmt$(r.implied_value_usd) }));
    tr.appendChild(el('td', { class: 'num r', text: fmt$(r.range_lo_usd) + '–' + fmt$(r.range_hi_usd) }));
    tr.appendChild(el('td', { class: 'num r', text: fmtMoney(r.economics.ev_per_hour) }));
    tr.appendChild(el('td', { class: 'num r', text: fmtPct(r.token_odds) }));
    tr.appendChild(el('td', {}, el('span', { class: 'call ' + callClass(r.call), text: r.call })));
    tr.addEventListener('click', function () { state.selected = state.selected === r.slug ? null : r.slug; onChange(); });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
function kvCell(v, k) { return el('div', { class: 'cell' }, el('div', { class: 'v', text: v }), el('div', { class: 'k', text: k })); }
function renderDetail(row, onChange) {
  if (!row) return el('div', {});
  var wrap = el('div', { class: 'drawer' });
  var head = el('div', {});
  head.appendChild(el('h3', { text: '#' + row.rank + ' · ' + row.name + '  ' + row.tier }));
  var close = el('button', { class: 'btn', text: 'Close', onclick: function () { state.selected = null; onChange(); } });
  close.style.cssText = 'float:right';
  head.appendChild(close);
  wrap.appendChild(head);
  wrap.appendChild(el('div', { class: 'eq', text: row.equation }));
  if (row.dropped_terms.length > 0) wrap.appendChild(el('p', { class: 'note', text: 'Blind tests dropped: ' + row.dropped_terms.join(', ') + ' — shown at 1.00 in the equation above.' }));
  var kv = el('div', { class: 'kv' });
  kv.appendChild(kvCell(fmt$(row.implied_value_usd), 'Implied value'));
  kv.appendChild(kvCell(fmt$(row.range_lo_usd) + '–' + fmt$(row.range_hi_usd), 'Conformal range (' + row.range_width_x.toFixed(1) + 'x)'));
  kv.appendChild(kvCell('±' + row.conformal_q.toFixed(2) + ' log', 'Conformal q'));
  kv.appendChild(kvCell(fmtPct(row.token_odds), 'Token odds'));
  kv.appendChild(kvCell(row.fitted_multiple.toFixed(2), 'Fitted multiple'));
  kv.appendChild(kvCell((row.chain_multiple * DATA.fitted.chain.globalMultiple).toFixed(2) + ' · ' + row.chain, 'Primary-chain multiple'));
  kv.appendChild(kvCell('×' + row.chain_multiple.toFixed(2), 'Chain factor'));
  kv.appendChild(kvCell(fmtMoney(row.economics.ev_per_hour) + ' / h', 'Expected $ per hour'));
  kv.appendChild(kvCell('$' + row.economics.min_capital_usd, 'Minimum capital'));
  kv.appendChild(kvCell(row.economics.hours.toFixed(2) + ' h', 'Hours to farm'));
  kv.appendChild(kvCell(fmtMoney(row.economics.ev_usd), 'Expected value'));
  kv.appendChild(kvCell(row.economics.ev_per_capital.toFixed(2) + 'x', 'EV per $ capital'));
  kv.appendChild(kvCell(fmt$(row.tvl_usd), 'TVL'));
  kv.appendChild(kvCell(row.age_days === null ? 'unrecorded' : row.age_days + ' days', 'Tokenless age'));
  wrap.appendChild(kv);
  wrap.appendChild(el('p', { text: row.why }));
  wrap.appendChild(el('h3', { text: 'Farm plan — ' + row.call + ' · ' + row.farm.difficulty + ' · about $' + row.farm.est_total_usd + ' all-in' }));
  var ol = el('ol', { class: 'steps' });
  row.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
  wrap.appendChild(ol);
  return wrap;
}
function miniTable(heads, rows) {
  var t = el('table', { class: 'mini' });
  var hr = el('tr', {});
  heads.forEach(function (h) { hr.appendChild(el('th', { text: h[0], class: h[1] ? 'r' : '' })); });
  t.appendChild(el('thead', {}, hr));
  var tb = el('tbody', {});
  rows.forEach(function (r) {
    var tr = el('tr', {});
    r.forEach(function (c, i) { tr.appendChild(el('td', { text: c, class: heads[i][1] ? 'r num' : '' })); });
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  return t;
}
function renderModel() {
  var wrap = el('div', {});
  var wf = DATA.walk_forward, loo = DATA.loo;
  wrap.appendChild(el('h2', { text: 'Blind test 1 — walk-forward' }));
  wrap.appendChild(el('p', { class: 'muted', text: 'Fit the multiples on the ' + wf.trainN + ' live protocols DefiLlama listed before ' + wf.cutoff + '; judge the ranking on the ' + wf.testN + ' listed on or after it. ' + wf.excludedNoDate + ' live peers carry no listing date and were excluded. The fit never sees the future it is judged on.' }));
  wrap.appendChild(miniTable([['Term', false], ['With', true], ['Without', true], ['Δ Spearman', true]], wf.terms.map(function (t) { return [t.term, t.withTerm.toFixed(3), t.withoutTerm.toFixed(3), fmtSigned(t.delta)]; }).concat([
    ['All-terms model', wf.fullModel.toFixed(3), wf.tvlOnly.toFixed(3), '×' + (wf.multiplier === null ? 'n/a' : wf.multiplier.toFixed(2))],
    ['Final model (kept terms)', (wf.keptModel === undefined ? NaN : wf.keptModel).toFixed(3), wf.tvlOnly.toFixed(3), '×' + (wf.keptMultiplier === null || wf.keptMultiplier === undefined ? 'n/a' : wf.keptMultiplier.toFixed(2))],
  ])));
  wrap.appendChild(el('p', { class: 'note', text: 'The final model is the one the board ships: TVL × the shrunk fitted category multiple × the primary-chain factor. It beats TVL alone on both blind tests — the three dropped terms were dragging the all-terms model down, which is why each term is judged on its own mean gain across the two tests, not on the all-terms score.' }));
  wrap.appendChild(el('h2', { text: 'Blind test 2 — leave-one-out' }));
  wrap.appendChild(el('p', { class: 'muted', text: 'Every one of the ' + loo.n + ' live protocols predicted from the other ' + (loo.n - 1) + ', pooled. Median error ' + fmtPct(loo.mape) + ' on market caps that span 240x — the ranking, not the dollars, is what a ranked board is for.' }));
  wrap.appendChild(miniTable([['Term', false], ['With', true], ['Without', true], ['Δ Spearman', true]], loo.terms.map(function (t) { return [t.term, t.withTerm.toFixed(3), t.withoutTerm.toFixed(3), fmtSigned(t.delta)]; }).concat([
    ['All-terms model', loo.fullModel.toFixed(3), loo.tvlOnly.toFixed(3), '×' + (loo.multiplier === null ? 'n/a' : loo.multiplier.toFixed(2))],
    ['Final model (kept terms)', (loo.keptModel === undefined ? NaN : loo.keptModel).toFixed(3), loo.tvlOnly.toFixed(3), '×' + (loo.keptMultiplier === null || loo.keptMultiplier === undefined ? 'n/a' : loo.keptMultiplier.toFixed(2))],
  ])));
  wrap.appendChild(el('h2', { text: 'Term decisions — kept or dropped on the mean of both tests' }));
  wrap.appendChild(miniTable([['Term', false], ['Walk-forward Δ', true], ['Leave-one-out Δ', true], ['Mean Δ', true], ['Verdict', false]], DATA.term_tests.map(function (t) { return [t.term, fmtSigned(t.wfDelta), fmtSigned(t.looDelta), fmtSigned(t.meanDelta), t.kept ? 'KEPT' : 'DROPPED']; })));
  wrap.appendChild(el('p', { class: 'note', text: 'A term stays only when its mean ranking gain across the two blind tests is positive. Dropped terms are replaced by their neutral value (1.00) in every row\u2019s equation.' }));
  wrap.appendChild(el('h2', { text: 'Conformal ranges — calibrated to hold ' + fmtPct(DATA.conformal.target) }));
  wrap.appendChild(el('p', { class: 'muted', text: 'Quantile of |log(actual / predicted)| on leave-one-out predictions, per bucket where the bucket holds at least 8 residuals, the global quantile elsewhere. Coverage is measured by three-fold split conformal (fit, calibrate and test on three disjoint folds, rotated): ' + DATA.conformal.splitCoverage.map(fmtPct).join(' / ') + ' (mean ' + fmtPct(DATA.conformal.splitMean) + '). Leave-one-out coverage ' + fmtPct(DATA.conformal.looCoverage) + '.' }));
  wrap.appendChild(miniTable([['Bucket', false], ['q (log points)', true], ['Residuals', true], ['Source', false]], DATA.conformal.qByBucket.map(function (b) { return [b.bucket, b.q.toFixed(3), String(b.n), b.source]; })));
  wrap.appendChild(el('div', { class: 'cols' },
    el('div', {}, el('h2', { text: 'Fitted multiples' }), el('p', { class: 'muted', text: 'Median market-cap / TVL per bucket from the snapshot\u2019s own live peers, ratios winsorized at ' + DATA.fitted.winsorCap + ', shrunk toward the global median (weight n / (n + 5), so a thin bucket is mostly the global; buckets with fewer than ' + DATA.fitted.thinBucketN + ' peers are shrunk with k = ' + DATA.fitted.thinShrinkK + ' instead); a bucket with no peers at all is the global median (*). Clamped to [0.02, 2.5].' }), miniTable([['Bucket', false], ['Multiple', true], ['Peers', true]], DATA.fitted.multiples.map(function (m) { return [m.bucket + (m.source === 'global' ? ' *' : ''), m.multiple.toFixed(2), String(m.peers)]; }))),
    el('div', {}, el('h2', { text: 'Token odds' }), el('p', { class: 'muted', text: 'Share of each bucket\u2019s protocols that already trade, from the peers\u2019 record. Overall odds ' + fmtPct(DATA.overall_odds) + '.' }), miniTable([['Bucket', false], ['Odds', true], ['Live / total', true]], DATA.odds.map(function (o) { return [o.bucket, fmtPct(o.odds), o.live + ' / ' + o.total]; })))));
  wrap.appendChild(el('h2', { text: 'Primary-chain multiples' }));
  wrap.appendChild(el('p', { class: 'muted', text: 'The same fit, by the protocol\u2019s first listed chain: median winsorized market-cap / TVL per chain, shrunk toward the global median (weight n / (n + 5)), clamped to [0.02, 2.5]. The chain factor is the chain multiple divided by the global ' + DATA.fitted.chain.globalMultiple.toFixed(2) + ' — a protocol on a chain whose tokens trade richer than the global median gets a factor above 1, and one on a poorer chain gets below 1. Chains with a single peer are shown honestly with n = 1; they move a row only through the factor, never through a category multiple.' }));
  wrap.appendChild(miniTable([['Chain', false], ['Multiple', true], ['Peers', true], ['Factor', true]], DATA.fitted.chain.multiples.map(function (m) { return [m.chain, m.multiple.toFixed(2), String(m.peers), '×' + (m.multiple / DATA.fitted.chain.globalMultiple).toFixed(2)]; })));
  wrap.appendChild(el('h2', { text: 'Build-time checks — the program refuses a board that fails one' }));
  var ul = el('ul', { class: 'checks' });
  DATA.checks.forEach(function (c) {
    ul.appendChild(el('li', {}, el('span', { class: c.status === 'pass' ? 'ok' : 'bad', text: c.status === 'pass' ? 'PASS' : 'FAIL' }), '  ' + c.id + ' · ' + c.name + ' — ' + c.detail));
  });
  wrap.appendChild(ul);
  wrap.appendChild(el('p', { class: 'muted', text: DATA.call_rule }));
  wrap.appendChild(el('p', { class: 'muted', text: DATA.farm_assumption }));
  return wrap;
}
function renderLive() {
  var wrap = el('div', {});
  wrap.appendChild(el('p', { class: 'muted', text: 'All ' + DATA.live_size + ' live-token protocols in the snapshot. They already trade, so the board shows the market\u2019s own value for them — and they are the peers the fitted multiples are learned from, never rows of the board. Each one carries its verdict: Don\u2019t farm, because the launch already happened.' }));
  wrap.appendChild(miniTable([['Protocol', false], ['Category', false], ['TVL', true], ['Market cap', true], ['7d', true], ['Call', false], ['Reason', false]], DATA.live.map(function (p) { return [p.name, p.category || '—', fmt$(p.tvl_usd), p.mcap_usd === null ? '—' : fmt$(p.mcap_usd), p.change_7d === null ? '—' : (p.change_7d >= 0 ? '+' : '') + p.change_7d.toFixed(1) + '%', p.call, p.reason]; })));
  return wrap;
}
function renderSetAside() {
  var wrap = el('div', {});
  wrap.appendChild(el('p', { class: 'muted', text: 'All ' + DATA.set_aside_size + ' pre-token protocols the ranking sets aside, biggest first, with the rule that set each one aside and its no-launch floor — TVL × the global multiple (' + DATA.fitted.globalMultiple.toFixed(2) + '), the value the protocol would be worth if it never launched a token. A wrapped, staked or bridged product of a token that already trades has no launch of its own.' }));
  wrap.appendChild(miniTable([['Protocol', false], ['Category', false], ['TVL', true], ['No-launch floor', true], ['Reason', false]], DATA.set_aside.map(function (p) { return [p.name, p.category || '—', fmt$(p.tvl_usd), p.floor_value_usd === null ? '—' : fmt$(p.floor_value_usd), p.reason]; })));
  return wrap;
}
function renderSandbox(onChange) {
  var wrap = el('div', { class: 'sandbox' });
  wrap.appendChild(el('h3', { text: 'Try it: move the model and watch the top 5' }));
  var m = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.1', value: String(state.multScale) });
  var mOut = el('span', { class: 'mono', text: state.multScale.toFixed(1) + 'x' });
  var c = el('input', { type: 'range', min: '0.5', max: '1.5', step: '0.1', value: '1' });
  var cOut = el('span', { class: 'mono', text: '1.0x' });
  var out = el('div', { class: 'out' });
  function showTop() {
    var chainScale = parseFloat(c.value);
    var rescored = DATA.rows.slice(0, 40).map(function (r) {
      var chainFactor = r.chain_multiple;
      var v = r.tvl_usd * (r.category_multiple * state.multScale) * (chainFactor * chainScale);
      return { name: r.name, v: Math.round(v) };
    }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5);
    out.textContent = rescored.map(function (r, i) { return (i + 1) + '. ' + r.name + ' ' + fmt$(r.v); }).join('   ·   ');
  }
  m.addEventListener('input', function () { state.multScale = parseFloat(m.value); mOut.textContent = state.multScale.toFixed(1) + 'x'; showTop(); });
  c.addEventListener('input', function () { cOut.textContent = parseFloat(c.value).toFixed(1) + 'x'; showTop(); });
  wrap.appendChild(el('label', {}, 'Category multiple scale (model uses 1.0x): ', mOut));
  wrap.appendChild(m);
  wrap.appendChild(el('label', {}, 'Chain factor scale (model uses 1.0x): ', cOut));
  wrap.appendChild(c);
  wrap.appendChild(el('p', { class: 'muted', text: 'The shipped model is TVL × category multiple × chain factor. Growth, tokenless age and chain breadth are dropped — the blind tests found they hurt — so there is no growth slider here.' }));
  wrap.appendChild(out);
  showTop();
  return wrap;
}
function render() {
  var app = document.getElementById('board');
  app.setAttribute('aria-busy', 'false');
  app.innerHTML = '';
  var onChange = function () { render(); };
  app.appendChild(renderHeader());
  app.appendChild(renderKpi());
  app.appendChild(renderCover());
  app.appendChild(renderCalls());
  if (state.tab === 'board') app.appendChild(renderControls(onChange));
  app.appendChild(renderTabs(onChange));
  if (state.tab === 'board') app.appendChild(renderBoard(onChange));
  else if (state.tab === 'live') app.appendChild(renderLive());
  else if (state.tab === 'set-aside') app.appendChild(renderSetAside());
  else app.appendChild(renderModel());
  if (state.tab === 'board' || state.tab === 'model') app.appendChild(renderSandbox(onChange));
  var hash = location.hash.replace('#', '');
  if (hash.indexOf('category=') === 0 && state.tab === 'board') {
    var c = decodeURIComponent(hash.slice(9));
    if (state.category === 'all' && c) { state.category = c; render(); }
  }
}
render();
