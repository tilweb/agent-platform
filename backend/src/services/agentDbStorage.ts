/**
 * DB-Storage fuer Custom-Agents.
 *
 * System-Agenten (supervisor, general, kb-indexer, ...) bleiben weiter
 * File-basiert unter `data/agents/`, weil code-versioniert und
 * deployment-identisch. Alles was zur Runtime in der UI angelegt wird
 * oder kunden-/instanz-spezifisch ist, lebt hier in `agents.custom`.
 *
 * Format: configMd ist das vollstaendige Agent-File mit Frontmatter +
 * System-Prompt — gleiche Form wie die File-Variante. Damit kann der
 * Loader unveraenderten Frontmatter-Parser nutzen.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { customAgents } from '../db/schema/agents';

export interface CustomAgentRecord {
  id: string;
  name: string;
  description: string | null;
  configMd: string;
  frontmatter: Record<string, any>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getCustomAgentRecord(id: string): Promise<CustomAgentRecord | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(customAgents)
    .where(eq(customAgents.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    configMd: row.configMd,
    frontmatter: row.frontmatter as Record<string, any>,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCustomAgentRecords(): Promise<CustomAgentRecord[]> {
  const db = getDb();
  const rows = await db.select().from(customAgents);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    configMd: row.configMd,
    frontmatter: row.frontmatter as Record<string, any>,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Upsert: Insert wenn ID neu, Update wenn ID bereits existiert.
 */
export async function saveCustomAgentRecord(input: {
  id: string;
  name: string;
  description?: string | null;
  configMd: string;
  frontmatter: Record<string, any>;
  createdBy?: string | null;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .insert(customAgents)
    .values({
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      configMd: input.configMd,
      frontmatter: input.frontmatter,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: customAgents.id,
      set: {
        name: input.name,
        description: input.description ?? null,
        configMd: input.configMd,
        frontmatter: input.frontmatter,
        updatedAt: now,
      },
    });
}

export async function deleteCustomAgentRecord(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(customAgents)
    .where(eq(customAgents.id, id))
    .returning({ id: customAgents.id });
  return result.length > 0;
}
