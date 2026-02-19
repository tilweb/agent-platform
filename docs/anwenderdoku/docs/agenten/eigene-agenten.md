# Eigene Agenten erstellen

Neben den vorinstallierten System-Agenten können Sie eigene Agenten erstellen, die exakt auf Ihre Anforderungen zugeschnitten sind. Ein eigener Agent eignet sich besonders dann, wenn Sie einen Spezialisten für einen wiederkehrenden Aufgabenbereich benötigen, der mit bestimmten Tools und Anweisungen arbeiten soll.

---

## Agent-Erstellungsformular

Um einen neuen Agenten zu erstellen, navigieren Sie zu **Einstellungen** und wählen den Bereich **Agenten**. Dort finden Sie die Schaltfläche zum Erstellen eines neuen Agenten.

### Name und Beschreibung

| Feld | Beschreibung |
|------|--------------|
| **Name** | Ein aussagekräftiger Name für Ihren Agenten (z.B. "Marketing-Texter", "Compliance-Prüfer") |
| **Beschreibung** | Eine kurze Beschreibung, was der Agent tut. Diese wird dem Supervisor und anderen Agenten angezeigt, damit sie wissen, wofür dieser Agent zuständig ist. |
| **Fähigkeiten** | Stichworte, die die Kernfähigkeiten beschreiben (z.B. "Texterstellung", "Rechtsberatung", "Datenanalyse") |

> [!tip] Aussagekräftige Beschreibung
> Eine gute Beschreibung hilft dem Supervisor-Agenten, Ihren eigenen Agenten korrekt einzusetzen. Beschreiben Sie klar, für welche Aufgaben der Agent geeignet ist und für welche nicht.

---

## System-Prompt

Der System-Prompt ist das Herzstück Ihres Agenten. Er definiert die Persönlichkeit, die Arbeitsweise und die Regeln, nach denen der Agent handelt.

**Empfohlene Struktur:**

1. **Rolle und Identität** -- Wer ist der Agent? Was ist seine Aufgabe?
2. **Arbeitsanweisungen** -- Wie soll der Agent vorgehen? Welche Schritte soll er befolgen?
3. **Regeln und Einschränkungen** -- Was darf der Agent nicht tun? Welche Grenzen gibt es?
4. **Ausgabeformat** -- In welchem Format soll der Agent antworten?

> [!example] Beispiel: System-Prompt für einen Compliance-Prüfer
> ```
> Du bist ein Compliance-Prüfer für die Adacor Hosting GmbH.
>
> ## Deine Aufgabe
> Prüfe Dokumente und Prozesse auf Einhaltung der internen Richtlinien
> und regulatorischen Anforderungen (ISO 27001, DSGVO, EU AI Act).
>
> ## Vorgehen
> 1. Lies das übergebene Dokument vollständig
> 2. Identifiziere relevante Compliance-Anforderungen
> 3. Prüfe systematisch auf Abweichungen
> 4. Erstelle einen strukturierten Prüfbericht
>
> ## Regeln
> - Antworte immer auf Deutsch
> - Kennzeichne kritische Abweichungen deutlich
> - Gib zu jeder Feststellung die betroffene Norm/Richtlinie an
> ```

---

## Tool-Auswahl

Tools sind die Werkzeuge, die Ihrem Agenten zur Verfügung stehen. Sie wählen die gewünschten Tools über Checkboxen aus, die nach Kategorien gruppiert sind.

### Tool-Kategorien

| Kategorie | Beispiele | Beschreibung |
|-----------|-----------|--------------|
| **Lokale Tools** | `file_read`, `file_write`, `file_list` | Lesen, Schreiben und Auflisten von Dateien im Data-Verzeichnis |
| **API-Tools** | `web_search`, `generate_image` | Zugriff auf externe Dienste (Websuche, Bildgenerierung) |
| **Knowledge-Tools** | `kb_search`, `kb_index`, `kb_manage` | Zugriff auf die Wissensdatenbank |
| **Tabellen-Tools** | `table_query`, `table_manage` | Zugriff auf das Tabellen-System |
| **Spezial-Tools** | `delegate_to_agent`, `user_memory`, `create_task` | Delegation an andere Agenten, Benutzerspeicher, Hintergrund-Tasks |
| **Export-Tools** | `export_document` | Export von Inhalten als Word, Excel oder PDF |

