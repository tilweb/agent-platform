# Konzept: Deep Research Agent — Grundlegender Redesign

**Datum:** 2026-03-05
**Status:** Implementiert

## Kontext & Problem

Der Researcher Agent lieferte halluzinierte, oberflächliche Ergebnisse:
- Nutzte `web_fetch` nicht (Qwen3 ignorierte es)
- Nur 4-5 `web_search` → Snippets, keine echten Quellen gelesen
- Kein strukturierter Recherche-Workflow, kein Qualitätscheck

**Industrie-Benchmark:**
| | Gemini | Perplexity | OpenAI | Wir (vorher) | Wir (nachher) |
|---|---|---|---|---|---|
| Suchen | ~160 | 20-50 | konfigurierbar | 4-5 | 5-21 |
| Seiten lesen | 100+ | 100-300 | variabel | 0 | 8-21 |
| Iterationen | unbegrenzt | ~50 | konfigurierbar | 10 | 50 |

## Architektur-Entscheidung

**Gewähltes Pattern: Phasen-basierter ReAct mit Scratchpad**

Gleiche Loop-Architektur, aber:
1. Mehr Iterationen (agent-spezifisch konfigurierbar via `maxIterations`)
2. Expliziter 4-Phasen-Workflow im Prompt
3. Scratchpad-Datei als Working Memory (via `file_write` mit `append: true`)
4. Reflexions-Schritt vor Synthese (inspiriert von Reflexion-Pattern)

---

## Umsetzung

### Teil A: Per-Agent `maxIterations` im Code

**Datei: `backend/src/services/agents.ts`**

**A1: Interfaces erweitern**

`AgentConfig` und `AgentFrontmatter` — neues Feld:
```typescript
maxIterations?: number;
```

**A2: Numerische Werte im Frontmatter-Parser**

`parseFrontmatter` — Numeric-Check VOR dem String-Fallback:
```typescript
} else if (/^\d+$/.test(value)) {
  frontmatter[key] = parseInt(value, 10);
} else {
  frontmatter[key] = value;
```

**A3/A4: `loadAgent` und `loadAllAgents` mappen**

```typescript
maxIterations: typeof fm.maxIterations === 'number' ? fm.maxIterations : undefined,
```

**A5: `generateAgentMarkdown` serialisieren**

```typescript
if (agent.maxIterations) {
  lines.push(`maxIterations: ${agent.maxIterations}`);
}
```

---

**Datei: `backend/src/agents/loop.ts`**

**A6: Agent-spezifisches Limit in `runDelegatedAgent`**

```typescript
const maxIterations = agent.maxIterations || MAX_DELEGATED_ITERATIONS;
```

While-Bedingung und Console.log nutzen `maxIterations` statt `MAX_DELEGATED_ITERATIONS`.

**A7: Early-Exit-Schutz fuer High-Budget-Agents**

Problem: Qwen3 gab in Iteration 1 den Plan als reinen Text aus (ohne Tool-Calls) → Loop brach sofort ab (`toolCalls.length === 0 → break`).

Lösung: Wenn ein Agent mit hohem `maxIterations`-Budget (> DEFAULT) in Iteration 1 keine Tool-Calls macht, wird er nicht abgebrochen, sondern bekommt eine User-Message die ihn auffordert, Tools zu benutzen:

```typescript
if (iteration === 1 && maxIterations > MAX_DELEGATED_ITERATIONS) {
  // Force continuation — inject nudge message
  addMessage(delegationSessionId, {
    role: 'user',
    content: 'Du hast bisher keine Tools aufgerufen. Beginne JETZT mit der Recherche...'
  });
  continue;
}
```

---

### Teil B: `file_write` Append-Modus

**Datei: `backend/src/tools/local/file-write.ts`**

Problem: `file_write` überschrieb immer die gesamte Datei. Der Researcher hätte für jedes Scratchpad-Update erst `file_read` → Content ergänzen → `file_write` machen müssen (2 Tool-Calls pro Update, zu komplex für Qwen3).

Lösung: Neuer `append: boolean` Parameter:

```typescript
parameters: {
  properties: {
    path: { type: 'string', ... },
    content: { type: 'string', ... },
    append: {
      type: 'boolean',
      description: 'If true, append content to the end of the file instead of overwriting. Default: false',
    },
  },
}
```

Execute-Logik:
```typescript
if (append && existsSync(fullPath)) {
  const existing = await readFile(fullPath, 'utf-8');
  await writeFile(fullPath, existing + '\n' + content, 'utf-8');
  return `Datei ergänzt: ${path}`;
}
```

---

### Teil C: Researcher Prompt — Kompletter Rewrite

**Datei: `data/agents/researcher/config.md`**

**Frontmatter:** `maxIterations: 50`

