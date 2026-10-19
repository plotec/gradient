// Bereich Training: Trainingstage, Übungen, laufendes Training, Zusammenfassung, Verlauf.
import { state, save, exById, dayById, exerciseHistory, bestE10, lastSetsFor, setVolume, MUSCLES, EQUIPMENT } from './store.js';
import { uid, esc, fmt, fmtMax, signed, parseNum, e10rm, roundTo, fmtClock, fmtDuration, fmtDay, dayKey, sum, MONTHS } from './utils.js';
import { icon, onAct, onInput, onChange, openSheet, closeSheet, confirmDialog, menuDialog, toast, beep, sheetOpen, topSheet } from './ui.js';
import { lineChart } from './charts.js';

let sub = 'plan';
let exSearch = '';

const e10 = (w, r) => roundTo(e10rm(w, r), 0.5);
const kg = (n) => `${fmtMax(n, 2)} kg`;
const restOptions = [0, 45, 60, 90, 120, 150, 180, 240, 300];
const restLabel = (s) => (s ? (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s / 60} min`) : 'Aus');

// =====================================================================
// Tab
// =====================================================================
export function renderTraining() {
  const aw = state.activeWorkout;
  return `
    <div class="page-head">
      <div><h1>Training</h1><div class="sub">${state.workouts.length} Einheiten gespeichert</div></div>
    </div>
    ${aw ? `<button class="live-banner" data-act="wo-open">
        <span class="pulse"></span>
        <div class="grow"><div style="font-weight:600">${esc(aw.name)} läuft</div><div class="small" style="opacity:.85">${doneCount(aw)} von ${totalCount(aw)} Sätzen</div></div>
        <span class="big-num" data-clock="elapsed">${fmtClock(Date.now() - aw.startedAt)}</span>
      </button>` : ''}
    <div class="seg" role="tablist">
      ${[['plan', 'Trainingstage'], ['exercises', 'Übungen'], ['history', 'Verlauf']].map(([k, l]) => `<button class="${sub === k ? 'on' : ''}" data-act="tr-sub" data-k="${k}">${l}</button>`).join('')}
    </div>
    ${sub === 'plan' ? renderPlan() : sub === 'exercises' ? renderExercises() : renderHistory()}`;
}

function renderPlan() {
  const days = state.workoutDays;
  return `
    ${days.map((d) => {
      const last = [...state.workouts].reverse().find((w) => w.dayId === d.id);
      return `<div class="card day-card">
        <div class="card-head">
          <div class="grow"><h3>${esc(d.name)}</h3>
            <div class="small muted">${d.items.length} Übungen · ${sum(d.items, (i) => i.sets)} Sätze${last ? ` · zuletzt ${fmtDay(dayKey(new Date(last.startedAt)))}` : ''}</div></div>
          <button class="icon-btn sm" data-act="day-edit" data-id="${d.id}" aria-label="Bearbeiten">${icon('edit')}</button>
        </div>
        <div class="ex-names">${d.items.map((i) => esc(exById(i.exerciseId)?.name || '?')).join(' · ') || 'Noch keine Übungen'}</div>
        <button class="btn primary block" data-act="wo-start" data-id="${d.id}" ${state.activeWorkout ? 'disabled style="opacity:.5"' : ''}>${icon('play')}Training starten</button>
      </div>`;
    }).join('')}
    <div class="grid2">
      <button class="btn" data-act="day-new">${icon('plus')}Trainingstag</button>
      <button class="btn" data-act="wo-start" data-id="" ${state.activeWorkout ? 'disabled style="opacity:.5"' : ''}>${icon('bolt')}Freies Training</button>
    </div>`;
}

function renderExercises() {
  const q = exSearch.trim().toLowerCase();
  const list = state.exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
  const groups = {};
  list.forEach((e) => (groups[e.muscle] ||= []).push(e));
  const order = [...MUSCLES, ...Object.keys(groups).filter((m) => !MUSCLES.includes(m))];
  return `
    <div class="row">
      <label class="search grow">${icon('search')}<input class="input" id="ex-search" placeholder="Übung suchen" value="${esc(exSearch)}" data-in="ex-search" autocomplete="off"></label>
      <button class="icon-btn" data-act="ex-new" aria-label="Neue Übung" style="width:44px;height:44px">${icon('plus')}</button>
    </div>
    <div id="ex-list">${exerciseListHtml(groups, order)}</div>`;
}
function exerciseListHtml(groups, order) {
  const html = order.filter((m) => groups[m]).map((m) => `
    <h2 class="sec">${esc(m)}</h2>
    <div class="card" style="padding:4px 14px"><div class="list">
      ${groups[m].sort((a, b) => a.name.localeCompare(b.name, 'de')).map((e) => {
        const h = exerciseHistory(e.id);
        const best = h.length ? Math.max(...h.map((x) => bestE10(x.sets, e10))) : 0;
        return `<button class="li" data-act="ex-detail" data-id="${e.id}">
          <div class="grow"><div class="t ellipsis">${esc(e.name)}</div><div class="s">${esc(e.equipment)} · ${h.length}× trainiert</div></div>
          <div class="r">${best ? `<div class="mid-num" style="font-size:18px;color:var(--train)">${fmtMax(best, 1)}</div><div class="tiny faint">10RM kg</div>` : ''}</div>
        </button>`;
      }).join('')}
    </div></div>`).join('');
  return html || '<div class="empty">Keine Übung gefunden.</div>';
}

function renderHistory() {
  const ws = [...state.workouts].sort((a, b) => b.startedAt - a.startedAt);
  if (!ws.length) return '<div class="card flat"><div class="empty">Noch keine Trainings. Starte dein erstes Training unter „Trainingstage“.</div></div>';
  let html = '', month = '';
  for (const w of ws.slice(0, 200)) {
    const d = new Date(w.startedAt);
    const m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (m !== month) { if (month) html += '</div></div>'; month = m; html += `<h2 class="sec">${m}</h2><div class="card" style="padding:4px 14px"><div class="list">`; }
    const sets = sum(w.exercises, (e) => e.sets.length);
    const vol = sum(w.exercises, (e) => sum(e.sets, setVolume));
    html += `<button class="li" data-act="wo-detail" data-id="${w.id}">
      <div class="grow"><div class="t">${esc(w.name)}</div><div class="s">${fmtDay(dayKey(d))} · ${fmtDuration(w.endedAt - w.startedAt)} · ${sets} Sätze</div></div>
      <div class="r num small muted">${fmt(vol)} kg</div></button>`;
  }
  return html + '</div></div>';
}

onAct({
  'tr-sub': (el) => { sub = el.dataset.k; save({ silent: true }); window.dispatchEvent(new Event('rerender')); },
});
onInput({
  'ex-search': (el) => {
    exSearch = el.value;
    const q = exSearch.trim().toLowerCase();
    const groups = {};
    state.exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)).forEach((e) => (groups[e.muscle] ||= []).push(e));
    document.getElementById('ex-list').innerHTML = exerciseListHtml(groups, [...MUSCLES, ...Object.keys(groups).filter((m) => !MUSCLES.includes(m))]);
  },
});

// =====================================================================
// Trainingstag bearbeiten
// =====================================================================
function openDayEditor(id) {
  openSheet({
    id: 'day-editor',
    render: () => {
      const d = dayById(id);
      if (!d) return null;
      return {
        title: 'Trainingstag',
        right: `<button class="icon-btn plain" data-act="day-delete" data-id="${d.id}" aria-label="Löschen">${icon('trash')}</button>`,
        body: `
          <label class="field"><span>Name</span><input class="input" id="day-name" value="${esc(d.name)}" data-ch="day-name" data-id="${d.id}" placeholder="z. B. Oberkörper A"></label>
          <h2 class="sec">Übungen</h2>
          ${d.items.length ? d.items.map((it, i) => {
            const ex = exById(it.exerciseId);
            return `<div class="card" style="gap:8px">
              <div class="row">
                <div class="grow"><div style="font-weight:600" class="ellipsis">${i + 1}. ${esc(ex?.name || 'Gelöschte Übung')}</div><div class="tiny muted">${esc(ex?.muscle || '')}</div></div>
                <button class="icon-btn sm" data-act="day-item-move" data-id="${d.id}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Nach oben">${icon('up')}</button>
                <button class="icon-btn sm" data-act="day-item-move" data-id="${d.id}" data-i="${i}" data-dir="1" ${i === d.items.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Nach unten">${icon('down')}</button>
                <button class="icon-btn sm" data-act="day-item-del" data-id="${d.id}" data-i="${i}" aria-label="Entfernen">${icon('x')}</button>
              </div>
              <div class="grid2" style="grid-template-columns: auto 1fr 1fr; align-items:end">
                <div class="field"><span>Sätze</span>
                  <div class="row" style="gap:4px">
                    <button class="icon-btn sm" data-act="day-item-sets" data-id="${d.id}" data-i="${i}" data-d="-1" aria-label="Weniger">${icon('minus')}</button>
                    <span class="mid-num" style="min-width:22px;text-align:center">${it.sets}</span>
                    <button class="icon-btn sm" data-act="day-item-sets" data-id="${d.id}" data-i="${i}" data-d="1" aria-label="Mehr">${icon('plus')}</button>
                  </div></div>
                <label class="field"><span>Wdh-Ziel</span><input class="input" id="it-reps-${i}" value="${esc(it.reps || '')}" data-ch="day-item-reps" data-id="${d.id}" data-i="${i}" placeholder="8–12"></label>
                <label class="field"><span>Pause</span><select class="input" data-ch="day-item-rest" data-id="${d.id}" data-i="${i}">
                  <option value="">Standard</option>${restOptions.map((s) => `<option value="${s}" ${it.rest === s ? 'selected' : ''}>${restLabel(s)}</option>`).join('')}
                </select></label>
              </div>
            </div>`;
          }).join('') : '<div class="card flat"><div class="empty">Füge Übungen hinzu, die an diesem Tag drankommen.</div></div>'}
          <button class="btn block" data-act="day-add-ex" data-id="${d.id}">${icon('plus')}Übungen hinzufügen</button>`,
        foot: `<button class="btn primary block lg" data-act="wo-start" data-id="${d.id}" ${state.activeWorkout ? 'disabled style="opacity:.5"' : ''}>${icon('play')}Training starten</button>`,
      };
    },
  });
}

onAct({
  'day-new': () => {
    const d = { id: uid(), name: `Tag ${state.workoutDays.length + 1}`, items: [] };
    state.workoutDays.push(d);
    save();
    openDayEditor(d.id);
  },
  'day-edit': (el) => openDayEditor(el.dataset.id),
  'day-delete': async (el) => {
    const d = dayById(el.dataset.id);
    if (!(await confirmDialog({ title: `„${d.name}“ löschen?`, text: 'Bereits gespeicherte Trainings bleiben erhalten.', ok: 'Löschen', danger: true }))) return;
    state.workoutDays = state.workoutDays.filter((x) => x.id !== d.id);
    closeSheet();
    save();
  },
  'day-item-move': (el) => {
    const d = dayById(el.dataset.id), i = +el.dataset.i, j = i + +el.dataset.dir;
    [d.items[i], d.items[j]] = [d.items[j], d.items[i]];
    save();
  },
  'day-item-del': (el) => { dayById(el.dataset.id).items.splice(+el.dataset.i, 1); save(); },
  'day-item-sets': (el) => {
    const it = dayById(el.dataset.id).items[+el.dataset.i];
    it.sets = Math.max(1, Math.min(12, it.sets + +el.dataset.d));
    save();
  },
  'day-add-ex': (el) => {
    const d = dayById(el.dataset.id);
    openExercisePicker({
      multi: true,
      onPick: (ids) => { ids.forEach((exerciseId) => d.items.push({ exerciseId, sets: 3, reps: '8–12', rest: null })); save(); },
    });
  },
});
onChange({
  'day-name': (el) => { dayById(el.dataset.id).name = el.value.trim() || 'Trainingstag'; save(); },
  'day-item-reps': (el) => { dayById(el.dataset.id).items[+el.dataset.i].reps = el.value.trim(); save({ silent: true }); },
  'day-item-rest': (el) => { dayById(el.dataset.id).items[+el.dataset.i].rest = el.value === '' ? null : +el.value; save({ silent: true }); },
});

// =====================================================================
// Übungsauswahl & Übungseditor
// =====================================================================
function openExercisePicker({ multi = false, onPick }) {
  let q = '';
  const picked = [];
  const spec = openSheet({
    id: 'ex-picker',
    render: () => ({
      title: multi ? 'Übungen wählen' : 'Übung wählen',
      right: `<button class="icon-btn plain" data-act="picker-new" aria-label="Neue Übung">${icon('plus')}</button>`,
      top: `<div style="padding:10px 16px 0;background:var(--bg)"><label class="search">${icon('search')}<input class="input" id="picker-q" placeholder="Suchen" value="${esc(q)}" data-in="picker-q" autocomplete="off"></label></div>`,
      body: `<div class="list" id="picker-list">${listHtml()}</div>`,
      foot: multi ? `<button class="btn primary block lg" data-act="picker-done" ${picked.length ? '' : 'disabled style="opacity:.5"'}>${picked.length ? `${picked.length} hinzufügen` : 'Übungen antippen'}</button>` : '',
    }),
  });
  function listHtml() {
    const s = q.trim().toLowerCase();
    const list = state.exercises.filter((e) => !s || e.name.toLowerCase().includes(s) || e.muscle.toLowerCase().includes(s))
      .sort((a, b) => a.muscle.localeCompare(b.muscle, 'de') || a.name.localeCompare(b.name, 'de'));
    return list.map((e) => {
      const n = picked.filter((x) => x === e.id).length;
      return `<button class="li" data-act="picker-pick" data-id="${e.id}">
        <div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.muscle)} · ${esc(e.equipment)}</div></div>
        ${n ? `<span class="chip train">${icon('check')}${n > 1 ? n : ''}</span>` : ''}
      </button>`;
    }).join('') || `<div class="empty">Nichts gefunden.<br><button class="link" data-act="picker-new">„${esc(q)}“ als neue Übung anlegen</button></div>`;
  }
  spec.pick = (id) => {
    if (!multi) { closeSheet(spec); onPick(id); return; }
    picked.includes(id) ? picked.splice(picked.indexOf(id), 1) : picked.push(id);
    document.getElementById('picker-list').innerHTML = listHtml();
    const btn = spec.el.querySelector('[data-act="picker-done"]');
    btn.disabled = !picked.length; btn.style.opacity = picked.length ? '' : '.5';
    btn.textContent = picked.length ? `${picked.length} hinzufügen` : 'Übungen antippen';
  };
  spec.done = () => { closeSheet(spec); onPick(picked); };
  spec.setQ = (v) => { q = v; document.getElementById('picker-list').innerHTML = listHtml(); };
  spec.newEx = () => openExerciseEditor(null, (id) => spec.pick(id), q);
}
const pickerSpec = () => findSpec('ex-picker');
function findSpec(id) { const t = topSheet(); return t && t.id === id ? t : null; }

onAct({
  'picker-pick': (el) => pickerSpec()?.pick(el.dataset.id),
  'picker-done': () => pickerSpec()?.done(),
  'picker-new': () => pickerSpec()?.newEx(),
});
onInput({ 'picker-q': (el) => pickerSpec()?.setQ(el.value) });

function openExerciseEditor(id, onSaved, presetName = '') {
  const ex = id ? exById(id) : null;
  const draft = ex ? { ...ex } : { name: presetName, muscle: 'Brust', equipment: 'Langhantel', note: '', rest: null };
  openSheet({
    id: 'ex-editor',
    render: () => ({
      title: ex ? 'Übung bearbeiten' : 'Neue Übung',
      body: `
        <form class="stack" data-submit="ex-save" id="ex-form">
          <label class="field"><span>Name</span><input class="input" name="name" id="exf-name" required value="${esc(draft.name)}" placeholder="z. B. Bankdrücken" autocomplete="off"></label>
          <div class="grid2">
            <label class="field"><span>Muskelgruppe</span><select class="input" name="muscle">${MUSCLES.map((m) => `<option ${m === draft.muscle ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            <label class="field"><span>Equipment</span><select class="input" name="equipment">${EQUIPMENT.map((m) => `<option ${m === draft.equipment ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Standard-Pause</span><select class="input" name="rest"><option value="">Wie in Einstellungen (${restLabel(state.settings.restDefault)})</option>${restOptions.map((s) => `<option value="${s}" ${draft.rest === s ? 'selected' : ''}>${restLabel(s)}</option>`).join('')}</select></label>
          <label class="field"><span>Notiz (Einstellungen, Technik …)</span><textarea class="input" name="note" placeholder="z. B. Sitz Stufe 4, Griff eng">${esc(draft.note)}</textarea></label>
        </form>
        ${ex ? `<button class="btn danger block" data-act="ex-delete" data-id="${ex.id}">${icon('trash')}Übung löschen</button>` : ''}`,
      foot: `<button class="btn primary block lg" data-act="ex-save">${icon('check')}Speichern</button>`,
    }),
    afterRender: (s, first) => { if (first && !ex) s.el.querySelector('#exf-name').focus(); },
    save: () => {
      const f = document.getElementById('ex-form');
      const fd = new FormData(f);
      const name = String(fd.get('name')).trim();
      if (!name) { toast('Bitte einen Namen eingeben'); return; }
      const data = { name, muscle: fd.get('muscle'), equipment: fd.get('equipment'), note: String(fd.get('note')).trim(), rest: fd.get('rest') === '' ? null : +fd.get('rest') };
      let newId = id;
      if (ex) Object.assign(ex, data);
      else { newId = uid(); state.exercises.push({ id: newId, ...data }); }
      closeSheet();
      save();
      onSaved?.(newId);
    },
  });
}
onAct({
  'ex-new': () => openExerciseEditor(null),
  'ex-save': () => findSpec('ex-editor')?.save(),
  'ex-delete': async (el) => {
    const ex = exById(el.dataset.id);
    const used = exerciseHistory(ex.id).length;
    if (!(await confirmDialog({ title: `„${ex.name}“ löschen?`, text: used ? `Die Übung kommt in ${used} gespeicherten Trainings vor. Diese bleiben erhalten, zeigen dann aber „Gelöschte Übung“.` : '', ok: 'Löschen', danger: true }))) return;
    state.exercises = state.exercises.filter((x) => x.id !== ex.id);
    state.workoutDays.forEach((d) => { d.items = d.items.filter((i) => i.exerciseId !== ex.id); });
    closeSheet(); if (findSpec('ex-detail')) closeSheet();
    save();
  },
  'ex-detail': (el) => openExerciseDetail(el.dataset.id),
});

// =====================================================================
// Übungsdetails (Rekorde, Verlauf)
// =====================================================================
function openExerciseDetail(id) {
  openSheet({
    id: 'ex-detail',
    render: () => {
      const ex = exById(id);
      if (!ex) return null;
      const h = exerciseHistory(id);
      const pts = h.map((s) => ({ x: s.date, y: bestE10(s.sets, e10) })).filter((p) => p.y > 0);
      const bestE = pts.length ? Math.max(...pts.map((p) => p.y)) : 0;
      const allSets = h.flatMap((s) => s.sets);
      const maxW = allSets.length ? Math.max(...allSets.map((s) => s.weight || 0)) : 0;
      const maxReps = allSets.length ? Math.max(...allSets.map((s) => s.reps || 0)) : 0;
      const maxVol = h.length ? Math.max(...h.map((s) => sum(s.sets, setVolume))) : 0;
      return {
        title: ex.name,
        right: `<button class="icon-btn plain" data-act="ex-edit" data-id="${id}" aria-label="Bearbeiten">${icon('edit')}</button>`,
        body: `
          <div class="row wrap"><span class="chip train">${esc(ex.muscle)}</span><span class="chip">${esc(ex.equipment)}</span>${ex.note ? `<span class="small muted">${esc(ex.note)}</span>` : ''}</div>
          <div class="grid2">
            <div class="stat"><span class="lbl">Bestes 10RM</span><span class="mid-num" style="color:var(--train)">${bestE ? kg(bestE) : '–'}</span></div>
            <div class="stat"><span class="lbl">Höchstgewicht</span><span class="mid-num">${maxW ? kg(maxW) : '–'}</span></div>
            <div class="stat"><span class="lbl">Meiste Wdh</span><span class="mid-num">${maxReps || '–'}</span></div>
            <div class="stat"><span class="lbl">Bestes Volumen</span><span class="mid-num">${maxVol ? `${fmt(maxVol)} kg` : '–'}</span></div>
          </div>
          <div class="card"><div class="card-head"><h3>10RM-Verlauf</h3><span class="small muted">${h.length} Einheiten</span></div>
            ${lineChart({ series: [{ points: pts, color: 'var(--train)', dots: true, endDot: true, area: true }] })}
          </div>
          <h2 class="sec">Letzte Einheiten</h2>
          ${h.length ? `<div class="card" style="padding:4px 14px"><div class="list">${h.slice().reverse().slice(0, 30).map((s) => `
            <div class="li"><div class="grow"><div class="t">${fmtDay(dayKey(new Date(s.date)))}</div>
              <div class="s num">${s.sets.map((x) => `${fmtMax(x.weight || 0, 2)}×${x.reps}`).join(' · ')}</div></div>
              <div class="r"><div class="mid-num" style="font-size:17px;color:var(--train)">${fmtMax(bestE10(s.sets, e10), 1)}</div><div class="tiny faint">10RM</div></div></div>`).join('')}
          </div></div>` : '<div class="card flat"><div class="empty">Diese Übung wurde noch nicht trainiert.</div></div>'}`,
      };
    },
  });
}
onAct({ 'ex-edit': (el) => openExerciseEditor(el.dataset.id) });

// =====================================================================
// Laufendes Training
// =====================================================================
const doneCount = (aw) => sum(aw.exercises, (e) => e.sets.filter((s) => s.done).length);
const totalCount = (aw) => sum(aw.exercises, (e) => e.sets.length);

function buildExercise(exerciseId, setsCount = 3, target = '', rest = null) {
  const last = lastSetsFor(exerciseId);
  const sets = Array.from({ length: setsCount }, (_, j) => {
    const p = last ? last[Math.min(j, last.length - 1)] : null;
    return { weight: p ? p.weight : null, reps: p ? p.reps : null, quality: null, done: false };
  });
  return { exerciseId, target, rest, sets };
}

function startWorkout(dayId) {
  const day = dayId ? dayById(dayId) : null;
  state.activeWorkout = {
    id: uid(), dayId: day?.id || null, name: day?.name || 'Freies Training', startedAt: Date.now(),
    current: 0, restEnd: null, restTotal: 0, restBeeped: false,
    exercises: day ? day.items.filter((i) => exById(i.exerciseId)).map((i) => buildExercise(i.exerciseId, i.sets, i.reps, i.rest)) : [],
  };
  save();
  openWorkout();
  requestWakeLock();
}

let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.activeWorkout && sheetOpen('workout')) requestWakeLock(); });

export function openWorkout() {
  if (sheetOpen('workout')) return;
  openSheet({
    id: 'workout',
    render: renderWorkout,
    afterRender: (s, first) => {
      if (first || s.scrollToCurrent) {
        s.scrollToCurrent = false;
        const cur = s.el.querySelector('.ex-card.current');
        if (cur && !first) cur.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    onClose: () => { try { wakeLock?.release(); } catch {} wakeLock = null; },
  });
}

function renderWorkout() {
  const aw = state.activeWorkout;
  if (!aw) return null;
  const rest = aw.restEnd ? restBarHtml(aw) : '';
  const vol = sum(aw.exercises, (e) => sum(e.sets.filter((s) => s.done), setVolume));
  return {
    title: aw.name,
    left: `<button class="icon-btn plain" data-act="sheet-close" aria-label="Minimieren">${icon('down')}</button>`,
    right: `<button class="btn primary sm" data-act="wo-finish">Abschließen</button>`,
    top: rest,
    body: `
      <div class="row between">
        <div><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.07em;font-weight:600">Trainingszeit</div><div class="big-num" style="color:var(--train)" data-clock="elapsed">${fmtClock(Date.now() - aw.startedAt)}</div></div>
        <div style="text-align:right"><div class="mid-num">${doneCount(aw)}/${totalCount(aw)}</div><div class="tiny muted">Sätze · ${fmt(vol)} kg</div></div>
      </div>
      ${aw.exercises.map((ex, i) => exerciseCard(aw, ex, i)).join('') || '<div class="card flat"><div class="empty">Noch keine Übungen. Füge die erste hinzu.</div></div>'}
      <button class="btn block" data-act="wo-add-ex">${icon('plus')}Übung hinzufügen</button>
      <button class="btn ghost danger block" data-act="wo-discard">Training verwerfen</button>`,
  };
}

function restBarHtml(aw) {
  const left = aw.restEnd - Date.now();
  const over = left <= 0;
  const pct = aw.restTotal ? Math.max(0, Math.min(100, (left / (aw.restTotal * 1000)) * 100)) : 0;
  return `<div class="rest-bar ${over ? 'over' : ''}" id="rest-bar">
    ${icon('timer')}
    <span class="rest-time" data-clock="rest">${over ? '+' : ''}${fmtClock(Math.abs(left) + (over ? 0 : 999))}</span>
    <div class="track"><i data-clock="rest-track" style="width:${pct}%"></i></div>
    <button class="btn sm" data-act="rest-add" data-d="-15">−15</button>
    <button class="btn sm" data-act="rest-add" data-d="15">+15</button>
    <button class="icon-btn sm" data-act="rest-stop" aria-label="Pause beenden">${icon('x')}</button>
  </div>`;
}

function exerciseCard(aw, ex, i) {
  const meta = exById(ex.exerciseId);
  const done = ex.sets.filter((s) => s.done).length;
  const complete = ex.sets.length > 0 && done === ex.sets.length;
  const current = aw.current === i;
  const last = lastSetsFor(ex.exerciseId);
  const cls = `ex-card ${current ? 'current' : ''} ${complete ? 'complete' : ''}`;
  const head = `<button class="ex-top" data-act="wo-focus" data-i="${i}">
      <span class="badge">${complete ? icon('check') : i + 1}</span>
      <div class="grow"><div class="t ellipsis" style="font-weight:600">${esc(meta?.name || 'Gelöschte Übung')}</div>
        <div class="tiny muted">${done}/${ex.sets.length} Sätze${ex.target ? ` · Ziel ${esc(ex.target)} Wdh` : ''}</div></div>
      ${current ? '' : `<span class="small muted num">${ex.sets.filter((s) => s.done).map((s) => `${fmtMax(s.weight || 0, 2)}×${s.reps}`).join(' ')}</span>`}
    </button>`;
  if (!current) return `<div class="${cls}">${head}</div>`;
  const firstOpen = ex.sets.findIndex((s) => !s.done);
  return `<div class="${cls}" id="ex-card-${i}">${head}
    <div class="ex-body">
      ${last ? `<div class="last-time">${icon('history', '')} Letztes Mal: <span class="num">${last.map((s) => `${fmtMax(s.weight || 0, 2)} kg × ${s.reps}`).join(' · ')}</span></div>` : ''}
      ${meta?.note ? `<div class="last-time">${esc(meta.note)}</div>` : ''}
      <div class="sets">
        <span class="hd">#</span><span class="hd">kg</span><span class="hd">Wdh</span><span class="hd">10RM</span><span class="hd">Q</span><span class="hd">${icon('check')}</span>
        ${ex.sets.map((s, j) => `<div class="sr ${s.done ? 'row-done' : ''} ${j === firstOpen ? 'active-row' : ''}">
          <span class="n">${j + 1}</span>
          <input id="w-${i}-${j}" type="text" inputmode="decimal" enterkeyhint="next" value="${s.weight ?? ''}" placeholder="kg" data-in="set-w" data-i="${i}" data-j="${j}" aria-label="Gewicht Satz ${j + 1}">
          <input id="r-${i}-${j}" type="text" inputmode="numeric" enterkeyhint="done" value="${s.reps ?? ''}" placeholder="${esc(repPlaceholder(ex.target))}" data-in="set-r" data-i="${i}" data-j="${j}" aria-label="Wiederholungen Satz ${j + 1}">
          <span class="rm" id="rm-${i}-${j}">${rmHtml(s)}</span>
          <select data-ch="set-q" data-i="${i}" data-j="${j}" aria-label="Qualität Satz ${j + 1}"><option value="">–</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((q) => `<option ${s.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select>
          <button class="chk ${s.done ? 'on' : ''}" data-act="set-check" data-i="${i}" data-j="${j}" aria-label="Satz ${j + 1} abhaken">${icon('check')}</button>
        </div>`).join('')}
      </div>
      <div class="ex-actions">
        <button class="btn sm" data-act="set-add" data-i="${i}">${icon('plus')}Satz</button>
        <button class="btn sm" data-act="set-remove" data-i="${i}" ${ex.sets.length <= 1 ? 'disabled style="opacity:.4"' : ''}>${icon('minus')}Satz</button>
        <span class="grow"></span>
        <button class="btn sm" data-act="wo-ex-menu" data-i="${i}">${icon('more')}</button>
      </div>
    </div></div>`;
}
const repPlaceholder = (t) => (t ? String(t).split(/[–-]/)[0].trim() || 'Wdh' : 'Wdh');
function rmHtml(s) {
  const v = e10(s.weight, s.reps);
  return v ? `${fmtMax(v, 1)}<small>kg</small>` : '<span class="faint">–</span>';
}

function nextFocus(aw, i) {
  // nächste offene Übung ab i, sonst erste offene überhaupt
  const open = (k) => aw.exercises[k] && aw.exercises[k].sets.some((s) => !s.done);
  for (let k = i; k < aw.exercises.length; k++) if (open(k)) return k;
  for (let k = 0; k < i; k++) if (open(k)) return k;
  return i;
}

onAct({
  'wo-start': async (el) => {
    if (state.activeWorkout) { openWorkout(); return; }
    if (sheetOpen('day-editor')) closeSheet();
    startWorkout(el.dataset.id || null);
  },
  'wo-open': () => { openWorkout(); requestWakeLock(); },
  'wo-focus': (el) => { state.activeWorkout.current = +el.dataset.i; save(); },
  'set-check': (el) => {
    const aw = state.activeWorkout;
    const i = +el.dataset.i, j = +el.dataset.j;
    const ex = aw.exercises[i];
    const s = ex.sets[j];
    // Werte aus den Feldern übernehmen (falls noch nicht per input gespeichert)
    s.done = !s.done;
    s.doneAt = s.done ? Date.now() : null;
    if (s.done) {
      if (s.reps == null) {
        const ph = parseNum(repPlaceholder(ex.target));
        if (ph) s.reps = ph;
      }
      // nachfolgende leere Sätze mit diesen Werten vorbelegen
      for (let k = j + 1; k < ex.sets.length; k++) {
        const n = ex.sets[k];
        if (!n.done && n.weight == null && n.reps == null) { n.weight = s.weight; n.reps = s.reps; }
      }
      if (ex.sets.every((x) => x.done)) {
        aw.current = nextFocus(aw, i + 1);
        const t = findSpec('workout'); if (t) t.scrollToCurrent = true;
      }
      const restSec = ex.rest ?? exById(ex.exerciseId)?.rest ?? state.settings.restDefault;
      const allDone = aw.exercises.every((e) => e.sets.every((x) => x.done));
      if (restSec && !allDone) { aw.restEnd = Date.now() + restSec * 1000; aw.restTotal = restSec; aw.restBeeped = false; }
      else aw.restEnd = null;
      try { navigator.vibrate?.(30); } catch {}
    }
    save();
  },
  'set-add': (el) => {
    const ex = state.activeWorkout.exercises[+el.dataset.i];
    const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ weight: prev?.weight ?? null, reps: prev?.reps ?? null, quality: null, done: false });
    save();
  },
  'set-remove': (el) => {
    const ex = state.activeWorkout.exercises[+el.dataset.i];
    if (ex.sets.length > 1) ex.sets.pop();
    save();
  },
  'wo-ex-menu': async (el) => {
    const aw = state.activeWorkout;
    const i = +el.dataset.i;
    const v = await menuDialog({
      title: exById(aw.exercises[i].exerciseId)?.name,
      options: [
        { label: 'Nach oben', icon: 'up', value: 'up' },
        { label: 'Nach unten', icon: 'down', value: 'down' },
        { label: 'Übung tauschen', icon: 'edit', value: 'swap' },
        { label: 'Verlauf ansehen', icon: 'trend', value: 'hist' },
        { label: 'Aus Training entfernen', icon: 'trash', value: 'del', danger: true },
      ],
    });
    if (v === 'up' && i > 0) { [aw.exercises[i - 1], aw.exercises[i]] = [aw.exercises[i], aw.exercises[i - 1]]; aw.current = i - 1; }
    if (v === 'down' && i < aw.exercises.length - 1) { [aw.exercises[i + 1], aw.exercises[i]] = [aw.exercises[i], aw.exercises[i + 1]]; aw.current = i + 1; }
    if (v === 'del') { aw.exercises.splice(i, 1); aw.current = Math.min(aw.current, aw.exercises.length - 1); }
    if (v === 'hist') { openExerciseDetail(aw.exercises[i].exerciseId); return; }
    if (v === 'swap') {
      openExercisePicker({ onPick: (id) => {
        const old = aw.exercises[i];
        aw.exercises[i] = buildExercise(id, old.sets.length, old.target, old.rest);
        save();
      } });
      return;
    }
    save();
  },
  'wo-add-ex': () => {
    const aw = state.activeWorkout;
    openExercisePicker({ multi: true, onPick: (ids) => {
      const first = aw.exercises.length;
      ids.forEach((id) => aw.exercises.push(buildExercise(id, 3)));
      if (ids.length && (aw.exercises[aw.current]?.sets.every((s) => s.done) ?? true)) aw.current = first;
      save();
    } });
  },
  'rest-add': (el) => {
    const aw = state.activeWorkout;
    const d = +el.dataset.d;
    aw.restEnd = Math.max(Date.now(), aw.restEnd) + d * 1000;
    aw.restTotal = Math.max(1, aw.restTotal + d);
    aw.restBeeped = aw.restEnd <= Date.now();
    save();
  },
  'rest-stop': () => { state.activeWorkout.restEnd = null; save(); },
  'wo-discard': async () => {
    if (!(await confirmDialog({ title: 'Training verwerfen?', text: 'Alle Eingaben dieses Trainings gehen verloren.', ok: 'Verwerfen', danger: true }))) return;
    state.activeWorkout = null;
    closeSheet();
    save();
  },
  'wo-finish': () => finishWorkout(),
});

onInput({
  'set-w': (el) => updateSet(el, 'weight', parseNum(el.value)),
  'set-r': (el) => { const n = parseNum(el.value); updateSet(el, 'reps', n == null ? null : Math.round(n)); },
});
onChange({
  'set-q': (el) => updateSet(el, 'quality', el.value ? +el.value : null),
});
function updateSet(el, key, val) {
  const aw = state.activeWorkout;
  if (!aw) return;
  const i = +el.dataset.i, j = +el.dataset.j;
  const s = aw.exercises[i]?.sets[j];
  if (!s) return;
  s[key] = val;
  const rm = document.getElementById(`rm-${i}-${j}`);
  if (rm) rm.innerHTML = rmHtml(s);
  save({ silent: true });
}

// Uhr: Trainingszeit + Pausentimer
setInterval(() => {
  const aw = state.activeWorkout;
  if (!aw) return;
  const t = fmtClock(Date.now() - aw.startedAt);
  document.querySelectorAll('[data-clock="elapsed"]').forEach((el) => { el.textContent = t; });
  if (aw.restEnd) {
    const left = aw.restEnd - Date.now();
    const over = left <= 0;
    const rt = document.querySelector('[data-clock="rest"]');
    if (rt) rt.textContent = `${over ? '+' : ''}${fmtClock(Math.abs(left) + (over ? 0 : 999))}`;
    const tr = document.querySelector('[data-clock="rest-track"]');
    if (tr) tr.style.width = `${aw.restTotal ? Math.max(0, Math.min(100, (left / (aw.restTotal * 1000)) * 100)) : 0}%`;
    document.getElementById('rest-bar')?.classList.toggle('over', over);
    if (over && !aw.restBeeped) {
      aw.restBeeped = true;
      save({ silent: true });
      beep(2);
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Pause vorbei', { body: 'Weiter mit dem nächsten Satz.', tag: 'rest' }); } catch {}
      }
    }
    // nach 3 Minuten Überzeit Leiste ausblenden
    if (left < -180000) { aw.restEnd = null; save(); }
  }
}, 1000);

// =====================================================================
// Abschluss & Zusammenfassung
// =====================================================================
async function finishWorkout() {
  const aw = state.activeWorkout;
  const done = doneCount(aw);
  const total = totalCount(aw);
  if (!done) {
    if (await confirmDialog({ title: 'Keine Sätze abgehakt', text: 'Ohne abgehakte Sätze wird nichts gespeichert. Training verwerfen?', ok: 'Verwerfen', danger: true })) {
      state.activeWorkout = null; closeSheet(); save();
    }
    return;
  }
  if (done < total && !(await confirmDialog({ title: 'Training abschließen?', text: `${total - done} Sätze sind nicht abgehakt und werden nicht gespeichert.`, ok: 'Abschließen' }))) return;
  if (done === total && !(await confirmDialog({ title: 'Training abschließen?', text: `${done} Sätze in ${fmtClock(Date.now() - aw.startedAt)}.`, ok: 'Abschließen' }))) return;
  const w = {
    id: aw.id, dayId: aw.dayId, name: aw.name, startedAt: aw.startedAt, endedAt: Date.now(),
    exercises: aw.exercises.map((e) => ({ exerciseId: e.exerciseId, target: e.target, rest: e.rest, sets: e.sets.filter((s) => s.done).map(({ weight, reps, quality }) => ({ weight: weight || 0, reps: reps || 0, quality, done: true })) })).filter((e) => e.sets.length),
  };
  state.workouts.push(w);
  state.activeWorkout = null;
  closeSheet();
  save();
  openSummary(w.id, true);
}

/** Vergleicht ein Training mit allen Trainings davor. */
export function analyzeWorkout(w) {
  const before = state.workouts.filter((x) => x.startedAt < w.startedAt);
  const sets = sum(w.exercises, (e) => e.sets.length);
  const reps = sum(w.exercises, (e) => sum(e.sets, (s) => s.reps));
  const volume = sum(w.exercises, (e) => sum(e.sets, setVolume));
  const prevSame = [...before].reverse().find((x) => (w.dayId ? x.dayId === w.dayId : true));
  const prevVolume = prevSame ? sum(prevSame.exercises, (e) => sum(e.sets, setVolume)) : null;
  const prs = [];
  const exRows = w.exercises.map((e) => {
    const meta = exById(e.exerciseId);
    const name = meta?.name || 'Gelöschte Übung';
    const hist = exerciseHistory(e.exerciseId, before);
    const best = bestE10(e.sets, e10);
    const bestSet = e.sets.reduce((a, s) => (e10(s.weight, s.reps) > e10(a.weight, a.reps) ? s : a), e.sets[0]);
    const vol = sum(e.sets, setVolume);
    const row = { name, best, bestSet, vol, sets: e.sets, delta: null, first: !hist.length };
    if (hist.length) {
      const lastBest = bestE10(hist[hist.length - 1].sets, e10);
      row.delta = best - lastBest;
      const allBest = Math.max(...hist.map((h) => bestE10(h.sets, e10)));
      const allMaxW = Math.max(...hist.flatMap((h) => h.sets.map((s) => s.weight || 0)));
      const allVol = Math.max(...hist.map((h) => sum(h.sets, setVolume)));
      const maxW = Math.max(...e.sets.map((s) => s.weight || 0));
      if (best > allBest + 0.01) prs.push({ name, kind: '10RM-Rekord', text: `${kg(best)} (vorher ${kg(allBest)})` });
      if (maxW > allMaxW) prs.push({ name, kind: 'Höchstgewicht', text: `${kg(maxW)} (vorher ${kg(allMaxW)})` });
      if (vol > allVol && best <= allBest + 0.01) prs.push({ name, kind: 'Volumen-Rekord', text: `${fmt(vol)} kg (vorher ${fmt(allVol)} kg)` });
      // Bodyweight-Übungen: Wiederholungsrekord
      if (!maxW && !allMaxW) {
        const r = Math.max(...e.sets.map((s) => s.reps)), pr = Math.max(...hist.flatMap((h) => h.sets.map((s) => s.reps)));
        if (r > pr) prs.push({ name, kind: 'Wiederholungsrekord', text: `${r} Wdh (vorher ${pr})` });
      }
    }
    return row;
  });
  const improved = exRows.filter((r) => r.delta != null && r.delta > 0.01).length;
  const compared = exRows.filter((r) => r.delta != null).length;
  return { duration: w.endedAt - w.startedAt, sets, reps, volume, prevSame, prevVolume, prs, exRows, improved, compared, isFirst: !before.length };
}

function openSummary(id, fresh = false) {
  openSheet({
    id: 'wo-summary',
    render: () => {
      const w = state.workouts.find((x) => x.id === id);
      if (!w) return null;
      const a = analyzeWorkout(w);
      const volPct = a.prevVolume ? ((a.volume - a.prevVolume) / a.prevVolume) * 100 : null;
      return {
        title: fresh ? 'Zusammenfassung' : w.name,
        closeX: fresh,
        right: fresh ? '<span style="width:40px"></span>' : `<button class="icon-btn plain" data-act="wo-delete" data-id="${w.id}" aria-label="Löschen">${icon('trash')}</button>`,
        body: `
          <div class="summary-hero">
            <div class="trophy">${icon(a.prs.length ? 'trophy' : 'check')}</div>
            <h2>${fresh ? (a.prs.length ? 'Starkes Training!' : 'Training gespeichert') : esc(w.name)}</h2>
            <div class="muted small">${esc(w.name)} · ${fmtDay(dayKey(new Date(w.startedAt)), { long: true })}</div>
          </div>
          <div class="grid2">
            <div class="stat"><span class="lbl">Dauer</span><span class="mid-num">${fmtClock(a.duration)}</span></div>
            <div class="stat"><span class="lbl">Sätze</span><span class="mid-num">${a.sets}</span></div>
            <div class="stat"><span class="lbl">Wiederholungen</span><span class="mid-num">${a.reps}</span></div>
            <div class="stat"><span class="lbl">Volumen</span><span class="mid-num">${fmt(a.volume)} kg</span></div>
          </div>
          ${a.prevSame ? `<div class="card">
            <div class="card-head"><h3>Im Vergleich zum letzten Mal</h3><span class="small muted">${fmtDay(dayKey(new Date(a.prevSame.startedAt)))}</span></div>
            <div class="row between"><span class="muted">Volumen</span><span class="${volPct >= 0 ? 'up' : 'down'}" style="font-weight:600">${signed(a.volume - a.prevVolume)} kg (${signed(volPct, 1)} %)</span></div>
            <div class="row between"><span class="muted">Übungen gesteigert</span><span style="font-weight:600">${a.improved} von ${a.compared}</span></div>
          </div>` : `<div class="card flat"><div class="empty small">${a.isFirst ? 'Dein erstes Training – ab jetzt gibt es Vergleichswerte.' : 'Erstes Training dieses Tages – beim nächsten Mal siehst du hier den Vergleich.'}</div></div>`}
          ${a.prs.length ? `<h2 class="sec">Neue Rekorde</h2><div class="stack" style="gap:8px">${a.prs.map((p) => `
            <div class="pr">${icon('trophy')}<div class="grow"><div class="t">${esc(p.name)}</div><div class="small muted">${p.kind}: ${p.text}</div></div></div>`).join('')}</div>` : ''}
          <h2 class="sec">Übungen</h2>
          <div class="card" style="padding:4px 14px"><div class="list">
            ${a.exRows.map((r) => `<div class="li">
              <div class="grow"><div class="t ellipsis">${esc(r.name)}</div>
                <div class="s num">${r.sets.map((s) => `${fmtMax(s.weight, 2)}×${s.reps}${s.quality ? `<sup>${s.quality}</sup>` : ''}`).join(' · ')}</div></div>
              <div class="r"><div class="mid-num" style="font-size:17px;color:var(--train)">${fmtMax(r.best, 1)}</div>
                <div class="tiny ${r.delta > 0.01 ? 'up' : r.delta < -0.01 ? 'down' : 'faint'}">${r.first ? 'neu' : r.delta == null ? '' : `${signed(r.delta, 1)} kg`}</div></div>
            </div>`).join('')}
          </div></div>
          <p class="tiny faint" style="margin:0">10RM = geschätztes Gewicht für 10 saubere Wiederholungen (Epley-Formel). So sind Sätze mit unterschiedlichen Wiederholungszahlen vergleichbar.</p>`,
        foot: fresh ? '<button class="btn primary block lg" data-act="sheet-close">Fertig</button>' : '',
      };
    },
  });
}
onAct({
  'wo-detail': (el) => openSummary(el.dataset.id),
  'wo-delete': async (el) => {
    if (!(await confirmDialog({ title: 'Training löschen?', text: 'Das Training und seine Werte werden endgültig entfernt.', ok: 'Löschen', danger: true }))) return;
    state.workouts = state.workouts.filter((w) => w.id !== el.dataset.id);
    closeSheet();
    save();
  },
});

