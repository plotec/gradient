// Datenhaltung: ein JSON-Objekt im localStorage, plus abgeleitete Auswertungen.
import { uid, todayKey, addDays, sum, linreg, daysBetween, parseKey, e10rm, dayKey } from './utils.js';

const LEGACY_KEY = 'formkurve-v1';
let KEY = LEGACY_KEY;

const EXERCISES = [
  ['Bankdrücken', 'Brust', 'Langhantel'],
  ['Schrägbankdrücken (KH)', 'Brust', 'Kurzhantel'],
  ['Butterfly', 'Brust', 'Maschine'],
  ['Dips', 'Brust', 'Körpergewicht'],
  ['Klimmzüge', 'Rücken', 'Körpergewicht'],
  ['Latzug', 'Rücken', 'Kabel'],
  ['Langhantelrudern', 'Rücken', 'Langhantel'],
  ['Kabelrudern', 'Rücken', 'Kabel'],
  ['Kreuzheben', 'Rücken', 'Langhantel'],
  ['Schulterdrücken (KH)', 'Schultern', 'Kurzhantel'],
  ['Seitheben', 'Schultern', 'Kurzhantel'],
  ['Face Pulls', 'Schultern', 'Kabel'],
  ['Bizepscurls (KH)', 'Bizeps', 'Kurzhantel'],
  ['Hammercurls', 'Bizeps', 'Kurzhantel'],
  ['Trizepsdrücken am Kabel', 'Trizeps', 'Kabel'],
  ['French Press', 'Trizeps', 'SZ-Stange'],
  ['Kniebeuge', 'Beine', 'Langhantel'],
  ['Beinpresse', 'Beine', 'Maschine'],
  ['Rumänisches Kreuzheben', 'Beine', 'Langhantel'],
  ['Beinstrecker', 'Beine', 'Maschine'],
  ['Beinbeuger', 'Beine', 'Maschine'],
  ['Hip Thrust', 'Po', 'Langhantel'],
  ['Wadenheben', 'Waden', 'Maschine'],
  ['Crunches am Kabel', 'Bauch', 'Kabel'],
];
export const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Po', 'Waden', 'Bauch', 'Unterarme', 'Ganzkörper', 'Cardio'];
export const EQUIPMENT = ['Langhantel', 'Kurzhantel', 'SZ-Stange', 'Maschine', 'Kabel', 'Körpergewicht', 'Sonstiges'];

