/**
 * VSM Storage
 * File-based persistence for VSM projects
 */

import type { VsmProjekt } from './types';

const BASE_PATH = './data/apps/vsm';
const PROJEKTE_PATH = `${BASE_PATH}/projekte`;

// ============== ID Generation ==============

export function generateProjektId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `vsm-${timestamp}-${random}`;
}

// ============== Validation ==============

const SAFE_ID_PATTERN = /^[a-z0-9\-_]+$/;

export function validateId(id: string): boolean {
  return SAFE_ID_PATTERN.test(id) && id.length <= 64;
}

// ============== CRUD Operations ==============

export async function getProjekte(): Promise<VsmProjekt[]> {
  const projekte: VsmProjekt[] = [];
  try {
    const glob = new Bun.Glob('*/data.json');
    for await (const path of glob.scan(PROJEKTE_PATH)) {
      const file = Bun.file(`${PROJEKTE_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        projekte.push(JSON.parse(content) as VsmProjekt);
      }
    }
  } catch (error) {
    console.log('No VSM projects found, returning empty list');
  }
  projekte.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return projekte;
}

export async function getProjekt(id: string): Promise<VsmProjekt | null> {
  if (!validateId(id)) return null;
  try {
    const file = Bun.file(`${PROJEKTE_PATH}/${id}/data.json`);
    if (!(await file.exists())) return null;
    const content = await file.text();
    return JSON.parse(content) as VsmProjekt;
  } catch (error) {
    console.error(`Error reading VSM project ${id}:`, error);
    return null;
  }
}

export async function saveProjekt(projekt: VsmProjekt): Promise<void> {
  const dir = `${PROJEKTE_PATH}/${projekt.id}`;
  await Bun.$`mkdir -p ${dir}`;
  await Bun.write(`${dir}/data.json`, JSON.stringify(projekt, null, 2));
}

export async function deleteProjekt(id: string): Promise<boolean> {
  if (!validateId(id)) return false;
  const file = Bun.file(`${PROJEKTE_PATH}/${id}/data.json`);
  if (!(await file.exists())) return false;
  await Bun.$`rm -rf ${PROJEKTE_PATH}/${id}`;
  return true;
}
