/**
 * Digitale PDF-Signaturen (Signaturfelder) — stehen nicht im Seitenbild.
 *
 * Auslesen ueber `pdfsig` (poppler-utils, wie `pdftocairo`/`pdftotext` schon
 * Plattform-Abhaengigkeit): Feld, Unterzeichner (Zertifikats-CN), Zeit, Art,
 * signierte Byte-Bereiche, Integritaet. Immer `-nocert -no-ocsp` — KEINE
 * Zertifikats-/Vertrauenspruefung und kein Netzzugriff. Ob die Signatur rechtlich
 * gueltig ist, sagt DP nicht (Stufe 3, docs/dp-digitale-signaturen-2026-10-16.md).
 *
 * Fehlt `pdfsig` oder scheitert es, bleibt der Byte-Scan nach `/Type /Sig` als
 * Rueckfall (nur Zeitpunkt). Die Verarbeitung scheitert nie an der Signatur.
 */

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SeitenTranskript } from './types';

export type SignaturArt = 'pkcs7' | 'pades' | 'zeitstempel' | 'sonstige';

/**
 * vollstaendig       — deckt die ganze Datei ab
 * spaetere_signatur  — danach nur weitere Signaturen, Text unveraendert (Normalfall: Parteien signieren nacheinander)
 * nachtrag_ohne_aenderung — danach Bytes angehaengt (z. B. Validierungsdaten), aber weder Text noch Seitenbild geaendert
 * geaendert          — nach der Signatur wurde Inhalt geaendert (Befund `nach_signatur_geaendert`)
 * unbekannt          — nicht bestimmbar (Rueckfall ohne `pdfsig`)
 */
export type SignaturDeckung = 'vollstaendig' | 'spaetere_signatur' | 'nachtrag_ohne_aenderung' | 'geaendert' | 'unbekannt';

export interface SignaturAenderung {
  /** Betroffene Seiten (1-basiert) der spaeteren Fassung. */
  seiten: number[];
  /** Seitenzahl [signierte Fassung, spaetere Fassung], nur wenn verschieden. */
  seitenzahl?: [number, number];
  art: Array<'text' | 'sichtbar' | 'seiten'>;
  /** Beispiel: hinzugekommene bzw. entfernte Woerter (je hoechstens 12). */
  hinzu?: string;
  entfernt?: string;
}

export interface PdfSignatur {
  feld: string;
  /** „25.07.2024 15:18" (Europe/Berlin). */
  zeit: string;
  /** Zertifikats-CN, nur wenn er wie ein Name/eine Adresse aussieht. */
  unterzeichner?: string;
  /** CN ist eine technische Kennung (GUID, Hex, SID …) — nicht als Name verwenden. */
  unterzeichner_technisch?: true;
  art: SignaturArt;
  /** Zertifikat traegt die ETSI-Kennzeichnung „qualifiziert" (QcCompliance) — Hinweis, NICHT geprueft. */
  qualifiziert_gekennzeichnet?: true;
  /** Passt die Signatur kryptografisch zu den signierten Bytes? (keine Aussage ueber das Zertifikat) */
  integritaet: 'intakt' | 'verletzt' | 'unbekannt';
  /** Letztes signiertes Byte (Ende der Signed Ranges) = Ende der signierten Fassung. */
  bereich_ende: number;
  deckung: SignaturDeckung;
  aenderung?: SignaturAenderung;
}

/** Rohdaten aus `pdfsig` vor der Deckungspruefung. */
export interface PdfsigEintrag {
  feld: string;
  cn?: string;
  zeit?: string;
  typ?: string;
  bereichEnde: number;
  gesamt?: boolean;
  validierung?: string;
}

const MONATE: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** „Jul 25 2024 15:18:33" → „25.07.2024 15:18". */
function pdfsigZeit(roh: string): string {
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})\s+(\d{2}):(\d{2})/.exec(roh.trim());
  if (!m || !MONATE[m[1]!]) return roh.trim();
  return `${m[2]!.padStart(2, '0')}.${MONATE[m[1]!]}.${m[3]} ${m[4]}:${m[5]}`;
}