// Nährwerte je 100 g / 100 ml (Richtwerte).
const FOODS = [
  ['Haferflocken', 372, 13.5, 58.7, 7, 'g', [['1 Portion', 50]]],
  ['Magerquark', 67, 12, 4, 0.3, 'g', [['1 Becher', 500]]],
  ['Skyr natur', 63, 11, 4, 0.2, 'g', [['1 Becher', 450]]],
  ['Griechischer Joghurt 10 %', 133, 5, 4, 10, 'g', []],
  ['Ei (Größe M)', 155, 13, 1.1, 11, 'g', [['1 Stück', 60]]],
  ['Hähnchenbrust, roh', 110, 23.5, 0, 1.5, 'g', []],
  ['Rinderhack 5 %', 121, 21, 0, 5, 'g', []],
  ['Lachsfilet, roh', 202, 20, 0, 13.4, 'g', []],
  ['Thunfisch im eigenen Saft', 110, 25, 0, 1, 'g', [['1 Dose (Abtropf.)', 130]]],
  ['Basmatireis, roh', 351, 8, 77, 0.6, 'g', [['1 Portion', 80]]],
  ['Nudeln, roh', 356, 12.5, 71, 1.6, 'g', [['1 Portion', 100]]],
  ['Kartoffeln', 77, 2, 17, 0.1, 'g', []],
  ['Vollkornbrot', 216, 7, 39, 1.2, 'g', [['1 Scheibe', 50]]],
  ['Banane', 93, 1.1, 20, 0.2, 'g', [['1 Stück', 120]]],
  ['Apfel', 54, 0.3, 11.4, 0.4, 'g', [['1 Stück', 150]]],
  ['Heidelbeeren', 57, 0.7, 14.5, 0.3, 'g', []],
  ['Brokkoli', 34, 2.8, 4, 0.4, 'g', []],
  ['Avocado', 160, 2, 1.9, 14.7, 'g', [['1/2 Avocado', 75]]],
  ['Vollmilch 3,5 %', 64, 3.3, 4.8, 3.5, 'ml', [['1 Glas', 250]]],
  ['Whey Protein', 380, 78, 6, 5, 'g', [['1 Messlöffel', 30]]],
  ['Olivenöl', 884, 0, 0, 100, 'ml', [['1 EL', 10]]],
  ['Erdnussbutter', 600, 25, 14, 49, 'g', [['1 EL', 15]]],
  ['Mandeln', 600, 21, 7, 52, 'g', [['1 Handvoll', 25]]],
  ['Gouda', 356, 25, 0, 28, 'g', [['1 Scheibe', 25]]],
  ['Butter', 741, 0.7, 0.6, 83, 'g', [['1 TL', 5]]],
  // Erweiterte Grundliste (Richtwerte je 100 g / ml, bis die BLS-Datenbank importiert ist)
  ['Nudeln, gekocht', 150, 5.2, 29.5, 0.9, 'g', []],
  ['Reis, gekocht', 130, 2.7, 28.5, 0.3, 'g', []],
  ['Hackfleisch gemischt, roh', 248, 18.5, 0, 19.5, 'g', [['1 Packung', 500]]],
  ['Putenbrust, roh', 105, 24, 0, 1, 'g', []],
  ['Hähnchenschenkel ohne Haut, roh', 125, 19.5, 0, 5, 'g', []],
  ['Schweinefilet, roh', 109, 21.5, 0, 2.5, 'g', []],
  ['Bacon / Speck', 405, 14, 0.5, 38.5, 'g', [['1 Scheibe', 10]]],
  ['Salami', 380, 22, 0.5, 32, 'g', [['1 Scheibe', 8]]],
  ['Kochschinken', 115, 19, 1, 3.5, 'g', [['1 Scheibe', 20]]],
  ['Wiener Würstchen', 275, 13, 1, 24, 'g', [['1 Stück', 50]]],
  ['Bratwurst', 300, 14, 0.5, 27, 'g', [['1 Stück', 100]]],
  ['Lachs, geräuchert', 180, 22, 0, 10, 'g', []],
  ['Garnelen, roh', 80, 18, 0, 1, 'g', []],
  ['Crème fraîche 30 %', 292, 2.4, 2.6, 30, 'g', [['1 Becher', 200], ['1 EL', 15]]],
  ['Cremefine zum Kochen 15 %', 158, 2.8, 4.5, 15, 'ml', [['1 Packung', 200]]],
  ['Schlagsahne 30 %', 292, 2.4, 3.2, 30, 'ml', [['1 Becher', 200]]],
  ['Schmand 24 %', 240, 2.7, 3.5, 24, 'g', [['1 Becher', 200]]],
  ['Frischkäse Doppelrahm', 260, 5.5, 3, 25, 'g', [['1 Packung', 200]]],
  ['Körniger Frischkäse', 98, 12.5, 1.5, 4.5, 'g', [['1 Becher', 200]]],
  ['Mozzarella', 250, 18, 1, 19, 'g', [['1 Kugel', 125]]],
  ['Feta', 265, 17, 0.5, 21.5, 'g', [['1 Packung', 200]]],
  ['Parmesan', 400, 33, 0, 29, 'g', [['1 EL gerieben', 6]]],
  ['Reibekäse / Streukäse (Gouda gerieben)', 360, 25, 0.1, 28.5, 'g', [['1 Handvoll', 30], ['1 Packung', 200]]],
  ['Joghurt natur 3,5 %', 66, 3.8, 4.7, 3.5, 'g', [['1 Becher', 150]]],
  ['Hafermilch', 46, 0.8, 6.7, 1.5, 'ml', [['1 Glas', 250]]],
  ['Toastbrot', 260, 8, 48, 3.5, 'g', [['1 Scheibe', 25]]],
  ['Brötchen (Weizen)', 255, 8.5, 50, 1.5, 'g', [['1 Stück', 60]]],
  ['Weizen-Tortilla (Wrap)', 300, 8.5, 50, 7, 'g', [['1 Stück', 60]]],
  ['Reiswaffeln', 385, 8, 81, 3, 'g', [['1 Stück', 8]]],
  ['Pommes frites, zubereitet', 290, 3.5, 36, 14, 'g', []],
  ['Pizza Margherita (TK)', 230, 9, 30, 8, 'g', [['1 Pizza', 350]]],
  ['Kidneybohnen, abgetropft', 105, 8, 15, 0.5, 'g', [['1 Dose', 250]]],
  ['Mais, abgetropft', 85, 3, 15, 1.2, 'g', [['1 Dose', 140]]],
  ['Kichererbsen, abgetropft', 120, 7, 16, 2.5, 'g', [['1 Dose', 240]]],
  ['Linsen, roh', 320, 24, 49, 1.5, 'g', []],
  ['Tomaten, passiert', 32, 1.5, 5.5, 0.2, 'g', [['1 Packung', 500]]],
  ['Tomate', 18, 1, 2.9, 0.2, 'g', [['1 Stück', 80]]],
  ['Gurke', 12, 0.6, 1.8, 0.2, 'g', []],
  ['Paprika', 30, 1, 5, 0.3, 'g', [['1 Stück', 150]]],
  ['Zwiebel', 32, 1.2, 6, 0.2, 'g', [['1 Stück', 80]]],
  ['Möhre / Karotte', 36, 0.9, 7, 0.2, 'g', [['1 Stück', 80]]],
  ['Champignons', 22, 3, 1, 0.3, 'g', []],
  ['Spinat', 23, 2.5, 1, 0.4, 'g', []],
  ['Salat (Eisberg)', 14, 1, 1.6, 0.2, 'g', []],
  ['Erdbeeren', 33, 0.7, 6, 0.4, 'g', []],
  ['Weintrauben', 70, 0.7, 16, 0.3, 'g', []],
  ['Orange', 47, 1, 9, 0.2, 'g', [['1 Stück', 150]]],
  ['Orangensaft', 45, 0.7, 9, 0.2, 'ml', [['1 Glas', 250]]],
  ['Cola', 42, 0, 10.6, 0, 'ml', [['1 Dose', 330], ['1 Flasche', 500]]],
  ['Cola Zero', 0.3, 0, 0, 0, 'ml', [['1 Dose', 330]]],
  ['Bier (Pils)', 42, 0.5, 3, 0, 'ml', [['1 Flasche', 500], ['1 Glas', 300]]],
  ['Rotwein', 85, 0.1, 2.5, 0, 'ml', [['1 Glas', 200]]],
  ['Honig', 305, 0.4, 76, 0, 'g', [['1 TL', 8]]],
  ['Zucker', 400, 0, 100, 0, 'g', [['1 TL', 5]]],
  ['Nuss-Nougat-Creme', 540, 6, 57, 31, 'g', [['1 Portion', 15]]],
  ['Vollmilchschokolade', 535, 7.5, 56, 31, 'g', [['1 Riegel/Reihe', 25]]],
  ['Gummibärchen', 345, 7, 77, 0.2, 'g', [['1 Handvoll', 30]]],
  ['Kartoffelchips', 535, 6, 50, 34, 'g', [['1 Handvoll', 25]]],
  ['Eiscreme (Vanille)', 200, 3.5, 24, 10, 'g', [['1 Kugel', 60]]],
  ['Proteinriegel', 360, 33, 35, 12, 'g', [['1 Riegel', 60]]],
  ['Ketchup', 105, 1.5, 23, 0.2, 'g', [['1 EL', 15]]],
  ['Mayonnaise', 680, 1.5, 1.5, 75, 'g', [['1 EL', 15]]],
  ['Pesto Basilikum', 480, 5, 6, 48, 'g', [['1 EL', 15]]],
  ['Rapsöl', 884, 0, 0, 100, 'ml', [['1 EL', 10]]],
  ['Weizenmehl Type 405', 345, 10, 72, 1, 'g', []],
];

