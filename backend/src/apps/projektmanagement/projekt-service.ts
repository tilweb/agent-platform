/**
 * Projekt-Service — Phase A der Entity-Restruktur.
 *
 * `paProjekte` ist die neue Top-Level-Entity. Heute existiert sie parallel zu
 * `paProjektauftraege` (1:1, gleiche IDs nach Migration). Spaetere Phasen
 * werden Felder wie Name/Owner/Lifecycle vom Auftrag aufs Projekt ziehen und
 * die Sub-Resources (Statusbericht, Lessons Learned, Abschluss) auf den
 * Projekt-FK umstellen.
 *
 * Diese Datei kapselt nur den Projekt-Layer. Auftrag/Statusbericht-Services
 * bleiben unangetastet (rueckwaerts-kompatibel).
 */

import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../../db';
import { paProjekte, paProjektauftraege } from '../../db/schema/projektmgmt';
import type {
  Projekt,
  ProjektCreateInput,
  ProjektUpdateInput,
  ProjektLifecycle,
} from './types';
import { PROJEKT_LIFECYCLE_VALUES } from './types';
import { VersionConflictError } from './concurrency';

// ============== ID + Helpers ==============

export function generateProjektId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `projekt-${timestamp}-${random}`;
}

function isLifecycle(value: unknown): value is ProjektLifecycle {
  return typeof value === 'string' && (PROJEKT_LIFECYCLE_VALUES as readonly string[]).includes(value);
}