/** Ausgabe von `pdfsig -nocert` → Eintraege je Signatur. Tolerant gegen aeltere poppler-Ausgaben (fehlende Zeilen). */
export function parsePdfsig(stdout: string): PdfsigEintrag[] {
  const bloecke = stdout.split(/^Signature #\d+:\s*$/m).slice(1);
  return bloecke.map((b) => {
    const wert = (key: string) => new RegExp(`^\\s*-\\s*${key}:\\s*(.*)$`, 'm').exec(b)?.[1]?.trim();
    const ranges = [...(wert('Signed Ranges') ?? '').matchAll(/\[\s*(\d+)\s*-\s*(\d+)\s*\]/g)].map((m) => Number(m[2]));
    const gesamt = /^\s*-\s*Total document signed/m.test(b) ? true : /^\s*-\s*Not total document signed/m.test(b) ? false : undefined;
    return {
      feld: wert('Signature Field Name') ?? '',
      cn: wert('Signer Certificate Common Name'),
      zeit: wert('Signing Time'),
      typ: wert('Signature Type'),
      bereichEnde: ranges.length ? Math.max(...ranges) : 0,
      gesamt,
      validierung: wert('Signature Validation'),
    };
  });
}

/** GUID, lange Hex-/Ziffernfolgen, Windows-SID, Geraetekennungen — kein lesbarer Name. */
export function istTechnischeKennung(cn: string): boolean {
  const s = cn.trim();
  if (!s) return true;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return false; // E-Mail-Adresse taugt zur Zuordnung
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return true;
  if (/^S-1-\d+(-\d+)+$/i.test(s)) return true;
  if (/^[0-9a-f:\s-]{16,}$/i.test(s)) return true;
  if (!/[A-Za-zÄÖÜäöüß]{2,}/.test(s)) return true;
  return !/\s/.test(s) && (s.match(/\d/g)?.length ?? 0) >= 4;
}

export function signaturArt(typ: string | undefined): SignaturArt {
  if (!typ) return 'sonstige';
  if (/RFC3161/i.test(typ)) return 'zeitstempel';
  if (/CAdES/i.test(typ)) return 'pades';
  if (/^adbe\./i.test(typ)) return 'pkcs7';
  return 'sonstige';
}

function integritaet(validierung: string | undefined): PdfSignatur['integritaet'] {
  if (!validierung) return 'unbekannt';
  if (/Signature is Valid/i.test(validierung)) return 'intakt';
  if (/Digest Mismatch|Signature is Invalid/i.test(validierung)) return 'verletzt';
  return 'unbekannt';
}

/** ETSI QcCompliance 0.4.0.1862.1.1 als DER-OID (06 06 04 00 8E 46 01 01). */
const QC_COMPLIANCE = Buffer.from([0x06, 0x06, 0x04, 0x00, 0x8e, 0x46, 0x01, 0x01]);
export function hatQcKennzeichnung(pkcs7: Buffer): boolean {
  return pkcs7.includes(QC_COMPLIANCE);
}

async function spawnText(cmd: string[], cwd: string): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TZ: 'Europe/Berlin' } });
  const timer = setTimeout(() => proc.kill(), 30_000);
  try {
    const out = await new Response(proc.stdout).text();
    return { code: await proc.exited, out };
  } finally {
    clearTimeout(timer);
  }
}

