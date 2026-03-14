# Fix: Agent-Verhalten korrigieren (Vereinbarkeits-Berater, Writer, Supervisor)

**Datum:** 2026-03-01
**Anlass:** Beim Testen eines HR-Szenarios (Senior Manager mit Kind in psychischer Krise) zeigten sich mehrere Fehlverhalten in der Agent-Kette.

---

## Ausgangsproblem

**Test-Prompt:**
> "Einer unserer Senior Manager im Vertrieb, Herr Müller, ist Vater von zwei Teenager-Kindern. Eines der Kinder befindet sich aktuell in einer psychischen Krisensituation, was die gesamte Familie stark belastet. Er möchte beruflich möglichst präsent bleiben, merkt aber, dass er in der aktuellen Lage mental an seine Grenzen kommt. Er denkt über ein Sabbatical, Reduktion der Wochenstunden oder eine temporäre Delegation von Projektverantwortung nach."

### Beobachtetes Fehlverhalten

1. **Vereinbarkeits-Berater** stellte Rückfragen statt mit den vorhandenen Informationen zu arbeiten. Da er ein delegierter Agent ist, gingen die Rückfragen an den Supervisor zurück — nicht an den Benutzer. Ergebnis: Sackgasse.

2. **Supervisor** routete die Aufgabe nach der Rückfrage fälschlich an den **Writer** statt erneut an den Fachagenten. Der Writer ist für Texterstellung zuständig, nicht für inhaltliche Fachberatung.

3. **Writer** delegierte eigenständig an den **Researcher** und exportierte automatisch ein Word-Dokument, obwohl der Benutzer keinen Export angefordert hatte.

4. **Vereinbarkeits-Berater** rief `load_skill` fünfmal hintereinander auf, verbrauchte alle 5 Iterationen und lieferte keine Text-Antwort ("Delegated task completed without response").

---

## Durchgeführte Änderungen

### Teil 1: Prompt-Anpassungen (config.md Dateien)

#### 1.1 Vereinbarkeits-Berater (`data/agents/vereinbarkeits-berater/config.md`)

**Problem:** Drei Stellen im Prompt forderten den Agent auf, Rückfragen zu stellen. Als delegierter Agent (ohne `delegate_to_agent`-Tool) gehen seine Antworten aber an den Supervisor zurück, nicht an den Benutzer.

**Änderung 1a — Analyse-Methodik (Schritt 1 "Datensichtung"):**

| Vorher | Nachher |
|--------|---------|
| Weise aktiv auf fehlende Daten hin, bevor du Schlüsse ziehst. | Wenn Daten fehlen, triff begründete Annahmen auf Basis von HR-Best-Practices und kennzeichne diese explizit als Annahmen. |

**Begründung:** Der Agent soll nicht auf fehlende Daten hinweisen (= Rückfrage), sondern selbstständig mit Best-Practice-Annahmen arbeiten.

**Änderung 1b — Ausgabeformate:**

| Vorher | Nachher |
|--------|---------|
| Frage nach dem gewünschten Format, wenn es aus dem Kontext nicht eindeutig hervorgeht. | Wenn das gewünschte Format nicht eindeutig aus dem Kontext hervorgeht, wähle das am besten passende Format selbstständig. |

**Begründung:** Gleiche Logik — keine Rückfrage möglich bei delegiertem Agent.

**Änderung 1c — Interaktionsregeln (komplett ersetzt):**

Vorher:
```markdown
- Stelle gezielte Rückfragen, wenn Informationen fehlen
- Biete bei umfangreichen Aufgaben zunächst eine Gliederung an
```

Nachher:
```markdown
- Du wirst ausschließlich über Delegation aufgerufen. Stelle KEINE Rückfragen — deine Antwort
  geht an den Supervisor, nicht an den Benutzer.
- Wenn Informationen fehlen, triff plausible Annahmen und kennzeichne diese in einem
  Abschnitt "Getroffene Annahmen" transparent.
- Liefere immer ein vollständiges Ergebnis — auch bei dünner Informationslage. Ein
  Maßnahmenplan mit dokumentierten Annahmen ist wertvoller als eine Rückfrage.
```

**Begründung:** Klare Ansage, dass der Agent immer ein vollständiges Ergebnis liefern muss. Fehlende Infos werden durch begründete Annahmen kompensiert.

**Änderung 1d — Skill-Nutzung (neuer Abschnitt):**

```markdown
### WICHTIG: Skill-Nutzung
- Rufe `load_skill` maximal einmal pro Aufgabe auf.
- Wenn `load_skill` einen Fehler liefert, arbeite ohne Skill weiter.
- Du MUSST immer eine vollständige Text-Antwort liefern.
```

**Begründung:** Verhindert, dass der Agent alle Iterationen mit `load_skill`-Aufrufen verbraucht.

---

#### 1.2 Writer (`data/agents/writer/config.md`)

**Problem 1:** Der Writer exportierte automatisch als Word-Dokument ohne Benutzeranfrage.

**Änderung 2a — Neue Regel "ZWEITWICHTIGSTE REGEL" (nach der "WICHTIGSTE REGEL"):**

