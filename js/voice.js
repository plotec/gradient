// Spracheingabe für Mahlzeiten: sprechen (oder tippen) → Zutaten mit Mengen erkennen → prüfen → eintragen.
// Erkennung: mit Cloud-Account per KI (Supabase-Funktion "parse-meal"), sonst direkt auf dem Gerät.
import { state, save, ensureDiary, makeEntry, touchRecent, foodPer100 } from './store.js';
import { uid, esc, fmt, fmtMax, parseNum, round } from './utils.js';
import { icon, onAct, onInput, onChange, openSheet, closeSheet, topSheet, redrawSheet, toast } from './ui.js';
import { loadBls, searchBls, norm } from './foods-db.js';
import { cloudEnabled, currentSession, accessToken } from './cloud.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ---------------------------------------------------------------------
// Erkennung auf dem Gerät
// ---------------------------------------------------------------------
const NUM = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7,
  acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12, fuenfzehn: 15, zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50,
  hundert: 100, einhundert: 100, zweihundert: 200, dreihundert: 300, vierhundert: 400, fuenfhundert: 500,
  halb: 0.5, halbe: 0.5, halben: 0.5, halber: 0.5, halbes: 0.5, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5,
  viertel: 0.25, dreiviertel: 0.75, drittel: 1 / 3, paar: 2,
};
// Einheit -> feste Grammzahl oder Portionsart (über Portionen des Lebensmittels / Packungsgrößen aufgelöst)
const UNITS = [
  [/^(g|gr|gramm)$/, { g: 1 }],
  [/^(kg|kilo|kilogramm)$/, { g: 1000 }],
  [/^(ml|milliliter)$/, { g: 1 }],
  [/^(l|liter)$/, { g: 1000 }],
  [/^(el|essloeffel)$/, { serving: /el\b|essl/, g: 15 }],
  [/^(tl|teeloeffel)$/, { serving: /tl\b|teel/, g: 5 }],
  [/^(tasse|tassen)$/, { g: 200 }],
  [/^(glas|glaeser)$/, { serving: /glas/, g: 250 }],
  [/^(becher)$/, { serving: /becher|packung/, pack: true }],
  [/^(packung|packungen|pack|packerl|paeckchen|paket|dose|dosen|flasche|flaschen|beutel|tuete|schale)$/, { serving: /packung|dose|flasche|becher|beutel/, pack: true }],
  [/^(scheibe|scheiben)$/, { serving: /scheibe/, g: 25 }],
  [/^(stueck|stk|stueckchen)$/, { serving: /stueck|kugel|riegel/, g: 100 }],
  [/^(handvoll)$/, { serving: /handvoll/, g: 30 }],
  [/^(portion|portionen)$/, { serving: /portion/, g: 250 }],
  [/^(teller)$/, { g: 350 }],
  [/^(kugel|kugeln)$/, { serving: /kugel/, g: 60 }],
  [/^(riegel)$/, { serving: /riegel/, g: 50 }],
  [/^(schuss)$/, { g: 20 }],
  [/^(prise)$/, { g: 1 }],
];
// typische Packungsgrößen, falls das Lebensmittel keine Portion kennt
const PACKS = [
  [/creme fraiche|cremefine|sahne|schmand|saure sahne|frischkaese/, 200],
  [/quark/, 500], [/skyr/, 450], [/joghurt/, 500], [/mozzarella/, 125], [/feta/, 200],
  [/reibekaese|streukaese|gerieben/, 200], [/hack/, 500], [/passiert|stueckige tomaten|tomaten.*dose/, 400],
  [/kokosmilch/, 400], [/thunfisch/, 130], [/mais/, 140], [/bohnen|kichererbsen/, 250], [/nudeln|spaghetti|pasta/, 500],
  [/reis/, 500], [/milch|saft/, 1000], [/cola|limo/, 330], [/bier/, 500], [/chips/, 175], [/schokolade/, 100],
];
const FILLER = new Set(('ich habe hatte hab heute gestern abends mittags morgens gegessen getrunken gekocht gemacht noch etwa ca circa ungefaehr so also dann '
  + 'oben drueber darueber drauf obendrauf darauf von vom der die das den dem des an aus fuer zum zur und mit dazu plus sowie auch bisschen '
  + 'insgesamt zusammen meiner freundin wir haben hatten es gab war waren gramm').split(' '));
