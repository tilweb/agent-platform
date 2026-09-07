import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
export const jobContext = new AsyncLocalStorage<{ runId: string; token: string; generation?: number }>();
export function jobFence(runId: string) {
  const owner = jobContext.getStore();
  if (!owner) return undefined;
  if (owner.runId !== runId) throw new Error('Job scope mismatch');
  return sql`EXISTS (SELECT 1 FROM extraction.jobs j WHERE j.run_id = ${runId} AND j.token = ${owner.token} AND j.state = 'running' AND j.lease_until > now())`;
}

/** Lock ownership and result write together; cancellation/takeover cannot race an old write. */
export async function fencedWrite<T>(runId: string, fn: (db: import('../../db').DB) => Promise<T>): Promise<T> {
  const { getDb } = await import('../../db');
  const owner=jobContext.getStore();
  if(!owner) return fn(getDb());
  if(owner.runId!==runId) throw new Error('Job scope mismatch');
  return getDb().transaction(async tx=> {
    const rows=await tx.execute(sql`SELECT run_id FROM extraction.jobs WHERE run_id=${runId} AND token=${owner.token} AND state='running' AND lease_until>now() FOR UPDATE`);
    if(!rows.length) throw new Error('Job-Lease nicht mehr gültig');
    return fn(tx as unknown as import('../../db').DB);
  });
}
