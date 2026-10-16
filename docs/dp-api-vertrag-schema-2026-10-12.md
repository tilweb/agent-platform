# DP-API: Vertragsergebnisse (Schema-Version 1, 2026-10-12)

Für Integratoren (z. B. Orbit), die Vertragsprojekte über die DP-API nutzen. Gilt für `extract`, `batch.get` und den
Eingangs-Umschlag (`inbox.get`, Webhook, je Teil unter `ergebnis`).

## 1. Vertragsprojekt erkennen

`projects.list` liefert je Projekt:

- `strategy`: `contract-structured` heißt Vertragsprojekt.
- `ergebnis`: was ein Ergebnis zusätzlich zu `data` enthält, bei Verträgen `{ vertrag: 1, volltext: true }`.
  `vertrag` nennt die Schema-Version (§4).
- `fields`: die eigenen Profilfelder **und** die Felder des festen Vertragskatalogs (`group: "Vertragskatalog"`,
  IDs `katalog_*`). Mit `label`, `type`, `description`, bei Listen `item_fields`, bei Wertelisten `allowed_values`.

Damit ist vor dem ersten Dokument klar, welche Felder kommen. Eine eigene Katalogtabelle im Integrator ist nicht nötig.

## 2. Was ein Vertragsergebnis enthält

| Teil | Inhalt | Geprüft? |
|---|---|---|
| `data` | eigene Profilfelder + Vertragskatalog als flache Felder (§3) | ja, Korrekturen aus der Prüfansicht landen hier |
| `field_confidences` | je Feld, bei Listen zusätzlich je Zelle (`feld[i].spalte`) | – |
| `vertrag` | die strukturierte Vertragsauswertung (§4): Klauseln, Katalog mit Fundstellen, Pflichten, Fristen, Befunde | nein, Modellergebnis |
| `volltext` | Seitentranskript + Gliederung | nein |
| `document_text` | Seitentext am Stück | nein |
| `validations` | Befunde als Prüfhinweise (`vertrag-<typ>`, Quellenprüfung) | – |

**Was gilt bei Abweichungen?** `data` ist die geprüfte Wahrheit. Korrigiert jemand in der Prüfansicht einen
Katalogwert, ändert sich `data`, `vertrag.katalog` bleibt der Modellstand. Für Werte immer `data` nehmen; `vertrag`
für Struktur, Fundstellen und alles, was es nur dort gibt (Pflichten, Fristen, Befunde).

## 3. Vertragskatalog als Felder

23 Elemente, je Element:

- `katalog_<element>_status`: `gefunden` (geregelt) · `nicht_geregelt` · `anlage_fehlt` (in einer nicht beigefügten
  Anlage geregelt) · `delegiert` (in anderem Vertrag) · `geerbt` (gilt wie im Hauptvertrag) · `bedingt` (nur unter
  einer Bedingung).
- Werte: `katalog_<element>_<teil>`, z. B. `katalog_beginn_datum`, `katalog_kuendigung_frist_dauer`,
  `katalog_kuendigung_frist_einheit`. Elemente aus nur einem Text heißen wie das Element (`katalog_vertragsstrafe`).
  Mehrfache Elemente sind Listen (`katalog_parteien`, `katalog_entgelte`, `katalog_unterschriften`, `katalog_anlagen`,
  `katalog_vertragsnummern`, `katalog_preisanpassung`) mit Spalten. Listen von Texten innerhalb einer Zeile
  (z. B. Kurzbezeichnungen einer Partei) stehen als „a; b".
- `katalog_<element>_fundstellen`: Klausel-IDs, z. B. `§6.3, Anl1`.

Ist ein Element nicht geregelt, sind seine Werte leer (Listen `[]`), der Status ist `nicht_geregelt`.

Elemente: Vertragsart, Parteien, Vertrags-/Kundennummern, Unterschriften, Abschluss, Beginn, Laufzeit, Verlängerung,
Kündigung, Entgelte, Zahlungsbedingungen, Preisanpassung, Haftung, Gewährleistung, Verfügbarkeit/Störungen,
Vertragsstrafe, Vertraulichkeit, Exklusivität/Wettbewerb, Gerichtsstand, Rechtswahl, Schriftform, Widerruf, Anlagen.
Die verbindliche Feldliste mit Typen liefert `projects.list`.

**Konfidenz:** Das Modell liefert keine Sicherheit je Katalogelement. Die Werte sind eine Faustregel wie bei den
eigenen Feldern: Status 0,85; Werte 0,85, wenn „gefunden" mit Fundstelle, sonst 0,6; leere Werte 0.

**Fristen:** DP beschreibt Fristen (Dauer, Einheit, Richtung, Bezugspunkt, Wortlaut). Ein Kalenderdatum wird bewusst
nicht berechnet, das ist Aufgabe des Fristenradars.

## 4. Das `vertrag`-Objekt (Version 1)

```
vertrag: {
  version: 1,
  seiten:        [{ seite, rolle }],
  klauseln:      [Klausel],
  gueltigkeit:   [{ art: "gestrichen" | "nicht_angekreuzt" | "handschriftlich", text, klausel }],
  katalog:       { <element>: { status, wert, bedingung?, verweis?, klauseln: [id] } },
  inventar:      [InventarEintrag],
  fristen:       [FristRegel],
  verknuepfungen:[{ art, wert, klausel? }],
  verweise:      [{ von, text, ziel? }],
  befunde:       [{ typ, text, klauseln: [id] }],
  feld_fundstellen: { <feld-id>: [id] }   // Fundstellen der eigenen Profilfelder (seit 2026-10-12, optional)
  signaturen:    [PdfSignatur]            // elektronische PDF-Signaturen (seit 2026-10-16, optional, nur wenn vorhanden)
}
```

