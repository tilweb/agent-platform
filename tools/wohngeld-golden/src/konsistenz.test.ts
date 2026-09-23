/**
 * Konsistenz des Datensatzes: prüft an den erzeugten DIGITALEN PDFs, dass die
 * Erwartungsdatei zur tatsächlichen PDF passt (Seitenzahl, Namen und Beträge auf
 * den angegebenen Seiten, gewollte Widersprüche wirklich vorhanden).
 * Voraussetzung: `bun run src/cli.ts` wurde ausgeführt (sonst werden Fälle übersprungen).
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { FAELLE } from './faelle';
import { antragsWerte } from './formulare/antrag';
import { winAnsi } from './formulare/pdfform';
import { OUT, ROOT, eur } from './lib';

async function seitenText(pdf: string, von: number, bis: number): Promise<string> {
  const p = Bun.spawn(['pdftotext', '-layout', '-f', String(von), '-l', String(bis), pdf, '-'], { stdout: 'pipe' });
  return (await new Response(p.stdout).text()).replace(/\s+/g, ' ');
}

for (const fall of FAELLE) {
  const pdf = join(OUT, fall.id, `${fall.id}-digital.pdf`);
  const expPfad = join(ROOT, 'expected', `${fall.id}.expected.json`);

  describe(fall.id, async () => {
    const vorhanden = (await Bun.file(pdf).exists()) && (await Bun.file(expPfad).exists());
    const erw = vorhanden ? await Bun.file(expPfad).json() : null;

    test.skipIf(!vorhanden)('Seitenzahl und lückenlose Seitenbereiche', async () => {
      const info = Bun.spawn(['pdfinfo', pdf], { stdout: 'pipe' });
      const seiten = Number((await new Response(info.stdout).text()).match(/Pages:\s+(\d+)/)![1]);
      expect(erw.seiten).toBe(seiten);
      let naechste = 1;
      for (const d of erw.dokumente) {
        expect(d.seiteVon).toBe(naechste);
        expect(d.seiteBis).toBeGreaterThanOrEqual(d.seiteVon);
        naechste = d.seiteBis + 1;
      }
      expect(naechste - 1).toBe(seiten);
    });

    test.skipIf(!vorhanden)('Personenbezogene Dokumente nennen die Person', async () => {
      for (const d of erw.dokumente) {
        if (!d.person || d.art === 'antrag' && d.stoerungen) continue;
        const p = fall.personen.find((x) => x.id === d.person)!;
        // Vergleich ohne Diakritika: das getippte Formular ersetzt Sonderzeichen (ś→s, ş→s).
        const glatt = (x: string) => winAnsi(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const text = glatt(await seitenText(pdf, d.seiteVon, d.seiteBis));
        expect(text).toContain(glatt(p.nachname));
      }
    });

    test.skipIf(!vorhanden)('Mietbeträge stehen dort, wo die Erwartung sie verortet', async () => {
      const w = fall.wohnung;
      const gesamtAktuell = eur(w.grundmiete + w.nebenkosten + w.heizkosten + w.warmwasser);
      for (const d of erw.dokumente) {
        const text = await seitenText(pdf, d.seiteVon, d.seiteBis);
        if (d.art === 'vermieterbescheinigung') expect(text).toContain(gesamtAktuell);
        if (d.art === 'kontoauszug' && d.erwartet?.analyse?.mietzahlung_erkannt) expect(text).toContain(gesamtAktuell);
        const mieteImAntrag = !fall.antrag?.leer?.includes('gesamtmiete') && fall.antrag?.status !== 'heim';
        if (d.art === 'antrag' && !d.stoerungen?.length && mieteImAntrag && !fall.antrag?.handschrift) expect(text).toContain(eur(antragsWerte(fall).gesamtmiete));
      }
    });

    test.skipIf(!vorhanden)('Unterschriftslage des Antrags entspricht der Erwartung', () => {
      const antrag = erw.dokumente.find((d: { art: string }) => d.art === 'antrag');
      expect(antrag.erwartet.analyse.unterschrift_vorhanden).toBe(fall.unterschrift.antrag);
      expect(antrag.erwartet.analyse.datum_vorhanden).toBe(fall.unterschrift.antragDatum);
    });

    test.skipIf(!vorhanden)('Gewollte Miet-Widersprüche sind in der Erwartung sichtbar', () => {
      const antrag = erw.dokumente.find((d: { art: string }) => d.art === 'antrag');
      const vb = erw.dokumente.find((d: { art: string }) => d.art === 'vermieterbescheinigung');
      if (!antrag || !vb) return;
      const aMiete = antrag.erwartet.stammdaten['wohnung.miete'];
      const vMiete = vb.erwartet.analyse.miete;
      const widerspruch = erw.pruefung.befunde.includes('plausi-miethoehe-abweichung');
      if (aMiete === null) return; // Seite fehlt — nicht vergleichbar
      expect(aMiete !== vMiete).toBe(widerspruch);
    });
  });
}
