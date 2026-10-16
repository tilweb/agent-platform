import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bildGeaendert, leseSignaturen, parsePgm, wortDifferenz } from './signatur-deckung';

test('wortDifferenz: zusaetzliche Woerter in Reihenfolge, Mehrfachvorkommen gezaehlt', () => {
  expect(wortDifferenz('Vertrag zwischen A und B', 'Anlage 2 Vertrag zwischen A und B')).toEqual(['Anlage', '2']);
  expect(wortDifferenz('a b a', 'a b a a')).toEqual(['a']);
  expect(wortDifferenz('x', 'x')).toEqual([]);
});

function pgm(w: number, h: number, fill: (i: number) => number): Buffer {
  const px = Buffer.alloc(w * h);
  for (let i = 0; i < px.length; i++) px[i] = fill(i);
  return Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`, 'latin1'), px]);
}

test('parsePgm und bildGeaendert', () => {
  const weiss = pgm(20, 20, () => 255);
  expect(parsePgm(weiss)).toMatchObject({ w: 20, h: 20 });
  expect(bildGeaendert(weiss, pgm(20, 20, () => 255))).toBe(false);
  expect(bildGeaendert(weiss, pgm(20, 20, (i) => (i < 5 ? 0 : 255)))).toBe(false); // Rauschen unter Mindestzahl
  expect(bildGeaendert(weiss, pgm(20, 20, (i) => (i < 40 ? 0 : 255)))).toBe(true);
  expect(bildGeaendert(weiss, pgm(21, 20, () => 255))).toBe(true);
});

// ---------- Integration mit synthetisch signierten PDFs (pdfsig + certutil, sonst uebersprungen) ----------

function verfuegbar(cmd: string): boolean {
  try { return Bun.spawnSync([cmd, '-v'], { stdout: 'ignore', stderr: 'ignore' }).exitCode !== undefined; } catch { return false; }
}
const WERKZEUGE = verfuegbar('pdfsig') && verfuegbar('certutil') && verfuegbar('pdftoppm');

function minimalPdf(zeilen: string[]): Buffer {
  const inhalt = zeilen.map((z, i) => `BT /F1 14 Tf 72 ${700 - i * 30} Td (${z}) Tj ET`).join('\n');
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`,
  ];
  let out = '%PDF-1.7\n';
  const offs: number[] = [];
  objekte.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Inkrementelles Update: zusaetzlicher Inhaltsstrom auf Seite 1 (wie eine nachtraegliche Ergaenzung). */
function nachtrag(pdf: Buffer, inhalt: string): Buffer {
  const text = pdf.toString('latin1');
  const size = Number([...text.matchAll(/\/Size\s+(\d+)/g)].pop()![1]);
  const prev = Number([...text.matchAll(/startxref\s+(\d+)/g)].pop()![1]);
  const seite = [...text.matchAll(/\n3 0 obj\s*([\s\S]*?)\s*endobj/g)].pop()![1]!;
  const neueSeite = seite.replace(/\/Contents\s+(\d+ 0 R|\[[^\]]*\])/, (_m, c: string) => `/Contents [${c.replace(/[[\]]/g, '')} ${size} 0 R]`);
  let add = '\n';
  const offStrom = pdf.length + add.length;
  add += `${size} 0 obj\n<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream\nendobj\n`;
  const offSeite = pdf.length + add.length;
  add += `3 0 obj\n${neueSeite}\nendobj\n`;
  const xref = pdf.length + add.length;
  add += `xref\n0 1\n0000000000 65535 f \n3 1\n${String(offSeite).padStart(10, '0')} 00000 n \n${size} 1\n${String(offStrom).padStart(10, '0')} 00000 n \n`;
  add += `trailer\n<< /Size ${size + 1} /Root 1 0 R /Prev ${prev} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.concat([pdf, Buffer.from(add, 'latin1')]);
}

describe.skipIf(!WERKZEUGE)('leseSignaturen mit synthetischen PDFs', () => {
  let dir = '';
  const signiere = async (pdf: Buffer, feld: string): Promise<Buffer> => {
    const ein = join(dir, `${feld}-ein.pdf`);
    const aus = join(dir, `${feld}-aus.pdf`);
    await Bun.write(ein, pdf);
    const p = Bun.spawnSync(['pdfsig', '-nssdir', `sql:${dir}/nss`, '-nick', 'test', '-add-signature', '-new-signature-field-name', feld, ein, aus], { stdout: 'pipe', stderr: 'pipe' });
    if (p.exitCode !== 0) throw new Error(`pdfsig -add-signature: ${p.stderr.toString()}`);
    return Buffer.from(await Bun.file(aus).arrayBuffer());
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dp-sigtest-'));
    await Bun.$`mkdir -p ${dir}/nss`.quiet();
    await Bun.write(join(dir, 'rauschen'), crypto.getRandomValues(new Uint8Array(64)));
    await Bun.$`certutil -N -d sql:${dir}/nss --empty-password`.quiet();
    await Bun.$`certutil -S -x -n test -s ${'CN=Erika Mustermann,O=Test GmbH'} -t CT,C,C -k rsa -g 2048 -d sql:${dir}/nss -z ${join(dir, 'rauschen')} -v 12 --keyUsage digitalSignature,nonRepudiation`.quiet();
  });
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  const basis = () => minimalPdf(['Vertrag zwischen A und B', 'Unterschrift A', 'Unterschrift B']);

  test('ohne Signatur: leer, ohne Prozessstart', async () => {
    expect(await leseSignaturen(basis())).toEqual([]);
  });

  test('einmal signiert: vollstaendig, Name aus Zertifikat, intakt', async () => {
    const [s] = await leseSignaturen(await signiere(basis(), 'SigA'));
    expect(s).toMatchObject({ feld: 'SigA', unterzeichner: 'Erika Mustermann', art: 'pkcs7', integritaet: 'intakt', deckung: 'vollstaendig' });
  });

  test('nacheinander signiert: erste Signatur „spaetere_signatur", zweite vollstaendig', async () => {
    const r = await leseSignaturen(await signiere(await signiere(basis(), 'SigA'), 'SigB'));
    expect(r.map((s) => [s.feld, s.deckung])).toEqual([['SigA', 'spaetere_signatur'], ['SigB', 'vollstaendig']]);
  });

  test('nach der Signatur Text ergaenzt: geaendert mit Beispielwoertern', async () => {
    const pdf = nachtrag(await signiere(basis(), 'SigA'), 'BT /F1 14 Tf 72 400 Td (Nachtrag Preis 999) Tj ET');
    const [s] = await leseSignaturen(pdf);
    expect(s!.deckung).toBe('geaendert');
    expect(s!.aenderung).toMatchObject({ seiten: [1], art: ['text'] });
    expect(s!.aenderung!.hinzu).toContain('Nachtrag');
  });

  test('nach der Signatur nur grafisch geaendert: sichtbar', async () => {
    const pdf = nachtrag(await signiere(basis(), 'SigA'), '0 g 72 450 220 60 re f');
    const [s] = await leseSignaturen(pdf);
    expect(s!.deckung).toBe('geaendert');
    expect(s!.aenderung).toMatchObject({ seiten: [1], art: ['sichtbar'] });
  });
});
