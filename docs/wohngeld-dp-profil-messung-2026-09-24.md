# Wohngeld — Messung des DP-Segmentprofils gegen das Golden Dataset (2026-09-24)

Bezug: `docs/wohngeld-dp-segmentprofil-spec-2026-09-24.md` (Punkte 1–3), Vergleichsbasis
`docs/wohngeld-golden-messung-ergebnis-2026-09-24.md` (bisherige, eigene Erkennung der App).

## Kontext

Der Posteingang erkennt Sammel-PDFs seit `1a437e4` über das Document-Processing-Segmentprofil
„Wohngeld-Eingang" statt über die eigene Grenzprüfung und die dateinamen-/textbasierte Klassifikation.
Das Golden Dataset (30 Fälle, je digital und Scan) liegt als Testbestand im Profil und wird mit
`bun run scripts/wohngeld-golden/messung.ts --variante beide --erkennung profil` gemessen.
Modell: Adacor Qwen 3.5 (35B, Vision), Ende-zu-Ende (Dokumentgrenzen aus der eigenen Erkennung).

Zwischen den Läufen wurde **nur das Profil** geändert (Prosa-Beschreibungen der Abschnittstypen) —
genau der Weg, den der Testbestand absichern soll.

## Ergebnis auf einen Blick

| Stand | Variante | Schnitte gefunden | Fehlschnitte | Dokumente exakt getrennt | Typ richtig | Felder richtig | Posteingang-Prüfung Treffer · Fehlalarme |
|---|---|---|---|---|---|---|---|
| Legacy (App-eigen) | digital | 91,5 % | 57 | 74,5 % | 87,3 % | 81,8 % | 80 % · 61 |
| Legacy (App-eigen) | scan | 91,5 % | 47 | 76,6 % | 3,8 % | 38,4 % | 28,6 % · 144 |
| Profil 2026-09-24b | digital | 86,9 % | 7 | 78,3 % | 99,7 % | 92,8 % | 80 % · 50 |
| Profil 2026-09-24b | scan | 92,7 % | 4 | 86,6 % | 99,3 % | 95,1 % | 80 % · 49 |
| Profil 2026-09-24c | digital | 99,2 % | 17 | 92,1 % | 99,7 % | 95,4 % | 80 % · 46 |
| Profil 2026-09-24c | scan | 99,2 % | 15 | 93,1 % | 99,7 % | 95,0 % | 80 % · 48 |
| **Profil 2026-09-24d** | digital | **100 %** | **2** | **98,6 %** | **99,7 %** | **95,3 %** | 80 % · 49 |
| **Profil 2026-09-24d** | scan | **100 %** | **3** | **98,3 %** | **99,7 %** | **95,3 %** | 80 % · 48 |

Regelwerk allein (korrekt erfasster Fall, unabhängig von der Erkennung): unverändert 94 %.

Laufzeit: 65–120 s je Sammel-PDF (11–40 Seiten), ein voller Lauf (60 PDFs) ≈ 1¾ h.

## Was die Profiländerungen bewirkt haben

