// Punkte & Rangliste. Punkte werden aus den eigenen Daten berechnet (jederzeit nachvollziehbar)
// und als Zusammenfassung veröffentlicht: lokal für alle Accounts auf diesem Gerät, mit Cloud für alle Freunde.
import { state, sessionStrength } from './store.js';
import { todayKey, addDays, parseKey, dayKey, esc, fmt, fmtDay } from './utils.js';
import { dayStatus, nutritionCheck, plannedFor, supplementHabits } from './success.js';
import { weeklyWeightResults } from './goals.js';
import { currentSession, cloudEnabled, restCall } from './cloud.js';
import { onAct, openSheet } from './ui.js';

export const RULES = [
  ['Training nach Plan erledigt', 30],
  ['Zusätzliches Training (Pausentag/ohne Plan)', 15],
  ['Übung gesteigert (geschätztes 10RM höher als letztes Mal)', 10],
  ['Neuer Rekord bei einer Übung', 15],
  ['Ernährung geloggt', 5],
  ['Kalorien & Makros im Zielbereich', 20],
  ['Morgens gewogen', 5],
  ['Wochenziel Gewicht getroffen (± 0,25 kg)', 40],
  ['Alle Supplements genommen', 5],
  ['Habit erledigt (je Habit)', 3],
  ['Perfekter Tag: alles Fällige geschafft', 15],
];
const MAX_PROGRESS_PER_WORKOUT = 60;

const weekStart = (k) => addDays(k, -((parseKey(k).getDay() + 6) % 7));
const monthKey = (k) => k.slice(0, 7);

/** Alle Punkte: je Tag mit Einzelposten, dazu Summen. */
export function computePoints() {
  const today = todayKey();
  const start = state.settings.trackingStart || today;
  const days = {};
  const add = (k, label, pts) => { if (!pts || k < start || k > today) return; (days[k] ||= { total: 0, items: [] }); days[k].total += pts; days[k].items.push({ label, pts }); };

  // Tageswerte
  const supps = supplementHabits();
  for (let k = start; k <= today; k = addDays(k, 1)) {
    const st = dayStatus(k);
    if (st.training.done) {
      const plan = plannedFor(k);
      if (plan && plan !== 'rest') add(k, 'Training nach Plan', 30);
      else add(k, 'Zusätzliches Training', 15);
    }
    const n = nutritionCheck(k);
    if (n.logged) add(k, 'Ernährung geloggt', 5);
    if (n.ok) add(k, 'Im Kalorien- & Makrobereich', 20);
    if (st.weight.done) add(k, 'Gewogen', 5);
    if (supps.length && st.supplements.done) add(k, 'Supplements genommen', 5);
    const habitsDone = st.habits.filter((h) => h.done).length;
    if (habitsDone) add(k, `${habitsDone} Habit${habitsDone > 1 ? 's' : ''} erledigt`, habitsDone * 3);
    if (st.overall.done && st.overall.dueCount >= 2) add(k, 'Perfekter Tag', 15);
  }

  // Progression im Training
  const last = {}, best = {};
  for (const w of [...state.workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const k = dayKey(new Date(w.startedAt));
    let pts = 0, ups = 0, prs = 0;
    for (const ex of w.exercises) {
      const sets = ex.sets.filter((s) => s.done);
      if (!sets.length) continue;
      const v = sessionStrength(sets);
      const id = ex.exerciseId;
      if (last[id] > 0 && v > last[id] * 1.005) { ups++; pts += 10; }
      if (best[id] > 0 && v > best[id] * 1.001) { prs++; pts += 15; }
      last[id] = v;
      best[id] = Math.max(best[id] || 0, v);
    }
    pts = Math.min(pts, MAX_PROGRESS_PER_WORKOUT);
    if (pts) add(k, `Progression: ${ups} gesteigert${prs ? `, ${prs} Rekord${prs > 1 ? 'e' : ''}` : ''}`, pts);
  }

  // Gewichtsziel (wöchentlich)
  for (const r of weeklyWeightResults()) if (r.hit) add(r.weekEnd, 'Wochenziel Gewicht getroffen', 40);

  const wk = weekStart(today), mk = monthKey(today);
  let total = 0, week = 0, month = 0;
  for (const [k, d] of Object.entries(days)) {
    total += d.total;
    if (k >= wk) week += d.total;
    if (monthKey(k) === mk) month += d.total;
  }
  return { days, total, week, month, today: days[today]?.total || 0, weekKey: wk, monthKey: mk };
}

// ---------------------------------------------------------------------
// Veröffentlichen & Rangliste
// ---------------------------------------------------------------------
const BOARD_KEY = 'formkurve-board';
const readBoard = () => { try { return JSON.parse(localStorage.getItem(BOARD_KEY)) || {}; } catch { return {}; } };

let publishTimer = null;
let lastPublished = '';
export function schedulePublish() {
  clearTimeout(publishTimer);
  publishTimer = setTimeout(publishScore, 2500);
}
export async function publishScore() {
  const s = currentSession();
  if (!s) return;
  const p = computePoints();
  const entry = { name: s.name, total: p.total, week: p.week, week_key: p.weekKey, month: p.month, month_key: p.monthKey, updated_at: new Date().toISOString() };
  const sig = JSON.stringify([entry.total, entry.week, entry.month, entry.name]);
  try { const b = readBoard(); b[s.userId] = entry; localStorage.setItem(BOARD_KEY, JSON.stringify(b)); } catch {}
  if (s.mode === 'cloud' && sig !== lastPublished) {
    try {
      await restCall('leaderboard', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: s.userId, ...entry }) });
      lastPublished = sig;
    } catch (e) { console.warn('Rangliste', e); }
  }
}

