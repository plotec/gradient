// Dashboard: Tagesüberblick, Kalorienverbrauch (TDEE), Jahresübersichten, Diagramme. Dazu die Einstellungen.
import { state, save, dayKcal, latestWeight, weightTrend, workoutDayKeys, computeTdee, totals, dayDiary, replaceState, resetAll, demoData, storageWorks } from './store.js';
import { esc, fmt, fmtMax, signed, todayKey, addDays, parseKey, dayKey, MONTHS, parseNum } from './utils.js';
import { icon, onAct, onChange, openSheet, closeSheet, topSheet, confirmDialog, toast } from './ui.js';
import { lineChart, barChart } from './charts.js';

let year = new Date().getFullYear();

export function renderDashboard() {
  const today = todayKey();
  const g = state.settings.goals;
  const t = totals(dayDiary(today).entries);
  const lw = latestWeight();
  const trend = weightTrend();
  const weekAgo = trend.filter((p) => p.key <= addDays(today, -7)).pop();
  const wdays = workoutDayKeys();
  // Woche ab Montag
  const now = new Date();
  const monday = addDays(today, -((now.getDay() + 6) % 7));
  let weekCount = 0;
  for (let i = 0; i < 7; i++) if (wdays.has(addDays(monday, i))) weekCount++;
  const habitsToday = (state.habitLog[today] || []).length + (state.weights[today] != null ? 1 : 0);
  const habitsTotal = state.habits.length + 1;
  const hour = now.getHours();
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const isEmpty = !state.workouts.length && !Object.keys(state.weights).length && !Object.keys(state.diary).length;

  return `
    <div class="page-head">
      <div><h1>Übersicht</h1><div class="sub">${greet} · ${new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</div></div>
      <button class="icon-btn" data-act="settings-open" aria-label="Einstellungen">${icon('gear')}</button>
    </div>
    ${!storageWorks() ? '<div class="card" style="border-color:var(--bad)"><b>Speichern nicht möglich.</b><span class="small muted">Der Browser blockiert den Speicher (z. B. privater Modus). Einträge gehen beim Schließen verloren.</span></div>' : ''}
    ${isEmpty ? `<div class="card flat"><div class="stack" style="gap:8px;text-align:center;padding:6px">
      <b>Willkommen bei Formkurve</b>
      <span class="small muted">Trag morgens dein Gewicht ein, logge dein Essen und starte dein erstes Training. Das Dashboard füllt sich dann von selbst. Zum Ausprobieren kannst du Beispieldaten laden.</span>
      <button class="btn sm" data-act="demo-load" style="align-self:center">Beispieldaten ansehen</button></div></div>` : ''}

    <div class="kpis">
      <button class="kpi" data-act="goto" data-tab="nutrition">
        <span class="lbl"><i style="background:var(--food)"></i>Kalorien heute</span>
        <span class="val">${fmt(t.kcal)}<small>/ ${fmt(g.kcal)}</small></span>
        <span class="s">E ${fmt(t.protein)} / ${fmt(g.protein)} g</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="body">
        <span class="lbl"><i style="background:var(--body)"></i>Gewicht</span>
        <span class="val">${lw ? fmtMax(state.weights[today] ?? lw.w, 1) : '–'}<small>kg</small></span>
        <span class="s">${state.weights[today] != null ? 'heute gewogen' : '<span style="color:var(--food)">heute noch offen</span>'}${lw && weekAgo ? ` · ${signed(lw.trend - weekAgo.trend, 1)} / Woche` : ''}</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="training">
        <span class="lbl"><i style="background:var(--train)"></i>Training</span>
        <span class="val">${weekCount}<small>× diese Woche</small></span>
        <span class="s">${state.workouts.length} Einheiten insgesamt</span>
      </button>
      <button class="kpi" data-act="goto" data-tab="body">
        <span class="lbl"><i style="background:var(--habit)"></i>Habits heute</span>
        <span class="val">${habitsToday}<small>/ ${habitsTotal}</small></span>
        <span class="s">${habitsToday >= habitsTotal ? 'alles erledigt' : `${habitsTotal - habitsToday} offen`}</span>
      </button>
    </div>

    ${tdeeCard()}

    <div class="card">
      <div class="card-head">
        <button class="icon-btn sm" data-act="dash-year" data-d="-1" aria-label="Vorjahr">${icon('left')}</button>
        <h3 class="num">Jahresübersicht ${year}</h3>
        <button class="icon-btn sm" data-act="dash-year" data-d="1" ${year >= new Date().getFullYear() ? 'disabled style="opacity:.3"' : ''} aria-label="Nächstes Jahr">${icon('right')}</button>
      </div>
      ${heatmap('Training', 'var(--train)', (k) => wdays.has(k))}
      ${heatmap('Gewogen', 'var(--body)', (k) => state.weights[k] != null)}
      ${heatmap('Ernährung geloggt', 'var(--food)', (k) => dayKcal(k) > 0)}
      ${state.habits.map((h) => heatmap(h.name, h.color, (k) => (state.habitLog[k] || []).includes(h.id))).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h3>Gewicht · 90 Tage</h3><span class="small muted">${lw ? `Trend ${fmtMax(lw.trend, 1)} kg` : ''}</span></div>
      ${lineChart({
        series: [
          { points: trend.filter((p) => p.key >= addDays(today, -90)).map((p) => ({ x: parseKey(p.key).getTime(), y: p.w })), color: 'var(--muted)', line: false, dots: true, dotR: 1.8, dotOpacity: 0.5 },
          { points: trend.filter((p) => p.key >= addDays(today, -90)).map((p) => ({ x: parseKey(p.key).getTime(), y: p.trend })), color: 'var(--body)', width: 2.5, endDot: true },
        ],
      })}
    </div>

    <div class="card">
      <div class="card-head"><h3>Kalorien · 30 Tage</h3><span class="small muted">Linie = Ziel ${fmt(g.kcal)}</span></div>
      ${barChart({ bars: Array.from({ length: 30 }, (_, i) => { const k = addDays(today, i - 29); return { x: parseKey(k).getTime(), y: dayKcal(k), dim: k === today }; }), goal: g.kcal, color: 'var(--food)' })}
    </div>`;
}