1. **Stand b → c (Neustart gleichartiger Nachweise).** Verfehlte Schnitte lagen fast ausschließlich zwischen
   gleichartigen Folgedokumenten (16 × Gehaltsabrechnung | Gehaltsabrechnung, 2 × Rentenbescheid für ein Ehepaar).
   Ursache: Jede Seite wird einzeln klassifiziert; „anderer Monat = neues Dokument" kann das Modell ohne die Vorseite
   nicht beurteilen. Neu: Beschreibungen der wiederholbaren Typen nennen das **sichtbare** Signal („Seite mit eigenem
   Abrechnungskopf/Adressfeld/Auszugskopf ist IMMER ein Neustart"). Schnitte 87/93 % → 99 %.
   Nebenwirkung: Die Rückseite der Vermieterbescheinigung (Auszug BetrKV) wurde 28 × als „sonstiges" gelesen.
2. **Stand c → d (Rückseiten).** Vermieterbescheinigung: Seite mit BetrKV-Auszug ist immer Teil davon; „sonstiges"
   schließt Gesetzes-/Hinweis-Rückseiten ausdrücklich aus; Unterhaltsanlage-Seite 2 ist Fortsetzung.
   Fehlschnitte 17/15 → 2/3, exakt getrennt 92/93 % → 98 %.

Restfehler Stand d: 3 × Unterhaltsanlage S. 2 geschnitten, 2 × Mietvertrag S. 2 geschnitten,
2 × Gehaltsabrechnung | Gehaltsabrechnung verfehlt; F30 enthält ein Blatt, das zu keinem Teil wird.

## Offene Hebel (nicht Teil der Profilarbeit)

- **Unterschrift im Mietvertrag** stimmt nur zu 40 % (erwartet unterschrieben, gelesen „nein") und erzeugt die
  meisten Fehlalarme der Regel `plausi-mietvertrag-unsigniert`. Ursache: Die hybride Strategie liest Text und nutzt
  Seitenbilder nur für unsichere Felder — eine gezeichnete Unterschrift steht in keinem Text. Die Engine kennt heute
  keine Möglichkeit, Bildlesung für ein Feld/einen Abschnitt zu erzwingen. Vorschlag: Feld-Option „nur visuell
  prüfbar" in der Extraktions-Engine (Plattform-Änderung, betrifft das Übergabe-Paket Document Processing).
  Antrag und Vermieterbescheinigung sind bei 100 %.
- **Posteingang-Prüfung 80 %:** Die verfehlten Befunde (Kindergeld, Pflegegrad, Schwerbehinderung, Rente,
  Verdienst anderer Personen) und `identitaet-jede-person`-Fehlalarme folgen daraus, dass der Posteingang nur die
  antragstellende Person anlegt und Nachweise keiner Person zuordnet — keine Erkennungsfrage.
- **Felder außerhalb des Profilumfangs:** „fehlt" bei `sonstiges`, Kurzarbeitergeld, Pflege-/KV-/Transfer-Beträgen
  und Geburtsdaten auf Nebennachweisen — das Profil liest diese Felder bewusst nicht; bei Bedarf als Profilfelder
  ergänzen und über den Testbestand messen.
- Unterhaltsnachweis: gelesener Vorname ist der des zahlenden bzw. antragstellenden Elternteils statt des Kindes —
  Feldbeschreibung schärfen.

## Arbeitsweise für weitere Profiländerungen

1. Vorlage `backend/src/extraction/templates/wohngeld-eingang.ts` ändern und `WOHNGELD_PROFIL_VORLAGE_STAND`
   hochzählen (unbearbeitete Profile werden beim nächsten Gebrauch angehoben; in der DP-Oberfläche bearbeitete nicht).
2. Messen: `bun run scripts/wohngeld-golden/messung.ts --variante beide --erkennung profil` (Cache je Profil-Hash).
3. Mit dieser Tabelle vergleichen; Rückschritte (z. B. neue Fehlschnitte wie bei Stand c) vor dem Commit beheben.

Berichte: `tools/wohngeld-golden/out/messung/2026-09-23T22-37-03` (b), `…/2026-09-24T00-15-10` (c),
`…/2026-09-24T01-54-45` (d) — lokal, nicht eingecheckt.

## Nachtrag: Haushalt aus dem Antrag und Personenzuordnung (Profil 2026-09-24e, Lauf `2026-09-24T05-40-28`)

Umsetzung: `docs/wohngeld-posteingang-haushalt-zuordnung-spec-2026-09-24.md` (Commit `cc8d049`). Der Posteingang legt
den Haushalt aus dem Antrag an und ordnet Nachweise per Name/Geburtsdatum den Personen zu; Ausweis-/KV-Regel ab 18.

| Variante | Posteingang-Prüfung Treffer · Fehlalarme (vorher) | Personen gefunden | Rolle | Erwerbsstatus | Einkommensarten | Nachweise richtig zugeordnet |
|---|---|---|---|---|---|---|
| digital | **92 % · 28** (80 % · 49) | 98 % | 98 % | 98 % | 95 % | 98 % (2 falsch, 2 offen) |
| scan | **94 % · 28** (80 % · 48) | 96 % | 98 % | 98 % | 96 % | 97 % (4 falsch, 2 offen) |

Split und Typ unverändert (100 % Schnitte, 99,7 % Typ); Regelwerk allein weiter 94 %.

Rest-Abweichungen der Posteingang-Prüfung:
- **35 der 56 Fehlalarme** sind `plausi-mietvertrag-unsigniert` — die bekannte Unterschrift-Lücke der hybriden
  Extraktion (siehe „Offene Hebel").
- `identitaet-jede-person` (F04, F24, F27), `plausi-kontoauszug-unerklaerte-einkuenfte` (F23, F25, F29): einzelne
  Zuordnungs-/Kontoauszugs-Fälle.
- Verfehlt: Vermögensgrenze F22 (Wertangaben aus Frage 20 nicht vollständig gelesen), Miethöhe F18
  (Regel vergleicht nur das erste Mietdokument), Antrag ohne Unterschrift F12.
- Zuordnung „falsch": Unterhaltsvorschuss-Bescheide gehen an den Elternteil (Adressat), die Erwartung nennt das Kind
  — fachlich zu klären, welche Person der Nachweis betrifft. F09 Scan: Name der antragstellenden Person falsch gelesen,
  dadurch keine Person gefunden.
