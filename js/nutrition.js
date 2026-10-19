// Bereich Ernährung: Tagebuch mit Mahlzeiten, Lebensmittel-Datenbank, eigene Mahlzeiten, Barcode, Online-Suche.
import { state, save, dayDiary, ensureDiary, entryNut, totals, foodById, makeEntry, touchRecent, mealTotals, foodPer100 } from './store.js';
import { uid, esc, fmt, fmtMax, parseNum, todayKey, addDays, fmtDay, round } from './utils.js';
import { icon, onAct, onInput, onChange, openSheet, closeSheet, topSheet, redrawSheet, confirmDialog, menuDialog, toast } from './ui.js';
import { ring } from './charts.js';

let nutDate = todayKey();
export const setNutDate = (k) => { nutDate = k; };

const spec = (id) => { const t = topSheet(); return t && t.id === id ? t : null; };
const mealName = (i) => state.settings.mealNames[i] ?? `Mahlzeit ${i + 1}`;
const unitLbl = (u) => (u === 'ml' ? 'ml' : 'g');

// =====================================================================
// Tab: Tagebuch
// =====================================================================
export function renderNutrition() {
  const d = dayDiary(nutDate);
  const t = totals(d.entries);
  const g = state.settings.goals;
  const left = g.kcal - t.kcal;
  return `
    <div class="page-head"><div><h1>Ernährung</h1><div class="sub">Tagebuch</div></div>
      <button class="icon-btn" data-act="nut-goals" aria-label="Ziele">${icon('gear')}</button></div>
    <div class="date-nav">
      <button class="icon-btn" data-act="nut-day" data-d="-1" aria-label="Vorheriger Tag">${icon('left')}</button>
      <label class="lbl" style="position:relative">${fmtDay(nutDate, { long: true })}
        <input type="date" value="${nutDate}" data-ch="nut-date" style="position:absolute;inset:0;opacity:0" aria-label="Datum wählen"></label>
      <button class="icon-btn" data-act="nut-day" data-d="1" aria-label="Nächster Tag">${icon('right')}</button>
    </div>
    <div class="card">
      <div class="kcal-sum">
        <div class="ring">${ring(t.kcal / (g.kcal || 1), 'var(--food)', t.kcal > g.kcal * 1.02)}
          <div class="c"><span class="big-num ${left < 0 ? 'down' : ''}">${fmt(Math.abs(left))}</span><span class="tiny muted">${left < 0 ? 'kcal drüber' : 'kcal übrig'}</span></div></div>
        <div class="stack" style="gap:12px">
          <div class="equation">
            <div><div class="mid-num">${fmt(g.kcal)}</div><div class="lbl">Ziel</div></div>
            <div><div class="mid-num">${fmt(t.kcal)}</div><div class="lbl">Gegessen</div></div>
            <div><div class="mid-num ${left < 0 ? 'down' : ''}">${fmt(left)}</div><div class="lbl">Übrig</div></div>
          </div>
        </div>
      </div>
      <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
        ${macroBar('Eiweiß', t.protein, g.protein, 'var(--protein)')}
        ${macroBar('Kohlenh.', t.carbs, g.carbs, 'var(--carbs)')}
        ${macroBar('Fett', t.fat, g.fat, 'var(--fat)')}
      </div>
    </div>
    ${state.settings.mealNames.map((_, i) => mealCard(d, i)).join('')}
    ${d.entries.length ? '' : `<button class="btn block" data-act="nut-copy-day">${icon('copy')}Gestern komplett übernehmen</button>`}`;
}

function macroBar(label, val, goal, color) {
  const pct = goal ? Math.min(100, (val / goal) * 100) : 0;
  return `<div class="macro"><div class="lbl"><span>${label}</span></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
    <div class="lbl"><b class="num">${fmt(val)}</b><span class="num">/ ${fmt(goal)} g</span></div></div>`;
}

function mealCard(d, i) {
  const entries = d.entries.filter((e) => e.meal === i);
  const t = totals(entries);
  return `<div class="card meal-card">
    <div class="mh"><h3>${esc(mealName(i))}</h3><span class="k">${fmt(t.kcal)}</span><span class="tiny muted">kcal</span></div>
    ${entries.length ? `<div class="entries">${entries.map((e) => {
      const n = entryNut(e);
      return `<button class="li" data-act="entry-edit" data-id="${e.id}">
        <div class="grow"><div class="t ellipsis">${esc(e.name)}</div>
          <div class="s ellipsis">${e.unit === 'quick' ? 'Schnelleintrag' : `${e.brand ? `${esc(e.brand)}, ` : ''}${fmtMax(e.amount, 1)} ${unitLbl(e.unit)}`} · E ${fmt(n.protein)} · K ${fmt(n.carbs)} · F ${fmt(n.fat)}</div></div>
        <div class="r num" style="font-weight:600">${fmt(n.kcal)}</div></button>`;
    }).join('')}</div>` : ''}
    <div class="mf">
      <button class="link" data-act="food-add" data-meal="${i}">${icon('plus')} Hinzufügen</button>
      <button class="icon-btn sm plain" data-act="meal-menu" data-meal="${i}" aria-label="Mehr">${icon('more')}</button>
    </div>
  </div>`;
}