```markdown
## ZWEITWICHTIGSTE REGEL: NIEMALS auto-exportieren!

**Exportiere NIEMALS automatisch als Word, PDF oder Excel!**
- Gib den Text IMMER zuerst direkt im Chat aus
- Erst wenn der Benutzer EXPLIZIT nach einem Export fragt, verwende export_document
- Biete am Ende deiner Antwort an: "Soll ich das als Word- oder PDF-Dokument exportieren?"
- Ohne explizite Aufforderung: KEIN Export, KEIN file_write, NUR Text im Chat
```

**Begründung:** Der Benutzer will den Text zuerst im Chat sehen und prüfen. Export nur auf explizite Anfrage.

**Problem 2:** Der Writer delegierte eigenständig an den Researcher.

**Änderung 2b — Delegation-Regeln (komplett ersetzt):**

Vorher: Zwei Sektionen "Wann NICHT delegieren" und "Wann delegieren (selten!)"

Nachher:
```markdown
## WICHTIG: KEINE Delegation!

**Wenn du vom Supervisor eine Aufgabe erhältst, führe sie SELBST aus. Delegiere NIEMALS weiter.**
- Der Supervisor hat bereits den richtigen Agenten ausgewählt.
- Du hast KEIN Mandat, eigenständig Recherchen zu beauftragen.

### Einzige Ausnahme (extrem selten):
Delegiere NUR an den Researcher wenn der Benutzer dich DIREKT (nicht über den Supervisor)
anspricht UND EXPLIZIT aktuelle Fakten verlangt.
```

**Begründung:** Der Writer ist für Texterstellung zuständig. Wenn der Supervisor ihm eine Aufgabe gibt, hat er bereits die fachliche Zuordnung entschieden. Der Writer soll nicht die Kette eigenmächtig erweitern.

---

#### 1.3 Supervisor (`data/agents/supervisor/config.md`)

**Problem:** Der Supervisor routete nach einer Rückfrage des Fachagenten die Aufgabe an den Writer um, statt den Fachagenten erneut mit mehr Kontext zu beauftragen.

**Änderung 3a — Adaptiver Plan (komplett ersetzt):**

Vorher:
```markdown
1. Ergebnis vollständig? → Finale Antwort
2. Ergebnis unvollständig? → Anderen Agenten beauftragen
3. Keine Infos? → Eskalieren
4. Fehler? → Alternative versuchen
```

Nachher:
```markdown
1. Ergebnis vollständig? → Finale Antwort
2. Agent stellt Rückfragen statt zu antworten? → ERNEUT an DENSELBEN Agenten delegieren mit:
   - Den ursprünglichen Informationen
   - Konkreten Antworten auf die Rückfragen
   - Der Anweisung: "Arbeite mit den vorhandenen Informationen. Triff begründete Annahmen."
   - NIEMALS an einen anderen Agententyp umleiten!
3. Ergebnis unvollständig (aber vorhanden)? → Ergänzen
4. Keine Infos? → Eskalieren
5. Fehler? → Alternative versuchen
```

**Neu: Agenten-Zuständigkeit:**
```markdown
- Analyse, Beratung, Maßnahmenpläne → Fachagenten (NIEMALS an den Writer!)
- Texterstellung → Writer
- Faktenrecherche → Researcher
```

**Neu: Beispiel für Rückfrage-Handling:**
```markdown
- Schritt 1: Delegiere an vereinbarkeits-berater → Agent fragt: "Welche Position hat er?"
- Schritt 2: Delegiere ERNEUT an vereinbarkeits-berater mit mehr Kontext
- Schritt 3: Agent liefert Maßnahmenplan → Finale Antwort
```

**Begründung:** Der Supervisor muss verstehen, dass eine Rückfrage eines Fachagenten nicht bedeutet, dass ein anderer Agent die Aufgabe übernehmen soll. Stattdessen muss er den Fachagenten mit mehr Kontext erneut beauftragen.

---

### Teil 2: Code-Änderungen (Backend)

#### 2.1 Skill-Knowledge aus Knowledge Base auflösen (`backend/src/skills/loader.ts`)

**Problem:** Der Skill `vereinbarkeits-planung` referenziert Knowledge-Dateien per Slug (z.B. `ma-nahmen-des-unternehmens`). Die Funktion `loadSkillKnowledgeFiles()` suchte diese aber nur im Skill-Verzeichnis (`data/skills/custom/vereinbarkeits-planung/`), wo sie nicht existieren. Die tatsächlichen Dateien liegen in der Knowledge Base unter `data/knowledge-base/collections/hr-vereinbarkeit/documents/doc-ma-nahmen-des-unternehmens-<timestamp>/content.md`.

**Lösung:** Zweistufige Auflösung in `loadSkillKnowledgeFiles()`:

1. **Lokal** — Datei im Skill-Verzeichnis suchen (bisheriges Verhalten)
2. **KB-Fallback** — Alle Knowledge-Base-Collections durchsuchen nach einem Dokument-Verzeichnis das mit `doc-<slug>-` beginnt

