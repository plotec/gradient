// UI-Grundbausteine: Icons, Aktionen (Event-Delegation), Sheets, Dialoge, Toast.
import { esc } from './utils.js';

const P = {
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6M7 3v6M15 3c2.5 1 3 5 3 8h-3v10"/>',
  scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 11a5 5 0 0 1 10 0z"/><path d="M12 11l1.8-2.6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
  barcode: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v6h9M7 21v-7h10v7"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-5-5-7-5-12-3 2-6 5.5-6 9-1-1-1.5-2-1.5-3C4.5 11 5 13 5 15c0 4.3 3 7 7 7z"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v8"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3z"/>',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

// ---------- Aktionen ----------
const actions = {};
const inputs = {};
const changes = {};
/** Klick-Handler registrieren: Elemente mit data-act="name" lösen fn(el, ev) aus. */
export const onAct = (map) => Object.assign(actions, map);
/** data-in="name" -> fn(el, ev) bei jeder Eingabe. */
export const onInput = (map) => Object.assign(inputs, map);
/** data-ch="name" -> fn(el, ev) bei change. */
export const onChange = (map) => Object.assign(changes, map);

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-in]');
  if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, ev);
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-ch]');
  if (el && changes[el.dataset.ch]) changes[el.dataset.ch](el, ev);
});
document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const el = ev.target.closest('[data-submit]');
  if (el && actions[el.dataset.submit]) actions[el.dataset.submit](el, ev);
});

// ---------- Sheets (Vollbild-Ebenen über der App) ----------
const stack = [];
const host = () => document.getElementById('sheets');

/**
 * Öffnet ein Sheet. spec = { id, title, render: () => ({ body, foot?, head? }), onClose? }
 * render() wird bei jeder Zustandsänderung erneut aufgerufen.
 */
export function openSheet(spec) {
  const el = document.createElement('section');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.dataset.sheet = spec.id || '';
  host().appendChild(el);
  const entry = { ...spec, el };
  stack.push(entry);
  drawSheet(entry, true);
  document.body.style.overflow = 'hidden';
  return entry;
}
export function closeSheet(entry = stack[stack.length - 1]) {
  if (!entry) return;
  const i = stack.indexOf(entry);
  if (i < 0) return;
  stack.splice(i, 1);
  entry.el.remove();
  entry.onClose?.();
  if (!stack.length) document.body.style.overflow = '';
}
export const closeAllSheets = () => { while (stack.length) closeSheet(); };
export const topSheet = () => stack[stack.length - 1];
export const sheetOpen = (id) => stack.some((s) => s.id === id);

function drawSheet(entry, first = false) {
  const r = entry.render(entry);
  if (r == null) { closeSheet(entry); return; }
  const scroller = entry.el.querySelector('.sheet-body');
  const top = scroller ? scroller.scrollTop : 0;
  const active = document.activeElement;
  const activeId = active && entry.el.contains(active) ? active.id : null;
  entry.el.innerHTML = `
    <header class="sheet-head">
      ${r.left ?? `<button class="icon-btn plain" data-act="sheet-close" aria-label="Schließen">${icon(stack.length > 1 && !r.closeX ? 'back' : 'x')}</button>`}
      <h2>${esc(r.title ?? entry.title ?? '')}</h2>
      ${r.right ?? '<span style="width:40px"></span>'}
    </header>
    ${r.top ?? ''}
    <div class="sheet-body"><div class="inner">${r.body}</div></div>
    ${r.foot ? `<footer class="sheet-foot"><div class="inner">${r.foot}</div></footer>` : ''}`;
  const sb = entry.el.querySelector('.sheet-body');
  if (!first) sb.scrollTop = top;
  if (activeId) {
    const again = document.getElementById(activeId);
    if (again) { again.focus(); if (again.setSelectionRange && again.type === 'text') { const l = again.value.length; again.setSelectionRange(l, l); } }
  }
  entry.afterRender?.(entry, first);
}
export function redrawSheets() { [...stack].forEach((s) => drawSheet(s)); }
export function redrawSheet(entry) { drawSheet(entry); }

onAct({ 'sheet-close': () => closeSheet() });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length && !document.querySelector('.dialog-wrap')) closeSheet(); });

// ---------- Dialoge (statt confirm/prompt) ----------
export function confirmDialog({ title, text = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="alertdialog">
      <h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}
      <div class="row">${cancel ? `<button class="btn ghost" data-r="0">${esc(cancel)}</button>` : ''}<button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div>
    </div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (b || e.target === wrap) { e.stopPropagation(); wrap.remove(); resolve(b ? b.dataset.r === '1' : false); }
    });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-r="1"]').focus();
  });
}

/** Auswahl aus mehreren Optionen (Aktionsmenü). Liefert value oder null. */
export function menuDialog({ title, options }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = `<div class="dialog" role="dialog">
      ${title ? `<h3>${esc(title)}</h3>` : ''}
      <div class="stack" style="gap:6px">${options.map((o, i) => `<button class="btn block ${o.danger ? 'danger' : ''}" data-i="${i}" style="justify-content:flex-start">${o.icon ? icon(o.icon) : ''}${esc(o.label)}</button>`).join('')}</div>
      <button class="btn ghost block" data-i="-1">Abbrechen</button>
    </div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b || e.target === wrap) {
        e.stopPropagation(); wrap.remove();
        const i = b ? +b.dataset.i : -1;
        resolve(i >= 0 ? options[i].value : null);
      }
    });
    document.body.appendChild(wrap);
  });
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/** Kleines Haptik-/Ton-Feedback. */
let audioCtx;
export function beep(times = 2) {
  try { navigator.vibrate?.([180, 90, 180]); } catch {}
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      const t0 = audioCtx.currentTime + i * 0.25;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    }
  } catch {}
}
/** AudioContext beim ersten Tippen entsperren (iOS). */
export function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {}
}