function defaults({ seed = false } = {}) {
  const exercises = !seed ? [] : EXERCISES.map(([name, muscle, equipment]) => ({ id: uid(), name, muscle, equipment, note: '', rest: null }));
  const ex = (n) => exercises.find((e) => e.name === n)?.id;
  const item = (n, sets = 3, reps = '8–12') => ({ exerciseId: ex(n), sets, reps, rest: null });
  return {
    version: 1,
    settings: {
      mealNames: ['Frühstück', 'Mittagessen', 'Nachmittag', 'Abendessen', 'Snacks'],
      goals: { kcal: 2500, protein: 180, carbs: 260, fat: 80 },
      restDefault: 120,
      lockRest: true,
      weeklyRate: -0.5, // veraltet, siehe goal
      // Ziel: über Gewicht pro Woche oder Kalorienbilanz pro Tag
      goal: { mode: 'rate', rate: -0.5, balance: -300, targetWeight: null, auto: false, tdeeManual: null, lastAuto: null },
      tdeeWindow: 28,
      theme: 'auto',
      // Erfolgskästchen
      trackingStart: todayKey(),
      nutritionTolerance: 15,
      nutritionChecks: { kcal: true, protein: true, carbs: true, fat: true },
      // Trainingsrhythmus: wiederholte Abfolge aus Trainingstag-IDs und null (= Pause) ab Startdatum
      schedule: { start: todayKey(), slots: [] },
    },
    exercises,
    workoutDays: !seed ? [] : [
      { id: uid(), name: 'Push', items: [item('Bankdrücken'), item('Schrägbankdrücken (KH)'), item('Schulterdrücken (KH)'), item('Seitheben', 3, '12–15'), item('Trizepsdrücken am Kabel')] },
      { id: uid(), name: 'Pull', items: [item('Klimmzüge'), item('Langhantelrudern'), item('Latzug'), item('Face Pulls', 3, '12–15'), item('Bizepscurls (KH)')] },
      { id: uid(), name: 'Beine', items: [item('Kniebeuge', 3, '6–10'), item('Rumänisches Kreuzheben'), item('Beinpresse'), item('Beinbeuger'), item('Wadenheben', 3, '10–15')] },
    ],
    activeWorkout: null,
    workouts: [],
    foods: FOODS.map(([name, kcal, protein, carbs, fat, unit, servings]) => ({
      id: uid(), name, brand: '', kcal, protein, carbs, fat, unit, barcode: '', source: 'basis',
      servings: servings.map(([n, g]) => ({ name: n, grams: g })),
    })),
    meals: [],
    recentFoods: [],
    diary: {},
    weights: {},
    habits: [
      { id: 'h-kreatin', name: 'Kreatin', color: '#c3a6ff', supplement: true },
      { id: 'h-vitd', name: 'Vitamin D3/K2', color: '#f2e3a0', supplement: true },
      { id: 'h-omega', name: 'Omega 3', color: '#8ec5ff', supplement: true },
      { id: 'h-water', name: '3 Liter Wasser', color: '#7fd6b4', supplement: false },
    ],
    habitLog: {},
  };
}

