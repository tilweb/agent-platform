/**
 * Antrag-Kern — Posteingang: Zustandsautomat und Hashes (rein, ohne DB/Netz).
 *
 * Hashing für Dedupe/Idempotenz und die erlaubten Zustandsübergänge eines Eingangs.
 */
import type { PosteingangStatus } from './typen';

/** SHA-256 (hex) über rohe Bytes — Datei-Hash für Dedupe/Idempotenz. */
export function sha256Hex(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}

/** SHA-256 (hex) über einen String (z. B. idempotencyKey). */
export function sha256HexString(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

/**
 * Umschlag-Hash: SHA-256 über die SORTIERTEN Datei-Hashes. Sortierung macht den
 * Hash unabhängig von der Reihenfolge der Dateien im Batch → derselbe Scan liefert
 * denselben Umschlag-Hash (Dedupe gegen Doppel-Einlieferung).
 */
export function envelopeHash(fileHashes: string[]): string {
  const sorted = [...fileHashes].sort();
  return sha256HexString(sorted.join('\n'));
}

/** Erlaubte Zustandsübergänge. Terminal: zugeordnet, verworfen. */
const UEBERGAENGE: Record<PosteingangStatus, PosteingangStatus[]> = {
  eingegangen: ['in_analyse', 'verworfen'],
  in_analyse: ['analysiert', 'fehler'],
  analysiert: ['in_analyse', 'zugeordnet', 'verworfen'], // „Neu auswerten" via in_analyse
  fehler: ['in_analyse', 'verworfen'],
  zugeordnet: [],
  verworfen: [],
};

/** Ist der Übergang from → to erlaubt? */
export function uebergangErlaubt(from: PosteingangStatus, to: PosteingangStatus): boolean {
  return UEBERGAENGE[from]?.includes(to) ?? false;
}

/** Terminal (keine weiteren Aktionen möglich)? */
export function istTerminal(status: PosteingangStatus): boolean {
  return status === 'zugeordnet' || status === 'verworfen';
}

/** Darf ein Eingang in diesem Status (neu) ausgewertet werden? */
export function darfAuswerten(status: PosteingangStatus): boolean {
  return status === 'eingegangen' || status === 'analysiert' || status === 'fehler';
}

/** Darf ein Eingang in diesem Status zugeordnet werden? */
export function darfZuordnen(status: PosteingangStatus): boolean {
  return status === 'analysiert';
}
