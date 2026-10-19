// Einstieg: Tabs, Rendering, Service Worker.
import { state, subscribe } from './store.js';
import { icon, onAct, redrawSheets, unlockAudio, closeAllSheets } from './ui.js';
import { renderTraining, openWorkout } from './training.js';
import { renderNutrition } from './nutrition.js';
import { renderBody } from './body.js';
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
  document.getElementById('tabbar').innerHTML = TABS.map((t) => `
    <button class="${t.id === tab ? 'on' : ''}" data-act="goto" data-tab="${t.id}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`).join('');
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
    closeAllSheets();
    if (next === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    tab = next;
    try { localStorage.setItem('formkurve-tab', tab); } catch {}
    history.replaceState(null, '', `#${tab}`);
    render();
    window.scrollTo(0, 0);
  },
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

applyTheme();
render();
if (state.activeWorkout && tab === 'training') openWorkout();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
try { navigator.storage?.persist?.(); } catch {}