**Prompt-Design-Prinzipien (für Qwen3 30B):**
- **Explizite Mandates**: "DU MUSST", "NIEMALS", nicht "du kannst"
- **Nummerierte Schritte**: Jede Phase hat klare Ein-/Austritts-Kriterien
- **Tool-Erklärung**: web_search = NUR Snippets, web_fetch = VOLLE Seite
- **Budget-Konzept**: Minimum Tool-Calls als harte Vorgabe
- **Status-Updates**: Regelmäßige Zwischenstände für den User

**Kritische Regeln (im Prompt ganz oben):**

1. **Wichtigste Regel**: In JEDER Antwort mindestens einen Tool-Call machen (außer Phase 4 Synthese)
2. `web_fetch` MUSS benutzt werden (Snippets sind nicht ausreichend)
3. Mindestens 5× `web_search` UND 5× `web_fetch` (Minimum)
4. Scratchpad MUSS benutzt werden (`file_write` mit `append: true`)
5. NIEMALS Informationen erfinden
6. NIEMALS nach nur 2-3 Suchen aufhören (50 Iterationen verfügbar)
7. ERSTER Tool-Call MUSS `file_write` sein (Plan ins Scratchpad)

**4-Phasen-Workflow:**

#### Phase 1: Query-Dekomposition & Planung
- Anfrage analysieren, Ziel definieren
- 3-7 Kernfragen (Sub-Questions) formulieren
- Pro Kernfrage 2-3 konkrete Suchbegriffe planen
- Plan per `file_write` ins Scratchpad schreiben

#### Phase 2: Iterative Recherche (Search → Read → Extract → Write)
- Pro Kernfrage:
  1. `web_search` mit geplantem Suchbegriff
  2. `web_fetch` für die 2-3 besten URLs → volle Seiten lesen
  3. Erkenntnisse extrahieren
  4. **SOFORT** per `file_write(append: true)` ins Scratchpad schreiben
  5. Bewerten: Kernfrage beantwortet? Sonst Follow-up
- Konkretes Scratchpad-Format vorgegeben:
  ```
  file_write(path: "results/research-scratchpad.md",
    content: "### Kernfrage X: [Titel]\n- Erkenntnis 1 [Quelle: URL]\n...",
    append: true)
  ```

#### Phase 3: Reflexion & Lückenanalyse
- Scratchpad lesen (`file_read`)
- Prüfen: Alle Kernfragen beantwortet? Widersprüche? Fehlende Perspektiven?
- Bei Lücken: gezielte Nachrecherche, Erkenntnisse per `append: true` ergänzen
- Bei Widersprüchen: Drittquelle zur Klärung suchen

#### Phase 4: Synthese
- Scratchpad ein letztes Mal lesen (`file_read`)
- Strukturierter Bericht mit nummerierten Quellenverweisen `[1]`, `[2]` etc.
- Offene Fragen/Wissenslücken transparent benennen

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `backend/src/services/agents.ts` | `maxIterations` in Interfaces, Parser, Load, Serialize (5 Stellen) |
| `backend/src/agents/loop.ts` | Agent-spezifisches Iterationslimit, Early-Exit-Schutz (2 Stellen) |
| `backend/src/tools/local/file-write.ts` | `append: true` Parameter |
| `data/agents/researcher/config.md` | `maxIterations: 50` + kompletter Prompt-Rewrite |
| `CHANGELOG.md` | Neuer Eintrag |

## Messergebnisse

Drei Testläufe nach schrittweiser Implementierung:

| | Lauf 1 (vor Fixes) | Lauf 2 (nach Code-Fixes) | Lauf 3 (nach Scratchpad-Fix) |
|---|---|---|---|
| Iterationen genutzt | 1 von 10 | 30 von 30 | 30 von 30 |
| `web_search` | 0 | 21 | 5 |
| `web_fetch` | 0 | 8 | 21 |
| `file_write` | 0 | 1 (nur Plan) | 4 (Plan + 3 Kernfragen) |
| Scratchpad-Einträge | - | nur Plan | 3 Kernfragen mit je 5 Quellen |
| Quellen im Scratchpad | 0 | 0 | 15 |

**Kernverbesserungen:**
- `web_fetch`/`web_search`-Verhältnis drehte sich um (0:0 → 8:21 → 21:5)
- Agent liest jetzt mehr Seiten als er sucht
- Scratchpad wird laufend mit strukturierten Erkenntnissen gefüllt
- Quellenverweise mit URLs dokumentiert

## Offene Punkte / Nächste Schritte

- **Iteration-Budget**: 50 Iterationen erlauben ~5-6 Kernfragen vollständig; bei mehr Kernfragen ggf. weiter erhöhen
- Multi-Agent-Parallelisierung (wäre nächster Schritt)
- Tree-Search / Backtracking
- Separates Planner-Modell
- Dynamische Tool-Selektion
- Keine neuen Dependencies
