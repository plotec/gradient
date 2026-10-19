// Bereich Körper: Morgengewicht, Verlauf mit Trend, tägliche Habits (Supplements usw.).
import { state, save, weightTrend } from './store.js';
import { uid, esc, fmt, fmtMax, signed, parseNum, todayKey, addDays, fmtDay, parseKey } from './utils.js';
import { icon, onAct, onChange, openSheet, closeSheet, topSheet, redrawSheet, confirmDialog, toast } from './ui.js';
import { lineChart } from './charts.js';
import { goalLabel, goalNumbers, weeklyWeightResults } from './goals.js';

let bodyDate = todayKey();
export const resetBodyDate = () => { bodyDate = todayKey(); };
let range = 90;
export const HABIT_COLORS = ['#c3a6ff', '#b8e05c', '#7fd6b4', '#f7b633', '#ff8a5c', '#8ec5ff', '#f2e3a0', '#ff8fb3'];

export function renderBody() {
  const w = state.weights[bodyDate];
  const trend = weightTrend();
  const last = trend[trend.length - 1];
  const weekAgo = trend.filter((p) => p.key <= addDays(todayKey(), -7)).pop();
  const done = new Set(state.habitLog[bodyDate] || []);
  const isToday = bodyDate === todayKey();
  const supps = state.habits.filter((h) => h.supplement);
  const allSupps = supps.length && supps.every((h) => done.has(h.id));
  const habitRow = (h) => `<button class="habit ${done.has(h.id) ? 'on' : ''}" style="--hc:${h.color}" data-act="habit-toggle" data-id="${h.id}">
          <span class="box">${icon('check')}</span><span class="t">${esc(h.name)}</span>${streak(h.id) > 1 ? `<span class="tiny muted">${streak(h.id)} Tage in Folge</span>` : ''}</button>`;
  return `
    <div class="page-head"><div><h1>Körper</h1><div class="sub">Gewicht & tägliche Habits</div></div></div>
    <div class="date-nav">
      <button class="icon-btn" data-act="body-day" data-d="-1" aria-label="Vorheriger Tag">${icon('left')}</button>
      <label class="lbl" style="position:relative">${fmtDay(bodyDate, { long: true })}
        <input type="date" value="${bodyDate}" max="${todayKey()}" data-ch="body-date" style="position:absolute;inset:0;opacity:0" aria-label="Datum wählen"></label>
      <button class="icon-btn" data-act="body-day" data-d="1" ${isToday ? 'disabled style="opacity:.3"' : ''} aria-label="Nächster Tag">${icon('right')}</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>Morgengewicht</h3>${w != null ? '<span class="chip body">' + icon('check') + 'eingetragen</span>' : '<span class="chip">offen</span>'}</div>
      <form class="row" data-submit="weight-save" style="align-items:flex-end">
        <div class="weigh-input grow"><input id="weight-in" type="text" inputmode="decimal" placeholder="${last ? fmtMax(last.w, 1) : '80,0'}" value="${w != null ? fmtMax(w, 2) : ''}" aria-label="Gewicht in kg" autocomplete="off"><span class="u">kg</span></div>
        <button class="btn bodyc lg">${w != null ? 'Ändern' : 'Speichern'}</button>
      </form>
      ${last ? `<div class="grid2" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><span class="lbl">Trend</span><span class="mid-num">${fmtMax(last.trend, 1)}</span></div>
        <div class="stat"><span class="lbl">7 Tage</span><span class="mid-num ${weekAgo && last.trend - weekAgo.trend < 0 ? 'up' : ''}">${weekAgo ? signed(last.trend - weekAgo.trend, 1) : '–'}</span></div>
        <div class="stat"><span class="lbl">Einträge</span><span class="mid-num">${trend.length}</span></div>
      </div>` : '<div class="small muted">Wiege dich jeden Morgen nach dem Aufstehen und vor dem Frühstück – so werden die Werte vergleichbar.</div>'}
      ${goalStatus()}
      ${w != null ? `<button class="link" data-act="weight-del" style="align-self:flex-start;color:var(--bad)">Eintrag für ${fmtDay(bodyDate)} löschen</button>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><h3>Habits</h3><button class="link" data-act="habits-manage">Bearbeiten</button></div>
      <div>
        <div class="habit ${w != null ? 'on' : ''}" style="--hc:var(--body)"><span class="box">${icon('check')}</span><span class="t">Gewogen</span><span class="tiny faint">automatisch</span></div>
        ${state.habits.filter((h) => !h.supplement).map(habitRow).join('')}
      </div>
      ${supps.length ? `<div class="row between" style="margin-top:4px"><span class="small muted" style="font-weight:500">Supplements · ${supps.filter((h) => done.has(h.id)).length}/${supps.length}</span>
        <button class="link small" data-act="supps-all" data-on="${allSupps ? 0 : 1}">${allSupps ? 'Alle zurücksetzen' : 'Alle abhaken'}</button></div>
      <div>${supps.map(habitRow).join('')}</div>` : ''}
    </div>

    <div class="card">
      <div class="card-head"><h3>Gewichtsverlauf</h3></div>
      <div class="seg">${[[30, '30 T'], [90, '90 T'], [365, '1 J'], [0, 'Alle']].map(([d, l]) => `<button class="${range === d ? 'on' : ''}" data-act="body-range" data-d="${d}">${l}</button>`).join('')}</div>
      ${weightChart(range)}
      <div class="legend"><span><i style="background:var(--body)"></i>Trend (geglättet)</span><span><i style="background:var(--muted);height:6px;width:6px;border-radius:50%"></i>Tageswert</span></div>
    </div>

    <h2 class="sec">Einträge</h2>
    ${trend.length ? `<div class="card" style="padding:4px 14px"><div class="list">${trend.slice().reverse().slice(0, 60).map((p, i, arr) => {
      const prev = arr[i + 1];
      const d = prev ? p.w - prev.w : null;
      return `<button class="li" data-act="body-goto" data-k="${p.key}">
        <div class="grow"><div class="t">${fmtDay(p.key)}</div><div class="s">Trend ${fmtMax(p.trend, 1)} kg</div></div>
        <div class="r"><div class="mid-num" style="font-size:19px">${fmtMax(p.w, 1)}</div><div class="tiny ${d == null ? 'faint' : d < 0 ? 'up' : d > 0 ? 'down' : 'faint'}">${d == null ? '' : signed(d, 1)}</div></div></button>`;
    }).join('')}</div></div>` : '<div class="card flat"><div class="empty">Noch keine Einträge.</div></div>'}`;
}

function goalStatus() {
  const res = weeklyWeightResults();
  const last = res[res.length - 1];
  const hits = res.slice(-8).filter((r) => r.hit).length;
  const g = state.settings.goal;
  const tw = g.targetWeight;
  const lw = weightTrend().pop();
  return `<button class="goal-line" data-act="goal-open">
    <span class="grow"><span class="small muted">Ziel</span><br><b style="font-weight:500">${goalLabel()}</b>${tw ? ` · Zielgewicht ${fmtMax(tw, 1)} kg${lw ? ` (noch ${signed(tw - lw.trend, 1)} kg)` : ''}` : ''}</span>
    <span style="text-align:right">${last ? `<span class="chip ${last.hit ? 'good' : 'food'}">${last.hit ? 'getroffen' : 'verfehlt'}: ${signed(last.change, 2)} kg</span><br><span class="tiny muted">letzte Woche · ${hits}/${Math.min(8, res.length)} Wochen im Plan</span>` : '<span class="tiny muted">Auswertung ab der ersten vollen Woche</span>'}</span>
  </button>`;
}

function weightChart(days) {
  const t = weightTrend();
  const from = days ? addDays(todayKey(), -days) : '0000';
  const pts = t.filter((p) => p.key >= from);
  const x = (k) => parseKey(k).getTime();
  return lineChart({
    series: [
      { points: pts.map((p) => ({ x: x(p.key), y: p.w })), color: 'var(--muted)', line: false, dots: true, dotR: days && days <= 90 ? 2.2 : 1.4, dotOpacity: 0.55 },
      { points: pts.map((p) => ({ x: x(p.key), y: p.trend })), color: 'var(--body)', width: 2.5, endDot: true },
    ],
    height: 190,
  });
}

function streak(habitId) {
  let n = 0;
  let k = todayKey();
  if (!(state.habitLog[k] || []).includes(habitId)) k = addDays(k, -1);
  while ((state.habitLog[k] || []).includes(habitId)) { n++; k = addDays(k, -1); }
  return n;
}

const rerender = () => window.dispatchEvent(new Event('rerender'));
onAct({
  'body-day': (el) => {
    const next = addDays(bodyDate, +el.dataset.d);
    if (next > todayKey()) return;
    bodyDate = next; rerender();
  },
  'body-goto': (el) => { bodyDate = el.dataset.k; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'body-range': (el) => { range = +el.dataset.d; rerender(); },
  'weight-save': () => {
    const v = parseNum(document.getElementById('weight-in').value);
    if (v == null || v < 20 || v > 400) { toast('Bitte ein gültiges Gewicht eingeben'); return; }
    state.weights[bodyDate] = Math.round(v * 100) / 100;
    document.activeElement?.blur();
    save();
    toast(`${fmtMax(v, 2)} kg für ${fmtDay(bodyDate)} gespeichert`);
  },
  'weight-del': async () => {
    if (!(await confirmDialog({ title: 'Gewicht löschen?', text: `Eintrag vom ${fmtDay(bodyDate, { long: true })}`, ok: 'Löschen', danger: true }))) return;
    delete state.weights[bodyDate];
    save();
  },
  'habit-toggle': (el) => {
    const arr = (state.habitLog[bodyDate] ||= []);
    const i = arr.indexOf(el.dataset.id);
    i >= 0 ? arr.splice(i, 1) : arr.push(el.dataset.id);
    if (!arr.length) delete state.habitLog[bodyDate];
    try { navigator.vibrate?.(15); } catch {}
    save();
  },
  'habits-manage': () => openHabits(),
  'supps-all': (el) => {
    const ids = state.habits.filter((h) => h.supplement).map((h) => h.id);
    const set = new Set(state.habitLog[bodyDate] || []);
    ids.forEach((id) => (el.dataset.on === '1' ? set.add(id) : set.delete(id)));
    if (set.size) state.habitLog[bodyDate] = [...set]; else delete state.habitLog[bodyDate];
    save();
  },
});
onChange({ 'body-date': (el) => { if (el.value && el.value <= todayKey()) { bodyDate = el.value; rerender(); } } });

// ---------- Habits verwalten ----------
const s0 = (ui) => (ui.supp ? 'checked' : '');
function openHabits() {
  const ui = { color: HABIT_COLORS[state.habits.length % HABIT_COLORS.length] };
  openSheet({
    id: 'habits',
    ui,
    render: () => ({
      title: 'Habits',
      body: `
        <div class="small muted">Tägliche Gewohnheiten zum Abhaken. Als „Supplement“ markierte Habits werden in den Erfolgskästchen zusammengefasst: Der Tag zählt, wenn alle genommen wurden. Alle anderen Habits bekommen eigene Kästchen.</div>
        ${state.habits.length ? `<div class="card" style="padding:4px 14px"><div class="list">${state.habits.map((h, i) => `
          <div class="li">
            <span style="width:14px;height:14px;border-radius:4px;background:${h.color};flex:none"></span>
            <input class="input grow" value="${esc(h.name)}" data-ch="habit-rename" data-id="${h.id}" style="min-height:38px" aria-label="Name">
            <button class="chip ${h.supplement ? 'good' : ''}" data-act="habit-supp" data-id="${h.id}" style="border:0" aria-pressed="${!!h.supplement}">Supplement</button>
            <button class="icon-btn sm plain" data-act="habit-move" data-i="${i}" data-d="-1" ${i ? '' : 'disabled style="opacity:.3"'} aria-label="Nach oben">${icon('up')}</button>
            <button class="icon-btn sm plain" data-act="habit-del" data-id="${h.id}" aria-label="Löschen">${icon('trash')}</button>
          </div>`).join('')}</div></div>` : ''}
        <div class="card">
          <h3 style="margin:0;font-size:16px">Neues Habit</h3>
          <form class="row" data-submit="habit-add"><input class="input grow" id="habit-new" placeholder="z. B. Magnesium" autocomplete="off"><button class="btn primary">${icon('plus')}</button></form>
          <label class="row small" style="gap:8px"><input type="checkbox" id="habit-new-supp" ${s0(ui)} style="width:20px;height:20px;accent-color:var(--accent)">Ist ein Supplement</label>
          <div class="swatches">${HABIT_COLORS.map((c) => `<button style="background:${c}" class="${ui.color === c ? 'on' : ''}" data-act="habit-color" data-c="${c}" aria-label="Farbe"></button>`).join('')}</div>
        </div>`,
    }),
  });
}
const hs = () => { const t = topSheet(); return t && t.id === 'habits' ? t : null; };
onAct({
  'habit-add': () => {
    const s = hs(); const el = document.getElementById('habit-new');
    const name = el.value.trim();
    if (!name) return;
    s.ui.supp = document.getElementById('habit-new-supp')?.checked;
    state.habits.push({ id: uid(), name, color: s.ui.color, supplement: !!s.ui.supp });
    s.ui.color = HABIT_COLORS[state.habits.length % HABIT_COLORS.length];
    save();
    document.getElementById('habit-new')?.focus();
  },
  'habit-color': (el) => { const s = hs(); s.ui.color = el.dataset.c; redrawSheet(s); },
  'habit-supp': (el) => { const h = state.habits.find((x) => x.id === el.dataset.id); h.supplement = !h.supplement; save(); },
  'habit-move': (el) => {
    const i = +el.dataset.i, j = i + +el.dataset.d;
    [state.habits[i], state.habits[j]] = [state.habits[j], state.habits[i]];
    save();
  },
  'habit-del': async (el) => {
    const h = state.habits.find((x) => x.id === el.dataset.id);
    if (!(await confirmDialog({ title: `„${h.name}“ löschen?`, text: 'Der bisherige Verlauf dieses Habits wird ebenfalls entfernt.', ok: 'Löschen', danger: true }))) return;
    state.habits = state.habits.filter((x) => x.id !== h.id);
    for (const k of Object.keys(state.habitLog)) {
      state.habitLog[k] = state.habitLog[k].filter((x) => x !== h.id);
      if (!state.habitLog[k].length) delete state.habitLog[k];
    }
    save();
  },
});
onChange({
  'habit-rename': (el) => { const h = state.habits.find((x) => x.id === el.dataset.id); if (h && el.value.trim()) { h.name = el.value.trim(); save(); } },
});
