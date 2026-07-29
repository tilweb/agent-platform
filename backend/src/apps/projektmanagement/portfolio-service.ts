/**
 * Portfolio-Service — Phase D.
 *
 * Gruppierung von Projekten fuer PMO-Sicht. Implementiert CRUD analog zu
 * `projekt-service.ts`. Loeschen eines Portfolios setzt portfolio_id der
 * zugeordneten Projekte auf NULL (kein DB-Cascade — application-level).
 */

import { eq, desc, and, isNull } from 'drizzle-orm';
import { getDb } from '../../db';
import { paPortfolios, paProjekte } from '../../db/schema/projektmgmt';
import type {
  Portfolio,
  PortfolioCreateInput,
  PortfolioUpdateInput,
  PortfolioStatus,
} from './types';
import { PORTFOLIO_STATUS_VALUES } from './types';
import { VersionConflictError } from './concurrency';
import { defaultOwnerPermissions } from './permissions';

// ============== ID + Helpers ==============

export function generatePortfolioId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `portfolio-${timestamp}-${random}`;
}

function isStatus(value: unknown): value is PortfolioStatus {
  return typeof value === 'string' && (PORTFOLIO_STATUS_VALUES as readonly string[]).includes(value);
}

// Stammdaten + Personen leben im metadata-JSONB (keine DB-Migration). Anheben in
// die typisierten Top-Level-Felder beim Lesen.
const META_KEYS = ['type', 'driver', 'start_date', 'end_date', 'organization', 'stakeholders', 'goals', 'criteria', 'dependencies'] as const;

