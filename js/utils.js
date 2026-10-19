// Kleine Helfer, die alle Bereiche nutzen.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n) => String(n).padStart(2, '0');

/** Lokales Datum als 'YYYY-MM-DD'. */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayKey = () => dayKey(new Date());

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const MONTHS = MON;

/** 'Heute', 'Gestern' oder 'Mo, 12. Okt'. */
export function fmtDay(key, { long = false } = {}) {
  const t = todayKey();
  if (key === t) return 'Heute';
  if (key === addDays(t, -1)) return 'Gestern';
  if (key === addDays(t, 1)) return 'Morgen';
  const d = parseKey(key);
  const base = `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
  return long || d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base;
}
export function fmtShort(key) {
  const d = parseKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Millisekunden als '1:02:03' bzw. '12:03'. */
export function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
export function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${pad(min % 60)} min`;
}

const nf = {};
export function fmt(n, d = 0) {
  if (n == null || Number.isNaN(n)) return '–';
  const k = d;
  nf[k] ||= new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  return nf[k].format(n);
}
/** Zahl mit bis zu d Nachkommastellen (ohne erzwungene Nullen). */
export function fmtMax(n, d = 1) {
  if (n == null || Number.isNaN(n)) return '–';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: d }).format(n);
}
export function signed(n, d = 0) {
  if (n == null || Number.isNaN(n)) return '–';
  const s = fmt(Math.abs(n), d);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** Akzeptiert '82,4' und '82.4'. Leer -> null. */
export function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
export const roundTo = (n, step) => Math.round(n / step) * step;
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);

/** HTML-escape für Nutzereingaben. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Geschätztes 10-Wiederholungs-Maximum aus Gewicht × Wdh.
 * 1RM nach Epley (w · (1 + r/30)), dann auf 10 Wdh zurückgerechnet (1RM · 0,75).
 * Bei genau 10 Wdh ergibt sich exakt das bewegte Gewicht.
 */
export function e10rm(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  const oneRm = reps === 1 ? weight : weight * (1 + reps / 30);
  return oneRm * 0.75;
}

/** Lineare Regression – liefert Steigung pro x-Einheit. */
export function linreg(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = sum(points, (p) => p.x) / n;
  const my = sum(points, (p) => p.y) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  if (!den) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
