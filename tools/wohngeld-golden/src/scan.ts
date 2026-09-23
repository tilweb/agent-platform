/**
 * Scan-Variante: jede Seite wird mit leichten Scanner-Artefakten versehen
 * (Staubpunkte, blasser Einzugsstreifen), in Graustufen gerastert (200 dpi,
 * JPEG) und leicht schief (0,3–1,5°) auf eine hellgraue „Scannerfläche" gelegt.
 * Ergebnis: keine Textebene — die App muss OCR/Vision nutzen, wie bei Briefpost.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, degrees, grayscale } from 'pdf-lib';
import { rng, zwischen } from './lib';

const DPI = 200;

export async function scanne(pdf: Uint8Array, seed: string): Promise<Uint8Array> {
  const r = rng(`scan:${seed}`);
  const doc = await PDFDocument.load(pdf);

  // 1. Artefakte direkt auf die Seiten (werden mitgerastert)
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const punkte = 60 + Math.floor(r() * 140);
    for (let i = 0; i < punkte; i++) {
      page.drawCircle({
        x: r() * width, y: r() * height, size: zwischen(r, 0.15, 0.55),
        color: grayscale(zwischen(r, 0.15, 0.55)), opacity: zwischen(r, 0.35, 0.9),
      });
    }
    if (r() < 0.5) {
      const x = r() * width;
      page.drawRectangle({ x, y: 0, width: zwischen(r, 0.4, 1.2), height, color: grayscale(0.4), opacity: 0.07 });
    }
  }
  const mitArtefakten = await doc.save();

  // 2. Rastern (Graustufen-JPEG)
  const dir = await mkdtemp(join(tmpdir(), 'wg-scan-'));
  try {
    const src = join(dir, 'src.pdf');
    await Bun.write(src, mitArtefakten);
    const proc = Bun.spawn(['pdftocairo', '-jpeg', '-jpegopt', 'quality=60', '-gray', '-r', String(DPI), src, join(dir, 'p')], { stdout: 'pipe', stderr: 'pipe' });
    if ((await proc.exited) !== 0) throw new Error(`pdftocairo: ${await new Response(proc.stderr).text()}`);
    const bilder = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort((a, b) => Number(a.match(/(\d+)\.jpg$/)![1]) - Number(b.match(/(\d+)\.jpg$/)![1]));

    // 3. Neu zusammensetzen, leicht schief auf grauem Grund
    const out = await PDFDocument.create();
    for (const f of bilder) {
      const img = await out.embedJpg(await Bun.file(join(dir, f)).arrayBuffer());
      const w = (img.width * 72) / DPI;
      const h = (img.height * 72) / DPI;
      const page = out.addPage([w, h]);
      page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: grayscale(0.86) });
      const winkel = zwischen(r, 0.3, 1.5) * (r() < 0.5 ? -1 : 1);
      const rad = (winkel * Math.PI) / 180;
      // Drehung um den Seitenmittelpunkt: Ursprung so verschieben, dass die Mitte bleibt.
      const cx = w / 2, cy = h / 2;
      const x = cx - (cx * Math.cos(rad) - cy * Math.sin(rad)) + zwischen(r, -4, 4);
      const y = cy - (cx * Math.sin(rad) + cy * Math.cos(rad)) + zwischen(r, -4, 4);
      page.drawImage(img, { x, y, width: w, height: h, rotate: degrees(winkel) });
    }
    out.setTitle('Scan');
    out.setProducer('Scanner (synthetisch, wohngeld-golden)');
    out.setSubject('SYNTHETISCH — Testdaten Wohngeld Golden Dataset, keine echten Personen');
    return await out.save();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