function rowToPortfolio(row: typeof paPortfolios.$inferSelect): Portfolio {
  const meta = (row.metadata ?? {}) as Record<string, any>;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    strategy: row.strategy ?? undefined,
    status: isStatus(row.status) ? row.status : 'active',
    type: meta.type ?? undefined,
    driver: meta.driver ?? undefined,
    start_date: meta.start_date ?? undefined,
    end_date: meta.end_date ?? undefined,
    organization: meta.organization ?? undefined,
    stakeholders: meta.stakeholders ?? undefined,
    goals: meta.goals ?? undefined,
    criteria: meta.criteria ?? undefined,
    dependencies: meta.dependencies ?? undefined,
    ownerId: row.ownerId ?? undefined,
    metadata: meta as Portfolio['metadata'],
    permissions: (row.permissions ?? undefined) as Portfolio['permissions'],
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Mergt die metadata-gestuetzten Felder eines Inputs in ein metadata-Objekt (nur definierte). */
function mergeMetaFields(
  base: Record<string, any>,
  input: Record<string, any>,
): Record<string, any> {
  const meta = { ...base, ...(input.metadata ?? {}) };
  for (const k of META_KEYS) {
    if (input[k] !== undefined) meta[k] = input[k];
  }
  return meta;
}

// ============== CRUD ==============

/**
 * Optionen fuer `listPortfolios` — status-Filter ist optional, Pagination ist
 * opt-in (analog Projektauftraege-Pattern in storage.ts).
 */
export interface ListPortfoliosOptions {
  status?: PortfolioStatus;
  limit?: number;
  offset?: number;
}

const MAX_PORTFOLIO_LIMIT = 1000;

export async function listPortfolios(options: ListPortfoliosOptions = {}): Promise<Portfolio[]> {
  const db = getDb();
  const base = db.select().from(paPortfolios);
  const filtered = options.status
    ? base.where(eq(paPortfolios.status, options.status))
    : base;
  let q = filtered.orderBy(desc(paPortfolios.updatedAt));
  if (options.limit !== undefined) {
    const lim = Math.min(Math.max(1, options.limit), MAX_PORTFOLIO_LIMIT);
    q = q.limit(lim) as typeof q;
  }
  if (options.offset !== undefined) {
    q = q.offset(Math.max(0, options.offset)) as typeof q;
  }
  const rows = await q;
  return rows.map(rowToPortfolio);
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  const db = getDb();
  const rows = await db.select().from(paPortfolios).where(eq(paPortfolios.id, id)).limit(1);
  return rows[0] ? rowToPortfolio(rows[0]) : null;
}

export async function createPortfolio(input: PortfolioCreateInput): Promise<Portfolio> {
  const db = getDb();
  const id = input.id ?? generatePortfolioId();
  const status: PortfolioStatus = input.status && isStatus(input.status) ? input.status : 'active';

  // Default-Permissions: Ersteller (ownerId) ist explizit Owner. Wenn kein
  // ownerId angegeben ist (z.B. interner Aufruf), bleibt permissions null und
  // der Resolver schlaegt auf `created_by`-Fallback zurueck.
  const permissions = input.ownerId ? defaultOwnerPermissions(input.ownerId) : null;
  const metadata = mergeMetaFields({}, input);

  await db.insert(paPortfolios).values({
    id,
    ownerId: input.ownerId ?? null,
    name: input.name,
    description: input.description ?? null,
    strategy: input.strategy ?? null,
    status,
    metadata: (Object.keys(metadata).length ? metadata : null) as never,
    permissions: permissions as never,
    version: 1,
  });

  const portfolio = await getPortfolio(id);
  if (!portfolio) {
    throw new Error(`createPortfolio: row not found after insert (id=${id})`);
  }
  return portfolio;
}

/**
 * Update mit optimistischer Concurrency. Wirft `VersionConflictError`, wenn
 * `expectedVersion` nicht uebereinstimmt — Entity wird mitgegeben fuer das
 * Conflict-Resolution-Modal.
 */
export async function updatePortfolio(id: string, input: PortfolioUpdateInput): Promise<Portfolio> {
  const db = getDb();
  const current = await getPortfolio(id);
  if (!current) {
    throw new Error(`Portfolio ${id} nicht gefunden`);
  }

  if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new VersionConflictError(current);
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    version: current.version + 1,
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.strategy !== undefined) patch.strategy = input.strategy;
  if (input.status !== undefined) {
    if (!isStatus(input.status)) {
      throw new Error(`Ungueltiger Portfolio-Status: ${input.status}`);
    }
    patch.status = input.status;
  }
  // metadata-gestuetzte Felder + metadata in das bestehende metadata mergen (nicht überschreiben).
  const touchesMeta =
    input.metadata !== undefined ||
    META_KEYS.some((k) => (input as Record<string, any>)[k] !== undefined);
  if (touchesMeta) {
    patch.metadata = mergeMetaFields((current.metadata ?? {}) as Record<string, any>, input) as never;
  }

  const result = await db
    .update(paPortfolios)
    .set(patch as never)
    .where(and(eq(paPortfolios.id, id), eq(paPortfolios.version, current.version)))
    .returning({ id: paPortfolios.id });

  if (result.length === 0) {
    const latest = await getPortfolio(id);
    throw new VersionConflictError(latest ?? current);
  }

  const updated = await getPortfolio(id);
  if (!updated) {
    throw new Error(`Portfolio ${id} verschwand nach Update`);
  }
  return updated;
}

/**
 * Loescht ein Portfolio. WICHTIG: Projekte werden NICHT mitgeloescht, ihr
 * portfolio_id wird stattdessen auf NULL gesetzt — die Projekte bleiben mit
 * ihren Sub-Resources unangetastet, aber ohne Portfolio-Zuordnung.
 */
export async function deletePortfolio(id: string): Promise<boolean> {
  const db = getDb();
  // Erst Projekt-Zuordnungen aufloesen — kein FK-Constraint, also application-level.
  await db
    .update(paProjekte)
    .set({ portfolioId: null })
    .where(eq(paProjekte.portfolioId, id));
  const result = await db.delete(paPortfolios).where(eq(paPortfolios.id, id)).returning({ id: paPortfolios.id });
  return result.length > 0;
}

/**
 * Listet Projekte ohne Portfolio (portfolio_id IS NULL). Nuetzlich fuer den
 * „Projekt hinzufuegen"-Selector im Portfolio-Detail.
 */
export async function listProjekteWithoutPortfolio(): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  const rows = await db
    .select({ id: paProjekte.id, name: paProjekte.name })
    .from(paProjekte)
    .where(isNull(paProjekte.portfolioId))
    .orderBy(desc(paProjekte.updatedAt));
  return rows;
}
