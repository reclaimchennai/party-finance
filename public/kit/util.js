/* Shared helpers: DOM, icons, formatting, scales, colour, theme, tooltip.
 * After cpi.reclaimchennai.city's web/js/util.js, trimmed and extended. */

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function svg(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG_NS, tag);
  const isText = tag === 'text' || tag === 'tspan';
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    // the stylesheet colours chart text, and CSS beats presentation attributes: a chosen fill goes in style
    if (isText && (k === 'fill' || k === 'font-weight')) n.style.setProperty(k, v);
    else n.setAttribute(k, v);
  }
  if (text !== undefined) n.textContent = text;
  return n;
}
export function el(tag, attrs = {}, html) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  if (html !== undefined) n.innerHTML = html;
  return n;
}
export function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
export const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------- formatting */
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const fmtN = v => (v == null || Number.isNaN(v) ? '–' : nf0.format(Math.round(v)));
export const fmt1 = v => (v == null || Number.isNaN(v) ? '–' : nf1.format(v));
export const fmtPct = (v, d = 1) => (v == null || Number.isNaN(v) ? '–' : `${v.toFixed(d)}%`);
export const fmtShort = v => (v == null ? '–' : Math.abs(v) >= 1e5 ? `${nf1.format(v / 1e5)}L` : Math.abs(v) >= 1e4 ? `${nf0.format(v / 1e3)}k` : nf0.format(v));

/* ----------------------------------------------------------------- scales */
export function scaleLinear([d0, d1], [r0, r1]) {
  const span = (d1 - d0) || 1;
  const f = v => r0 + ((v - d0) / span) * (r1 - r0);
  f.invert = p => d0 + ((p - r0) / ((r1 - r0) || 1)) * span;
  return f;
}
export function ticks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* ----------------------------------------------------------------- colour */
export function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export const SERIES = i => `var(--series-${(i % 8) + 1})`;
export const HEAT_STEPS = 7;
/** Step 1..7 of the red ramp for v in [0, max]; 0 for no value. Square-root, so small counts still show. */
/**
 * Colour bins from the spread of the values themselves (every place and year a chart can show), not from the
 * largest one, the top bin open-ended. Evenly spread values (rates) get equal round steps up to their 98th
 * percentile; skewed ones (counts) get bins of about a seventh of the values each, edges rounded to two significant
 * figures. One stray value (a UT of a few lakh people) then cannot wash out the rest.
 * Returns {breaks, step(v) -> 1..7, label(k) -> text for bin k (0-based)}.
 */
export function bins(vals, n = HEAT_STEPS, fmt = v => String(v)) {
  const a = vals.filter(v => v != null && Number.isFinite(v)).sort((x, y) => x - y);
  const r2 = v => { if (!(v > 0)) return 0; const e = 10 ** (Math.floor(Math.log10(v)) - 1); return Math.round(v / e) * e; };
  const breaks = [];
  const q = f => a[Math.min(a.length - 1, Math.floor(f * a.length))];
  if (a.length && q(0.5) > 0 && q(0.98) / q(0.5) <= 6) {
    // evenly spread values (rates): equal round steps up to the 98th percentile, the rest in the open top bin
    const raw = q(0.98) / (n - 1), e = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * e).find(st => st * (n - 1) >= q(0.98) * 0.9) || 10 * e;
    for (let k = 1; k < n; k++) if (k * step < a.at(-1)) breaks.push(+(k * step).toPrecision(6));
  } else if (a.length) {
    // skewed values (counts, where a few large States dwarf the rest): bins of equal numbers of values
    for (let k = 1; k < n; k++) {
      const b = r2(q(k / n));
      if (b > 0 && (!breaks.length || b > breaks.at(-1)) && b < a.at(-1)) breaks.push(b);
    }
  }
  const nb = breaks.length + 1;
  const toStep = i => (nb === 1 ? n : 1 + Math.round((i * (n - 1)) / (nb - 1)));
  return {
    breaks,
    step: v => { if (v == null || !Number.isFinite(v)) return 0; let i = 0; while (i < breaks.length && v >= breaks[i]) i++; return toStep(i); },
    bins: Array.from({ length: nb }, (_, i) => ({ step: toStep(i), label: nb === 1 ? 'all' : i === 0 ? `under ${fmt(breaks[0])}` : i === nb - 1 ? `${fmt(breaks[i - 1])} and over` : `${fmt(breaks[i - 1])}–${fmt(breaks[i])}` })),
  };
}
export function heatStep(v, max) {
  if (v == null || !(max > 0)) return 0;
  return Math.max(1, Math.min(HEAT_STEPS, Math.ceil(Math.sqrt(Math.max(0, v) / max) * HEAT_STEPS)));
}
/** Readable ink on a fill: compares the fill's luminance, read from the live theme. */
export function inkOn(fillVar) {
  const c = cssVar(fillVar.replace(/^var\((.*)\)$/, '$1'));
  const m = c.match(/^#([0-9a-f]{6})$/i);
  if (!m) return 'var(--ink)';
  const n = parseInt(m[1], 16);
  const lin = x => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
  const L = .2126 * lin(n >> 16) + .7152 * lin((n >> 8) & 255) + .0722 * lin(n & 255);
  return L > .36 ? '#1a0b0a' : '#ffffff';
}

/* ------------------------------------------------------------------ theme */
const THEME_KEY = 'ncrb-theme';
export function initTheme(onChange) {
  let stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch { /* private mode */ }
  const sys = window.matchMedia?.('(prefers-color-scheme: dark)');
  const chosen = () => (stored === 'light' || stored === 'dark' ? stored : null);
  const apply = t => {
    document.documentElement.dataset.theme = t;
    $('#theme-toggle')?.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} theme`);
  };
  apply(chosen() ?? (sys?.matches ? 'dark' : 'light'));
  sys?.addEventListener?.('change', e => { if (!chosen()) { apply(e.matches ? 'dark' : 'light'); onChange?.(); } });
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next); stored = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    onChange?.();
  });
}

/* ---------------------------------------------------------------- tooltip */
const tipEl = () => document.getElementById('tip');
export function showTip(html, ev) { const t = tipEl(); if (!t) return; t.innerHTML = html; t.classList.add('on'); moveTip(ev); }
export function moveTip(ev) {
  const t = tipEl(); if (!t || !ev) return;
  const pad = 14, r = t.getBoundingClientRect();
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  t.style.left = `${Math.max(8, x)}px`; t.style.top = `${Math.max(8, y)}px`;
}
export function hideTip() { tipEl()?.classList.remove('on'); }
export function hover(node, html) {
  node.addEventListener('pointerenter', ev => showTip(html(), ev));
  node.addEventListener('pointermove', moveTip);
  node.addEventListener('pointerleave', hideTip);
}

/* ------------------------------------------------------------------- misc */
export function debounce(fn, ms = 150) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function onResize(node, fn) { const ro = new ResizeObserver(debounce(fn, 90)); ro.observe(node); return ro; }
export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
/** Run fn once when node first comes near the viewport. */
export function whenVisible(node, fn, margin = '500px') {
  if (!node || typeof IntersectionObserver !== 'function') { fn(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(node);
}
