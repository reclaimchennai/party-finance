/* Party Finance Explorer
 * Views: overview · finance · bonds · compliance · registry · documents, plus a party drawer.
 * State lives in the URL hash (#view?key=value&...) so every filtered view is shareable. */

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ------------------------------------------------------------ DOM helpers */
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
function s(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
const icon = (id, cls = '') => { const v = s('svg', { class: cls, 'aria-hidden': 'true' }); v.append(s('use', { href: '#' + id })); return v; };

/* ------------------------------------------------------------- formatting */
const CR = 1e7, LAKH = 1e5;
function inr(v, { short = false } = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a >= CR) { const c = a / CR; return `${sign}₹${c.toLocaleString('en-IN', { maximumFractionDigits: c >= 1000 ? 0 : c >= 100 ? 1 : 2 })} Cr`; }
  if (a >= LAKH) return `${sign}₹${(a / LAKH).toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`;
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
}
const num = v => (v ?? 0).toLocaleString('en-IN');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
function tickFmt(v) {
  const a = Math.abs(v);
  if (a >= CR) return `${v < 0 ? '−' : ''}${(a / CR).toLocaleString('en-IN', { maximumFractionDigits: a / CR >= 10 ? 0 : 1 })} Cr`;
  if (a >= LAKH) return `${v < 0 ? '−' : ''}${(a / LAKH).toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`;
  if (a >= 1000) return `${v < 0 ? '−' : ''}${(a / 1000).toFixed(0)}K`;
  return String(v);
}
function niceTicks(min, max, n = 4) {
  if (max === min) max = min + 1;
  const span = max - min, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 0.5) || mag * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toPrecision(12));
  return out;
}
const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------------------------------------------------------------- tooltip */
const tip = { el: null };
function showTip(evt, build) {
  const el = tip.el; el.replaceChildren(); build(el); el.classList.add('on');
  const pad = 14, r = el.getBoundingClientRect();
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  el.style.left = Math.max(8, x) + 'px'; el.style.top = Math.max(8, y) + 'px';
}
const hideTip = () => tip.el.classList.remove('on');
function tipRows(el, title, sub, rows, src) {
  el.append(h('div', { class: 't', text: title }));
  if (sub) el.append(h('div', { class: 's', text: sub }));
  if (rows?.length) {
    const dl = h('dl');
    for (const r of rows) {
      dl.append(h('dt', {}, r.color ? h('span', { class: r.line ? 'key' : 'sw', style: `background:${r.color}` }) : null, r.label));
      dl.append(h('dd', { text: r.value }));
    }
    el.append(dl);
  }
  if (src) el.append(h('div', { class: 'src', text: src }));
}

/* ----------------------------------------------------------------- charts */
const SLOT = i => `var(--series-${(i % 8) + 1})`;

/** Horizontal ranked bars. rows: [{key,label,value,color?,sub?}] */
function barChart(host, rows, o = {}) {
  host.replaceChildren();
  if (!rows.length) { host.append(h('div', { class: 'empty', text: o.empty || 'No data for this selection.' })); return; }
  const W = Math.max(320, host.clientWidth || 600), labW = Math.min(o.labelWidth || 170, W * 0.38), rowH = o.rowH || 26, barH = Math.min(18, rowH - 8);
  const top = 22, H = top + rows.length * rowH + 6, valW = 74;
  const vals = rows.map(r => r.value), min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const ticks = niceTicks(min, max, Math.max(3, Math.floor((W - labW) / 110)));
  // negative bars get room on the left for their value labels
  const x0 = labW + 8 + (min < 0 ? 72 : 0), x1 = W - valW, sx = v => x0 + ((v - ticks[0]) / (ticks.at(-1) - ticks[0])) * (x1 - x0);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': o.aria || 'Ranked bar chart' });
  for (const t of ticks) {
    svg.append(s('line', { class: 'grid-line', x1: sx(t), x2: sx(t), y1: top - 4, y2: H - 4 }));
    svg.append(s('text', { class: 'tick', x: sx(t), y: 12, 'text-anchor': 'middle' }, tickFmt(t)));
  }
  const zx = sx(0);
  rows.forEach((r, i) => {
    const y = top + i * rowH, cy = y + rowH / 2, g = s('g', { class: 'bar-row' + (o.onClick ? ' clickable' : '') });
    const lab = s('text', { class: 'row-label' + (r.hl ? ' hl' : '') + (o.onClick ? ' clickable' : ''), x: labW, y: cy + 4, 'text-anchor': 'end' }, trunc(r.label, labW / 6.6));
    const a = sx(Math.min(0, r.value)), b = sx(Math.max(0, r.value)), w = Math.max(1, b - a);
    const neg = r.value < 0, rad = Math.min(4, w / 2);
    // 4px rounded data end, square at the baseline
    const x = a, yb = cy - barH / 2;
    const d = neg
      ? `M${x + w},${yb} H${x + rad} Q${x},${yb} ${x},${yb + rad} V${yb + barH - rad} Q${x},${yb + barH} ${x + rad},${yb + barH} H${x + w} Z`
      : `M${x},${yb} H${x + w - rad} Q${x + w},${yb} ${x + w},${yb + rad} V${yb + barH - rad} Q${x + w},${yb + barH} ${x + w - rad},${yb + barH} H${x} Z`;
    const bar = s('path', { class: 'bar' + (r.dim ? ' dim' : ''), d, fill: r.color || SLOT(0) });
    const vl = s('text', { class: 'val-label', x: neg ? a - 4 : b + 4, y: cy + 4, 'text-anchor': neg ? 'end' : 'start' }, (o.fmt || inr)(r.value));
    const hit = s('rect', { class: 'hit', x: 0, y, width: W, height: rowH });
    g.append(hit, bar, lab, vl);
    g.addEventListener('pointermove', e => showTip(e, el => tipRows(el, r.label, r.sub, [{ label: o.valueLabel || 'Value', value: (o.fmt || inr)(r.value), color: r.color || SLOT(0) }, ...(r.extra || [])], r.src)));
    g.addEventListener('pointerleave', hideTip);
    if (o.onClick) g.addEventListener('click', () => o.onClick(r));
    svg.append(g);
  });
  if (min < 0) svg.append(s('line', { class: 'zero-line', x1: zx, x2: zx, y1: top - 4, y2: H - 4 }));
  host.append(svg);
}
const trunc = (t, n) => (t.length > n ? t.slice(0, Math.max(3, n - 1)) + '…' : t);