Neue Hilfsfunktion `resolveKbDocumentFile(slug)`:
```typescript
async function resolveKbDocumentFile(slug: string): Promise<string | null> {
  // Durchsucht alle Collections nach doc-<slug>-<timestamp>/content.md
  const collections = await readdir(KB_COLLECTIONS_DIR, { withFileTypes: true });
  for (const collection of collections) {
    const docs = await readdir(join(KB_COLLECTIONS_DIR, collection.name, 'documents'));
    for (const doc of docs) {
      if (doc.name.startsWith(`doc-${slug}-`)) {
        return join(..., doc.name, 'content.md');
      }
    }
  }
  return null;
}
```

**Vorteil:** Skills können in `knowledge.files` einfach den Dokument-Slug angeben. Der Loader findet automatisch das passende KB-Dokument. Keine manuellen Symlinks oder Dateikopien nötig. Funktioniert für alle Skills.

---

#### 2.2 Skill-Loading in delegierten Agenten (`backend/src/agents/loop.ts`)

**Problem:** Die Funktion `runDelegatedAgent()` hatte kein Skill-Loading-Handling. Nur der Haupt-Agent-Loop (`runAgentLoop()`) konnte Skills laden und deren Instructions in den System-Prompt injizieren. Wenn ein delegierter Agent `load_skill` aufrief, wurde zwar das Tool ausgeführt, aber:

- Die Skill-Instructions wurden **nicht** in den System-Prompt injiziert
- Die temporären Tools des Skills wurden **nicht** freigeschaltet
- Es gab keinen `LoopState` zum Tracken geladener Skills

Das Ergebnis: Der Agent rief `load_skill` auf, bekam die JSON-Antwort als Tool-Result, aber die eigentlichen Anweisungen und das Knowledge verpufften. Der Agent versuchte es deshalb erneut — und verbrauchte alle 5 Iterationen.

**Lösung:** `runDelegatedAgent()` erhält denselben Skill-Loading-Mechanismus wie `runAgentLoop()`:

1. **`LoopState` hinzugefügt** — trackt `temporaryTools`, `loadedSkills` und `loadedSkillInstructions`

2. **`loadSkillHandler` eingerichtet** — mit Save/Restore des vorherigen Handlers:
   ```typescript
   const previousHandler = getLoadSkillTool()?.getHandler() || null;
   // ... neuen Handler setzen ...
   // Am Ende:
   setLoadSkillHandler(previousHandler);
   ```
   Das Save/Restore ist nötig, weil der Handler ein Singleton ist. Ohne Restore würde der Handler des Haupt-Loops nach der Delegation überschrieben bleiben.

3. **System-Prompt wird pro Iteration aktualisiert:**
   ```typescript
   let currentSystemPrompt = baseSystemPrompt;
   if (loopState.loadedSkillInstructions.length > 0) {
     currentSystemPrompt += '\n\n' + loopState.loadedSkillInstructions.join('\n\n');
   }
   ```

4. **Tools werden pro Iteration aktualisiert:**
   ```typescript
   const tools = getToolsForAgent(agent, depth, loopState.temporaryTools);
   ```

5. **`load_skill`-Ergebnis wird verarbeitet** — nach `executeToolCall` wird das Ergebnis geparst:
   ```typescript
   if (toolName === 'load_skill') {
     const skillResult = JSON.parse(result);
     if (skillResult.success) {
       loopState.loadedSkills.push(skillResult.skill.id);
       loopState.loadedSkillInstructions.push(skillResult.instructions);
     }
   }
   ```

---

## Erwarteter Flow nach den Fixes

```
Benutzer: "Herr Müller hat ein Kind in der Krise..."
    │
    ▼
Supervisor: Analysiert → delegiert an vereinbarkeits-berater
    │
    ▼
Vereinbarkeits-Berater:
    1. load_skill("vereinbarkeits-planung") → Skill + KB-Wissen geladen
    2. Erstellt vollständigen Maßnahmenplan mit:
       - Analyse (individuell, Team, Organisation)
       - Maßnahmenplan (kurzfristig, mittelfristig, langfristig)
       - Argumentation
       - Kosten- und Aufwandsbetrachtung
       - Getroffene Annahmen (transparent dokumentiert)
    │
    ▼
Supervisor: Erhält vollständiges Ergebnis → gibt es an Benutzer weiter
```

**Kein** Auto-Export, **kein** Researcher-Aufruf, **keine** Rückfragen, **keine** Umleitung an den Writer.

---

## Geänderte Dateien

| Datei | Art | Beschreibung |
|-------|-----|-------------|
| `data/agents/vereinbarkeits-berater/config.md` | Prompt | Rückfragen entfernt, Annahmen-Logik eingebaut, Skill-Nutzung begrenzt |
| `data/agents/writer/config.md` | Prompt | Auto-Export verboten, Delegation verboten |
| `data/agents/supervisor/config.md` | Prompt | Rückfrage-Handling, Agenten-Zuständigkeit, Beispiel |
| `backend/src/skills/loader.ts` | Code | KB-Fallback für Skill-Knowledge-Auflösung |
| `backend/src/agents/loop.ts` | Code | Skill-Loading in delegierten Agenten |