// Umgangssprache/Hörfehler -> Suchbegriff
const ALIASES = [
  [/\bcreme (fien|fine|fin)\b|\bkreme fine\b|\bcremefien\b/, 'cremefine'],
  [/\bcreme (fraiche|fresh|fresch)\b|\bkrem fresch\b/, 'creme fraiche'],
  [/\bhack(fleisch)?\b/, 'hackfleisch'],
  [/\b(streu|reibe|gerieben\w*) ?kaese\b|\bkaese gerieben\b/, 'reibekaese streukaese'],
  [/\b(spaghetti|penne|fusilli|pasta|tagliatelle|maccaroni|makkaroni)\b/, 'nudeln'],
  [/\bhaehnchen(brust)?\b|\bhuhn\b|\bchicken\b/, 'haehnchenbrust'],
  [/\beier\b/, 'ei'],
  [/\bkartoffeln\b/, 'kartoffeln'],
  [/\bhaferflocke\b/, 'haferflocken'],
];

function words(text) { return norm(text).split(' ').filter(Boolean); }
const stem = (w) => w.replace(/(en|n|e|s)$/, '');

/** Text in Abschnitte je Zutat zerlegen. */
export function splitSegments(text) {
  return String(text)
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2') // 1,5 -> 1.5
    .split(/[,;\n]|\.(?!\d)|\s(?:und|sowie|plus|dazu|mit)\s/i)
    .map((s) => s.trim())
    .filter((s) => /[a-zäöüß]/i.test(s));
}

/** Menge + Einheit + Lebensmittelbegriff aus einem Abschnitt. */
export function parseSegment(seg) {
  let txt = norm(seg.replace(/(\d)\.(\d)/g, '$1DOT$2')).replace(/dot/g, '.');
  txt = txt.replace(/(\d)(g|kg|ml|l|gr)\b/g, '$1 $2');
  const tokens = txt.split(' ');
  let qty = null, unit = null;
  const rest = [];
  for (const t of tokens) {
    if (/^\d+(\.\d+)?$/.test(t)) { qty = (qty ?? 1) * parseFloat(t); continue; }
    if (NUM[t] != null && !unit) { qty = (qty ?? 1) * NUM[t]; continue; }
    const u = UNITS.find(([re]) => re.test(t));
    if (u && !unit) { unit = u[1]; continue; }
    if (FILLER.has(t)) continue;
    rest.push(t);
  }
  let query = rest.join(' ');
  for (const [re, rep] of ALIASES) query = query.replace(re, rep);
  return { text: seg.trim(), qty: qty ?? 1, unit, query: query.trim() };
}

function scoreFood(qWords, food, bonus = 0) {
  const n = norm(`${food.name} ${food.brand || ''}`);
  const nWords = n.split(' ');
  let hit = 0;
  for (const w of qWords) {
    const s = stem(w);
    if (nWords.some((x) => x === w || x.startsWith(s) || (s.length > 4 && x.includes(s)))) hit++;
  }
  if (!hit) return -1;
  let score = (hit / qWords.length) * 100 + bonus - nWords.length * 1.5;
  if (/\broh\b/.test(n)) score += 2;
  if (/gekocht|zubereitet/.test(n) && !qWords.some((w) => /gekocht|zubereitet/.test(w))) score -= 3;
  return score;
}

