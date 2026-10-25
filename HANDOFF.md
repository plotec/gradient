# Übergabe: Formkurve (Stand 25.10.2026)

Diese Datei fasst den kompletten Stand eines längeren Chats zusammen, damit eine neue Claude-Code-Sitzung
nahtlos weitermacht. **Neue Sitzung: bitte zuerst diese Datei und die README.md lesen.**

## Wer & wie

- Nutzer: Inhaber von plotec-werbung (GitHub-Organisation `plotec`), schreibt Deutsch, will Antworten auf Deutsch.
- Ziel: eigene Fitness-App fürs iPhone (ersetzt Alpha Progression + MyFitnessPal + Habit-Tracking), später auch für Freunde.
- Arbeitsweise: Er beschreibt Wünsche per Sprache; Umsetzung direkt, Ergebnisse kurz zusammenfassen.
  Bei Supplement-/Ernährungsthemen sachlich und ohne Moralisieren beraten (relevante Wechselwirkungen kurz nennen).
- Die neue Sitzung läuft **lokal auf seinem PC** mit der **Claude-in-Chrome-Erweiterung** → damit sollen die
  GitHub-/Supabase-Klicks gemeinsam erledigt werden.

## Die App

PWA ohne Build-Schritt (Vanilla JS, ES-Module), Daten local-first im Browser, optional Supabase-Cloud.
Alle Features stehen in der README. Kurzüberblick der Module in `js/`:

| Datei | Inhalt |
|---|---|
| `app.js` | Tabs (Übersicht, Training, ＋, Ernährung, Körper), Plus-Menü, Start/Login, Service Worker |
| `store.js` | Datenmodell, localStorage je Account (`formkurve-v1:<userId>`), Defaults, Migration, TDEE, Kraftindex, Makro-Ausgleich (`adjustMacro`), Demo-Daten |
| `ui.js` | Icons, Event-Delegation (`data-act/data-in/data-ch`), Sheets, Dialoge, Toast |
| `training.js` | Trainingstage, Rhythmus, Übungen (nur Name), laufendes Training mit **Timeline + Drag & Drop**, Notizen (Tag/angepinnt), 10RM, Kraftkurve je Übung, Zusammenfassung/Rekorde |
| `nutrition.js` | Tagebuch (5 Mahlzeiten), Lebensmittel, Online-Suche (Open Food Facts), Barcode, eigene Mahlzeiten, **Makro-Rechner** (Ausgleich immer über Kohlenhydrate) |
| `voice.js` | Spracheingabe: Erkennung auf dem Gerät + optional KI (Supabase-Funktion `parse-meal`, Claude) |
| `foods-db.js` | BLS 4.0 (Max Rubner-Institut, CC BY 4.0): `data/bls.json` oder Datei-Import, Suche |
| `body.js` | Morgengewicht + Trend, Habits/Supplements (Gruppe „Supplement“), Zielstatus |
| `dashboard.js` | Fortschritt (Woche/Monat/3M/Jahr), Kraftentwicklung, Rangliste, Einblicke, TDEE + Ziel, Erfolgskästchen, Einstellungen |
| `success.js` | Erfolgslogik je Tag (Trainingsrhythmus, Ernährung ±Toleranz, Wiegen, Supplements, Habits, Insgesamt) |
| `goals.js` | Ziel als kg/Woche oder kcal-Bilanz → empfohlene Zufuhr, Auto-Anpassung, Wochenauswertung Gewicht |
| `points.js` | Punkte & Rangliste (lokal oder Supabase-Tabelle `leaderboard`) |
| `cloud.js` / `auth.js` / `config.js` | Accounts (Name + Passwort), Supabase-REST + Sync; `config.js` ist noch leer |

Weitere Dateien: `supabase/schema.sql` (Tabellen `user_data`, `leaderboard` mit RLS),
`supabase/functions/parse-meal/index.ts` (Edge Function, Modell `claude-opus-5-5`, effort low, `fallbacks: "default"`),
`tools/fetch_bls.py` (BLS-Download + Konvertierung, läuft im Pages-Workflow), `.github/workflows/pages.yml`,
`preview/` (Vorschau-Varianten für claude.ai-Artifacts, siehe unten).

