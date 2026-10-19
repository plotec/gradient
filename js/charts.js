// Schlanke SVG-Diagramme (Linie mit Trend, Balken mit Ziellinie).
import { fmtMax, fmtShort, dayKey } from './utils.js';

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

/**
 * series: [{ points:[{x(ms), y}], color, width?, dots?, dash? }]
 */
export function lineChart({ series, height = 180, yDigits = 1, yPad = 0.1, yRight = false, xLabels = null }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return '<div class="empty small">Noch zu wenig Daten für ein Diagramm.</div>';
  const W = 340, H = height, L = yRight ? 6 : 34, R = yRight ? 36 : 8, T = 10, B = 22;
  const xs = [...all.map((p) => p.x), ...(xLabels || []).map((l) => l.x)], ys = all.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * yPad || 0.5;
  const { lo, hi, ticks } = niceTicks(y0 - pad, y1 + pad, 3);
  const sx = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y) => T + (1 - (y - lo) / (hi - lo || 1)) * (H - T - B);
  let g = '';
  for (const t of ticks) {
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(t)}" y2="${sy(t)}"/>`;
    g += yRight ? `<text x="${W}" y="${sy(t) + 3.5}" text-anchor="end">${fmtMax(t, yDigits)}</text>` : `<text x="${L - 6}" y="${sy(t) + 3.5}" text-anchor="end">${fmtMax(t, yDigits)}</text>`;
  }
  if (xLabels) {
    xLabels.forEach((l) => { g += `<text x="${sx(l.x)}" y="${H - 6}" text-anchor="middle">${l.label}</text>`; });
  } else {
    // x-Beschriftung: Anfang, Mitte, Ende
    const xl = [x0, (x0 + x1) / 2, x1];
    xl.forEach((x, i) => {
      g += `<text x="${sx(x)}" y="${H - 6}" text-anchor="${['start', 'middle', 'end'][i]}">${fmtShort(dayKey(new Date(x)))}</text>`;
    });
  }
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
    if (s.area) {
      const last = s.points[s.points.length - 1], first = s.points[0];
      g += `<path d="${d}L${sx(last.x)},${H - B}L${sx(first.x)},${H - B}Z" fill="${s.color}" fill-opacity=".12" stroke="none"/>`;
    }
    if (s.line !== false) g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} ${s.opacity ? `stroke-opacity="${s.opacity}"` : ''}/>`;
    if (s.dots) for (const p of s.points) g += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${s.dotR || 2}" fill="${s.color}" fill-opacity="${s.dotOpacity ?? 1}"/>`;
    if (s.endDot) {
      const p = s.points[s.points.length - 1];
      g += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    }
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:auto;aspect-ratio:${W}/${H}">${g}</svg>`;
}

let gid = 0;
/**
 * Balken im Referenz-Look: abgerundet, Farbverlauf, ein hervorgehobener Balken (amber, Glow),
 * gestrichelte Ziellinie, y-Achse rechts.
 * bars: [{ y, label, highlight? }]
 */
export function barChart({ bars, goal, color = 'var(--accent)', hiColor = 'var(--amber)', height = 160 }) {
  if (!bars.some((b) => b.y > 0)) return '<div class="empty small">Noch keine Einträge im Zeitraum.</div>';
  const W = 340, H = height, L = 4, R = 40, T = 10, B = 24;
  const max = Math.max(goal || 0, ...bars.map((b) => b.y)) * 1.1;
  const { hi, ticks } = niceTicks(0, max, 3);
  const sy = (y) => T + (1 - y / hi) * (H - T - B);
  const bw = (W - L - R) / bars.length;
  const barW = Math.min(14, bw * 0.55);
  const id = `g${++gid}`;
  let g = `<defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".45"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hiColor}"/><stop offset="1" stop-color="${hiColor}" stop-opacity=".6"/></linearGradient>
    <filter id="${id}f" x="-100%" y="-30%" width="300%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>`;
  for (const t of ticks) {
    g += `<line class="grid" x1="${L}" x2="${W - R + 4}" y1="${sy(t)}" y2="${sy(t)}" stroke-opacity=".6"/>`;
    g += `<text x="${W}" y="${sy(t) + 3.5}" text-anchor="end">${fmtMax(t, 0)}</text>`;
  }
  if (goal) g += `<line x1="${L}" x2="${W - R + 4}" y1="${sy(goal)}" y2="${sy(goal)}" stroke="var(--muted)" stroke-dasharray="3 4" stroke-opacity=".7"/>`;
  const every = Math.ceil(bars.length / 8);
  bars.forEach((b, i) => {
    const cx = L + i * bw + bw / 2;
    if (b.y > 0) {
      const y = sy(b.y), h = sy(0) - y, x = cx - barW / 2, r = Math.min(barW / 2, h);
      const d = `M${x.toFixed(1)},${sy(0).toFixed(1)}V${(y + r).toFixed(1)}A${r},${r} 0 0 1 ${(x + barW).toFixed(1)},${(y + r).toFixed(1)}V${sy(0).toFixed(1)}Z`;
      if (b.highlight) g += `<path d="${d}" fill="${hiColor}" opacity=".55" filter="url(#${id}f)"/>`;
      g += `<path d="${d}" fill="url(#${id}${b.highlight ? 'b' : 'a'})" ${b.dim ? 'opacity=".45"' : ''}/>`;
    }
    if (b.label && (i % every === 0 || bars.length <= 8)) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:auto;aspect-ratio:${W}/${H}">${g}</svg>`;
}

/** Ring für Kalorien. */
export function ring(frac, color, over = false) {
  const r = 46, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="8"/>
    ${f > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${over ? 'var(--bad)' : color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}"/>` : ''}</svg>`;
}
