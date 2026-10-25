// Einstieg: Tabs, Rendering, Service Worker.
import { state, subscribe, initStore, setPersistHook } from './store.js';
import { icon, onAct, redrawSheets, unlockAudio, closeAllSheets, toast } from './ui.js';
import { currentSession, pullAndMerge, schedulePush } from './cloud.js';
import { showLogin } from './auth.js';
import { autoAdjustGoal } from './goals.js';
import { schedulePublish, invalidateBoard } from './points.js';
import { renderTraining, openWorkout } from './training.js';
import { renderNutrition, openAddFood, setNutDate, voiceForMeal } from './nutrition.js';
import { renderBody, resetBodyDate } from './body.js';
import { todayKey } from './utils.js';
import { renderDashboard, applyTheme } from './dashboard.js';

const TABS = [
  { id: 'dashboard', label: 'Übersicht', icon: 'grid', render: renderDashboard },
  { id: 'training', label: 'Training', icon: 'dumbbell', render: renderTraining },
  { id: 'nutrition', label: 'Ernährung', icon: 'food', render: renderNutrition },
  { id: 'body', label: 'Körper', icon: 'scale', render: renderBody },
];

const initialHash = location.hash.replace('#', '');
let tab = TABS.some((t) => t.id === initialHash) ? initialHash : (() => { try { return localStorage.getItem('formkurve-tab') || 'dashboard'; } catch { return 'dashboard'; } })();

function renderTabbar() {
  const btn = (t) => `<button class="${t.id === tab ? 'on' : ''}" data-act="goto" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`;
  document.getElementById('tabbar').innerHTML = `${TABS.slice(0, 2).map(btn).join('')}
    <div class="fab-slot"><button class="fab" data-act="quick-add" aria-label="Schnell hinzufügen">${icon('plus')}</button></div>
    ${TABS.slice(2).map(btn).join('')}`;
}

function goto(next) {
  closeAllSheets();
  if (next === 'dashboard') invalidateBoard();
  tab = next;
  try { localStorage.setItem('formkurve-tab', tab); } catch {}
  history.replaceState(null, '', `#${tab}`);
  render();
  window.scrollTo(0, 0);
}

/** Plus-Button: Schnellaktionen als Bottom-Sheet. */
function quickAdd() {
  const wrap = document.createElement('div');
  wrap.className = 'dialog-wrap bottom';
  const aw = state.activeWorkout;
  const items = [
    ['voice', 'Essen per Sprache eintragen', 'mic', 'var(--on-accent)', 'var(--accent)'],
    ['train', aw ? 'Training fortsetzen' : 'Training starten', 'dumbbell', 'var(--accent)', 'var(--accent-soft)'],
    ['food', 'Essen eintragen', 'food', 'var(--amber)', 'var(--amber-soft)'],
    ['weight', 'Gewicht eintragen', 'scale', 'var(--body)', 'var(--body-soft)'],
    ['habits', 'Habits abhaken', 'check', 'var(--habit)', 'color-mix(in srgb, var(--habit) 15%, transparent)'],
  ];
  wrap.innerHTML = `<div class="dialog" role="dialog" aria-label="Schnell hinzufügen">
    <h3>Hinzufügen</h3>
    <div class="action-grid">${items.map(([k, l, ic, c, bg]) => `<button data-k="${k}" ${k === 'voice' ? 'style="grid-column:span 2;flex-direction:row;align-items:center"' : ''}><span class="ai" style="background:${bg};color:${c}">${icon(ic)}</span>${l}</button>`).join('')}</div>
    <button class="btn ghost block" data-k="">Abbrechen</button></div>`;
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b && e.target !== wrap) return;
    e.stopPropagation();
    wrap.remove();
    const k = b?.dataset.k;
    if (k === 'train') { goto('training'); if (state.activeWorkout) openWorkout(); }
    if (k === 'food' || k === 'voice') {
      goto('nutrition');
      setNutDate(todayKey());
      render();
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      const meal = Math.min(h < 10.5 ? 0 : h < 14.5 ? 1 : h < 17.5 ? 2 : h < 21.5 ? 3 : 4, state.settings.mealNames.length - 1);
      if (k === 'voice') voiceForMeal(meal); else openAddFood({ meal });
    }
    if (k === 'weight' || k === 'habits') {
      resetBodyDate();
      goto('body');
      if (k === 'weight') document.getElementById('weight-in')?.focus();
    }
  });
  document.body.appendChild(wrap);
}

function render() {
  const view = document.getElementById('view');
  const active = document.activeElement;
  const activeId = active && view.contains(active) ? active.id : null;
  const sel = activeId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null;
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  view.innerHTML = t.render();
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(...sel); } catch {} }
  }
  renderTabbar();
}

function rerenderAll() {
  render();
  redrawSheets();
}

onAct({
  goto: (el) => {
    const next = el.dataset.tab;
    if (next === tab && !document.querySelector('.sheet')) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    goto(next);
  },
  'quick-add': () => quickAdd(),
});

subscribe(rerenderAll);
window.addEventListener('rerender', render);
document.addEventListener('pointerdown', unlockAudio, { once: true });

// Tageswechsel (App über Nacht offen) und Rückkehr in die App
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); location.reload(); return; }
  render();
});

function start(session, { adoptLegacy = false } = {}) {
  initStore(session.userId, { adoptLegacy });
  setPersistHook(() => { schedulePush(); schedulePublish(); });
  schedulePublish();
  applyTheme();
  render();
  if (state.activeWorkout && tab === 'training') openWorkout();
  if (session.mode === 'cloud') pullAndMerge();
  if (adoptLegacy) toast('Deine bisherigen Daten wurden in den Account übernommen', 3500);
  const adjusted = autoAdjustGoal();
  if (adjusted) toast(`Kalorienziel an deinen Umsatz angepasst: ${adjusted.toLocaleString('de-DE')} kcal`, 3500);
}

const session = currentSession();
if (session) start(session);
else showLogin((s, opts) => { tab = 'dashboard'; start(s, opts); });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
try { navigator.storage?.persist?.(); } catch {}