// ---------- Kalorienverbrauch ----------
function tdeeCard() {
  const r = computeTdee();
  const rate = state.settings.weeklyRate;
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
    </div>`;
  }
  const target = r.tdee + (rate * 7700) / 7;
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
    <div class="divider"></div>
    <div class="row between wrap">
      <div><div class="small muted">Für ${signed(rate, 2)} kg / Woche iss etwa</div><div class="mid-num" style="color:var(--food)">${fmt(Math.round(target / 10) * 10)} kcal</div></div>
      <button class="btn sm" data-act="tdee-apply" data-v="${Math.round(target / 10) * 10}">Als Ziel übernehmen</button>
    </div>
  </div>`;
}

// ---------- Jahres-Heatmap (365 Kästchen) ----------
function heatmap(title, color, on) {
  const jan1 = `${year}-01-01`;
  const dec31 = `${year}-12-31`;
  const today = todayKey();
  const lead = (parseKey(jan1).getDay() + 6) % 7; // Montag = 0
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<i class="out"></i>');
  let k = jan1, count = 0, elapsed = 0;
  const monthCols = [];
  let idx = lead;
  while (k <= dec31) {
    const d = parseKey(k);
    if (d.getDate() === 1) monthCols.push({ m: d.getMonth(), col: Math.floor(idx / 7) });
    const future = k > today;
    const hit = !future && on(k);
    if (hit) count++;
    if (!future) elapsed++;
    cells.push(`<i class="${hit ? 'on' : ''} ${k === today ? 'today' : ''}" ${future ? 'style="opacity:.35"' : ''} title="${k}"></i>`);
    k = addDays(k, 1);
    idx++;
  }
  const cols = Math.ceil(idx / 7);
  const months = Array.from({ length: cols }, (_, c) => { const m = monthCols.find((x) => x.col === c); return `<span>${m && m.m % 2 === 0 ? MONTHS[m.m] : ''}</span>`; }).join('');
  return `<div class="heat">
    <div class="hh"><span class="t"><i style="background:${color}"></i>${esc(title)}</span><span class="c">${count} / ${elapsed} Tage${elapsed ? ` · ${Math.round((count / elapsed) * 100)} %` : ''}</span></div>
    <div class="heat-months" style="grid-template-columns:repeat(${cols},1fr)">${months}</div>
    <div class="heat-grid" style="--hc:${color};grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div>
  </div>`;
}

const rerender = () => window.dispatchEvent(new Event('rerender'));
onAct({
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
function openSettings() {
  openSheet({
    id: 'settings',
    render: () => {
      const s = state.settings;
      return {
        title: 'Einstellungen',
        body: `
          <h2 class="sec">Ziele</h2>
          <div class="card">
            <div class="grid2">
              <label class="field"><span>Gewichtsziel pro Woche</span><select class="input" data-ch="set-rate">${[-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5].map((v) => `<option value="${v}" ${s.weeklyRate === v ? 'selected' : ''}>${signed(v, 2)} kg</option>`).join('')}</select></label>
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
          <h2 class="sec">Daten</h2>
          <div class="card">
            <div class="small muted">Alle Daten liegen nur auf diesem Gerät im Browser. Sichere sie regelmäßig als Datei, z. B. in iCloud Drive oder Google Drive.</div>
            <div class="grid2">
              <button class="btn" data-act="data-export">${icon('download')}Sichern</button>
              <label class="btn" style="position:relative">${icon('upload')}Wiederherstellen<input type="file" accept="application/json,.json" data-ch="data-import" style="position:absolute;inset:0;opacity:0"></label>
            </div>
            <div class="small muted num">${state.workouts.length} Trainings · ${Object.keys(state.diary).length} Ernährungstage · ${Object.keys(state.weights).length} Gewichte · ${state.foods.length} Lebensmittel</div>
            <button class="btn danger" data-act="data-reset">${icon('trash')}Alle Daten löschen</button>
          </div>
          <p class="tiny faint" style="text-align:center">Formkurve · Lebensmittel-Onlinesuche: Open Food Facts (ODbL)</p>`,
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
    const name = `formkurve-backup-${todayKey()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Formkurve Backup' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup erstellt');
  },
  'data-reset': async () => {
    if (!(await confirmDialog({ title: 'Wirklich alle Daten löschen?', text: 'Trainings, Ernährung, Gewichte und Habits werden entfernt. Übungen und Grund-Lebensmittel werden neu angelegt. Erstelle vorher ein Backup.', ok: 'Alles löschen', danger: true }))) return;
    resetAll();
    closeSheet();
    toast('Alle Daten gelöscht');
  },
});
onChange({
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
      toast('Datei ist kein gültiges Formkurve-Backup');
    }
    el.value = '';
  },
});