function migrate(s) {
  const d = defaults();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  const hadStart = s.settings?.trackingStart;
  s.settings = {
    ...d.settings, ...s.settings,
    goals: { ...d.settings.goals, ...(s.settings?.goals || {}) },
    nutritionChecks: { ...d.settings.nutritionChecks, ...(s.settings?.nutritionChecks || {}) },
    schedule: { ...d.settings.schedule, ...(s.settings?.schedule || {}) },
    goal: { ...d.settings.goal, ...(s.settings?.goal || { rate: s.settings?.weeklyRate ?? -0.5 }) },
  };
  // Beginn der Auswertung = frühester Eintrag (für ältere Datenstände)
  if (!hadStart) {
    const keys = [...Object.keys(s.diary || {}), ...Object.keys(s.weights || {}), ...Object.keys(s.habitLog || {}),
      ...(s.workouts || []).map((w) => { const x = new Date(w.startedAt); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })].sort();
    if (keys[0]) s.settings.trackingStart = keys[0];
  }
  const SUPP = ['h-kreatin', 'h-vitd', 'h-omega'];
  for (const h of s.habits) if (h.supplement === undefined) h.supplement = SUPP.includes(h.id) || /kreatin|creatin|vitamin|omega|magnesium|zink|supplement|protein|ashwa|eisen/i.test(h.name);
  if (!s._repsRepair) {
    const changes = repairConcatReps(s);
    s._repsRepair = { at: Date.now(), changes, notice: changes.length > 0 };
  }
  if (!s._limbsSync) {
    // Einmalig: Pauls Limbs-Tag aus dem letzten Limbs-Training ergänzen.
    const day = s.workoutDays.find((d) => /limbs|libms/i.test(d.name));
    const last = day && [...s.workouts].filter((w) => w.dayId === day.id).sort((a, b) => b.startedAt - a.startedAt)[0];
    s._limbsSync = { at: Date.now(), day: day?.name || null, added: last ? mergeWorkoutIntoDay(day, last) : [], found: !!last, notice: !!day };
  }
  return s;
}

/** Übungen eines Trainings, die im Trainingstag fehlen, in der Reihenfolge des Trainings ergänzen. */
export function mergeWorkoutIntoDay(day, w) {
  const have = new Set(day.items.map((i) => i.exerciseId));
  const added = [];
  const items = w.exercises.map((e) => {
    const known = day.items.find((i) => i.exerciseId === e.exerciseId);
    if (known) return known;
    added.push(e.exerciseId);
    return { exerciseId: e.exerciseId, sets: e.sets.length || 3, reps: e.target || '8–12', rest: e.rest ?? null };
  });
  if (!added.length) return added;
  const inWorkout = new Set(w.exercises.map((e) => e.exerciseId));
  day.items = [...items, ...day.items.filter((i) => have.has(i.exerciseId) && !inWorkout.has(i.exerciseId))];
  return added;
}