/** Multi-series line chart with crosshair. series: [{key,label,color,points:{x:v}}], xs ordered */
function lineChart(host, xs, series, o = {}) {
  host.replaceChildren();
  const live = series.filter(se => xs.some(x => se.points[x] != null));
  if (!live.length || !xs.length) { host.append(h('div', { class: 'empty', text: o.empty || 'No values to plot for this selection.' })); return; }
  const W = Math.max(320, host.clientWidth || 600), H = o.height || 280, m = { l: 62, r: live.length <= 4 ? 96 : 16, t: 14, b: 28 };
  const all = live.flatMap(se => xs.map(x => se.points[x]).filter(v => v != null));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
  const sx = i => m.l + (xs.length === 1 ? (W - m.l - m.r) / 2 : (i / (xs.length - 1)) * (W - m.l - m.r));
  const sy = v => m.t + (1 - (v - ticks[0]) / (ticks.at(-1) - ticks[0])) * (H - m.t - m.b);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': o.aria || 'Line chart' });
  for (const t of ticks) {
    svg.append(s('line', { class: t === 0 ? 'zero-line' : 'grid-line', x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }));
    svg.append(s('text', { class: 'tick', x: m.l - 8, y: sy(t) + 4, 'text-anchor': 'end' }, (o.tick || tickFmt)(t)));
  }
  const every = Math.ceil(xs.length / Math.floor((W - m.l - m.r) / 64));
  xs.forEach((x, i) => { if (i % every === 0 || i === xs.length - 1) svg.append(s('text', { class: 'tick', x: sx(i), y: H - 8, 'text-anchor': 'middle' }, x)); });
  const ends = [];
  for (const se of live) {
    let d = '', pen = false;
    xs.forEach((x, i) => { const v = se.points[x]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${sx(i)},${sy(v)}`; pen = true; });
    svg.append(s('path', { class: 'series-line', d, stroke: se.color, 'stroke-width': 2 }));
    xs.forEach((x, i) => { const v = se.points[x]; if (v != null) svg.append(s('circle', { class: 'dot', cx: sx(i), cy: sy(v), r: 4, fill: se.color })); });
    const lastI = xs.map((x, i) => (se.points[x] != null ? i : -1)).filter(i => i >= 0).at(-1);
    ends.push({ se, y: sy(se.points[xs[lastI]]), x: sx(lastI) });
  }
  if (live.length <= 4) {
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].ly = (ends[i - 1].ly ?? ends[i - 1].y) + 13;
    for (const e of ends) svg.append(s('text', { class: 'end-label', x: W - m.r + 8, y: (e.ly ?? e.y) + 4 }, trunc(e.se.label, 13)));
  }
  const cross = s('line', { class: 'crosshair', y1: m.t, y2: H - m.b, visibility: 'hidden' });
  const hit = s('rect', { class: 'hit', x: m.l - 10, y: 0, width: W - m.l - m.r + 20, height: H });
  svg.append(cross, hit);
  hit.addEventListener('pointermove', e => {
    const pt = svg.getBoundingClientRect(), px = ((e.clientX - pt.left) / pt.width) * W;
    let best = 0; xs.forEach((x, i) => { if (Math.abs(sx(i) - px) < Math.abs(sx(best) - px)) best = i; });
    cross.setAttribute('x1', sx(best)); cross.setAttribute('x2', sx(best)); cross.setAttribute('visibility', 'visible');
    const x = xs[best];
    const rows = live.map(se => ({ se, v: se.points[x] })).sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
      .map(({ se, v }) => ({ label: se.label, value: v == null ? '—' : (o.fmt || inr)(v), color: se.color, line: true }));
    showTip(e, el => tipRows(el, o.xLabel ? o.xLabel(x) : x, o.sub, rows));
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  host.append(svg);
}

/** Stacked columns. stacks: [{key,label,color,points:{x:v}}] bottom→top */
function stackedColumns(host, xs, stacks, o = {}) {
  host.replaceChildren();
  if (!xs.length) { host.append(h('div', { class: 'empty', text: o.empty || 'No data for this selection.' })); return; }
  const W = Math.max(320, host.clientWidth || 600), H = o.height || 260, m = { l: 58, r: 8, t: 12, b: 28 };
  const totals = xs.map(x => stacks.reduce((a, st) => a + (st.points[x] || 0), 0));
  const ticks = niceTicks(0, o.percent ? 1 : Math.max(...totals, 1), 4);
  const band = (W - m.l - m.r) / xs.length, bw = Math.max(2, Math.min(24, band - 2));
  const sy = v => m.t + (1 - v / ticks.at(-1)) * (H - m.t - m.b);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': o.aria || 'Stacked column chart' });
  for (const t of ticks) {
    svg.append(s('line', { class: 'grid-line', x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }));
    svg.append(s('text', { class: 'tick', x: m.l - 8, y: sy(t) + 4, 'text-anchor': 'end' }, o.percent ? `${Math.round(t * 100)}%` : tickFmt(t)));
  }
  const every = Math.max(1, Math.ceil(xs.length / Math.floor((W - m.l) / 58)));
  xs.forEach((x, i) => {
    const cx = m.l + band * i + band / 2, tot = totals[i];
    if (i % every === 0) svg.append(s('text', { class: 'tick', x: cx, y: H - 8, 'text-anchor': 'middle' }, o.xLabel ? o.xLabel(x) : x));
    let acc = 0;
    const g = s('g');
    const visible = stacks.filter(st => st.points[x]);
    visible.forEach((st, j) => {
      const v = o.percent ? st.points[x] / (tot || 1) : st.points[x];
      const y0 = sy(acc), y1 = sy(acc + v); acc += v;
      // 2px surface gap above every segment that has another stacked on it; 4px rounded data-end on the top one
      const top = j === visible.length - 1, yt = top ? y1 : y1 + 2;
      if (y0 - yt <= 0.5) return;
      const r = top ? Math.min(4, y0 - yt, bw / 2) : 0, x0 = cx - bw / 2;
      const d = `M${x0},${y0} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + bw - r} Q${x0 + bw},${yt} ${x0 + bw},${yt + r} V${y0} Z`;
      g.append(s('path', { class: 'bar', d, fill: st.color }));
    });
    const hit = s('rect', { class: 'hit', x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b });
    hit.addEventListener('pointermove', e => showTip(e, el => tipRows(el, o.xLabel ? o.xLabel(x) : x, o.percent ? null : `Total ${inr(tot)}`,
      [...stacks].reverse().filter(st => st.points[x]).map(st => ({ label: st.label, color: st.color, value: o.percent ? `${Math.round((st.points[x] / tot) * 100)}% · ${o.countFmt ? o.countFmt(st.points[x]) : num(st.points[x])}` : (o.fmt || inr)(st.points[x]) })))));
    hit.addEventListener('pointerleave', hideTip);
    if (o.onClick) { hit.classList.add('clickable'); hit.addEventListener('click', () => o.onClick(x)); }
    svg.append(g, hit);
  });
  svg.append(s('line', { class: 'axis-line', x1: m.l, x2: W - m.r, y1: sy(0), y2: sy(0) }));
  host.append(svg);
}

function legend(items, line = false) {
  return h('div', { class: 'legend' }, items.map(it => h('span', { class: 'legend-item' }, h('span', { class: 'swatch' + (line ? ' line' : ''), style: `background:${it.color}` }), it.label)));
}

/* ------------------------------------------------------------ table + CSV */
function dataTable(host, rows, cols, o = {}) {
  const st = o.state || { sort: o.sort || cols[0].key, dir: o.dir || -1, page: 1 };
  const pageSize = o.pageSize || 100;
  function render() {
    const sorted = [...rows].sort((a, b) => {
      const c = cols.find(c => c.key === st.sort), va = c.sortVal ? c.sortVal(a) : a[st.sort], vb = c.sortVal ? c.sortVal(b) : b[st.sort];
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * st.dir;
    });
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize)); st.page = Math.min(st.page, pages);
    const slice = sorted.slice((st.page - 1) * pageSize, st.page * pageSize);
    const thead = h('thead', {}, h('tr', {}, cols.map(c => h('th', {
      class: c.num ? 'num' : '', 'aria-sort': st.sort === c.key ? (st.dir > 0 ? 'ascending' : 'descending') : null,
      onclick: () => { if (st.sort === c.key) st.dir *= -1; else { st.sort = c.key; st.dir = c.num ? -1 : 1; } render(); },
    }, c.label))));
    const tbody = h('tbody', {}, slice.map(r => h('tr', {}, cols.map(c => {
      const v = c.render ? c.render(r) : (c.num ? (c.fmt || inr)(r[c.key]) : r[c.key] ?? '—');
      const cls = [c.num ? 'num' : '', c.wrap ? 'wrap' : '', c.num && r[c.key] < 0 ? 'neg' : ''].join(' ').trim();
      return h('td', { class: cls || null }, v);
    }))));
    const wrap = h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, thead, tbody));
    const pager = pages > 1 ? h('div', { class: 'pager' },
      h('span', { text: `${num((st.page - 1) * pageSize + 1)}–${num(Math.min(st.page * pageSize, sorted.length))} of ${num(sorted.length)}` }),
      h('button', { class: 'ctl small', disabled: st.page <= 1 || null, onclick: () => { st.page--; render(); } }, 'Previous'),
      h('button', { class: 'ctl small', disabled: st.page >= pages || null, onclick: () => { st.page++; render(); } }, 'Next')) : null;
    host.replaceChildren(wrap, pager || '');
  }
  render();
  return st;
}
function downloadCSV(name, rows, cols) {
  const esc = v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = [cols.map(c => esc(c.label)).join(','), ...rows.map(r => cols.map(c => esc(c.csv ? c.csv(r) : r[c.key])).join(','))].join('\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: name });
  document.body.append(a); a.click(); a.remove();
}
const csvBtn = fn => h('button', { class: 'ctl', type: 'button', onclick: fn }, icon('i-download'), 'CSV');

/* -------------------------------------------------------------- controls */
function seg(options, value, onChange, label) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label }, options.map(([v, t]) =>
    h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, t)));
}
function select(label, options, value, onChange) {
  const sel = h('select', { 'aria-label': label, onchange: e => onChange(e.target.value) },
    options.map(([v, t]) => h('option', { value: v, selected: v === value || null }, t)));
  return h('label', { class: 'field' }, h('span', { class: 'lab', text: label }), sel, s('svg', { class: 'chev', viewBox: '0 0 24 24' }));
}
function searchBox(placeholder, value, onInput) {
  const inp = h('input', { type: 'search', placeholder, value: value || '', 'aria-label': placeholder });
  inp.addEventListener('input', debounce(() => onInput(inp.value.trim()), 180));
  return h('label', { class: 'search' }, icon('i-search'), inp);
}
function card(title, sub, body, tools = [], kicker) {
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', { class: 'titles' }, kicker ? h('div', { class: 'kicker', text: kicker }) : null, h('h2', { text: title }), sub ? h('p', { text: sub }) : null),
      tools.length ? h('div', { class: 'card-tools-row', style: 'display:flex;gap:6px;flex-wrap:wrap' }, tools) : null),
    body);
}
const body = (...kids) => h('div', { class: 'card-body' }, ...kids);
function tile(k, v, d, onClick) {
  return h('div', { class: 'tile' + (onClick ? ' link' : ''), onclick: onClick || null, role: onClick ? 'button' : null, tabindex: onClick ? 0 : null },
    h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), d ? h('div', { class: 'd', text: d }) : null);
}

/* Party picker: chips + searchable list (max 8, colour slot follows the party) */
function partyPicker(selected, pool, onChange, max = 8) {
  const wrap = h('div', { class: 'picker' });
  const panel = h('div', { class: 'picker-panel', hidden: true });
  const inp = h('input', { type: 'search', placeholder: 'Search parties…', 'aria-label': 'Search parties' });
  const list = h('div', { class: 'picker-list', role: 'listbox', 'aria-multiselectable': 'true' });
  function renderList() {
    const q = inp.value.trim().toLowerCase();
    const hits = pool.filter(p => !q || p.name.toLowerCase().includes(q) || (p.short || '').toLowerCase().includes(q)).slice(0, 80);
    list.replaceChildren(...hits.map(p => {
      const on = selected.includes(p.k);
      return h('button', { type: 'button', role: 'option', 'aria-selected': String(on), disabled: !on && selected.length >= max || null,
        onclick: () => { onChange(on ? selected.filter(k => k !== p.k) : [...selected, p.k]); } },
      h('span', { class: 'box' }, on ? icon('i-ok', 'tick') : null), p.short && p.short !== p.name ? `${p.short} · ${p.name}` : p.name);
    }));
  }
  inp.addEventListener('input', renderList);
  panel.append(h('div', { class: 'picker-search' }, icon('i-search', 'ic-lead'), inp), list,
    h('div', { class: 'picker-foot' }, h('span', { text: `${selected.length}/${max} compared` }), h('button', { class: 'ctl small', type: 'button', onclick: () => onChange([]) }, 'Clear')));
  selected.forEach((k, i) => {
    const p = P[k]; if (!p) return;
    wrap.append(h('span', { class: 'picker-chip' }, h('span', { class: 'dot', style: `background:${SLOT(i)}` }),
      h('button', { class: 'nm', type: 'button', onclick: () => openParty(k), title: p.name }, p.short || p.name),
      h('button', { class: 'x', type: 'button', 'aria-label': `Remove ${p.name}`, onclick: () => onChange(selected.filter(x => x !== k)) }, icon('i-close'))));
  });
  const add = h('button', { class: 'ctl picker-add', type: 'button', onclick: e => { e.stopPropagation(); panel.hidden = !panel.hidden; if (!panel.hidden) { renderList(); inp.focus(); } } }, '+ Compare party');
  wrap.append(add, panel);
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) panel.hidden = true; });
  return wrap;
}

/* ------------------------------------------------------------------ data */
let D = {}, P = {};
const FYS = [];
const SCOPES = [['tn', 'Tamil Nadu focus'], ['recognised', 'Recognised parties'], ['tnrupp', 'TN unrecognised'], ['all', 'All']];
const inScope = (p, sc) => sc === 'all' || (sc === 'tn' && p.tn) || (sc === 'recognised' && (p.rec === 'National' || p.rec === 'State')) || (sc === 'tnrupp' && p.rec === 'RUPP' && p.state === 'Tamil Nadu');
const label = k => P[k]?.short || P[k]?.name || k;
const longLabel = k => { const p = P[k]; return p ? (p.short && p.short !== p.name ? `${p.short} — ${p.name}` : p.name) : k; };

const METRICS = [
  ['income', 'Total income / receipts'], ['expenditure', 'Total expenditure'], ['surplus', 'Surplus (income − expenditure)'],
  ['donations', 'Donations & contributions (audited)'], ['contributions_24a', 'Form 24A contributions (> ₹20,000)'],
  ['eb_encashed', 'Electoral bonds encashed (SBI)'], ['election_exp', 'Election expenditure (audited)'],
  ['general_fund', 'General / corpus fund (closing)'], ['cash_bank', 'Cash, bank & deposits (closing)'],
];
const metricName = m => METRICS.find(x => x[0] === m)?.[1] || m;

const rel = u => (u && u.startsWith('/') && !u.startsWith('//') ? u.slice(1) : u);   // site may live under a sub-path
async function loadJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); }
async function loadCore() {
  const [parties, finance, compliance, documents, meta, bonds, regSummary, tnSummary] = await Promise.all([
    loadJSON('data/dash/parties.json'), loadJSON('data/dash/finance.json'), loadJSON('data/dash/compliance.json'),
    loadJSON('data/dash/documents.json'), loadJSON('data/dash/meta.json'), loadJSON('data/electoral_bonds_all.json'),
    loadJSON('data/all_india_parties_summary.json'), loadJSON('data/tn_rupp_filing_summary.json'),
  ]);
  D = { parties, finance, compliance, documents, meta, bonds, regSummary, tnSummary };
  P = Object.fromEntries(parties.map(p => [p.k, p]));
  FYS.push(...[...new Set(finance.map(r => r.fy))].filter(Boolean).sort());
  // bonds: map SBI party index -> party key
  const byCode = Object.fromEntries(parties.filter(p => p.eb_code).map(p => [p.eb_code, p.k]));
  D.bondParty = bonds.parties.map(p => byCode[p.code] || p.code);
  const tot = {}; bonds.rows.forEach(r => { const k = D.bondParty[r[0]]; tot[k] = (tot[k] || 0) + r[2]; });
  D.bondTop7 = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 7).map(x => x[0]);
}
let registryCache = null, geoCache = null;
const loadRegistry = async () => (registryCache ??= await loadJSON('data/all_india_parties.json'));
const loadGeo = async () => (geoCache ??= await loadJSON('data/india-states.geojson'));

/* ---------------------------------------------------------------- router */
const VIEWS = { overview: viewOverview, finance: viewFinance, bonds: viewBonds, compliance: viewCompliance, registry: viewRegistry, documents: viewDocuments };
function parseHash() {
  const [v, q] = location.hash.slice(1).split('?');
  return { view: VIEWS[v] ? v : 'overview', params: Object.fromEntries(new URLSearchParams(q || '')) };
}
function setParams(patch, { push = false } = {}) {
  const { view, params } = parseHash();
  const next = { ...params, ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] == null) delete next[k];
  const q = new URLSearchParams(next).toString();
  const url = `#${view}${q ? '?' + q : ''}`;
  if (push) location.hash = url; else { history.replaceState(null, '', url); render(); }
}
const go = (view, params = {}) => { location.hash = `#${view}${Object.keys(params).length ? '?' + new URLSearchParams(params) : ''}`; };
let lastView = null;
function render() {
  const { view, params } = parseHash();
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === '#' + view ? 'page' : 'false'));
  const main = $('#main');
  const keepScroll = lastView === view ? scrollY : 0;
  // keep typing focus when a search box re-renders the view
  const act = document.activeElement, focusLabel = act?.tagName === 'INPUT' && main.contains(act) ? act.getAttribute('aria-label') : null;
  const caret = focusLabel ? act.selectionStart : null;
  main.replaceChildren();
  VIEWS[view](main, params);
  if (lastView !== view) scrollTo(0, 0); else scrollTo(0, keepScroll);
  if (focusLabel) { const inp = $$('input', main).find(i => i.getAttribute('aria-label') === focusLabel); if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch { /* type=search */ } } }
  lastView = view;
  if (params.party) openParty(params.party, false);
}

