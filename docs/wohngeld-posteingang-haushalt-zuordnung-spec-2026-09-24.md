# Wohngeld — Haushalt aus dem Antrag, Nachweise den Personen zuordnen (Spec, 2026-09-24)

Bezug: `docs/wohngeld-dp-profil-messung-2026-09-24.md` (Abschnitt „Offene Hebel"),
`docs/wohngeld-dp-segmentprofil-spec-2026-09-24.md`.

## 1. Problem

Die Erkennung im Posteingang ist gut (Split 100 %, Typ 99,7 %), die Prüfung nach „Zuordnen" trifft aber nur
80 % der erwarteten Befunde und meldet rund 50 Fehlalarme je Messlauf. Ursache ist nicht die Erkennung,
sondern was der Posteingang daraus in den Vorgang schreibt:

- **Nur die antragstellende Person wird angelegt** — ohne Erwerbsstatus, Einnahmen, Schwerbehinderung/Pflegegrad,
  Vermögen oder Transferleistungen. Die personenbezogenen Nachweisregeln (Rente, Verdienst, Kindergeld,
  Pflegegrad, Schwerbehinderung, Vermögen, § 7-Ausschluss) haben dadurch nichts, woran sie anschlagen — 7 der
  10 verfehlten Regeln.
- **Kein Dokument trägt eine Person.** Die Regeln fragen „liegt für Person X ein Nachweis vom Typ Y vor?".
  Ohne `personId` ist die Antwort immer nein — daher meldet `identitaet-jede-person` fast in jedem Fall
  „Personalausweis fehlt", obwohl der Ausweis erkannt wurde (~48 Fehlalarme je Variante).
- **Bekannte Übermeldung bei Kindern:** Ausweis und Kranken-/Pflegeversicherungsnachweis werden für jede Person
  verlangt, auch für Kinder. Sobald mehr Personen angelegt werden, würde das sichtbarer.

## 2. Ziel

Nach „Zuordnen" entspricht der Vorgang dem, was eine Sachbearbeiterin nach dem Abtippen des Antrags hätte:
alle Haushaltsmitglieder mit den Merkmalen, die die Prüfregeln brauchen, und jeder personenbezogene Nachweis
hängt an der richtigen Person. Alles bleibt **Vorschlag** (Human-in-the-Loop), nichts wird still entschieden.

Messbar über das Golden Dataset: Trefferquote der Posteingang-Prüfung Richtung Regelwerk-allein (94 %),
Fehlalarme etwa halbiert; neue Kennzahlen „Haushalt richtig angelegt" und „Nachweis richtig zugeordnet".

## 3. Fachliche Entscheidungen

1. **Quelle des Haushalts ist der Antrag** (amtliches Formular): Frage 1 (Erwerbsstatus Antragsteller),
   Frage 6 (Haushaltsmitglieder 1–4: Name, Geburtsdatum, Verhältnis, Erwerbsstatus), Frage 10 (Transferleistungen),
   Frage 12 (Einnahmen je Person: Art, Brutto, Turnus), Frage 15 (GdB, Pflegegrad, häusliche Pflege),
   Frage 20 (Vermögen über Freigrenze mit Wertangaben). Das Zusatzblatt (ab 5. Mitglied) bleibt vorerst
   unausgelesen — Hinweis im Vorgang, kein stilles Weglassen.
2. **Personen werden nur angelegt, wenn der Vorgang noch keine hat** (neuer Vorgang). Bei Nachreichungen an einen
   bestehenden Vorgang werden keine Personen angelegt oder geändert — dort wird nur zugeordnet.
3. **Angelegte Personen sind KI-Vorschläge:** Name und Geburtsdatum jeder Person bekommen den Feld-Status
   „KI-Vorschlag, unbestätigt" (wie heute beim Antragsteller). Einkommenspositionen tragen
   `beruecksichtigt: false` (= noch nicht von der Sachbearbeitung bestätigt).
4. **Zuordnung Nachweis → Person ist deterministisch** (kein LLM), über die gelesene Identität des Nachweises:
   - Geburtsdatum gleich ⇒ Treffer (stärkstes Signal).
   - Vor- und Nachname gleich (normalisiert, erster Vorname genügt) ⇒ Treffer.
   - Nur Vorname oder nur Nachname gleich ⇒ Treffer nur, wenn genau eine Person passt.
   - Widerspruch (z. B. Name passt, Geburtsdatum abweichend) oder mehrere Kandidaten ⇒ **keine Zuordnung**,
     Dokument bekommt den Hinweis „Person nicht eindeutig zuordenbar".
   - Nachweis ohne gelesene Identität in einem Ein-Personen-Haushalt ⇒ antragstellende Person.
   - Haushaltsbezogene Unterlagen (Antrag, Mietvertrag, Vermieterbescheinigung, Sonstiges) bekommen keine Person.
   Die Sachbearbeitung kann die Zuordnung an jedem Dokument ändern (Auswahl „Haushalt / Person …");
   danach wird neu geprüft. Änderung wird wie jede Dokumentänderung protokolliert (Audit `personId`).
5. **Kindergeld:** Der Antrag fragt Kindergeld nicht ab (es ist kein Einkommen i. S. d. WoGG). Leben Kinder unter
   18 im Haushalt, wird Kindergeldbezug angenommen: bei der Person, der ein Kindergeldbescheid zugeordnet wurde,
   sonst bei der antragstellenden Person. So fordert die Regel `kindergeld-nachweis` den Bescheid an, wenn er fehlt.
6. **Transferleistung ⇒ Ausschlussgrund (§ 7)** nur bei bewilligter, nicht weggefallener, nicht abgelehnter
   Leistung; Bürgergeld/SGB II, Grundsicherung, Sozialhilfe, SGB VIII, AsylbLG werden auf die bestehenden
   Ausschlussgründe abgebildet, anderes als Freitext.
7. **Vermögen:** Summe der Wertangaben aus Frage 20 an der antragstellenden Person (wie heute das Legacy-Feld).
8. **Regelkorrektur Kinder:** `identitaet-jede-person` und `krankenversicherung-nachweis` gelten nur für Personen
   ab 18 Jahren (Stichtag Antragsdatum; ohne Geburtsdatum weiter verlangt). Grundlage: Fallkatalog §7 —
   Kinder sind im Antrag erfasst, Ausweispflicht erst ab 16, Kinder in der Regel familienversichert.
   Die weitergehende Frage (KV-Nachweis nur für Selbständige/privat Versicherte) bleibt offen bis zur Bestätigung
   durch eine Pilotkommune. `REGELKATALOG_STAND` wird hochgezählt.

## 4. Technische Umsetzung

| Baustein | Datei | Änderung |
|---|---|---|
| Profil | `extraction/templates/wohngeld-eingang.ts` | Antrag liest zusätzlich `antragsteller_erwerbsstatus`, Listen `haushaltsmitglieder`, `einnahmen`, `behinderung_pflege`, `transferleistungen`, Vermögenswerte Frage 20. Vorlagenstand `2026-09-24e`. |
| Abbildung | `apps/wohngeld/dp-erkennung.ts`, `extraction.ts` | `ExtrahierteStammdaten.haushalt` (neuer Typ `HaushaltAngaben`), aus den Rohwerten normalisiert. |
| Haushalt + Zuordnung | `apps/wohngeld/haushalt.ts` (neu, rein, DB-frei) | `personenAusAntrag()`, `ordneNachweisePersonenZu()`, `kindergeldEmpfaenger()`; mit Tests. |
| Posteingang | `routes/posteingang.ts` `verteileDokumente` | legt den Haushalt an (nur ohne vorhandene Personen), setzt Feld-Status je Person, ordnet Dokumente zu (`personId` bzw. Hinweis), setzt Kindergeld-Merkmal. Direkt-Upload am Vorgang ordnet ebenfalls zu. |
| Regeln | `checker/nachweise.ts`, `checker/regeln.ts` | Altersgrenze 18 für Ausweis/KV; Beschreibung + Stand. |
| Oberfläche | `VorgangDetail.jsx` | am Dokument: zugeordnete Person bzw. „Haushalt", Auswahl zum Ändern (Editor), danach Neuprüfung. |
| Messung | `scripts/wohngeld-golden/snapshot.ts`, `messung.ts`, `bericht.ts` | Posteingang-Stand nutzt dieselben reinen Funktionen wie die App; neue Kennzahlen Haushalt/Zuordnung. |
| Testbestand | `scripts/wohngeld-golden/profilwahrheit.ts`, `testbestand.ts` | Wahrheit um die neuen Antragsfelder erweitert; `--erneuern` ersetzt die Testbeispiele. |

## 5. Nicht-Ziele

- Zusatzblatt (5.+ Mitglied) auslesen.
- Personen bei Nachreichungen ergänzen oder abgleichen.
- Unterhalt, Werbungskosten, Kinderbetreuung, einmalige Einnahmen aus dem Antrag übernehmen.
- Unterschrift im Mietvertrag (eigener Hebel, Plattform-Engine).

## 6. Abnahme

- Unit-Tests für `haushalt.ts` (Rollen, Erwerbsstatus, Einnahmen-Zuordnung, Transfer, Vermögen, Zuordnungsfälle
  inkl. Namensgleichheit in Familien und Widerspruch).
- Regeltests für die Altersgrenze.
- Voller Messlauf (30 Fälle, digital + Scan) mit Vergleich zu `2026-09-24T01-54-45`: Posteingang-Treffer,
  Fehlalarme, Haushalt, Zuordnung. Ergebnis im Messdokument.