/** Beste Treffer: eigene Lebensmittel zuerst, dann BLS. */
export function matchFoods(query, limit = 6) {
  const qWords = words(query);
  if (!qWords.length) return [];
  const recent = new Set(state.recentFoods);
  const local = state.foods.map((f) => ({ f, s: scoreFood(qWords, f, (f.source === 'eigene' ? 12 : 8) + (recent.has(f.id) ? 6 : 0)) })).filter((x) => x.s > 0);
  const bls = searchBls(qWords.map(stem).join(' '), 25).concat(searchBls(query, 25))
    .map((f) => ({ f, s: scoreFood(qWords, f, 0) })).filter((x) => x.s > 0);
  const seen = new Set();
  return [...local, ...bls].sort((a, b) => b.s - a.s)
    .filter(({ f }) => { const k = f.id || `bls:${f.blsCode}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, limit).map((x) => ({ food: x.f, score: x.s }));
}

function gramsFor(p, food) {
  const u = p.unit;
  const sv = food?.servings || [];
  if (!u) {
    // "2 Eier", "1 Banane": Stückzahl über Portion, sonst Zahl als Gramm interpretieren wenn groß
    if (p.qty >= 20) return { g: p.qty, note: '' };
    const s = sv.find((x) => /stueck|stück/i.test(norm(x.name))) || sv[0];
    if (s) return { g: p.qty * s.grams, note: `${fmtMax(p.qty, 2)} × ${s.name}` };
    return { g: p.qty * 100, note: `${fmtMax(p.qty, 2)} × 100 g (geschätzt)` };
  }
  if (u.serving) {
    const s = sv.find((x) => u.serving.test(norm(x.name)));
    if (s) return { g: p.qty * s.grams, note: `${fmtMax(p.qty, 2)} × ${s.name} (${fmtMax(s.grams)} g)` };
  }
  if (u.pack) {
    const n = norm(food?.name || p.query);
    const pack = (PACKS.find(([re]) => re.test(n)) || [null, 250])[1];
    return { g: p.qty * pack, note: `${fmtMax(p.qty, 2)} × Packung à ${pack} g` };
  }
  return { g: p.qty * u.g, note: u.g === 1 ? '' : `${fmtMax(p.qty, 2)} × ${u.g} g` };
}

export async function parseLocally(text) {
  await loadBls();
  return splitSegments(text).map((seg) => {
    const p = parseSegment(seg);
    const matches = p.query ? matchFoods(p.query) : [];
    const best = matches[0]?.food || null;
    const { g, note } = gramsFor(p, best);
    return {
      id: uid(), text: p.text, query: p.query, grams: round(g, 0), note,
      food: best, alternatives: matches.map((m) => m.food), sure: !!best && matches[0].score >= 60, source: 'geraet',
    };
  }).filter((it) => it.query);
}

// ---------------------------------------------------------------------
// KI-Erkennung (Supabase Edge Function mit Claude)
// ---------------------------------------------------------------------
export const aiAvailable = () => cloudEnabled && currentSession()?.mode === 'cloud';

async function parseWithAi(text) {
  const token = await accessToken();
  const myFoods = state.foods.filter((f) => f.source !== 'basis').slice(-80).map((f) => ({ name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, portions: (f.servings || []).map((s) => `${s.name}=${s.grams}g`).join(', ') }));
  const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, myFoods }),
  });
  if (!res.ok) throw new Error(`KI ${res.status}`);
  const data = await res.json();
  await loadBls();
  return (data.items || []).map((ai) => {
    const matches = matchFoods(ai.search_term || ai.name);
    // Datenbankwert nur nehmen, wenn er plausibel zur KI-Schätzung passt (±35 % kcal)
    const db = matches.find((m) => m.score >= 60 && Math.abs(m.food.kcal - ai.per100.kcal) <= Math.max(40, ai.per100.kcal * 0.35));
    const kiFood = { id: null, name: ai.name, brand: '', unit: 'g', servings: [], source: 'ki', ...ai.per100 };
    return {
      id: uid(), text: ai.spoken || ai.name, query: ai.search_term || ai.name, grams: round(ai.grams, 0), note: ai.amount_note || '',
      food: db ? db.food : kiFood, alternatives: [...(db ? [kiFood] : []), ...matches.map((m) => m.food)].slice(0, 6), sure: true, source: 'ki',
    };
  });
}

// ---------------------------------------------------------------------
// Oberfläche
// ---------------------------------------------------------------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;

const vs = () => { const t = topSheet(); return t && t.id === 'voice' ? t : null; };
const itemKcal = (it, share = 1) => (it.food ? (foodPer100(it.food).kcal * it.grams * share) / 100 : 0);

export function openVoice({ meal = 0, getDate }) {
  const ui = { text: '', items: null, busy: false, share: 1, meal, listening: false, error: '', saveAs: '', mode: aiAvailable() ? 'ki' : 'geraet' };
  openSheet({
    id: 'voice', ui, getDate,
    onClose: () => { try { rec?.stop(); } catch {} },
    render: () => {
      const tot = (ui.items || []).reduce((a, it) => {
        if (!it.food) return a;
        const p = foodPer100(it.food), f = (it.grams * ui.share) / 100;
        a.kcal += p.kcal * f; a.protein += p.protein * f; a.carbs += p.carbs * f; a.fat += p.fat * f; return a;
      }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
      return {
        title: 'Per Sprache eintragen',
        body: `
          <div class="voice-box">
            <button class="mic ${ui.listening ? 'on' : ''}" data-act="voice-mic" aria-label="${ui.listening ? 'Aufnahme beenden' : 'Sprechen'}">${icon('mic')}</button>
            <div class="small muted" style="text-align:center">${ui.listening ? 'Ich höre zu … tippe zum Beenden.' : SR ? 'Tippe aufs Mikrofon und sag, was du gegessen hast.' : 'Tippe ins Textfeld und nutze das Mikrofon deiner Tastatur.'}</div>
          </div>
          <textarea class="input" id="voice-text" data-in="voice-text" rows="3" placeholder="z. B. 250 Gramm Nudeln, eine halbe Packung Cremefine, 500 Gramm Hackfleisch und eine Handvoll Streukäse">${esc(ui.text)}</textarea>
          <div class="row between wrap" style="gap:8px">
            <span class="chip ${ui.mode === 'ki' ? 'good' : ''}">${ui.mode === 'ki' ? 'KI-Auswertung' : 'Erkennung auf dem Gerät'}</span>
            <button class="btn primary" data-act="voice-parse" ${ui.busy || !ui.text.trim() ? 'disabled style="opacity:.5"' : ''}>${ui.busy ? 'Werte aus …' : 'Auswerten'}</button>
          </div>
          ${ui.error ? `<div class="auth-error">${esc(ui.error)}</div>` : ''}
          ${ui.items ? `
            <h2 class="sec">Erkannt</h2>
            ${ui.items.length ? `<div class="card" style="padding:4px 14px"><div class="list">${ui.items.map((it, i) => `
              <div class="li" style="align-items:flex-start">
                <div class="grow">
                  <button class="voice-food ${it.food ? (it.sure ? '' : 'unsure') : 'missing'}" data-act="voice-pick" data-i="${i}">
                    ${it.food ? esc(it.food.name) : `„${esc(it.query)}“ nicht gefunden – auswählen`}${icon('down')}</button>
                  <div class="s">${esc(it.text)}${it.note ? ` · ${esc(it.note)}` : ''}${it.food?.source === 'ki' ? ' · KI-Schätzung' : it.food?.source === 'bls' ? ' · BLS' : ''}</div>
                </div>
                <div class="voice-amt"><input class="input" inputmode="decimal" value="${fmtMax(it.grams, 1)}" data-ch="voice-grams" data-i="${i}" aria-label="Menge in Gramm"><span>g</span></div>
                <div class="r" style="min-width:52px"><div style="font-weight:500" class="num">${fmt(itemKcal(it, ui.share))}</div><div class="tiny faint">kcal</div></div>
                <button class="icon-btn sm plain" data-act="voice-del" data-i="${i}" aria-label="Entfernen">${icon('x')}</button>
              </div>`).join('')}</div></div>` : '<div class="card flat"><div class="empty small">Keine Zutaten erkannt. Nenne Menge und Lebensmittel, z. B. „200 Gramm Reis“.</div></div>'}
            <button class="btn sm" data-act="voice-add-item" style="align-self:flex-start">${icon('plus')}Zutat ergänzen</button>
            <div class="card">
              <div class="field"><span>Mein Anteil (z. B. zu zweit gekocht)</span>
                <div class="seg">${[[1, 'Alles'], [0.5, '½'], [1 / 3, '⅓'], [0.25, '¼']].map(([v, l]) => `<button class="${Math.abs(ui.share - v) < 0.001 ? 'on' : ''}" data-act="voice-share" data-v="${v}">${l}</button>`).join('')}</div></div>
              <div class="nut-grid">
                <div><div class="v" style="color:var(--amber)">${fmt(tot.kcal)}</div><div class="l">kcal</div></div>
                <div><div class="v">${fmt(tot.protein)}</div><div class="l">Eiweiß g</div></div>
                <div><div class="v">${fmt(tot.carbs)}</div><div class="l">Kohlenh. g</div></div>
                <div><div class="v">${fmt(tot.fat)}</div><div class="l">Fett g</div></div>
              </div>
              <label class="field"><span>Mahlzeit</span><select class="input" data-ch="voice-meal">${state.settings.mealNames.map((n, i) => `<option value="${i}" ${ui.meal === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
              <label class="field"><span>Als wiederkehrende Mahlzeit speichern (optional)</span><input class="input" id="voice-save-name" data-in="voice-save-name" value="${esc(ui.saveAs)}" placeholder="Name, z. B. Nudeln mit Hack"></label>
            </div>` : ''}`,
        foot: ui.items?.length ? `<button class="btn food block lg" data-act="voice-commit">${icon('check')}Eintragen</button>` : '',
      };
    },
  });
}

