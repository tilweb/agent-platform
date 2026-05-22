/**
 * Zweite Probe: nur FileDownload-Varianten gegen Doc 10842 testen, um
 * herauszufinden welcher Query-Param das Original-PDF (statt ZIP) liefert.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerProviders } from '../../backend/src/connections/providers';
import { connectionRegistry } from '../../backend/src/connections/registry';
import { getDocumentUrl, getDocumentFileDownloadUrl } from '../../backend/src/connections/providers/docuware/config';

const USER_ID = 'user_1777818915819_snl28hv';
const CABINET_ID = 'db14ce26-5522-4a20-9ccd-c13f1bde9919';
const DOC_ID = '10842';
const OUTPUT_DIR = resolve(import.meta.dir, 'output');

async function tryUrl(label: string, url: string, accessToken: string, accept: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: accept },
  });
  const ct = res.headers.get('content-type') || '';
  console.log(`${label.padEnd(40)} -> ${res.status} ${ct}`);
  if (res.ok) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = ct.includes('pdf') ? 'pdf' : ct.includes('zip') ? 'zip' : 'bin';
    const safe = label.replace(/[^a-z0-9_-]/gi, '_');
    const out = resolve(OUTPUT_DIR, `${safe}.${ext}`);
    await writeFile(out, bytes);
    console.log(`  saved ${bytes.byteLength} bytes -> ${out}`);
  } else {
    const text = await res.text().catch(() => '');
    console.log(`  error: ${text.slice(0, 200)}`);
  }
}

async function main() {
  registerProviders();
  const tokens = await connectionRegistry.getTokens(USER_ID, 'docuware');
  if (!tokens) throw new Error('no tokens');

  const docUrl = getDocumentUrl(tokens.apiDomain, CABINET_ID, DOC_ID);
  const fdUrl = getDocumentFileDownloadUrl(tokens.apiDomain, CABINET_ID, DOC_ID);

  console.log(`\n--- FileDownload variants (Doc ${DOC_ID}) ---\n`);

  await tryUrl('default', fdUrl, tokens.accessToken, 'application/pdf');
  await tryUrl('keepAnnotations=false', `${fdUrl}?keepAnnotations=false`, tokens.accessToken, 'application/pdf');
  await tryUrl('targetFileType=PDF', `${fdUrl}?targetFileType=PDF`, tokens.accessToken, 'application/pdf');
  await tryUrl('targetFileType=Auto', `${fdUrl}?targetFileType=Auto`, tokens.accessToken, 'application/pdf');
  await tryUrl('targetFileType=PDF+keepAnnotations=false', `${fdUrl}?targetFileType=PDF&keepAnnotations=false`, tokens.accessToken, 'application/pdf');

  console.log(`\n--- Alternativen am Doc-URL ---\n`);
  await tryUrl('Doc/Pdf', `${docUrl}/Pdf`, tokens.accessToken, 'application/pdf');
  await tryUrl('Doc/Download', `${docUrl}/Download`, tokens.accessToken, 'application/pdf');
  await tryUrl('Doc?format=PDF', `${docUrl}?format=PDF`, tokens.accessToken, 'application/pdf');

  console.log(`\nDone.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