/** Signaturen per `pdfsig` auslesen (ohne Deckungspruefung). `null` = pdfsig nicht nutzbar → Rueckfall. */
export async function lesePdfsig(pdf: Buffer): Promise<Array<PdfsigEintrag & { qc?: true }> | null> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), 'dp-pdfsig-'));
    const pfad = join(dir, 'dokument.pdf');
    await Bun.write(pfad, pdf);
    // Exit-Code ist bei Validierungsproblemen ≠ 0 — massgeblich ist die Ausgabe.
    const { out } = await spawnText(['pdfsig', '-nocert', '-no-ocsp', pfad], dir);
    if (!/Digital Signature Info|does not contain any signatures/i.test(out)) return null;
    const eintraege: Array<PdfsigEintrag & { qc?: true }> = parsePdfsig(out);
    if (!eintraege.length) return [];
    // PKCS#7 je Signatur fuer die QC-Kennzeichnung (dokument.pdf.sig0, .sig1 …).
    try {
      await spawnText(['pdfsig', '-nocert', '-no-ocsp', '-dump', pfad], dir);
      for (const name of await readdir(dir)) {
        const i = /\.sig(\d+)$/.exec(name)?.[1];
        if (i === undefined || !eintraege[Number(i)]) continue;
        if (hatQcKennzeichnung(await readFile(join(dir, name)))) eintraege[Number(i)]!.qc = true;
      }
    } catch { /* QC-Hinweis optional */ }
    return eintraege;
  } catch {
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Eintrag aus `pdfsig` → Signatur (Deckung wird danach bestimmt). */
export function alsSignatur(e: PdfsigEintrag & { qc?: true }): PdfSignatur {
  const technisch = e.cn !== undefined && istTechnischeKennung(e.cn);
  return {
    feld: e.feld,
    zeit: e.zeit ? pdfsigZeit(e.zeit) : 'Zeitpunkt unbekannt',
    ...(e.cn && !technisch ? { unterzeichner: e.cn } : {}),
    ...(technisch ? { unterzeichner_technisch: true as const } : {}),
    art: signaturArt(e.typ),
    ...(e.qc ? { qualifiziert_gekennzeichnet: true as const } : {}),
    integritaet: integritaet(e.validierung),
    bereich_ende: e.bereichEnde,
    deckung: e.gesamt ? 'vollstaendig' : 'unbekannt',
  };
}

// ---------- Rueckfall: Byte-Scan ohne pdfsig ----------

/** „D:20240725151833+02'00'" → „25.07.2024 15:18". */
function pdfZeit(roh: string): string {
  const m = /D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/.exec(roh);
  if (!m) return roh;
  return `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5] ?? '00'}` : ''}`;
}

/**
 * Signierte Felder per Byte-Scan: `/Type /Sig`-Dictionary mit `/M` (Signaturzeit) und nicht-leerem
 * `/Contents` (PKCS#7). Liefert nur den Zeitpunkt.
 */
export function findeDigitaleSignaturen(pdf: Buffer): Array<{ zeit: string }> {
  const text = pdf.toString('latin1');
  const out: Array<{ zeit: string }> = [];
  for (const m of text.matchAll(/\/Type\s*\/Sig\b/g)) {
    // Bis zum Objektende lesen — das Dictionary enthaelt verschachtelte << >> (Prop_Build) und lange Hex-Inhalte.
    const start = Math.max(0, text.lastIndexOf('obj', m.index ?? 0));
    const ende = text.indexOf('endobj', m.index ?? 0);
    const dict = text.slice(start, ende > 0 ? ende : (m.index ?? 0) + 60_000);
    const inhalt = /\/Contents\s*<([0-9a-fA-F]*)>/.exec(dict)?.[1] ?? '';
    if (!/[1-9a-fA-F]/.test(inhalt)) continue; // leeres (unsigniertes) Signaturfeld
    const zeit = /\/M\s*\(([^)]*)\)/.exec(dict)?.[1];
    out.push({ zeit: zeit ? pdfZeit(zeit) : 'Zeitpunkt unbekannt' });
  }
  return out;
}

// ---------- Marker im Transkript ----------

/** Marker-Text einer Signatur. Zeitstempel sind keine Unterschrift → kein Marker. */
export function signaturMarker(s: Pick<PdfSignatur, 'zeit' | 'unterzeichner' | 'art'>): string | null {
  if (s.art === 'zeitstempel') return null;
  return s.unterzeichner
    ? `{{digitale signatur: im PDF elektronisch signiert von ${s.unterzeichner} am ${s.zeit}}}`
    : `{{digitale signatur: im PDF elektronisch signiert am ${s.zeit}}}`;
}

/** Marker an die Unterschriftsseite (sonst letzte Vertragsseite) anhaengen — ohne das Transkript selbst zu aendern. */
export function ergaenzeDigitaleSignaturen(seiten: SeitenTranskript[], signaturen: Array<Pick<PdfSignatur, 'zeit' | 'unterzeichner' | 'art'>>): SeitenTranskript[] {
  const zeilen = signaturen.map(signaturMarker).filter((z): z is string => !!z);
  if (!zeilen.length) return seiten;
  const kandidaten = seiten.filter((s) => !s.fehler && s.rolle === 'unterschriften');
  const ziel = kandidaten[kandidaten.length - 1] ?? [...seiten].reverse().find((s) => !s.fehler && ['vertragstext', 'deckblatt'].includes(s.rolle));
  if (!ziel) return seiten;
  return seiten.map((s) => (s === ziel ? { ...s, text: `${s.text}\n\n${zeilen.join('\n')}` } : s));
}

// ---------- Befunde ----------

/** Befunde aus den Signaturen: Aenderung nach der Signatur, beschaedigte Signatur. */
export function signaturBefunde(signaturen: PdfSignatur[]): Array<{ typ: 'nach_signatur_geaendert' | 'signatur_beschaedigt'; text: string }> {
  const out: Array<{ typ: 'nach_signatur_geaendert' | 'signatur_beschaedigt'; text: string }> = [];
  for (const s of signaturen) {
    const wer = s.unterzeichner ? ` von ${s.unterzeichner}` : '';
    if (s.integritaet === 'verletzt') {
      out.push({ typ: 'signatur_beschaedigt', text: `Die elektronische Signatur${wer} vom ${s.zeit} passt nicht zum signierten Inhalt — das Dokument wurde im signierten Teil verändert oder ist beschädigt.` });
    }
    if (s.deckung !== 'geaendert' || !s.aenderung) continue;
    const a = s.aenderung;
    const teile: string[] = [];
    if (a.seitenzahl) teile.push(`Seitenzahl ${a.seitenzahl[0]} → ${a.seitenzahl[1]}`);
    if (a.seiten.length) teile.push(`${a.seiten.length === 1 ? 'Seite' : 'Seiten'} ${a.seiten.join(', ')}`);
    if (a.art.includes('sichtbar')) teile.push('sichtbare Änderung, z. B. Anmerkung oder Stempel');
    if (a.hinzu) teile.push(`hinzugekommen „${a.hinzu}"`);
    if (a.entfernt) teile.push(`entfernt „${a.entfernt}"`);
    out.push({
      typ: 'nach_signatur_geaendert',
      text: `Nach der elektronischen Signatur${wer} vom ${s.zeit} wurde das Dokument verändert (${teile.join('; ')}). Maßgeblich ist die signierte Fassung.`,
    });
  }
  return out;
}
