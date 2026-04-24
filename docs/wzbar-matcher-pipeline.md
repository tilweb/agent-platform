# WZ-Branchen-Matcher — Funktionsweise der Such-/Matching-Pipeline

Dieses Dokument erklärt im Detail, wie die `wzbar-matcher`-App eine freie Tätigkeitsbeschreibung auf einen 4-stelligen WZ-2008-Schlüssel abbildet.

## Das Grundproblem

Der WZ-2008-Katalog hat 3.021 Einträge (1- bis 4-stellig hierarchisch). Wir nutzen davon **662 gültige 4-stellige Klassen**. Ein freier Tätigkeitstext soll auf 1 primären + bis zu 3 alternative Codes abgebildet werden.

**Warum nicht "alle 662 Codes in einem LLM-Prompt reinkippen und fragen lassen?"**

- 662 × ~80 Zeichen = ~55k Tokens pro Request — teuer, langsam (>10 s), Qualität bricht ein (Needle-in-Haystack-Effekt).
- Reine Keyword-Suche wiederum scheitert bei Umgangssprache ("Autos schicke machen" → keine Keywords aus dem WZ-Lexikon).

Lösung: **zweistufiger Hybrid** — erst semantisch filtern (Embeddings), dann sprachlich entscheiden (LLM).

---

## Einmaliger Offline-Build

`catalog-builder.ts` macht zwei Dinge:

### 1a. Katalog bauen

- `docs/WZBAR-Schluesseltabelle.xlsx` einlesen mit `exceljs`
- Nur Zeilen behalten, bei denen `Schlüssel` exakt 4-stellig ist (`/^\d{4}$/`)
- Zeilen rauswerfen, bei denen `Gültig bis` in der Vergangenheit liegt
- Output: `backend/src/apps/wzbar-matcher/assets/catalog.json` — 662 Objekte `{code, kurztext, langtext, validFrom, validTo}`

### 1b. Embeddings berechnen

Für jeden Katalogeintrag wird der Text `"${kurztext}. ${langtext}"` durch das Embedding-Modell geschickt — über den neu angelegten Provider:

- `multilingual-e5-large` via Adacor (`POST https://api.adacor.ai/embeddings/privateai/v1/embeddings`)
- Ergebnis: ein Vektor aus **1024 Fließkommazahlen**, der semantisch "wo liegt dieser Text im Bedeutungsraum" codiert
- 662 Einträge × 1024 dim = ~14 MB `embeddings.json`

Anschaulich gesagt: Jeder der 662 Codes bekommt einen "semantischen Fingerabdruck". Zwei Codes, die etwas Ähnliches beschreiben, haben ähnliche Fingerabdrücke — auch wenn die Wörter ganz anders sind.

---

## Pro Match-Anfrage

### Stufe 2: Embedding-Retrieval (~100–200 ms)

Der User tippt z.B. `"Autos bekleben und schicke machen"` und klickt "Schlüssel ermitteln":

**Schritt 2a — Query embedden:**
Der Text wird an Adacor Embedding Modell (`multilingual-e5-large`) geschickt, bekommt einen 1024-dim Vektor zurück. Jetzt haben wir den semantischen Fingerabdruck der Anfrage.

**Schritt 2b — Cosine-Similarity:**
Für jeden der 662 Katalog-Vektoren berechnen wir die Cosinus-Ähnlichkeit zum Query-Vektor. Formel (in `retrieval.ts`):

```
cos(a, b) = (a·b) / (|a| × |b|)
```

Ergebnis ist eine Zahl zwischen -1 und 1; 1 bedeutet "semantisch identisch", 0 "unverbunden". 662 Multiplikationen mit 1024-dim Vektoren dauern im Hauptspeicher <50 ms.

**Schritt 2c — Top-K:**
Wir sortieren absteigend und nehmen die **Top 20** Kandidaten. Damit reduzieren wir den Suchraum von 662 auf 20.

Diese 20 Codes enthalten fast immer den richtigen — aber das Embedding kann schlecht zwischen "Putzen" (8121/8122/8123) und "Haushaltsdienste" (9691) unterscheiden, weil semantisch verwandt. Dafür brauchen wir Stufe 3.

---

### Stufe 3: LLM-Re-Ranking (~2–3 s)

Stärke: Das LLM versteht Nuancen — "im Haushalt" bei Reinigung → 9691, "Gebäude" → 8121. Schwäche: Halluzination, freies Format. Wir erzwingen Struktur via **Forced Function Calling**.

**Schritt 3a — Prompt zusammenbauen**:

System-Prompt: "Du bist Experte für WZ 2008. Wähle den passendsten 4-stelligen Code aus der Kandidatenliste. Keine Codes erfinden. Konfidenz 0..1. Begründung auf Deutsch, 1–2 Sätze."

User-Prompt: Tätigkeitstext + Liste der 20 Kandidaten in der Form `- 9691: Erbringung von haushaltsbezogenen Dienstleistungen`.

**Schritt 3b — Tool-Schema:**
Wir definieren ein JSON-Schema (`CLASSIFY_SCHEMA`), das exakt die Form `{primary: {code, confidence, reasoning}, alternatives: [...]}` beschreibt. Das schicken wir als `tools`-Array mit und zwingen das LLM per `toolChoice: { type: 'function', function: { name: 'classify_wz_branche' } }`, dieses eine Tool aufzurufen.

