// Dashboard: Tagesüberblick, Kalorienverbrauch (TDEE), Jahresübersichten, Diagramme. Dazu die Einstellungen.
import { state, save, dayKcal, latestWeight, weightTrend, workoutDayKeys, strengthIndex, computeTdee, totals, dayDiary, replaceState, resetAll, demoData, storageWorks } from './store.js';
import { esc, fmt, fmtMax, signed, todayKey, addDays, parseKey, dayKey, MONTHS, fmtShort, sum } from './utils.js';
import { icon, onAct, onChange, openSheet, closeSheet, topSheet, redrawSheet, confirmDialog, toast } from './ui.js';
import { lineChart, barChart } from './charts.js';
import { goalNumbers, goalLabel, targetIntake, openGoalSheet } from './goals.js';
import { computePoints, leaderboardCard } from './points.js';
import { dayStatus, rate, yearStatuses, supplementHabits, otherHabits } from './success.js';
import { currentSession, logout, changePassword, cloudEnabled, getSyncStatus, onSyncStatus, AuthError } from './cloud.js';
import { loadBls, blsCount, importBlsFile, BLS_CREDIT } from './foods-db.js';

let year = new Date().getFullYear();
let period = 'week';
const PERIODS = { week: { days: 7, label: 'Woche', vs: 'Vorwoche' }, month: { days: 30, label: 'Monat', vs: 'Vormonat' }, quarter: { days: 91, label: '3 Monate', vs: 'Vorperiode' }, year: { days: 365, label: 'Jahr', vs: 'Vorjahr' } };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export const logoSvg = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 30 C 12 30, 13 14, 20 18 S 29 8, 35 7" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/><circle cx="35" cy="7" r="3.6" fill="var(--amber)"/></svg>`;

const avg = (a) => (a.length ? sum(a) / a.length : null);
const keysBack = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

/** Tage in Folge mit irgendeinem Eintrag (Essen, Gewicht, Training). */
function activityStreak() {
  const wd = workoutDayKeys();
  const active = (k) => dayKcal(k) > 0 || state.weights[k] != null || wd.has(k);
  let k = todayKey();
  if (!active(k)) k = addDays(k, -1);
  let n = 0;
  while (active(k)) { n++; k = addDays(k, -1); }
  return n;
}

function deltaChip(diff, unit, digits, vs, invert = false) {
  if (diff == null || Number.isNaN(diff)) return '';
  const down = diff < 0;
  const good = invert ? !down : down;
  return `<div class="delta"><span class="chip ${Math.abs(diff) < 1e-9 ? '' : good ? 'good' : 'food'}">${icon(down ? 'arrowDown' : 'arrowUp')}${fmtMax(Math.abs(diff), digits)}${unit}</span><span class="vs">vs. ${vs}</span></div>`;
}

