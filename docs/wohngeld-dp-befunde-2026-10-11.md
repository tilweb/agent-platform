# Wohngeld-Eingang: Befunde aus der DP-Qualitätssuite (2026-10-11)

Stand: Baseline-Lauf `2026-10-09-16-02-04` (3 Wiederholungen, Rauschband ≤ 0,2 pp). Set „wohngeld" = 60 Fälle aus dem
synthetischen Golden Dataset (30 Anträge, je digital und Scan), Profil `wohngeld-eingang`. Noch nicht bearbeitet, zur
späteren Klärung abgelegt.

## Was gemessen wird und was nicht

Das Golden Dataset enthält **bewusst fehlerhafte Anträge**, denn die Wohngeld-App soll Anträge auf Korrektheit,
Plausibilität und Vollständigkeit prüfen. Diese eingebauten Fehler sind **kein** Messfehler: Die Erwartungswerte
beschreiben, was im Dokument steht, auch wenn es inhaltlich falsch ist. Die Suite misst nur, ob DP das Dokument
richtig **liest**: Abschnitte erkannt, Felder so ausgelesen, wie sie dastehen.

Die Zahlen unten sind also Lese- und Zuordnungsfehler der Extraktion, keine Antragsfehler.

## Gesamtbild

| Metrik | Wert |
|---|---|
| Felder richtig | 93,4 % |
| Kritische Felder richtig | 97,4 % |
| Dokumente vollständig richtig (alle Felder) | 3,3 % |
| Dokumentgrenzen gefunden | 99,6 % |
| Abschnitte exakt (Seitenbereich + Typ) | 98,6 % |
| Abschnittstyp richtig | 100 % |
| „Sicher aber falsch" (hohe Konfidenz, falscher Wert) | 0 |
| Fehlschnitte (Trennung an falscher Stelle) | 24 |

Die Abschnittserkennung ist gut. Die Feldquote ist ordentlich, aber fast jeder Antrag hat mindestens ein falsches Feld.
Ein großer Teil davon konzentriert sich auf wenige Felder.

## Schwache Felder: Beispiele und Vermutung

Erwartet = Golden Dataset, gelesen = DP-Ergebnis.

| Feld | Quote | Beispiel (erwartet → gelesen) | Vermutete Ursache |
|---|---|---|---|
| `mietvertrag.vorname` / `.nachname` | ~4–7 % | F01: „Waltraud Kessler" → leer; F02: „Duc Anh Nguyen" → leer | DP liefert fast immer **nichts**. Feldbeschreibung prüfen: welche Person (Mieter/Vermieter)? Findet die Extraktion das Feld überhaupt? |
| `untermietvertrag.vorname` / `.nachname` | 0 % | F25: „Tobias" → „Emre" | **Welche Person?** Untermieter vs. Hauptmieter. Feldbeschreibung mehrdeutig. |
| `unterhaltsnachweis[].vorname` | ~17 % | F03: „Şeyma" → „Elif"; F16: „Steffen" → „Lena" | **Welche Person?** Zahlender vs. Empfänger (Kind). Feldbeschreibung mehrdeutig. |
| `schwerbehindertenausweis[].nachname` | 0 % | F07: „Thießen" → „THIESSEN" | Ausweis druckt Großbuchstaben ohne ß. DP liest richtig ab; der **Vergleich** behandelt Schreibvarianten (ß/SS, Großschreibung) noch nicht als gleich. |
| `aufenthaltstitel[].nachname` | 0 % | F15: „Yıldız" → „YILDIZ" | Wie oben: Dokumentschreibweise in Großbuchstaben ohne Sonderzeichen. Vergleich, nicht Extraktion. |
| `rentenbescheid[].grundrentenzeiten_vorhanden` | 0 % | F01, F04: `false` → leer | Steht nichts im Bescheid, liefert DP „leer" statt „nein". Festlegen: Was bedeutet „nicht erwähnt"? |
| `heimvertrag.unterschrift_vorhanden` | 0 % | F26: `true` → `false` | Einziger Fall. Im Original ansehen: Lesefehler oder Erwartungswert? |
| `steuerunterlagen[].jahreseinkuenfte` | 50 % | F06: 22.800 → 31.477 / 38.610 | **Welche Zahl?** Steuerbescheide nennen mehrere Beträge (Summe der Einkünfte, zu versteuerndes Einkommen …). Feldbeschreibung präzisieren; dass Scan und digital verschiedene Werte liefern, deutet auf Unsicherheit. |

### Einordnung

Kaum etwas davon ist ein klassischer Lesefehler. Es sind drei Arten von Ursachen:

1. **Mehrdeutige Feldbeschreibung:** Welche Person, welcher Betrag? Das betrifft Untermiet- und Unterhaltsnachweis sowie
   die Steuer. Lösung: Feldbeschreibung im Profil schärfen. Fachliche Klärung nötig: Was braucht die Prüfung in der
   App?
2. **Vergleich zu streng:** ß/SS, Groß-/Kleinschreibung, Sonderzeichen bei Namen in Ausweisen. Lösung in der Suite:
   Namensvergleich mit Normalisierung. Fachlich klären, ob die App die Ausweisschreibweise oder die Antragsschreibweise
   braucht.
3. **„Nicht erwähnt" vs. „nein":** `grundrentenzeiten_vorhanden`. Konvention festlegen: leer oder `false`.

Offen und unklar: `mietvertrag.vorname`/`.nachname` (DP liefert fast immer leer) und
`heimvertrag.unterschrift_vorhanden` (F26). Beide im Original bzw. im Profil nachsehen.

## Fehlschnitte (24)

An 24 Stellen trennt DP einen Sammelantrag an einer Stelle, an der laut Golden Dataset kein neues Dokument beginnt. Die
Typzuordnung bleibt trotzdem richtig (100 %). Noch nicht aufgeschlüsselt: Welche Dokumentarten, und ist es Scan oder
digital? Auswertung aus `laeufe/<lauf>/ergebnisse/wohngeld/*.json` (Segmente) gegen `fall.json` (erwartete Abschnitte).

## Token-Werte der Wohngeld-Baseline zu niedrig

Die Baseline stammt aus der Zeit vor dem Warteschlangen-Fix (Commit 05065dba). Token und Aufrufe je Seite (9.267 bzw.
1,82) sind deshalb zu niedrig gemessen. Die Feldquoten sind davon nicht betroffen. Beim nächsten Wohngeld-Lauf neue
Baseline schreiben (`--sets wohngeld --als-baseline --wiederholungen 3`), sonst warnt die Suite dauerhaft vor
gestiegenen Kosten.

## Vorgeschlagene Reihenfolge

1. Fachlich klären (mit der Wohngeld-App im Blick): welche Person und welcher Betrag je mehrdeutigem Feld; Konvention
   für „nicht erwähnt".
2. Profilbeschreibungen schärfen, danach Lauf gegen die Baseline.
3. Namensvergleich in der Suite normalisieren (ß/SS, Großschreibung, Diakritika). Vorher fachlich klären, ob die
   Ausweisschreibweise als richtig gelten soll.
4. `mietvertrag`-Namen und F26 im Original nachsehen.
5. Fehlschnitte aufschlüsseln.
6. Neue Wohngeld-Baseline mit korrekten Token-Werten.
