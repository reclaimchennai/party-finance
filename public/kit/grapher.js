/* SVG charts, hand rolled, in the manner of cpi.reclaimchennai.city's charts.js:
 * no charting library, the SVG sized to its box (viewBox = real width, so
 * nothing is scaled), hairline grids, labels de-collided, hover tooltips.
 *
 * Every chart is a pure function of its inputs. Animation is the caller's
 * job: it passes values interpolated between two years and calls again on
 * each frame. That keeps playback, scrubbing and video recording on one path,
 * and makes every recorded frame exactly what the screen showed.
 *
 *   lineChart   one line per category across the years, a marker at the year
 *   barRows     one bar per row (composition of a year, or a ranking of places)
 *   stackRows   stacked horizontal bars, by count or by share
 *   heatmap     category x year cells carrying the number and its share
 *   clocks      two 12-hour dials, day (06-18) and night (18-06), one wedge per 3 hours
 */

import { svg, clear, scaleLinear, ticks, fmtN, fmtPct, fmtShort, hover, esc, heatStep, bins, inkOn, lerp } from './util.js';

/* ------------------------------------------------------------------ utils */

function size(el, minH = 200) {
  const w = Math.max(300, el.parentElement?.clientWidth || 700);
  return { w, narrow: w < 620, tight: w < 430, minH };
}
function frame(el, w, h) {
  clear(el);
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.style.width = '100%';
  el.style.height = 'auto';
  el.classList.add('chart');
}
export function emptyChart(el, text = 'Nothing published for this choice.') {
  const { w } = size(el);
  frame(el, w, 120);
  el.append(svg('text', { x: w / 2, y: 64, class: 'tick', 'text-anchor': 'middle' }, text));
}

function decollide(ys, gap, top, bottom) {
  const order = ys.map((y, i) => ({ i, y })).sort((a, b) => a.y - b.y);
  let prev = -Infinity;
  for (const o of order) { o.y = Math.max(o.y, prev + gap); prev = o.y; }
  const over = order.length ? order[order.length - 1].y - bottom : 0;
  if (over > 0) {
    let next = Infinity;
    for (let k = order.length - 1; k >= 0; k--) { order[k].y = Math.min(order[k].y - over, next - gap); next = order[k].y; }
  }
  const out = new Array(ys.length);
  for (const o of order) out[o.i] = Math.max(top, o.y);
  return out;
}

function fitText(node, full, maxW) {
  node.textContent = full;
  if (maxW <= 0 || node.getComputedTextLength() <= maxW) return;
  let lo = 1, hi = full.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    node.textContent = `${full.slice(0, mid).trimEnd()}…`;
    if (node.getComputedTextLength() <= maxW) lo = mid; else hi = mid - 1;
  }
  node.textContent = `${full.slice(0, lo).trimEnd()}…`;
}

/** Rendered width of a label in this chart's type, measured rather than guessed. */
function measure(el, text, cls = 'row-label') {
  const t = svg('text', { class: cls, x: -9999, y: -9999 }, text);
  el.append(t);
  const w = t.getComputedTextLength();
  t.remove();
  return w;
}

/** Split a label into at most two lines that each fit maxW; the second is ellipsised only as a last resort. */
function twoLines(el, text, maxW, cls) {
  if (measure(el, text, cls) <= maxW) return [text];
  const words = String(text).split(/\s+/);
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    const wa = measure(el, a, cls), wb = measure(el, b, cls);
    if (wa <= maxW && wb <= maxW) { const score = Math.abs(wa - wb); if (!best || score < best.s) best = { l: [a, b], s: score }; }
  }
  if (best) return best.l;
  return null;
}

/**
 * The left margin a set of row labels needs: wide enough for every label on
 * one line, or on two, within maxFrac of the chart; nothing is cut off unless
 * a label cannot fit even on two lines.
 */
function labelMargin(el, labels, w, { cls = 'row-label', minW = 70, maxFrac = .42 } = {}) {
  const cap = Math.max(minW, w * maxFrac);
  const one = Math.max(minW, ...labels.map(l => measure(el, l, cls)));
  if (one + 14 <= cap) return Math.ceil(one + 14);
  // two lines: find the narrowest width at which every label still fits on two
  let lo = minW, hi = cap - 14;
  if (labels.some(l => !twoLines(el, l, hi, cls))) return cap;
  while (hi - lo > 4) { const mid = (lo + hi) / 2; if (labels.every(l => twoLines(el, l, mid, cls))) hi = mid; else lo = mid; }
  return Math.ceil(hi + 14);
}

/** A right-aligned row label on one or two lines, centred on yMid. */
function rowLabel(el, x, yMid, text, maxW, cls = 'row-label') {
  const lines = twoLines(el, text, maxW, cls);
  const t = svg('text', { x, y: yMid + 4, class: cls, 'text-anchor': 'end' });
  el.append(t);
  if (!lines) { fitText(t, text, maxW); t.append(svg('title', {}, text)); return t; }
  if (lines.length === 1) { t.textContent = lines[0]; return t; }
  t.setAttribute('y', yMid - 2);
  t.append(svg('tspan', { x, dy: 0 }, lines[0]));
  t.append(svg('tspan', { x, dy: 12 }, lines[1]));
  return t;
}

/** A bar rounded only on its outward (right) end, as cpi's capsuleBar does vertically. */
function hbar(x, y, w, h, roundRight = true) {
  const r = Math.max(0, Math.min(h / 2, w / 2, 5));
  if (!roundRight || w < 2) return `M${x} ${y}h${Math.max(0, w)}v${h}h${-Math.max(0, w)}Z`;
  return `M${x} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x}Z`;
}

/* ======================================================================
   lineChart
   ====================================================================== */

/**
 * xs: years. series: [{key, label, color, values: {year: v}, dash}].
 * pos: fractional index into xs for the year marker (or null).
 */