export function renderDashboard() {
  const today = todayKey();
  const g = state.settings.goals;
  const P = PERIODS[period];
  const keys = keysBack(today, P.days);
  const prevKeys = keysBack(addDays(today, -P.days), P.days);
  const t = totals(dayDiary(today).entries);
  const lw = latestWeight();
  const trend = weightTrend();
  const wdays = workoutDayKeys();
  const now = new Date();
  const monday = addDays(today, -((now.getDay() + 6) % 7));
  let weekCount = 0;
  for (let i = 0; i < 7; i++) if (wdays.has(addDays(monday, i))) weekCount++;
  const habitsToday = (state.habitLog[today] || []).length + (state.weights[today] != null ? 1 : 0);
  const habitsTotal = state.habits.length + 1;
  const isEmpty = !state.workouts.length && !Object.keys(state.weights).length && !Object.keys(state.diary).length;
  const streak = activityStreak();

  // ---- Kalorien im Zeitraum ----
  const kc = (k) => dayKcal(k);
  const intake = keys.map(kc).filter((v) => v > 0);
  const prevIntake = prevKeys.map(kc).filter((v) => v > 0);
  const avgIn = avg(intake), prevAvgIn = avg(prevIntake);
  let bars;
  if (period === 'week' || period === 'month') {
    bars = keys.map((k) => { const d = parseKey(k); return { y: kc(k), label: period === 'week' ? WD[d.getDay()] : `${d.getDate()}.`, dim: k === today && kc(k) < g.kcal * 0.5 }; });
  } else if (period === 'quarter') {
    bars = Array.from({ length: 13 }, (_, w) => { const ks = keys.slice(w * 7, w * 7 + 7); const v = avg(ks.map(kc).filter((x) => x > 0)) || 0; return { y: v, label: fmtShort(ks[0]) }; });
  } else {
    bars = Array.from({ length: 12 }, (_, m) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + m, 1); const ks = keys.filter((k) => { const x = parseKey(k); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); }); return { y: avg(ks.map(kc).filter((x) => x > 0)) || 0, label: MONTHS[d.getMonth()].slice(0, 1) }; });
  }
  const maxI = bars.reduce((bi, b, i) => (b.y > bars[bi].y ? i : bi), 0);
  if (bars[maxI]?.y > 0) bars[maxI].highlight = true;

  // ---- Gewicht im Zeitraum ----
  const from = keys[0];
  const wIn = trend.filter((p) => p.key >= from);
  const avgW = avg(wIn.map((p) => p.w));
  const before = trend.filter((p) => p.key < from).pop();
  const wDelta = wIn.length && before ? wIn[wIn.length - 1].trend - before.trend : null;
  const x = (k) => parseKey(k).getTime();
  const weightSeries = period === 'week'
    ? [{ points: wIn.map((p) => ({ x: x(p.key), y: p.w })), color: 'var(--accent)', width: 2.5, dots: true, dotR: 4 }]
    : [
      { points: wIn.map((p) => ({ x: x(p.key), y: p.w })), color: 'var(--muted)', line: false, dots: true, dotR: period === 'month' ? 2.4 : 1.5, dotOpacity: 0.45 },
      { points: wIn.map((p) => ({ x: x(p.key), y: p.trend })), color: 'var(--accent)', width: 2.5, endDot: true },
    ];
  const xLabels = period === 'week' ? keys.map((k) => ({ x: x(k), label: WD[parseKey(k).getDay()] })) : null;

  // ---- Einblicke ----
  const mac = keys.reduce((a, k) => { const tt = totals(dayDiary(k).entries); a.p += tt.protein * 4; a.c += tt.carbs * 4; a.f += tt.fat * 9; return a; }, { p: 0, c: 0, f: 0 });
  const macSum = mac.p + mac.c + mac.f;
  const ws = state.workouts.filter((w) => dayKey(new Date(w.startedAt)) >= from);
  const vol = (w) => sum(w.exercises, (e) => sum(e.sets, (st) => (st.weight || 0) * (st.reps || 0)));
  const top = ws.reduce((b, w) => (!b || vol(w) > vol(b) ? w : b), null);
  const goalPct = avgIn ? Math.round((avgIn / g.kcal) * 100) : 0;
  const goalState = !avgIn ? ['Noch keine Daten', 'faint'] : goalPct > 105 ? ['Über dem Ziel', 'food'] : goalPct >= 90 ? ['Im Plan!', 'ok'] : ['Unter dem Ziel', 'food'];
  const milestone = [7, 14, 30, 60, 100, 200, 365, 1000].find((m) => m > streak) || 1000;

  return `
    <div class="page-head">
      <div class="brand">${logoSvg()}Gradient</div>
      <div class="row" style="gap:8px">
        <button class="pill-chip" data-act="points-open" title="Punkte diese Woche" style="cursor:pointer">${icon('star')}${fmt(computePoints().week)}</button>
        <span class="pill-chip" title="Tage in Folge aktiv">${icon('flame')}${streak}</span>
        <button class="icon-btn" data-act="settings-open" aria-label="Einstellungen" style="width:44px;height:44px;border:1px solid var(--line);background:var(--surface)">${icon('gear')}</button>
      </div>
    </div>
    <div><h1 style="font-size:30px;font-weight:500;margin:6px 0 0;letter-spacing:-.01em">Dein Fortschritt</h1><div class="muted" style="font-size:15.5px;margin-top:2px">Kleine Schritte, große Wirkung.</div></div>
    ${!storageWorks() ? '<div class="card" style="border-color:var(--bad)"><b>Speichern nicht möglich.</b><span class="small muted">Der Browser blockiert den Speicher (z. B. privater Modus). Einträge gehen beim Schließen verloren.</span></div>' : ''}
    ${isEmpty ? `<div class="card flat"><div class="stack" style="gap:8px;text-align:center;padding:6px">
      <b style="font-weight:500">Willkommen bei Gradient</b>
      <span class="small muted">Trag morgens dein Gewicht ein, logge dein Essen und starte dein erstes Training – über den Plus-Button geht alles mit einem Tipp. Zum Ausprobieren kannst du Beispieldaten laden.</span>
      <button class="btn sm" data-act="demo-load" style="align-self:center">Beispieldaten ansehen</button></div></div>` : ''}

    <div class="seg">${Object.entries(PERIODS).map(([k, v]) => `<button class="${period === k ? 'on' : ''}" data-act="dash-period" data-k="${k}">${v.label}</button>`).join('')}</div>

    <div class="card">
      <div class="row between" style="align-items:flex-start">
        <div class="metric"><span class="lbl">Kalorienzufuhr</span><span class="v">${avgIn ? fmt(avgIn) : '–'}<small>kcal Ø</small></span></div>
        ${avgIn && prevAvgIn ? deltaChip(((avgIn - prevAvgIn) / prevAvgIn) * 100, ' %', 0, P.vs) : ''}
      </div>
      ${barChart({ bars, goal: g.kcal })}
    </div>

    <div class="card">
      <div class="row between" style="align-items:flex-start">
        <div class="metric"><span class="lbl">Gewichtstrend</span><span class="v">${avgW ? fmtMax(avgW, 1) : '–'}<small>kg Ø</small></span></div>
        ${wDelta != null ? deltaChip(wDelta, ' kg', 1, P.vs, goalNumbers().rate > 0) : ''}
      </div>
      ${lineChart({ series: weightSeries, height: 150, yRight: true, xLabels })}
    </div>

    ${strengthCard(P, keys[0])}

    <div class="duo">
      <div class="card streak" style="gap:6px">
        <div class="metric"><span class="lbl">Serie</span><span class="v">${streak}<small>${streak === 1 ? 'Tag' : 'Tage'}</small></span><span class="small muted">${streak ? 'Weiter so!' : 'Starte heute'}</span></div>
        <div class="flame-ring">${flameRing(streak / milestone)}<span class="f">${icon('flame')}</span></div>
      </div>
      <div class="card" style="gap:8px">
        <div class="metric"><span class="lbl">Kalorienziel</span><span class="v">${goalPct || '–'}<small>% Ø</small></span></div>
        <div class="progress"><i style="width:${Math.min(100, goalPct)}%;${goalPct > 105 ? 'background:var(--amber)' : ''}"></i></div>
        <span class="${goalState[1] === 'ok' ? 'ok-text' : 'small muted'}" ${goalState[1] === 'food' ? 'style="color:var(--amber)"' : ''}>${goalState[0]}</span>
      </div>
    </div>

    ${leaderboardCard()}

    <h2 class="sec">Einblicke</h2>
    <div class="insights">
      <div class="insight"><span class="lbl">Ø Kalorien</span><span class="v">${avgIn ? fmt(avgIn) : '–'}<small>kcal</small></span>
        <span class="s">${avgIn && prevAvgIn ? `${avgIn <= prevAvgIn ? '↓' : '↑'} ${fmt(Math.abs(avgIn - prevAvgIn))} vs. ${P.vs}` : `${intake.length} Tage geloggt`}</span></div>
      <div class="insight"><span class="lbl">Makros</span>
        ${macSum ? `<div class="donut-row">${donut([[mac.p, 'var(--protein)'], [mac.c, 'var(--carbs)'], [mac.f, 'var(--fat)']])}
          <div class="donut-legend"><span><i style="background:var(--protein)"></i>${Math.round((mac.p / macSum) * 100)} % E</span><span><i style="background:var(--carbs)"></i>${Math.round((mac.c / macSum) * 100)} % K</span><span><i style="background:var(--fat)"></i>${Math.round((mac.f / macSum) * 100)} % F</span></div></div>` : '<span class="small muted">Noch keine Daten</span>'}
      </div>
      <div class="insight"><div class="row between"><span class="lbl">Top-Training</span><span class="star">${icon('star')}</span></div>
        ${top ? `<span class="hl">${WD_LONG[new Date(top.startedAt).getDay()]}</span><span class="v" style="font-size:17px">${fmt(vol(top))}<small>kg</small></span><span class="s ellipsis">${esc(top.name)}</span>` : '<span class="small muted">Kein Training im Zeitraum</span>'}
      </div>
    </div>

    <h2 class="sec">Heute</h2>
    <div class="kpis">
      <button class="kpi" data-act="goto" data-tab="nutrition">
        <span class="lbl"><i style="background:var(--amber)"></i>Kalorien</span>
        <span class="val">${fmt(t.kcal)}<small>/ ${fmt(g.kcal)}</small></span>
        <span class="s">Eiweiß ${fmt(t.protein)} / ${fmt(g.protein)} g</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="body">
        <span class="lbl"><i style="background:var(--body)"></i>Gewicht</span>
        <span class="val">${lw ? fmtMax(state.weights[today] ?? lw.w, 1) : '–'}<small>kg</small></span>
        <span class="s">${state.weights[today] != null ? 'heute gewogen' : '<span style="color:var(--amber)">heute noch offen</span>'}</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="training">
        <span class="lbl"><i style="background:var(--accent)"></i>Training</span>
        <span class="val">${weekCount}<small>× diese Woche</small></span>
        <span class="s">${state.workouts.length} Einheiten insgesamt</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="body">
        <span class="lbl"><i style="background:var(--habit)"></i>Habits</span>
        <span class="val">${habitsToday}<small>/ ${habitsTotal}</small></span>
        <span class="s">${habitsToday >= habitsTotal ? 'alles erledigt' : `${habitsTotal - habitsToday} offen`}</span>
      </button>
    </div>

    ${tdeeCard()}

    ${successCard()}`;
}

