# Der Übungsfall · Musterwerk GmbH, Familie „Eingangsrechnungen"

**5 Prozesse · 30 Variablen · 24 Ist-Namen → 21 Zielnamen · 1 gepflegte CONFIG-Excel.**
Alles fiktiv. `Musterwerk GmbH` gibt es nicht, die Pfade zeigen auf `C:\Musterwerk\…`,
die Mailadresse endet auf `.example` (RFC 2606 — diese Domain kann es nie geben).

Bauen und laufen lassen:

```bash
cd "Produkte/Variablen-Explorer/MVP_Demo-Familie" && python3 _dummy_bauen.py && python3 _varliste_demo_lauf.py
```

---

## §1 Warum es diesen Übungsfall gibt

Bis zum 07.08.2026 wurde jede Engine-Änderung an **echten Kundendaten** nachgemessen —
Schattenlauf gegen Heinzl/REPA und IHK Leipzig. Das funktioniert und hat trotzdem drei Fehler:

1. Wir fassen Kundenordner an, um **unser** Werkzeug zu testen.
2. Der Testfall ändert sich, sobald der Kunde neu ausleitet. Ein Regressionstest, dessen
   Eingabe wandert, ist keiner.
3. **Ein Fall, den gerade kein Kunde hat, ist überhaupt nicht prüfbar.** Heinzl/REPA hat
   0 Wert-Konflikte — die „Waage" konnte deshalb an echten Daten nie geprüft werden.
   Getestet war nur, dass sie korrekt *nicht* erscheint.

Diese Familie hält **alle Fälle gleichzeitig und eingefroren**. Jeder Eintrag im Datensatz
existiert, weil er genau **einen** Fall auslöst — nichts ist Beiwerk.

---

## §2 Der Aufbau — genau das, was wir übergeben bekommen

```
100_Prozesse/
  210_Rechnungseingang_Hauptlauf/     Prozess_210_2026-08-05.pdf     KP
  211_CONFIG_Rechnungslauf/           Prozess_211_2026-08-05.pdf     SP · CONFIG-Prozess 1
  212_Postfach_auslesen/              Prozess_212_2026-08-04.pdf     SP
  213_Rechnung_pruefen/               Prozess_213_2026-07-18.pdf     SP · ALT-Stand
  214_Ablage_und_Protokoll_Config/    Prozess_214_2026-08-05.pdf     SP · CONFIG-Prozess 2
_CONFIG_DEMO_Rechnungslauf.xlsx       die „gewachsene" Kunden-Excel
```

**Aufruf-Baum** (aus `TestCaseID:` in den Schritten, nicht behauptet):

```
210 Hauptlauf ──┬── 211 CONFIG Rechnungslauf
                ├── 212 Postfach auslesen
                └── 213 Rechnung prüfen ── 214 Ablage und Protokoll · Config
```

Die Excel ist absichtlich **nicht** nach unserem Muster gebaut: Blatt heißt `Variablen`
statt `CONFIG`, Spalte 2 ist die **Beschreibung**, der Wert steht in **Spalte 3**. Genau
dieser Aufbau hat den Prototyp am 07.08. dazu gebracht, 26 Beschreibungstexte gegen Werte
zu vergleichen (Befund B1). Wer im Lauf-Skript `cfg_blatt`/`cfg_spalten` auskommentiert,
sieht das Streng-Gate arbeiten — die Engine bricht ab und rät nicht.

---

## §3 Was der Datensatz auslöst — ein Fall je Zeile

Die Soll-Spalte ist der **Vertrag**. Weicht ein Lauf davon ab, ist entweder der Datensatz
geändert worden oder die Engine liest anders. Beides muss auffallen.

### Reiter 1 · Variablen

| Fall | Soll | Wo im Datensatz |
|---|---|---|
| **P-A Kopplungs-Riss** | **1** | `C_ArchivPfad`: in 213 schon umbenannt, in 211 noch `Archivordner`. Die Übergabe über Namensgleichheit ist tot, bis **beide** Stellen stehen. |
| **P-C Dublette** | **1** | `H_BetragZahl` zweimal im **selben** Prozess 213 (`Rechnungsbetrag` + `Rechnungsbetrag alt`). |
| **P-B halb reparierte Referenz** | **23 ok · 1 Kandidat** | 213/S5 nennt `Lieferantenname`, zeigt aber auf Slot 3 — dort steht `Rechnungsbetrag`. So sieht es aus, wenn beim Umbenennen der Text getauscht wurde und die Referenz darunter stehen blieb. |
| **P-G ohne Fehler-Ausgang** | **2 von 5** | 212 und 214 haben nur einen Erfolgs-Ausgang. Ein technischer Abbruch hat dort keinen Weg. |
| **Mehrfach-Verwendung** | **7** | u. a. `H_LaufZahl` (210 + 212) und `U_AnzahlZahl` (`Anzahl Mails` in 212 → `Anzahl Rechnungen` in 210). |
| **Alt-Stand** | **1** | 213 steht auf dem 18.07., der Rest auf August → Badge „Alt" + Umbau-Hinweis an der Karte. |
| **Tippen-Schritte** | **4** | 210/S8, 212/S2, 213/S5 — dort zieht die `{CV:}`-Referenz beim Umbenennen **nicht** nach. |
| **PDF-Umbruch** | **2 Felder** | Zwei lange Pfade brechen in der Ausleitung um; `_kleben()` setzt sie wieder zusammen und markiert sie als `umbruch`. |
| **Konform-Vorabhaken** | **1 gesetzt, 1 gesperrt** | `C_ArchivPfad` (213) ist vorgehakt. `C_DruckerName` **nicht** — siehe unten. |