/* ============================================================== OVERVIEW */
function viewOverview(main) {
  const fin = D.finance;
  const audited = fin.filter(r => r.income != null && r.sources.some(x => x.type === 'ECI audited accounts'));
  const heroFY = bestFY(audited) || FYS.at(-1);
  const heroRows = audited.filter(r => r.fy === heroFY);
  const heroTotal = heroRows.reduce((a, r) => a + r.income, 0);
  const ebTotal = D.bonds.rows.reduce((a, r) => a + r[2], 0);
  const reg = D.regSummary;
  const tnAudit = D.tnSummary.filter(r => r.category === 'Annual Audit Report').sort((a, b) => b.year.localeCompare(a.year));
  const tnLatest = tnAudit.find(r => r.submitted > 15) || tnAudit[0];

  main.append(h('div', { class: 'view-head' },
    h('h1', { text: 'Where Indian political parties get their money — and who files on time.' }),
    h('p', { text: 'Audited accounts, Form 24A donation reports, electoral bonds and filing records for recognised parties nationwide and every registered party in Tamil Nadu. Click any party for its full file.' })));
  main.append(h('div', { class: 'hero-fig' },
    h('span', { class: 'big', text: heroRows.length ? inr(heroTotal) : '—' }),
    h('span', { class: 'cap', text: heroRows.length ? `Total income declared by ${heroRows.length} recognised parties in their FY ${heroFY} audited accounts` : 'Audited figures are still being compiled.' })));
  main.append(h('div', { class: 'tiles five', style: 'margin:16px 0 18px' },
    tile('Electoral bonds encashed', inr(ebTotal), `${num(D.bonds.rows.length)} bonds · ${D.bonds.parties.length} parties`, () => go('bonds')),
    tile('Active unrecognised parties', num(reg.active_rupps_2025), 'ECI list of 10 Oct 2025', () => go('registry', { status: 'Registered Unrecognized (RUPP)' })),
    tile('Delisted in 2025', num(reg.delisted_2025['I(B)'] + reg.delisted_2025['I(C)']), `${reg.delisted_2025['I(B)']} + ${reg.delisted_2025['I(C)']} in two rounds`, () => go('registry', { status: 'Delisted / Cancelled', y25: '1' })),
    tile(`TN RUPPs filing audit FY ${tnLatest.year.slice(0, 4)}-${tnLatest.year.slice(-2)}`, pct(tnLatest.submitted, tnLatest.total_rupps), `${tnLatest.submitted} of ${tnLatest.total_rupps} on CEO TN portal`, () => go('compliance')),
    tile('Source documents linked', num(D.documents.length), 'ECI, CEO Tamil Nadu, SBI', () => go('documents'))));

  // Ranked income + bonds
  const incHost = h('div'), ebHost = h('div');
  main.append(h('div', { class: 'grid-2' },
    card(`Declared income, FY ${heroFY}`, 'Recognised parties, from audited accounts. Click a bar to open the party.', body(incHost), [], 'Audited accounts'),
    card('Electoral bonds encashed, 2018–2024', 'All 20,421 bonds redeemed, by recipient party.', body(ebHost), [], 'SBI disclosure')));
  const ebBy = {}; D.bonds.rows.forEach(r => { const k = D.bondParty[r[0]]; ebBy[k] = (ebBy[k] || 0) + r[2]; });
  requestAnimationFrame(() => {
    barChart(incHost, heroRows.sort((a, b) => b.income - a.income).slice(0, 15).map(r => ({ key: r.k, label: label(r.k), value: r.income, sub: P[r.k]?.name, src: srcLine(r) })), { onClick: r => openParty(r.key), valueLabel: 'Income', empty: 'Audited figures are still being compiled.' });
    barChart(ebHost, Object.entries(ebBy).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => ({ key: k, label: label(k), value: v, sub: P[k]?.name })), { onClick: r => openParty(r.key), valueLabel: 'Encashed' });
  });

  // TN RUPP filing trend
  const trendHost = h('div');
  main.append(card('Tamil Nadu unrecognised parties: share that file their reports', 'Per CEO Tamil Nadu. A party counts as filed whether on time or late.', body(trendHost, h('p', { class: 'note', text: 'Due dates: Form 24A by 30 Sept, audited accounts by 31 Oct after each financial year.' })), [], 'Filing compliance'));
  requestAnimationFrame(() => {
    const yrs = [...new Set(D.tnSummary.filter(r => /^\d{4}-\d{4}$/.test(r.year)).map(r => r.year))].sort();
    const series = [['Annual Audit Report', 'Audited accounts'], ['Form 24A Contribution Report', 'Form 24A contributions']].map(([c, l], i) => ({
      key: c, label: l, color: SLOT(i), points: Object.fromEntries(D.tnSummary.filter(r => r.category === c).map(r => [r.year, r.submitted / r.total_rupps])) }));
    trendHost.append(legend(series, true));
    const ch = h('div'); trendHost.append(ch);
    lineChart(ch, yrs, series, { fmt: v => `${Math.round(v * 100)}%`, tick: v => `${Math.round(v * 100)}%`, xLabel: y => `FY ${y}`, height: 240 });
  });

  // TN focus table
  const tnHost = h('div');
  const tnRows = D.parties.filter(p => p.tn).map(p => ({ ...p, latest_income: p.latest_income ?? null }));
  main.append(card('Tamil Nadu focus parties', 'Latest audited or filed figures. Click a name for the full file.', tnHost, [csvBtn(() => downloadCSV('tn_parties.csv', tnRows, TN_COLS))]));
  dataTable(tnHost, tnRows, TN_COLS, { sort: 'latest_income' });
}
const partyCell = r => h('button', { class: 'party-link', type: 'button', onclick: () => openParty(r.k), title: r.name }, r.short && r.short !== r.name ? `${r.short}` : r.name);
const TN_COLS = [
  { key: 'name', label: 'Party', render: partyCell, csv: r => r.name },
  { key: 'rec', label: 'Status' },
  { key: 'latest_fy', label: 'Latest FY' },
  { key: 'latest_income', label: 'Income', num: true },
  { key: 'latest_expenditure', label: 'Expenditure', num: true },
  { key: 'eb_total', label: 'Electoral bonds', num: true },
  { key: 'n_docs', label: 'Filings', num: true, fmt: num },
];
function srcLine(r) {
  const a = r.sources?.find(x => x.type === 'ECI audited accounts') || r.sources?.[0];
  if (!a) return null;
  return `${a.type}${a.page ? `, p.${a.page}` : ''}${a.confidence ? ` · ${a.confidence} confidence` : ''}`;
}

