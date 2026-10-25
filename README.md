# Gradient

Persönliche Fitness-App fürs Handy: Training (wie Alpha Progression), Ernährung (wie MyFitnessPal), Morgengewicht, Habits und ein Dashboard mit Kalorienverbrauch-Berechnung. Läuft als installierbare Web-App (PWA), komplett offline, Daten bleiben auf dem Gerät.

## Bereiche

**Übersicht** – Tageswerte, berechneter Kalorienverbrauch (TDEE), Jahresübersichten mit 365 Kästchen für Training, Wiegen, Ernährung und jedes Habit, Gewichts- und Kaloriendiagramm.

**Training**
- Übungen einfach mit Namen anlegen (optional Gruppe, Notiz, Pause) – auch direkt beim Suchen
- Gewichte völlig frei, z. B. 10,2 kg – keine vorgegebenen Steigerungsschritte
- Trainingstage anlegen und Übungen einsortieren (Sätze, Wdh-Ziel, Pause, Reihenfolge)
- Training starten: Trainingszeit läuft, Sätze sind mit den Werten vom letzten Mal vorbelegt
- Pro Satz: kg · Wdh · berechnetes 10RM · Qualität 1–10 · Abhaken
- Abhaken springt zum nächsten Satz bzw. zur nächsten Übung und startet den Pausen-Countdown (mit Ton/Vibration)
- „Abschließen“: Zusammenfassung mit Dauer, Sätzen, Volumen, Vergleich zum letzten Mal und neuen Rekorden (10RM, Höchstgewicht, Volumen)
- Verlauf je Training und je Übung inkl. 10RM-Diagramm

**Ernährung**
- 4 Mahlzeiten + Snacks (Namen frei wählbar), Kalorien- und Makroziele
- Lebensmittel hinzufügen: Zuletzt verwendet, eigene Lebensmittel, Online-Suche (Open Food Facts), Barcode-Scanner, Schnelleintrag
- Eigene Mahlzeiten aus mehreren Lebensmitteln zusammenstellen und mit einem Tipp eintragen
- Mahlzeit oder ganzen Tag von gestern kopieren, Mahlzeit aus dem Tagebuch als Vorlage speichern

**Körper** – Morgengewicht mit geglättetem Trend, Habits (Supplements usw.) zum Abhaken mit Serien.

## Ziele

Unter **Übersicht → Kalorienverbrauch → Ziel ändern** (oder Körper / Ernährungsziele):

- **Gewicht pro Woche**, z. B. −0,5 kg oder +0,1 kg, oder
- **Kalorienbilanz pro Tag**, z. B. +200 kcal Überschuss oder −300 kcal Defizit.

Aus deinem berechneten Umsatz ergibt sich die empfohlene Zufuhr (1 kg ≈ 7.700 kcal). Solange noch zu wenig Daten für die Berechnung da sind, trägst du einen Schätzwert ein. Mit **„Automatisch anpassen“** wird das Kalorienziel einmal täglich an den neuen Umsatz angepasst (Makros: Ausgleich über Kohlenhydrate). Optional: Zielgewicht mit voraussichtlicher Dauer. Ob du dein Wochenziel triffst, wird jeden Sonntag am geglätteten Gewichtstrend gemessen (± 0,25 kg).

## Punkte & Rangliste

| Wofür | Punkte |
|---|---|
| Training nach Plan erledigt | 30 |
| Zusätzliches Training | 15 |
| Übung gesteigert (10RM höher als letztes Mal) | 10 |
| Neuer Rekord bei einer Übung | 15 |
| Ernährung geloggt / im Zielbereich | 5 / 20 |
| Morgens gewogen | 5 |
| Wochenziel Gewicht getroffen | 40 |
| Alle Supplements / je Habit | 5 / 3 |
| Perfekter Tag (alles Fällige geschafft) | 15 |

Progression zählt pro Training höchstens 60 Punkte. Die Rangliste zeigt Woche, Monat und Gesamt. Mit Cloud-Accounts sehen alle Freunde im selben Supabase-Projekt die gemeinsame Rangliste (Tabelle `leaderboard` aus `supabase/schema.sql`), ohne Cloud alle Accounts auf dem Gerät.

## Kalorienverbrauch (TDEE)

`TDEE = Ø Kalorienzufuhr − (Gewichtsänderung pro Tag × 7.700 kcal/kg)`

