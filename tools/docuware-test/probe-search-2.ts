/**
 * Probe Pass 2 — fokussiert auf Dialog-basierte Suche (das was Pass 1 als
 * funktionierenden Weg gezeigt hat).
 *
 * Liefert:
 *   - Liste der Suchdialoge eines Cabinets
 *   - Felder + Operatoren pro Dialog
 *   - Echte strukturierte Suche per DialogExpression
 *
 * Aufruf:
 *   cd backend && /Users/andreasbachmann/.bun/bin/bun run ../tools/docuware-test/probe-search-2.ts
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

async function jsonFetch(url: string, accessToken: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  let json: any = null;
  if (ct.includes('json')) {
    try { json = JSON.parse(text); } catch {}
  }
  return { ok: res.ok, status: res.status, text, json };
}

async function save(label: string, data: any) {
  const out = resolve(OUTPUT_DIR, `search2-${label}.json`);
  await writeFile(out, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log(`  saved -> ${out}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  registerProviders();
  const tokens = await connectionRegistry.getTokens(USER_ID, 'docuware');
  if (!tokens) throw new Error('no tokens');

  // 1) Pick cabinet
  const cabs = (await jsonFetch(getFileCabinetsUrl(tokens.apiDomain), tokens.accessToken)).json
    ?.FileCabinet || [];
  const cab = cabs.find(
    (c: any) =>
      c.Id === CABINET_HINT ||
      c.Name?.toLowerCase().includes(CABINET_HINT.toLowerCase()),
  );
  if (!cab) {
    console.error('Cabinet not found');
    process.exit(1);
  }
  console.log(`Cabinet: ${cab.Name} (${cab.Id})`);

  const apiBase = getDocuwareApiUrl(tokens.apiDomain);
  const docsUrl = getDocumentsUrl(tokens.apiDomain, cab.Id);
  const cabUrl = `${getFileCabinetsUrl(tokens.apiDomain)}/${cab.Id}`;

  // 2) Dialogs at cabinet
  const dialogs = await jsonFetch(`${cabUrl}/Dialogs`, tokens.accessToken);
  console.log(`\nDialogs response: ${dialogs.status}`);
  await save('dialogs-full', dialogs.text);
  const dialogList = (dialogs.json?.Dialog || []) as any[];
  console.log(`Found ${dialogList.length} dialog(s):`);
  for (const d of dialogList) {
    console.log(`  - ${d.DisplayName} (id=${d.Id}, type=${d.Type})`);
  }

  // 3) Look at the first "search" dialog
  const searchDialog =
    dialogList.find((d) => d.Type === 'Search') ||
    dialogList.find((d) => d.IsDefault) ||
    dialogList[0];
  if (!searchDialog) {
    console.log('No usable search dialog.');
    process.exit(2);
  }
  console.log(`\nUsing search dialog: ${searchDialog.DisplayName} (${searchDialog.Id})`);
  const dialogSelfLink = (searchDialog.Links || []).find((l: any) => l.rel === 'self')?.href;
  if (!dialogSelfLink) {
    console.log('No self-link on dialog.');
    process.exit(3);
  }
  const dialogDetailUrl = `${tokens.apiDomain}${dialogSelfLink}`;
  const dialogDetail = await jsonFetch(dialogDetailUrl, tokens.accessToken);
  console.log(`Dialog detail: ${dialogDetail.status}`);
  await save('dialog-detail', dialogDetail.text);

  // Felder auflisten
  const fields = (dialogDetail.json?.Fields?.Field || dialogDetail.json?.Fields || []) as any[];
  console.log(`Dialog hat ${fields.length} Feld(er):`);
  for (const f of fields) {
    console.log(`  - ${f.DBName} (${f.DlgLabel || f.Name}) type=${f.DWFieldType} maxLen=${f.Length ?? '?'}`);
  }

  // 4) DialogExpression suche: erstes textuelles Feld picken und eine Echtsuche probieren
  const sampleField = fields.find((f) => f.DWFieldType === 'Text' || f.DWFieldType === 'Memo');
  if (sampleField) {
    console.log(`\nSample-Suche: ${sampleField.DBName} startsWith "*"`);
    const searchPayload = {
      Count: 5,
      Condition: [
        {
          DBName: sampleField.DBName,
          Value: ['*'],
        },
      ],
      Operation: 'And',
    };

    // Variante A — POST direkt an /Documents (was in Probe 1 funktioniert hat)
    const resA = await jsonFetch(`${docsUrl}?count=5`, tokens.accessToken, 'POST', searchPayload);
    console.log(`A) POST /Documents -> ${resA.status}`);
    await save('search-A-post-documents', resA.text);
    if (resA.json?.Items) {
      console.log(`   ${resA.json.Items.length} Treffer; erstes Doc-ID=${resA.json.Items[0]?.Id}`);
    }

    // Variante B — POST mit DialogId-Pfad
    const queryLink = (searchDialog.Links || []).find((l: any) =>
      ['query', 'documents'].includes(l.rel),
    )?.href;
    if (queryLink) {
      const resB = await jsonFetch(
        `${tokens.apiDomain}${queryLink}`,
        tokens.accessToken,
        'POST',
        searchPayload,
      );
      console.log(`B) POST dialog-query (${queryLink}) -> ${resB.status}`);
      await save('search-B-dialog-query', resB.text);
      if (resB.json?.Items) {
        console.log(`   ${resB.json.Items.length} Treffer`);
      }
    } else {
      console.log('B) kein query-link am Dialog gefunden');
    }

    // Variante C — Suche auf konkreten Wert (falls Doc-Title bekannt)
    const concretePayload = {
      Count: 5,
      Condition: [
        { DBName: sampleField.DBName, Value: ['*Rechnung*'] },
      ],
      Operation: 'And',
    };
    const resC = await jsonFetch(`${docsUrl}?count=5`, tokens.accessToken, 'POST', concretePayload);
    console.log(`C) POST /Documents (wildcard Rechnung) -> ${resC.status} items=${resC.json?.Items?.length ?? '?'}`);
    await save('search-C-wildcard', resC.text);
  }

  // 5) Range-Suche auf einem Datumsfeld (falls vorhanden)
  const dateField = fields.find((f) => f.DWFieldType === 'Date');
  if (dateField) {
    console.log(`\nDate-Feld gefunden: ${dateField.DBName}`);
    const rangePayload = {
      Count: 5,
      Condition: [
        { DBName: dateField.DBName, Value: ['2024-01-01', '2026-12-31'] },
      ],
      Operation: 'And',
    };
    const resD = await jsonFetch(`${docsUrl}?count=5`, tokens.accessToken, 'POST', rangePayload);
    console.log(`D) POST /Documents (date range) -> ${resD.status} items=${resD.json?.Items?.length ?? '?'}`);
    await save('search-D-daterange', resD.text);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(99);
});
