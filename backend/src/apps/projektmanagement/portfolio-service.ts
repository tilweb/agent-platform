/**
 * Portfolio-Service — Phase D (YAML-Variante / demo/messe).
 *
 * Storage: `data/apps/projektmanagement/portfolios/{id}/metadata.yaml`
 * camelCase auf API + YAML, analog projekt-service.ts.
 *
 * Loeschen eines Portfolios setzt portfolioId der zugeordneten Projekte auf
 * undefined (application-level cleanup im Service).
 */

import { parse, stringify } from 'yaml';
import type {
  Portfolio,
  PortfolioCreateInput,
  PortfolioUpdateInput,
  PortfolioStatus,
} from './types';
import { PORTFOLIO_STATUS_VALUES } from './types';
import { VersionConflictError, withLock } from './concurrency';
import { defaultOwnerPermissions } from './permissions';
import { listProjekte, updateProjekt } from './projekt-service';

const BASE_PATH = './data/apps/projektmanagement';
const PORTFOLIOS_PATH = `${BASE_PATH}/portfolios`;

export function generatePortfolioId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `portfolio-${timestamp}-${random}`;
}

function isStatus(value: unknown): value is PortfolioStatus {
  return typeof value === 'string' && (PORTFOLIO_STATUS_VALUES as readonly string[]).includes(value);
}

async function ensureBaseDir(): Promise<void> {
  await Bun.$`mkdir -p ${PORTFOLIOS_PATH}`;
}

function normalize(raw: any): Portfolio {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    strategy: raw.strategy ?? undefined,
    status: isStatus(raw.status) ? raw.status : 'active',
    type: raw.type ?? undefined,
    driver: raw.driver ?? undefined,
    start_date: raw.start_date ?? undefined,
    end_date: raw.end_date ?? undefined,
    organization: raw.organization ?? undefined,
    stakeholders: raw.stakeholders ?? undefined,
    ownerId: raw.ownerId ?? undefined,
    metadata: raw.metadata ?? undefined,
    permissions: raw.permissions ?? undefined,
    version: typeof raw.version === 'number' ? raw.version : 1,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface ListPortfoliosOptions {
  status?: PortfolioStatus;
  limit?: number;
  offset?: number;
}

const MAX_PORTFOLIO_LIMIT = 1000;

export async function listPortfolios(options: ListPortfoliosOptions = {}): Promise<Portfolio[]> {
  const all: Portfolio[] = [];
  try {
    const glob = new Bun.Glob('*/metadata.yaml');
    for await (const path of glob.scan(PORTFOLIOS_PATH)) {
      const file = Bun.file(`${PORTFOLIOS_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        all.push(normalize(parse(content)));
      }
    }
  } catch {
    // Verzeichnis existiert noch nicht — leere Liste ist korrekt.
  }
  const filtered = options.status ? all.filter((p) => p.status === options.status) : all;
  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (options.limit !== undefined) {
    const lim = Math.min(Math.max(1, options.limit), MAX_PORTFOLIO_LIMIT);
    const off = Math.max(0, options.offset ?? 0);
    return filtered.slice(off, off + lim);
  }
  return filtered;
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  const file = Bun.file(`${PORTFOLIOS_PATH}/${id}/metadata.yaml`);
  if (!(await file.exists())) return null;
  const content = await file.text();
  return normalize(parse(content));
}

export async function createPortfolio(input: PortfolioCreateInput): Promise<Portfolio> {
  await ensureBaseDir();
  const id = input.id ?? generatePortfolioId();
  const now = new Date().toISOString();
  const status: PortfolioStatus = input.status && isStatus(input.status) ? input.status : 'active';
  const permissions = input.ownerId ? defaultOwnerPermissions(input.ownerId) : undefined;
  const portfolio: Portfolio = {
    id,
    name: input.name,
    description: input.description,
    strategy: input.strategy,
    status,
    type: input.type,
    driver: input.driver,
    start_date: input.start_date,
    end_date: input.end_date,
    organization: input.organization,
    stakeholders: input.stakeholders,
    ownerId: input.ownerId,
    metadata: input.metadata,
    permissions,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  return withLock(`portfolio:${id}`, async () => {
    const file = Bun.file(`${PORTFOLIOS_PATH}/${id}/metadata.yaml`);
    if (await file.exists()) {
      throw new Error(`Portfolio ${id} existiert bereits`);
    }
    await Bun.$`mkdir -p ${PORTFOLIOS_PATH}/${id}`;
    await Bun.write(`${PORTFOLIOS_PATH}/${id}/metadata.yaml`, stringify(portfolio));
    return portfolio;
  });
}

export async function updatePortfolio(id: string, input: PortfolioUpdateInput): Promise<Portfolio> {
  return withLock(`portfolio:${id}`, async () => {
    const current = await getPortfolio(id);
    if (!current) {
      throw new Error(`Portfolio ${id} nicht gefunden`);
    }
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
      throw new VersionConflictError(current);
    }
    const next: Portfolio = { ...current };
    if (input.name !== undefined) next.name = input.name;
    if (input.description !== undefined) next.description = input.description ?? undefined;
    if (input.strategy !== undefined) next.strategy = input.strategy ?? undefined;
    if (input.status !== undefined) {
      if (!isStatus(input.status)) {
        throw new Error(`Ungueltiger Portfolio-Status: ${input.status}`);
      }
      next.status = input.status;
    }
    if (input.type !== undefined) next.type = input.type;
    if (input.driver !== undefined) next.driver = input.driver;
    if (input.start_date !== undefined) next.start_date = input.start_date;
    if (input.end_date !== undefined) next.end_date = input.end_date;
    if (input.organization !== undefined) next.organization = input.organization;
    if (input.stakeholders !== undefined) next.stakeholders = input.stakeholders;
    if (input.metadata !== undefined) next.metadata = input.metadata;
    next.version = current.version + 1;
    next.updatedAt = new Date().toISOString();
    await Bun.write(`${PORTFOLIOS_PATH}/${id}/metadata.yaml`, stringify(next));
    return next;
  });
}

/**
 * Loescht ein Portfolio. WICHTIG: Projekte werden NICHT mitgeloescht. Ihr
 * portfolioId wird vorab auf undefined gesetzt.
 */
export async function deletePortfolio(id: string): Promise<boolean> {
  return withLock(`portfolio:${id}`, async () => {
    const file = Bun.file(`${PORTFOLIOS_PATH}/${id}/metadata.yaml`);
    if (!(await file.exists())) return false;

    // Erst: Zuordnungen aufloesen.
    const projekte = await listProjekte();
    for (const p of projekte) {
      if (p.portfolioId === id) {
        await updateProjekt(p.id, { portfolioId: null });
      }
    }
    await Bun.$`rm -rf ${PORTFOLIOS_PATH}/${id}`;
    return true;
  });
}