Die Gewichtsänderung kommt aus einer linearen Regression über alle Wiegungen im Zeitraum (14/28/56 Tage), damit Wasserschwankungen kaum ins Gewicht fallen. Je vollständiger du loggst und wiegst, desto genauer.

## 10RM

Geschätztes Gewicht für 10 Wiederholungen: `Gewicht × (1 + Wdh/30) × 0,75` (Epley). Bei genau 10 Wdh entspricht es dem bewegten Gewicht.

## Aufs Handy bringen

1. Auf GitHub: **Settings → Pages → Source: „GitHub Actions“** wählen.
2. Der Workflow `.github/workflows/pages.yml` veröffentlicht die App bei jedem Push, Adresse: `https://<benutzer>.github.io/<repo>/`.
3. Adresse am iPhone in **Safari** öffnen → Teilen → **„Zum Home-Bildschirm“**. (Android/Chrome: Menü → „App installieren“.)

Lokal testen: `python3 -m http.server` im Ordner starten und `http://localhost:8000` öffnen.

## Accounts & Cloud (Supabase)

Jeder Nutzer meldet sich mit **Name + Passwort** an; Übungen, Trainings, Ernährung und Habits liegen unter seinem Account.

- **Ohne Einrichtung:** lokale Accounts – funktionieren sofort, aber nur auf dem jeweiligen Gerät.
- **Mit Supabase (kostenloser Tarif reicht):** echte Accounts, Daten auf allen Geräten synchron.

Einrichtung (einmalig, ca. 10 Minuten):

1. Auf [supabase.com](https://supabase.com) ein Projekt anlegen.
2. **SQL Editor** → Inhalt von `supabase/schema.sql` ausführen (legt die Tabellen für Daten und Rangliste mit Zugriffsschutz an).
3. **Authentication → Sign In / Providers → Email:** „Confirm email“ **ausschalten** (Login läuft über Name + Passwort, nicht über E-Mail).
4. **Project Settings → API:** „Project URL“ und „anon public key“ in `js/config.js` eintragen, committen.

Bisherige Daten auf dem Gerät werden beim ersten Anlegen eines Accounts automatisch übernommen.

## Spracheingabe

Im Ernährungsbereich (Mikrofon oben rechts, im Plus-Menü oder beim Hinzufügen) einfach sagen, was du gegessen hast, z. B. *„250 Gramm Nudeln, eine halbe Packung Cremefine, 500 Gramm Hackfleisch und eine Handvoll Streukäse“*. Die App zeigt die erkannten Zutaten mit Mengen und Kalorien zum Prüfen; Treffer und Mengen lassen sich antippen und ändern. „Mein Anteil“ (½, ⅓ …) teilt gemeinsam gekochtes Essen auf, optional wird das Ganze als wiederkehrende Mahlzeit gespeichert.

- **Erkennung auf dem Gerät** (immer verfügbar): versteht Mengen wie Gramm, Kilo, Packung, Becher, Handvoll, Esslöffel, Scheibe, Stück und sucht in eigenen Lebensmitteln, der Grundliste und dem BLS.
- **KI-Auswertung** (genauer, auch bei frei formulierten Sätzen): mit Cloud-Account über die Supabase-Funktion `supabase/functions/parse-meal` (Claude). Einrichtung:
  ```bash
  supabase functions deploy parse-meal
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
  ```
  Der API-Schlüssel bleibt auf dem Server; nur angemeldete Accounts können die Funktion nutzen. Werte aus der Datenbank haben Vorrang, wenn sie zur KI-Schätzung passen.

Spracherkennung: Chrome/Android direkt in der App; auf dem iPhone ggf. das Mikrofon der Tastatur im Textfeld nutzen.

## Lebensmittel-Datenbank (BLS 4.0)

Der [Bundeslebensmittelschlüssel](https://blsdb.de) des Max Rubner-Instituts (rund 7.100 Lebensmittel, Lizenz CC BY 4.0) wird beim Veröffentlichen über GitHub Actions automatisch geladen (`tools/fetch_bls.py` → `data/bls.json`). Klappt der Download nicht, kann die ZIP-Datei von blsdb.de auch unter **Einstellungen → Lebensmittel-Datenbank → BLS-Datei importieren** eingelesen werden.

Quelle: Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0. Karlsruhe.

## Daten

Lokal liegen die Daten im Browser-Speicher des Geräts (mit Cloud-Account zusätzlich in Supabase). Unter **Übersicht → Zahnrad → Sichern** lässt sich jederzeit ein Backup (JSON) erstellen.
