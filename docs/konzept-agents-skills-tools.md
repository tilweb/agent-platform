# Konzept: Agents, Skills und Tools

## Status: Entwurf / Zur Diskussion

---

## Aktuelles Modell

| Konzept | Was ist es? | Beispiel |
|---------|-------------|----------|
| **Tool** | Atomare Funktion | `web_search`, `file_read`, `confluence_search` |
| **Agent** | Spezialist mit Persönlichkeit, Tools, System-Prompt | `researcher`, `writer`, `google-drive` |
| **Skill** | Workflow mit Triggern, kann Agents aufrufen | `deep-research`, `commit` |

---

## Das Problem

Aus User-Sicht ist die Abgrenzung zwischen Agent und Skill nicht intuitiv:

- "Recherchiere zu X" → Ist das der `researcher`-Agent oder der `deep-research`-Skill?
- Beide machen "Recherche"
- Die Unterscheidung ist technisch, nicht aus User-Perspektive nachvollziehbar

### Fragen die sich stellen:
- Wann nutze ich einen Agent direkt (@researcher)?
- Wann nutze ich einen Skill (/deep-research)?
- Was ist der Unterschied im Ergebnis?

---

## Lösungsvorschläge

### Option A: Skills abschaffen → Alles sind Agents

- Workflows werden Teil des Agent-System-Prompts
- Trigger-Keywords werden Agent-Eigenschaften
- Skills-Ordner wird aufgelöst, Logik wandert in Agents

**Pro:**
- Ein klares Konzept für User
- Weniger Komplexität im System
- Agents sind der einzige "Ansprechpartner"

**Con:**
- Agents werden komplexer
- Verlust von expliziten Workflow-Definitionen

### Option B: Skills = Agent-Modi

- Skills sind keine eigenständige Entität
- Sie sind "Presets" die einen Agent mit spezifischem Modus aufrufen
- `/deep-research` = ruft `researcher` im "gründlich"-Modus auf
- `/quick-search` = ruft `researcher` im "schnell"-Modus auf

**Pro:**
- Flexibel und erweiterbar
- Klare Zuordnung: Skill → Agent
- User versteht: "Das ist eine Variante von Agent X"

**Con:**
- Braucht Mode-Logik in Agents
- Agents müssen verschiedene Modi unterstützen

### Option C: Skills = Slash-Commands (reine Shortcuts)

- Skills sind nur UI/UX-Convenience
- `/commit` ist ein Shortcut für eine vordefinierte Anweisung an einen Agent
- Kein eigenes Backend-Konzept, nur Frontend-Makros
- Werden zu Text expandiert der an den Chat gesendet wird

**Pro:**
- Sehr einfach zu implementieren
- Keine Backend-Änderungen nötig
- User kann eigene Shortcuts definieren

**Con:**
- Weniger mächtig (keine Workflows)
- Keine strukturierte Ausgabe

---

## Empfehlung

**Klares Modell für User:**

| Konzept | Sichtbarkeit | Beschreibung |
|---------|--------------|--------------|
| **Tools** | Unsichtbar | Was das System kann (Bausteine) |
| **Agents** | Sichtbar, ansprechbar | Mit wem der User spricht |
| **Slash-Commands** | Sichtbar, nutzbar | Shortcuts für häufige Aufgaben |

### Umsetzung (Option A/B Hybrid):

1. **Skills werden in Agents integriert**
   - `deep-research` Skill → Teil des `researcher` Agent-Prompts
   - Agent entscheidet selbst ob er "schnell" oder "gründlich" arbeitet

2. **Slash-Commands bleiben als Shortcuts**
   - `/research X` → Sendet "Recherchiere gründlich zu X" an Supervisor
   - `/commit` → Sendet "Erstelle einen Commit" an Supervisor
   - Sind nur Text-Makros, keine eigene Logik

3. **Workflow-Logik in Agent-Prompts**
   - Statt separater Workflow-Definition im Skill
   - Agent-Prompt beschreibt wie der Agent vorgeht

---

## Offene Fragen

- [ ] Was passiert mit bestehenden Skills?
- [ ] Wie migrieren wir Skill-Workflows in Agent-Prompts?
- [ ] Sollen User eigene Slash-Commands definieren können?
- [ ] Wie dokumentieren wir das neue Modell für User?

---

## Nächste Schritte

1. Entscheidung für eine Option treffen
2. Migration-Plan erstellen
3. Dokumentation aktualisieren
4. UI anpassen (Skills-Seite entfernen oder umbenennen)
