// Erfolgskästchen: Was war an einem Tag fällig, was wurde geschafft?
import { state, dayDiary, totals, workoutDayKeys, dayById } from './store.js';
import { todayKey, daysBetween, addDays } from './utils.js';

/** Geplanter Slot für ein Datum: Trainingstag-Objekt, 'rest' oder null (kein Rhythmus). */
export function plannedFor(key) {
  const { start, slots } = state.settings.schedule;
  if (!slots.length || !start || key < start) return null;
  const idx = ((daysBetween(start, key) % slots.length) + slots.length) % slots.length;
  const id = slots[idx];
  if (id == null) return 'rest';
  return dayById(id) || 'rest';
}

/** Kalorien/Makros im Zielbereich (± Toleranz)? */
export function nutritionCheck(key) {
  const t = totals(dayDiary(key).entries);
  if (t.kcal <= 0) return { logged: false, ok: false, parts: [] };
  const tol = (state.settings.nutritionTolerance ?? 15) / 100;
  const g = state.settings.goals;
  const checks = state.settings.nutritionChecks;
  const parts = [['kcal', 'Kalorien'], ['protein', 'Eiweiß'], ['carbs', 'Kohlenhydrate'], ['fat', 'Fett']]
    .filter(([k]) => checks[k] && g[k] > 0)
    .map(([k, label]) => {
      const lo = g[k] * (1 - tol), hi = g[k] * (1 + tol);
      return { key: k, label, value: t[k], lo, hi, ok: t[k] >= lo && t[k] <= hi };
    });
  return { logged: true, ok: parts.every((p) => p.ok), parts };
}

export const supplementHabits = () => state.habits.filter((h) => h.supplement);
export const otherHabits = () => state.habits.filter((h) => !h.supplement);

let wdCache = null, wdStamp = null;
function trainedDays() {
  // kleiner Cache, damit 365 × n Abfragen schnell bleiben
  const stamp = state.workouts.length + ':' + (state.workouts[state.workouts.length - 1]?.id || '');
  if (stamp !== wdStamp) { wdCache = workoutDayKeys(); wdStamp = stamp; }
  return wdCache;
}

/**
 * Status je Kategorie für einen Tag.
 * due: zählt für die Quote · done: geschafft
 * Heute zählt nur, wenn schon geschafft (der Tag ist noch nicht vorbei).
 */
export function dayStatus(key) {
  const today = todayKey();
  const tracked = key >= state.settings.trackingStart && key <= today;
  const pending = key === today;
  const habitsDone = new Set(state.habitLog[key] || []);
  const mk = (due, done) => ({ due: tracked && due && (!pending || done), done: tracked && done, rest: tracked && !due });

  const plan = plannedFor(key);
  const trained = trainedDays().has(key);
  const training = mk(plan !== null && plan !== 'rest', trained);
  training.rest = tracked && (plan === 'rest' || plan === null);
  training.unplanned = plan === null;

  const nutrition = mk(true, nutritionCheck(key).ok);
  const weight = mk(true, state.weights[key] != null);
  const supps = supplementHabits();
  const supplements = mk(supps.length > 0, supps.length > 0 && supps.every((h) => habitsDone.has(h.id)));
  const habits = otherHabits().map((h) => ({ id: h.id, ...mk(true, habitsDone.has(h.id)) }));

  const cats = [training, nutrition, weight, supplements, ...habits];
  const dueCats = tracked ? cats.filter((c) => c.due || (pending && !c.rest)) : [];
  const doneCount = dueCats.filter((c) => c.done).length;
  const overall = {
    due: tracked && (!pending || (dueCats.length > 0 && doneCount === dueCats.length)),
    done: tracked && dueCats.length > 0 && doneCount === dueCats.length,
    frac: dueCats.length ? doneCount / dueCats.length : 0,
    doneCount, dueCount: dueCats.length,
  };
  return { key, tracked, pending, training, nutrition, weight, supplements, habits, overall };
}

/** Quote für einen Zeitraum: [{ due, done }] -> Prozent oder null. */
export function rate(statuses) {
  const due = statuses.filter((s) => s.due);
  if (!due.length) return null;
  return Math.round((due.filter((s) => s.done).length / due.length) * 100);
}

/** Alle Status eines Jahres (Cache pro Render). */
export function yearStatuses(year) {
  const out = [];
  let k = `${year}-01-01`;
  const end = `${year}-12-31`;
  while (k <= end) { out.push(dayStatus(k)); k = addDays(k, 1); }
  return out;
}
