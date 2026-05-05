/**
 * Migrations-Skript: Arbeitsvertrag-Skill auf fill_template_to_docx umstellen.
 *
 * Hintergrund: Der Skill `arbeitsvertrag-erstellen` lief frueher mit
 * allowed_tools=["export_document"] und instruierte das LLM, das gesamte
 * Vertragsdokument selbst zu formulieren. Qwen 30B ignorierte die
 * Template-Inhalte und schrieb eigene Klauseln.
 *
 * Neuer Ansatz: allowed_tools=["fill_template_to_docx"] + Instructions
 * die nur Variablen sammeln. Der Tool-Renderer macht den Rest.
 *
 * Idempotent: erkennt am `allowed_tools` ob schon migriert.
 *
 * Usage:
 *   Lokal:   /Users/andreasbachmann/.bun/bin/bun run backend/scripts/migrate-arbeitsvertrag-skill.ts
 *   Scalingo: scalingo --app workplace-demo run "bun run backend/scripts/migrate-arbeitsvertrag-skill.ts"
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { customSkills } from '../src/db/schema/custom_skills';

const SKILL_ID = 'arbeitsvertrag-erstellen';

const NEW_INSTRUCTIONS = `Erstellt einen rechtssicheren deutschen Arbeitsvertrag als Word-Dokument auf Basis eines vorgegebenen Templates. Auslöser: alle Anfragen, bei denen ein Arbeitsvertrag erstellt, geändert oder erneuert werden soll — auch Formulierungen wie "neue Stelle besetzen", "jemanden einstellen", "Vertragsunterlagen vorbereiten", "Vertrag für [Name]". Immer diesen Skill verwenden, niemals selbst Vertragsklauseln formulieren.

# Skill: Arbeitsvertrag erstellen

## Wichtig

NIEMALS eigene Vertragsklauseln formulieren. NIEMALS \`export_document\` aufrufen. Du fuellst nur Variablen — der Rest passiert automatisch.

## Schritt 1 — Pflichtdaten erfassen

Erfrage fehlende Felder kompakt (max. eine Nachfrage gesammelt):

- **VORNAME** (Vorname Mitarbeitende:r)
- **NACHNAME**
- **GEBURTSDATUM** (TT.MM.JJJJ)
- **ADRESSE** (Straße, PLZ, Ort)
- **STELLENBEZEICHNUNG**
- **ABTEILUNG** (sofern bekannt; sonst weglassen)
- **VORGESETZTE_R** (sofern bekannt; sonst weglassen)
- **ARBEITSORT** (Default: Frankfurt am Main)
- **EINTRITTSDATUM** (TT.MM.JJJJ)
- **PROBEZEIT_MONATE** (Default: 6)
- **KUENDIGUNGSFRIST_PROBEZEIT** (Default: 2 Wochen)
- **WOCHENSTUNDEN** (Default: 40)
- **BRUTTOGEHALT** (Monatsbrutto in EUR)
- **JAHRESGEHALT** (= 12 × BRUTTOGEHALT, automatisch berechnen)
- **URLAUBSTAGE** (Default: 30)
- **URLAUBSANSPRUCH_ANTEILIG** (anteilig zum Eintrittsdatum, automatisch berechnen)
- **KUENDIGUNGSFRIST_NACH_PROBEZEIT** (Default: 4 Wochen zum Monatsende)
- **DATUM_HEUTE** (heutiges Datum, TT.MM.JJJJ)

## Schritt 2 — Template-Slug bestimmen

- Vollzeit unbefristet → \`template-unbefristet-vollzeit\`
- Minijob → (kommt spaeter; aktuell nur Vollzeit-Template verfuegbar)

## Schritt 3 — Tool-Aufruf

Genau ein Tool-Aufruf:

\`\`\`json
{
  "name": "fill_template_to_docx",
  "arguments": {
    "template_slug": "template-unbefristet-vollzeit",
    "variables": {
      "VORNAME": "...",
      "NACHNAME": "...",
      "GEBURTSDATUM": "...",
      "ADRESSE": "...",
      "STELLENBEZEICHNUNG": "...",
      "EINTRITTSDATUM": "...",
      "PROBEZEIT_MONATE": "6",
      "KUENDIGUNGSFRIST_PROBEZEIT": "2 Wochen",
      "WOCHENSTUNDEN": "40",
      "BRUTTOGEHALT": "6.000,00",
      "JAHRESGEHALT": "72.000,00",
      "URLAUBSTAGE": "30",
      "URLAUBSANSPRUCH_ANTEILIG": "...",
      "KUENDIGUNGSFRIST_NACH_PROBEZEIT": "4 Wochen zum Monatsende",
      "DATUM_HEUTE": "..."
    },
    "filename": "Arbeitsvertrag_<NACHNAME>_<VORNAME>.docx"
  }
}
\`\`\`

## Schritt 4 — Antwort

Nach erfolgreichem Tool-Call: kurze Bestätigung mit Download-Link aus dem Tool-Result. Vier-Augen-Prinzip-Hinweis hinzufuegen: "Bitte Vertrag vor Unterzeichnung durch Rechtsabteilung/HR-Leitung pruefen."`;

const NEW_ALLOWED_TOOLS = ['fill_template_to_docx'];

async function main() {
  const db = getDb();
  const rows = await db.select().from(customSkills).where(eq(customSkills.id, SKILL_ID));
  const row = rows[0];

  if (!row) {
    console.log(`[migrate-arbeitsvertrag-skill] Skill "${SKILL_ID}" existiert nicht — nichts zu tun.`);
    process.exit(0);
  }

  const oldConfig = row.config as Record<string, any>;
  const oldAllowedTools: string[] = Array.isArray(oldConfig.allowed_tools) ? oldConfig.allowed_tools : [];

  const alreadyMigrated =
    oldAllowedTools.length === 1 &&
    oldAllowedTools[0] === 'fill_template_to_docx' &&
    typeof oldConfig.instructions === 'string' &&
    oldConfig.instructions.startsWith('Erstellt einen rechtssicheren deutschen Arbeitsvertrag');

  if (alreadyMigrated) {
    console.log(`[migrate-arbeitsvertrag-skill] Schon migriert (allowed_tools=${JSON.stringify(oldAllowedTools)}). No-op.`);
    process.exit(0);
  }

  console.log(`[migrate-arbeitsvertrag-skill] Vorher:`);
  console.log(`  allowed_tools: ${JSON.stringify(oldAllowedTools)}`);
  console.log(`  instructions length: ${(oldConfig.instructions || '').length}`);

  const newConfig = {
    ...oldConfig,
    allowed_tools: NEW_ALLOWED_TOOLS,
    instructions: NEW_INSTRUCTIONS,
  };

  await db
    .update(customSkills)
    .set({ config: newConfig as never, updatedAt: new Date().toISOString() })
    .where(eq(customSkills.id, SKILL_ID));

  console.log(`[migrate-arbeitsvertrag-skill] Nachher:`);
  console.log(`  allowed_tools: ${JSON.stringify(NEW_ALLOWED_TOOLS)}`);
  console.log(`  instructions length: ${NEW_INSTRUCTIONS.length}`);
  console.log(`[migrate-arbeitsvertrag-skill] Erfolgreich migriert.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate-arbeitsvertrag-skill] Fatal:', err);
  process.exit(1);
});
