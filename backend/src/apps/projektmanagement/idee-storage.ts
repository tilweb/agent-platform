/**
 * Projektidee Storage — File-based (YAML).
 *
 * Spiegelt das Pattern von storage.ts (Auftrag): pro Idee ein Verzeichnis
 * unter data/apps/projektmanagement/projektideen/<id>/metadata.yaml.
 *
 * Auftrag-Verknuepfung ueber das Feld `idee_id` direkt in der Auftrag-YAML
 * (kein FK, keine DB) — `loadAbgeleiteteAuftraege` globt alle Auftraege und
 * filtert.
 */

import { parse, stringify } from 'yaml';
import type { Projektidee, Projektauftrag } from './types';
import { withLock, checkVersion } from './concurrency';

const BASE_PATH = './data/apps/projektmanagement';
const PROJEKTIDEEN_PATH = `${BASE_PATH}/projektideen`;
const PROJEKTAUFTRAEGE_PATH = `${BASE_PATH}/projektauftraege`;

export function generateProjektideeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `idee-${timestamp}-${random}`;
}

async function ensureDirectories(): Promise<void> {
  await Bun.$`mkdir -p ${PROJEKTIDEEN_PATH}`;
}

/**
 * Liest aus allen Auftrag-YAMLs die abgeleiteten Auftraege fuer eine Idee.
 * Pendant zur Drizzle-JOIN-Variante auf main.
 */
async function loadAbgeleiteteAuftraege(ideeId: string): Promise<Projektidee['abgeleitete_auftraege']> {
  const result: NonNullable<Projektidee['abgeleitete_auftraege']> = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PROJEKTAUFTRAEGE_PATH)) {
      const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${path}`);
      if (!(await file.exists())) continue;
      const auftrag = parse(await file.text()) as Projektauftrag & { idee_id?: string };
      if (auftrag.idee_id === ideeId) {
        result.push({
          id: auftrag.id,
          name: auftrag.name,
          status: auftrag.status,
          created_at: auftrag.created_at,
        });
      }
    }
  } catch {
    // Keine Auftraege -> leeres Array.
  }
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return result;
}

export async function getProjektideen(): Promise<Projektidee[]> {
  await ensureDirectories();
  const ideen: Projektidee[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PROJEKTIDEEN_PATH)) {
      const file = Bun.file(`${PROJEKTIDEEN_PATH}/${path}`);
      if (!(await file.exists())) continue;
      const idee = parse(await file.text()) as Projektidee;
      ideen.push(idee);
    }
  } catch {
    return [];
  }
  ideen.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return ideen;
}

export async function getProjektidee(id: string): Promise<Projektidee | null> {
  const file = Bun.file(`${PROJEKTIDEEN_PATH}/${id}/metadata.yaml`);
  if (!(await file.exists())) return null;
  const idee = parse(await file.text()) as Projektidee;
  // Backward-Compat: aelteren Datensaetzen ohne version eine 1 verpassen.
  if (idee.version === undefined) idee.version = 1;
  idee.abgeleitete_auftraege = await loadAbgeleiteteAuftraege(id);
  return idee;
}

// ============== Portfolio-Zuordnung (Idee ↔ Portfolio, 0..1) ==============

/** Alle Ideen, die dem Portfolio zugeordnet sind (portfolioId in der Idee-YAML). */
export async function listIdeenByPortfolio(portfolioId: string): Promise<Projektidee[]> {
  const all = await getProjektideen();
  return all.filter((i) => i.portfolioId === portfolioId);
}

/** Ideen ohne Portfolio-Zuordnung — für den „Idee hinzufügen"-Selector. */
export async function listIdeenWithoutPortfolio(): Promise<Projektidee[]> {
  const all = await getProjektideen();
  return all.filter((i) => !i.portfolioId);
}

/** Setzt/entfernt die Portfolio-Zuordnung einer Idee (portfolioId=null → entfernen). */
export async function setIdeePortfolioId(ideeId: string, portfolioId: string | null): Promise<boolean> {
  const file = Bun.file(`${PROJEKTIDEEN_PATH}/${ideeId}/metadata.yaml`);
  if (!(await file.exists())) return false;
  const idee = parse(await file.text()) as Projektidee;
  if (portfolioId) idee.portfolioId = portfolioId;
  else delete idee.portfolioId;
  idee.updated_at = new Date().toISOString();
  await Bun.write(`${PROJEKTIDEEN_PATH}/${ideeId}/metadata.yaml`, stringify(idee));
  return true;
}

export async function saveProjektidee(idee: Projektidee): Promise<void> {
  const dir = `${PROJEKTIDEEN_PATH}/${idee.id}`;
  await Bun.$`mkdir -p ${dir}`;
  // abgeleitete_auftraege werden beim Lesen angereichert — nicht persistieren.
  const { abgeleitete_auftraege: _ignore, ...dataToStore } = idee;
  void _ignore;
  // version sicherstellen (Initial-Save: 1).
  if (dataToStore.version === undefined) dataToStore.version = 1;
  await Bun.write(`${dir}/metadata.yaml`, stringify(dataToStore));
}

export async function updateProjektidee(
  id: string,
  updates: Partial<Projektidee>,
  options: { expectedVersion?: number; force?: boolean } = {},
): Promise<Projektidee | null> {
  return withLock(`idee:${id}`, async () => {
    const existing = await getProjektidee(id);
    if (!existing) return null;
    checkVersion(existing, options.expectedVersion, options.force ?? false);
    const merged: Projektidee = {
      ...existing,
      ...updates,
      id,
      updated_at: new Date().toISOString(),
      version: (existing.version ?? 1) + 1,
    } as Projektidee;
    await saveProjektidee(merged);
    return getProjektidee(id);
  });
}

export async function deleteProjektidee(id: string): Promise<boolean> {
  const dir = `${PROJEKTIDEEN_PATH}/${id}`;
  const metadataFile = Bun.file(`${dir}/metadata.yaml`);
  if (!(await metadataFile.exists())) return false;

  // Abgeleitete Auftraege bleiben bestehen, ihr idee_id-Feld wird geleert
  // damit kein Dangling-Verweis entsteht.
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PROJEKTAUFTRAEGE_PATH)) {
      const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${path}`);
      if (!(await file.exists())) continue;
      const auftrag = parse(await file.text()) as Projektauftrag & { idee_id?: string };
      if (auftrag.idee_id === id) {
        delete (auftrag as { idee_id?: string }).idee_id;
        await Bun.write(`${PROJEKTAUFTRAEGE_PATH}/${path}`, stringify(auftrag));
      }
    }
  } catch {
    // ignore
  }

  await Bun.$`rm -rf ${dir}`;
  return true;
}

/**
 * Setzt das idee_id-Feld in einer Auftrag-YAML — Pendant zur DB-Spalten-Update
 * auf main. Wird von createAuftragFromIdee aufgerufen, damit die Verknuepfung
 * persistiert ist und loadAbgeleiteteAuftraege sie findet.
 */
export async function setAuftragIdeeId(auftragId: string, ideeId: string): Promise<void> {
  const file = Bun.file(`${PROJEKTAUFTRAEGE_PATH}/${auftragId}/metadata.yaml`);
  if (!(await file.exists())) return;
  const auftrag = parse(await file.text()) as Projektauftrag & { idee_id?: string };
  auftrag.idee_id = ideeId;
  await Bun.write(`${PROJEKTAUFTRAEGE_PATH}/${auftragId}/metadata.yaml`, stringify(auftrag));
}
