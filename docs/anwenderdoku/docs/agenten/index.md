# Agenten

## Was sind Agenten?

Agenten sind spezialisierte KI-Assistenten innerhalb des Adacor Workplace. Jeder Agent verfügt über eine eigene Identität, die durch drei Kernelemente definiert wird:

- **System-Prompt** -- die Persönlichkeit und Arbeitsanweisungen des Agenten
- **Tools** -- die Werkzeuge, auf die der Agent zugreifen darf (z.B. Websuche, Dateizugriff, Bildgenerierung)
- **Modell** -- das KI-Modell, das der Agent verwendet (geerbt vom System oder fest zugewiesen)

Ein Agent ist also ein konfigurierter Spezialist, der für bestimmte Aufgabentypen optimiert ist. Der Researcher-Agent ist beispielsweise darauf trainiert, strukturierte Web-Recherchen durchzuführen, während der Writer-Agent auf das Verfassen von Texten und Dokumenten spezialisiert ist.

## Agent vs. Skill -- der Unterschied

Die Abgrenzung zwischen Agenten und Skills lässt sich mit einer einfachen Formel zusammenfassen:

| Konzept | Bedeutung | Beschreibung |
|---------|-----------|--------------|
| **Agent** | **WER** -- Identität & Werkzeuge | Der Spezialist, der die Aufgabe ausführt. Hat eigene Persönlichkeit, Fähigkeiten und Zugriff auf bestimmte Tools. |
| **Skill** | **WIE** -- Methodik & Arbeitsablauf | Die Vorgehensweise, die ein Agent anwendet. Definiert Schritte, Trigger-Wörter und Ausgabeformate. |

> [!example] Beispiel
> Der **Researcher-Agent** (WER) kann den **Deep-Research-Skill** (WIE) anwenden. Der Agent bringt die Fähigkeit zur Websuche mit, der Skill definiert den strukturierten Ablauf einer Tiefenrecherche mit Planung, Recherche, Synthese und Dokumentation.

## System-Agenten vs. eigene Agenten

Der Adacor Workplace unterscheidet zwischen zwei Arten von Agenten:

### System-Agenten

System-Agenten sind fest in die Plattform integriert und werden von den Administratoren bereitgestellt. Sie decken die gängigsten Anwendungsfälle ab -- von Recherche über Texterstellung bis hin zur Bildgenerierung. System-Agenten können **nicht bearbeitet oder gelöscht** werden.

Eine vollständige Übersicht aller System-Agenten finden Sie unter [System-Agenten](system-agenten.md).

### Eigene Agenten (Custom Agents)

Sie können eigene Agenten erstellen, die exakt auf Ihre Anforderungen zugeschnitten sind. Dabei legen Sie den System-Prompt, die verfügbaren Tools, das Modell und den Zugriff auf Skills selbst fest.

Mehr dazu unter [Eigene Agenten erstellen](eigene-agenten.md).

## Agent-Delegation

Ein zentrales Konzept des Adacor Workplace ist die **Delegation zwischen Agenten**. Ein Agent kann Teilaufgaben an andere Agenten übergeben, wenn diese besser dafür geeignet sind. So entsteht eine Zusammenarbeit zwischen Spezialisten:

```
Benutzer: "Recherchiere zum EU AI Act und schreibe eine Zusammenfassung als E-Mail."

Supervisor
  +-- Schritt 1: Delegiert an Researcher --> Web-Recherche
  +-- Schritt 2: Delegiert an Writer --> E-Mail mit den Ergebnissen verfassen
  +-- Ergebnis: Fertige E-Mail wird dem Benutzer präsentiert
```

> [!info] Delegierbare Agenten
> Nicht jeder Agent kann als Delegationsziel dienen. Ob ein Agent delegierbar ist, wird in seiner Konfiguration festgelegt. Der Supervisor selbst ist beispielsweise **nicht** delegierbar -- er delegiert an andere, wird aber nicht von anderen aufgerufen.

## Auto-Routing über den Supervisor

Wenn Sie keinen bestimmten Agenten auswählen, übernimmt der **Supervisor-Agent** automatisch das Routing Ihrer Anfrage. Er analysiert Ihre Nachricht und entscheidet:

1. **Direkt antworten** -- bei einfachen Fragen, Begrüßung oder Fragen zur Plattform
2. **An einen Spezialisten delegieren** -- bei Aufgaben, die spezifische Fähigkeiten erfordern
3. **Mehrstufig orchestrieren** -- bei komplexen Aufgaben, die mehrere Agenten erfordern

Der Supervisor arbeitet dabei vollständig autonom: Wenn ein Agent keine ausreichende Antwort liefert, eskaliert der Supervisor automatisch an einen anderen Agenten, ohne bei Ihnen nachzufragen.

> [!tip] Tipp
> Für die meisten Anwendungsfälle ist es am einfachsten, den Supervisor arbeiten zu lassen. Wählen Sie einen bestimmten Agenten nur dann direkt aus, wenn Sie sicher sind, dass genau dieser Spezialist benötigt wird.
