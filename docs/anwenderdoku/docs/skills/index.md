# Skills

## Was sind Skills?

Skills sind modulare Wissens- und Arbeitsablauf-Pakete, die Agenten bei Bedarf laden können. Ein Skill definiert eine bestimmte Vorgehensweise -- zum Beispiel, wie eine gründliche Web-Recherche durchgeführt wird oder wie ein Code-Review ablaufen soll.

Während ein Agent die **Identität** mitbringt (Persönlichkeit, Grundfähigkeiten, Tool-Zugriff), liefert ein Skill die **Methodik** für eine bestimmte Aufgabe: Schritt-für-Schritt-Anweisungen, ein definiertes Ausgabeformat und gegebenenfalls zusätzliche Tools.

---

## Abgrenzung: Skill vs. Agent

| | **Agent (WER)** | **Skill (WIE)** |
|---|---|---|
| **Funktion** | Spezialist mit eigener Identität | Methodisches Wissen und Arbeitsablauf |
| **Metapher** | Der Handwerker | Die Bauanleitung |
| **Umfasst** | System-Prompt, Tools, Modell | Trigger, Anweisungen, Workflow-Schritte, Ausgabeformat |
| **Aktivierung** | Auswahl im Chat oder Delegation | Automatisch (Schlüsselbegriffe) oder manuell (/skill-id) |
| **Persistenz** | Immer verfügbar | Wird bei Bedarf in den Agenten geladen |

> [!example] Zusammenspiel von Agent und Skill
> Wenn Sie schreiben: *"Recherchiere ausführlich zum EU AI Act"*, passiert Folgendes:
>
> 1. Der **Supervisor** (Agent) erkennt die Aufgabe
> 2. Er delegiert an den **Researcher** (Agent)
> 3. Der Researcher lädt den **Deep-Research-Skill** (Skill), weil das Schlüsselwort "ausführlich" die automatische Aktivierung auslöst
> 4. Der Skill liefert den strukturierten Ablauf: Planung, Recherche, Synthese, Dokumentation
> 5. Der Researcher führt den Ablauf mit seinen Tools aus

---

## Skill-Aktivierung

Skills können auf zwei Wegen aktiviert werden:

### Automatische Aktivierung (Keyword-Matching)

Jeder Skill definiert Schlüsselbegriffe und Muster, die seine Aktivierung auslösen. Wenn Ihre Nachricht eines dieser Wörter oder Muster enthält, wird der passende Skill automatisch geladen.

> [!example] Beispiele für automatische Aktivierung
> - *"Recherchiere zum Thema..."* --> Aktiviert den Skill **Web Recherche** (Schlüsselwort: "recherchiere")
> - *"Generiere ein Bild von..."* --> Aktiviert den Skill **Bildgenerierung** (Schlüsselwort: "generiere ein bild")
> - *"Suche in der Wissensdatenbank..."* --> Aktiviert den Skill **Knowledge Query** (Schlüsselwort: "wissensdatenbank")

### Manuelle Aktivierung (/skill-id)

Sie können einen Skill jederzeit direkt aufrufen, indem Sie seinen Slash-Command verwenden:

```
/web-research Aktuelle Entwicklungen bei erneuerbaren Energien
/deep-research EU AI Act Anforderungen für KMU
/image-generation Ein Logo für eine Nachhaltigkeitsinitiative
```

> [!tip] Tipp
> Die manuelle Aktivierung eignet sich, wenn Sie gezielt einen bestimmten Arbeitsablauf auslösen möchten, ohne darauf zu vertrauen, dass das Keyword-Matching den richtigen Skill erkennt.

---

## Bestandteile eines Skills

Jeder Skill besteht aus den folgenden Komponenten:

### Trigger

Definieren, wann der Skill automatisch aktiviert wird:

- **Keywords** -- Einzelne Begriffe oder Phrasen (z.B. "recherchiere", "suche im web")
- **Patterns** -- Reguläre Ausdrücke für komplexere Erkennungsmuster (z.B. `recherchier(e)? (zu|über|nach)`)
- **Explicit** -- Einige Skills werden nur über den Slash-Command aktiviert (z.B. `/export`)

### Anweisungen (Instructions)

Die eigentlichen Arbeitsanweisungen für den Agenten. Sie beschreiben das Vorgehen, die Qualitätskriterien und wichtige Regeln, die der Agent bei der Ausführung beachten muss.

### Workflow-Schritte

Ein optionaler, strukturierter Ablauf, der den Agenten durch die einzelnen Phasen der Aufgabe führt:

- **think** -- Analyse- und Planungsschritt (kein Tool-Einsatz)
- **tool** -- Einsatz eines bestimmten Tools (z.B. `web_search`, `generate_image`)
- **delegate** -- Delegation an einen anderen Agenten
- **respond** -- Erstellung der finalen Antwort für den Benutzer

### Tools

Skills können eigene Tools mitbringen, die dem Agenten zusätzlich zur Verfügung gestellt werden. So erhält ein Agent, der normalerweise keinen Zugriff auf die Websuche hat, diesen temporär, wenn ein entsprechender Skill geladen wird.

### Ausgabeformat (Output)

Definiert das Format der Antwort. Viele Skills verwenden ein Markdown-Template mit Platzhaltern, um eine einheitliche und strukturierte Ausgabe sicherzustellen.

### Wissensreferenzen (Knowledge)

Einige Skills verweisen auf Dokumente oder Collections in der Knowledge Base, die bei der Ausführung automatisch als zusätzlicher Kontext geladen werden.

---

## Übersicht: Verfügbare Skills

Eine vollständige Aufstellung aller System-Skills und benutzerdefinierter Skills finden Sie unter [Verfügbare Skills](verfuegbare-skills.md).