/**
 * Das Wiederholungsfeld behielt beim Tippen den vorbelegten Wert: aus 8 + 9 wurde 89, aus 10 + 11 wurde 1011.
 * Richtig ist nur die hintere Zahl. Vorbelegt war der Wert vom letzten Mal oder aus dem Satz davor.
 */
function fixedReps(r, prefills) {
  const txt = String(r);
  for (const p of prefills) {
    if (!(p > 0)) continue;
    const ps = String(p);
    if (r > 20 && txt.length > ps.length && txt.startsWith(ps)) {
      const rest = +txt.slice(ps.length);
      if (rest >= 1 && rest <= 40) return rest;
    }
  }
  if (r < 50) return null; // ohne passenden Vorwert nur eindeutig unmögliche Zahlen anfassen
  const two = +txt.slice(-2), one = +txt.slice(-1);
  if (txt.length >= 3 && two >= 1 && two <= 40) return two;
  return one >= 1 ? one : null;
}
export function repairConcatReps(s) {
  const changes = [];
  const lastRaw = {}, lastFixed = {};
  const fixExercise = (e, wid) => {
    const raw = e.sets.map((x) => x.reps);
    e.sets.forEach((x, j) => {
      const r = x.reps;
      const at = (a) => (a?.length ? a[Math.min(j, a.length - 1)] : null);
      const prefills = [at(lastRaw[e.exerciseId]), at(lastFixed[e.exerciseId]), j ? raw[j - 1] : null, j ? e.sets[j - 1].reps : null];
      const to = r ? fixedReps(r, prefills) : null;
      if (to != null && to !== r) { x.reps = to; changes.push({ w: wid, ex: e.exerciseId, j, from: r, to }); }
    });
    lastRaw[e.exerciseId] = raw;
    lastFixed[e.exerciseId] = e.sets.map((x) => x.reps);
  };
  [...(s.workouts || [])].sort((a, b) => a.startedAt - b.startedAt).forEach((w) => w.exercises.forEach((e) => fixExercise(e, w.id)));
  s.activeWorkout?.exercises.forEach((e) => fixExercise(e, s.activeWorkout.id));
  return changes;
}
/** Korrektur zurücknehmen. */
export function undoRepsRepair() {
  for (const c of state._repsRepair?.changes || []) {
    const w = state.workouts.find((x) => x.id === c.w) || (state.activeWorkout?.id === c.w ? state.activeWorkout : null);
    const set = w?.exercises.find((e) => e.exerciseId === c.ex)?.sets[c.j];
    if (set && set.reps === c.to) set.reps = c.from;
  }
  state._repsRepair.changes = [];
  state._repsRepair.notice = false;
  save();
}

export let state = defaults();
let storageOk = true;
let persistHook = null;
/** Wird nach jedem lokalen Speichern aufgerufen (Cloud-Sync). */
export const setPersistHook = (fn) => { persistHook = fn; };

/** Daten eines Accounts laden. key = Speicherplatz für diesen Account. */
export function initStore(accountKey, { adoptLegacy = false } = {}) {
  KEY = `formkurve-v1:${accountKey}`;
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (!raw && adoptLegacy) {
    // Daten aus der Zeit vor den Accounts übernehmen
    try { raw = localStorage.getItem(LEGACY_KEY); if (raw) localStorage.removeItem(LEGACY_KEY); } catch {}
  }
  state = raw ? migrate(JSON.parse(raw)) : defaults();
  ready = true;
  persist();
  listeners.forEach((fn) => fn());
}
export const hasLegacyData = () => { try { return !!localStorage.getItem(LEGACY_KEY); } catch { return false; } };

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);

let saveTimer;
export function save({ silent = false } = {}) {
  state._modifiedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 150);
  if (!silent) listeners.forEach((fn) => fn());
}
let ready = false; // erst nach dem Login speichern
function persist() {
  if (!ready) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e) { storageOk = false; console.warn('Speichern fehlgeschlagen', e); }
  persistHook?.(state);
}
export const storageWorks = () => storageOk;
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

export function replaceState(next, { fromCloud = false } = {}) {
  state = migrate(next);
  if (!fromCloud) state._modifiedAt = Date.now();
  persist();
  listeners.forEach((fn) => fn());
}
export function resetAll() { replaceState(defaults()); }
/** Speicherplatz eines Accounts auf diesem Gerät löschen (nach Abmelden nicht nötig). */
export const flush = () => { clearTimeout(saveTimer); persist(); };