**Schritt 3c — LLM-Call:**
`llmService.chat(messages, [CLASSIFY_SCHEMA], ..., { toolChoice: ... })` geht an Adacor's Qwen3 30B (OpenAI-kompatibles Interface). Das Model antwortet nicht mit Fließtext, sondern mit `tool_calls[0].function.arguments` — einem garantiert JSON-konformen String gemäß unserem Schema. Wir parsen ihn mit `JSON.parse`.

Vorteil gegenüber "Bitte antworte in JSON": Das Model KANN nicht prosa-drumherum schreiben oder Felder vergessen — das API-Level erzwingt die Struktur.

---

### Stufe 4: Post-Processing & Halluzination-Schutz

`sanitizeResult()` in `service.ts` härtet das LLM-Output nach:

- **Whitelist-Check**: Jeder zurückgegebene `code` muss im Kandidaten-Set (Top-20) enthalten sein. Falls das LLM einen Code erfindet oder einen 3-stelligen Code zurückgibt → wird verworfen, Primary fällt auf Top-1-Retrieval zurück.
- **Clamp**: `confidence` wird auf [0, 1] beschränkt.
- **Dedupe**: Alternativen können den Primary-Code nicht wiederholen.
- **Sort**: Alternativen nach Konfidenz absteigend sortiert.
- **Anreicherung**: `kurztext` und `langtext` werden aus unserem Katalog ergänzt (nicht was das LLM geschrieben hat), damit die UI immer konsistente Texte zeigt.

---

### Stufe 5: Audit-Log

Alles wird als `MatchRecord` in `backend/data/apps/wzbar-matcher/matches/<id>.yaml` gespeichert:

- Input-Text, Timestamp, userId
- Vollständiges Ergebnis (primary + alternatives)
- **`retrievalTopK`** mit Similarity-Werten aller 20 Kandidaten — wichtig für spätere Evaluation ("war der richtige Code überhaupt in Top-20?")
- Verwendetes Embedding- und LLM-Modell, Gesamtdauer

Der Ordner liegt im Mount-Volume via Symlink → überlebt Deploys, wird nie vom Seed überschrieben.

---

## Konkretes Beispiel

Eingabe: `"Autos bekleben und schicke machen"`

1. **Embedding** des Textes → 1024-dim Vektor
2. **Top-3 Retrieval-Ergebnisse**: `4331 Stuckaturen (0.866)`, `1511 Leder (0.865)`, `2561 Oberflächenveredelung (0.862)` — alle relativ niedrig, Embedding ist unsicher weil umgangssprachlich.
3. Top-20 enthält aber auch `9531 Reparatur und Instandhaltung von Kraftwagen`, `2932 Kfz-Teile`, `2551 Beschichten von Metallen`.
4. **LLM bekommt alle 20** mit Kurztexten und wählt — basierend auf dem Sprach-Verständnis "Autos schicke machen" = Aufwertung von Fahrzeugen:
   - Primary: `9531 Reparatur und Instandhaltung von Kraftwagen (85%)`
   - Alt 1: `2932 Kfz-Teile (35%)`
   - Alt 2: `2551 Beschichten von Metallen (25%)`
5. Post-Processing: alle drei Codes sind in der Kandidatenliste → durchgewunken. `9531` wird Primary.
6. Audit-YAML geschrieben, Response an Frontend.

**Gesamtdauer**: ~2.6 s. Davon ~150 ms Embedding, ~50 ms Similarity, Rest LLM-Call.

---

## Warum diese Aufteilung?

| | Nur Keywords | Nur LLM (alle 662) | Hybrid (wir) |
|---|---|---|---|
| Umgangssprache | scheitert | gut | gut |
| Kosten pro Anfrage | ~0 | hoch | niedrig (1 kleiner embed + 1 LLM-Call mit ~20 Kandidaten) |
| Latenz | <50 ms | >10 s | ~2–3 s |
| Halluzinationsrisiko | keins | hoch | kontrolliert (Whitelist) |
| Erklärbarkeit (reasoning) | keine | ja | ja |

Das Embedding filtert grob auf "semantisch plausibel", das LLM entscheidet fein. Genau das, wofür die beiden Technologien jeweils stark sind.

---

## Was beim Re-Tuning passieren wird (mit Echtdaten)

Wenn Precision@1 < 80 %:

- **K erhöhen** (20 → 30/50 Kandidaten) — mehr Chancen fürs LLM, kostet minimal mehr Tokens.
- **Prompt-Tuning** — den System-Prompt mit konkreten Beispielen anreichern (Few-Shot).
- **Hybrid-Retrieval** — Similarity × BM25-Keyword-Score kombinieren, falls Umgangssprache ein systematisches Problem ist.
- **Query-Expansion** — das LLM vor dem Embedding bitten, den Text in "formalere" Variante umzuformulieren, dann embedden.

Wenn der richtige Code häufig gar nicht in Top-K landet (also schon Stufe 2 daneben), bringt LLM-Tuning nichts und wir müssen am Embedding-Schritt ansetzen.
