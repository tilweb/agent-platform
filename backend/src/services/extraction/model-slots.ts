import { randomUUID } from 'node:crypto';
import { getSql } from '../../db/client';

/** Cross-replica admission. Expiry exceeds the bounded provider call; heartbeat retains long calls. */
export async function withModelSlot<T>(model: string, limit: number, fn: () => Promise<T>): Promise<T> {
  if (!process.env.SCALINGO_POSTGRES) return fn();
  const db=getSql(), token=randomUUID();
  let slot: number | undefined;
  while(slot===undefined) {
    for(let candidate=0;candidate<limit;candidate++) {
      const rows=await db`INSERT INTO extraction.model_slots(model_key,slot,token,lease_until)
        VALUES(${model},${candidate},${token},now()+interval '10 minutes')
        ON CONFLICT(model_key,slot) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until
        WHERE extraction.model_slots.lease_until<now() RETURNING slot`;
      if(rows.length) { slot=candidate; break; }
    }
    if(slot===undefined) await new Promise(resolve=>setTimeout(resolve,250));
  }
  const timer=setInterval(()=>{ void db`UPDATE extraction.model_slots SET lease_until=now()+interval '10 minutes' WHERE model_key=${model} AND slot=${slot!} AND token=${token}`.catch(error=>console.error('[extraction-slots] heartbeat:', error.message)); },30_000);
  timer.unref();
  try { return await fn(); }
  finally { clearInterval(timer); await db`DELETE FROM extraction.model_slots WHERE model_key=${model} AND slot=${slot} AND token=${token}`.catch(error=>console.error('[extraction-slots] release:',error.message)); }
}
