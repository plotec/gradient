// Ziele: über Gewicht pro Woche oder Kalorienbilanz pro Tag. Daraus + Umsatz -> empfohlene Kalorienzufuhr.
import { state, save, computeTdee, latestWeight, weightTrend, adjustMacro } from './store.js';
import { esc, fmt, fmtMax, signed, parseNum, todayKey, addDays, parseKey } from './utils.js';
import { icon, onAct, onInput, openSheet, closeSheet, topSheet, redrawSheet, toast } from './ui.js';

export const KCAL_PER_KG = 7700;
const round10 = (n) => Math.round(n / 10) * 10;

/** Tägliche Bilanz (kcal) und Wochenrate (kg) des aktuellen Ziels – jeweils ineinander umgerechnet. */
export function goalNumbers(goal = state.settings.goal) {
  if (goal.mode === 'balance') return { balance: goal.balance, rate: (goal.balance * 7) / KCAL_PER_KG };
  return { balance: (goal.rate * KCAL_PER_KG) / 7, rate: goal.rate };
}

/** Umsatz: berechnet aus Gewicht + Ernährung, sonst manuell geschätzt. */
export function currentTdee() {
  const r = computeTdee();
  if (r.tdee != null) return { value: r.tdee, source: 'berechnet', quality: r.quality, r };
  const m = state.settings.goal.tdeeManual;
  return m ? { value: m, source: 'geschätzt', quality: 'manuell', r } : { value: null, source: null, r };
}

/** Empfohlene Kalorienzufuhr für das Ziel (auf 10 kcal gerundet) oder null. */
export function targetIntake(goal = state.settings.goal) {
  const t = currentTdee();
  if (t.value == null) return null;
  return round10(t.value + goalNumbers(goal).balance);
}

export function goalLabel(goal = state.settings.goal) {
  const { rate, balance } = goalNumbers(goal);
  if (Math.abs(rate) < 0.02) return 'Gewicht halten';
  return goal.mode === 'balance'
    ? `${balance > 0 ? 'Überschuss' : 'Defizit'} ${fmt(Math.abs(balance))} kcal/Tag`
    : `${rate > 0 ? 'Zunehmen' : 'Abnehmen'} ${fmtMax(Math.abs(rate), 2)} kg/Woche`;
}

/**
 * Wochen-Auswertung des Gewichtsziels: Veränderung des geglätteten Trends von Sonntag zu Sonntag.
 * Getroffen, wenn die Abweichung zur Zielrate höchstens 0,25 kg/Woche beträgt.
 */
export function weeklyWeightResults() {
  const trend = weightTrend();
  if (trend.length < 4) return [];
  const { rate } = goalNumbers();
  const trendAt = (k) => { let v = null; for (const p of trend) { if (p.key > k) break; v = p; } return v; };
  const out = [];
  // Sonntage ab der zweiten Woche mit Daten
  let sun = addDays(trend[0].key, (7 - parseKey(trend[0].key).getDay()) % 7);
  const today = todayKey();
  while (addDays(sun, 7) <= today) {
    const a = trendAt(sun), bKey = addDays(sun, 7), b = trendAt(bKey);
    const weighIns = trend.filter((p) => p.key > sun && p.key <= bKey).length;
    if (a && b && b.key > sun && weighIns >= 3) {
      const change = b.trend - a.trend;
      out.push({ weekEnd: bKey, change, target: rate, hit: Math.abs(change - rate) <= 0.25 });
    }
    sun = bKey;
  }
  return out;
}

/** Automatische Anpassung (höchstens einmal am Tag). Liefert neuen Wert oder null. */
export function autoAdjustGoal() {
  const g = state.settings.goal;
  const today = todayKey();
  if (!g.auto || g.lastAuto === today) return null;
  const t = computeTdee();
  g.lastAuto = today;
  if (t.tdee == null || t.quality === 'gering') { save({ silent: true }); return null; }
  const target = round10(t.tdee + goalNumbers(g).balance);
  if (Math.abs(target - state.settings.goals.kcal) < 30) { save({ silent: true }); return null; }
  adjustMacro(state.settings.goals, 'kcal', target);
  save();
  return target;
}