> [!warning] Sicherheitshinweis
> Wählen Sie nur die Tools aus, die Ihr Agent tatsächlich benötigt. Ein Agent mit Zugriff auf `file_write` kann Dateien im Data-Verzeichnis erstellen und ändern. Ein Agent mit `delegate_to_agent` kann andere Agenten beauftragen.

---

## Skill-Zugriffsmodus

Sie können festlegen, auf welche Skills Ihr Agent zugreifen darf. Skills erweitern die Fähigkeiten eines Agenten um vordefinierte Arbeitsabläufe.

| Modus | Beschreibung |
|-------|--------------|
| **Alle Skills** | Der Agent kann alle verfügbaren Skills laden und verwenden. Empfohlen für vielseitige Agenten. |
| **Ausgewählte Skills** | Der Agent hat nur Zugriff auf die Skills, die Sie explizit auswählen. Empfohlen, wenn der Agent auf bestimmte Arbeitsabläufe beschränkt sein soll. |

---

## Modellauswahl

Für jeden Agenten können Sie festlegen, welches KI-Modell er verwenden soll.

| Option | Beschreibung |
|--------|--------------|
| **Erben (Standard)** | Der Agent verwendet das Modell, das der Benutzer in seinen Einstellungen ausgewählt hat. Dies ist die flexibelste Option. |
| **Festes Modell** | Der Agent verwendet immer ein bestimmtes Modell, unabhängig von der Benutzereinstellung. Sinnvoll, wenn der Agent ein Modell mit bestimmten Fähigkeiten benötigt (z.B. Vision für Bildanalyse). |

> [!info] Modellfähigkeiten
> Nicht jedes Modell unterstützt alle Funktionen. Achten Sie darauf, dass das gewählte Modell die benötigten Fähigkeiten mitbringt -- z.B. `function_calling` für die Nutzung von Tools oder `vision` für Bildanalyse.

---

## Delegierbar-Schalter

Der **Delegierbar**-Schalter bestimmt, ob andere Agenten (insbesondere der Supervisor) Aufgaben an Ihren Agenten delegieren können.

| Einstellung | Verhalten |
|-------------|-----------|
| **Aktiviert** | Der Agent erscheint in der Liste der verfügbaren Delegationsziele. Der Supervisor kann ihm Aufgaben zuweisen. |
| **Deaktiviert** | Der Agent kann nur direkt vom Benutzer aufgerufen werden. Andere Agenten können nicht an ihn delegieren. |

> [!tip] Empfehlung
> Aktivieren Sie den Delegierbar-Schalter, wenn Ihr Agent als Spezialist im Multi-Agent-System arbeiten soll. Deaktivieren Sie ihn, wenn der Agent nur für den direkten Einsatz durch den Benutzer gedacht ist.

---

## Berechtigungen und Zugriffssteuerung

Sie können festlegen, welche Benutzer Zugriff auf Ihren Agenten haben. Dies ist besonders bei Agenten relevant, die auf sensible Daten zugreifen oder spezielle Aufgaben ausführen.

**Zugriffskontrolle:**

- **Alle Benutzer** -- Jeder angemeldete Benutzer kann den Agenten verwenden
- **Bestimmte Benutzer** -- Nur ausgewählte Benutzer erhalten Zugriff
- **Bestimmte Rollen** -- Zugriff wird über RBAC-Rollen gesteuert (z.B. nur Administratoren oder bestimmte Projektgruppen)

> [!warning] Datensicherheit
> Beachten Sie bei der Konfiguration der Berechtigungen, auf welche Daten der Agent über seine Tools zugreifen kann. Ein Agent mit Zugriff auf die Knowledge Base und ohne Einschränkungen könnte sensible Unternehmensinformationen an alle Benutzer weitergeben.

---

## Zusammenfassung: Checkliste für neue Agenten

Bevor Sie Ihren Agenten erstellen, stellen Sie sicher:

- [ ] **Name und Beschreibung** sind aussagekräftig und eindeutig
- [ ] **System-Prompt** definiert klar Rolle, Vorgehen, Regeln und Ausgabeformat
- [ ] **Tools** sind auf das Nötigste beschränkt
- [ ] **Skill-Zugriff** ist passend konfiguriert
- [ ] **Modell** ist geeignet für die geplanten Aufgaben
- [ ] **Delegierbar-Schalter** ist bewusst gesetzt
- [ ] **Berechtigungen** sind für die richtigen Benutzer konfiguriert
