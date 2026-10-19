// Datenhaltung: ein JSON-Objekt im localStorage, plus abgeleitete Auswertungen.
import { uid, todayKey, addDays, sum, linreg, daysBetween, parseKey } from './utils.js';

const KEY = 'formkurve-v1';

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
];

function defaults() {
  const exercises = EXERCISES.map(([name, muscle, equipment]) => ({ id: uid(), name, muscle, equipment, note: '', rest: null }));
  const ex = (n) => exercises.find((e) => e.name === n).id;
  const item = (n, sets = 3, reps = '8–12') => ({ exerciseId: ex(n), sets, reps, rest: null });
  return {
    version: 1,
    settings: {
      mealNames: ['Frühstück', 'Mittagessen', 'Nachmittag', 'Abendessen', 'Snacks'],
      goals: { kcal: 2500, protein: 180, carbs: 260, fat: 80 },
      restDefault: 120,
      weeklyRate: -0.5,
      tdeeWindow: 28,
      theme: 'auto',
    },
    exercises,
    workoutDays: [
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
      { id: 'h-kreatin', name: 'Kreatin', color: '#a78bfa' },
      { id: 'h-vitd', name: 'Vitamin D3/K2', color: '#ffc145' },
      { id: 'h-omega', name: 'Omega 3', color: '#5ad1e6' },
      { id: 'h-water', name: '3 Liter Wasser', color: '#3d8bff' },
    ],
    habitLog: {},
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Laden fehlgeschlagen', e); }
  return defaults();
}

function migrate(s) {
  const d = defaults();
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  s.settings = { ...d.settings, ...s.settings, goals: { ...d.settings.goals, ...(s.settings?.goals || {}) } };
  return s;
}

export let state = load();
let storageOk = true;

const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);

let saveTimer;
export function save({ silent = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 150);
  if (!silent) listeners.forEach((fn) => fn());
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e) { storageOk = false; console.warn('Speichern fehlgeschlagen', e); }
}
export const storageWorks = () => storageOk;
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

export function replaceState(next) {
  state = migrate(next);
  persist();
  listeners.forEach((fn) => fn());
}
export function resetAll() { replaceState(defaults()); }

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
  const s = defaults();
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
    const habits = s.habits.filter(() => rnd() < 0.8).map((h) => h.id);
    if (habits.length) s.habitLog[key] = habits;
    const wd = parseKey(key).getDay();
    if ([1, 2, 4, 5].includes(wd) && rnd() < 0.9) {
      const day = days[dayIdx++ % days.length];
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