async function runParse(s) {
  const ui = s.ui;
  ui.busy = true; ui.error = ''; redrawSheet(s);
  try {
    if (ui.mode === 'ki') {
      try { ui.items = await parseWithAi(ui.text); }
      catch (e) { console.warn(e); ui.items = await parseLocally(ui.text); ui.error = 'KI gerade nicht erreichbar – Erkennung auf dem Gerät verwendet. Bitte Treffer prüfen.'; }
    } else ui.items = await parseLocally(ui.text);
  } finally { ui.busy = false; }
  redrawSheet(s);
}

onAct({
  'voice-mic': () => {
    const s = vs(); if (!s) return;
    const ui = s.ui;
    if (!SR) { document.getElementById('voice-text')?.focus(); toast('Nutze das Mikrofon auf deiner Tastatur'); return; }
    if (ui.listening) { try { rec.stop(); } catch {} return; }
    rec = new SR();
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true;
    const base = ui.text ? `${ui.text.trim()}, ` : '';
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      ui.text = base + txt.trim();
      const ta = document.getElementById('voice-text');
      if (ta) ta.value = ui.text;
    };
    rec.onerror = (e) => { ui.error = e.error === 'not-allowed' ? 'Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen oder nutze das Tastatur-Mikrofon.' : ''; };
    rec.onend = () => { ui.listening = false; const cur = vs(); if (cur) { redrawSheet(cur); if (ui.text.trim()) runParse(cur); } };
    try { rec.start(); ui.listening = true; ui.error = ''; } catch (e) { ui.error = 'Spracherkennung konnte nicht starten.'; }
    redrawSheet(s);
  },
  'voice-parse': () => { const s = vs(); if (s) runParse(s); },
  'voice-del': (el) => { const s = vs(); s.ui.items.splice(+el.dataset.i, 1); redrawSheet(s); },
  'voice-share': (el) => { const s = vs(); s.ui.share = +el.dataset.v; redrawSheet(s); },
  'voice-pick': (el) => {
    const s = vs(); const it = s.ui.items[+el.dataset.i];
    openVoicePicker(it, () => redrawSheet(s));
  },
  'voice-add-item': () => {
    const s = vs();
    const it = { id: uid(), text: 'ergänzt', query: '', grams: 100, note: '', food: null, alternatives: [], sure: true };
    s.ui.items.push(it);
    openVoicePicker(it, () => redrawSheet(s));
  },
  'voice-commit': () => {
    const s = vs(); if (!s) return;
    const ui = s.ui;
    const ready = ui.items.filter((it) => it.food && it.grams > 0);
    if (!ready.length) { toast('Wähle für die Zutaten ein Lebensmittel aus'); return; }
    const d = ensureDiary(s.getDate());
    const mealItems = [];
    for (const it of ready) {
      let food = it.food;
      // BLS-Treffer in die eigene Liste übernehmen (für "Zuletzt"); KI-Schätzungen nur als Eintrag
      if (!food.id && food.source === 'bls') {
        food = state.foods.find((f) => f.blsCode === food.blsCode) || (state.foods.push({ ...food, id: uid() }), state.foods[state.foods.length - 1]);
      }
      const grams = round(it.grams * ui.share, 1);
      d.entries.push(makeEntry(food, grams, ui.meal));
      if (food.id) { touchRecent(food.id); mealItems.push({ foodId: food.id, amount: grams }); }
    }
    if (ui.saveAs.trim() && mealItems.length) state.meals.push({ id: uid(), name: ui.saveAs.trim(), items: mealItems });
    closeSheet(s);
    save();
    toast(`${ready.length} Zutaten eingetragen`);
  },
});
onInput({
  'voice-text': (el) => {
    const s = vs(); if (!s) return;
    s.ui.text = el.value;
    const b = s.el.querySelector('[data-act="voice-parse"]');
    if (b && !s.ui.busy) { b.disabled = !el.value.trim(); b.style.opacity = el.value.trim() ? '' : '.5'; }
  },
  'voice-save-name': (el) => { const s = vs(); if (s) s.ui.saveAs = el.value; },
});
onChange({
  'voice-grams': (el) => { const s = vs(); s.ui.items[+el.dataset.i].grams = parseNum(el.value) || 0; redrawSheet(s); },
  'voice-meal': (el) => { const s = vs(); s.ui.meal = +el.value; },
});