/* =============================================================== FINANCE */
function viewFinance(main, q) {
  const scope = q.scope || 'tn', metric = q.metric || 'income';
  const fyOpts = [...FYS].reverse();
  const withMetric = D.finance.filter(r => r[metric] != null && P[r.k] && inScope(P[r.k], scope));
  const fyAvail = fyOpts.filter(fy => withMetric.some(r => r.fy === fy));
  const fy = q.fy && fyAvail.includes(q.fy) ? q.fy : bestFY(withMetric);
  const sel = (q.p ? q.p.split(',') : []).filter(k => P[k]);
  const query = (q.q || '').toLowerCase();

  main.append(h('div', { class: 'view-head' }, h('h1', { text: 'Party finances' }),
    h('p', { text: 'Compare income, spending, reserves and donations across parties and years. Recognised parties’ figures are read from their ECI audited accounts; Tamil Nadu unrecognised parties’ from the receipts and expenditure they report to the CEO Tamil Nadu.' })));
  const pool = D.parties.filter(p => inScope(p, scope) && D.finance.some(r => r.k === p.k && r[metric] != null));
  main.append(h('div', { class: 'controlbar' },
    seg(SCOPES, scope, v => setParams({ scope: v, fy: '' }), 'Party scope'),
    select('Measure', METRICS, metric, v => setParams({ metric: v })),
    select('Year', fyAvail.map(f => [f, `FY ${f}`]), fy, v => setParams({ fy: v })),
    searchBox('Filter parties', q.q, v => setParams({ q: v })),
    partyPicker(sel, pool, ks => setParams({ p: ks.join(',') }))));

  const rows = withMetric.filter(r => r.fy === fy && (!query || longLabel(r.k).toLowerCase().includes(query))).sort((a, b) => b[metric] - a[metric]);
  const rankHost = h('div', { class: 'chart-wrap' }), trendHost = h('div'), mixHost = h('div');
  const n = rows.length;
  main.append(h('div', { class: 'grid-32' },
    card(`${metricName(metric)}, FY ${fy}`, `${n} part${n === 1 ? 'y' : 'ies'} with a figure. Click a bar to add it to the comparison.`, body(rankHost), [csvBtn(() => downloadCSV(`${metric}_${fy}.csv`, rows, FIN_COLS))], 'Ranking'),
    card(`${metricName(metric)} over time`, sel.length ? 'Compared parties, every year with a figure.' : 'The five largest by income. Add parties to compare your own set.', body(trendHost), [], 'Trend')));
  // default comparison: the five largest by income in the scope's latest well-covered year, so switching measure or year doesn't repaint
  const incRows = D.finance.filter(r => r.income != null && P[r.k] && inScope(P[r.k], scope));
  const incFY = bestFY(incRows);
  const trendKeys = sel.length ? sel : incRows.filter(r => r.fy === incFY).sort((a, b) => b.income - a.income).slice(0, 5).map(r => r.k);
  requestAnimationFrame(() => {
    barChart(rankHost, rows.slice(0, 60).map(r => {
      const i = sel.indexOf(r.k);
      return { key: r.k, label: label(r.k), value: r[metric], sub: P[r.k]?.name, src: srcLine(r), color: sel.length ? (i >= 0 ? SLOT(i) : 'var(--other)') : SLOT(0) };
    }), { onClick: r => setParams({ p: (sel.includes(r.key) ? sel.filter(k => k !== r.key) : [...sel, r.key].slice(-8)).join(',') }), valueLabel: metricName(metric) });
    if (rows.length > 60) rankHost.append(h('p', { class: 'note', text: `Showing the top 60 of ${rows.length}. The table below has every row.` }));
    const xs = FYS.filter(f => D.finance.some(r => r.fy === f && trendKeys.includes(r.k) && r[metric] != null));
    const series = trendKeys.map((k, i) => ({ key: k, label: label(k), color: sel.length ? SLOT(i) : SLOT(i), points: Object.fromEntries(D.finance.filter(r => r.k === k && r[metric] != null).map(r => [r.fy, r[metric]])) }));
    trendHost.append(legend(series, true)); const ch = h('div'); trendHost.append(ch);
    lineChart(ch, xs, series, { xLabel: x => `FY ${x}`, sub: metricName(metric) });
  });

  // Income mix (audited breakdown)
  const BUCKETS = [['donations', 'Donations'], ['eb_reported', 'Electoral bonds (as booked)'], ['membership', 'Membership & fees'], ['interest', 'Interest'], ['other_inc', 'Other']];
  const mixRows = D.finance.filter(r => r.fy === fy && P[r.k] && inScope(P[r.k], scope) && r.income > 0 && (r.donations != null || r.interest != null || r.eb_reported != null))
    .map(r => { const known = (r.donations || 0) + (r.eb_reported || 0) + (r.membership || 0) + (r.interest || 0); return { ...r, other_inc: Math.max(0, r.income - known) }; })
    .sort((a, b) => b.income - a.income).slice(0, 14);
  main.append(card(`Where the money came from, FY ${fy}`, 'Share of audited income by source. “Other” is the remainder of total income not itemised under the four heads.', body(mixHost), [], 'Income mix'));
  requestAnimationFrame(() => {
    if (!mixRows.length) { mixHost.append(h('div', { class: 'empty', text: 'No itemised audited income for this year and scope.' })); return; }
    mixHost.append(legend(BUCKETS.map(([k, l], i) => ({ label: l, color: SLOT(i) }))));
    mixBars(mixHost, mixRows, BUCKETS);
  });

  // Over time, every party: small multiples, one panel per party, each on its own scale
  const share = q.mix === 'share';
  const panelKeys = D.parties.filter(p => inScope(p, scope) && (!sel.length || sel.includes(p.k)) && (!query || longLabel(p.k).toLowerCase().includes(query))).map(p => p.k);
  const latestIncome = k => D.finance.filter(r => r.k === k && r.income != null).sort((a, b) => b.fy.localeCompare(a.fy))[0]?.income ?? -1;
  panelKeys.sort((a, b) => latestIncome(b) - latestIncome(a));
  for (const sec of OVER_TIME) {
    const grid = h('div', { class: 'multiples' });
    const n = panelKeys.filter(k => D.finance.some(r => r.k === k && sec.has(r))).length;
    main.append(card(sec.title, `${n} part${n === 1 ? 'y' : 'ies'} in this scope. ${sec.sub} Each panel has its own scale.`,
      body(legend(sec.parts.map(([, l], i) => ({ label: l, color: sec.colors ? sec.colors[i] : SLOT(i) })), !sec.stack), grid),
      sec.stack ? [seg([['amount', '₹ amount'], ['share', '% share']], share ? 'share' : 'amount', v => setParams({ mix: v === 'share' ? 'share' : '' }), 'Show as')] : [], 'Over time'));
    requestAnimationFrame(() => {
      if (!n) { grid.replaceWith(h('div', { class: 'empty', text: 'No figures for this scope.' })); return; }
      for (const k of panelKeys) {
        const rows = D.finance.filter(r => r.k === k && sec.has(r)).sort((a, b) => a.fy.localeCompare(b.fy));
        if (!rows.length) continue;
        const panel = h('div', { class: 'mini' });
        const last = rows.at(-1);
        panel.append(h('div', { class: 'mini-head' }, h('button', { class: 'party-link', type: 'button', onclick: () => openParty(k), title: P[k]?.name }, label(k)),
          h('span', { class: 'mini-v', text: `${inr(sec.total(last))} · ${last.fy}` })));
        const ch = h('div'); panel.append(ch); grid.append(panel);
        const layers = sec.parts.map(([key, l], i) => ({ key, label: l, color: sec.colors ? sec.colors[i] : SLOT(i), points: Object.fromEntries(rows.map(r => [r.fy, sec.value(r, key)])) }));
        (sec.stack ? miniStack : miniLines)(ch, rows.map(r => r.fy), layers, { share: sec.stack && share, title: P[k]?.name || k });
      }
    });
  }

  // Table
  const tblHost = h('div');
  const allRows = D.finance.filter(r => P[r.k] && inScope(P[r.k], scope) && (!query || longLabel(r.k).toLowerCase().includes(query)) && (!sel.length || sel.includes(r.k)))
    .map(r => ({ ...r, name: P[r.k].name, short: P[r.k].short }));
  main.append(card('All financial records', `${num(allRows.length)} party-years in this scope${sel.length ? ' for the compared parties' : ''}. Sort by any column.`, tblHost,
    [csvBtn(() => downloadCSV(`party_finance_${scope}.csv`, allRows, FIN_COLS))], 'Table'));
  dataTable(tblHost, allRows, FIN_COLS, { sort: 'income' });
}
/* Breakdowns plotted over time. A year with a total but no itemised heads goes to "Not itemised",
 * so a missing breakdown is never passed off as "other". */
const INCOME_HEADS = ['donations', 'eb_reported', 'membership', 'interest'];
const SPEND_HEADS = ['election_exp', 'admin_exp', 'staff_exp', 'publicity_exp'];
function splitTotal(r, total, heads, key) {
  const t = r[total]; if (t == null) return null;
  const itemised = heads.some(hd => r[hd] != null);
  if (key === '_none') return itemised ? 0 : Math.max(0, t);
  if (!itemised) return 0;
  if (key === '_rest') return Math.max(0, t - heads.reduce((a, hd) => a + (r[hd] || 0), 0));
  return Math.max(0, r[key] || 0);
}
const OVER_TIME = [
  { title: 'Income mix over time', sub: 'Stacked by source, from audited accounts (TN unrecognised parties report only a total).', stack: true,
    parts: [['donations', 'Donations'], ['eb_reported', 'Electoral bonds (as booked)'], ['membership', 'Membership & fees'], ['interest', 'Interest'], ['_rest', 'Other income'], ['_none', 'Not itemised']],
    colors: [SLOT(0), SLOT(1), SLOT(2), SLOT(3), SLOT(4), 'var(--other)'],
    has: r => r.income != null && r.income > 0, total: r => r.income, value: (r, k) => splitTotal(r, 'income', INCOME_HEADS, k) },
  { title: 'Spending mix over time', sub: 'Stacked by head of expenditure, from audited accounts.', stack: true,
    parts: [['election_exp', 'Election'], ['admin_exp', 'Administrative'], ['staff_exp', 'Staff'], ['publicity_exp', 'Publicity'], ['_rest', 'Other spending'], ['_none', 'Not itemised']],
    colors: [SLOT(0), SLOT(1), SLOT(2), SLOT(3), SLOT(4), 'var(--other)'],
    has: r => r.expenditure != null && r.expenditure > 0, total: r => r.expenditure, value: (r, k) => splitTotal(r, 'expenditure', SPEND_HEADS, k) },
  { title: 'Money in and out over time', sub: 'Total income against total expenditure; the gap is the year’s surplus or deficit.', stack: false,
    parts: [['income', 'Income'], ['expenditure', 'Expenditure']],
    has: r => r.income != null || r.expenditure != null, total: r => r.income ?? r.expenditure, value: (r, k) => r[k] ?? null },
  { title: 'Reserves over time', sub: 'Closing general / corpus fund and cash, bank and deposits from the balance sheet.', stack: false,
    parts: [['general_fund', 'General / corpus fund'], ['cash_bank', 'Cash, bank & deposits']],
    has: r => r.general_fund != null || r.cash_bank != null, total: r => r.cash_bank ?? r.general_fund, value: (r, k) => r[k] ?? null },
  { title: 'Disclosed donations over time', sub: 'Electoral bonds encashed (SBI data, by encashment year) and Form 24A contributions above ₹20,000.', stack: false,
    parts: [['eb_encashed', 'Electoral bonds encashed'], ['contributions_24a', 'Form 24A contributions']],
    has: r => r.eb_encashed != null || r.contributions_24a != null, total: r => (r.eb_encashed || 0) + (r.contributions_24a || 0), value: (r, k) => r[k] ?? null },
];

