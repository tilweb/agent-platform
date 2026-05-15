/**
 * Projekt-Service — Phase A der Entity-Restruktur (demo/messe / YAML-Variante).
 *
 * `paProjekte` (im main-Worktree Drizzle) hat hier seine YAML-Entsprechung:
 *   data/apps/projektmanagement/projekte/{id}/metadata.yaml
 *
 * Phase A: parallel zu projektauftraege/. IDs werden 1:1 von bestehenden
 * Auftraegen uebernommen (siehe scripts/migrate-projekte.ts). Sub-Resources
 * (Statusberichte) bleiben zunaechst an projektauftraege/ haengen — Phase B+
 * zieht sie um.
 *
 * camelCase auf API + YAML, abweichend von Projektauftrag/Projektidee
 * (snake_case): neue Entity, kein Legacy-Schema. Frontend-Cherry-pick aus
 * main passt damit 1:1.
 */

import { parse, stringify } from 'yaml';
import type {
  Projekt,
  ProjektCreateInput,
  ProjektUpdateInput,
  ProjektLifecycle,
} from './types';
import { PROJEKT_LIFECYCLE_VALUES } from './types';
import { VersionConflictError, withLock } from './concurrency';

const BASE_PATH = './data/apps/projektmanagement';
const PROJEKTE_PATH = `${BASE_PATH}/projekte`;

// ============== ID + Helpers ==============

export function generateProjektId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `projekt-${timestamp}-${random}`;
}

function isLifecycle(value: unknown): value is ProjektLifecycle {
  return typeof value === 'string' && (PROJEKT_LIFECYCLE_VALUES as readonly string[]).includes(value);
}

async function ensureBaseDir(): Promise<void> {
  await Bun.$`mkdir -p ${PROJEKTE_PATH}`;
}