/** Einträge der Rangliste (Woche/Monat veraltet -> 0). */
export async function fetchBoard() {
  const s = currentSession();
  const p = computePoints();
  let rows;
  if (s?.mode === 'cloud') {
    try { rows = (await restCall('leaderboard?select=user_id,name,total,week,week_key,month,month_key,updated_at')) || []; }
    catch { rows = null; }
  }
  if (!rows) rows = Object.entries(readBoard()).filter(([id]) => !cloudEnabled || id === s?.userId).map(([user_id, e]) => ({ user_id, ...e }));
  return rows.map((r) => ({
    id: r.user_id, name: r.name, me: r.user_id === s?.userId,
    total: r.user_id === s?.userId ? p.total : r.total,
    week: r.user_id === s?.userId ? p.week : r.week_key === p.weekKey ? r.week : 0,
    month: r.user_id === s?.userId ? p.month : r.month_key === p.monthKey ? r.month : 0,
  }));
}

let boardPeriod = 'week';
let boardCache = null;
const PERIODS = [['week', 'Woche'], ['month', 'Monat'], ['total', 'Gesamt']];

/** Karte fürs Dashboard (lädt asynchron nach). */
export function leaderboardCard() {
  const p = computePoints();
  if (!boardCache) fetchBoard().then((rows) => { boardCache = rows; const el = document.getElementById('board-list'); if (el) el.innerHTML = boardRows(); });
  return `<div class="card">
    <div class="card-head"><h3>Rangliste</h3><button class="link small" data-act="points-open">Meine Punkte</button></div>
    <div class="row" style="gap:10px">
      <div class="stat grow"><span class="lbl">Heute</span><span class="mid-num">${fmt(p.today)}</span></div>
      <div class="stat grow"><span class="lbl">Diese Woche</span><span class="mid-num" style="color:var(--accent)">${fmt(p.week)}</span></div>
      <div class="stat grow"><span class="lbl">Gesamt</span><span class="mid-num">${fmt(p.total)}</span></div>
    </div>
    <div class="seg">${PERIODS.map(([k, l]) => `<button class="${boardPeriod === k ? 'on' : ''}" data-act="board-period" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="list" id="board-list">${boardRows()}</div>
    ${!cloudEnabled ? '<div class="tiny faint">Rangliste mit Freunden braucht Cloud-Accounts (siehe README). Bis dahin siehst du alle Accounts auf diesem Gerät.</div>' : ''}
  </div>`;
}
function boardRows() {
  if (!boardCache) return '<div class="empty small">Lädt …</div>';
  const rows = [...boardCache].sort((a, b) => b[boardPeriod] - a[boardPeriod] || a.name.localeCompare(b.name));
  if (!rows.length) return '<div class="empty small">Noch keine Einträge.</div>';
  return rows.map((r, i) => `<div class="li board-row ${r.me ? 'me' : ''}">
    <span class="rank ${i < 3 ? `r${i + 1}` : ''}">${i + 1}</span>
    <div class="grow"><div class="t ellipsis">${esc(r.name)}${r.me ? ' <span class="tiny muted">(du)</span>' : ''}</div></div>
    <div class="r"><span class="mid-num" style="font-size:19px">${fmt(r[boardPeriod])}</span><span class="tiny muted"> P</span></div>
  </div>`).join('');
}
export const invalidateBoard = () => { boardCache = null; };

onAct({
  'board-period': (el) => {
    boardPeriod = el.dataset.k;
    document.querySelectorAll('[data-act="board-period"]').forEach((b) => b.classList.toggle('on', b.dataset.k === boardPeriod));
    const el2 = document.getElementById('board-list'); if (el2) el2.innerHTML = boardRows();
  },
  'points-open': () => openPointsSheet(),
});

function openPointsSheet() {
  openSheet({
    id: 'points',
    render: () => {
      const p = computePoints();
      const recent = Object.entries(p.days).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);
      return {
        title: 'Meine Punkte',
        body: `
          <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
            <div class="stat"><span class="lbl">Heute</span><span class="mid-num">${fmt(p.today)}</span></div>
            <div class="stat"><span class="lbl">Woche</span><span class="mid-num" style="color:var(--accent)">${fmt(p.week)}</span></div>
            <div class="stat"><span class="lbl">Gesamt</span><span class="mid-num">${fmt(p.total)}</span></div>
          </div>
          <h2 class="sec">Letzte Tage</h2>
          ${recent.length ? `<div class="card" style="padding:4px 14px"><div class="list">${recent.map(([k, d]) => `
            <div class="li" style="align-items:flex-start"><div class="grow"><div class="t">${fmtDay(k)}</div>
              <div class="s">${d.items.map((it) => `${esc(it.label)} +${it.pts}`).join(' · ')}</div></div>
              <div class="r"><span class="mid-num" style="font-size:18px;color:var(--accent)">+${fmt(d.total)}</span></div></div>`).join('')}</div></div>`
            : '<div class="card flat"><div class="empty small">Noch keine Punkte. Trag dein Gewicht ein oder starte ein Training.</div></div>'}
          <h2 class="sec">So gibt es Punkte</h2>
          <div class="card" style="padding:4px 14px"><div class="list">${RULES.map(([l, v]) => `<div class="li"><div class="grow small">${l}</div><div class="r" style="font-weight:500">+${v}</div></div>`).join('')}</div></div>
          <p class="tiny faint" style="margin:0">Progression zählt pro Training höchstens ${MAX_PROGRESS_PER_WORKOUT} Punkte. Punkte werden aus deinen Einträgen berechnet – trägst du etwas nach, zählt es nachträglich mit.</p>`,
      };
    },
  });
}
