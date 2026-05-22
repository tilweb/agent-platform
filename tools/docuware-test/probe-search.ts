/**
 * Probe: welche Such-Mechanismen unterstuetzt der Adacor-DocuWare-Tenant?
 *
 * Checks:
 *   1. Fields-Endpoint am Cabinet (Index-Feld-Liste)
 *   2. SearchDialogs-Liste am Cabinet
 *   3. Dialog-Details (welche Felder hat der Dialog?)
 *   4. Query-String-Filter (`?q=...`) mit verschiedenen Syntaxen
 *   5. POST Dialog-Query (strukturierte Suche)
 *
 * Aufruf:
 *   cd backend && /Users/andreasbachmann/.bun/bin/bun run ../tools/docuware-test/probe-search.ts
 *
 * Optional: CABINET=Vertragswesen (default) | RV - Buchhaltung | <Name oder UUID>
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { registerProviders } from '../../backend/src/connections/providers';
import { connectionRegistry } from '../../backend/src/connections/registry';
import {
  getFileCabinetsUrl,
  getDocumentsUrl,
  getDocuwareApiUrl,
} from '../../backend/src/connections/providers/docuware/config';

const USER_ID = 'user_1777818915819_snl28hv';
const CABINET_HINT = process.env.CABINET || 'Vertragswesen';
const OUTPUT_DIR = resolve(import.meta.dir, 'output');

async function authFetch(url: string, accessToken: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function summarizeBody(text: string, max = 600) {
  return text.length > max ? text.slice(0, max) + '...[truncated]' : text;
}

async function run(label: string, url: string, accessToken: string, method = 'GET', body?: unknown) {
  console.log(`\n--- ${label} ---`);
  console.log(`${method} ${url}`);
  const res = await authFetch(url, accessToken, method, body);
  const ct = res.headers.get('content-type') || '';
  console.log(`  -> ${res.status} ${ct}`);
  const text = await res.text();
  if (res.ok) {
    // Pretty-print JSON if applicable
    let pretty = text;
    if (ct.includes('json')) {
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}
    }
    const safe = label.replace(/[^a-z0-9_-]/gi, '_');
    const out = resolve(OUTPUT_DIR, `search-${safe}.json`);
    await writeFile(out, pretty);
    console.log(`  saved -> ${out}`);
    console.log(`  preview: ${summarizeBody(pretty, 400)}`);
  } else {
    console.log(`  error body: ${summarizeBody(text, 400)}`);
  }
  return { res, text };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  registerProviders();
  const tokens = await connectionRegistry.getTokens(USER_ID, 'docuware');
  if (!tokens) throw new Error('no tokens');

  // 1) Pick cabinet
  const cabsRes = await authFetch(getFileCabinetsUrl(tokens.apiDomain), tokens.accessToken);
  const cabs = ((await cabsRes.json()) as any).FileCabinet || [];
  const cab = cabs.find(
    (c: any) =>
      c.Id === CABINET_HINT ||
      c.Name?.toLowerCase() === CABINET_HINT.toLowerCase() ||
      c.Name?.toLowerCase().includes(CABINET_HINT.toLowerCase()),
  );
  if (!cab) {
    console.error(`Cabinet "${CABINET_HINT}" not found. Available:`);
    for (const c of cabs) console.error(`  - ${c.Name} (${c.Id}) basket=${c.IsBasket}`);
    process.exit(1);
  }
  console.log(`Using cabinet: ${cab.Name} (${cab.Id})`);

  const apiBase = getDocuwareApiUrl(tokens.apiDomain);
  const cabUrl = `${getFileCabinetsUrl(tokens.apiDomain)}/${cab.Id}`;
  const docsUrl = getDocumentsUrl(tokens.apiDomain, cab.Id);

  // 2) Fields endpoint
  await run('fields', `${cabUrl}/Fields`, tokens.accessToken);
  // Alternative pfad-variante: manche tenants nutzen den Cabinet-Plural-Index
  await run('cab_meta', cabUrl, tokens.accessToken);

  // 3) SearchDialogs
  const dialogsResult = await run('searchdialogs', `${cabUrl}/SearchDialogs`, tokens.accessToken);
  // Alternative
  await run('dialogs', `${cabUrl}/Dialogs`, tokens.accessToken);

  // 4) First Search-Dialog details (if any)
  let firstDialogId: string | undefined;
  try {
    const data = JSON.parse(dialogsResult.text);
    const list = data.Dialog || data.Dialogs || data.dialog || data.dialogs || [];
    if (Array.isArray(list) && list.length > 0) {
      firstDialogId = list[0].Id || list[0].id;
      console.log(`\nFound ${list.length} search dialog(s). Using first: ${firstDialogId}`);
    }
  } catch {}

  if (firstDialogId) {
    // Different URL shapes have been seen in DW docs
    await run('dialog_detail', `${apiBase}/Dialogs/${firstDialogId}`, tokens.accessToken);
    await run(
      'dialog_query_empty',
      `${apiBase}/Dialogs/${firstDialogId}/Query`,
      tokens.accessToken,
      'POST',
      { Condition: [], Operation: 'And' },
    );
  }

  // 5) Query-String-Filter via /Documents
  await run('docs_q_field_equals', `${docsUrl}?count=3&q=DOCUMENT_TITLE=Rechnung`, tokens.accessToken);
  await run('docs_q_wildcard', `${docsUrl}?count=3&q=DOCUMENT_TITLE=*Rechnung*`, tokens.accessToken);
  await run('docs_q_lowercase', `${docsUrl}?count=3&q=document_title=Rechnung`, tokens.accessToken);

  // 6) DialogExpression-Style search (older API)
  await run(
    'docs_query_dialogexpr',
    `${docsUrl}?count=3`,
    tokens.accessToken,
    'POST',
    {
      Condition: [{ DBName: 'DOCUMENT_TITLE', Value: ['Rechnung'] }],
      Operation: 'And',
    },
  );

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(99);
});