// ---------- Nachschlagen ----------
export const exById = (id) => state.exercises.find((e) => e.id === id);
export const foodById = (id) => state.foods.find((f) => f.id === id);
export const dayById = (id) => state.workoutDays.find((d) => d.id === id);

// ---------- Ernährung ----------
export function dayDiary(key) {
  return state.diary[key] || { entries: [] };
}
export function ensureDiary(key) {
  return (state.diary[key] ||= { entries: [] });
}
/** Nährwerte eines Tagebucheintrags (per100 × Menge). */
export function entryNut(e) {
  const f = e.amount / 100;
  return { kcal: e.per100.kcal * f, protein: e.per100.protein * f, carbs: e.per100.carbs * f, fat: e.per100.fat * f };
}
export function totals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    const n = entryNut(e);
    t.kcal += n.kcal; t.protein += n.protein; t.carbs += n.carbs; t.fat += n.fat;
  }
  return t;
}
export function dayKcal(key) {
  const d = state.diary[key];
  return d && d.entries.length ? totals(d.entries).kcal : 0;
}
export function foodPer100(food) {
  return { kcal: +food.kcal || 0, protein: +food.protein || 0, carbs: +food.carbs || 0, fat: +food.fat || 0 };
}
export function makeEntry(food, amount, meal) {
  return {
    id: uid(), meal, foodId: food.id || null, name: food.name, brand: food.brand || '',
    unit: food.unit || 'g', amount, per100: foodPer100(food), servingName: null,
  };
}
export function touchRecent(foodId) {
  if (!foodId) return;
  state.recentFoods = [foodId, ...state.recentFoods.filter((x) => x !== foodId)].slice(0, 40);
}
export function mealTotals(meal) {
  return totals(meal.items.map((it) => {
    const f = foodById(it.foodId);
    return f ? { amount: it.amount, per100: foodPer100(f) } : { amount: 0, per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
  }));
}

// ---------- Gewicht ----------
export function weightSeries() {
  return Object.keys(state.weights).sort().map((k) => ({ key: k, w: state.weights[k] }));
}
/** Geglätteter Trend (EMA, Glättung 0,1 wie beim "Hacker's Diet"). */
export function weightTrend() {
  const s = weightSeries();
  const out = [];
  let t = null, prevKey = null;
  for (const p of s) {
    if (t == null) t = p.w;
    else {
      // Lücken: Glättung pro vergangenem Tag anwenden
      const gap = Math.max(1, daysBetween(prevKey, p.key));
      const a = 1 - Math.pow(0.9, gap);
      t = t + a * (p.w - t);
    }
    prevKey = p.key;
    out.push({ key: p.key, w: p.w, trend: t });
  }
  return out;
}
export function latestWeight() {
  const s = weightTrend();
  return s.length ? s[s.length - 1] : null;
}

// ---------- Training ----------
export function setVolume(s) { return (s.weight || 0) * (s.reps || 0); }
export function doneSets(ex) { return ex.sets.filter((s) => s.done); }

/** Alle abgeschlossenen Einheiten einer Übung, älteste zuerst. */
export function exerciseHistory(exId, workouts = state.workouts) {
  const out = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exId) continue;
      const sets = doneSets(ex);
      if (sets.length) out.push({ workoutId: w.id, date: w.startedAt, sets });
    }
  }
  return out.sort((a, b) => a.date - b.date);
}
export function bestE10(sets, e10) {
  return Math.max(0, ...sets.map((s) => e10(s.weight, s.reps)));
}
export function lastSetsFor(exId) {
  const h = exerciseHistory(exId);
  return h.length ? h[h.length - 1].sets : null;
}
/** Letzte Einheit einer Übung inkl. Datum und Tagesnotiz. */
export function lastSessionFor(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i];
    const ex = w.exercises.find((e) => e.exerciseId === exId && e.sets.some((s) => s.done));
    if (ex) return { date: w.startedAt, sets: ex.sets.filter((s) => s.done), note: ex.note || '' };
  }
  return null;
}

/** Kraftwert einer Einheit: bestes geschätztes 10RM, bei Körpergewicht die meisten Wiederholungen. */
export function sessionStrength(sets) {
  const best = Math.max(0, ...sets.map((s) => e10rm(s.weight || 0, s.reps || 0)));
  return best > 0 ? best : Math.max(0, ...sets.map((s) => s.reps || 0));
}