/** Auswahl eines anderen Treffers bzw. Suche. */
function openVoicePicker(item, done) {
  let q = item.query;
  const sheet = openSheet({
    id: 'voice-pick',
    render: () => {
      const list = q.trim() ? matchFoods(q, 30).map((m) => m.food) : item.alternatives;
      const all = [...item.alternatives.filter((a) => a.source === 'ki'), ...list];
      return {
        title: 'Lebensmittel wählen',
        top: `<div style="padding:10px 16px 0;background:var(--bg)"><label class="search">${icon('search')}<input class="input" id="vp-q" value="${esc(q)}" data-in="vp-q" placeholder="Suchen" autocomplete="off"></label></div>`,
        body: `<div class="list" id="vp-list">${all.map((f, i) => `<button class="li" data-act="vp-pick" data-i="${i}">
          <div class="grow"><div class="t ellipsis">${esc(f.name)}</div><div class="s">${fmt(f.kcal)} kcal / 100 g · ${f.source === 'ki' ? 'KI-Schätzung' : f.source === 'bls' ? 'BLS' : f.source === 'eigene' ? 'Eigenes Lebensmittel' : 'Grundliste'}</div></div></button>`).join('') || '<div class="empty">Nichts gefunden.</div>'}</div>`,
      };
    },
  });
  sheet.pick = (i) => {
    const list = q.trim() ? matchFoods(q, 30).map((m) => m.food) : item.alternatives;
    const all = [...item.alternatives.filter((a) => a.source === 'ki'), ...list];
    item.food = all[i]; item.sure = true;
    closeSheet(sheet); done();
  };
  sheet.setQ = (v) => { q = v; redrawSheet(sheet); };
}
const vp = () => { const t = topSheet(); return t && t.id === 'voice-pick' ? t : null; };
onAct({ 'vp-pick': (el) => vp()?.pick(+el.dataset.i) });
onInput({ 'vp-q': (el) => vp()?.setQ(el.value) });
