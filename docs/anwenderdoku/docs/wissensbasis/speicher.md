# Benutzer-Speicher (Memory)

Der Benutzer-Speicher ist das persönliche Gedächtnis des Adacor Workplace. Er ermöglicht es, Informationen über Sie, Ihre Präferenzen und Ihren aktuellen Arbeitskontext dauerhaft zu speichern. Diese Informationen werden automatisch in jeden Chat mit einem KI-Agenten einbezogen, sodass der Agent Sie besser unterstützen kann -- ohne dass Sie sich jedes Mal wiederholen müssen.

## Die drei Speicherbereiche

Der Benutzer-Speicher ist in drei klar getrennte Bereiche unterteilt, die jeweils einen anderen Zweck erfüllen.

### Über mich (About)

In diesem Bereich speichern Sie persönliche Informationen, Ihren Hintergrund und Ihre Rolle. Der Agent nutzt diese Informationen, um seine Antworten besser auf Sie zuzuschneiden.

**Typische Einträge:**

- Name und Rolle im Unternehmen
- Abteilung und Team
- Fachgebiete und Kompetenzen
- Beruflicher Hintergrund
- Bevorzugte Sprache

> [!example] Beispiele
> - "Ich bin Projektleiter in der IT-Abteilung"
> - "Mein Fachgebiet ist Cloud-Infrastruktur und DevOps"
> - "Ich arbeite seit 5 Jahren im Unternehmen"
> - "Meine Muttersprache ist Deutsch, ich kommuniziere aber auch auf Englisch"

### Anweisungen (Instructions)

Hier hinterlegen Sie Regeln, Präferenzen und Richtlinien, an die sich der Agent halten soll. Jede Anweisung kann mit einer **Priorität** versehen werden.

**Prioritätsstufen:**

| Priorität | Bedeutung | Kennzeichnung im Prompt |
|---|---|---|
| **Hoch (HIGH)** | Kritische Regel, die immer eingehalten werden muss | `[WICHTIG]` |
| **Normal** | Standardmäßige Präferenz | Ohne besondere Kennzeichnung |

**Typische Einträge:**

- Antwortformat (z.B. "Antworte immer in Stichpunkten")
- Tonalität (z.B. "Verwende eine formelle Ansprache")
- Fachliche Vorgaben (z.B. "Nutze immer metrische Einheiten")
- Einschränkungen (z.B. "Generiere keine Code-Beispiele in Python, nur TypeScript")

> [!example] Beispiele
> - **[HOCH]** "Antworte immer auf Deutsch, auch wenn die Frage auf Englisch gestellt wird"
> - **[NORMAL]** "Bevorzuge kurze, prägnante Antworten"
> - **[HOCH]** "Verwende bei technischen Erklärungen immer Beispiele"

### Kontext (Context)

Der Kontextbereich speichert Informationen über Ihre aktuellen Projekte, Aufgaben und Arbeitsschwerpunkte. Das Besondere: Kontexteinträge können **aktiviert und deaktiviert** werden, sodass Sie nur die gerade relevanten Kontexte an den Agenten übergeben.

Jeder Kontexteintrag hat:

- **Name** -- Kurzer Titel (z.B. Projektname)
- **Beschreibung** -- Detaillierte Informationen zum Kontext
- **Aktiv/Inaktiv** -- Nur aktive Kontexte werden dem Agenten übergeben

> [!tip] Wann Kontext aktivieren/deaktivieren?
> Deaktivieren Sie Kontexte, die gerade nicht relevant sind. So vermeiden Sie, dass der Agent mit zu vielen Informationen überladen wird. Wenn Sie z.B. zwischen zwei Projekten wechseln, deaktivieren Sie das eine und aktivieren das andere.

**Typische Einträge:**

- Aktuelle Projekte mit Beschreibung und Zielen
- Laufende Aufgaben oder Sprints
- Temporäre Arbeitsschwerpunkte
- Relevante technische Rahmenbedingungen

