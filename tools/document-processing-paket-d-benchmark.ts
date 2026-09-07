/** Local preparation benchmark only: synthetic PDF, no document data or model requests. */
import { renderPdfToImages, registerPdfView } from '../backend/src/services/extraction/pdf';
import { withDocumentRuntime } from '../backend/src/services/extraction/runtime';
import assert from 'node:assert/strict';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 160] /Resources << >> >>'];
let source='%PDF-1.4\n'; const offsets:number[]=[];
objects.forEach((object,index)=>{offsets.push(source.length);source+=`${index+1} 0 obj\n${object}\nendobj\n`;});
const xref=source.length; source+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const bytes=Buffer.from(source),baseline:number[]=[],shared:number[]=[];
await renderPdfToImages(bytes,{dpi:200,maxPages:2});
for(let trial=0;trial<12;trial++) {
  let start=performance.now();
  const first=await renderPdfToImages(bytes,{dpi:200,maxPages:2});
  const second=await renderPdfToImages(bytes,{dpi:200,maxPages:2});
  baseline.push(performance.now()-start);
  start=performance.now();
  const result=await withDocumentRuntime(async()=>{
    const a=await renderPdfToImages(bytes,{dpi:200,maxPages:2});
    const b=await renderPdfToImages(bytes,{dpi:200,maxPages:2});
    assert.equal(a,b); assert.deepEqual(b,second);
    const view=Buffer.from('view-'+trial); registerPdfView(view,bytes,2,2,2);
    const pages=await renderPdfToImages(view,{dpi:200,maxPages:1});
    assert.equal(pages.length,1); assert.equal(pages[0]!.pageNumber,1);
    assert.deepEqual(pages[0]!.pngBuffer,first[1]!.pngBuffer);
    assert.equal(pages[0]!.width,first[1]!.width); assert.equal(pages[0]!.height,first[1]!.height);
  });
  shared.push(performance.now()-start); assert.equal(result.metrics.preparationHits,2);
}
const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
console.log(JSON.stringify({scope:'Two-page synthetic PDF; repeated 200 dpi preparation, not end-to-end model latency',trials:12,
 baseline:{p50:percentile(baseline,.5),p95:percentile(baseline,.95)},shared:{p50:percentile(shared,.5),p95:percentile(shared,.95)},pixelEquality:true},null,2));