**Seitenrollen:** `vertragstext`, `deckblatt`, `unterschriften`, `anlage`, `mandat`, `muster`, `vorlage`, `datenblatt`,
`sonstiges`, `leer`. Inhalte auf `muster`, `vorlage`, `datenblatt`, `mandat` und `leer` gelten nicht als
Vertragsinhalt.

**Klausel:** `id` (stabil: `§6`, `§6.3`, `Z7.2`, `2.5.3`, `Anl1`, `rubrum`, `praeambel`, `unterschriften`, mit
`#2` … bei Wiederholung), `ebene` (1 = Abschnitt), `nummer?`, `titel?`, `titelpfad`, `text` (Markdown mit
Auszeichnung: `~~gestrichen~~`, `[x]`/`[ ]`, `{{hs: …}}` handschriftlich, `{{unterschrift: Name | Partei}}`,
`{{keine unterschrift | Partei}}`, `{{paraphe: …}}`, `{{stempel: …}}`, `{{digitale signatur: im PDF elektronisch
signiert [von Name] am TT.MM.JJJJ HH:MM}}`), `seiten: [von, bis]`, `rolle`, `eltern?`.

**InventarEintrag** (Pflichten, Rechte, Fristen …): `typ` (`pflicht`, `recht`, `frist`, `ausschluss`, `haftung`,
`zahlung`, `sonstiges`), `partei`, `gegenueber?`, `inhalt`, `modalitaet` (`muss`, `soll`, `bemueht`, `kann`,
`darf_nicht`), `ausloeser?`, `bedingung?`, `frist?` (FristAngabe), `klauseln`.

**FristAngabe:** `dauer?`, `einheit?` (`tage`, `werktage`, `wochen`, `monate`, `jahre`), `richtung?` (`vor`, `nach`,
`bis`, `innerhalb`), `bezug?`, `zum?`, `wortlaut`. **FristRegel** = FristAngabe + `art`, `partei?`, `form?`,
`klauseln`.

**Verknüpfung:** `art` = `vertragsnummer`, `kundennummer`, `rahmenvertrag`, `zusatz_zu`, `ersetzt`, `sonstige`.
Verträge verknüpft die Vertrags-App, DP liefert nur die Schlüssel.

**Befunde** (nur markiert, kein Workflow): `anlage_fehlt`, `unterschrift_fehlt`, `unterschrift_pruefen`
(Unterschrift nicht eindeutig erkennbar), `beilage_nicht_unterzeichnet` (beigefügtes eigenständiges Dokument ohne
Unterschrift), `verweis_ins_leere`, `platzhalter`, `widerspruch` (Auffälligkeit), `verarbeitung`,
`nach_signatur_geaendert` (nach einer elektronischen Signatur wurde Inhalt geändert), `signatur_beschaedigt` (Signatur
passt nicht zum signierten Inhalt). Die beiden Signatur-Befunde setzen das Dokument auf „Zu prüfen".

**PdfSignatur** (ausgelesen mit `pdfsig`, **Gültigkeit nicht geprüft**: kein Zertifikats-, Vertrauenslisten- oder
Sperrabgleich):

| Feld | Bedeutung |
|---|---|
| `feld` | Name des Signaturfelds |
| `zeit` | Signaturzeitpunkt „TT.MM.JJJJ HH:MM" (Europe/Berlin) |
| `unterzeichner?` | Name (CN) aus dem Zertifikat, nur wenn lesbar |
| `unterzeichner_technisch?` | `true`, wenn der CN eine technische Kennung ist (GUID, Gerätekennung …) |
| `art` | `pkcs7`, `pades`, `zeitstempel` (keine Unterschrift), `sonstige` |
| `qualifiziert_gekennzeichnet?` | Zertifikat trägt die ETSI-Kennzeichnung „qualifiziert" — Hinweis, nicht geprüft |
| `integritaet` | `intakt` (Signatur passt zu den signierten Bytes), `verletzt`, `unbekannt` |
| `bereich_ende` | letztes signiertes Byte (Ende der signierten Fassung) |
| `deckung` | `vollstaendig`, `spaetere_signatur` (danach nur weitere Signaturen), `nachtrag_ohne_aenderung` (Bytes angehängt, Inhalt unverändert), `geaendert`, `unbekannt` |
| `aenderung?` | bei `geaendert`: `{ seiten: [n], seitenzahl?: [vorher, nachher], art: ["text" \| "sichtbar" \| "seiten"], hinzu?, entfernt? }` |

Beim Basisprofil „Allgemein" steht dasselbe Feld unter `volltext.signaturen`.

## 5. Versionierung

- `vertrag.version` und `projects.list` → `ergebnis.vertrag` nennen die Schema-Version.
- **Ergänzungen** (neue optionale Felder, neue Befundtypen, neue Katalog-Unterfelder) erhöhen die Version nicht.
  Integratoren ignorieren unbekannte Felder und Befundtypen.
- **Inkompatible Änderungen** (Feld entfernt oder umbenannt, Bedeutung geändert) erhöhen die Version und werden im
  Changelog angekündigt.
- Die Katalogfeld-IDs (`katalog_*`) folgen derselben Regel.