function normalize(raw: any): Projekt {
  return {
    id: raw.id,
    name: raw.name,
    lifecycle: isLifecycle(raw.lifecycle) ? raw.lifecycle : 'planning',
    portfolioId: raw.portfolioId ?? undefined,
    ideeId: raw.ideeId ?? undefined,
    ownerId: raw.ownerId ?? undefined,
    metadata: raw.metadata ?? undefined,
    permissions: raw.permissions ?? undefined,
    version: typeof raw.version === 'number' ? raw.version : 1,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// ============== CRUD ==============

export async function listProjekte(): Promise<Projekt[]> {
  const projekte: Projekt[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PROJEKTE_PATH)) {
      const file = Bun.file(`${PROJEKTE_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        projekte.push(normalize(parse(content)));
      }
    }
  } catch {
    // Verzeichnis existiert noch nicht — leere Liste ist korrekt.
  }
  projekte.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return projekte;
}

export async function getProjekt(id: string): Promise<Projekt | null> {
  const file = Bun.file(`${PROJEKTE_PATH}/${id}/metadata.yaml`);
  if (!(await file.exists())) return null;
  const content = await file.text();
  return normalize(parse(content));
}

/**
 * Reverse-Lookup ueber ideeId — analog zum Drizzle-Index `projekt_idee_idx`.
 */
export async function listProjekteByIdee(ideeId: string): Promise<Projekt[]> {
  const all = await listProjekte();
  return all
    .filter((p) => p.ideeId === ideeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createProjekt(input: ProjektCreateInput): Promise<Projekt> {
  await ensureBaseDir();
  const id = input.id ?? generateProjektId();
  const now = new Date().toISOString();
  const projekt: Projekt = {
    id,
    name: input.name,
    lifecycle: input.lifecycle ?? 'planning',
    portfolioId: input.portfolioId,
    ideeId: input.ideeId,
    ownerId: input.ownerId,
    metadata: input.metadata,
    permissions: undefined,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return withLock(`projekt:${id}`, async () => {
    const file = Bun.file(`${PROJEKTE_PATH}/${id}/metadata.yaml`);
    if (await file.exists()) {
      throw new Error(`Projekt ${id} existiert bereits`);
    }
    await Bun.$`mkdir -p ${PROJEKTE_PATH}/${id}`;
    await Bun.write(`${PROJEKTE_PATH}/${id}/metadata.yaml`, stringify(projekt));
    return projekt;
  });
}

/**
 * Update mit optimistischer Concurrency. Wirft `VersionConflictError`, wenn
 * `expectedVersion` nicht uebereinstimmt (analog zu updateProjektauftrag).
 */
export async function updateProjekt(id: string, input: ProjektUpdateInput): Promise<Projekt> {
  return withLock(`projekt:${id}`, async () => {
    const current = await getProjekt(id);
    if (!current) {
      throw new Error(`Projekt ${id} nicht gefunden`);
    }

    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new VersionConflictError(current);
    }

    const next: Projekt = { ...current };
    if (input.name !== undefined) next.name = input.name;
    if (input.lifecycle !== undefined) {
      if (!isLifecycle(input.lifecycle)) {
        throw new Error(`Ungueltiger Lifecycle-Wert: ${input.lifecycle}`);
      }
      next.lifecycle = input.lifecycle;
    }
    if (input.portfolioId !== undefined) {
      next.portfolioId = input.portfolioId ?? undefined;
    }
    if (input.metadata !== undefined) next.metadata = input.metadata;
    next.version = current.version + 1;
    next.updatedAt = new Date().toISOString();

    await Bun.write(`${PROJEKTE_PATH}/${id}/metadata.yaml`, stringify(next));
    return next;
  });
}

/**
 * Loescht ein Projekt. Sub-Resources (Auftrag, Statusberichte) sitzen in
 * Phase A weiterhin unter projektauftraege/{id}/... — die muss man separat
 * via deleteProjektauftrag entfernen.
 */
export async function deleteProjekt(id: string): Promise<boolean> {
  return withLock(`projekt:${id}`, async () => {
    const file = Bun.file(`${PROJEKTE_PATH}/${id}/metadata.yaml`);
    if (!(await file.exists())) return false;
    await Bun.$`rm -rf ${PROJEKTE_PATH}/${id}`;
    return true;
  });
}

// ============== Lifecycle-Hinweise ==============

/**
 * Stub fuer Lifecycle-Vorschlaege. Wird in Phase A nicht aufgerufen — kommt
 * mit Phase E (Abschlussbericht) zurueck.
 */
export async function suggestLifecycleTransition(projektId: string): Promise<ProjektLifecycle | null> {
  const projekt = await getProjekt(projektId);
  if (!projekt) return null;
  return null;
}

// ============== Daten-Migration (Boot-Hook + CLI) ==============

const AUFTRAEGE_PATH = `${BASE_PATH}/projektauftraege`;

function mapAuftragStatusToLifecycle(status: string | null | undefined): ProjektLifecycle {
  switch ((status || '').toLowerCase()) {
    case 'active': return 'active';
    case 'completed': return 'closed';
    case 'cancelled': return 'cancelled';
    default: return 'planning';
  }
}

/**
 * Idempotent: legt fuer jeden Auftrag-Ordner unter `projektauftraege/`, fuer
 * den noch keine `projekte/{id}/metadata.yaml` existiert, ein Projekt-File an.
 * Wird beim Boot (Railway Dockerfile-CMD ruft das CLI-Script auf) UND lokal
 * per `bun run scripts/migrate-projekte.ts` ausgefuehrt.
 *
 * Behandelt fehlendes `projektauftraege/`-Verzeichnis ohne Crash (frischer
 * Volume → 0/0).
 */
export async function migrateAuftraegeToProjekteIfNeeded(): Promise<{
  created: number;
  skipped: number;
  errors: number;
}> {
  await ensureBaseDir();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  const ids: string[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(AUFTRAEGE_PATH)) {
      const id = path.split('/')[0];
      if (id) ids.push(id);
    }
  } catch {
    return { created: 0, skipped: 0, errors: 0 };
  }

  for (const id of ids) {
    try {
      const existing = Bun.file(`${PROJEKTE_PATH}/${id}/metadata.yaml`);
      if (await existing.exists()) {
        skipped += 1;
        continue;
      }
      const auftragFile = Bun.file(`${AUFTRAEGE_PATH}/${id}/metadata.yaml`);
      if (!(await auftragFile.exists())) {
        skipped += 1;
        continue;
      }
      const auftrag = parse(await auftragFile.text()) as any;
      const now = new Date().toISOString();
      const projekt: Projekt = {
        id: auftrag.id,
        name: auftrag.name,
        lifecycle: mapAuftragStatusToLifecycle(auftrag.status),
        portfolioId: undefined,
        ideeId: auftrag.idee_id ?? undefined,
        ownerId: auftrag.created_by ?? undefined,
        metadata: undefined,
        permissions: auftrag.permissions ?? undefined,
        version: 1,
        createdAt: auftrag.created_at ?? now,
        updatedAt: auftrag.updated_at ?? now,
      };
      await Bun.$`mkdir -p ${PROJEKTE_PATH}/${id}`;
      await Bun.write(`${PROJEKTE_PATH}/${id}/metadata.yaml`, stringify(projekt));
      created += 1;
    } catch (err) {
      errors += 1;
      console.error(`[migrate-projekte] Fehler bei id=${id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { created, skipped, errors };
}