function rowToProjekt(row: typeof paProjekte.$inferSelect): Projekt {
  return {
    id: row.id,
    name: row.name,
    lifecycle: (isLifecycle(row.lifecycle) ? row.lifecycle : 'planning'),
    portfolioId: row.portfolioId ?? undefined,
    ideeId: row.ideeId ?? undefined,
    ownerId: row.ownerId ?? undefined,
    metadata: (row.metadata ?? undefined) as Projekt['metadata'],
    permissions: (row.permissions ?? undefined) as Projekt['permissions'],
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ============== CRUD ==============

/**
 * Listet alle Projekte. Spaeter optional auf Permission-Filter erweitern.
 */
export async function listProjekte(): Promise<Projekt[]> {
  const db = getDb();
  const rows = await db.select().from(paProjekte).orderBy(desc(paProjekte.updatedAt));
  return rows.map(rowToProjekt);
}

export async function getProjekt(id: string): Promise<Projekt | null> {
  const db = getDb();
  const rows = await db.select().from(paProjekte).where(eq(paProjekte.id, id)).limit(1);
  return rows[0] ? rowToProjekt(rows[0]) : null;
}

/**
 * Listet Projekte einer Idee — Reverse-Lookup ueber ideeId.
 */
export async function listProjekteByIdee(ideeId: string): Promise<Projekt[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(paProjekte)
    .where(eq(paProjekte.ideeId, ideeId))
    .orderBy(desc(paProjekte.createdAt));
  return rows.map(rowToProjekt);
}

export async function createProjekt(input: ProjektCreateInput): Promise<Projekt> {
  const db = getDb();
  const id = input.id ?? generateProjektId();
  const lifecycle: ProjektLifecycle = input.lifecycle ?? 'planning';

  await db.insert(paProjekte).values({
    id,
    ownerId: input.ownerId ?? null,
    name: input.name,
    lifecycle,
    portfolioId: input.portfolioId ?? null,
    ideeId: input.ideeId ?? null,
    metadata: (input.metadata ?? null) as never,
    permissions: null,
    version: 1,
  });

  const projekt = await getProjekt(id);
  if (!projekt) {
    throw new Error(`createProjekt: row not found after insert (id=${id})`);
  }
  return projekt;
}

/**
 * Update mit optimistischer Concurrency. Wirft `VersionConflictError`, wenn
 * `expectedVersion` nicht uebereinstimmt (analog zu updateProjektauftrag).
 */
export async function updateProjekt(id: string, input: ProjektUpdateInput): Promise<Projekt> {
  const db = getDb();
  const current = await getProjekt(id);
  if (!current) {
    throw new Error(`Projekt ${id} nicht gefunden`);
  }

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new VersionConflictError(
      `Projekt ${id}: version conflict (expected ${input.expectedVersion}, got ${current.version})`,
    );
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.lifecycle !== undefined) {
    if (!isLifecycle(input.lifecycle)) {
      throw new Error(`Ungueltiger Lifecycle-Wert: ${input.lifecycle}`);
    }
    patch.lifecycle = input.lifecycle;
  }
  if (input.portfolioId !== undefined) {
    patch.portfolioId = input.portfolioId; // null erlaubt (entfernt Verknuepfung)
  }
  if (input.metadata !== undefined) patch.metadata = input.metadata as never;

  // Atomic compare-and-swap auf version
  const result = await db
    .update(paProjekte)
    .set(patch as never)
    .where(and(eq(paProjekte.id, id), eq(paProjekte.version, current.version)))
    .returning({ id: paProjekte.id });

  if (result.length === 0) {
    throw new VersionConflictError(
      `Projekt ${id}: concurrent update detected`,
    );
  }

  const updated = await getProjekt(id);
  if (!updated) {
    throw new Error(`Projekt ${id} verschwand nach Update`);
  }
  return updated;
}

/**
 * Loescht ein Projekt. **WICHTIG**: bisherige Sub-Resources (Auftrag,
 * Statusberichte) referenzieren nicht direkt auf paProjekte.id — die
 * FK-Beziehung laeuft heute ueber paProjektauftraege.id, die hier 1:1
 * mit der Projekt-ID identisch ist. Phase A-Migration laesst die FKs
 * stehen; spaetere Phasen ziehen die FKs auf paProjekte um.
 *
 * Phase A: Loeschen entfernt nur die Projekt-Zeile. Den zugehoerigen Auftrag
 * + Statusberichte muss man weiterhin via deleteProjektauftrag() entfernen.
 * Das ist bewusst — wir wollen erst sicher sein dass die Migration sauber
 * laeuft, bevor wir Cascade-Logik aendern.
 */
export async function deleteProjekt(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db.delete(paProjekte).where(eq(paProjekte.id, id)).returning({ id: paProjekte.id });
  return result.length > 0;
}

// ============== Lifecycle-Hinweise ==============

/**
 * Schlaegt Lifecycle-Uebergaenge auf Basis von Sub-Resource-Zustaenden vor.
 * UI fragt den User vor der Anwendung. Reine Vorschlags-Logik — keine
 * Mutation.
 *
 * Heuristiken:
 *   - Auftrag.status === 'active' und Projekt.lifecycle === 'planning'
 *     → Vorschlag: 'active'
 *   - Abschlussbericht existiert (Phase E) und lifecycle in {planning|active}
 *     → Vorschlag: 'closed'
 *
 * Phase A: rudimentaere Stub-Logik (Auftrag-Status-Read). Spaetere Phasen
 * ergaenzen Abschlussbericht-Check.
 */
export async function suggestLifecycleTransition(projektId: string): Promise<ProjektLifecycle | null> {
  const projekt = await getProjekt(projektId);
  if (!projekt) return null;

  // Hier wuerden wir den Auftrag-Status laden. Phase-A: noch nicht
  // implementiert, weil Auftrag-Loader noch nicht den Projekt-FK kennt.
  // Stub returnt null = "kein Vorschlag".
  return null;
}

// ============== Daten-Migration (Boot-Hook + CLI) ==============

function mapAuftragStatusToLifecycle(status: string | null | undefined): ProjektLifecycle {
  switch ((status || '').toLowerCase()) {
    case 'active': return 'active';
    case 'completed': return 'closed';
    case 'cancelled': return 'cancelled';
    default: return 'planning';
  }
}

/**
 * Idempotent: legt fuer jeden Auftrag, der noch kein Projekt mit derselben ID
 * hat, ein Projekt-Row an. Wird beim Boot aufgerufen (siehe index.ts) und
 * vom CLI-Script `scripts/migrate-projekte.ts`. Zweite Ausfuehrung ist No-op.
 *
 * Wird beim Boot **nach** `runMigrations()` aufgerufen — die DB-Tabelle muss
 * existieren. Ohne SCALINGO_POSTGRES (Dev ohne DB) gibt `getDb()` einen
 * Fehler — dann fangen wir den weiter oben in `index.ts` ab.
 */
export async function migrateAuftraegeToProjekteIfNeeded(): Promise<{
  created: number;
  skipped: number;
  errors: number;
}> {
  const db = getDb();
  const auftraege = await db.select().from(paProjektauftraege);
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const auftrag of auftraege) {
    try {
      const existing = await db
        .select({ id: paProjekte.id })
        .from(paProjekte)
        .where(eq(paProjekte.id, auftrag.id))
        .limit(1);
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }
      await db.insert(paProjekte).values({
        id: auftrag.id,
        ownerId: auftrag.ownerId,
        name: auftrag.name,
        lifecycle: mapAuftragStatusToLifecycle(auftrag.status),
        portfolioId: null,
        ideeId: auftrag.ideeId,
        metadata: null,
        permissions: auftrag.permissions as never,
        version: 1,
        createdAt: auftrag.createdAt,
        updatedAt: auftrag.updatedAt,
      });
      created += 1;
    } catch (err) {
      errors += 1;
      console.error(`[migrate-projekte] Fehler bei id=${auftrag.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { created, skipped, errors };
}