function strengthCard(P, from) {
  const all = strengthIndex();
  const counted = all.filter((w) => w.sessions > 0).length;
  if (counted < 2) {
    return `<div class="card"><div class="metric"><span class="lbl">Kraftentwicklung</span></div>
      <div class="small muted">Sobald du Übungen mindestens zweimal trainiert hast, siehst du hier, ob du insgesamt stärker wirst. Grundlage ist das geschätzte 10RM aller Übungen.</div></div>`;
  }
  // mindestens 8 Wochen zeigen, sonst wirkt die Kurve zappelig
  const start = from < addDays(todayKey(), -56) ? from : addDays(todayKey(), -56);
  const pts = all.filter((w) => w.key >= start);
  const base = [...all].reverse().find((w) => w.key <= from) || all[0];
  const lastV = all[all.length - 1].value;
  const pct = (lastV / base.value - 1) * 100;
  const total = (lastV / 100 - 1) * 100;
  const n = new Set(state.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))).size;
  return `<div class="card">
    <div class="row between" style="align-items:flex-start">
      <div class="metric"><span class="lbl">Kraftentwicklung</span><span class="v">${signed(total, 1)}<small>% seit Start</small></span></div>
      <div class="delta"><span class="chip ${pct >= 0 ? 'good' : 'bad'}">${icon(pct >= 0 ? 'arrowUp' : 'arrowDown')}${fmtMax(Math.abs(pct), 1)} %</span><span class="vs">vs. ${P.vs}</span></div>
    </div>
    ${lineChart({ series: [
      { points: pts.map((w) => ({ x: parseKey(w.key).getTime(), y: w.value })), color: 'var(--accent)', width: 2.5, endDot: true, area: true },
    ], height: 140, yRight: true, yDigits: 0 })}
    <div class="small muted">Kraftindex (Start = 100) über ${n} Übungen, Wochenschnitt. Steigt die Kurve, wirst du stärker.</div>
  </div>`;
}

