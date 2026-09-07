import { test, expect, spyOn } from 'bun:test';
import { WorkQueue, prepared, withDocumentRuntime, positiveLimit } from './runtime';
import { withTimeoutRetry } from './extract-call';
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('shared queue bounds concurrency across independent document producers and recovers after errors', async()=> {
  const queue=new WorkQueue(2); let active=0,peak=0,finished=0;
  const results=await Promise.allSettled(Array.from({length:20},(_,i)=>queue.run(async()=>{
    active++; peak=Math.max(peak,active); await pause(2); active--; finished++;
    if(i===3) throw new Error('provider failed'); return i;
  })));
  expect(peak).toBe(2); expect(finished).toBe(20); expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
});
test('interactive work takes the next available slot ahead of pending evaluation',async()=>{
  const queue=new WorkQueue(1),order:string[]=[];
  let release!:()=>void;
  const first=queue.run(()=>new Promise<void>(resolve=>{release=resolve;})); await pause(0);
  const evalRun=queue.run(async()=>{order.push('evaluation');},'evaluation');
  const review=queue.run(async()=>{order.push('interactive');},'interactive');
  release(); await Promise.all([first,evalRun,review]); expect(order).toEqual(['interactive','evaluation']);
});
test('preparation coalesces identical concurrent work but keeps source bytes and resolution separate',async()=>{
  let calls=0; const bytes=Buffer.from('source');
  const work=()=>prepared('render',bytes,{dpi:200},async()=>{calls++;await pause(2);return {page:'same'};});
  const result=await withDocumentRuntime(async()=>{
    const [a,b]=await Promise.all([work(),work()]); expect(a).toBe(b);
    await prepared('render',bytes,{dpi:300},async()=>{calls++;return {};});
    await prepared('render',Buffer.from('other'),{dpi:200},async()=>{calls++;return {};});
  });
  expect(calls).toBe(3); expect(result.metrics.preparationHits).toBe(1);
  await withDocumentRuntime(work); expect(calls).toBe(4);
});
test('failed preparation is not cached and queue limits reject invalid environment values',async()=>{
  await withDocumentRuntime(async()=>{
    const bytes=Buffer.from('bad');
    await expect(prepared('x',bytes,null,async()=>{throw new Error('broken');})).rejects.toThrow('broken');
    expect(await prepared('x',bytes,null,async()=>42)).toBe(42);
  });
  for(const input of ['0','-1','NaN','Infinity','1.5','999']) expect(positiveLimit(input,3)).toBe(3);
});
test('queued provider timeout excludes waiting and only retries actual failures',async()=>{
  const queue=new WorkQueue(1); let calls=0;
  const block=queue.run(async()=>{await pause(15);});
  const run=withTimeoutRetry(()=>queue.run(async()=>{calls++;return 'ok';}),{timeoutMs:2,retries:1,queued:true});
  expect(await run).toBe('ok'); await block; expect(calls).toBe(1);
  let attempts=0;
  expect(await withTimeoutRetry(async()=>{if(++attempts===1)throw new Error('transient');return 4;},{timeoutMs:50,retries:1})).toBe(4);
});

test('actual provider retries and usage are captured; missing token reports remain unknown',async()=>{
  const { OpenAIAdapter }=await import('../llm/adapters/openai');
  let attempts=0;
  const fetch=spyOn(globalThis,'fetch').mockImplementation((async()=>{
    if(++attempts===1) throw new DOMException('simulated timeout','TimeoutError');
    return new Response(JSON.stringify({choices:[{message:{content:'{}'},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:4}}),{status:200});
  }) as unknown as typeof globalThis.fetch);
  try {
    const adapter=new OpenAIAdapter({baseUrl:'https://unused.invalid',apiKey:null,defaultModel:'test'});
    const result=await withDocumentRuntime(()=>adapter.chat([{role:'user',content:'test'}]));
    expect(result.metrics.providerAttempts).toBe(2); expect(result.metrics.inputTokens).toBe(12);
    expect(result.metrics.tokenReports).toBe(1);
    expect((await withDocumentRuntime(async()=>{})).metrics.inputTokens).toBeNull();
  } finally { fetch.mockRestore(); }
});
