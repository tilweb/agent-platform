/**
 * Ende-zu-Ende-Pruefung Eingangsmodell (Konzept DP-Produktmodell): Upload anlegen →
 * processInboxUpload → Batch-Lauf (Worker des laufenden Backends) → Umschlag.
 * Echte Modellaufrufe. Fälle als JSON-Liste: [{ name, datei, modus?, profil?, erwartet }].
 *
 *   bun run scripts/dp-eingang/e2e.ts <faelle.json>
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createUpload, processInboxUpload, ladeUmschlag } from '../../src/extraction/inbox';
import { claimUmschlagZustellung, getUpload } from '../../src/extraction/inbox/store';

interface Fall {
  name: string; datei: string; modus?: 'vorgang' | 'stapel'; profil?: string;
  erwartet: { teile: number; profil: string; status: string[]; produkt: string; seiten: number; vertrag?: boolean; volltext?: boolean; vorgegeben?: boolean };
}
const faelle = await Bun.file(process.argv[2]!).json() as Fall[];
let ok = true;
const pruefe = (fall: string, was: string, b: boolean, ist?: unknown) => {
  if (!b) ok = false;
  console.log(`${b ? '✓' : '✗'} [${fall}] ${was}${b ? '' : ` — ist ${JSON.stringify(ist).slice(0, 220)}`}`);
};

const laufend = await Promise.all(faelle.map(async (f) => {
  const dir = `/tmp/dp-eingang-e2e/${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, basename(f.datei));
  await copyFile(f.datei, tmp);
  const modus = f.modus ?? 'vorgang';
  const u = await createUpload({ filename: `E2E ${f.name}.pdf`, mimeType: 'application/pdf', modus, profilId: f.profil ?? null, quelle: 'api' });
  await processInboxUpload(u.id, tmp, { filename: `E2E ${f.name}.pdf`, mimeType: 'application/pdf' }, undefined, { modus, profilId: f.profil ?? null });
  return { f, id: u.id };
}));

const start = Date.now();
for (const { f, id } of laufend) {
  let u = await ladeUmschlag(id);
  while (u && u.status === 'verarbeitung' && Date.now() - start < 20 * 60_000) {
    await Bun.sleep(5000);
    u = await ladeUmschlag(id);
  }
  const e = f.erwartet;
  console.log(`\n== ${f.name}: ${u?.status} nach ${((Date.now() - start) / 1000).toFixed(0)} s`);
  pruefe(f.name, 'Umschlag fertig', u?.status === 'fertig', u?.status);
  pruefe(f.name, `${e.teile} Teil(e)`, u?.teile.length === e.teile, u?.teile.map((t) => t.seiten));
  const t = u?.teile[0];
  pruefe(f.name, `Pipeline ${e.profil}`, t?.profil === e.profil, t?.profil);
  pruefe(f.name, `Status ${e.status.join('|')}`, !!t && e.status.includes(t.status), t?.status);
  if (e.vorgegeben !== undefined) pruefe(f.name, 'Pipeline vorgegeben', t?.zuordnung.vorgegeben === e.vorgegeben, t?.zuordnung);
  if (e.vertrag) pruefe(f.name, 'Vertragsauswertung im Ergebnis', !!t?.ergebnis?.vertrag?.klauseln.length, Object.keys(t?.ergebnis ?? {}));
  if (e.volltext) pruefe(f.name, 'Volltext im Ergebnis', (t?.ergebnis?.volltext?.seiten.length ?? 0) === e.seiten, t?.ergebnis?.volltext?.seiten.length);
  if (e.volltext) pruefe(f.name, 'Kernwert Dokumentart', !!(t?.ergebnis?.data as Record<string, unknown> | undefined)?.dokumentart, t?.ergebnis?.data);
  pruefe(f.name, `Abrechnung ${e.produkt} × ${e.seiten}`, u?.abrechnung.some((a) => a.produkt === e.produkt && a.seiten === e.seiten) === true, u?.abrechnung);
  pruefe(f.name, 'Verbrauch gemessen (Aufrufe)', (u?.verbrauch.aufrufe ?? 0) > 0, u?.verbrauch);
  pruefe(f.name, 'Tokens gemeldet', (u?.verbrauch.prompt_tokens ?? 0) > 0, u?.verbrauch);
  const gespeichert = await getUpload(id);
  pruefe(f.name, 'Abrechnung am Upload gespeichert', JSON.stringify(gespeichert?.abrechnung) === JSON.stringify(u?.abrechnung), gespeichert?.abrechnung);
  console.log(`   Abrechnung ${JSON.stringify(u?.abrechnung)} · Verbrauch ${JSON.stringify(u?.verbrauch)}`);
}

// Zustellung genau einmal: zweiter Anspruch scheitert.
const erster = laufend[0]!.id;
pruefe('Webhook', 'erste Beanspruchung gelingt', await claimUmschlagZustellung(erster));
pruefe('Webhook', 'zweite Beanspruchung scheitert', !(await claimUmschlagZustellung(erster)));
console.log(`\n${ok ? 'ALLE PRÜFUNGEN BESTANDEN' : 'FEHLER'}`);
process.exit(ok ? 0 : 1);
