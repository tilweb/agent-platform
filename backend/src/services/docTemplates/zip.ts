/**
 * Minimaler ZIP-Leser/-Schreiber für OOXML (.docx) — ohne Dependency.
 * Lesen: End-of-Central-Directory → Central Directory → Local Header → STORE/DEFLATE.
 * Schreiben: DEFLATE (bzw. STORE bei bereits komprimierten Medien), kein ZIP64.
 */
import { inflateRawSync, deflateRawSync } from 'node:zlib';

export type ZipEntries = Map<string, Uint8Array>;

export function readZip(input: Uint8Array): ZipEntries {
  const buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  // EOCD-Signatur rückwärts suchen (Kommentar max. 64 KB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Keine gültige ZIP-Datei (EOCD fehlt)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Central Directory beschädigt');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    if (method === 0) entries.set(name, new Uint8Array(raw));
    else if (method === 8) entries.set(name, new Uint8Array(inflateRawSync(raw)));
    else throw new Error(`Nicht unterstützte Kompression ${method} in ${name}`);
  }
  return entries;
}

const STORED_EXT = /\.(png|jpe?g|gif|emf|wmf|zip)$/i;

export function writeZip(entries: ZipEntries): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // [Content_Types].xml muss nicht zwingend zuerst stehen, schadet aber nicht
  const names = [...entries.keys()].sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0));
  for (const name of names) {
    const data = entries.get(name)!;
    const nameBuf = Buffer.from(name, 'utf8');
    const store = STORED_EXT.test(name);
    const comp = store ? Buffer.from(data) : deflateRawSync(data);
    const crc = Bun.hash.crc32(data) >>> 0;
    const method = store ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8-Namen
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0x00210000, 10); // 1980-01-01 00:00
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0x00210000, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += 30 + nameBuf.length + comp.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, eocd]));
}

export const text = (u: Uint8Array | undefined) => (u ? new TextDecoder().decode(u) : '');
export const bytes = (s: string) => new TextEncoder().encode(s);
