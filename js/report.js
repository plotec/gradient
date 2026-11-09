// Wochenbericht als Text: kopieren und im Chat mit Claude einfügen (die Daten liegen nur auf dem Handy).
import { state, dayDiary, totals, entryNut, weightTrend, computeTdee, exById } from './store.js';
import { todayKey, addDays, dayKey, fmtDay } from './utils.js';
import { dayStatus, supplementHabits } from './success.js';
import { workoutStars } from './training.js';
import { goalLabel } from './goals.js';
import { onAct, toast } from './ui.js';

const r0 = (v) => Math.round(v);
const r1 = (v) => Math.round(v * 10) / 10;
const e10 = (w, r) => (w && r ? w * (1 + r / 30) * 0.75 : 0);

export function buildReport(days = 14) {
  const today = todayKey();
  const from = addDays(today, -(days - 1));
  const g = state.settings.goals;
  const trend = Object.fromEntries(weightTrend().map((p) => [p.key, p]));
  const L = [];
  L.push(`GRADIENT-BERICHT ${fmtDay(today, { long: true })} · letzte ${days} Tage`);
  L.push(`Ziel: ${goalLabel()} · ${r0(g.kcal)} kcal · E ${r0(g.protein)} g · K ${r0(g.carbs)} g · F ${r0(g.fat)} g`);
  const t = computeTdee();
  if (t.tdee) L.push(`Berechneter Verbrauch (TDEE): ${r0(t.tdee)} kcal · Gewicht ${t.slopePerWeek >= 0 ? '+' : ''}${r1(t.slopePerWeek)} kg/Woche · Datenlage ${t.quality}`);

  L.push('', 'TAGE (Gewicht morgens | Trend | kcal | E/K/F | Training | Supplements)');
  const supps = supplementHabits();
  for (let k = from; k <= today; k = addDays(k, 1)) {
    const w = state.weights[k];
    const tr = trend[k]?.trend;
    const n = totals(dayDiary(k).entries);
    const wo = state.workouts.filter((x) => dayKey(new Date(x.startedAt)) === k).map((x) => x.name).join('+');
    const st = dayStatus(k);
    L.push(`${k} | ${w != null ? `${r1(w)} kg` : 'NICHT GEWOGEN'} | ${tr ? r1(tr) : '–'} | ${n.kcal ? r0(n.kcal) : 'NICHT GETRACKT'} | ${n.kcal ? `${r0(n.protein)}/${r0(n.carbs)}/${r0(n.fat)}` : '–'} | ${wo || '–'} | ${supps.length ? (st.supplements.done ? 'ja' : 'nein') : '–'}`);
  }

  const ref = dayDiary(today).entries.length ? today : addDays(today, -1);
  const entries = dayDiary(ref).entries;
  if (entries.length) {
    L.push('', `ESSEN AM ${fmtDay(ref)} (Referenztag)`);
    const meals = state.settings.mealNames;
    meals.forEach((m, i) => {
      const es = entries.filter((e) => e.meal === i);
      if (!es.length) return;
      L.push(`${m}:`);
      for (const e of es) { const v = entryNut(e); L.push(`  ${e.name}${e.brand ? ` (${e.brand})` : ''} ${r0(e.amount)} ${e.unit} – ${r0(v.kcal)} kcal, E ${r1(v.protein)} / K ${r1(v.carbs)} / F ${r1(v.fat)}`); }
    });
    const s = totals(entries);
    L.push(`Summe: ${r0(s.kcal)} kcal, E ${r0(s.protein)} / K ${r0(s.carbs)} / F ${r0(s.fat)}`);
  }

  const ws = state.workouts.filter((x) => dayKey(new Date(x.startedAt)) >= from).sort((a, b) => a.startedAt - b.startedAt);
  L.push('', 'TRAINING (Satz = kg×Wdh · bestes 10RM · Vergleich zum letzten Mal)');
  if (!ws.length) L.push('Kein Training im Zeitraum.');
  for (const w of ws) {
    const st = workoutStars(w);
    L.push(`${fmtDay(dayKey(new Date(w.startedAt)))} ${w.name} · ${r0((w.endedAt - w.startedAt) / 60000)} min · ★ ${st.total}`);
    for (const e of w.exercises) {
      const best = Math.max(...e.sets.map((s) => e10(s.weight, s.reps)));
      const prev = [...state.workouts].filter((x) => x.startedAt < w.startedAt && x.exercises.some((y) => y.exerciseId === e.exerciseId)).pop();
      const pb = prev ? Math.max(...prev.exercises.find((y) => y.exerciseId === e.exerciseId).sets.map((s) => e10(s.weight, s.reps))) : null;
      const d = pb == null ? 'erstes Mal' : best || pb ? `${best >= pb ? '+' : ''}${r1(best - pb)} kg` : 'Körpergewicht';
      L.push(`  ${exById(e.exerciseId)?.name || 'Übung'}: ${e.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')} · 10RM ${r1(best)} · ${d}`);
    }
  }
  return L.join('\n');
}

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

onAct({
  'report-copy': async () => {
    const ok = await copyText(buildReport());
    toast(ok ? 'Bericht kopiert – jetzt im Chat mit Claude einfügen' : 'Kopieren hat nicht geklappt', 3200);
  },
});