Lokal testen: `python3 -m http.server 8765` im Ordner, dann `http://localhost:8765`.

## Offene Schritte (Reihenfolge, Nutzer will die App HEUTE aufs Handy)

1. **Code zu GitHub.** Ziel-Repo `plotec/test` (noch leer), Branch `claude/fitness-tracking-app-ln7rv0`
   (alle Commits liegen in diesem Ordner, Git-Verlauf ist dabei). Der Push aus der Cloud scheiterte mit 403, weil
   die Claude GitHub App nicht für `plotec` installiert war. Lokal einfach mit seinen eigenen Git-Zugangsdaten pushen
   (`git remote -v` prüfen) oder per Chrome-Erweiterung die GitHub App installieren. Sinnvoll: Branch nach `main`
   mergen/pushen, damit Pages von `main` deployt (Workflow reagiert auf `main` und den Branch).
2. **GitHub Pages:** Repo → Settings → Pages → Source „GitHub Actions“. Hinweis: privates Repo braucht GitHub Pro,
   öffentliches ist kostenlos (Daten liegen nie im Repo). Mit ihm klären.
3. **iPhone:** URL (z. B. `https://plotec.github.io/test/`) in Safari → Teilen → „Zum Home-Bildschirm“.
4. **Automatische Updates (gewünscht):** Der Service Worker (`sw.js`) arbeitet „network-first“ für App-Dateien →
   bei geöffneter Internetverbindung lädt die App beim Start die neueste Version. Bei Änderungen trotzdem
   `VERSION` in `sw.js` hochzählen (aktuell `formkurve-v6`). Optional noch einbauen: Hinweis „Neue Version – neu laden“.
5. **Supabase einrichten** (für Accounts auf mehreren Geräten, Rangliste mit Freunden, Datenzugriff):
   Projekt anlegen → SQL aus `supabase/schema.sql` ausführen → Authentication: „Confirm email“ AUS →
   Project URL + anon key in `js/config.js` → committen/pushen. Optional `parse-meal` deployen +
   `ANTHROPIC_API_KEY` als Secret (Schlüssel nie in den Chat/Code).
6. **Datenzugriff für gemeinsame Analysen (gewünscht):** Er will, dass Claude regelmäßig seine Werte analysiert.
   Optionen: (a) „Sichern“ (JSON-Export in Einstellungen) und Datei an Claude geben – geht sofort;
   (b) besser: einen kompakten **„Analyse-Export“** bauen (letzte 90 Tage: kcal/Makros je Tag, Gewicht + Trend,
   Trainings mit Bestwerten, Habits/Supplements, Ziele, TDEE) als Datei/Zwischenablage; (c) mit Supabase per
   SQL/REST lesen (nur mit seiner ausdrücklichen Freigabe; service-role-Key niemals in Code/Chat).
7. **Ernährungsplan** (direkt danach, siehe nächster Abschnitt) und als Standard-Mahlzeiten in der App anlegen.

## Ernährungsplan – Auftrag des Nutzers

- Ziel: leichtes Defizit, Fett verlieren + Muskeln aufbauen, **2.300 kcal/Tag**. Makro-Vorschlag (noch nicht bestätigt):
  ~180 g Eiweiß, ~60–65 g Fett, Rest Kohlenhydrate (≈ 250–260 g). Körpergewicht noch erfragen (Eiweiß ≈ 2 g/kg).
  In der App: Ziel auf „Kalorienbilanz/kg pro Woche“ setzen bzw. Kalorien 2.300 und Makros im Makro-Rechner.