onAct({
  'nut-day': (el) => { nutDate = addDays(nutDate, +el.dataset.d); save({ silent: true }); window.dispatchEvent(new Event('rerender')); },
  'food-add': (el) => openAddFood({ meal: +el.dataset.meal }),
  'entry-edit': (el) => {
    const e = dayDiary(nutDate).entries.find((x) => x.id === el.dataset.id);
    if (!e) return;
    if (e.unit === 'quick') openQuickAdd({ meal: e.meal, entry: e });
    else openAmount({ food: foodById(e.foodId) || entryAsFood(e), meal: e.meal, entry: e });
  },
  'meal-menu': async (el) => {
    const i = +el.dataset.meal;
    const entries = dayDiary(nutDate).entries.filter((e) => e.meal === i);
    const v = await menuDialog({
      title: mealName(i),
      options: [
        { label: 'Von gestern kopieren', icon: 'copy', value: 'copy' },
        ...(entries.length ? [{ label: 'Als Mahlzeit speichern', icon: 'save', value: 'save' }, { label: 'Alle Einträge löschen', icon: 'trash', value: 'clear', danger: true }] : []),
        { label: 'Schnelleintrag (nur Kalorien)', icon: 'bolt', value: 'quick' },
      ],
    });
    if (v === 'copy') {
      const prev = dayDiary(addDays(nutDate, -1)).entries.filter((e) => e.meal === i);
      if (!prev.length) { toast('Gestern war diese Mahlzeit leer'); return; }
      const d = ensureDiary(nutDate);
      prev.forEach((e) => d.entries.push({ ...e, id: uid(), per100: { ...e.per100 } }));
      save(); toast(`${prev.length} Einträge kopiert`);
    }
    if (v === 'save') openMealEditor(null, entries.filter((e) => e.foodId && foodById(e.foodId)).map((e) => ({ foodId: e.foodId, amount: e.amount })), mealName(i));
    if (v === 'clear' && (await confirmDialog({ title: `${mealName(i)} leeren?`, ok: 'Löschen', danger: true }))) {
      const d = ensureDiary(nutDate);
      d.entries = d.entries.filter((e) => e.meal !== i);
      save();
    }
    if (v === 'quick') openQuickAdd({ meal: i });
  },
  'nut-copy-day': () => {
    const prev = dayDiary(addDays(nutDate, -1)).entries;
    if (!prev.length) { toast('Gestern gibt es keine Einträge'); return; }
    const d = ensureDiary(nutDate);
    prev.forEach((e) => d.entries.push({ ...e, id: uid(), per100: { ...e.per100 } }));
    save(); toast(`${prev.length} Einträge übernommen`);
  },
});
onChange({ 'nut-date': (el) => { if (el.value) { nutDate = el.value; window.dispatchEvent(new Event('rerender')); } } });

function entryAsFood(e) {
  return { id: null, name: e.name, brand: e.brand, unit: e.unit, servings: [], ...e.per100 };
}

// =====================================================================
// Lebensmittel hinzufügen (Suche, Zuletzt, Eigene, Mahlzeiten, Online)
// =====================================================================
/**
 * opts: { meal } – fügt ins Tagebuch (nutDate) ein
 *       { pick(foodId, grams) } – Auswahlmodus für den Mahlzeiten-Baukasten
 */
