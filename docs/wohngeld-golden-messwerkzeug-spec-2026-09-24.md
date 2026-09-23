# Wohngeld — Messwerkzeug für das Golden Dataset (Spec, 2026-09-24)

## Ziel

Die Wohngeld-App gegen die 30 synthetischen Fälle (`tools/wohngeld-golden/`) laufen lassen und messen, wie gut
Split, Klassifikation, Extraktion und Prüfregeln die „richtige Antwort" (`expected/Fnn.expected.json`) treffen.
Das Werkzeug ruft **dieselben Funktionen wie die App** auf, ohne Datenbank und ohne Login.

## Stufen

| Stufe | Was läuft | Aufgerufene App-Funktion | LLM |
|---|---|---|---|
| `split` | Sammel-PDF an Dokumentgrenzen trennen | `pruefeUndTrenne` (Posteingang) | ja, je Seitenübergang |
| `extraktion` | je Dokument Typ erkennen und Felder auslesen | `klassifiziereUndExtrahiere` | ja, je Dokument |
| `pruefung-posteingang` | Prüfregeln auf dem Stand direkt nach der Zuordnung im Posteingang | Nachbau von `verteileDokumente` + `pruefeVorgang` | nein |
| `pruefung-regelwerk` | Prüfregeln auf einem korrekt erfassten Fall | `pruefeVorgang` | nein |

**Dokumentgrenzen für die Extraktion:** Standard sind die *erwarteten* Seitenbereiche (Orakel). So misst die
Extraktion nur sich selbst und nicht die Fehler des Splits. Mit `--ende-zu-ende` nutzt die Extraktion die vom Split
gefundenen Teile; die Zuordnung zu erwarteten Dokumenten erfolgt über die größte Seitenüberlappung.

**Zwei Prüf-Ebenen**, weil die App beim Posteingang nur die antragstellende Person anlegt und Dokumente keiner
Person zuordnet:
- *Posteingang:* Vorgang aus den extrahierten Antrags-Stammdaten, eine Person, Dokumente ohne Personenbezug —
  genau das, was die App nach „Zuordnen" automatisch prüft.
- *Regelwerk:* alle Personen mit Rolle, Erwerbsstatus, Einkommen, Kindergeld, Pflege/Behinderung, Vermögen und
  Ausschlüssen so, wie eine Sachbearbeitung sie aus dem Antrag erfasst; Dokumente mit richtigem Personenbezug und
  den *erwarteten* Analysewerten. Misst, ob die Regeln fachlich stimmen — ohne LLM, in Sekunden.

## Kennzahlen

- **Split:** Präzision/Trefferquote der Schnittstellen (Seitenübergänge), Anteil exakt getroffener Dokumente.
  Leerseiten dürfen dem Nachbardokument zugeschlagen werden. Fälle über 40 Seiten: erwartet „nicht getrennt".
- **Klassifikation:** Treffer je Dokument, Verwechslungsmatrix erwartet → erkannt.
- **Extraktion:** je Feld *richtig / falsch / fehlt / zu viel*. Vergleich normalisiert (Beträge ±0,01 €, Datum ISO,
  Texte ohne Groß-/Kleinschreibung und Diakritika). Erwartet `null` = Wert nicht auslesbar → richtig, wenn leer.
- **Prüfung:** je Fall Treffer (erwarteter Befund gemeldet), verfehlt (erwartet, nicht gemeldet), bekannte
  Übermeldung (steht in `appVermutlichZusaetzlich`), Fehlalarm (sonst gemeldet). Standardbefunde zählen als Treffer.

## Betrieb

- Skript: `backend/scripts/wohngeld-golden/messung.ts`, Aufruf im `backend/`-Ordner
  (`bun run scripts/wohngeld-golden/messung.ts [--faelle F01,F18] [--variante digital|scan|beide] [--stufen …] [--ende-zu-ende]`).
- **Cache** je Dokument-Hash + Modell + Prompt-Stand: Wiederholte Läufe kosten keine LLM-Aufrufe, solange sich weder
  PDF noch Modell ändern. `--ohne-cache` erzwingt neue Aufrufe.
- Ausgabe unter `tools/wohngeld-golden/out/messung/<Zeitstempel>/`: `ergebnis.json` (vollständig) und
  `bericht.md` (Zusammenfassung + Auffälligkeiten je Fall).
- Die Vergleichslogik ist rein und per `bun test` abgesichert.

## Nicht im Umfang

- Zuordnung eines Eingangs zu einem bestehenden Vorgang (Match-Vorschlag) — kein Bestand in den Fällen.
- Einkommensberechnung nach § 14 ff. — die App berechnet kein Wohngeld.