- **Mittags auf der Arbeit, jeden Tag gleich (Standard-Mahlzeit in der App anlegen):**
  - 100 g Reis, ungekocht (Basmati ≈ 351 kcal, 8 g E, 77 g KH, 0,6 g F je 100 g)
  - 200 g TK-Kaisergemüse von Aldi (≈ 26–27 kcal, 1,7 g E, 2,9 g KH, 0,3 g F je 100 g – Packung prüfen)
  - 200 g Hähnchenbrustfilet (roh gewogen, Airfryer; ≈ 110 kcal, 23,5 g E, 0 KH, 1,5 g F je 100 g)
  - dazu 1–2 Shakes **Rühls Bestes Milky Protein Isolat 85** (laut Hersteller pur je 100 g: 348 kcal, 85 g E,
    0,1 g KH, 0,8 g F; aromatisiert 84 g bzw. Schoko 80 g E) – Menge und Wasser/Milch so wählen, dass es aufgeht.
- **Danach Training, abends eine Mahlzeit – die einzige, die variiert:** 3–5 vorgekochte **Nudelgerichte**.
  Soße/Fleisch/Gemüse werden vorgekocht und portionsweise im Zipperbeutel eingefroren, **Nudeln jeden Abend frisch**
  (feste Menge, roh gewogen). Anforderung: **jede der 5 Portionen hat die gleichen Makros**, sodass
  Standard-Tag + beliebige Gefrier-Portion + Nudeln = exakt Tagesziel. Gefordert: exakte Grammangaben je Portion und
  je Kochcharge (z. B. 5 Portionen pro Rezept), Einfrier-/Auftau-Hinweise.
- Rechnung vorbereitet (nicht final): Mittag ≈ 625 kcal / 59 g E / 83 g KH / 4 g F. Abend muss den Rest liefern,
  dadurch landet viel Fett im Abendessen; ggf. Fett früher einplanen (z. B. Shake mit Milch, 10 g Öl beim Gemüse).
  Mit ihm klären, ob es ein Frühstück gibt.

## Supplements (Kontext aus dem Chat)

Nimmt: Omega-3, Kreatin, Vitamin D3, Melatonin, Schlafkomplex **GN Laboratories „Sleep Like a BULL“**
(4 Kps: 1.000 mg Myo-Inositol, 500 mg L-Theanin, 200 mg Mg-Bisglycinat, **50 mg B6 (P-5-P)**, 50 mg Apigenin,
30 mg Safran, 10 mg Zink, 3 mg Bor), unregelmäßig 5 mg Lithium morgens, früher Methylenblau, plant Retatrutid 1 mg/Woche.
Empfehlungen gegeben (mit Gigas-Links): NootrEpic (Citicolin/Tyrosin/Rhodiola), Acetyl-L-Carnitin, Q10,
Koffein + L-Theanin, Glycin, Taurin, ggf. Urolithin A; Hinweise: B6 nicht zusätzlich (EFSA-UL 12 mg/Tag),
Safran im Schlafkomplex + Methylenblau (MAO-A) nicht kombinieren, bei Retatrutid Eiweiß und Elektrolyte.
Angebot offen: Supplements in der App nach Tageszeit gruppieren + tägliches Rating Energie/Fokus/Laune.

## Vorschauen (claude.ai-Artifacts, privat)

- App ohne Daten: https://claude.ai/artifact/83UPLWRJiqEcsHZSFsD4Cp
- Demo mit 150 Tagen Beispieldaten, ohne Login: https://claude.ai/artifact/R37F4TmGP61ELNiNxqgw3K
- Quellen dafür in `preview/`: `app-artifact-body.html` bzw. `demo-artifact-body.html` + `demo.js`
  (beim Veröffentlichen liegen `css/` und `js/` neben der Seite; `demo.js` nutzt einen In-Memory-Speicher).

## Bekannte Grenzen / Ideen

- BLS-Import nur mit nachgebauter Datei getestet (blsdb.de war aus der Cloud gesperrt).
- KI-Funktion `parse-meal` nicht live getestet (braucht Supabase + Schlüssel).
- Drag & Drop der Timeline mit Maus getestet; auf dem iPhone prüfen (Fallback: ⋯ → nach links/rechts).
- Wochenauswertung Gewicht bewertet Vergangenheit mit dem aktuellen Ziel.
- Punkte werden clientseitig berechnet (unter Freunden okay, nicht fälschungssicher).