> [!example] Beispiele
> - **[Aktiv]** "Projekt: Cloud-Migration -- Wir migrieren die On-Premise-Infrastruktur zu AWS. Aktueller Fokus: Datenbankschicht"
> - **[Inaktiv]** "Projekt: Website-Relaunch -- Neugestaltung der Unternehmenswebsite mit React. Abgeschlossen."
> - **[Aktiv]** "Sprint 23 -- Fokus auf Performance-Optimierung der API-Endpunkte"

## Automatische Einbindung in den Agenten-Prompt

Alle gespeicherten Informationen werden automatisch in den System-Prompt des KI-Agenten injiziert. Dies geschieht in einer strukturierten Form:

1. **Über den Benutzer** -- Alle About-Einträge werden als Aufzählung dargestellt
2. **Benutzer-Anweisungen** -- Anweisungen werden nach Priorität sortiert (hoch zuerst), hohe Priorität wird mit `[WICHTIG]` gekennzeichnet
3. **Aktueller Kontext** -- Nur aktive Kontexte werden aufgelistet, mit Name und Beschreibung

> [!info] Maximale Einträge
> Pro Bereich können bis zu **15 Einträge** gespeichert werden. Wenn das Limit erreicht wird, werden bei neuen Einträgen die ältesten automatisch entfernt (bei Anweisungen werden zuerst normale Priorität entfernt, bei Kontext zuerst inaktive Einträge).

## Speicher verwalten

### Eintrag hinzufügen

1. Navigieren Sie zu **Einstellungen** und wählen Sie **Speicher** (oder direkt über das Hauptmenü)
2. Wählen Sie den gewünschten Bereich (Über mich, Anweisungen oder Kontext)
3. Geben Sie den Inhalt ein
4. Bei Anweisungen: Wählen Sie die Priorität (Hoch oder Normal)
5. Bei Kontext: Geben Sie einen Namen und optional eine Beschreibung ein
6. Speichern Sie den Eintrag

### Eintrag löschen

Klicken Sie auf das Löschen-Symbol neben dem jeweiligen Eintrag.

### Kontext aktivieren/deaktivieren

Nutzen Sie den Schalter neben einem Kontexteintrag, um ihn zu aktivieren oder zu deaktivieren. Deaktivierte Kontexte werden nicht an den Agenten übergeben, bleiben aber gespeichert.

### Speicher-Einstellungen

- **In Prompt einbeziehen** -- Aktiviert oder deaktiviert die automatische Einbindung des gesamten Speichers in den Agenten-Prompt. Standardmäßig aktiviert.
- **Max. Einträge pro Bereich** -- Begrenzt die Anzahl der Einträge pro Speicherbereich (Standard: 15).

## Quellen von Einträgen

Einträge im Speicher können aus zwei Quellen stammen:

| Quelle | Beschreibung |
|---|---|
| **Manuell** | Vom Benutzer selbst über die Oberfläche erstellt |
| **Agent** | Vom KI-Agenten während eines Chats automatisch hinzugefügt |

Agenten können während eines Gesprächs relevante Informationen erkennen und vorschlagen, diese in Ihrem Speicher abzulegen.

## Space-Speicher

Neben dem persönlichen Speicher gibt es auch einen **Space-Speicher** (siehe [Spaces](../spaces/index.md)). Dieser funktioniert identisch, ist aber an einen bestimmten Space gebunden und wird nur in Chats innerhalb dieses Spaces verwendet.

Der Space-Speicher ist vom persönlichen Speicher getrennt. In einem Space-Chat werden sowohl Ihr persönlicher Speicher als auch der Space-Speicher an den Agenten übergeben.

> [!tip] Best Practice
> Nutzen Sie den persönlichen Speicher für allgemeine Informationen (Rolle, Präferenzen, Stil) und den Space-Speicher für Space-spezifische Details (Architekturentscheidungen, Team-Konventionen, Ziele).
