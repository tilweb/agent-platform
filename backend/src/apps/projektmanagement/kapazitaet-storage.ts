/**
 * Kapazitaet-Storage — main (Drizzle-Variante).
 *
 * Zentrale, projektuebergreifende Personen-Stammdaten fuer die Kapazitaetsplanung
 * (paPersonen). CRUD analog zu `portfolio-service.ts`: die Kapazitaets-Felder
 * (role, wochenarbeitszeit_pct, linie_avg_pt, linie_monate) leben im
 * metadata-JSONB und werden beim Lesen in typisierte Top-Level-Felder angehoben
 * (META_KEYS). Die exportierte API ist signaturgleich zur railway-YAML-Variante.
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { paPersonen } from '../../db/schema/projektmgmt';
import type {
  Kapazitaetsperson,
  KapazitaetspersonCreateInput,
  KapazitaetspersonUpdateInput,
} from './types';
import { VersionConflictError } from './concurrency';
import { defaultOwnerPermissions } from './permissions';

export function generatePersonId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `person-${timestamp}-${random}`;
}

const META_KEYS = ['role', 'wochenarbeitszeit_pct', 'linie_avg_pt', 'linie_monate'] as const;

function rowToPerson(row: typeof paPersonen.$inferSelect): Kapazitaetsperson {
  const meta = (row.metadata ?? {}) as Record<string, any>;
  return {
    id: row.id,
    name: row.name,
    role: meta.role ?? undefined,
    wochenarbeitszeit_pct: typeof meta.wochenarbeitszeit_pct === 'number' ? meta.wochenarbeitszeit_pct : 100,
    linie_avg_pt: typeof meta.linie_avg_pt === 'number' ? meta.linie_avg_pt : 0,
    linie_monate: (meta.linie_monate ?? {}) as Record<string, number>,
    ownerId: row.ownerId ?? undefined,
    metadata: meta as Kapazitaetsperson['metadata'],
    permissions: (row.permissions ?? undefined) as Kapazitaetsperson['permissions'],
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Mergt die metadata-gestuetzten Felder eines Inputs in ein metadata-Objekt (nur definierte). */
function mergeMetaFields(base: Record<string, any>, input: Record<string, any>): Record<string, any> {
  const meta = { ...base };
  for (const k of META_KEYS) {
    if (input[k] !== undefined) meta[k] = input[k];
  }
  return meta;
}

export async function listPersonen(): Promise<Kapazitaetsperson[]> {
  const db = getDb();
  const rows = await db.select().from(paPersonen).orderBy(desc(paPersonen.updatedAt));
  return rows.map(rowToPerson);
}

export async function getPerson(id: string): Promise<Kapazitaetsperson | null> {
  const db = getDb();
  const rows = await db.select().from(paPersonen).where(eq(paPersonen.id, id)).limit(1);
  return rows[0] ? rowToPerson(rows[0]) : null;
}

export async function createPerson(input: KapazitaetspersonCreateInput): Promise<Kapazitaetsperson> {
  const db = getDb();
  const id = input.id ?? generatePersonId();
  const permissions = input.ownerId ? defaultOwnerPermissions(input.ownerId) : null;
  const metadata = mergeMetaFields({}, {
    role: input.role,
    wochenarbeitszeit_pct: input.wochenarbeitszeit_pct ?? 100,
    linie_avg_pt: input.linie_avg_pt ?? 0,
    linie_monate: input.linie_monate ?? {},
  });

  await db.insert(paPersonen).values({
    id,
    ownerId: input.ownerId ?? null,
    name: input.name,
    metadata: metadata as never,
    permissions: permissions as never,
    version: 1,
  });

  const person = await getPerson(id);
  if (!person) throw new Error(`createPerson: row not found after insert (id=${id})`);
  return person;
}

export async function updatePerson(id: string, input: KapazitaetspersonUpdateInput): Promise<Kapazitaetsperson> {
  const db = getDb();
  const current = await getPerson(id);
  if (!current) throw new Error(`Person ${id} nicht gefunden`);

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new VersionConflictError(current);
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  };
  if (input.name !== undefined) patch.name = input.name;
  const touchesMeta = META_KEYS.some((k) => (input as Record<string, any>)[k] !== undefined);
  if (touchesMeta) {
    patch.metadata = mergeMetaFields((current.metadata ?? {}) as Record<string, any>, input) as never;
  }

  const result = await db
    .update(paPersonen)
    .set(patch as never)
    .where(and(eq(paPersonen.id, id), eq(paPersonen.version, current.version)))
    .returning({ id: paPersonen.id });

  if (result.length === 0) {
    const latest = await getPerson(id);
    throw new VersionConflictError(latest ?? current);
  }

  const updated = await getPerson(id);
  if (!updated) throw new Error(`Person ${id} verschwand nach Update`);
  return updated;
}

export async function deletePerson(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(paPersonen).where(eq(paPersonen.id, id)).returning({ id: paPersonen.id });
  return result.length > 0;
}