function flameRing(frac) {
  const r = 34, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return `<svg class="r" viewBox="0 0 80 80"><circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="5"/>
    ${f > 0 ? `<circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--amber)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" style="filter:drop-shadow(0 0 4px var(--amber))"/>` : ''}</svg>`;
}
function donut(parts) {
  const total = sum(parts, (p) => p[0]);
  const r = 15, c = 2 * Math.PI * r;
  let off = 0, g = `<circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="7"/>`;
  for (const [v, col] of parts) {
    const len = (v / total) * c;
    g += `<circle cx="20" cy="20" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-dasharray="${Math.max(0, len - 1).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
  }
  return `<svg viewBox="0 0 40 40">${g}</svg>`;
}

function goalBox() {
  const target = targetIntake();
  const g = state.settings.goal;
  return `<div class="divider"></div>
    <div class="row between wrap" style="gap:10px">
      <div><div class="small muted">Dein Ziel: ${goalLabel()}</div>
        <div class="mid-num" style="color:var(--food)">${target != null ? `${fmt(target)} kcal` : 'Umsatz noch unbekannt'}</div>
        <div class="tiny muted">${g.auto ? 'Kalorienziel wird automatisch angepasst' : `eingestellt: ${fmt(state.settings.goals.kcal)} kcal`}</div></div>
      <button class="btn sm" data-act="goal-open">${icon('edit')}Ziel ändern</button>
    </div>`;
}

// ---------- Kalorienverbrauch ----------
function tdeeCard() {
  const r = computeTdee();
  const win = state.settings.tdeeWindow;
  const seg = `<div class="seg">${[14, 28, 56].map((d) => `<button class="${win === d ? 'on' : ''}" data-act="tdee-win" data-d="${d}">${d} Tage</button>`).join('')}</div>`;
  if (r.tdee == null) {
    return `<div class="card tdee">
      <div class="card-head"><h3>Dein Kalorienverbrauch</h3><span class="chip food">TDEE</span></div>
      ${seg}
      <div class="small muted">Sobald du in den letzten ${win} Tagen mindestens 5 Tage Essen geloggt und dich mindestens 3-mal gewogen hast, berechnet die App deinen echten Verbrauch aus Kalorienzufuhr und Gewichtsverlauf.</div>
      <div class="tdee-rows">
        <div class="stat"><span class="lbl">Tage geloggt</span><span class="mid-num">${r.loggedDays}/${win}</span></div>
        <div class="stat"><span class="lbl">Tage gewogen</span><span class="mid-num">${r.weighDays}/${win}</span></div>
      </div>
      ${goalBox()}
    </div>`;
  }
  const qColor = r.quality === 'gut' ? 'good' : r.quality === 'mittel' ? 'food' : '';
  return `<div class="card tdee">
    <div class="card-head"><h3>Dein Kalorienverbrauch</h3><span class="chip ${qColor}">Datenlage ${r.quality}</span></div>
    <div class="row" style="align-items:baseline;gap:8px"><span class="big-num">${fmt(Math.round(r.tdee / 10) * 10)}</span><span class="muted">kcal / Tag</span></div>
    ${seg}
    <div class="tdee-rows">
      <div class="stat"><span class="lbl">Ø gegessen</span><span class="mid-num">${fmt(r.avgIntake)}</span></div>
      <div class="stat"><span class="lbl">Gewicht / Woche</span><span class="mid-num">${signed(r.slopePerWeek, 2)} kg</span></div>
      <div class="stat"><span class="lbl">Tage geloggt</span><span class="mid-num">${r.loggedDays}/${win}</span></div>
      <div class="stat"><span class="lbl">Tage gewogen</span><span class="mid-num">${r.weighDays}/${win}</span></div>
    </div>
    <div class="small muted">Berechnung: Ø Zufuhr ${fmt(r.avgIntake)} kcal ${r.slopePerWeek <= 0 ? '+' : '−'} ${fmt(Math.abs((r.slopePerWeek / 7) * 7700))} kcal aus der Gewichtsänderung (${signed(r.slopePerWeek, 2)} kg/Woche × 7.700 kcal/kg ÷ 7).</div>
    ${goalBox()}
  </div>`;
}

// ---------- Erfolgskästchen (365 Kästchen je Kategorie) ----------
let showDetails = (() => { try { return localStorage.getItem('formkurve-details') === '1'; } catch { return false; } })();

function successCard() {
  const st = yearStatuses(year);
  const today = todayKey();
  const last30 = Array.from({ length: 30 }, (_, i) => dayStatus(addDays(today, -i)));
  const cats = [
    { title: 'Training', color: 'var(--accent)', pick: (s) => s.training, sub: state.settings.schedule.slots.length ? 'nach deinem Rhythmus' : 'kein Rhythmus festgelegt' },
    { title: 'Ernährung im Zielbereich', color: 'var(--amber)', pick: (s) => s.nutrition, sub: `± ${state.settings.nutritionTolerance} %` },
    { title: 'Gewogen', color: 'var(--body)', pick: (s) => s.weight },
    ...(supplementHabits().length ? [{ title: 'Supplements', color: 'var(--habit)', pick: (s) => s.supplements, sub: supplementHabits().map((h) => h.name).join(', ') }] : []),
    ...otherHabits().map((h, i) => ({ title: h.name, color: h.color, pick: (s) => s.habits.find((x) => x.id === h.id) || { due: false, done: false } })),
  ];
  const overallPick = (s) => s.overall;
  const yr = rate(st.map(overallPick));
  const r30 = rate(last30.map(overallPick));
  return `<div class="card">
    <div class="card-head">
      <button class="icon-btn sm" data-act="dash-year" data-d="-1" aria-label="Vorjahr">${icon('left')}</button>
      <h3 class="num">Erfolgskästchen ${year}</h3>
      <button class="icon-btn sm" data-act="dash-year" data-d="1" ${year >= new Date().getFullYear() ? 'disabled style="opacity:.3"' : ''} aria-label="Nächstes Jahr">${icon('right')}</button>
    </div>
    <div class="row between" style="align-items:flex-end">
      <div class="metric"><span class="lbl">Insgesamt</span><span class="v">${yr == null ? '–' : yr}<small>%</small></span></div>
      <div class="delta"><span class="chip ${r30 >= 80 ? 'good' : r30 == null ? '' : 'food'}">${r30 == null ? '–' : `${r30} %`}</span><span class="vs">letzte 30 Tage</span></div>
    </div>
    ${heatmap(st, overallPick, 'var(--accent)', { levels: true })}
    <div class="legend"><span><i class="lg" style="background:var(--accent)"></i>alles geschafft</span><span><i class="lg" style="background:color-mix(in srgb, var(--accent) 35%, var(--cell-empty))"></i>teilweise</span><span><i class="lg" style="background:var(--cell-empty)"></i>verpasst</span></div>
    <button class="btn block" data-act="dash-details" aria-expanded="${showDetails}">${showDetails ? 'Details ausblenden' : `Details: ${cats.length} Bereiche`}${icon(showDetails ? 'up' : 'down')}</button>
    ${showDetails ? cats.map((c) => {
      const p = rate(st.map(c.pick));
      const p30 = rate(last30.map(c.pick));
      return `<div class="heat">
        <div class="hh"><span class="t"><i style="background:${c.color}"></i>${esc(c.title)}</span><span class="pct">${p == null ? '–' : `${p} %`}</span></div>
        <div class="hs"><span>${c.sub ? esc(c.sub) : ''}</span><span>30 T: ${p30 == null ? '–' : `${p30} %`}</span></div>
        ${heatmap(st, c.pick, c.color)}
      </div>`;
    }).join('') : ''}
  </div>`;
}

function heatmap(statuses, pick, color, { levels = false } = {}) {
  const today = todayKey();
  const lead = (parseKey(`${year}-01-01`).getDay() + 6) % 7; // Montag = 0
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<i class="out"></i>');
  const monthCols = [];
  statuses.forEach((s, i) => {
    const d = parseKey(s.key);
    if (d.getDate() === 1) monthCols.push({ m: d.getMonth(), col: Math.floor((i + lead) / 7) });
    const v = pick(s);
    let cls = '', style = '';
    if (s.key > today) cls = 'future';
    else if (!s.tracked) cls = 'pre';
    else if (v.done) cls = 'on';
    else if (levels && v.frac > 0) { cls = 'part'; style = `--p:${Math.round(15 + v.frac * 45)}%`; }
    else if (v.rest && !v.due) cls = 'rest';
    cells.push(`<i class="${cls}${s.key === today ? ' today' : ''}" ${style ? `style="${style}"` : ''}></i>`);
  });
  const cols = Math.ceil((statuses.length + lead) / 7);
  const months = Array.from({ length: cols }, (_, c) => { const m = monthCols.find((x) => x.col === c); return `<span>${m && m.m % 2 === 0 ? MONTHS[m.m] : ''}</span>`; }).join('');
  return `<div class="heat-months" style="grid-template-columns:repeat(${cols},1fr)">${months}</div>
    <div class="heat-grid" style="--hc:${color};grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div>`;
}

const rerender = () => window.dispatchEvent(new Event('rerender'));
onAct({
  'dash-details': () => { showDetails = !showDetails; try { localStorage.setItem('formkurve-details', showDetails ? '1' : '0'); } catch {} rerender(); },
  'dash-period': (el) => { period = el.dataset.k; rerender(); },
  'dash-year': (el) => { year = Math.min(new Date().getFullYear(), year + +el.dataset.d); rerender(); },
  'tdee-win': (el) => { state.settings.tdeeWindow = +el.dataset.d; save(); },
  'tdee-apply': async (el) => {
    const v = +el.dataset.v;
    if (!(await confirmDialog({ title: `Kalorienziel auf ${fmt(v)} kcal setzen?`, text: 'Die Makroziele bleiben unverändert und lassen sich unter Ernährung anpassen.', ok: 'Übernehmen' }))) return;
    state.settings.goals.kcal = v;
    save();
    toast('Kalorienziel aktualisiert');
  },
  'demo-load': async () => {
    if (!(await confirmDialog({ title: 'Beispieldaten laden?', text: '150 Tage erfundene Trainings, Mahlzeiten und Gewichte, damit du alle Auswertungen siehst. Über Einstellungen → „Alle Daten löschen“ startest du danach frisch.', ok: 'Laden' }))) return;
    replaceState(demoData());
    toast('Beispieldaten geladen');
  },
});

// =====================================================================
// Einstellungen
// =====================================================================
function syncLabel() {
  const s = currentSession();
  if (!s) return '';
  if (s.mode !== 'cloud') return cloudEnabled ? 'Lokaler Account' : 'Lokaler Account · nur auf diesem Gerät';
  const st = getSyncStatus();
  return { synchron: 'Cloud · synchronisiert', speichert: 'Cloud · speichert …', ausstehend: 'Cloud · wird gleich gespeichert', 'lädt': 'Cloud · lädt …', offline: 'Cloud · offline, wird später gespeichert', Fehler: 'Cloud · Speichern fehlgeschlagen, neuer Versuch folgt' }[st] || 'Cloud';
}
onSyncStatus(() => { const el = document.getElementById('sync-status'); if (el) el.textContent = syncLabel(); });

function openSettings() {
  loadBls().then(() => { const t = topSheet(); if (t?.id === 'settings') redrawSheet(t); });
  openSheet({
    id: 'settings',
    render: () => {
      const s = state.settings;
      return {
        title: 'Einstellungen',
        body: `
          <h2 class="sec">Account</h2>
          <div class="card">
            <div class="row between">
              <div class="row" style="gap:10px"><span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon('user')}</span>
                <div><div style="font-weight:500">${esc(currentSession()?.name || '')}</div>
                <div class="small muted" id="sync-status">${syncLabel()}</div></div></div>
            </div>
            <div class="grid2">
              <button class="btn" data-act="pw-change">Passwort ändern</button>
              <button class="btn danger" data-act="logout">Abmelden</button>
            </div>
          </div>
          <h2 class="sec">Ziele</h2>
          <div class="card">
            <div class="grid2">
              <label class="field"><span>Mein Ziel</span><button class="btn" data-act="goal-open" style="justify-content:flex-start">${goalLabel()} ${icon('right')}</button></label>
              <label class="field"><span>Kalorienziel</span><button class="btn" data-act="nut-goals" style="justify-content:flex-start">${fmt(s.goals.kcal)} kcal ${icon('right')}</button></label>
            </div>
          </div>
          <h2 class="sec">Training</h2>
          <div class="card">
            <label class="field"><span>Standard-Pausenzeit nach einem Satz</span><select class="input" data-ch="set-rest">${[0, 60, 90, 120, 150, 180, 240].map((v) => `<option value="${v}" ${s.restDefault === v ? 'selected' : ''}>${v ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')} min` : 'Kein Pausentimer'}</option>`).join('')}</select></label>
            <button class="btn sm" data-act="notif-ask" style="align-self:flex-start">${icon('timer')}Benachrichtigung bei Pausenende erlauben</button>
          </div>
          <h2 class="sec">Darstellung</h2>
          <div class="card"><div class="seg">${[['auto', 'System'], ['dark', 'Dunkel'], ['light', 'Hell']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-act="set-theme" data-k="${k}">${l}</button>`).join('')}</div></div>
          <h2 class="sec">Lebensmittel-Datenbank</h2>
          <div class="card">
            <div class="small muted">${blsCount() ? `${fmt(blsCount())} Lebensmittel aus dem Bundeslebensmittelschlüssel sind auf diesem Gerät verfügbar.` : 'Der Bundeslebensmittelschlüssel (BLS 4.0, rund 7.100 Lebensmittel) ist noch nicht geladen. Er wird beim Veröffentlichen automatisch eingebunden. Alternativ: Datei auf blsdb.de herunterladen (ZIP) und hier auswählen.'}</div>
            <label class="btn" style="position:relative">${icon('upload')}BLS-Datei importieren<input type="file" accept=".zip,.xlsx,.json" data-ch="bls-import" style="position:absolute;inset:0;opacity:0"></label>
            <div class="tiny faint">Quelle: ${esc(BLS_CREDIT)}</div>
          </div>
          <h2 class="sec">Daten</h2>
          <div class="card">
            <div class="small muted">${currentSession()?.mode === 'cloud' ? 'Deine Daten liegen in deinem Account und zusätzlich auf diesem Gerät. Ein Backup als Datei schadet trotzdem nicht.' : 'Deine Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei, z. B. in iCloud Drive oder Google Drive.'}</div>
            <div class="grid2">
              <button class="btn" data-act="data-export">${icon('download')}Sichern</button>
              <label class="btn" style="position:relative">${icon('upload')}Wiederherstellen<input type="file" accept="application/json,.json" data-ch="data-import" style="position:absolute;inset:0;opacity:0"></label>
            </div>
            <div class="small muted num">${state.workouts.length} Trainings · ${Object.keys(state.diary).length} Ernährungstage · ${Object.keys(state.weights).length} Gewichte · ${state.foods.length} Lebensmittel</div>
            <button class="btn danger" data-act="data-reset">${icon('trash')}Alle Daten löschen</button>
          </div>
          <p class="tiny faint" style="text-align:center">Gradient · Onlinesuche: Open Food Facts (ODbL) · Nährwertdatenbank: BLS 4.0, Max Rubner-Institut (CC BY 4.0)</p>`,
      };
    },
  });
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
export { applyTheme };

onAct({
  'settings-open': () => openSettings(),
  'set-theme': (el) => { state.settings.theme = el.dataset.k; applyTheme(); save(); },
  'notif-ask': async () => {
    if (!('Notification' in window)) { toast('Benachrichtigungen werden hier nicht unterstützt'); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Benachrichtigungen erlaubt' : 'Benachrichtigungen nicht erlaubt');
  },
  'data-export': async () => {
    const json = JSON.stringify(state);
    const name = `gradient-backup-${todayKey()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Gradient Backup' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup erstellt');
  },
  'logout': async () => {
    if (!(await confirmDialog({ title: 'Abmelden?', text: currentSession()?.mode === 'cloud' ? 'Deine Daten bleiben in deinem Account gespeichert.' : 'Deine Daten bleiben auf diesem Gerät gespeichert und sind nach dem Anmelden wieder da.', ok: 'Abmelden' }))) return;
    await logout();
    location.reload();
  },
  'pw-change': () => openPasswordSheet(),
  'pw-save': async () => {
    const o = document.getElementById('pw-old').value, n = document.getElementById('pw-new').value, n2 = document.getElementById('pw-new2').value;
    if (n !== n2) { toast('Die neuen Passwörter stimmen nicht überein'); return; }
    try { await changePassword(o, n); closeSheet(); toast('Passwort geändert'); }
    catch (e) { toast(e instanceof AuthError ? e.message : 'Passwort konnte nicht geändert werden'); }
  },
  'data-reset': async () => {
    if (!(await confirmDialog({ title: 'Wirklich alle Daten löschen?', text: 'Trainings, Ernährung, Gewichte und Habits werden entfernt. Übungen und Grund-Lebensmittel werden neu angelegt. Erstelle vorher ein Backup.', ok: 'Alles löschen', danger: true }))) return;
    resetAll();
    closeSheet();
    toast('Alle Daten gelöscht');
  },
});
function openPasswordSheet() {
  openSheet({
    id: 'pw',
    render: () => ({
      title: 'Passwort ändern',
      body: `<form class="stack" data-submit="pw-save">
        <label class="field"><span>Bisheriges Passwort</span><input class="input" id="pw-old" type="password" autocomplete="current-password"></label>
        <label class="field"><span>Neues Passwort (mind. 6 Zeichen)</span><input class="input" id="pw-new" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Neues Passwort wiederholen</span><input class="input" id="pw-new2" type="password" autocomplete="new-password"></label>
      </form>`,
      foot: `<button class="btn primary block lg" data-act="pw-save">Speichern</button>`,
    }),
  });
}

onChange({
  'bls-import': async (el) => {
    const file = el.files?.[0];
    if (!file) return;
    toast('Importiere … das dauert ein paar Sekunden', 6000);
    try {
      const n = await importBlsFile(file);
      toast(`${fmt(n)} Lebensmittel importiert`);
      const t = topSheet(); if (t?.id === 'settings') redrawSheet(t);
    } catch (e) {
      console.warn(e);
      toast(e.message || 'Import fehlgeschlagen', 4000);
    }
    el.value = '';
  },
  'set-rate': (el) => { state.settings.weeklyRate = +el.value; save(); },
  'set-rest': (el) => { state.settings.restDefault = +el.value; save(); },
  'data-import': async (el) => {
    const file = el.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.exercises) || typeof data.settings !== 'object') throw new Error('Format');
      if (!(await confirmDialog({ title: 'Backup wiederherstellen?', text: `${data.workouts?.length || 0} Trainings, ${Object.keys(data.weights || {}).length} Gewichte. Die aktuellen Daten werden ersetzt.`, ok: 'Wiederherstellen' }))) return;
      replaceState(data);
      applyTheme();
      toast('Backup wiederhergestellt');
    } catch (e) {
      toast('Datei ist kein gültiges Gradient-Backup');
    }
    el.value = '';
  },
});
