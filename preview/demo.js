// Vorschau mit Beispieldaten: meldet "Max" an, füllt 150 Tage Daten und legt Freunde für die Rangliste an.
// Speicher im Arbeitsspeicher: die Vorschau braucht keinen Browser-Speicher und startet immer eingeloggt.
const mem = new Map();
const memStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
try { Object.defineProperty(window, 'localStorage', { value: memStorage, configurable: true }); } catch {}

const { demoData, makeEntry } = await import('./js/store.js');

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const tk = key(today);
const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

try {
  const DATA = 'formkurve-v1:local-demo';
  if (!localStorage.getItem(DATA)) {
    const s = demoData();
    // heute schon etwas eingetragen
    const ws = Object.keys(s.weights).sort();
    s.weights[tk] = Math.round((s.weights[ws[ws.length - 1]] - 0.1) * 10) / 10;
    const f = (n) => s.foods.find((x) => x.name.startsWith(n));
    s.diary[tk] = { entries: [
      makeEntry(f('Haferflocken'), 80, 0), makeEntry(f('Whey'), 30, 0), makeEntry(f('Heidelbeeren'), 100, 0),
      makeEntry(f('Basmati'), 100, 1), makeEntry(f('Hähnchen'), 200, 1), makeEntry(f('Brokkoli'), 200, 1),
    ] };
    s.habitLog[tk] = s.habits.filter((h) => h.supplement).map((h) => h.id);
    const bank = s.exercises.find((e) => e.name === 'Bankdrücken');
    if (bank) bank.note = 'Bank 2, Griff eine Daumenbreite weiter als schulterbreit';
    s._modifiedAt = Date.now();
    localStorage.setItem(DATA, JSON.stringify(s));
  }
  localStorage.setItem('formkurve-session', JSON.stringify({ mode: 'local', name: 'Max', userId: 'local-demo' }));
  // Freunde für die Rangliste (Punkte der aktuellen Woche/des Monats)
  const wk = key(monday), mk = tk.slice(0, 7);
  const board = JSON.parse(localStorage.getItem('formkurve-board') || '{}');
  Object.assign(board, {
    'local-lisa': { name: 'Lisa', total: 11840, week: 64, week_key: wk, month: 1490, month_key: mk },
    'local-tom': { name: 'Tom', total: 13210, week: 41, week_key: wk, month: 1820, month_key: mk },
    'local-jonas': { name: 'Jonas', total: 7450, week: 12, week_key: wk, month: 760, month_key: mk },
  });
  localStorage.setItem('formkurve-board', JSON.stringify(board));
} catch (e) { console.warn('Demo-Daten konnten nicht gespeichert werden', e); }

await import('./js/app.js');
