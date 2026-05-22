/**
 * Docuware Endpoint Probe — fuehrt einen End-to-End-Roundtrip gegen die
 * echte DocuWare Platform-API durch (mit den Tokens des lokalen Users
 * `andreas_bachmann`) und legt die heruntergeladenen Binaries unter
 * tools/docuware-test/output/ ab.
 *
 * Zweck: vor dem App-Bau pruefen, ob die Image-/Thumbnail-/File-Endpoints
 * wirklich existieren und in welcher Variante (Doc-Level vs. Section-Level).
 *
 * Aufruf:
 *   /Users/andreasbachmann/.bun/bin/bun run tools/docuware-test/probe.ts
 *
 * Hinweis: Wird **nicht** ueber die HTTP-Routen geprueft (das wuerde eine
 * Session brauchen), sondern direkt ueber die connectionRegistry — also
 * gleiche Code-Pfade fuer Token-Refresh + API-Aufrufe wie die Backend-Routen.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerProviders } from '../../backend/src/connections/providers';
import { connectionRegistry } from '../../backend/src/connections/registry';
import {
  getFileCabinetsUrl,
  getDocumentsUrl,
  getDocumentUrl,
  getDocumentSectionsUrl,
  getDocumentThumbnailUrl,
  getDocumentPageImageUrl,
  getDocumentFileDownloadUrl,
} from '../../backend/src/connections/providers/docuware/config';

const USER_ID = 'user_1777818915819_snl28hv'; // andreas_bachmann
const OUTPUT_DIR = resolve(import.meta.dir, 'output');
const SEARCH_QUERY = (process.env.QUERY || '*').trim();

function log(label: string, value: unknown) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function authFetch(url: string, accessToken: string, accept = 'application/json') {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: accept },
  });
}

async function tryEndpoint(url: string, accessToken: string, accept: string) {
  const res = await authFetch(url, accessToken, accept);
  return {
    url,
    status: res.status,
    contentType: res.headers.get('content-type') || '',
    bytes: res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined,
    errorText: res.ok ? undefined : await res.text().catch(() => ''),
  };
}

async function main() {
  console.log('Initialising connection providers ...');
  registerProviders();

  console.log(`Loading tokens for user ${USER_ID} ...`);
  const tokens = await connectionRegistry.getTokens(USER_ID, 'docuware');
  if (!tokens) {
    console.error(
      'No Docuware connection for this user. Please connect locally via the UI first.',
    );
    process.exit(1);
  }
  console.log(`OK — apiDomain=${tokens.apiDomain}, hasRefresh=${!!tokens.refreshToken}`);

  // 1) List cabinets
  const cabinetsRes = await authFetch(getFileCabinetsUrl(tokens.apiDomain), tokens.accessToken);
  if (!cabinetsRes.ok) {
    console.error('FileCabinets list failed:', cabinetsRes.status, await cabinetsRes.text());
    process.exit(2);
  }
  const cabinetsData = (await cabinetsRes.json()) as any;
  const cabinets = (cabinetsData.FileCabinet || cabinetsData.fileCabinet || []) as any[];
  if (!cabinets.length) {
    console.error('No cabinets found for this user.');
    process.exit(3);
  }
  log(
    'Available cabinets',
    cabinets.map((c) => ({ id: c.Id, name: c.Name, isBasket: c.IsBasket })),
  );

  // Cabinet wahlweise via ENV CABINET_ID, sonst das erste Non-Basket (echter
  // Schrank, kein Briefkorb) — die haben in der Regel die echten Vertraege.
  const preferred =
    process.env.CABINET_ID ||
    cabinets.find((c) => !c.IsBasket)?.Id ||
    cabinets[0].Id;
  const cabinet = cabinets.find((c) => c.Id === preferred) || cabinets[0];
  console.log(`\nUsing cabinet: ${cabinet.Name} (${cabinet.Id})`);

  // 2) Suche / liste Documents
  const docsUrl = `${getDocumentsUrl(tokens.apiDomain, cabinet.Id)}?count=5${
    SEARCH_QUERY && SEARCH_QUERY !== '*'
      ? `&searchTerm=${encodeURIComponent(SEARCH_QUERY)}`
      : ''
  }`;
  console.log(`Documents URL: ${docsUrl}`);
  const docsRes = await authFetch(docsUrl, tokens.accessToken);
  if (!docsRes.ok) {
    console.error('Documents list failed:', docsRes.status, await docsRes.text());
    process.exit(4);
  }
  const docsData = (await docsRes.json()) as any;
  const items = (docsData.Items || docsData.items || []) as any[];
  if (!items.length) {
    console.error('No documents found in cabinet.');
    process.exit(5);
  }
  log(
    'First documents',
    items.slice(0, 5).map((d) => ({
      id: d.Id,
      title: d.Title,
      fileSize: d.FileSize,
      sectionCount: d.Sections?.length ?? d.SectionCount ?? '?',
    })),
  );

  const doc = items[0];
  const docId = String(doc.Id);
  console.log(`\nProbing document ${docId} ("${doc.Title}") ...`);

  // 3) Doc-Metadata
  const docMetaRes = await authFetch(
    getDocumentUrl(tokens.apiDomain, cabinet.Id, docId),
    tokens.accessToken,
  );
  console.log(`GET /Documents/${docId} — status: ${docMetaRes.status}`);

  // 4) Sections
  const sectionsRes = await authFetch(
    getDocumentSectionsUrl(tokens.apiDomain, cabinet.Id, docId),
    tokens.accessToken,
  );
  console.log(`GET /Documents/${docId}/Sections — status: ${sectionsRes.status}`);
  let firstSectionId: string | undefined;
  let pageCount = 0;
  if (sectionsRes.ok) {
    const sd = (await sectionsRes.json()) as any;
    const secs = sd.Section || sd.Sections || sd.section || sd.sections || [];
    log(
      'Sections',
      Array.isArray(secs)
        ? secs.map((s: any) => ({
            id: s.Id || s.id,
            name: s.OriginalFileName || s.Name || s.originalFileName,
            pages: s.PageCount ?? s.pageCount ?? s.Pages ?? s.pages,
            contentType: s.ContentType || s.contentType || s.MimeType || s.mimeType,
          }))
        : sd,
    );
    if (Array.isArray(secs) && secs.length > 0) {
      firstSectionId = secs[0].Id || secs[0].id;
      pageCount =
        secs[0].PageCount ??
        secs[0].pageCount ??
        secs[0].Pages ??
        secs[0].pages ??
        0;
    }
  } else {
    console.log('Sections error:', await sectionsRes.text());
  }

  // 5) Thumbnail — beide Varianten probieren
  console.log('\n--- Probing Thumbnail ---');
  const thumbCandidates = [
    {
      label: 'Doc-level',
      url: getDocumentThumbnailUrl(tokens.apiDomain, cabinet.Id, docId),
    },
    ...(firstSectionId
      ? [
          {
            label: `Section-level (${firstSectionId})`,
            url: getDocumentThumbnailUrl(tokens.apiDomain, cabinet.Id, docId, firstSectionId),
          },
        ]
      : []),
  ];
  for (const cand of thumbCandidates) {
    const r = await tryEndpoint(cand.url, tokens.accessToken, 'image/*');
    console.log(`  ${cand.label}: ${r.status} ${r.contentType}`);
    if (r.bytes && r.bytes.byteLength > 0) {
      const out = resolve(OUTPUT_DIR, `thumb-${cand.label.split(' ')[0]?.toLowerCase()}.bin`);
      await writeFile(out, r.bytes);
      console.log(`    saved ${r.bytes.byteLength} bytes -> ${out}`);
    } else if (r.errorText) {
      console.log(`    error body (first 200 chars): ${r.errorText.slice(0, 200)}`);
    }
  }

  // 6) Page-Image (page 1)
  console.log('\n--- Probing Page-Image (page=1) ---');
  const pageCandidates = [
    {
      label: 'Doc-level',
      url: getDocumentPageImageUrl(tokens.apiDomain, cabinet.Id, docId, 1),
    },
    ...(firstSectionId
      ? [
          {
            label: `Section-level (${firstSectionId})`,
            url: getDocumentPageImageUrl(tokens.apiDomain, cabinet.Id, docId, 1, firstSectionId),
          },
        ]
      : []),
  ];
  for (const cand of pageCandidates) {
    const r = await tryEndpoint(cand.url, tokens.accessToken, 'image/*');
    console.log(`  ${cand.label}: ${r.status} ${r.contentType}`);
    if (r.bytes && r.bytes.byteLength > 0) {
      const out = resolve(OUTPUT_DIR, `page1-${cand.label.split(' ')[0]?.toLowerCase()}.bin`);
      await writeFile(out, r.bytes);
      console.log(`    saved ${r.bytes.byteLength} bytes -> ${out}`);
    } else if (r.errorText) {
      console.log(`    error body (first 200 chars): ${r.errorText.slice(0, 200)}`);
    }
  }

  // 7) File-Download
  console.log('\n--- Probing FileDownload ---');
  const fileRes = await authFetch(
    getDocumentFileDownloadUrl(tokens.apiDomain, cabinet.Id, docId),
    tokens.accessToken,
    'application/octet-stream',
  );
  console.log(`  FileDownload: ${fileRes.status} ${fileRes.headers.get('content-type')}`);
  if (fileRes.ok) {
    const buf = new Uint8Array(await fileRes.arrayBuffer());
    const out = resolve(OUTPUT_DIR, 'file-download.bin');
    await writeFile(out, buf);
    console.log(`    saved ${buf.byteLength} bytes -> ${out}`);
  } else {
    const text = await fileRes.text().catch(() => '');
    console.log(`    error body (first 200 chars): ${text.slice(0, 200)}`);
  }

  console.log('\nDone. Files in tools/docuware-test/output/.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(99);
});
