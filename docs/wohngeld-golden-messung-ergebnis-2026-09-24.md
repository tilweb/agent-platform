# Wohngeld — Erste Messung gegen das Golden Dataset (2026-09-24)

Lauf `2026-09-23T20-14-47`: 30 Fälle, digital und Scan, alle Stufen, Extraktion auf den erwarteten
Dokumentgrenzen, Modell `adacor/qwen3-5-a3b-35b-256k`. Vollständiger Bericht:
`tools/wohngeld-golden/out/messung/2026-09-23T20-14-47/bericht.md` (lokal, nicht eingecheckt).
Werkzeug: `backend/scripts/wohngeld-golden/messung.ts`.

## Ergebnis auf einen Blick

| Stufe | digital | Scan |
|---|---|---|
| Split: erwartete Schnitte gefunden | 91,5 % | 91,5 % |
| Split: Fehlschnitte (Schnitt mitten im Dokument) | 57 | 47 |
| Dokumente exakt getrennt | 74,5 % | 76,6 % |
| Dokumenttyp richtig | 87,3 % | 3,8 % |
| Feldwerte richtig | 81,8 % | 38,4 % |
| Prüfung nach Posteingang: erwartete Befunde gemeldet | 80 % | 28,6 % |
| Prüfung nach Posteingang: Fehlalarme | 61 | 144 |

**Regelwerk bei korrekt erfasstem Fall** (ohne KI, nur Regeln): 94 % der erwarteten Befunde, 3 verfehlt, 5 Fehlalarme.
Die Regeln selbst sind also weitgehend richtig. Die Schwächen liegen vor allem in Erkennung und Übergabe.

## Befunde, nach Wirkung

1. **Scans werden nicht klassifiziert.** Ohne Textebene bestimmt die App den Dokumenttyp nur aus dem Dateinamen
   (`klassifiziere` in `extraction.ts`). Die Texterkennung läuft erst danach in der Extraktion. Folge: 96 % der
   gescannten Dokumente werden „sonstiges", Fachfelder fehlen, die Prüfung verfehlt fast alles. Briefpost kommt
   aber überwiegend als Scan.
2. **Miete mit falscher Bedeutung.** Das Feld heißt Bruttokaltmiete, die Extraktion liefert fast immer die Gesamtmiete
   (Antrag 27 von 30 falsch, Mietvertrag/Vermieterbescheinigung 55 von 56). Weil Antrag und Nachweise nicht einheitlich
   daneben liegen, entstehen **20 falsche „Miethöhe klären"-Befunde** in 30 digitalen Fällen. Für eine spätere
   Berechnung wäre die Grundlage falsch.
3. **Dokumente ohne Personenbezug.** Der Posteingang legt nur die antragstellende Person an und ordnet Dokumente
   niemandem zu. Die Personenregeln melden deshalb „Personalausweis fehlt" trotz beiliegendem Ausweis
   (24 Fehlalarme digital). Einkommen, Kindergeld, Pflegegrad aus dem Antrag werden nicht übernommen — die
   zugehörigen Nachforderungen entstehen erst nach manueller Erfassung.
4. **Split schneidet Formulare auseinander.** Alle 57 Fehlschnitte liegen im Antrag (29) oder in der
   Vermieterbescheinigung (27, Rückseite mit Betriebskosten-Erläuterung). Verfehlt werden vor allem Grenzen zwischen
   gleichartigen Dokumenten: aufeinanderfolgende Monats-Abrechnungen (10), zwei Ausweise, zwei Kontoauszüge.
   Über 40 Seiten (F29) findet keine Trennung statt.
5. **Unterschrift nicht erkennbar.** Bei digitalen PDFs arbeitet die Extraktion nur mit Text; eine gezeichnete
   Unterschrift ist darin nicht sichtbar (30 von 86 Unterschrift-Urteilen falsch, v. a. Vermieterbescheinigung).
6. **Einzelne Regelfehler.**
   - `plausi-rentenart-fehlt` feuert, wenn Grundrentenzeiten nicht genannt sind — bei jeder normalen
     Rentenanpassungsmitteilung (7 Fehlalarme).
   - `plausi-miethoehe-abweichung` vergleicht nur das erste Mietdokument; die Mieterhöhung in F18 bleibt unentdeckt.
   - `mietvertrag`/`vermieterbescheinigung` unterscheiden nicht nach Weiterleistungsantrag bzw. Heim.
   - `antrag-vollstaendig-unterschrieben` greift nur bei ganz fehlendem Antrag.
7. **Kleinere Klassifikationsfehler (digital).** Minijob- und Ausbildungsabrechnungen werden 12-mal „sonstiges"
   (fehlender Einkommensnachweis). Gehaltsabrechnung ↔ Verdienstbescheinigung (16) ist für die Regeln folgenlos.
   Aufenthaltstitel, Heimvertrag, Mieterhöhung, BAföG-/Elterngeld-/ALG-Bescheid werden nicht erkannt — für sie gibt es
   teils keinen passenden Typ.

**Nicht als Fehler zu werten:** `analyse.betrag` fragt das Extraktionsschema heute nur beim Rentenbescheid ab; die
75 „fehlt" bei Abrechnungen/Bescheiden zeigen eine Lücke im Umfang, keinen Erkennungsfehler.

## Empfehlungen (Reihenfolge nach Nutzen/Aufwand)

1. **Klassifikation für Scans:** Typ aus dem OCR-Text bestimmen (die Pipeline erzeugt ihn ohnehin) oder per Vision
   auf Seite 1 — wie die Plattform-Inbox (`extraction/inbox/classify.ts`). Größter Einzelhebel.
2. **Miete in Bestandteilen extrahieren** (Gesamtmiete, Heizung, Warmwasser, weitere Posten) und die Bruttokaltmiete
   im Code berechnen — für Antrag und Mietnachweise gleich.
3. **Posteingang: Personen und Zuordnung.** Haushaltsmitglieder und Einkommensarten aus dem Antrag übernehmen;
   Dokumente über `identitaet` der passenden Person zuordnen.
4. **Split-Prompt schärfen:** Seitenzahl-Fortsetzung („Seite x von 11", Formularrückseiten) spricht gegen einen Schnitt;
   gleicher Dokumenttyp mit anderem Zeitraum/Person spricht dafür. 40-Seiten-Grenze durch abschnittsweise Prüfung ersetzen.
5. **Unterschrift per Vision** auf den Unterschriftsseiten prüfen statt aus dem Text.
6. **Regeln korrigieren** (Punkt 6) — klein, mit den Golden-Fällen als Regressionstest.

Nach jeder Änderung: `bun run scripts/wohngeld-golden/messung.ts --variante beide` und mit diesem Stand vergleichen.
