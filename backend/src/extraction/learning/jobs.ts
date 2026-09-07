import { readFile, mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { getSql } from '../../db/client';
import { createBatchRun, getBatchRunFileDetail, getBatchRun } from './batch-runs';
import { getProject } from './projects';
import { getExamples } from './examples';
import { captureSnapshot } from './service';
import { runBatchExtraction } from './batch-service';
import { jobContext } from './job-context';
import { withPriority } from '../../services/extraction/runtime';

export async function enqueueBatch(projectId: string, files: Array<{ filename: string; tempPath: string }>, userId?: string, webhookUrl?: string) {
  try {
  const project = await getProject(projectId);
  if (!project) throw new Error('Profil nicht gefunden');
  const snapshot = await captureSnapshot(project, await getExamples(projectId));
  const originals = await Promise.all(files.map(async f => { const bytes=await readFile(f.tempPath); return { filename: f.filename, base64: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }; }));
  const result = await createBatchRun(projectId, files.map(f=>f.filename), webhookUrl, { originals, snapshot, userId });
  startExtractionWorker();
  return result;
  } finally {
    await Promise.all(files.map(f=>rm(f.tempPath,{force:true}).catch(()=>{})));
    await Promise.all([...new Set(files.map(f=>dirname(f.tempPath)))].map(dir=>rmdir(dir).catch(()=>{})));
  }
}

export async function claimJob() {
  const db = getSql(), token=randomUUID();
  const rows = await db`WITH candidate AS (
    SELECT run_id FROM extraction.jobs WHERE state = 'pending' OR (state = 'running' AND lease_until < now())
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE extraction.jobs j SET state='running', token=${token}, lease_until=now()+interval '90 seconds', attempts=attempts+1
    FROM candidate c WHERE j.run_id=c.run_id RETURNING j.*`;
  return rows[0];
}
export async function renewJob(runId: string, token: string): Promise<boolean> {
  const rows=await getSql()`UPDATE extraction.jobs SET lease_until=now()+interval '90 seconds' WHERE run_id=${runId} AND token=${token} AND state='running' AND lease_until>now() RETURNING run_id`;
  return rows.length>0;
}

/** No completed result is re-extracted after recovery. Each write is fenced to the current lease. */
export async function processOneJob(runner: typeof runBatchExtraction = runBatchExtraction): Promise<boolean> {
  const job=await claimJob(); if(!job) return false;
  const db=getSql(), runId=String(job.run_id), token=String(job.token);
  const dirs: string[]=[];
  const timer=setInterval(()=>{ void renewJob(runId,token).catch(error=>console.error('[extraction-worker] heartbeat:',error.message)); },20_000);
  timer.unref();
  try {
    const [run]=await db`SELECT project_id FROM extraction.batch_runs WHERE id=${runId}`;
    if (!run) return true;
    await jobContext.run({runId,token,generation:Number(job.generation)}, async()=> {
      if (Number(job.attempts)>3) throw new Error('Wiederanlauf nach drei unterbrochenen Versuchen gestoppt.');
      const state=await getBatchRun(run.project_id,runId);
      const inputs: import('./batch-service').BatchInputFile[]=[];
      for(const file of state?.files ?? []) {
        if(file.status==='completed' || file.status==='failed') continue;
        const detail=await getBatchRunFileDetail(run.project_id,runId,file.id);
        if(!detail?.original) throw new Error('Gespeichertes Original fehlt');
        const bytes=Buffer.from(detail.original.base64,'base64');
        if(createHash('sha256').update(bytes).digest('hex')!==detail.original.sha256) throw new Error('Original-Prüfsumme stimmt nicht');
        const dir=await mkdtemp(join(tmpdir(),'extraction-job-')); dirs.push(dir);
        const path=join(dir,'source'); await writeFile(path,bytes);
        inputs.push({fileId:file.id,filename:file.filename,tempPath:path});
      }
      await withPriority('batch',()=>runner(run.project_id,runId,inputs,job.user_id ?? undefined));
    });
    await db`UPDATE extraction.jobs SET state='completed',token=null,lease_until=null WHERE run_id=${runId} AND token=${token} AND lease_until>now()`;
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    await db.begin(async tx=> {
      const owned=await tx`UPDATE extraction.jobs SET state='failed',error=${message},token=null,lease_until=null WHERE run_id=${runId} AND token=${token} AND lease_until>now() RETURNING run_id`;
      if(!owned.length) return;
      await tx`UPDATE extraction.batch_run_files SET status='failed',error=${message} WHERE batch_run_id=${runId} AND status IN ('pending','processing')`;
      await tx`UPDATE extraction.batch_runs SET status='failed',updated_at=now() WHERE id=${runId}`;
    });
  } finally { clearInterval(timer); await Promise.all(dirs.map(dir=>rm(dir,{recursive:true,force:true}))); }
  return true;
}
let started=false, busy=false;
export function startExtractionWorker() {
  if(started || process.env.EXTRACTION_WORKER_DISABLED === '1') return; started=true;
  const tick=async()=>{ if(busy) return; busy=true; try { for(let i=0;i<10 && await processOneJob();i++); } catch(error) { console.error('[extraction-worker]', error instanceof Error?error.message:error); } finally { busy=false; } };
  const timer=setInterval(()=>void tick(),2000); timer.unref(); void tick();
}

export async function cancelBatch(projectId: string, runId: string) {
  return getSql().begin(async tx=> {
    const rows=await tx`UPDATE extraction.jobs j SET state='cancelled',token=null,lease_until=null FROM extraction.batch_runs r WHERE j.run_id=${runId} AND r.id=j.run_id AND r.project_id=${projectId} AND j.state IN ('pending','running') RETURNING j.run_id`;
    if(!rows.length) return false;
    await tx`UPDATE extraction.batch_run_files SET status='failed',error='Vom Benutzer abgebrochen',updated_at=now() WHERE batch_run_id=${runId} AND status IN ('pending','processing')`;
    await tx`UPDATE extraction.batch_runs SET status='failed',updated_at=now() WHERE id=${runId}`;
    return true;
  });
}
export async function retryBatch(projectId: string, runId: string) {
  const changed=await getSql().begin(async tx=> {
    const rows=await tx`SELECT j.run_id FROM extraction.jobs j JOIN extraction.batch_runs r ON r.id=j.run_id WHERE j.run_id=${runId} AND r.project_id=${projectId} AND j.state IN ('completed','failed','cancelled') FOR UPDATE OF j`;
    if(!rows.length) return false;
    const files=await tx`UPDATE extraction.batch_run_files SET status='pending',error=null,updated_at=now() WHERE batch_run_id=${runId} AND status='failed' AND detail->'original' IS NOT NULL RETURNING id`;
    if(!files.length) return false;
    await tx`UPDATE extraction.jobs SET state='pending',attempts=0,generation=generation+1,error=null,token=null,lease_until=null WHERE run_id=${runId}`;
    await tx`UPDATE extraction.batch_runs SET status='pending',updated_at=now() WHERE id=${runId}`;
    return true;
  });
  if(changed) startExtractionWorker(); return changed;
}