export function lineChart(el, { xs, series, pos = null, fmt = fmtN, yFmt = fmtShort, height, hl = null, unit = '', zeroBase = true, marks = [] }) {
  const { w, narrow } = size(el);
  const all = series.flatMap(s => xs.map(x => s.values[x]).filter(v => v != null && Number.isFinite(v)));
  if (!all.length) return emptyChart(el);
  const h = height || (narrow ? 280 : 340);
  const labelW = Math.min(w * (narrow ? .34 : .26), Math.max(60, ...series.map(s2 => measure(el, s2.label, 'end-label'))) + 4);
  const lo = zeroBase ? 0 : Math.min(...all), hi = Math.max(...all) * 1.06 || 1;
  // the left margin fits the widest tick label, so large numbers are never cut off
  const tickW = Math.max(...ticks(lo, hi, 5).map(t => measure(el, yFmt(t), 'tick')), 20);
  const m = { top: unit ? 30 : 18, right: labelW + 10, bottom: 28, left: Math.ceil(tickW + 14) };
  frame(el, w, h);
  // what the y axis counts, above it ('persons', '% of total', 'per lakh population')
  if (unit) el.append(svg('text', { x: 2, y: 11, class: 'tick axis-unit', 'text-anchor': 'start' }, unit));
  const x = scaleLinear([xs[0], xs[xs.length - 1]], [m.left, w - m.right]);
  const y = scaleLinear([lo, hi], [h - m.bottom, m.top]);
  for (const t of ticks(lo, hi, 5)) {
    el.append(svg('line', { x1: m.left, x2: w - m.right, y1: y(t), y2: y(t), class: 'grid-line' }));
    el.append(svg('text', { x: m.left - 7, y: y(t) + 3.5, class: 'tick', 'text-anchor': 'end' }, yFmt(t)));
  }
  el.append(svg('line', { x1: m.left, x2: w - m.right, y1: h - m.bottom, y2: h - m.bottom, class: 'axis-line' }));
  // x ticks: every year fits on a wide chart, otherwise every 2nd/5th, never touching
  const span = xs[xs.length - 1] - xs[0];
  const step = [1, 2, 5, 10].find(s => (span / s) * 34 < w - m.left - m.right) || 10;
  let last = -Infinity;
  for (const yr of xs) {
    if (yr % step && yr !== xs[0] && yr !== xs[xs.length - 1]) continue;
    if (x(yr) - last < 30) continue;
    last = x(yr);
    el.append(svg('text', { x: x(yr), y: h - m.bottom + 16, class: 'tick', 'text-anchor': 'middle' }, String(yr)));
  }
  // lines, broken at missing years
  const ends = [];
  series.forEach((s, i) => {
    let d = '', pen = false, lastPt = null;
    for (const yr of xs) {
      const v = s.values[yr];
      if (v == null || !Number.isFinite(v)) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(yr).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true; lastPt = [yr, v];
    }
    const dim = hl && hl !== s.key;
    el.append(svg('path', { d, class: `series-line${dim ? ' dim' : ''}`, stroke: s.color, 'stroke-dasharray': s.dash || null, 'stroke-width': hl === s.key ? 2.6 : null }));
    // lone points (a year with no neighbours) still show
    xs.forEach((yr, k) => {
      const v = s.values[yr];
      if (v == null) return;
      const prev = s.values[xs[k - 1]], next = s.values[xs[k + 1]];
      if (prev == null && next == null) el.append(svg('circle', { cx: x(yr), cy: y(v), r: 3, fill: s.color, opacity: dim ? .25 : 1 }));
    });
    if (lastPt) ends.push({ s, y: y(lastPt[1]), v: lastPt[1], dim });
  });
  // numbered annotations: a ring on the point and its number just above (the text is in the card's note)
  for (const mk of marks) {
    if (mk.x < xs[0] || mk.x > xs[xs.length - 1]) continue;
    const s = series.find(z => z.key === mk.key);
    const v = s?.values[mk.x];
    if (!mk.top && v == null) continue;
    // a mark on a point, or (top) at the top of the plot for a note about the whole year
    const cx = x(mk.x), cy = mk.top ? m.top + 19 : y(v), above = mk.top || cy - 16 > m.top;
    if (mk.top) el.append(svg('line', { x1: cx, x2: cx, y1: m.top + 26, y2: h - m.bottom, stroke: 'var(--ink-muted)', 'stroke-dasharray': '2 3', 'stroke-width': 1, 'pointer-events': 'none' }));
    else el.append(svg('circle', { cx, cy, r: 5.5, fill: 'none', stroke: mk.kind === 'check' ? 'var(--warning, #d97706)' : 'var(--ink)', 'stroke-width': 1.6, 'pointer-events': 'none' }));
    el.append(svg('circle', { cx, cy: above ? cy - 17 : cy + 17, r: 8.5, fill: 'var(--surface)', stroke: mk.kind === 'check' ? 'var(--warning, #d97706)' : 'var(--ink-2)', 'stroke-width': 1.2, 'pointer-events': 'none' }));
    el.append(svg('text', { x: cx, y: (above ? cy - 17 : cy + 17) + 3.8, 'text-anchor': 'middle', class: 'tick', style: 'font-weight:700;fill:var(--ink)', 'pointer-events': 'none' }, String(mk.n)));
  }
  // end labels, pushed apart
  const ys = decollide(ends.map(e => e.y), 13, m.top, h - m.bottom);
  ends.forEach((e, i) => {
    const t = svg('text', { x: w - m.right + 8, y: ys[i] + 4, class: 'end-label', fill: e.s.color, opacity: e.dim ? .35 : 1 });
    el.append(t);
    fitText(t, e.s.label, labelW);
  });
  // year marker
  if (pos != null) {
    const i0 = Math.floor(pos), i1 = Math.min(xs.length - 1, i0 + 1), f = pos - i0;
    const yr = lerp(xs[i0], xs[i1], f);
    el.append(svg('line', { x1: x(yr), x2: x(yr), y1: m.top - 4, y2: h - m.bottom, class: 'year-mark' }));
    el.append(svg('text', { x: x(yr), y: m.top - 6, class: 'year-tag', 'text-anchor': 'middle' }, String(Math.round(yr))));
  }
  // hover: nearest year, every series' value
  const cross = svg('line', { y1: m.top, y2: h - m.bottom, class: 'crosshair', visibility: 'hidden' });
  el.append(cross);
  const hit = svg('rect', { x: m.left, y: m.top, width: w - m.left - m.right, height: h - m.top - m.bottom, class: 'hit' });
  el.append(hit);
  const near = ev => {
    const r = el.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * w;
    const yr = Math.round(x.invert(px));
    return xs.reduce((a, b) => (Math.abs(b - yr) < Math.abs(a - yr) ? b : a), xs[0]);
  };
  hover(hit, () => '');
  hit.addEventListener('pointermove', ev => {
    const yr = near(ev);
    cross.setAttribute('x1', x(yr)); cross.setAttribute('x2', x(yr)); cross.setAttribute('visibility', 'visible');
    const rows = series.map(s => ({ s, v: s.values[yr] })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
    const tip = document.getElementById('tip');
    if (tip) {
      tip.innerHTML = `<div class="t">${yr}</div><dl>${rows.slice(0, 12).map(r =>
        `<dt><span class="sw" style="background:${r.s.color}"></span>${esc(r.s.label)}</dt><dd>${fmt(r.v)}${unit}</dd>`).join('')}</dl>`;
    }
  });
  hit.addEventListener('pointerleave', () => cross.setAttribute('visibility', 'hidden'));
}

/* ======================================================================
   stackChart: shares of a whole over the years (100% stacked areas)
   ====================================================================== */

/**
 * xs: years. series: [{key, label, color, values: {year: share %}}], bottom first; each year's shares add to 100.
 * A year with no figures breaks the bands (no area is drawn across a gap).
 */
export function stackChart(el, { xs, series, fmt = v => `${(Math.round(v * 10) / 10).toFixed(1)}%`, height, unit = '% of the year', mode = 'share', yFmt = fmtShort }) {
  const { w, narrow } = size(el);
  const has = yr => series.some(s => s.values[yr] != null);
  if (!xs.some(has)) return emptyChart(el);
  const h = height || (narrow ? 300 : 360);
  const labelW = Math.min(w * (narrow ? .34 : .24), Math.max(60, ...series.map(s2 => measure(el, s2.label, 'end-label'))) + 4);
  // shares stack to 100%; counts (mode 'count') to each year's total, on a scale to the largest
  const hiV = mode === 'share' ? 100 : Math.max(1, ...xs.map(yr => series.reduce((a, s) => a + (s.values[yr] || 0), 0))) * 1.04;
  const tks = mode === 'share' ? [0, 25, 50, 75, 100] : ticks(0, hiV, 5);
  const tlab = t => (mode === 'share' ? `${t}%` : yFmt(t));
  const tickW = Math.max(...tks.map(t => measure(el, tlab(t), 'tick')), 20);
  const m = { top: 30, right: labelW + 10, bottom: 28, left: Math.ceil(tickW + 14) };
  frame(el, w, h);
  el.append(svg('text', { x: 2, y: 11, class: 'tick axis-unit', 'text-anchor': 'start' }, unit));
  const x = scaleLinear([xs[0], xs[xs.length - 1]], [m.left, w - m.right]);
  const y = scaleLinear([0, hiV], [h - m.bottom, m.top]);
  for (const t of tks) {
    el.append(svg('line', { x1: m.left, x2: w - m.right, y1: y(t), y2: y(t), class: 'grid-line' }));
    el.append(svg('text', { x: m.left - 7, y: y(t) + 3.5, class: 'tick', 'text-anchor': 'end' }, tlab(t)));
  }
  const span = xs[xs.length - 1] - xs[0];
  const step = [1, 2, 5, 10].find(st => (span / st) * 34 < w - m.left - m.right) || 10;
  let lastX = -Infinity;
  for (const yr of xs) {
    if (yr % step && yr !== xs[0] && yr !== xs[xs.length - 1]) continue;
    if (x(yr) - lastX < 30) continue;
    lastX = x(yr);
    el.append(svg('text', { x: x(yr), y: h - m.bottom + 16, class: 'tick', 'text-anchor': 'middle' }, String(yr)));
  }
  // runs of consecutive years with figures; each band is drawn run by run
  const runs = [];
  let cur = [];
  for (const yr of xs) { if (has(yr)) cur.push(yr); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  const base = {};
  for (const yr of xs) base[yr] = 0;
  const tops = series.map(s => {
    const lo = {}, hi = {};
    for (const yr of xs) { lo[yr] = base[yr]; hi[yr] = base[yr] + (s.values[yr] || 0); base[yr] = hi[yr]; }
    return { lo, hi };
  });
  series.forEach((s, i) => {
    for (const run of runs) {
      const { lo, hi } = tops[i];
      // a lone year is drawn as a narrow column so it still shows
      const xsr = run.length > 1 ? run : [run[0] - 0.3, run[0] + 0.3];
      const at = (o, yr) => o[Math.round(yr)] ?? o[run[0]];
      const d = xsr.map((yr, k) => `${k ? 'L' : 'M'}${x(yr).toFixed(1)} ${y(at(hi, yr)).toFixed(1)}`).join('')
        + xsr.slice().reverse().map(yr => `L${x(yr).toFixed(1)} ${y(at(lo, yr)).toFixed(1)}`).join('') + 'Z';
      el.append(svg('path', { d, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    }
  });
  el.append(svg('line', { x1: m.left, x2: w - m.right, y1: h - m.bottom, y2: h - m.bottom, class: 'axis-line' }));
  // labels at the right, each beside its band in the last year with figures
  const lastYr = runs.at(-1).at(-1);
  const mids = series.map((s, i) => ({ s, y: y((tops[i].lo[lastYr] + tops[i].hi[lastYr]) / 2), v: s.values[lastYr] || 0 }));
  const pos = decollide(mids.map(mm => mm.y), 13, m.top, h - m.bottom);
  mids.forEach((mm, i) => {
    const t = svg('text', { x: w - m.right + 8, y: pos[i] + 4, class: 'end-label', fill: 'var(--ink-2)' });
    el.append(t);
    fitText(t, mm.s.label, labelW);
  });
  // hover: the year's shares, largest first
  const cross = svg('line', { y1: m.top, y2: h - m.bottom, class: 'crosshair', visibility: 'hidden' });
  el.append(cross);
  const hit = svg('rect', { x: m.left, y: m.top, width: w - m.left - m.right, height: h - m.top - m.bottom, class: 'hit' });
  el.append(hit);
  hover(hit, () => '');
  hit.addEventListener('pointermove', ev => {
    const r = el.getBoundingClientRect();
    const yr0 = Math.round(x.invert(((ev.clientX - r.left) / r.width) * w));
    const yr = xs.filter(has).reduce((a, b) => (Math.abs(b - yr0) < Math.abs(a - yr0) ? b : a));
    cross.setAttribute('x1', x(yr)); cross.setAttribute('x2', x(yr)); cross.setAttribute('visibility', 'visible');
    const rows = series.map(s => ({ s, v: s.values[yr] })).filter(q => q.v != null).sort((a, b) => b.v - a.v);
    const tip = document.getElementById('tip');
    if (tip) tip.innerHTML = `<div class="t">${yr}</div><dl>${rows.map(q => `<dt><span class="sw" style="background:${q.s.color}"></span>${esc(q.s.label)}</dt><dd>${fmt(q.v)}</dd>`).join('')}</dl>`;
  });
  hit.addEventListener('pointerleave', () => cross.setAttribute('visibility', 'hidden'));
}

/* ======================================================================
   barRows: composition of one year, or a ranking of places
   ====================================================================== */

/**
 * rows: [{key, label, value, color, hl, rank}] -- rank (fractional) places the
 * row; without it rows are drawn in the given order. total: for the % label.
 */
export function barRows(el, { rows, max, total = null, fmt = fmtN, label = r => r.label, rowH: rh, bigYear = null, unit = '' }) {
  const { w, narrow, tight } = size(el);
  if (!rows.length) return emptyChart(el);
  const rowH = rh || (narrow ? 28 : 30);
  const n = rows.length;
  frame(el, w, 10);
  const left = labelMargin(el, rows.map(r => label(r)), w, { maxFrac: tight ? .46 : .4 });
  const valW = total ? 104 : 70;
  const m = { top: 6, right: valW + 6, bottom: 6, left };
  const h = m.top + n * rowH + m.bottom;
  frame(el, w, h);
  const mx = max || Math.max(...rows.map(r => r.value || 0), 1);
  const x = scaleLinear([0, mx], [m.left, w - m.right]);
  // the year as a watermark only where there is room for it clear of the bars
  if (bigYear != null && !narrow) el.append(svg('text', { x: w - m.right, y: h - 14, class: 'big-year', 'text-anchor': 'end' }, String(bigYear)));
  rows.forEach((r, i) => {
    const k = r.rank ?? i;
    if (k > n + 1) return;
    const y0 = m.top + k * rowH;
    const g = svg('g', { transform: `translate(0 ${y0.toFixed(2)})` });
    el.append(g);
    rowLabel(g, m.left - 8, rowH / 2, label(r), m.left - 12, `row-label${r.hl ? ' hl' : ''}`);
    const bw = Math.max(0, x(r.value || 0) - m.left);
    const bar = svg('path', { d: hbar(m.left, 4, bw, rowH - 8), fill: r.color || 'var(--series-1)', opacity: r.dim ? .35 : 1 });
    g.append(bar);
    const pct = total ? ` · ${fmtPct((100 * (r.value || 0)) / total)}` : '';
    g.append(svg('text', { x: m.left + bw + 6, y: rowH / 2 + 4, class: 'val-label' }, r.value == null ? 'not printed' : `${fmt(r.value)}${unit}${pct}`));
    hover(bar, () => `<div class="t">${esc(label(r))}</div><dl><dt>${esc(r.sub || 'Value')}</dt><dd>${r.value == null ? '–' : fmt(r.value) + unit}</dd>${total ? `<dt>Share</dt><dd>${fmtPct((100 * (r.value || 0)) / total)}</dd>` : ''}</dl>`);
  });
}

/* ======================================================================
   stackRows: stacked horizontal bars (age profile, composition per place)
   ====================================================================== */

/**
 * rows: [{key, label, values: [v per part], hl}]; parts: [{key, label, color}].
 * mode 'share' scales every bar to 100%; 'count' to the largest row.
 */
export function stackRows(el, { rows, parts, mode = 'share', fmt = fmtN, rowH: rh, bigYear = null }) {
  const { w, narrow, tight } = size(el);
  if (!rows.length) return emptyChart(el);
  const rowH = rh || (narrow ? 34 : 40);
  frame(el, w, 10);
  const left = labelMargin(el, rows.map(r => r.label), w, { maxFrac: tight ? .4 : .32 });
  const m = { top: 8, right: mode === 'count' ? 64 : 14, bottom: 26, left };
  const h = m.top + rows.length * rowH + m.bottom;
  frame(el, w, h);
  const totals = rows.map(r => r.values.reduce((a, b) => a + (b || 0), 0));
  const mx = mode === 'share' ? 100 : Math.max(...totals, 1);
  const x = scaleLinear([0, mx], [m.left, w - m.right]);
  for (const t of ticks(0, mx, narrow ? 4 : 5)) {
    el.append(svg('line', { x1: x(t), x2: x(t), y1: m.top, y2: h - m.bottom, class: 'grid-line' }));
    el.append(svg('text', { x: x(t), y: h - m.bottom + 15, class: 'tick', 'text-anchor': 'middle' }, mode === 'share' ? `${t}%` : fmtShort(t)));
  }
  rows.forEach((r, i) => {
    const y0 = m.top + (r.rank ?? i) * rowH;
    rowLabel(el, m.left - 8, y0 + rowH / 2, r.label, m.left - 12, `row-label${r.hl ? ' hl' : ''}`);
    const tot = totals[i] || 1;
    let acc = 0;
    r.values.forEach((v, k) => {
      const val = mode === 'share' ? (100 * (v || 0)) / tot : (v || 0);
      const x0 = x(acc), x1 = x(acc + val);
      acc += val;
      if (x1 - x0 <= 0.2) return;
      const seg = svg('rect', { x: x0, y: y0 + 5, width: Math.max(0, x1 - x0 - 1.5), height: rowH - 10, fill: parts[k].color, rx: 2 });
      el.append(seg);
      const share = (100 * (v || 0)) / tot;
      const txt = mode === 'share' ? `${share.toFixed(share < 10 ? 1 : 0)}%` : fmtShort(v);
      if (x1 - x0 > txt.length * 6.4 + 6) {
        el.append(svg('text', { x: (x0 + x1) / 2, y: y0 + rowH / 2 + 4, class: 'in-label', 'text-anchor': 'middle', fill: inkOn(parts[k].color), 'pointer-events': 'none' }, txt));
      }
      hover(seg, () => `<div class="t">${esc(r.label)}</div><div class="s">${esc(parts[k].label)}</div><dl><dt>Number</dt><dd>${fmt(v)}</dd><dt>Share</dt><dd>${fmtPct(share)}</dd></dl>`);
    });
    if (mode === 'count') el.append(svg('text', { x: x(totals[i]) + 6, y: y0 + rowH / 2 + 4, class: 'val-label' }, fmtShort(totals[i])));
  });
}

/* ======================================================================
   heatmap: category x year, each cell the number and its share
   ====================================================================== */

/**
 * rows: category labels; cols: years; get(r, c) -> {v, p} (p = share of the
 * column total, %) or null. hlCol: index of the year to outline.
 */
export function heatmap(el, { rows, cols, get, max, rowMax = null, totalRows = null, hlCol = null, fmt = fmtN, showPct = true, colLabel = String, onCol = null }) {
  const { w, narrow, tight } = size(el);
  if (!rows.length || !cols.length) return emptyChart(el);
  frame(el, w, 10);
  const left = labelMargin(el, rows, w, { maxFrac: tight ? .4 : .3 });
  const cellW = Math.max(narrow ? 40 : 46, (w - left - 8) / cols.length);
  const cellH = showPct ? 34 : 26;
  const width = Math.max(w, left + cellW * cols.length + 8);
  const m = { top: 26, left };
  const h = m.top + rows.length * cellH + 6;
  frame(el, width, h);
  el.style.width = width > w ? `${width}px` : '100%';
  cols.forEach((c, j) => {
    const t = svg('text', { x: m.left + j * cellW + cellW / 2, y: 16, class: 'tick', 'text-anchor': 'middle', 'font-weight': j === hlCol ? 760 : null, fill: j === hlCol ? 'var(--ink)' : null }, colLabel(c));
    if (onCol) { t.style.cursor = 'pointer'; t.addEventListener('click', () => onCol(j)); }
    el.append(t);
  });
  // colour bins from the cells' own spread (rows with their own range, such as rates, binned on their own)
  const cellsOf = i => cols.map((_, j) => get(i, j)?.v).filter(v => v != null);
  const allBins = bins(rows.flatMap((_, i) => (totalRows?.has(i) ? [] : cellsOf(i))));
  const rowBins = rowMax ? rows.map((_, i) => bins(cellsOf(i))) : null;
  rows.forEach((r, i) => {
    const y0 = m.top + i * cellH;
    rowLabel(el, m.left - 8, y0 + cellH / 2, r, m.left - 12);
    cols.forEach((c, j) => {
      const cell = get(i, j);
      const x0 = m.left + j * cellW;
      // totals are shown but kept off the colour scale, which they would otherwise flatten
      const isTot = totalRows?.has(i);
      const step = isTot ? 0 : (rowMax && rowMax[i] !== max ? rowBins[i] : allBins).step(cell?.v);
      const fill = isTot ? (cell?.v != null ? 'var(--surface-3)' : 'var(--heat-0)') : `var(--heat-${step})`;
      const rect = svg('rect', { x: x0 + 1, y: y0 + 1, width: cellW - 2, height: cellH - 2, rx: 3, fill });
      el.append(rect);
      if (cell && cell.v != null) {
        const ink = inkOn(fill);
        el.append(svg('text', { x: x0 + cellW / 2, y: y0 + (showPct ? 15 : cellH / 2 + 4), class: 'cell-n', 'text-anchor': 'middle', fill: ink, 'pointer-events': 'none' }, cellW < 44 ? fmtShort(cell.v) : fmt(cell.v)));
        if (showPct && cell.p != null) el.append(svg('text', { x: x0 + cellW / 2, y: y0 + 27, class: 'cell-p', 'text-anchor': 'middle', fill: ink, 'pointer-events': 'none' }, fmtPct(cell.p, cell.p < 10 ? 1 : 0)));
        hover(rect, () => `<div class="t">${esc(r)}</div><div class="s">${esc(colLabel(c))}</div><dl><dt>Number</dt><dd>${fmt(cell.v)}</dd>${cell.p != null ? `<dt>Share of the year</dt><dd>${fmtPct(cell.p)}</dd>` : ''}</dl>`);
      }
    });
  });
  if (totalRows?.size) {
    const first = Math.min(...totalRows);
    el.append(svg('line', { x1: 6, x2: m.left + cols.length * cellW, y1: m.top + first * cellH - .5, y2: m.top + first * cellH - .5, stroke: 'var(--axis)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
  }
  if (hlCol != null) {
    el.append(svg('rect', { x: m.left + hlCol * cellW + .5, y: m.top - 2, width: cellW - 1, height: rows.length * cellH + 3, rx: 4, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.6 }));
  }
}

/* ======================================================================
   clocks: day and night on two real 12-hour dials
   ====================================================================== */

/* The eight NCRB slots, split the way NCRB itself labels them: 06-18 is day,
 * 18-06 night. Each half is exactly twelve hours, so each fills one ordinary
 * clock face: on the day dial 06-09 runs from the 6 to the 9, 12-15 from the
 * 12 to the 3, and so on. */
const DIALS = [
  { key: 'day', title: 'Day', sub: '6 am – 6 pm', slots: ['06-09', '09-12', '12-15', '15-18'], color: 'var(--day)', soft: 'var(--day-soft)' },
  { key: 'night', title: 'Night', sub: '6 pm – 6 am', slots: ['18-21', '21-24', '00-03', '03-06'], color: 'var(--night)', soft: 'var(--night-soft)' },
];
// clock position (hours on a 12h face) where each slot starts
const START = { '06-09': 6, '09-12': 9, '12-15': 0, '15-18': 3, '18-21': 6, '21-24': 9, '00-03': 0, '03-06': 3 };
const SLOT_NAME = {
  '00-03': 'midnight – 3 am', '03-06': '3 am – 6 am', '06-09': '6 am – 9 am', '09-12': '9 am – noon',
  '12-15': 'noon – 3 pm', '15-18': '3 pm – 6 pm', '18-21': '6 pm – 9 pm', '21-24': '9 pm – midnight',
};

function polar(cx, cy, r, hours) {
  const a = (hours / 12) * 2 * Math.PI - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function wedge(cx, cy, r0, r1, h0, h1) {
  const [a, b] = polar(cx, cy, r1, h0), [c, d] = polar(cx, cy, r1, h1);
  const [e, f] = polar(cx, cy, r0, h1), [g, k] = polar(cx, cy, r0, h0);
  return `M${a} ${b}A${r1} ${r1} 0 0 1 ${c} ${d}L${e} ${f}A${r0} ${r0} 0 0 0 ${g} ${k}Z`;
}

/**
 * values: {slot: v}; ghost: {slot: v} drawn as a dashed outline (a reference year);
 * max: the value a full-radius wedge stands for (shared across years so play shows change).
 */
/* A watercolour sun or moon behind each dial: soft radial washes pushed
 * through turbulence so the edges bleed like paint on paper. Drawn under the
 * wedges at low opacity, so they set the scene without competing with data. */
let wcSeq = 0;
function paintSky(el, kind, cx, cy, R) {
  const id = `wc${++wcSeq}`;
  const defs = svg('defs');
  defs.innerHTML = `
    <filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${wcSeq * 7}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${R * 0.09}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="${R * 0.012}"/>
    </filter>
    <radialGradient id="${id}s" cx="45%" cy="42%" r="60%">
      <stop offset="0" stop-color="#ffe28a"/><stop offset=".55" stop-color="#f7b733"/><stop offset="1" stop-color="#f08c1a" stop-opacity=".2"/>
    </radialGradient>
    <radialGradient id="${id}m" cx="40%" cy="38%" r="65%">
      <stop offset="0" stop-color="#eef0ff"/><stop offset=".6" stop-color="#b9bdf2"/><stop offset="1" stop-color="#7f86d8" stop-opacity=".25"/>
    </radialGradient>
    <mask id="${id}k"><rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="#fff"/>
      <circle cx="${cx + R * 0.24}" cy="${cy - R * 0.16}" r="${R * 0.5}" fill="#000"/></mask>`;
  el.append(defs);
  const g = svg('g', { filter: `url(#${id}f)`, opacity: kind === 'day' ? .42 : .5, 'pointer-events': 'none' });
  if (kind === 'day') {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI + 0.13, b = 0.11;
      const p = (r, t) => `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
      g.append(svg('path', { d: `M${p(R * 0.62, a - b)}L${p(R * 0.97, a)}L${p(R * 0.62, a + b)}Z`, fill: '#f6ad2b', opacity: .7 }));
    }
    g.append(svg('circle', { cx, cy, r: R * 0.6, fill: `url(#${id}s)` }));
  } else {
    g.append(svg('circle', { cx: cx - R * 0.06, cy: cy + R * 0.04, r: R * 0.62, fill: `url(#${id}m)`, mask: `url(#${id}k)` }));
    for (const [dx, dy, r] of [[.55, -.55, .045], [.7, .1, .03], [.35, .62, .035], [-.6, -.62, .03], [.15, -.82, .025]]) {
      g.append(svg('circle', { cx: cx + dx * R, cy: cy + dy * R, r: r * R, fill: '#c9ccff' }));
    }
  }
  el.append(g);
}

export function clocks(el, { values, ghost = null, ghostLabel = '', max, mode = 'count', fmt = fmtN, unit = '', year = null }) {
  const { w, narrow } = size(el);
  const stacked = w < 560;
  // numerals sit at R + 27, so each dial needs R + 40 either side of its centre
  const R = stacked ? Math.min(w / 2 - 44, 170) : Math.min(w / 4 - 44, 190);
  const h = stacked ? (R * 2 + 92) * 2 : R * 2 + 100;
  frame(el, w, h);
  const total = Object.values(values).reduce((a, b) => a + (b || 0), 0) || 1;
  const val = s => (mode === 'share' ? (100 * (values[s] || 0)) / total : values[s] || 0);
  const gtotal = ghost ? Object.values(ghost).reduce((a, b) => a + (b || 0), 0) || 1 : 1;
  const gval = s => (mode === 'share' ? (100 * (ghost[s] || 0)) / gtotal : ghost[s] || 0);
  const r0 = R * 0.26;
  const rad = v => r0 + (R - r0) * Math.sqrt(Math.max(0, v) / (max || 1));   // area-true
  DIALS.forEach((D, di) => {
    const cx = stacked ? w / 2 : w / 4 + (di ? w / 2 : 0);
    const cy = stacked ? 40 + R + di * (R * 2 + 92) : 44 + R;
    el.append(svg('circle', { cx, cy, r: R + 14, class: 'dial' }));
    paintSky(el, D.key, cx, cy, R + 8);
    // the full-scale ring: a wedge reaching it is the largest three-hour figure of any year shown
    el.append(svg('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--ink-muted)', 'stroke-dasharray': '3 4', 'stroke-width': 1, opacity: .6, 'pointer-events': 'none' }));
    for (let hr = 0; hr < 12; hr++) {
      const [x1, y1] = polar(cx, cy, R + 14, hr), [x2, y2] = polar(cx, cy, R + 7, hr);
      el.append(svg('line', { x1, y1, x2, y2, class: 'dial-tick' }));
      const [tx, ty] = polar(cx, cy, R + 27, hr);
      el.append(svg('text', { x: tx, y: ty + 4, class: 'dial-num', 'text-anchor': 'middle' }, String(hr === 0 ? 12 : hr)));
    }
    let half = 0;
    D.slots.forEach(s => {
      half += values[s] || 0;
      const h0 = START[s] + 0.06, h1 = START[s] + 3 - 0.06;
      const r = rad(val(s));
      const p = svg('path', { d: wedge(cx, cy, r0, Math.max(r0 + 1, r), h0, h1), fill: D.color, opacity: .92 });
      el.append(p);
      const sh = (100 * (values[s] || 0)) / total;
      hover(p, () => `<div class="t">${SLOT_NAME[s]}${year ? `, ${year}` : ''}</div><dl><dt>Number</dt><dd>${fmt(values[s])}${unit}</dd><dt>Share of the day</dt><dd>${fmtPct(sh)}</dd>${ghost ? `<dt>${esc(ghostLabel)}</dt><dd>${fmt(ghost[s])}${unit}</dd>` : ''}</dl>`);
      if (ghost && ghost[s] != null) {
        el.append(svg('path', { d: wedge(cx, cy, r0, Math.max(r0 + 1, rad(gval(s))), h0, h1), class: 'ghost', 'pointer-events': 'none' }));
      }
      // label at the wedge's middle hour, outside the wedge if it is small
      const mid = START[s] + 1.5;
      const inside = r - r0 > 46;
      const [lx, ly] = polar(cx, cy, inside ? (r0 + r) / 2 + 4 : r + 16, mid);
      const lab = svg('text', { x: lx, y: ly - 2, 'text-anchor': 'middle', class: 'cell-n', fill: inside ? inkOn(D.color) : 'var(--ink)', 'pointer-events': 'none' });
      lab.append(svg('tspan', { x: lx, dy: 0 }, mode === 'share' ? fmtPct(sh, 0) : fmt(values[s])));
      lab.append(svg('tspan', { x: lx, dy: 12, class: 'cell-p' }, mode === 'share' ? fmt(values[s]) : fmtPct(sh, 0)));
      el.append(lab);
    });
    el.append(svg('circle', { cx, cy, r: r0 - 2, fill: 'var(--surface)', stroke: 'var(--ring-2)' }));
    el.append(svg('text', { x: cx, y: cy - 2, class: 'dial-title', 'text-anchor': 'middle' }, D.title));
    el.append(svg('text', { x: cx, y: cy + 13, class: 'dial-sub', 'text-anchor': 'middle' }, fmtPct((100 * half) / total, 0)));
    el.append(svg('text', { x: cx, y: cy + R + 44, class: 'dial-sub', 'text-anchor': 'middle' }, `${D.sub} · ${fmt(half)}${unit}`));
  });
  // each chart has its own scale: say what the dashed ring stands for, so two charts are not compared by eye
  el.append(svg('text', { x: w / 2, y: h - 4, class: 'dial-sub', 'text-anchor': 'middle' },
    `Dashed ring = ${mode === 'share' ? fmtPct(max, 0) : fmt(max)}${unit} in three hours, the largest of any year on this chart`));
}

export const SLOT_LABELS = SLOT_NAME;

/* ======================================================================
   seasonChart: one line per year across the months (or the hours)
   ====================================================================== */

/**
 * cats: x labels in order (months, or time slots). years: the years, oldest
 * first. get(year, cat) -> value. pos: fractional index into years.
 *
 * Scrubbing (reveal = false): every year is a thin grey line and the year at
 * `pos` is drawn on top in red, with its values. Playing or recording
 * (reveal = true): the years arrive one by one. The current year draws itself
 * across the x axis in red; as the next one starts, it fades to grey and stays
 * in the background, so by the last year every year is there, the latest on top.
 */
export function seasonChart(el, { cats, years, get, pos = 0, reveal = false, fmt = fmtN, unit = '', xLabel = c => c, height }) {
  const { w, narrow } = size(el);
  const all = years.flatMap(y => cats.map(c => get(y, c)).filter(v => v != null));
  if (!all.length) return emptyChart(el);
  const h = height || (narrow ? 300 : 380);
  const m = { top: 22, right: narrow ? 46 : 60, bottom: 30, left: 50 };
  frame(el, w, h);
  const hi = Math.max(...all) * 1.08 || 1;
  const x = i => m.left + (i * (w - m.left - m.right)) / Math.max(1, cats.length - 1);
  const y = scaleLinear([0, hi], [h - m.bottom, m.top]);
  for (const t of ticks(0, hi, 5)) {
    el.append(svg('line', { x1: m.left, x2: w - m.right, y1: y(t), y2: y(t), class: 'grid-line' }));
    el.append(svg('text', { x: m.left - 7, y: y(t) + 3.5, class: 'tick', 'text-anchor': 'end' }, fmtShort(t)));
  }
  el.append(svg('line', { x1: m.left, x2: w - m.right, y1: h - m.bottom, y2: h - m.bottom, class: 'axis-line' }));
  cats.forEach((c, i) => el.append(svg('text', { x: x(i), y: h - m.bottom + 17, class: 'tick', 'text-anchor': 'middle' }, xLabel(c))));
  const k = Math.max(0, Math.min(years.length - 1, Math.floor(pos)));
  const f = pos - k;
  const cur = reveal ? k : Math.round(pos);
  const pathOf = (yr, upto = cats.length - 1) => {
    let d = '', pen = false;
    const whole = Math.floor(upto);
    for (let i = 0; i <= whole; i++) {
      const v = get(yr, cats[i]);
      if (v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true;
    }
    const frac = upto - whole;
    if (frac > 0 && whole + 1 < cats.length) {
      const a = get(yr, cats[whole]), b = get(yr, cats[whole + 1]);
      if (a != null && b != null) d += `L${lerp(x(whole), x(whole + 1), frac).toFixed(1)} ${y(lerp(a, b, frac)).toFixed(1)}`;
    }
    return d;
  };
  // the background: every year before the current one (all of them while scrubbing)
  years.forEach((yr, i) => {
    if (i === cur) return;
    if (reveal && i > cur) return;
    // in a recording the year just finished keeps a red tint while the next draws
    const fresh = reveal && i === cur - 1 ? Math.max(0, 1 - f * 1.6) : 0;
    el.append(svg('path', { d: pathOf(yr), fill: 'none', stroke: fresh > 0 ? 'var(--critical)' : 'var(--axis)', 'stroke-width': fresh > 0 ? 1.2 + fresh : 1.1, opacity: fresh > 0 ? .35 + .5 * fresh : .75, 'stroke-linejoin': 'round' }));
  });
  // the current year, on top
  const yr = years[cur];
  // the last year has no successor to hand over to: at the end of a recording it is drawn whole
  const done = !reveal || (k === years.length - 1 && f === 0);
  const upto = done ? cats.length - 1 : Math.min(cats.length - 1, f * (cats.length - 1) * 1.25);
  el.append(svg('path', { d: pathOf(yr, upto), fill: 'none', stroke: 'var(--critical)', 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const pts = cats.map((c, i) => ({ i, v: get(yr, c) })).filter(p => p.v != null && p.i <= upto + 1e-6);
  pts.forEach(p => {
    el.append(svg('circle', { cx: x(p.i), cy: y(p.v), r: 3.4, fill: 'var(--critical)', class: 'dot' }));
    if (!narrow || p.i % 2 === 0) el.append(svg('text', { x: x(p.i), y: y(p.v) - 8, class: 'val-label', 'text-anchor': 'middle' }, fmtShort(p.v)));
  });
  const lastPt = pts[pts.length - 1];
  if (lastPt) el.append(svg('text', { x: x(lastPt.i) + 8, y: y(lastPt.v) + 4, class: 'year-tag', style: 'fill: var(--critical)' }, String(yr)));
  // hover: the value of the highlighted year and the range across all years, per month
  cats.forEach((c, i) => {
    const vals = years.map(yy => get(yy, c)).filter(v => v != null);
    const band = svg('rect', { x: x(i) - (w - m.left - m.right) / (2 * Math.max(1, cats.length - 1)), y: m.top, width: (w - m.left - m.right) / Math.max(1, cats.length - 1), height: h - m.top - m.bottom, class: 'hit' });
    hover(band, () => `<div class="t">${esc(xLabel(c))}</div><dl><dt>${yr}</dt><dd>${fmt(get(yr, c))}${unit}</dd><dt>Lowest year</dt><dd>${fmt(Math.min(...vals))}</dd><dt>Highest year</dt><dd>${fmt(Math.max(...vals))}</dd></dl>`);
    el.append(band);
  });
}

/* ======================================================================
   choropleth: the States and UTs, coloured on the red ramp
   ====================================================================== */

/* The boundary file is datameet's pre-2019 one (cpi's copy): Jammu & Kashmir
 * undivided with Ladakh, Telangana separate, Dadra & Nagar Haveli and Daman &
 * Diu separate. Names are mapped to NCRB's here. */
const GEO_NAME = {
  'Andaman and Nicobar': 'Andaman & Nicobar Islands', 'Orissa': 'Odisha', 'Uttaranchal': 'Uttarakhand',
  'Jammu and Kashmir': 'Jammu & Kashmir', 'Dadra and Nagar Haveli': 'Dadra & Nagar Haveli', 'Daman and Diu': 'Daman & Diu',
};
const projCache = new WeakMap();

function projector(geo, outline, w, h, pad = 8) {
  let cached = projCache.get(geo);
  if (cached && cached.w === w && cached.h === h) return cached;
  const pts = [];
  const walk = c => (typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk));
  (outline || geo).features.forEach(f => walk(f.geometry.coordinates));
  const lat0 = 22 * Math.PI / 180, kx = Math.cos(lat0);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [lon, lat] of pts) { x0 = Math.min(x0, lon * kx); x1 = Math.max(x1, lon * kx); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat); }
  const s = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const P = ([lon, lat]) => `${(ox + (lon * kx - x0) * s).toFixed(1)},${(oy + (y1 - lat) * s).toFixed(1)}`;
  const path = g => {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    return polys.map(poly => poly.map(ring => `M${ring.map(P).join('L')}Z`).join('')).join('');
  };
  cached = {
    w, h,
    // era maps (web/geo/states-YYYY.geojson) carry `std` (the data's name) and `name` (as named then)
    states: geo.features.map(f => {
      const p = f.properties, era = p.std != null;
      const name = era ? p.std : GEO_NAME[p.NAME_1] || p.NAME_1;
      return { name, label: era ? p.name : name, era, d: path(f.geometry) };
    }),
    outline: outline ? outline.features.map(f => path(f.geometry)).join('') : null,
  };
  projCache.set(geo, cached);
  return cached;
}

/**
 * values: {NCRB state name: v} for one (possibly interpolated) year; max: the
 * top of the colour scale, held across years; hl: a state to outline;
 * year: for Andhra Pradesh before 2014, which also coloured Telangana.
 */
export function choropleth(el, { geo, outline = null, values, max, domain = null, fmt = fmtN, unit = '', hl = null, year = null, label = 'Value' }) {
  // the colour bins come from every value the map can show over the years (domain), or this year's values
  const B = bins(domain && domain.length ? domain : Object.values(values), 7, v => fmtShort(v));
  const { w, narrow } = size(el);
  const h = Math.round(Math.min(narrow ? w * 1.12 : w * 0.95, 720));
  frame(el, w, h);
  const legendW = narrow ? 0 : 150;
  const P = projector(geo, outline, w - legendW, h);
  if (P.outline) el.append(svg('path', { d: P.outline, fill: 'var(--heat-0)', stroke: 'var(--axis)', 'stroke-width': .8 }));
  const val = st => {
    if (values[st.name] != null) return values[st.name];
    if (st.era) return null;                       // an era map already has that year's States
    if (st.name === 'Telangana' && year != null && year < 2014) return values['Andhra Pradesh'];
    if ((st.name === 'Dadra & Nagar Haveli' || st.name === 'Daman & Diu')) return values['Dadra & Nagar Haveli and Daman & Diu'];
    return null;
  };
  for (const st of P.states) {
    const v = val(st);
    const fill = v == null ? 'var(--heat-0)' : `var(--heat-${B.step(v)})`;
    const p = svg('path', { d: st.d, fill, stroke: 'var(--surface)', 'stroke-width': .7, 'stroke-linejoin': 'round' });
    el.append(p);
    const then = st.era && st.label !== st.name && !/&|and/.test(st.label + st.name) ? ` (now ${st.name})` : '';
    const ap = !st.era && st.name === 'Telangana' && year < 2014 ? ' (part of Andhra Pradesh)' : '';
    hover(p, () => `<div class="t">${esc(st.label)}${esc(then)}${ap}${year ? `, ${year}` : ''}</div><dl><dt>${esc(label)}</dt><dd>${v == null ? 'not printed' : fmt(v) + unit}</dd></dl>`);
  }
  if (hl) {
    const st = P.states.find(s => s.name === hl);
    if (st) el.append(svg('path', { d: st.d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8, 'pointer-events': 'none' }));
  }
  // legend: each bin's colour and range
  const nb = B.bins.length;
  const lx = narrow ? 12 : w - legendW + 18, ly = narrow ? h - 34 : h - 30 - nb * 24;
  B.bins.forEach((b, k) => {
    if (narrow) {
      const bw = (w - 24) / nb;
      el.append(svg('rect', { x: lx + k * bw, y: ly, width: bw - 2, height: 10, rx: 2, fill: `var(--heat-${b.step})` }));
      if (k % 2 === 0 || k === nb - 1) el.append(svg('text', { x: lx + k * bw, y: ly + 24, class: 'tick' }, k === 0 ? `<${fmtShort(B.breaks[0] ?? 0)}` : `${fmtShort(B.breaks[k - 1])}+`));
    } else {
      el.append(svg('rect', { x: lx, y: ly + k * 24, width: 18, height: 18, rx: 3, fill: `var(--heat-${b.step})` }));
      el.append(svg('text', { x: lx + 26, y: ly + k * 24 + 13, class: 'tick' }, b.label));
    }
  });
  if (!narrow) el.append(svg('text', { x: lx, y: ly - 10, class: 'tick' }, 'not printed: grey'));
}
