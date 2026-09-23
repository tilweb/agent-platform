/**
 * Wohngeld — reine, testbare Helfer der Posteingang-Warteschlange.
 *
 * Ohne DB/Netz: Hashing (Dedupe/Idempotenz), Zustandsautomat (§4 der Spec) und
 * Betreff-Ableitung. Bewusst getrennt von der Route, damit sie unit-testbar sind.
 */
import type { PosteingangStatus, PosteingangDatei } from './types';

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

/** Erlaubte Zustandsübergänge (Spec §4). Terminal: zugeordnet, verworfen. */
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

const ANTRAGSART_KURZ: Record<string, string> = {
  erstantrag: 'Erstantrag',
  weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag',
  aenderungsantrag: 'Änderungsantrag',
};

/**
 * Leitet einen sprechenden Betreff aus den (analysierten) Dateien ab, z. B.
 * „Müller, Anna — Erstantrag". Ohne Antrag: erste Nachweis-Identität; sonst der
 * erste Dateiname. Gibt undefined zurück, wenn nichts Sinnvolles ableitbar ist.
 */
export function leiteBetreffAb(dateien: PosteingangDatei[]): string | undefined {
  const antrag = dateien.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const at = antrag?.stammdaten?.antragsteller;
  if (at && (at.nachname || at.vorname)) {
    const name = [at.nachname, at.vorname].filter(Boolean).join(', ');
    const art = antrag?.stammdaten?.antragsart ? ANTRAGSART_KURZ[antrag.stammdaten.antragsart] : undefined;
    return art ? `${name} — ${art}` : name;
  }
  const nachweis = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname));
  if (nachweis && (nachweis.nachname || nachweis.vorname)) {
    return [nachweis.nachname, nachweis.vorname].filter(Boolean).join(', ');
  }
  return dateien[0]?.dateiname;
}