function openAddFood(opts) {
  const ui = { tab: 'recent', q: '', online: [], onlineState: 'idle', onlineQ: '' };
  const picking = !!opts.pick;
  const tabs = [['recent', 'Zuletzt'], ['mine', 'Lebensmittel'], ...(picking ? [] : [['meals', 'Mahlzeiten']]), ['online', 'Online']];
  openSheet({
    id: 'add-food',
    ui, opts,
    render: () => ({
      title: picking ? 'Lebensmittel wählen' : mealName(opts.meal),
      top: `<div style="padding:10px 16px 0;background:var(--bg);display:flex;flex-direction:column;gap:10px">
          <form data-submit="af-search" class="search">${icon('search')}<input class="input" id="af-q" type="search" enterkeyhint="search" placeholder="${ui.tab === 'online' ? 'Produkt online suchen …' : 'Lebensmittel suchen'}" value="${esc(ui.q)}" data-in="af-q" autocomplete="off"></form>
          <div class="tabs-line">${tabs.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="af-tab" data-k="${k}">${l}</button>`).join('')}</div>
        </div>`,
      body: `
        ${ui.tab !== 'meals' ? `<div class="quick-row">
          <button class="btn" data-act="scan-open">${icon('barcode')}Barcode</button>
          <button class="btn" data-act="food-new">${icon('plus')}Neues Lebensmittel</button>
          ${picking ? '<span></span>' : `<button class="btn" data-act="quick-open">${icon('bolt')}Schnelleintrag</button>`}
        </div>` : `<button class="btn block" data-act="meal-new">${icon('plus')}Neue Mahlzeit zusammenstellen</button>`}
        <div class="list" id="af-list">${addFoodList(ui)}</div>`,
    }),
  });
}

function foodRow(f, extra = '') {
  return `<button class="li" data-act="af-pick" data-id="${f.id}" ${extra}>
    <div class="grow"><div class="t ellipsis">${esc(f.name)}</div>
      <div class="s ellipsis">${f.brand ? `${esc(f.brand)} · ` : ''}${fmt(f.kcal)} kcal / 100 ${unitLbl(f.unit)}${f.servings?.[0] ? ` · ${esc(f.servings[0].name)} = ${fmtMax(f.servings[0].grams)} ${unitLbl(f.unit)}` : ''}</div></div>
    <span class="icon-btn sm" style="background:var(--food-soft);color:var(--food)">${icon('plus')}</span></button>`;
}

function addFoodList(ui) {
  const q = ui.q.trim().toLowerCase();
  const match = (f) => !q || f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q);
  if (ui.tab === 'recent') {
    const list = state.recentFoods.map(foodById).filter(Boolean).filter(match);
    if (!list.length && !q) return '<div class="empty">Hier erscheinen die zuletzt verwendeten Lebensmittel.</div>';
    const rest = q ? state.foods.filter((f) => match(f) && !list.includes(f)) : [];
    return list.map((f) => foodRow(f)).join('') + rest.slice(0, 40).map((f) => foodRow(f)).join('') || noMatch(ui);
  }
  if (ui.tab === 'mine') {
    const list = state.foods.filter(match).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return list.map((f) => foodRow(f)).join('') || noMatch(ui);
  }
  if (ui.tab === 'meals') {
    const list = state.meals.filter((m) => !q || m.name.toLowerCase().includes(q));
    if (!list.length) return '<div class="empty">Stell dir wiederkehrende Mahlzeiten zusammen (z. B. „Overnight Oats“) und füge sie mit einem Tipp hinzu.</div>';
    return list.map((m) => {
      const t = mealTotals(m);
      return `<div class="li">
        <button class="grow" data-act="meal-log" data-id="${m.id}" style="background:none;border:0;text-align:left;padding:0;min-width:0">
          <div class="t ellipsis">${esc(m.name)}</div><div class="s">${m.items.length} Zutaten · ${fmt(t.kcal)} kcal · E ${fmt(t.protein)} g</div></button>
        <button class="icon-btn sm plain" data-act="meal-edit" data-id="${m.id}" aria-label="Bearbeiten">${icon('edit')}</button>
        <button class="icon-btn sm" data-act="meal-log" data-id="${m.id}" style="background:var(--food-soft);color:var(--food)" aria-label="Hinzufügen">${icon('plus')}</button>
      </div>`;
    }).join('');
  }
  // online
  if (ui.onlineState === 'loading') return '<div class="empty">Suche in Open Food Facts …</div>';
  if (ui.onlineState === 'error') return `<div class="empty">Online-Suche nicht erreichbar. Prüfe die Internetverbindung oder lege das Lebensmittel selbst an.<br><button class="link" data-act="food-new">Lebensmittel anlegen</button></div>`;
  if (ui.onlineState === 'idle') return '<div class="empty">Suchbegriff eingeben und Enter drücken. Durchsucht die freie Datenbank Open Food Facts (Supermarktprodukte, Marken).</div>';
  if (!ui.online.length) return noMatch(ui);
  return ui.online.map((f, i) => `<button class="li" data-act="af-pick-online" data-i="${i}">
    <div class="grow"><div class="t ellipsis">${esc(f.name)}</div><div class="s ellipsis">${f.brand ? `${esc(f.brand)} · ` : ''}${fmt(f.kcal)} kcal / 100 ${unitLbl(f.unit)} · E ${fmtMax(f.protein, 1)} K ${fmtMax(f.carbs, 1)} F ${fmtMax(f.fat, 1)}</div></div>
    <span class="icon-btn sm" style="background:var(--food-soft);color:var(--food)">${icon('plus')}</span></button>`).join('');
}
function noMatch(ui) {
  return `<div class="empty">Nichts gefunden.${ui.tab !== 'online' ? '<br><button class="link" data-act="af-tab" data-k="online">Online suchen</button> oder ' : '<br>'}<button class="link" data-act="food-new">selbst anlegen</button></div>`;
}
function refreshAfList() {
  const s = spec('add-food');
  if (s) document.getElementById('af-list').innerHTML = addFoodList(s.ui);
}

onAct({
  'af-tab': (el) => {
    const s = spec('add-food'); if (!s) return;
    s.ui.tab = el.dataset.k;
    if (s.ui.tab === 'online' && s.ui.q.trim() && s.ui.onlineQ !== s.ui.q.trim()) runOnline(s);
    redraw(s);
  },
  'af-search': () => {
    const s = spec('add-food'); if (!s) return;
    if (s.ui.tab !== 'online') { s.ui.tab = 'online'; redraw(s); }
    runOnline(s);
    document.getElementById('af-q')?.blur();
  },
  'af-pick': (el) => {
    const s = spec('add-food'); if (!s) return;
    openAmount({ food: foodById(el.dataset.id), meal: s.opts.meal, pick: s.opts.pick });
  },
  'af-pick-online': (el) => {
    const s = spec('add-food'); if (!s) return;
    openAmount({ food: s.ui.online[+el.dataset.i], meal: s.opts.meal, pick: s.opts.pick });
  },
  'quick-open': () => { const s = spec('add-food'); openQuickAdd({ meal: s?.opts.meal ?? 0 }); },
  'food-new': () => {
    const s = spec('add-food');
    openFoodEditor(null, { name: s?.ui.q || '' }, (food) => { if (s) openAmount({ food, meal: s.opts.meal, pick: s.opts.pick }); });
  },
  'scan-open': () => {
    const s = spec('add-food');
    openScanner((code) => lookupBarcode(code, s ? s.opts : { meal: 0 }));
  },
});
onInput({
  'af-q': (el) => {
    const s = spec('add-food'); if (!s) return;
    s.ui.q = el.value;
    if (s.ui.tab !== 'online') refreshAfList();
  },
});
const redraw = (s) => redrawSheet(s);

// ---------- Open Food Facts ----------
const OFF_FIELDS = 'code,product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,serving_size,quantity';
function offToFood(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
  if (kcal == null) return null;
  const name = (p.product_name_de || p.product_name || p.generic_name || '').trim();
  if (!name) return null;
  const sq = parseFloat(p.serving_quantity);
  const unit = /ml|l\b/i.test(p.quantity || '') && !/g\b/i.test(p.quantity || '') ? 'ml' : 'g';
  return {
    id: null, name, brand: (p.brands || '').split(',')[0].trim(), unit,
    kcal: round(kcal, 0), protein: round(+n.proteins_100g || 0, 1), carbs: round(+n.carbohydrates_100g || 0, 1), fat: round(+n.fat_100g || 0, 1),
    servings: sq > 0 ? [{ name: p.serving_size ? `1 Portion (${p.serving_size})` : '1 Portion', grams: sq }] : [],
    barcode: p.code || '', source: 'openfoodfacts',
  };
}
async function runOnline(s) {
  const q = s.ui.q.trim();
  if (!q) return;
  s.ui.onlineQ = q;
  s.ui.onlineState = 'loading';
  refreshAfList();
  try {
    const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=40&fields=${OFF_FIELDS}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    s.ui.online = (data.products || []).map(offToFood).filter(Boolean);
    s.ui.onlineState = 'done';
  } catch (e) {
    console.warn(e);
    s.ui.onlineState = 'error';
  }
  refreshAfList();
}
async function fetchBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.status === 1 && data.product ? offToFood({ ...data.product, code }) : null;
}
async function lookupBarcode(code, opts) {
  code = String(code).trim();
  if (!code) return;
  const local = state.foods.find((f) => f.barcode === code);
  if (local) { openAmount({ food: local, meal: opts.meal, pick: opts.pick }); return; }
  toast('Suche Produkt …');
  let food = null;
  try { food = await fetchBarcode(code); } catch (e) { console.warn(e); }
  if (food) openAmount({ food, meal: opts.meal, pick: opts.pick });
  else {
    toast('Produkt nicht gefunden – bitte selbst anlegen', 3000);
    openFoodEditor(null, { barcode: code }, (f) => openAmount({ food: f, meal: opts.meal, pick: opts.pick }));
  }
}

// ---------- Barcode-Scanner ----------
function openScanner(onCode) {
  let stream = null, raf = null, zx = null, stopped = false;
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    try { zx?.reset?.(); } catch {}
    stream?.getTracks().forEach((t) => t.stop());
  };
  const s = openSheet({
    id: 'scanner',
    render: () => ({
      title: 'Barcode scannen',
      body: `
        <video class="scan-video" id="scan-video" playsinline muted></video>
        <div class="small muted" id="scan-msg">Kamera wird gestartet …</div>
        <form class="row" data-submit="scan-manual">
          <input class="input grow" id="scan-code" inputmode="numeric" placeholder="Oder Barcode-Nummer eingeben" autocomplete="off">
          <button class="btn food">Suchen</button>
        </form>`,
    }),
    onClose: stop,
    found: (code) => { if (stopped) return; stop(); closeSheet(s); onCode(code); },
  });
  const video = s.el.querySelector('#scan-video');
  const msg = (t) => { const m = s.el.querySelector('#scan-msg'); if (m) m.textContent = t; };
  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) { msg('Kamera nicht verfügbar – gib die Nummer unten ein.'); return; }
    try {
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        await video.play();
        msg('Halte den Barcode ins Bild.');
        const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const loop = async () => {
          if (stopped) return;
          try { const codes = await det.detect(video); if (codes[0]) { s.found(codes[0].rawValue); return; } } catch {}
          raf = requestAnimationFrame(loop);
        };
        loop();
      } else {
        msg('Scanner wird geladen …');
        await loadScript('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js');
        if (stopped) return;
        zx = new window.ZXing.BrowserMultiFormatReader();
        msg('Halte den Barcode ins Bild.');
        zx.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (result) => { if (result) s.found(result.getText()); });
      }
    } catch (e) {
      console.warn(e);
      msg('Kein Kamerazugriff – gib die Nummer unten ein.');
    }
  })();
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((x) => x.src === src)) { res(); return; }
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = rej;
    document.head.appendChild(el);
  });
}
onAct({
  'scan-manual': () => { const v = document.getElementById('scan-code')?.value; if (v) spec('scanner')?.found(v); },
});

// =====================================================================
// Menge wählen
// =====================================================================
/**
 * { food, meal, entry? (bearbeiten), pick? (Auswahlmodus) , grams? }
 */
function openAmount({ food, meal = 0, entry = null, pick = null, grams = null }) {
  const servings = food.servings || [];
  // Startwerte: bestehender Eintrag, sonst erste Portion, sonst 100 g
  let unitIdx = -1, qty = 100;
  if (entry || grams != null) { qty = entry ? entry.amount : grams; }
  else if (servings[0]) { unitIdx = 0; qty = 1; }
  const ui = { unitIdx, qty, meal };
  const gramsOf = () => (ui.unitIdx < 0 ? ui.qty : ui.qty * servings[ui.unitIdx].grams);
  const nutHtml = () => {
    const f = gramsOf() / 100, p = foodPer100(food);
    return `<div><div class="v" style="color:var(--food)">${fmt(p.kcal * f)}</div><div class="l">kcal</div></div>
      <div><div class="v">${fmtMax(p.protein * f, 1)}</div><div class="l">Eiweiß g</div></div>
      <div><div class="v">${fmtMax(p.carbs * f, 1)}</div><div class="l">Kohlenh. g</div></div>
      <div><div class="v">${fmtMax(p.fat * f, 1)}</div><div class="l">Fett g</div></div>`;
  };
  openSheet({
    id: 'amount',
    ui, food, entry, pick, gramsOf, nutHtml,
    render: () => ({
      title: entry ? 'Eintrag bearbeiten' : 'Menge',
      right: entry ? `<button class="icon-btn plain" data-act="amt-delete" aria-label="Löschen">${icon('trash')}</button>` : (food.id ? `<button class="icon-btn plain" data-act="amt-food-edit" aria-label="Lebensmittel bearbeiten">${icon('edit')}</button>` : '<span style="width:40px"></span>'),
      body: `
        <div><div style="font-size:19px;font-weight:600">${esc(food.name)}</div>
          <div class="small muted">${food.brand ? `${esc(food.brand)} · ` : ''}${fmt(food.kcal)} kcal je 100 ${unitLbl(food.unit)}${food.source === 'openfoodfacts' ? ' · Open Food Facts' : ''}</div></div>
        <div class="nut-grid" id="amt-nut">${nutHtml()}</div>
        <div class="grid2">
          <label class="field"><span>Menge</span><input class="input" id="amt-qty" type="text" inputmode="decimal" value="${fmtMax(ui.qty, 2)}" data-in="amt-qty" autocomplete="off"></label>
          <label class="field"><span>Einheit</span><select class="input" data-ch="amt-unit">
            <option value="-1" ${ui.unitIdx < 0 ? 'selected' : ''}>${unitLbl(food.unit)}</option>
            ${servings.map((sv, i) => `<option value="${i}" ${ui.unitIdx === i ? 'selected' : ''}>${esc(sv.name)} (${fmtMax(sv.grams)} ${unitLbl(food.unit)})</option>`).join('')}
          </select></label>
        </div>
        ${pick ? '' : `<label class="field"><span>Mahlzeit</span><select class="input" data-ch="amt-meal">${state.settings.mealNames.map((n, i) => `<option value="${i}" ${ui.meal === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`}
        <div class="row wrap" style="gap:6px">${[50, 100, 150, 200, 250].map((g) => `<button class="btn sm" data-act="amt-preset" data-g="${g}">${g} ${unitLbl(food.unit)}</button>`).join('')}</div>`,
      foot: `<button class="btn food block lg" data-act="amt-save">${icon('check')}${entry ? 'Speichern' : pick ? 'Übernehmen' : 'Hinzufügen'}</button>`,
    }),
    afterRender: (s, first) => { if (first) { const i = s.el.querySelector('#amt-qty'); i.focus(); i.select(); } },
  });
}
onInput({
  'amt-qty': (el) => {
    const s = spec('amount'); if (!s) return;
    s.ui.qty = parseNum(el.value) ?? 0;
    document.getElementById('amt-nut').innerHTML = s.nutHtml();
  },
});
onChange({
  'amt-unit': (el) => {
    const s = spec('amount'); if (!s) return;
    const prevGrams = s.gramsOf();
    s.ui.unitIdx = +el.value;
    s.ui.qty = s.ui.unitIdx < 0 ? round(prevGrams, 1) : 1;
    document.getElementById('amt-qty').value = fmtMax(s.ui.qty, 2);
    document.getElementById('amt-nut').innerHTML = s.nutHtml();
  },
  'amt-meal': (el) => { const s = spec('amount'); if (s) s.ui.meal = +el.value; },
});
onAct({
  'amt-preset': (el) => {
    const s = spec('amount'); if (!s) return;
    s.ui.unitIdx = -1; s.ui.qty = +el.dataset.g;
    redrawSheet(s);
  },
  'amt-save': () => {
    const s = spec('amount'); if (!s) return;
    const grams = round(s.gramsOf(), 1);
    if (!(grams > 0)) { toast('Bitte eine Menge eingeben'); return; }
    let food = s.food;
    // Online-Produkt beim ersten Verwenden in "Meine Lebensmittel" übernehmen
    if (!food.id) {
      const existing = food.barcode && state.foods.find((f) => f.barcode === food.barcode);
      if (existing) food = existing;
      else { food = { ...food, id: uid() }; state.foods.push(food); }
    }
    touchRecent(food.id);
    if (s.pick) {
      closeSheet(s);
      if (spec('add-food')) closeSheet();
      s.pick(food.id, grams);
      save();
      return;
    }
    if (s.entry) {
      s.entry.amount = grams;
      s.entry.meal = s.ui.meal;
    } else {
      ensureDiary(nutDate).entries.push(makeEntry(food, grams, s.ui.meal));
      toast(`${food.name} → ${mealName(s.ui.meal)}`);
    }
    closeSheet(s);
    if (!s.entry && spec('add-food')) closeSheet();
    save();
  },
  'amt-delete': () => {
    const s = spec('amount'); if (!s) return;
    const d = ensureDiary(nutDate);
    d.entries = d.entries.filter((e) => e.id !== s.entry.id);
    closeSheet(s);
    save();
  },
  'amt-food-edit': () => { const s = spec('amount'); if (s) openFoodEditor(s.food.id, null, () => { closeSheet(s); }); },
});