/** x position by financial-year start, so a gap year keeps its width (index -> px) */
function yearScale(xs, x0, x1) {
  const ys = xs.map(x => parseInt(x, 10)), lo = Math.min(...ys), hi = Math.max(...ys);
  return i => (hi === lo ? (x0 + x1) / 2 : x0 + ((ys[i] - lo) / (hi - lo)) * (x1 - x0));
}
/** FY ticks: always the ends, inner years only where they don't collide */
function yearLabels(svg, xs, sx, H) {
  const W = 52, keep = xs.map(() => false);
  keep[0] = true; keep[xs.length - 1] = true;
  let lastX = sx(0);
  for (let i = 1; i < xs.length - 1; i++) if (sx(i) - lastX >= W && sx(xs.length - 1) - sx(i) >= W) { keep[i] = true; lastX = sx(i); }
  if (xs.length > 1 && sx(xs.length - 1) - sx(0) < W) keep[0] = false;
  xs.forEach((x, i) => { if (keep[i]) svg.append(s('text', { class: 'tick', x: sx(i), y: H - 5, 'text-anchor': xs.length === 1 ? 'middle' : i === 0 ? 'start' : i === xs.length - 1 ? 'end' : 'middle' }, x)); });
}
/** Small stacked-area panel; a single year draws as one stacked column */
function miniStack(host, xs, layers, o = {}) {
  const W = Math.max(220, host.clientWidth || 260), H = o.height || 130, m = { l: 46, r: 8, t: 8, b: 20 };
  const live = layers.filter(L => xs.some(x => L.points[x]));
  const tot = xs.map(x => live.reduce((a, L) => a + (L.points[x] || 0), 0));
  const val = (L, i) => (L.points[xs[i]] || 0) / (o.share ? (tot[i] || 1) : 1);
  const ticks = o.share ? [0, 0.5, 1] : niceTicks(0, Math.max(...tot, 1), 2);
  const sx = yearScale(xs, m.l, W - m.r);
  const sy = v => m.t + (1 - v / ticks.at(-1)) * (H - m.t - m.b);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${o.title}: stacked chart over time` });
  for (const t of ticks) {
    svg.append(s('line', { class: 'grid-line', x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }));
    svg.append(s('text', { class: 'tick', x: m.l - 5, y: sy(t) + 3.5, 'text-anchor': 'end' }, o.share ? `${Math.round(t * 100)}%` : tickFmt(t)));
  }
  yearLabels(svg, xs, sx, H);
  const acc = xs.map(() => 0);
  for (const L of live) {
    const lo = acc.slice(), hi = xs.map((_, i) => (acc[i] += val(L, i)));
    if (xs.length === 1) {
      const bw = 26, x0 = sx(0) - bw / 2;
      svg.append(s('rect', { class: 'bar', x: x0, y: sy(hi[0]), width: bw, height: Math.max(0, sy(lo[0]) - sy(hi[0])), fill: L.color, stroke: 'var(--surface)', 'stroke-width': 1.5 }));
      continue;
    }
    const top = xs.map((_, i) => `${sx(i)},${sy(hi[i])}`), bot = xs.map((_, i) => `${sx(i)},${sy(lo[i])}`).reverse();
    svg.append(s('path', { d: `M${top.join('L')}L${bot.join('L')}Z`, fill: L.color, 'fill-opacity': 0.82 }));
    svg.append(s('path', { d: `M${top.join('L')}`, fill: 'none', stroke: 'var(--surface)', 'stroke-width': 1.5 }));
  }
  const cross = s('line', { class: 'crosshair', y1: m.t, y2: H - m.b, visibility: 'hidden' });
  const hit = s('rect', { class: 'hit', x: 0, y: 0, width: W, height: H });
  svg.append(cross, hit);
  hit.addEventListener('pointermove', e => {
    const b = svg.getBoundingClientRect(), px = ((e.clientX - b.left) / b.width) * W;
    let i = 0; xs.forEach((_, j) => { if (Math.abs(sx(j) - px) < Math.abs(sx(i) - px)) i = j; });
    cross.setAttribute('x1', sx(i)); cross.setAttribute('x2', sx(i)); cross.setAttribute('visibility', 'visible');
    showTip(e, el => tipRows(el, o.title, `FY ${xs[i]} · total ${inr(tot[i])}`, [...live].reverse().filter(L => L.points[xs[i]]).map(L => ({ label: L.label, color: L.color, value: `${inr(L.points[xs[i]])} · ${Math.round((L.points[xs[i]] / (tot[i] || 1)) * 100)}%` }))));
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  host.append(svg);
}
/** Small multi-line panel sharing the mini layout */
function miniLines(host, xs, layers, o = {}) {
  const W = Math.max(220, host.clientWidth || 260), H = o.height || 130, m = { l: 46, r: 8, t: 8, b: 20 };
  const live = layers.filter(L => xs.some(x => L.points[x] != null));
  const all = live.flatMap(L => xs.map(x => L.points[x]).filter(v => v != null));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(1, ...all), 2);
  const sx = yearScale(xs, m.l, W - m.r);
  const sy = v => m.t + (1 - (v - ticks[0]) / (ticks.at(-1) - ticks[0])) * (H - m.t - m.b);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${o.title}: lines over time` });
  for (const t of ticks) {
    svg.append(s('line', { class: t === 0 ? 'zero-line' : 'grid-line', x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t) }));
    svg.append(s('text', { class: 'tick', x: m.l - 5, y: sy(t) + 3.5, 'text-anchor': 'end' }, tickFmt(t)));
  }
  yearLabels(svg, xs, sx, H);
  for (const L of live) {
    let d = '', pen = false;
    xs.forEach((x, i) => { const v = L.points[x]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${sx(i)},${sy(v)}`; pen = true; });
    svg.append(s('path', { class: 'series-line', d, stroke: L.color, 'stroke-width': 2 }));
    xs.forEach((x, i) => { if (L.points[x] != null) svg.append(s('circle', { class: 'dot', cx: sx(i), cy: sy(L.points[x]), r: 3.5, fill: L.color })); });
  }
  const cross = s('line', { class: 'crosshair', y1: m.t, y2: H - m.b, visibility: 'hidden' });
  const hit = s('rect', { class: 'hit', x: 0, y: 0, width: W, height: H });
  svg.append(cross, hit);
  hit.addEventListener('pointermove', e => {
    const b = svg.getBoundingClientRect(), px = ((e.clientX - b.left) / b.width) * W;
    let i = 0; xs.forEach((_, j) => { if (Math.abs(sx(j) - px) < Math.abs(sx(i) - px)) i = j; });
    cross.setAttribute('x1', sx(i)); cross.setAttribute('x2', sx(i)); cross.setAttribute('visibility', 'visible');
    showTip(e, el => tipRows(el, o.title, `FY ${xs[i]}`, live.map(L => ({ label: L.label, color: L.color, line: true, value: inr(L.points[xs[i]]) }))));
  });
  hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  host.append(svg);
}

/** Latest financial year that most parties have reported (filing runs a year behind) */
function bestFY(rows) {
  const n = {}; rows.forEach(r => (n[r.fy] = (n[r.fy] || 0) + 1));
  const max = Math.max(0, ...Object.values(n));
  return Object.keys(n).sort().reverse().find(f => n[f] >= max * 0.6);
}
function mixBars(host, rows, buckets) {
  const W = Math.max(320, host.clientWidth || 600), labW = 120, rowH = 26, bh = 16, top = 6, H = top + rows.length * rowH;
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  rows.forEach((r, i) => {
    const y = top + i * rowH, g = s('g', { class: 'clickable' });
    g.append(s('rect', { class: 'hit', x: 0, y, width: W, height: rowH }));
    g.append(s('text', { class: 'row-label', x: labW - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end' }, trunc(label(r.k), 16)));
    let x = labW; const span = W - labW - 8;
    buckets.forEach(([k], j) => {
      const v = Math.max(0, r[k] || 0), w = (v / r.income) * span;
      if (w >= 1) g.append(s('rect', { class: 'bar', x, y: y + (rowH - bh) / 2, width: Math.max(0, w - 2), height: bh, rx: 2, fill: SLOT(j) }));
      x += w;
    });
    g.addEventListener('pointermove', e => showTip(e, el => tipRows(el, P[r.k].name, `Total income ${inr(r.income)}`, buckets.map(([k, l], j) => ({ label: l, color: SLOT(j), value: r[k] ? `${inr(r[k])} · ${Math.round((r[k] / r.income) * 100)}%` : '—' })), srcLine(r))));
    g.addEventListener('pointerleave', hideTip);
    g.addEventListener('click', () => openParty(r.k));
    svg.append(g);
  });
  host.append(svg);
}
function sourceCell(r) {
  const out = h('span', { style: 'display:inline-flex;gap:6px;align-items:center' });
  const a = r.sources?.find(x => x.url) ;
  const types = [...new Set((r.sources || []).map(x => x.type))];
  if (a) out.append(h('a', { href: a.url, target: '_blank', rel: 'noopener', title: a.title || a.type }, a.type === 'ECI audited accounts' ? `ECI audit${a.page ? ' p.' + a.page : ''}` : 'CEO TN'));
  else out.append(h('span', { class: 'muted', text: types.join(', ') }));
  const conf = r.audit_confidence;
  if (conf) out.append(h('span', { class: `badge conf-${conf}`, text: conf }));
  return out;
}
const FIN_COLS = [
  { key: 'name', label: 'Party', render: partyCell, csv: r => P[r.k]?.name },
  { key: 'fy', label: 'FY' },
  { key: 'income', label: 'Income', num: true },
  { key: 'expenditure', label: 'Expenditure', num: true },
  { key: 'surplus', label: 'Surplus', num: true },
  { key: 'donations', label: 'Donations', num: true },
  { key: 'contributions_24a', label: 'Form 24A', num: true },
  { key: 'eb_encashed', label: 'Bonds (SBI)', num: true },
  { key: 'election_exp', label: 'Election spend', num: true },
  { key: 'general_fund', label: 'General fund', num: true },
  { key: 'cash_bank', label: 'Cash & deposits', num: true },
  { key: 'src', label: 'Source', render: sourceCell, sortVal: r => r.audit_confidence || '', csv: r => (r.sources || []).map(x => x.url || x.type).join(' | ') },
];

/* ================================================================= BONDS */
function viewBonds(main, q) {
  const B = D.bonds, sel = (q.p ? q.p.split(',') : []).filter(Boolean);
  const y0 = +(q.from || 2018), y1 = +(q.to || 2024), donorQ = (q.donor || '').toLowerCase(), disclosedOnly = q.disc === '1';
  const UNDISCLOSED = B.donors.findIndex(d => d.startsWith('Undisclosed'));
  const rows = B.rows.filter(r => {
    const y = Math.floor(r[3] / 10000);
    if (y < y0 || y > y1) return false;
    if (sel.length && !sel.includes(D.bondParty[r[0]])) return false;
    if (disclosedOnly && r[1] === UNDISCLOSED) return false;
    if (donorQ && !B.donors[r[1]].toLowerCase().includes(donorQ)) return false;
    return true;
  });
  const total = rows.reduce((a, r) => a + r[2], 0), donors = new Set(rows.map(r => r[1])), undis = rows.filter(r => r[1] === UNDISCLOSED).reduce((a, r) => a + r[2], 0);

  main.append(h('div', { class: 'view-head' }, h('h1', { text: 'Electoral bonds' }),
    h('p', { text: 'Every bond redeemed between April 2019 and February 2024 (plus earlier redemptions without purchaser data), matched to its buyer by the alphanumeric number SBI disclosed. Filter by party, buyer or year; click a buyer to see whom they funded.' })));
  const partyPool = [...new Set(D.bondParty)].map(k => P[k] || { k, name: k, short: k });
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => [String(y), String(y)]);
  main.append(h('div', { class: 'controlbar' },
    partyPicker(sel, partyPool, ks => setParams({ p: ks.join(',') })),
    select('From', years, String(y0), v => setParams({ from: v })),
    select('To', years, String(y1), v => setParams({ to: v })),
    searchBox('Buyer name', q.donor, v => setParams({ donor: v })),
    h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(disclosedOnly), onclick: () => setParams({ disc: disclosedOnly ? '' : '1' }) }, h('span', { class: 'knob' }), 'Named buyers only')));
  main.append(h('div', { class: 'tiles', style: 'margin-bottom:16px' },
    tile('Encashed in selection', inr(total), `${num(rows.length)} bonds`),
    tile('Distinct buyers', num(donors.size - (donors.has(UNDISCLOSED) ? 1 : 0)), 'named purchasers'),
    tile('Buyer not disclosed', total ? pct(undis, total) : '—', `${inr(undis)} redeemed without purchase match`),
    tile('Recipient parties', num(new Set(rows.map(r => r[0])).size), `of ${B.parties.length} that encashed bonds`)));

  // Monthly stacked by party (top 7 + Other)
  const byParty = {}; rows.forEach(r => { const k = D.bondParty[r[0]]; byParty[k] = (byParty[k] || 0) + r[2]; });
  const ranked = Object.entries(byParty).sort((a, b) => b[1] - a[1]);
  // colour follows the party: picked parties take their chip colour, otherwise the seven largest recipients overall keep fixed slots
  const topKeys = sel.length ? sel.slice(0, 7) : D.bondTop7;
  const months = {}; rows.forEach(r => { const m = String(Math.floor(r[3] / 100)); months[m] ??= {}; const k = D.bondParty[r[0]]; const key = topKeys.includes(k) ? k : '_other'; months[m][key] = (months[m][key] || 0) + r[2]; });
  const xs = Object.keys(months).sort();
  const stacks = [...topKeys.map((k, i) => ({ key: k, label: label(k), color: SLOT(i) })).filter(st => byParty[st.key]), { key: '_other', label: 'Other parties', color: 'var(--other)' }]
    .map(st => ({ ...st, points: Object.fromEntries(xs.map(x => [x, months[x][st.key] || 0])) })).filter(st => xs.some(x => st.points[x]));
  const monthHost = h('div'), shareHost = h('div', { class: 'chart-wrap' });
  const ml = x => new Date(+x.slice(0, 4), +x.slice(4) - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  main.append(h('div', { class: 'grid-32' },
    card('When bonds were encashed', 'Monthly value by recipient party. Encashment clusters before elections.', body(legend(stacks), monthHost), [], 'Timeline'),
    card(donorQ ? `Parties funded by “${q.donor}”` : 'Share by party', `${ranked.length} parties in this selection.`, body(shareHost), [], 'Recipients')));
  requestAnimationFrame(() => {
    stackedColumns(monthHost, xs, stacks, { xLabel: ml, height: 280 });
    barChart(shareHost, ranked.slice(0, 25).map(([k, v]) => ({ key: k, label: label(k), value: v, sub: `${P[k]?.name || k} · ${pct(v, total)} of selection`, color: topKeys.includes(k) ? SLOT(topKeys.indexOf(k)) : 'var(--other)' })),
      { onClick: r => openParty(r.key), valueLabel: 'Encashed' });
  });

  // Donors
  const dAgg = new Map();
  for (const r of rows) {
    if (r[1] === UNDISCLOSED) continue;
    let d = dAgg.get(r[1]); if (!d) dAgg.set(r[1], d = { donor: B.donors[r[1]], amount: 0, bonds: 0, parties: {}, first: 99999999, last: 0 });
    d.amount += r[2]; d.bonds++; const k = D.bondParty[r[0]]; d.parties[k] = (d.parties[k] || 0) + r[2];
    if (r[4]) { d.first = Math.min(d.first, r[4]); d.last = Math.max(d.last, r[4]); }
  }
  const dRows = [...dAgg.values()].map(d => ({ ...d, n_parties: Object.keys(d.parties).length, top: Object.entries(d.parties).sort((a, b) => b[1] - a[1]) }));
  dRows.sort((a, b) => b.amount - a.amount);
  const topHost = h('div', { class: 'chart-wrap' }), tblHost = h('div');
  main.append(card('Largest named buyers', 'Click a buyer to filter everything to their bonds.', body(topHost), [], 'Buyers'));
  requestAnimationFrame(() => barChart(topHost, dRows.slice(0, 20).map(d => ({ key: d.donor, label: d.donor, value: d.amount, sub: `${d.bonds} bonds · ${d.n_parties} part${d.n_parties === 1 ? 'y' : 'ies'}`, extra: d.top.slice(0, 4).map(([k, v]) => ({ label: label(k), value: inr(v) })) })),
    { onClick: r => setParams({ donor: r.key }), labelWidth: 230, valueLabel: 'Bought & encashed' }));
  const fmtD = v => (v && v < 99999999 ? `${String(v).slice(6, 8)}/${String(v).slice(4, 6)}/${String(v).slice(0, 4)}` : '—');
  const DCOLS = [
    { key: 'donor', label: 'Buyer', render: r => h('button', { class: 'party-link', type: 'button', onclick: () => setParams({ donor: r.donor }) }, r.donor) },
    { key: 'amount', label: 'Amount', num: true },
    { key: 'bonds', label: 'Bonds', num: true, fmt: num },
    { key: 'n_parties', label: 'Parties', num: true, fmt: num },
    { key: 'topp', label: 'Main recipients', wrap: true, sortVal: r => r.top[0]?.[0], render: r => r.top.slice(0, 3).map(([k, v]) => `${label(k)} ${inr(v)}`).join(' · '), csv: r => r.top.map(([k, v]) => `${label(k)}:${v}`).join('; ') },
    { key: 'first', label: 'First purchase', sortVal: r => r.first, render: r => fmtD(r.first), csv: r => fmtD(r.first) },
    { key: 'last', label: 'Last purchase', sortVal: r => r.last, render: r => fmtD(r.last), csv: r => fmtD(r.last) },
  ];
  main.append(card('All buyers', `${num(dRows.length)} named purchasers in this selection.`, tblHost, [csvBtn(() => downloadCSV('electoral_bond_buyers.csv', dRows, DCOLS))], 'Table'));
  dataTable(tblHost, dRows, DCOLS, { sort: 'amount', pageSize: 50 });
}

/* ============================================================ COMPLIANCE */
const STATUS = {
  'On time': { cls: 'ok', icon: 'i-ok', label: 'Filed on time' },
  'Published': { cls: 'ok', icon: 'i-ok', label: 'Published by ECI' },
  'Late': { cls: 'late', icon: 'i-late', label: 'Filed late' },
  'Unknown': { cls: 'late', icon: 'i-late', label: 'Filed (date not shown)' },
  '': { cls: 'late', icon: 'i-late', label: 'Filed (date not shown)' },
  'Not filed': { cls: 'miss', icon: 'i-miss', label: 'Not filed' },
  'Not published': { cls: 'miss', icon: 'i-miss', label: 'Not on ECI site' },
  'Due 31 Oct 2026': { cls: 'pending', icon: 'i-late', label: 'Due 31 Oct 2026' },
};
function viewCompliance(main, q) {
  const scope = q.scope || 'tn', kind = q.kind || 'Annual audit report', query = (q.q || '').toLowerCase(), sort = q.sort || 'worst', hideNever = q.never === '1';
  const scopeName = scope === 'tn' ? 'TN RUPP (CEO Tamil Nadu)' : 'Recognised party (ECI)';
  const recs = D.compliance.filter(r => r.scope === scopeName && r.kind === kind);
  const years = [...new Set(recs.map(r => r.fy))].sort();
  main.append(h('div', { class: 'view-head' }, h('h1', { text: 'Filing compliance' }),
    h('p', { text: scope === 'tn'
      ? 'Every registered unrecognised party in Tamil Nadu must file audited accounts and Form 24A donation reports with the Chief Electoral Officer each year. This is the CEO’s own record of who filed, who filed late and who never did.'
      : 'Recognised parties file with the Election Commission, which publishes the reports. A missing cell means the report is not on the ECI site — it may have been filed but not yet published.' })));
  const kinds = scope === 'tn' ? [['Annual audit report', 'Audited accounts'], ['Contribution report (Form 24A)', 'Form 24A'], ['Election expenditure statement', 'Election expenditure']] : [['Annual audit report', 'Audited accounts'], ['Contribution report (Form 24A)', 'Form 24A']];
  main.append(h('div', { class: 'controlbar' },
    seg([['tn', 'Tamil Nadu RUPPs'], ['eci', 'Recognised parties (ECI)']], scope, v => setParams({ scope: v, kind: '' }), 'Who'),
    seg(kinds, kind, v => setParams({ kind: v }), 'Report'),
    select('Sort', [['worst', 'Worst filers first'], ['best', 'Best filers first'], ['name', 'Name']], sort, v => setParams({ sort: v })),
    searchBox('Filter parties', q.q, v => setParams({ q: v })),
    h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(hideNever), onclick: () => setParams({ never: hideNever ? '' : '1' }) }, h('span', { class: 'knob' }), 'Hide never-filers')));

  // per-year status counts
  const ok = st => STATUS[st]?.cls === 'ok', late = st => STATUS[st]?.cls === 'late', miss = st => STATUS[st]?.cls === 'miss';
  const counts = years.map(y => { const rs = recs.filter(r => r.fy === y); return { y, ok: rs.filter(r => ok(r.status)).length, late: rs.filter(r => late(r.status)).length, miss: rs.filter(r => miss(r.status)).length, pending: rs.some(r => STATUS[r.status]?.cls === 'pending'), n: rs.length }; });
  const byParty = {}; recs.forEach(r => (byParty[r.k] ??= {})[r.fy] = r);
  const partyRows = Object.entries(byParty).map(([k, ys]) => {
    const vals = Object.values(ys), filed = vals.filter(r => ok(r.status) || late(r.status)).length, due = vals.filter(r => !STATUS[r.status] || STATUS[r.status].cls !== 'pending').length;
    return { k, ys, filed, due, rate: due ? filed / due : 0 };
  });
  const never = partyRows.filter(r => r.filed === 0).length;
  // headline year: the latest one whose deadline has passed
  const lastFull = [...counts].reverse().find(c => !c.pending && c.ok + c.late > 0 && c.n > 0) || counts.at(-1) || { y: '', ok: 0, late: 0, miss: 0, n: 0 };
  main.append(h('div', { class: 'tiles', style: 'margin-bottom:16px' },
    tile(`Filed, ${lastFull.y}`, pct(lastFull.ok + lastFull.late, lastFull.n), `${lastFull.ok + lastFull.late} of ${lastFull.n} parties`),
    tile('Of those, late', pct(lastFull.late, lastFull.ok + lastFull.late), `${lastFull.late} filings after the due date`),
    tile(scope === 'tn' ? 'Never filed in any year' : 'Never published', num(never), `of ${partyRows.length} parties listed`),
    tile('Years covered', num(years.length), years.length ? `${years[0]} to ${years.at(-1)} · ${num(recs.length)} records` : '')));

  const trendHost = h('div');
  const statusStacks = [
    { key: 'ok', label: scope === 'tn' ? 'On time' : 'Published', color: 'var(--status-good)' },
    { key: 'late', label: 'Late', color: 'var(--status-warn)' },
    { key: 'miss', label: scope === 'tn' ? 'Not filed' : 'Not on ECI site', color: 'var(--status-critical)' },
  ].map(st => ({ ...st, points: Object.fromEntries(counts.map(c => [c.y, c[st.key]])) })).filter(st => counts.some(c => c[st.key]));
  main.append(card('Filing status by year', 'Share of listed parties. Status colours always come with an icon in the grid below.', body(legend(statusStacks), trendHost), [], 'Trend'));
  requestAnimationFrame(() => stackedColumns(trendHost, years, statusStacks, { percent: true, height: 220, countFmt: v => `${v} parties` }));

  let list = partyRows.filter(r => (!query || longLabel(r.k).toLowerCase().includes(query)) && (!hideNever || r.filed > 0));
  list.sort(sort === 'name' ? (a, b) => label(a.k).localeCompare(label(b.k)) : sort === 'best' ? (a, b) => b.rate - a.rate || b.filed - a.filed : (a, b) => a.rate - b.rate || b.due - a.due);
  const grid = h('div', { class: 'hm', style: `grid-template-columns: minmax(120px, 2.4fr) repeat(${years.length}, minmax(26px, 1fr)) 56px` });
  grid.append(h('div', { class: 'colh', style: 'text-align:left' }, 'Party'), ...years.map(y => h('div', { class: 'colh', text: y.length > 7 ? y : `’${y.slice(2, 4)}` , title: y })), h('div', { class: 'colh', style: 'text-align:right', text: 'Rate' }));
  for (const r of list.slice(0, 400)) {
    grid.append(h('div', { class: 'lab' }, h('button', { class: 'party-link', type: 'button', onclick: () => openParty(r.k), title: longLabel(r.k) }, trunc(P[r.k]?.name || r.k, 44))));
    for (const y of years) {
      const c = r.ys[y], st = c ? STATUS[c.status] || STATUS[''] : null;
      const cell = h('div', { class: 'cell ' + (st ? st.cls : 'na'), dataset: c?.url ? { url: c.url } : {} }, st ? icon(st.icon) : null);
      if (c) {
        cell.addEventListener('pointermove', e => showTip(e, el => tipRows(el, P[r.k]?.name || r.k, `${kind}, ${y}`, [
          { label: 'Status', value: st.label }, ...(c.filed ? [{ label: 'Filed on', value: c.filed }] : []), ...(c.amount != null ? [{ label: 'Amount shown', value: inr(c.amount) }] : [])], c.url ? 'Click to open the filing' : null)));
        cell.addEventListener('pointerleave', hideTip);
        if (c.url) cell.addEventListener('click', () => open(c.url, '_blank', 'noopener'));
      }
      grid.append(cell);
    }
    grid.append(h('div', { class: 'rate', text: r.due ? `${Math.round(r.rate * 100)}%` : '—' }));
  }
  const key = h('div', { class: 'status-key' }, ['On time', 'Late', 'Not filed', ...(scope === 'eci' ? ['Due 31 Oct 2026'] : [])].map(stName => { const st = STATUS[scope === 'eci' && stName === 'On time' ? 'Published' : scope === 'eci' && stName === 'Not filed' ? 'Not published' : stName]; return h('span', {}, h('span', { class: 'cell ' + st.cls, style: 'display:inline-grid' }, icon(st.icon)), st.label); }));
  const csvRows = list.flatMap(r => years.map(y => ({ party: P[r.k]?.name || r.k, fy: y, status: r.ys[y]?.status || '', filed: r.ys[y]?.filed || '', amount: r.ys[y]?.amount ?? '', url: r.ys[y]?.url || '' })));
  main.append(card(`${kinds.find(k => k[0] === kind)?.[1]} — party by year`, `${list.length} parties${list.length > 400 ? ' (first 400 shown)' : ''}. Hover a cell for the date and amount; click to open the filing.`,
    h('div', {}, key, body(grid)), [csvBtn(() => downloadCSV('filing_compliance.csv', csvRows, ['party', 'fy', 'status', 'filed', 'amount', 'url'].map(k => ({ key: k, label: k }))))], 'Grid'));
}

/* ============================================================== REGISTRY */
const REG_STATUS = ['Recognized National', 'Recognized State', 'Registered Unrecognized (RUPP)', 'RUPP (not in 2025 list)', 'Inactive', 'Delisted / Cancelled'];
const REG_LABEL = { 'Recognized National': 'National', 'Recognized State': 'State', 'Registered Unrecognized (RUPP)': 'Active RUPP (2025)', 'RUPP (not in 2025 list)': 'RUPP, not in 2025 list', 'Inactive': 'Inactive (2022)', 'Delisted / Cancelled': 'Delisted' };
const GEO_NAME = { 'Andaman and Nicobar': 'Andaman & Nicobar Islands', 'Orissa': 'Odisha', 'Uttaranchal': 'Uttarakhand' };
function viewRegistry(main, q) {
  main.append(h('div', { class: 'view-head' }, h('h1', { text: 'Every registered party in India' }),
    h('p', { text: 'The ECI party registry: recognised national and state parties, the 2,049 registered unrecognised parties on the 10 Oct 2025 list, and parties delisted or declared inactive since 2016, including the 808 delisted in 2025. Headquarters are placed by PIN code or district.' })));
  const holder = h('div', { class: 'loading', text: 'Loading registry…' });
  main.append(holder);
  Promise.all([loadRegistry(), loadGeo()]).then(([reg, geo]) => { holder.remove(); registryBody(main, q, reg, geo); });
}
function registryBody(main, q, reg, geo) {
  const statuses = q.status ? q.status.split('|') : [], state = q.state || '', query = (q.q || '').toLowerCase(), y25 = q.y25 === '1', newOnly = q.new === '1';
  const rows = reg.filter(p => (!statuses.length || statuses.includes(p.status)) && (!state || p.state === state)
    && (!y25 || (p.eci_2025_table && p.eci_2025_table !== 'I(A)')) && (!newOnly || p.registered_after_2021)
    && (!query || `${p.party_name} ${p.address} ${p.pincode || ''} ${p.district || ''}`.toLowerCase().includes(query)));
  const toggle = st => { const next = statuses.includes(st) ? statuses.filter(x => x !== st) : [...statuses, st]; setParams({ status: next.join('|') }); };
  const counts = Object.fromEntries(REG_STATUS.map(st => [st, reg.filter(p => p.status === st).length]));
  const states = [...new Set(reg.map(p => p.state))].sort();
  main.append(h('div', { class: 'controlbar' },
    ...REG_STATUS.map(st => h('button', { class: 'ctl', type: 'button', 'aria-pressed': String(statuses.includes(st)), onclick: () => toggle(st) }, `${REG_LABEL[st]} · ${num(counts[st])}`)),
    select('State', [['', 'All states'], ...states.map(s => [s, s])], state, v => setParams({ state: v })),
    h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(y25), onclick: () => setParams({ y25: y25 ? '' : '1' }) }, h('span', { class: 'knob' }), 'Delisted in 2025'),
    h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(newOnly), onclick: () => setParams({ new: newOnly ? '' : '1' }) }, h('span', { class: 'knob' }), 'Registered after 2021'),
    searchBox('Name, address, PIN', q.q, v => setParams({ q: v }))));
  const S = D.regSummary;
  main.append(h('div', { class: 'tiles five', style: 'margin-bottom:16px' },
    tile('Parties in this view', num(rows.length), `of ${num(reg.length)} on record`),
    tile('Recognised', num(counts['Recognized National'] + counts['Recognized State']), `${counts['Recognized National']} national · ${counts['Recognized State']} state`),
    tile('Active RUPPs, Oct 2025', num(S.active_rupps_2025), 'ECI No.56/2025/PPS-III'),
    tile('Delisted in 2025', num(S.delisted_2025['I(B)'] + S.delisted_2025['I(C)']), 'two rounds', () => setParams({ y25: '1', status: '' })),
    tile('Registered after 2021', num(reg.filter(p => p.registered_after_2021).length), 'new on the 2025 list', () => setParams({ new: '1', status: '' }))));

  const byState = {}; rows.forEach(p => (byState[p.state] = (byState[p.state] || 0) + 1));
  const mapHost = h('div'), barHost = h('div', { class: 'chart-wrap', style: 'max-height:520px;overflow-y:auto' });
  main.append(h('div', { class: 'grid-32' },
    card('Headquarters by state', 'Darker = more parties in the current view. Click a state to filter.', body(mapHost, h('div', { class: 'ramp-legend' }, '0', h('span', { class: 'bar' }), num(Math.max(0, ...Object.values(byState))))), [], 'Map'),
    card('Parties by state', state ? `Filtered to ${state}.` : 'Click a bar to filter.', body(barHost), [], 'Ranking')));
  requestAnimationFrame(() => {
    indiaMap(mapHost, geo, byState, state, st => setParams({ state: st === state ? '' : st }), rows);
    barChart(barHost, Object.entries(byState).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v, color: k === state ? SLOT(1) : SLOT(0) })), { fmt: num, valueLabel: 'Parties', onClick: r => setParams({ state: r.key === state ? '' : r.key }) });
  });
  const tblHost = h('div');
  const RCOLS = [
    { key: 'party_name', label: 'Party', wrap: true, render: r => h('span', {}, r.party_name, r.name_source === 'ocr' || r.name_source === 'ocr-unreadable' ? h('span', { class: 'badge', title: 'Read by OCR from the scanned 2025 notification; spelling may be imperfect', style: 'margin-left:6px' }, 'OCR') : null) },
    { key: 'status', label: 'Status', render: r => REG_LABEL[r.status] || r.status },
    { key: 'state', label: 'State' }, { key: 'district', label: 'District' }, { key: 'pincode', label: 'PIN' },
    { key: 'address', label: 'Headquarters', wrap: true },
    { key: 'source_doc', label: 'Source', wrap: true, render: r => h('span', { class: 'muted', text: r.delisted_order || r.source_doc || '' }) },
  ];
  main.append(card('Registry', `${num(rows.length)} parties match.`, tblHost, [csvBtn(() => downloadCSV('party_registry.csv', rows, [...RCOLS, { key: 'lat', label: 'lat' }, { key: 'lon', label: 'lon' }, { key: 'eci_2025_table', label: 'eci_2025_table' }]))], 'Table'));
  dataTable(tblHost, rows, RCOLS, { sort: 'party_name', dir: 1, pageSize: 50 });
}
function indiaMap(host, geo, counts, selState, onClick, pts) {
  const W = Math.max(300, host.clientWidth || 500);
  let minX = 180, maxX = -180, minY = 90, maxY = -90;
  const walk = (c, f) => (typeof c[0] === 'number' ? f(c) : c.forEach(x => walk(x, f)));
  geo.features.forEach(ft => walk(ft.geometry.coordinates, ([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
  const kx = Math.cos(((minY + maxY) / 2) * Math.PI / 180), sc = W / ((maxX - minX) * kx), H = (maxY - minY) * sc;
  const px = ([x, y]) => [((x - minX) * kx * sc).toFixed(1), ((maxY - y) * sc).toFixed(1)];
  const max = Math.max(1, ...Object.values(counts));
  // sequential blue: light mode runs light->dark, dark mode its own dark->light steps
  const ramp = isDark() ? ['#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#86b6ef', '#b7d3f6'] : ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
  const color = v => (v ? ramp[Math.min(ramp.length - 1, Math.floor((Math.log(v + 1) / Math.log(max + 1)) * ramp.length))] : 'var(--surface-3)');
  const svg = s('svg', { class: 'chart map-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Map of India shaded by number of parties' });
  for (const ft of geo.features) {
    const name = GEO_NAME[ft.properties.NAME_1] || ft.properties.NAME_1, v = counts[name] || 0;
    let d = '';
    const polys = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) { if (ring.length < 4) continue; d += 'M' + ring.map(px).join('L') + 'Z'; }
    const path = s('path', { class: 'state' + (name === selState ? ' sel' : ''), d, fill: color(v) });
    path.addEventListener('pointermove', e => showTip(e, el => tipRows(el, name, null, [{ label: 'Parties in view', value: num(v) }])));
    path.addEventListener('pointerleave', hideTip);
    path.addEventListener('click', () => onClick(name));
    svg.append(path);
  }
  if (pts.length <= 1200) for (const p of pts) if (p.lat && p.lon) { const [x, y] = px([p.lon, p.lat]); svg.append(s('circle', { class: 'hq', cx: x, cy: y, r: 2.2, fill: 'var(--series-2)' })); }
  host.append(svg);
  if (pts.length <= 1200) host.append(h('p', { class: 'note', text: 'Orange dots: approximate headquarters of the parties in view (shown when 1,200 or fewer).' }));
}

/* ============================================================= DOCUMENTS */
function viewDocuments(main, q) {
  const query = (q.q || '').toLowerCase(), kind = q.kind || '', src = q.src || '', fy = q.fy || '', party = q.party_f || '';
  const docs = D.documents.filter(d => (!kind || d.kind === kind) && (!src || d.source === src) && (!fy || d.fy === fy) && (!party || d.k === party)
    && (!query || `${d.title} ${P[d.k]?.name || ''} ${P[d.k]?.short || ''}`.toLowerCase().includes(query)));
  docs.sort((a, b) => (b.fy || '').localeCompare(a.fy || '') || a.title.localeCompare(b.title));
  main.append(h('div', { class: 'view-head' }, h('h1', { text: 'Source documents' }),
    h('p', { text: `${num(D.documents.length)} official filings: audited accounts, Form 24A contribution reports and election-expenditure statements published by the ECI and the CEO Tamil Nadu. Every figure on this site traces back to one of these.` })));
  const opt = arr => [...new Set(arr)].filter(Boolean).sort();
  const partyOpts = opt(D.documents.map(d => d.k)).map(k => [k, longLabel(k)]).sort((a, b) => a[1].localeCompare(b[1]));
  main.append(h('div', { class: 'controlbar' },
    searchBox('Search titles and parties', q.q, v => setParams({ q: v })),
    select('Type', [['', 'All types'], ...opt(D.documents.map(d => d.kind)).map(x => [x, x])], kind, v => setParams({ kind: v })),
    select('Source', [['', 'All sources'], ...opt(D.documents.map(d => d.source)).map(x => [x, x])], src, v => setParams({ src: v })),
    select('Year', [['', 'All years'], ...opt(D.documents.map(d => d.fy)).reverse().map(x => [x, x])], fy, v => setParams({ fy: v })),
    select('Party', [['', 'All parties'], ...partyOpts], party, v => setParams({ party_f: v })),
    h('span', { class: 'count-pill', text: `${num(docs.length)} documents` })));
  const list = h('div', { class: 'doc-list' });
  const page = +(q.page || 1), per = 60, pages = Math.max(1, Math.ceil(docs.length / per));
  for (const d of docs.slice((page - 1) * per, page * per)) {
    list.append(h('div', { class: 'doc' }, h('span', { class: 'ic' }, icon('i-doc')),
      h('div', {}, h('a', { class: 't', href: rel(d.url), target: '_blank', rel: 'noopener', text: d.title }),
        h('div', { class: 'm' }, h('span', { text: d.kind }), h('span', { text: d.source }), d.fy ? h('span', { text: `FY ${d.fy}` }) : null, d.filed ? h('span', { text: `filed ${d.filed}` }) : null, d.size ? h('span', { text: d.size }) : null)),
      d.k && P[d.k] ? h('button', { class: 'ctl small', type: 'button', onclick: () => openParty(d.k) }, label(d.k)) : h('span')));
  }
  main.append(h('section', { class: 'card' }, list,
    pages > 1 ? h('div', { class: 'pager' }, h('span', { text: `Page ${page} of ${pages}` }),
      h('button', { class: 'ctl small', disabled: page <= 1 || null, onclick: () => setParams({ page: page - 1 }) }, 'Previous'),
      h('button', { class: 'ctl small', disabled: page >= pages || null, onclick: () => setParams({ page: page + 1 }) }, 'Next')) : null));
}

/* ================================================================ DRAWER */
function openParty(k, push = true) {
  const p = P[k]; if (!p) return;
  if (push && parseHash().params.party !== k) { history.replaceState(null, '', location.hash.replace(/([?&])party=[^&]*&?/, '$1').replace(/[?&]$/, '') + (location.hash.includes('?') ? '&' : '?') + 'party=' + encodeURIComponent(k)); }
  const dr = $('#drawer'), bodyEl = $('#drawer-body'), title = $('#drawer-title');
  title.replaceChildren(h('div', { class: 'p-title' },
    p.logo_url ? h('img', { src: rel(p.logo_url), alt: '' }) : h('span', { class: 'mono', text: (p.short || p.name).slice(0, 5) }),
    h('div', {}, h('h2', { text: p.name }), h('div', { class: 'sub', text: [p.short !== p.name ? p.short : null, p.rec === 'RUPP' ? 'Registered unrecognised party' : `${p.rec} party`, p.state, p.tamil_name].filter(Boolean).join(' · ') }))));
  bodyEl.replaceChildren();
  const facts = [['Leader', p.leader], ['Founded', p.founded_year], ['Symbol', p.symbol], ['Headquarters', p.headquarters || p.address], ['Website', p.website ? h('a', { href: p.website, target: '_blank', rel: 'noopener', text: p.website.replace(/^https?:\/\//, '') }) : null], ['Assembly', p.assembly_role]].filter(f => f[1]);
  if (facts.length) bodyEl.append(h('section', { class: 'card' }, body(h('dl', { class: 'facts' }, facts.flatMap(([a, b]) => [h('dt', { text: a }), h('dd', {}, b)])))));

  const fin = D.finance.filter(r => r.k === k).sort((a, b) => a.fy.localeCompare(b.fy));
  if (fin.length) {
    const ch = h('div');
    const series = [['income', 'Income'], ['expenditure', 'Expenditure'], ['eb_encashed', 'Bonds encashed'], ['contributions_24a', 'Form 24A']].map(([m, l], i) => ({ key: m, label: l, color: SLOT(i), points: Object.fromEntries(fin.filter(r => r[m] != null).map(r => [r.fy, r[m]])) })).filter(se => Object.keys(se.points).length);
    const tbl = h('div');
    bodyEl.append(card('Money in and out', 'By financial year. Hover for values; the table lists each source.', body(legend(series, true), ch), [csvBtn(() => downloadCSV(`${k}_finance.csv`, fin, FIN_COLS))], 'Finances'));
    bodyEl.lastChild.append(tbl);
    requestAnimationFrame(() => { lineChart(ch, fin.map(r => r.fy), series, { xLabel: x => `FY ${x}`, height: 230 }); dataTable(tbl, fin.map(r => ({ ...r, name: p.name, short: p.short })), FIN_COLS.filter(c => !['name'].includes(c.key) && fin.some(r => c.key === 'src' || c.key === 'fy' || r[c.key] != null)), { sort: 'fy', dir: -1 }); });
  }

  const mixSecs = OVER_TIME.filter(sec => sec.stack && fin.some(r => sec.has(r) && sec.value(r, '_none') === 0));
  if (mixSecs.length) {
    const wrap = h('div', { class: 'grid-2', style: 'margin:0' });
    bodyEl.append(card('Income and spending mix', 'Stacked by head, from the audited accounts. Hover for the split.', body(wrap), [], 'Over time'));
    requestAnimationFrame(() => mixSecs.forEach(sec => {
      const rows = fin.filter(r => sec.has(r)), cell = h('div'), ch = h('div');
      const layers = sec.parts.map(([key, l], i) => ({ key, label: l, color: sec.colors[i], points: Object.fromEntries(rows.map(r => [r.fy, sec.value(r, key)])) }));
      cell.append(h('div', { class: 'mini-head' }, h('b', { text: sec.title.replace(' over time', '') })), legend(layers.filter(L => rows.some(r => L.points[r.fy])), false), ch);
      wrap.append(cell);
      miniStack(ch, rows.map(r => r.fy), layers, { title: `${p.short || p.name}: ${sec.title.replace(' over time', '').toLowerCase()}`, height: 190 });
    }));
  }

  const bi = D.bondParty.map((x, i) => (x === k ? i : -1)).filter(i => i >= 0);
  if (bi.length) {
    const rs = D.bonds.rows.filter(r => bi.includes(r[0])), tot = rs.reduce((a, r) => a + r[2], 0), by = {};
    rs.forEach(r => (by[r[1]] = (by[r[1]] || 0) + r[2]));
    const host = h('div');
    bodyEl.append(card(`Electoral bonds: ${inr(tot)}`, `${num(rs.length)} bonds encashed. Largest buyers:`, body(host, h('button', { class: 'ctl small', type: 'button', onclick: () => { closeDrawer(); go('bonds', { p: k }); } }, 'Explore these bonds →')), [], 'SBI disclosure'));
    requestAnimationFrame(() => barChart(host, Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([d, v]) => ({ key: d, label: D.bonds.donors[d], value: v, sub: `${pct(v, tot)} of ${p.short || p.name}'s bonds` })), { labelWidth: 200 }));
  }

  const comp = D.compliance.filter(r => r.k === k);
  if (comp.length) {
    const kinds = [...new Set(comp.map(r => r.kind))], years = [...new Set(comp.map(r => r.fy))].sort();
    const grid = h('div', { class: 'hm', style: `grid-template-columns: minmax(110px, 1.6fr) repeat(${years.length}, minmax(22px, 1fr))` });
    grid.append(h('div'), ...years.map(y => h('div', { class: 'colh', text: y.length > 7 ? y : `’${y.slice(2, 4)}`, title: y })));
    for (const kd of kinds) {
      grid.append(h('div', { class: 'lab', text: kd.replace(' (Form 24A)', '').replace('Election expenditure statement', 'Election exp.') }));
      for (const y of years) {
        const c = comp.find(r => r.kind === kd && r.fy === y), st = c ? STATUS[c.status] || STATUS[''] : null;
        const cell = h('div', { class: 'cell ' + (st ? st.cls : 'na') }, st ? icon(st.icon) : null);
        if (c) { cell.title = `${st.label}${c.filed ? ' · ' + c.filed : ''}`; if (c.url) { cell.dataset.url = c.url; cell.addEventListener('click', () => open(c.url, '_blank', 'noopener')); } }
        grid.append(cell);
      }
    }
    bodyEl.append(card('Filing record', comp[0].scope.includes('CEO') ? 'As recorded by the CEO Tamil Nadu.' : 'Reports published on the ECI website.', body(grid), [], 'Compliance'));
  }

  const docs = D.documents.filter(d => d.k === k).sort((a, b) => (b.fy || '').localeCompare(a.fy || ''));
  if (docs.length) bodyEl.append(h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', { class: 'titles' }, h('div', { class: 'kicker', text: 'Documents' }), h('h2', { text: `${docs.length} filings` }))),
    h('div', { class: 'doc-list', style: 'margin-top:8px' }, docs.slice(0, 40).map(d => h('div', { class: 'doc' }, h('span', { class: 'ic' }, icon('i-doc')),
      h('div', {}, h('a', { class: 't', href: rel(d.url), target: '_blank', rel: 'noopener', text: d.title }), h('div', { class: 'm' }, h('span', { text: d.kind }), d.fy ? h('span', { text: `FY ${d.fy}` }) : null)), h('span'))))));
  if (!fin.length && !bi.length && !comp.length && !docs.length) bodyEl.append(h('div', { class: 'empty', text: 'No filings on record for this party.' }));

  dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
  $('.drawer-panel [data-close]', dr).focus();
}
function closeDrawer() {
  const dr = $('#drawer'); dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true');
  if (parseHash().params.party) history.replaceState(null, '', location.hash.replace(/([?&])party=[^&]*/, '').replace(/\?&/, '?').replace(/[?&]$/, ''));
}

/* ------------------------------------------------------------------ boot */
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function initTheme() {
  const saved = (() => { try { return localStorage.getItem('pfe-theme'); } catch { return null; } })();
  if (saved) document.documentElement.dataset.theme = saved;
  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pfe-theme', next); } catch { /* private mode */ }
    render();
  });
}
async function boot() {
  tip.el = $('#tip');
  initTheme();
  $$('#drawer [data-close]').forEach(b => b.addEventListener('click', closeDrawer));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  try { await loadCore(); } catch (err) { $('#main').replaceChildren(h('div', { class: 'empty', text: `Could not load data (${err.message}).` })); return; }
  addEventListener('hashchange', render);
  addEventListener('resize', debounce(() => { if (document.activeElement?.tagName !== 'INPUT') render(); }, 250));
  render();
}
boot();