/**
 * Kraftindex über alle Übungen (Start = 100).
 * Jede Einheit wird mit der vorherigen Einheit derselben Übung verglichen; pro Woche wird der
 * Durchschnitt dieser Veränderungen gebildet und aufmultipliziert. So zählen neue Übungen erst
 * ab ihrem zweiten Training mit und unterschiedliche Gewichtsklassen gleichen sich aus.
 */
export function strengthIndex() {
  const ws = [...state.workouts].sort((a, b) => a.startedAt - b.startedAt);
  if (!ws.length) return [];
  const last = {};
  const weeks = new Map(); // Wochenstart -> [log-Veränderungen]
  const weekOf = (ts) => { const k = dayKey(new Date(ts)); const d = parseKey(k); return addDays(k, -((d.getDay() + 6) % 7)); };
  for (const w of ws) {
    const wk = weekOf(w.startedAt);
    if (!weeks.has(wk)) weeks.set(wk, []);
    for (const ex of w.exercises) {
      const sets = ex.sets.filter((s) => s.done);
      if (!sets.length) continue;
      const v = sessionStrength(sets);
      const prev = last[ex.exerciseId];
      if (prev > 0 && v > 0) weeks.get(wk).push(Math.max(-0.25, Math.min(0.25, Math.log(v / prev))));
      if (v > 0) last[ex.exerciseId] = v;
    }
  }
  const out = [];
  let idx = 100;
  let wk = weekOf(ws[0].startedAt);
  const end = weekOf(Date.now());
  while (wk <= end) {
    const ch = weeks.get(wk);
    if (ch?.length) idx *= Math.exp(ch.reduce((a, b) => a + b, 0) / ch.length);
    out.push({ key: wk, value: idx, sessions: ch?.length || 0 });
    wk = addDays(wk, 7);
  }
  return out;
}
export function workoutDayKeys() {
  const set = new Set();
  for (const w of state.workouts) {
    const d = new Date(w.startedAt);
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return set;
}

// ---------- Kalorienverbrauch (TDEE) ----------
/**
 * Adaptiver TDEE: Ø Kalorienzufuhr im Zeitfenster minus Energie der
 * Gewichtsänderung (Steigung der linearen Regression × 7700 kcal/kg).
 * Heute wird ausgelassen, weil der Tag noch nicht fertig geloggt ist.
 */
export function computeTdee(windowDays = state.settings.tdeeWindow) {
  const end = addDays(todayKey(), -1);
  const start = addDays(end, -(windowDays - 1));
  const intake = [];
  const weights = [];
  for (let i = 0; i < windowDays; i++) {
    const k = addDays(start, i);
    const kc = dayKcal(k);
    if (kc > 0) intake.push(kc);
    if (state.weights[k] != null) weights.push({ x: i, y: state.weights[k] });
  }
  // Gewicht von heute darf mitzählen (Morgengewicht = Stand nach gestern)
  const tk = todayKey();
  if (state.weights[tk] != null) weights.push({ x: windowDays, y: state.weights[tk] });

  const res = {
    windowDays, start, end,
    loggedDays: intake.length, weighDays: weights.length,
    avgIntake: intake.length ? sum(intake) / intake.length : null,
    slopePerWeek: null, tdee: null, quality: 'none',
  };
  const reg = linreg(weights);
  if (reg && weights.length >= 3) res.slopePerWeek = reg.slope * 7;
  if (res.avgIntake != null && res.slopePerWeek != null && intake.length >= 5) {
    res.tdee = res.avgIntake - (res.slopePerWeek / 7) * 7700;
    const cov = Math.min(intake.length, weights.length) / windowDays;
    res.quality = cov >= 0.8 ? 'gut' : cov >= 0.5 ? 'mittel' : 'gering';
  }
  return res;
}

// ---------- Beispieldaten ----------
export function demoData() {
  const s = defaults({ seed: true });
  const today = todayKey();
  const N = 150;
  const rnd = mulberry(7);
  const foods = s.foods;
  const pick = (n) => foods.find((f) => f.name.startsWith(n));
  const add = (key, meal, food, g) => ((s.diary[key] ||= { entries: [] }).entries.push(makeEntry(food, g, meal)));
  let w = 87.4;
  const days = s.workoutDays;
  let dayIdx = 0;
  const base = {}; // Arbeitsgewicht je Übung
  s.settings.trackingStart = addDays(today, -N);
  s.settings.schedule = { start: addDays(today, -N), slots: [days[0].id, days[1].id, days[2].id, null] };
  s.settings.goals = { kcal: 2350, protein: 185, carbs: 270, fat: 55 };
  for (let i = N; i >= 1; i--) {
    const key = addDays(today, -i);
    w += -0.045 + (rnd() - 0.5) * 0.05;
    if (rnd() < 0.9) s.weights[key] = Math.round((w + (rnd() - 0.5) * 0.9) * 10) / 10;
    if (rnd() < 0.88) {
      add(key, 0, pick('Haferflocken'), 70 + Math.round(rnd() * 30));
      add(key, 0, pick('Whey'), 30);
      add(key, 0, pick('Heidelbeeren'), 100);
      add(key, 1, pick('Basmati'), 90 + Math.round(rnd() * 40));
      add(key, 1, pick('Hähnchen'), 200);
      add(key, 1, pick('Brokkoli'), 200);
      add(key, 2, pick('Skyr'), 250 + Math.round(rnd() * 200));
      add(key, 2, pick('Banane'), 120);
      add(key, 3, pick(rnd() < 0.5 ? 'Lachs' : 'Rinderhack'), 180);
      add(key, 3, pick('Kartoffeln'), 300 + Math.round(rnd() * 150));
      add(key, 3, pick('Olivenöl'), 10);
      if (rnd() < 0.6) add(key, 4, pick('Mandeln'), 25 + Math.round(rnd() * 25));
      if (rnd() < 0.3) add(key, 4, pick('Vollkornbrot'), 100);
    }
    const allSupp = rnd() < 0.82;
    const habits = s.habits.filter((h) => (h.supplement && allSupp) || rnd() < 0.75).map((h) => h.id);
    if (habits.length) s.habitLog[key] = habits;
    const slot = s.settings.schedule.slots[(N - i) % s.settings.schedule.slots.length];
    if (slot && rnd() < 0.88) {
      const day = days.find((x) => x.id === slot);
      void dayIdx;
      const startH = 17 + Math.floor(rnd() * 3);
      const d = parseKey(key);
      d.setHours(startH, Math.floor(rnd() * 60));
      const startedAt = d.getTime();
      const exercises = day.items.map((it) => {
        const ex = s.exercises.find((e) => e.id === it.exerciseId);
        const isBw = ex.equipment === 'Körpergewicht';
        base[ex.id] ??= isBw ? 0 : ({ Bankdrücken: 70, Kniebeuge: 85, Langhantelrudern: 60, Beinpresse: 140, Latzug: 55 }[ex.name] || 20);
        if (rnd() < 0.25) base[ex.id] += isBw ? 0 : (base[ex.id] > 40 ? 2.5 : 1);
        return {
          exerciseId: ex.id, target: it.reps, rest: it.rest,
          sets: Array.from({ length: it.sets }, (_, j) => ({
            weight: base[ex.id], reps: Math.max(4, 10 - j - Math.floor(rnd() * 3)), quality: 6 + Math.floor(rnd() * 4), done: true,
          })),
        };
      });
      s.workouts.push({ id: uid(), dayId: day.id, name: day.name, startedAt, endedAt: startedAt + (55 + rnd() * 30) * 60000, exercises });
    }
  }
  return s;
}
function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- Makros: Ausgleich immer über Kohlenhydrate ----------
/** Kohlenhydrate füllen, was Kalorien minus Eiweiß und Fett übrig lassen. */
export function fillCarbs(d) {
  d.carbs = Math.max(0, Math.round((d.kcal - d.protein * 4 - d.fat * 9) / 4));
}
/** Änderung eines Werts; die Kohlenhydrate gleichen aus (bei Kohlenhydraten: Eiweiß und Fett anteilig). */
export function adjustMacro(d, key, value) {
  value = Math.max(0, Math.round(value || 0));
  if (key === 'kcal') { d.kcal = value; fillCarbs(d); return d; }
  if (key === 'carbs') {
    d.carbs = Math.min(value, Math.floor(d.kcal / 4));
    const rest = d.kcal - d.carbs * 4;
    const pf = d.protein * 4 + d.fat * 9;
    const f = pf > 0 ? rest / pf : 0;
    d.protein = Math.max(0, Math.round(d.protein * f));
    d.fat = Math.max(0, Math.round(d.fat * f));
    fillCarbs(d);
    return d;
  }
  const other = key === 'protein' ? d.fat * 9 : d.protein * 4;
  const per = key === 'protein' ? 4 : 9;
  d[key] = Math.min(value, Math.floor((d.kcal - other) / per)); // höchstens so viel, dass KH bei 0 landen
  fillCarbs(d);
  return d;
}

