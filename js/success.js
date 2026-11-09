// Erfolgskästchen: Was war an einem Tag fällig, was wurde geschafft?
import { state, dayDiary, totals, workoutDayKeys, dayById } from './store.js';
import { todayKey, daysBetween, addDays, dayKey } from './utils.js';

// Abfolge statt Kalender: Nur die Reihenfolge zählt. Das letzte Training bestimmt, was als Nächstes
// dran ist; „Pause“ in der Abfolge heißt: nach dem Training davor so viele Ruhetage.
let seqCache = null, seqStamp = null;
/** Je Trainingstag (chronologisch) das Training aus der Abfolge und die Position danach. */
function seqTimeline() {
  const slots = state.settings.schedule.slots;
  const stamp = slots.join() + '|' + state.workouts.length + ':' + (state.workouts[state.workouts.length - 1]?.id || '');
  if (stamp === seqStamp) return seqCache;
  const n = slots.length, out = [];
  let p = 0;
  for (const w of [...state.workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    if (!w.dayId) continue; // freies Training verschiebt die Abfolge nicht
    let j = -1;
    for (let r = 0; r < n; r++) if (slots[(p + r) % n] === w.dayId) { j = (p + r) % n; break; }
    if (j < 0) continue; // Trainingstag steht nicht in der Abfolge
    p = (j + 1) % n;
    const e = { key: dayKey(new Date(w.startedAt)), day: w.dayId, p };
    if (out.length && out[out.length - 1].key === e.key) out[out.length - 1] = e; else out.push(e);
  }
  seqStamp = stamp; seqCache = out;
  return out;
}

/** Ab Position p, gap Tage nach dem letzten Training: Index des fälligen Trainings oder -1 (Pause). */
function dueAt(p, gap) {
  const slots = state.settings.schedule.slots, n = slots.length;
  let r = 0;
  while (r < n && slots[(p + r) % n] == null) r++;
  return r === n || gap <= r ? -1 : (p + r) % n;
}

/** Stand vor einem Tag: letzter Eintrag der Abfolge vor key (oder am Tag selbst). */
function lastBefore(key, inclusive) {
  const tl = seqTimeline();
  for (let i = tl.length - 1; i >= 0; i--) if (inclusive ? tl[i].key <= key : tl[i].key < key) return tl[i];
  return null;
}

/** Geplanter Slot für ein Datum: Trainingstag-Objekt, 'rest' oder null (keine Abfolge). */
export function plannedFor(key) {
  const slots = state.settings.schedule.slots;
  if (!slots.length) return null;
  const today = todayKey();
  const dayOf = (i) => (i < 0 ? 'rest' : dayById(slots[i]) || 'rest');
  if (key <= today) {
    const last = lastBefore(key, true);
    if (last?.key === key) return dayById(last.day) || 'rest';
    if (!last) return key === today ? dayOf(dueAt(0, Infinity)) : null;
    return dayOf(dueAt(last.p, daysBetween(last.key, key)));
  }
  // Zukunft: ab heute durchspielen, als würde jedes fällige Training am Tag gemacht
  const last = lastBefore(today, true);
  let p = last?.p ?? 0, lastKey = last?.key ?? null;
  for (let d = today; d <= key; d = addDays(d, 1)) {
    if (d === lastKey) continue;
    const i = dueAt(p, lastKey ? daysBetween(lastKey, d) : Infinity);
    if (d === key) return dayOf(i);
    if (i >= 0) { p = (i + 1) % slots.length; lastKey = d; }
  }
  return null;
}

/** Für den Abfolge-Editor: letztes Training aus der Abfolge und Index des nächsten. */
export function sequenceState() {
  const slots = state.settings.schedule.slots;
  const last = lastBefore(todayKey(), true);
  return { last, next: slots.length ? dueAt(last?.p ?? 0, Infinity) : -1 };
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
