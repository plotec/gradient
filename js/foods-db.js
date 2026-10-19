// Große Lebensmittel-Datenbank: Bundeslebensmittelschlüssel (BLS 4.0, Max Rubner-Institut, CC BY 4.0).
// Quelle 1: data/bls.json (wird beim Veröffentlichen automatisch erzeugt, siehe tools/fetch_bls.py)
// Quelle 2: Import der Original-Datei (ZIP oder XLSX) in den Einstellungen.
// Gespeichert wird je Gerät in IndexedDB; Format je Eintrag: [code, name, kcal, eiweiß, kohlenhydrate, fett]

const DB_NAME = 'formkurve';
const STORE = 'kv';
export const BLS_CREDIT = 'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0. Karlsruhe. Lizenz CC BY 4.0';

let items = null;       // geladene Einträge
let index = null;       // normalisierte Namen
let loading = null;

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key); t.onsuccess = () => res(); t.onerror = () => rej(t.error); });
}

export const norm = (s) => String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function setItems(list) {
  items = list;
  index = list.map((it) => norm(it[1]));
}

/** Lädt die Datenbank (einmal pro Sitzung). Liefert Anzahl Einträge (0 = nicht vorhanden). */
export function loadBls() {
  if (items) return Promise.resolve(items.length);
  loading ||= (async () => {
    try {
      const cached = await idbGet('bls');
      if (cached?.items?.length) { setItems(cached.items); return items.length; }
    } catch {}
    try {
      const res = await fetch('data/bls.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length) {
          setItems(data.items);
          idbSet('bls', { items: data.items, source: 'web', at: Date.now() }).catch(() => {});
          return items.length;
        }
      }
    } catch {}
    setItems([]);
    return 0;
  })();
  return loading;
}
export const blsCount = () => items?.length || 0;

/** Eintrag als Lebensmittel-Objekt der App. */
export function blsFood(it) {
  return { id: null, blsCode: it[0], name: it[1], brand: '', kcal: it[2], protein: it[3], carbs: it[4], fat: it[5], unit: 'g', servings: [], barcode: '', source: 'bls' };
}

/**
 * Suche: alle Suchwörter müssen vorkommen (Wortanfang zählt mehr).
 * Kurze, allgemeine Namen werden bevorzugt (z. B. "Banane roh" vor "Bananenchips").
 */
export function searchBls(q, limit = 40) {
  if (!items?.length) return [];
  const terms = norm(q).split(' ').filter((t) => t.length > 1);
  if (!terms.length) return [];
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const n = index[i];
    let score = 0, ok = true;
    for (const t of terms) {
      const p = n.indexOf(t);
      if (p < 0) { ok = false; break; }
      score += p === 0 ? 30 : n[p - 1] === ' ' ? 18 : 6;
    }
    if (!ok) continue;
    score -= n.length / 6;
    if (/\broh\b/.test(n)) score += 3;
    out.push([score, i]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, limit).map(([, i]) => blsFood(items[i]));
}

// ---------- Import der Original-Datei ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((x) => x.src === src)) { res(); return; }
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error(`Konnte ${src} nicht laden`));
    document.head.appendChild(el);
  });
}

const num = (v) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
};

/** Spalten anhand der Überschriften finden (BLS-Kürzel wie ENERCC, PROT625, FAT, CHO). */
export function detectColumns(header) {
  const h = header.map((x) => String(x ?? '').trim());
  const find = (...tests) => { for (const t of tests) { const i = h.findIndex((x) => t.test(x)); if (i >= 0) return i; } return -1; };
  return {
    code: find(/^(sbls|bls[ _-]?code|code)\b/i, /schl(ue|ü)ssel/i),
    name: find(/bezeichnung(?!.*engl)/i, /^name(?!.*engl)/i, /lebensmittel(?!.*engl)/i),
    kcal: find(/^ENERCC\b/, /kcal/i),
    protein: find(/^PROT/, /protein|eiwei(ss|ß)/i),
    fat: find(/^FAT\b/i, /^fett\b/i),
    carbs: find(/^CHO\b/i, /kohlenhydrate.*verf/i, /kohlenhydrat/i),
  };
}

export function rowsToItems(rows) {
  // Kopfzeile = erste Zeile, in der eine kcal-Spalte erkannt wird
  let hi = rows.findIndex((r, i) => i < 10 && detectColumns(r).kcal >= 0 && detectColumns(r).name >= 0);
  if (hi < 0) throw new Error('In der Datei wurden keine Spalten für Name und Kalorien gefunden.');
  const c = detectColumns(rows[hi]);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const name = String(r[c.name] ?? '').trim();
    if (!name) continue;
    out.push([String(c.code >= 0 ? r[c.code] ?? '' : out.length), name, num(r[c.kcal]), num(r[c.protein]), num(r[c.carbs]), num(r[c.fat])]);
  }
  if (out.length < 10) throw new Error('Die Datei enthält zu wenige Lebensmittel.');
  return out;
}

/** Datei (ZIP mit XLSX, XLSX oder CSV) einlesen und speichern. Liefert Anzahl. */
export async function importBlsFile(file) {
  let buf = await file.arrayBuffer();
  let name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip = await window.JSZip.loadAsync(buf);
    const entry = Object.values(zip.files).find((f) => /daten.*\.xlsx$/i.test(f.name)) || Object.values(zip.files).find((f) => /\.xlsx$/i.test(f.name));
    if (!entry) throw new Error('Im ZIP wurde keine Excel-Datei gefunden.');
    buf = await entry.async('arraybuffer');
    name = entry.name.toLowerCase();
  }
  let rows;
  if (name.endsWith('.json')) {
    const data = JSON.parse(new TextDecoder().decode(buf));
    rows = null;
    if (!data.items?.length) throw new Error('Die JSON-Datei enthält keine Einträge.');
    await idbSet('bls', { items: data.items, source: 'import', at: Date.now() });
    setItems(data.items);
    return items.length;
  }
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb = window.XLSX.read(buf, { type: 'array' });
  // Blatt mit den meisten Zeilen nehmen
  let best = null;
  for (const sn of wb.SheetNames) {
    const r = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
    if (!best || r.length > best.length) best = r;
  }
  const list = rowsToItems(best);
  await idbSet('bls', { items: list, source: 'import', at: Date.now() });
  setItems(list);
  return list.length;
}
