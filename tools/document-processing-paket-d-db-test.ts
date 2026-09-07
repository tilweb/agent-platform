/** Called only from the disposable database harness; never contacts an LLM. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getSql } from '../backend/src/db/client';
import { createBatchRun, getBatchRunFileDetail, upsertFileResult, recoverStaleRuns } from '../backend/src/extraction/learning/batch-runs';
import { claimJob, renewJob, cancelBatch, retryBatch, processOneJob } from '../backend/src/extraction/learning/jobs';
import { jobContext } from '../backend/src/extraction/learning/job-context';
import { withModelSlot } from '../backend/src/services/extraction/model-slots';
import type { ExtractionSnapshot } from '../backend/src/extraction/learning/snapshot';
export async function verifyPackageD(projectId:string,snapshot:ExtractionSnapshot) {
  process.env.EXTRACTION_WORKER_DISABLED='1';
  const sql=getSql(),bytes=Buffer.from('persisted source');
  const original={filename:'source.txt',base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};
  const run=await createBatchRun(projectId,['a.txt','b.txt'],undefined,{originals:[original,original],snapshot});
  const owners=await Promise.all([claimJob(),claimJob()]); assert.equal(owners.filter(Boolean).length,1);
  const first=owners.find(Boolean)!; assert(await renewJob(run.runId,first.token));
  await recoverStaleRuns();
  assert.equal((await getBatchRunFileDetail(projectId,run.runId,run.files[0]!.id))!.status,'pending');
  await jobContext.run({runId:run.runId,token:first.token},()=>upsertFileResult(projectId,run.runId,run.files[0]!.id,{status:'completed',data:{number:'human checked'},reviewStatus:'reviewed'}));
  await sql`UPDATE extraction.jobs SET lease_until=now()-interval '1 second' WHERE run_id=${run.runId}`;
  assert.equal(await renewJob(run.runId,first.token),false);
  const second=await claimJob(); assert(second); assert.notEqual(second.token,first.token);
  await assert.rejects(()=>jobContext.run({runId:run.runId,token:first.token},()=>upsertFileResult(projectId,run.runId,run.files[0]!.id,{status:'completed',data:{number:'stale'}})),/Lease/);
  assert.equal(await cancelBatch('wrong-project',run.runId),false);
  await sql`UPDATE extraction.jobs SET lease_until=now()-interval '1 second' WHERE run_id=${run.runId}`;
  let processed=0;
  await processOneJob(async(project,runId,files)=>{
    assert.equal(files.length,1); assert.equal(files[0]!.fileId,run.files[1]!.id);
    assert.equal((await readFile(files[0]!.tempPath)).toString(),bytes.toString()); processed++;
    await upsertFileResult(project,runId,files[0]!.fileId,{status:'completed',data:{number:'recovered'}});
  });
  assert.equal(processed,1);
  assert.equal((await getBatchRunFileDetail(projectId,run.runId,run.files[0]!.id))!.data!.number,'human checked');
  assert.equal(await processOneJob(async()=>{throw new Error('must not rerun');}),false);
  const cancelled=await createBatchRun(projectId,['c.txt'],undefined,{originals:[original],snapshot});
  const owner=await claimJob(); assert(owner);
  assert(await cancelBatch(projectId,cancelled.runId));
  await assert.rejects(()=>jobContext.run({runId:cancelled.runId,token:owner.token},()=>upsertFileResult(projectId,cancelled.runId,cancelled.files[0]!.id,{status:'completed',data:{number:'late'}})),/Lease/);
  assert(await retryBatch(projectId,cancelled.runId));
  assert.equal((await sql`SELECT generation FROM extraction.jobs WHERE run_id=${cancelled.runId}`)[0]!.generation,1);
  assert.equal((await getBatchRunFileDetail(projectId,cancelled.runId,cancelled.files[0]!.id))!.status,'pending');
  await cancelBatch(projectId,cancelled.runId);
  let active=0,peak=0;
  await Promise.all(Array.from({length:7},()=>withModelSlot('test/model',2,async()=>{active++;peak=Math.max(active,peak);await new Promise(r=>setTimeout(r,10));active--;})));
  assert.equal(peak,2); assert.equal((await sql`SELECT * FROM extraction.model_slots`).length,0);
  console.log('PASS Paket D: exclusive claims, expired lease takeover, stale result fencing, persisted originals, selective recovery, cancellation, retry and shared model slots.');
}