// =====================================================================
// Schnelleintrag
// =====================================================================
function openQuickAdd({ meal, entry = null }) {
  const v = entry ? entry.per100 : { kcal: '', protein: '', carbs: '', fat: '' };
  openSheet({
    id: 'quick',
    render: () => ({
      title: 'Schnelleintrag',
      right: entry ? `<button class="icon-btn plain" data-act="quick-delete" data-id="${entry.id}" aria-label="Löschen">${icon('trash')}</button>` : '<span style="width:40px"></span>',
      body: `<form class="stack" id="quick-form" data-submit="quick-save">
        <label class="field"><span>Bezeichnung (optional)</span><input class="input" name="name" value="${esc(entry && entry.name !== 'Schnelleintrag' ? entry.name : '')}" placeholder="z. B. Restaurant"></label>
        <label class="field"><span>Kalorien (kcal)</span><input class="input" name="kcal" id="q-kcal" inputmode="decimal" value="${v.kcal === '' ? '' : fmtMax(v.kcal)}" required></label>
        <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
          <label class="field"><span>Eiweiß g</span><input class="input" name="protein" inputmode="decimal" value="${v.protein === '' ? '' : fmtMax(v.protein, 1)}"></label>
          <label class="field"><span>Kohlenh. g</span><input class="input" name="carbs" inputmode="decimal" value="${v.carbs === '' ? '' : fmtMax(v.carbs, 1)}"></label>
          <label class="field"><span>Fett g</span><input class="input" name="fat" inputmode="decimal" value="${v.fat === '' ? '' : fmtMax(v.fat, 1)}"></label>
        </div>
        <label class="field"><span>Mahlzeit</span><select class="input" name="meal">${state.settings.mealNames.map((n, i) => `<option value="${i}" ${meal === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      </form>`,
      foot: `<button class="btn food block lg" data-act="quick-save">${icon('check')}Speichern</button>`,
    }),
    afterRender: (s, first) => { if (first && !entry) s.el.querySelector('#q-kcal').focus(); },
    entry,
  });
}
onAct({
  'quick-save': () => {
    const s = spec('quick'); if (!s) return;
    const fd = new FormData(document.getElementById('quick-form'));
    const kcal = parseNum(fd.get('kcal'));
    if (!(kcal > 0)) { toast('Bitte Kalorien eingeben'); return; }
    const per100 = { kcal, protein: parseNum(fd.get('protein')) || 0, carbs: parseNum(fd.get('carbs')) || 0, fat: parseNum(fd.get('fat')) || 0 };
    const name = String(fd.get('name')).trim() || 'Schnelleintrag';
    const meal = +fd.get('meal');
    if (s.entry) Object.assign(s.entry, { per100, name, meal });
    else ensureDiary(nutDate).entries.push({ id: uid(), meal, foodId: null, name, brand: '', unit: 'quick', amount: 100, per100 });
    closeSheet(s);
    if (spec('add-food')) closeSheet();
    save();
  },
  'quick-delete': (el) => {
    const d = ensureDiary(nutDate);
    d.entries = d.entries.filter((e) => e.id !== el.dataset.id);
    closeSheet();
    save();
  },
});

// =====================================================================
// Lebensmittel anlegen / bearbeiten
// =====================================================================
export function openFoodEditor(id, preset = null, onSaved = null) {
  const f = id ? foodById(id) : null;
  const d = f ? { ...f, servings: [...(f.servings || [])] } : { name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '', unit: 'g', servings: [], barcode: '', ...(preset || {}) };
  const sv = d.servings[0] || { name: '', grams: '' };
  openSheet({
    id: 'food-editor',
    render: () => ({
      title: f ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel',
      right: f ? `<button class="icon-btn plain" data-act="food-delete" data-id="${f.id}" aria-label="Löschen">${icon('trash')}</button>` : '<span style="width:40px"></span>',
      body: `<form class="stack" id="food-form" data-submit="food-save">
        <label class="field"><span>Name</span><input class="input" name="name" id="ff-name" required value="${esc(d.name)}" placeholder="z. B. Proteinriegel Cookie"></label>
        <div class="grid2">
          <label class="field"><span>Marke (optional)</span><input class="input" name="brand" value="${esc(d.brand)}"></label>
          <label class="field"><span>Einheit</span><select class="input" name="unit"><option value="g" ${d.unit !== 'ml' ? 'selected' : ''}>Gramm (g)</option><option value="ml" ${d.unit === 'ml' ? 'selected' : ''}>Milliliter (ml)</option></select></label>
        </div>
        <h2 class="sec">Nährwerte je 100 g / ml</h2>
        <div class="grid2">
          <label class="field"><span>Kalorien kcal</span><input class="input" name="kcal" inputmode="decimal" required value="${d.kcal === '' ? '' : fmtMax(d.kcal, 1)}"></label>
          <label class="field"><span>Eiweiß g</span><input class="input" name="protein" inputmode="decimal" value="${d.protein === '' ? '' : fmtMax(d.protein, 1)}"></label>
          <label class="field"><span>Kohlenhydrate g</span><input class="input" name="carbs" inputmode="decimal" value="${d.carbs === '' ? '' : fmtMax(d.carbs, 1)}"></label>
          <label class="field"><span>Fett g</span><input class="input" name="fat" inputmode="decimal" value="${d.fat === '' ? '' : fmtMax(d.fat, 1)}"></label>
        </div>
        <h2 class="sec">Portion (optional)</h2>
        <div class="grid2">
          <label class="field"><span>Bezeichnung</span><input class="input" name="svName" value="${esc(sv.name)}" placeholder="z. B. 1 Riegel"></label>
          <label class="field"><span>Menge in g / ml</span><input class="input" name="svGrams" inputmode="decimal" value="${sv.grams === '' ? '' : fmtMax(sv.grams, 1)}" placeholder="45"></label>
        </div>
        <label class="field"><span>Barcode (optional)</span><input class="input" name="barcode" inputmode="numeric" value="${esc(d.barcode)}"></label>
      </form>`,
      foot: `<button class="btn food block lg" data-act="food-save">${icon('check')}Speichern</button>`,
    }),
    afterRender: (s, first) => { if (first && !f) s.el.querySelector('#ff-name').focus(); },
    save: () => {
      const fd = new FormData(document.getElementById('food-form'));
      const name = String(fd.get('name')).trim();
      const kcal = parseNum(fd.get('kcal'));
      if (!name || kcal == null) { toast('Name und Kalorien sind Pflicht'); return; }
      const svName = String(fd.get('svName')).trim(), svGrams = parseNum(fd.get('svGrams'));
      const extra = (f?.servings || d.servings).slice(1);
      const data = {
        name, brand: String(fd.get('brand')).trim(), unit: fd.get('unit'), kcal,
        protein: parseNum(fd.get('protein')) || 0, carbs: parseNum(fd.get('carbs')) || 0, fat: parseNum(fd.get('fat')) || 0,
        servings: svGrams > 0 ? [{ name: svName || '1 Portion', grams: svGrams }, ...extra] : extra,
        barcode: String(fd.get('barcode')).trim(),
      };
      let food = f;
      if (f) Object.assign(f, data);
      else { food = { id: uid(), source: 'eigene', ...data }; state.foods.push(food); }
      closeSheet();
      save();
      onSaved?.(food);
    },
  });
}
onAct({
  'food-save': () => spec('food-editor')?.save(),
  'food-delete': async (el) => {
    const f = foodById(el.dataset.id);
    if (!(await confirmDialog({ title: `„${f.name}“ löschen?`, text: 'Bereits eingetragene Tagebuch-Einträge bleiben erhalten.', ok: 'Löschen', danger: true }))) return;
    state.foods = state.foods.filter((x) => x.id !== f.id);
    state.recentFoods = state.recentFoods.filter((x) => x !== f.id);
    state.meals.forEach((m) => { m.items = m.items.filter((i) => i.foodId !== f.id); });
    closeSheet();
    if (spec('amount')) closeSheet();
    save();
  },
});

// =====================================================================
// Eigene Mahlzeiten (wiederkehrende Kombinationen)
// =====================================================================
export function openMealEditor(id, presetItems = null, presetName = '') {
  let meal = id ? state.meals.find((m) => m.id === id) : null;
  if (!meal) {
    meal = { id: uid(), name: presetName ? `Mein ${presetName}` : '', items: presetItems || [], _new: true };
  }
  openSheet({
    id: 'meal-editor',
    meal,
    render: () => {
      const t = mealTotals(meal);
      return {
        title: meal._new ? 'Neue Mahlzeit' : 'Mahlzeit bearbeiten',
        right: !meal._new ? `<button class="icon-btn plain" data-act="meal-delete" aria-label="Löschen">${icon('trash')}</button>` : '<span style="width:40px"></span>',
        body: `
          <label class="field"><span>Name</span><input class="input" id="meal-name" value="${esc(meal.name)}" data-in="meal-name" placeholder="z. B. Overnight Oats"></label>
          <div class="nut-grid">
            <div><div class="v" style="color:var(--food)">${fmt(t.kcal)}</div><div class="l">kcal</div></div>
            <div><div class="v">${fmt(t.protein)}</div><div class="l">Eiweiß g</div></div>
            <div><div class="v">${fmt(t.carbs)}</div><div class="l">Kohlenh. g</div></div>
            <div><div class="v">${fmt(t.fat)}</div><div class="l">Fett g</div></div>
          </div>
          <h2 class="sec">Zutaten</h2>
          ${meal.items.length ? `<div class="card" style="padding:4px 14px"><div class="list">${meal.items.map((it, i) => {
            const f = foodById(it.foodId);
            if (!f) return '';
            return `<div class="li">
              <div class="grow"><div class="t ellipsis">${esc(f.name)}</div><div class="s">${fmt((f.kcal * it.amount) / 100)} kcal</div></div>
              <input class="input" style="width:84px;text-align:right;min-height:38px" inputmode="decimal" value="${fmtMax(it.amount, 1)}" data-ch="meal-item-amt" data-i="${i}" aria-label="Menge">
              <span class="small muted" style="width:20px">${unitLbl(f.unit)}</span>
              <button class="icon-btn sm plain" data-act="meal-item-del" data-i="${i}" aria-label="Entfernen">${icon('x')}</button>
            </div>`;
          }).join('')}</div></div>` : '<div class="card flat"><div class="empty">Noch keine Zutaten.</div></div>'}
          <button class="btn block" data-act="meal-item-add">${icon('plus')}Zutat hinzufügen</button>`,
        foot: `<button class="btn food block lg" data-act="meal-save">${icon('check')}Mahlzeit speichern</button>`,
      };
    },
  });
}
const mealSpec = () => spec('meal-editor');
onInput({ 'meal-name': (el) => { const s = mealSpec(); if (s) s.meal.name = el.value; } });
onChange({
  'meal-item-amt': (el) => {
    const s = mealSpec(); if (!s) return;
    s.meal.items[+el.dataset.i].amount = parseNum(el.value) || 0;
    redrawSheet(s);
  },
});
onAct({
  'meal-new': () => openMealEditor(null),
  'meal-edit': (el) => openMealEditor(el.dataset.id),
  'meal-item-add': () => {
    const s = mealSpec(); if (!s) return;
    openAddFood({ pick: (foodId, grams) => { s.meal.items.push({ foodId, amount: grams }); redrawSheet(s); } });
  },
  'meal-item-del': (el) => {
    const s = mealSpec(); if (!s) return;
    s.meal.items.splice(+el.dataset.i, 1);
    redrawSheet(s);
  },
  'meal-save': () => {
    const s = mealSpec(); if (!s) return;
    const m = s.meal;
    if (!m.name.trim()) { toast('Bitte einen Namen eingeben'); return; }
    if (!m.items.length) { toast('Füge mindestens eine Zutat hinzu'); return; }
    m.name = m.name.trim();
    if (m._new) { delete m._new; state.meals.push(m); }
    closeSheet(s);
    save();
    toast('Mahlzeit gespeichert');
  },
  'meal-delete': async () => {
    const s = mealSpec(); if (!s) return;
    if (!(await confirmDialog({ title: `„${s.meal.name}“ löschen?`, ok: 'Löschen', danger: true }))) return;
    state.meals = state.meals.filter((m) => m.id !== s.meal.id);
    closeSheet(s);
    save();
  },
  'meal-log': (el) => {
    const s = spec('add-food');
    const m = state.meals.find((x) => x.id === el.dataset.id);
    if (!m || !s) return;
    const d = ensureDiary(nutDate);
    let n = 0;
    for (const it of m.items) {
      const f = foodById(it.foodId);
      if (!f) continue;
      d.entries.push(makeEntry(f, it.amount, s.opts.meal));
      touchRecent(f.id);
      n++;
    }
    closeSheet(s);
    save();
    toast(`${m.name} (${n} Zutaten) → ${mealName(s.opts.meal)}`);
  },
});

// =====================================================================
// Ziele
// =====================================================================
export function openGoals() {
  const g = state.settings.goals;
  openSheet({
    id: 'goals',
    render: () => ({
      title: 'Ernährungsziele',
      body: `<form class="stack" id="goals-form" data-submit="goals-save">
        <label class="field"><span>Kalorienziel (kcal pro Tag)</span><input class="input" name="kcal" inputmode="numeric" value="${g.kcal}" data-in="goals-calc"></label>
        <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
          <label class="field"><span>Eiweiß g</span><input class="input" name="protein" inputmode="numeric" value="${g.protein}" data-in="goals-calc"></label>
          <label class="field"><span>Kohlenh. g</span><input class="input" name="carbs" inputmode="numeric" value="${g.carbs}" data-in="goals-calc"></label>
          <label class="field"><span>Fett g</span><input class="input" name="fat" inputmode="numeric" value="${g.fat}" data-in="goals-calc"></label>
        </div>
        <div class="small muted" id="goals-hint"></div>
        <h2 class="sec">Mahlzeiten</h2>
        ${state.settings.mealNames.map((n, i) => `<label class="field"><span>Mahlzeit ${i + 1}</span><input class="input" name="meal${i}" value="${esc(n)}"></label>`).join('')}
      </form>`,
      foot: `<button class="btn food block lg" data-act="goals-save">${icon('check')}Speichern</button>`,
    }),
    afterRender: () => goalsHint(),
  });
}
function goalsHint() {
  const f = document.getElementById('goals-form'); if (!f) return;
  const fd = new FormData(f);
  const p = parseNum(fd.get('protein')) || 0, c = parseNum(fd.get('carbs')) || 0, fa = parseNum(fd.get('fat')) || 0;
  const k = p * 4 + c * 4 + fa * 9;
  const goal = parseNum(fd.get('kcal')) || 0;
  document.getElementById('goals-hint').textContent = `Makros ergeben ${fmt(k)} kcal (${goal ? signed0(k - goal) : '–'} zum Ziel). Eiweiß und Kohlenhydrate 4 kcal/g, Fett 9 kcal/g.`;
}
const signed0 = (n) => (n > 0 ? `+${fmt(n)}` : fmt(n));
onInput({ 'goals-calc': () => goalsHint() });
onAct({
  'nut-goals': () => openGoals(),
  'goals-save': () => {
    const fd = new FormData(document.getElementById('goals-form'));
    const g = state.settings.goals;
    for (const k of ['kcal', 'protein', 'carbs', 'fat']) { const v = parseNum(fd.get(k)); if (v != null && v >= 0) g[k] = Math.round(v); }
    state.settings.mealNames = state.settings.mealNames.map((n, i) => String(fd.get(`meal${i}`) || '').trim() || n);
    closeSheet();
    save();
    toast('Ziele gespeichert');
  },
});
