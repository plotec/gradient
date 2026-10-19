# Formkurve

Persönliche Fitness-App fürs Handy: Training (wie Alpha Progression), Ernährung (wie MyFitnessPal), Morgengewicht, Habits und ein Dashboard mit Kalorienverbrauch-Berechnung. Läuft als installierbare Web-App (PWA), komplett offline, Daten bleiben auf dem Gerät.

## Bereiche

**Übersicht** – Tageswerte, berechneter Kalorienverbrauch (TDEE), Jahresübersichten mit 365 Kästchen für Training, Wiegen, Ernährung und jedes Habit, Gewichts- und Kaloriendiagramm.

**Training**
- Übungen anlegen (Muskelgruppe, Equipment, Pause, Notiz) – 24 Standardübungen sind vorhanden
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

## Daten

Alles liegt im Browser-Speicher des Geräts. Unter **Übersicht → Zahnrad → Sichern** regelmäßig ein Backup (JSON) erstellen, z. B. in iCloud Drive.
