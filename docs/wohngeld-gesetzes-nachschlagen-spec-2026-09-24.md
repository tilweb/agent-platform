# Wohngeld — Fall-Chat: Gesetz nachschlagen (Spec, 2026-09-24)

Bezug: Fall-Chat C1–C4 (`docs/wohngeld-fall-chat-spec-2026-09-19.md`), Recht-KB C2 (`apps/wohngeld/recht/`).

## 1. Ziel

Der Assistent im Vorgang bekommt einen zweiten, klar getrennten Modus **„Gesetz nachschlagen"**. Dort
beantwortet er Fragen zu den gesetzlichen Regelungen **ausschließlich**, indem er die passende Stelle im
Gesetz findet und im **amtlichen Wortlaut** anzeigt — ohne eigene Formulierung, Zusammenfassung,
Auslegung oder Anwendung auf den Fall.

Die Sachbearbeitung wählt den Modus selbst (Umschalter im Chat-Kopf); beide Modi sind visuell
unterscheidbar und haben getrennte Verläufe.

## 2. Abgrenzung zum bestehenden Modus „Zum Antrag"

| | Zum Antrag (bisher) | Gesetz nachschlagen (neu) |
|---|---|---|
| Frage | zum konkreten Vorgang | zu gesetzlichen Regelungen |
| Antwort | vom Modell formuliert, mit Belegen (Dokumente, §) | nur Fundstellen im Wortlaut, kein formulierter Text |
| Rolle des Modells | Antwort schreiben | nur **auswählen**, welche Absätze passen (IDs) |
| Quelle | Fall-Kontext + kuratierter Rechts-Auszug | vollständige amtliche Fassung |
| Aktionen/Übernahme | Schreiben, Textbaustein, Notiz, App-Aktionen | Fundstelle kopieren, Gesetzestext öffnen, ganzen § anzeigen |

Der Modus „Zum Antrag" bleibt unverändert (Umstellung seines Rechts-Kontexts auf den Vollkorpus ist ein
möglicher Folgeschritt).

## 3. Rechtsquellen (Korpus)

- **WoGG** vollständig (alle §§ und Anlagen), **WoGV** vollständig, **SGB I §§ 60–67** (Mitwirkung,
  Folgen fehlender Mitwirkung — maßgeblich für Nachforderungen).
- Quelle: amtliche XML-Fassung von gesetze-im-internet.de (Download-Link `xml.zip` auf der jeweiligen
  Gesetzesseite). Amtliche Werke sind gemeinfrei (§ 5 UrhG).
- Ein Importskript (`backend/scripts/wohngeld-recht/importiere-gesetze.ts`) zerlegt die XML in **Absätze**
  (Einheit der Fundstelle, z. B. „§ 14 Abs. 2 WoGG") und schreibt `apps/wohngeld/recht/gesetze.json`
  (eingecheckt, Rechtsstand = „Zuletzt geändert durch …" aus der XML). Aufzählungen bleiben als nummerierte
  Zeilen erhalten, Tabellen der Anlagen als Zeilen. **Kein Wort wird verändert.**
- Aktualisierung: Skript erneut ausführen, Diff prüfen, committen. Die Anzeige nennt Stand und Quelle.

## 4. Ablauf einer Gesetzesfrage

1. **Vorauswahl (deterministisch):** Volltextsuche über alle Absätze (BM25-ähnlich, Umlaute gefaltet,
   Paragraphen-Nennung „§ 14", Gesetzesnennung „WoGV"/„SGB I" als starke Signale; die bestehenden
   alltagssprachlichen Suchbegriffe aus C2 werden je Paragraph übernommen). Ergebnis: bis zu 15 Kandidaten.
2. **Auswahl (Modell):** Das Modell erhält Frage + Kandidaten (ID, Fundstelle, Überschrift, Text) und gibt
   **nur IDs** zurück (1–4, nach Relevanz), strukturiert (JSON-Schema). Es darf „keine passt" antworten.
   IDs außerhalb der Kandidaten werden verworfen.
3. **Anzeige:** Die ausgewählten Absätze im Wortlaut aus dem Korpus (nicht aus der Modellantwort).
   Fällt das Modell aus, werden die besten Treffer der Vorauswahl gezeigt und als „automatische Vorauswahl"
   gekennzeichnet. Ohne Treffer: „Keine passende Stelle gefunden" + Hinweis auf die Suche nach
   Paragraphennummer.
4. **Protokoll:** Frage und Fundstellen werden im Verlauf des Vorgangs gespeichert (Modus „gesetz",
   Wortlaut als Momentaufnahme mit Stand); Audit `chat.gesetzfrage`; KI-Nutzung wie beim Fall-Chat.

## 5. Oberfläche

- Umschalter unter dem Chat-Kopf: **„Zum Antrag"** | **„Gesetz nachschlagen"** (Waage-Symbol).
  Die Wahl trifft nur der Mensch; es gibt keine automatische Umleitung.
- Gesetz-Modus: eigener Verlauf, eigene Vorschlags-Chips, Platzhalter „Frage zu WoGG, WoGV oder SGB I …",
  Hinweiszeile „Zeigt ausschließlich den Gesetzeswortlaut — keine Auslegung, keine Anwendung auf den Fall.",
  breiteres Panel für lesbaren Gesetzestext.
- Antwort als **Fundstellen-Karten**: Kopf „§ 14 Abs. 2 WoGG — Jahreseinkommen", Wortlaut (Suchbegriffe
  hervorgehoben), Fuß mit Stand, „ganzen § anzeigen", „Fundstelle kopieren", „Gesetzestext öffnen".

## 6. Nicht-Ziele

- Keine Auslegung, keine Subsumtion auf den Fall, keine Zusammenfassung.
- Keine Verwaltungsvorschrift (WoGVwV) und keine Rechtsprechung — mögliche Erweiterung.
- Keine Embedding-Infrastruktur.

## 7. Abnahme

- Parser-Tests (Absätze, Aufzählungen, Anlagen), Such-Tests mit typischen Fragen
  (Einkommen → § 14 WoGG, Mitwirkung/Folgen → §§ 60/66 SGB I, „§ 7" → § 7 WoGG, Schwerbehinderung → § 17 WoGG),
  Auswahl-Tests (nur Kandidaten-IDs, Rückfall ohne Modell).
- Stichprobe gegen das Live-Modell.
