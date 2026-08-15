/**
 * Kapazitaet-Storage — railway (YAML-Variante / demo/messe).
 *
 * Storage: `data/apps/projektmanagement/personen/{id}/metadata.yaml`.
 * Die exportierte API ist signaturgleich zur main-Drizzle-Variante, damit die
 * Route-Handler 1:1 portierbar sind. Kapazitaets-Felder liegen flach in der YAML.
 */

import { parse, stringify } from 'yaml';
import type {
  Kapazitaetsperson,
  KapazitaetspersonCreateInput,
  KapazitaetspersonUpdateInput,
} from './types';
import { VersionConflictError, withLock } from './concurrency';
import { defaultOwnerPermissions } from './permissions';

const BASE_PATH = './data/apps/projektmanagement';
const PERSONEN_PATH = `${BASE_PATH}/personen`;

export function generatePersonId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `person-${timestamp}-${random}`;
}

async function ensureBaseDir(): Promise<void> {
  await Bun.$`mkdir -p ${PERSONEN_PATH}`;
}

function normalize(raw: any): Kapazitaetsperson {
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role ?? undefined,
    wochenarbeitszeit_pct: typeof raw.wochenarbeitszeit_pct === 'number' ? raw.wochenarbeitszeit_pct : 100,
    linie_avg_pt: typeof raw.linie_avg_pt === 'number' ? raw.linie_avg_pt : 0,
    linie_monate: (raw.linie_monate ?? {}) as Record<string, number>,
    ownerId: raw.ownerId ?? undefined,
    metadata: raw.metadata ?? undefined,
    permissions: raw.permissions ?? undefined,
    version: typeof raw.version === 'number' ? raw.version : 1,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function listPersonen(): Promise<Kapazitaetsperson[]> {
  const all: Kapazitaetsperson[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PERSONEN_PATH)) {
      const file = Bun.file(`${PERSONEN_PATH}/${path}`);
      if (await file.exists()) {
        all.push(normalize(parse(await file.text())));
      }
    }
  } catch {
    // Verzeichnis existiert noch nicht — leere Liste ist korrekt.
  }
  all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return all;
}

export async function getPerson(id: string): Promise<Kapazitaetsperson | null> {
  const file = Bun.file(`${PERSONEN_PATH}/${id}/metadata.yaml`);
  if (!(await file.exists())) return null;
  return normalize(parse(await file.text()));
}

export async function createPerson(input: KapazitaetspersonCreateInput): Promise<Kapazitaetsperson> {
  await ensureBaseDir();
  const id = input.id ?? generatePersonId();
  const now = new Date().toISOString();
  const permissions = input.ownerId ? defaultOwnerPermissions(input.ownerId) : undefined;
  const person: Kapazitaetsperson = {
    id,
    name: input.name,
    role: input.role,
    wochenarbeitszeit_pct: input.wochenarbeitszeit_pct ?? 100,
    linie_avg_pt: input.linie_avg_pt ?? 0,
    linie_monate: input.linie_monate ?? {},
    ownerId: input.ownerId,
    permissions,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return withLock(`person:${id}`, async () => {
    const file = Bun.file(`${PERSONEN_PATH}/${id}/metadata.yaml`);
    if (await file.exists()) throw new Error(`Person ${id} existiert bereits`);
    await Bun.$`mkdir -p ${PERSONEN_PATH}/${id}`;
    await Bun.write(`${PERSONEN_PATH}/${id}/metadata.yaml`, stringify(person));
    return person;
  });
}

export async function updatePerson(id: string, input: KapazitaetspersonUpdateInput): Promise<Kapazitaetsperson> {
  return withLock(`person:${id}`, async () => {
    const current = await getPerson(id);
    if (!current) throw new Error(`Person ${id} nicht gefunden`);
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new VersionConflictError(current);
    }
    const next: Kapazitaetsperson = { ...current };
    if (input.name !== undefined) next.name = input.name;
    if (input.role !== undefined) next.role = input.role;
    if (input.wochenarbeitszeit_pct !== undefined) next.wochenarbeitszeit_pct = input.wochenarbeitszeit_pct;
    if (input.linie_avg_pt !== undefined) next.linie_avg_pt = input.linie_avg_pt;
    if (input.linie_monate !== undefined) next.linie_monate = input.linie_monate;
    next.version = current.version + 1;
    next.updatedAt = new Date().toISOString();
    await Bun.write(`${PERSONEN_PATH}/${id}/metadata.yaml`, stringify(next));
    return next;
  });
}

export async function deletePerson(id: string): Promise<boolean> {
  return withLock(`person:${id}`, async () => {
    const file = Bun.file(`${PERSONEN_PATH}/${id}/metadata.yaml`);
    if (!(await file.exists())) return false;
    await Bun.$`rm -rf ${PERSONEN_PATH}/${id}`;
    return true;
  });
}