// ---------------------------------------------------------------------
// Ziel-Sheet
// ---------------------------------------------------------------------
const RATE_CHIPS = [-1, -0.75, -0.5, -0.25, 0, 0.1, 0.25, 0.5];
const BAL_CHIPS = [-500, -300, -150, 0, 150, 200, 300];

export function openGoalSheet() {
  const draft = { ...state.settings.goal };
  openSheet({
    id: 'goal',
    draft,
    render: () => {
      const { rate, balance } = goalNumbers(draft);
      const t = currentTdee();
      const target = t.value != null ? round10(t.value + balance) : null;
      const lw = latestWeight();
      const eta = draft.targetWeight && lw && Math.abs(rate) > 0.01 && Math.sign(draft.targetWeight - lw.trend) === Math.sign(rate)
        ? Math.ceil(Math.abs(draft.targetWeight - lw.trend) / Math.abs(rate)) : null;
      return {
        title: 'Mein Ziel',
        body: `
          <div class="seg">
            <button class="${draft.mode === 'rate' ? 'on' : ''}" data-act="goal-mode" data-k="rate">Gewicht / Woche</button>
            <button class="${draft.mode === 'balance' ? 'on' : ''}" data-act="goal-mode" data-k="balance">Kalorienbilanz</button>
          </div>
          <div class="card">
            ${draft.mode === 'rate' ? `
              <label class="field"><span>Gewichtsveränderung pro Woche (minus = abnehmen)</span>
                <div class="row"><input class="input kcal-in" id="goal-rate" inputmode="decimal" value="${fmtMax(draft.rate, 2)}" data-in="goal-in" data-k="rate" autocomplete="off"><span class="muted">kg / Woche</span></div></label>
              <div class="row wrap" style="gap:6px">${RATE_CHIPS.map((v) => `<button class="btn sm ${Math.abs(draft.rate - v) < 0.001 ? 'primary' : ''}" data-act="goal-chip" data-k="rate" data-v="${v}">${v === 0 ? 'halten' : `${signed(v, 2)}`}</button>`).join('')}</div>
              <div class="small muted" id="goal-eq">entspricht ${signed(balance, 0)} kcal pro Tag</div>`
            : `
              <label class="field"><span>Kalorien pro Tag über (+) oder unter (−) deinem Umsatz</span>
                <div class="row"><input class="input kcal-in" id="goal-balance" inputmode="numeric" value="${draft.balance > 0 ? '+' : ''}${draft.balance}" data-in="goal-in" data-k="balance" autocomplete="off"><span class="muted">kcal / Tag</span></div></label>
              <div class="row wrap" style="gap:6px">${BAL_CHIPS.map((v) => `<button class="btn sm ${draft.balance === v ? 'primary' : ''}" data-act="goal-chip" data-k="balance" data-v="${v}">${v === 0 ? '±0' : signed(v)}</button>`).join('')}</div>
              <div class="small muted" id="goal-eq">entspricht ${signed(rate, 2)} kg pro Woche</div>`}
          </div>

          <div class="card tdee">
            <div class="row between"><span class="muted">Dein Umsatz</span>
              <span class="small muted">${t.source === 'berechnet' ? `berechnet · Datenlage ${t.quality}` : t.source === 'geschätzt' ? 'von dir geschätzt' : 'noch unbekannt'}</span></div>
            ${t.source !== 'berechnet' ? `<label class="field"><span>Noch zu wenig Daten für die Berechnung – trag einen Schätzwert ein (wird ersetzt, sobald genug Daten da sind)</span>
              <input class="input" id="goal-tdee" inputmode="numeric" value="${draft.tdeeManual ?? ''}" placeholder="z. B. 2600" data-in="goal-in" data-k="tdeeManual"></label>`
              : `<div class="mid-num">${fmt(round10(t.value))} kcal</div>`}
            <div class="divider"></div>
            <div class="row between wrap" style="align-items:flex-end">
              <div><div class="small muted">Empfohlene Zufuhr</div><div class="big-num" id="goal-target">${target != null ? fmt(target) : '–'}</div><div class="small muted">kcal pro Tag · aktuell eingestellt: ${fmt(state.settings.goals.kcal)}</div></div>
            </div>
            <label class="row" style="gap:10px"><input type="checkbox" id="goal-auto" ${draft.auto ? 'checked' : ''} data-act="goal-auto" style="width:22px;height:22px;accent-color:var(--accent)">
              <span><b style="font-weight:500">Automatisch anpassen</b><br><span class="small muted">Einmal täglich wird dein Kalorienziel an den neu berechneten Umsatz angepasst. Makros: Ausgleich über Kohlenhydrate.</span></span></label>
          </div>

          <div class="card">
            <label class="field"><span>Zielgewicht (optional)</span>
              <div class="row"><input class="input" id="goal-tw" inputmode="decimal" value="${draft.targetWeight ?? ''}" placeholder="${lw ? fmtMax(lw.trend, 1) : '80'}" data-in="goal-in" data-k="targetWeight"><span class="muted">kg</span></div></label>
            ${eta ? `<div class="small muted">Bei diesem Tempo erreichst du es in etwa ${eta} Wochen.</div>` : ''}
          </div>
          <p class="tiny faint" style="margin:0">Rechnung: 1 kg Körpergewicht ≈ 7.700 kcal. Ob du dein Wochenziel triffst, wird jeden Sonntag am geglätteten Gewichtstrend gemessen (± 0,25 kg) und gibt Punkte.</p>`,
        foot: `<button class="btn primary block lg" data-act="goal-save">${icon('check')}${target != null ? `Speichern & ${fmt(target)} kcal übernehmen` : 'Speichern'}</button>`,
      };
    },
  });
}
const gs = () => { const t = topSheet(); return t && t.id === 'goal' ? t : null; };
onAct({
  'goal-open': () => openGoalSheet(),
  'goal-mode': (el) => {
    const s = gs(); const d = s.draft;
    // Wert beim Umschalten umrechnen, damit das Ziel gleich bleibt
    const n = goalNumbers(d);
    d.mode = el.dataset.k;
    if (d.mode === 'balance') d.balance = Math.round(n.balance / 10) * 10; else d.rate = Math.round(n.rate * 100) / 100;
    redrawSheet(s);
  },
  'goal-chip': (el) => { const s = gs(); s.draft[el.dataset.k] = +el.dataset.v; redrawSheet(s); },
  'goal-auto': (el) => { const s = gs(); s.draft.auto = el.checked; },
  'goal-save': () => {
    const s = gs(); if (!s) return;
    Object.assign(state.settings.goal, s.draft);
    state.settings.weeklyRate = goalNumbers().rate;
    const target = targetIntake();
    if (target != null) adjustMacro(state.settings.goals, 'kcal', target);
    state.settings.goal.lastAuto = todayKey();
    closeSheet(s);
    save();
    toast(target != null ? `Ziel gespeichert · ${fmt(target)} kcal pro Tag` : 'Ziel gespeichert');
  },
});
onInput({
  'goal-in': (el) => {
    const s = gs(); if (!s) return;
    const v = parseNum(el.value.replace('+', ''));
    const k = el.dataset.k;
    if (k === 'targetWeight' || k === 'tdeeManual') s.draft[k] = v && v > 0 ? v : null;
    else if (v != null) s.draft[k] = k === 'balance' ? Math.round(v) : v;
    // nur Kennzahlen aktualisieren, Eingabe nicht unterbrechen
    const { rate, balance } = goalNumbers(s.draft);
    const eq = document.getElementById('goal-eq');
    if (eq) eq.textContent = s.draft.mode === 'rate' ? `entspricht ${signed(balance, 0)} kcal pro Tag` : `entspricht ${signed(rate, 2)} kg pro Woche`;
    const t = currentTdee().value ?? s.draft.tdeeManual;
    const tg = document.getElementById('goal-target');
    if (tg) tg.textContent = t ? fmt(round10(t + balance)) : '–';
  },
});