### Reiter 3 · Konfiguration — alle sieben Diff-Klassen, jede genau einmal

| Klasse | Schlüssel | Warum |
|---|---|---|
| `gleich` | `C_EingangPfad` | Panel und Excel tragen denselben Wert. **Nur hier** ist wirklich verglichen worden. |
| `abweichend` | `C_PruefSchwelleZahl` | Excel 2000, Panel 1000 — **und** 210 trägt 500. Die Waage zeigt **drei** Kandidaten und belegt keinen vor. |
| `unklar` ❓ | `C_ProtokollVorlageDatei` | Excel sagt `…_v2.xlsx`, Panel sagt `….xlsx` — aber der Panel-Wert stammt aus einer umbrochenen PDF-Zeile und ist zusammengeraten. Frage, kein Befund. |
| `nur_excel` | `C_ArchivPfad` | Panel leer, Excel gepflegt = **Regelfall** einer laufenden Familie. Der Excel-Wert steht auf der Karte **und** im Download. |
| `nur_panel` | `C_PostfachText` | Excel-Lücke: den Wert gibt es nur als Initialwert im Prozess. Beim nächsten Lauf lädt der Prozess ins Leere. |
| `fehlend` | `C_DruckerName` | Im Prozess umbenannt, in der Excel nicht. |
| `nicht_verglichen` | `C_ProtokollDatei` · `C_MonatsPfad` · `C_AufbewahrungZahl` | Gehören zu CONFIG-Prozess **214**, für den keine Excel hinterlegt ist. **Ohne B5 wären das drei Falschbefunde „fehlt in der Excel".** |
| `verwaist` (Excel-seitig) | `DruckerName` · `Faxgeraet` | Der erste ist die halbe Umbenennung und bekommt einen Verdachts-Hinweis, der zweite eine echte Altlast ohne Gegenstück. Der **Unterschied** ist der Punkt. |

### Der Kreuz-Widerspruch (D-085) — der teuerste Fall im ganzen Satz

`C_DruckerName` ist im **Prozess** fertig umbenannt und in der **Excel** nicht (dort heißt
er noch `DruckerName`, ohne Präfix).

- Reiter 1 sähe „Name steht schon" und würde vorhaken.
- Reiter 3 sagt „fehlt in der Excel" — der Prozess lädt zur Laufzeit ins Leere.

Beide Aussagen stimmen. **Zusammen begraben sie die Frage.** Deshalb sperrt der Explorer
den Vorabhaken und schreibt an die Karte: *„Verdacht: die Excel kennt ihn noch als
`DruckerName` — wahrscheinlich eine unfertige Umbenennung."*

---

## §4 Die Grenzen — was dieser Übungsfall NICHT beweist

Ein Testfall, der seine eigenen Grenzen verschweigt, ist gefährlicher als keiner.

**① Das Spaltenraster beweist er nicht.** `_dummy_bauen.py` setzt die x-Positionen nach
derselben Annahme, die in `varliste_engine_v1.py` steht (SP_ID 120 · SP_NAME 235 ·
SP_TYP 305 · SP_INIT 420, vermessen an KGT-LE 33/34). Dass Bauer und Engine
zusammenpassen, zeigt nur, dass die Engine ihre **eigene** Annahme sauber verarbeitet.
Ob EMMA wirklich so ausleitet, beweist weiterhin nur eine echte Kundendatei.

**② Die Slot-Semantik von `{CV:nnn}` beweist er erst recht nicht.** Der Bauer setzt `nnn`
= Position der Variablen in der Liste. Ob EMMA das auch tut oder einen vergebenen Slot
mit Lücken führt, ist **offen** (Frage an Frank, 07.08.). An echten Daten spricht einiges
dagegen: bei Heinzl/1112 zeigen Referenzen auf 28, obwohl der Prozess 16 Variablen hat.
**Wer P-B hier grün sieht, hat nichts über EMMA gelernt** — nur, dass Bauer und Prüfer
dieselbe Annahme teilen. P-B bleibt deshalb entschärft und meldet Kandidaten.

**③ Er ersetzt den Realtest nicht, er geht ihm voraus.** Die drei teuersten Befunde des
Jahres kamen aus echten Kundendateien, nicht aus Fixtures: B1 (fremder Excel-Aufbau),
B6 (PDF-Umbruch), B5 (mehrere CONFIG-Prozesse). Der Übungsfall hält sie **fest**, nachdem
sie gefunden wurden. Finden wird sie weiterhin die Wirklichkeit.

---

## §5 Was beim Bau des Übungsfalls schiefging (und warum das hier steht)

Ich hatte `erwarte: {"namen": 21}` eingetragen — die Zahl meiner **Zielnamen**.
`erwarte(namen)` zählt aber die eindeutigen **Ist-Namen aus dem Export**: 24.
**Gate ⓪ hat den Lauf abgebrochen und die Differenz benannt**, statt sie zu schlucken.

Beide Zahlen sind richtig, sie messen Verschiedenes — und die Differenz ist genau das,
was der Explorer leistet: **24 gewachsene Namen werden zu 21 Zielnamen.** Hätte das Gate
eine ≥-Schwelle gehabt, wäre der Fehler durchgerutscht und ich hätte den Übungsfall auf
einer falschen Erwartung eingefroren.

Das ist der Grund, warum der Datensatz seinen eigenen Gegenzähler mitbringt:
`python3 _dummy_bauen.py pruefen` liest die erzeugten PDFs **mit der Engine-Logik** zurück
und vergleicht Feld für Feld gegen `_dummy_daten.py`. Ein Generator, der nur behauptet,
etwas gebaut zu haben, ist wertlos.
