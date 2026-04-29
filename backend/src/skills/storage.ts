/**
 * Custom Skills Storage — Postgres-backed (Drizzle).
 *
 * System-Skills bleiben Code-Asset im Image (read-only); nur Custom-Skills
 * leben in der DB. Schema: `custom_skills.skills` mit jsonb-`config` (komplette
 * Skill-Definition ausser id/name/enabled — die wandern als first-class Spalten).
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { customSkills } from '../db/schema/custom_skills';
import type { EnhancedSkill } from './types';

function rowToSkill(row: typeof customSkills.$inferSelect): EnhancedSkill {
  const cfg = (row.config ?? {}) as Partial<EnhancedSkill>;
  return {
    ...cfg,
    id: row.id,
    name: row.name,
    description: row.description ?? cfg.description ?? '',
    enabled: row.enabled,
    instructions: cfg.instructions ?? row.body ?? '',
    triggers: cfg.triggers ?? { keywords: [] },
    tools: cfg.tools ?? { required: [], optional: [] },
    version: cfg.version ?? '1.0',
    system: false,
  } as EnhancedSkill;
}

export async function listCustomSkills(): Promise<EnhancedSkill[]> {
  const db = getDb();
  const rows = await db.select().from(customSkills);
  return rows.map(rowToSkill);
}

export async function getCustomSkill(id: string): Promise<EnhancedSkill | null> {
  const db = getDb();
  const rows = await db.select().from(customSkills).where(eq(customSkills.id, id)).limit(1);
  return rows[0] ? rowToSkill(rows[0]) : null;
}

export async function upsertCustomSkill(skill: EnhancedSkill): Promise<EnhancedSkill> {
  const db = getDb();
  const now = new Date().toISOString();
  // `config` enthaelt die vollstaendige Skill-Definition (ohne id/name/enabled,
  // die als eigene Spalten gespeichert werden) plus `system: false`.
  const config = {
    version: skill.version ?? '1.0',
    description: skill.description ?? '',
    metadata: skill.metadata,
    allowed_tools: skill.allowed_tools,
    knowledge: skill.knowledge,
    triggers: skill.triggers,
    tools: skill.tools,
    instructions: skill.instructions ?? '',
    workflow: skill.workflow,
    output: skill.output,
    parameters: skill.parameters,
    constraints: skill.constraints,
  };
  await db.insert(customSkills).values({
    id: skill.id,
    name: skill.name,
    description: skill.description ?? null,
    enabled: skill.enabled !== false,
    config: config as never,
    body: skill.instructions ?? null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: customSkills.id,
    set: {
      name: skill.name,
      description: skill.description ?? null,
      enabled: skill.enabled !== false,
      config: config as never,
      body: skill.instructions ?? null,
      updatedAt: now,
    },
  });
  return { ...skill, system: false };
}

export async function deleteCustomSkill(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(customSkills).where(eq(customSkills.id, id)).returning({ id: customSkills.id });
  return res.length > 0;
}
