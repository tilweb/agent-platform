/**
 * Optimistic Concurrency Control — identisch zum Projektmanagement-Muster.
 * VersionConflictError → 409 in den Routes; withLock serialisiert Read-Modify-Write.
 */

export class VersionConflictError<T = unknown> extends Error {
  constructor(public readonly current: T) {
    super('Version conflict — entity has been modified by another user');
    this.name = 'VersionConflictError';
  }
}

const locks = new Map<string, Promise<unknown>>();

export async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(id, next.catch(() => undefined));
  try {
    return await next;
  } finally {
    if (locks.get(id) === next.catch(() => undefined)) {
      locks.delete(id);
    }
  }
}

export function checkVersion<T extends { version?: number }>(
  current: T,
  expectedVersion: number | undefined,
  force: boolean,
): void {
  if (force) return;
  if (expectedVersion === undefined) return;
  const currentVersion = current.version ?? 1;
  if (currentVersion !== expectedVersion) {
    throw new VersionConflictError(current);
  }
}
