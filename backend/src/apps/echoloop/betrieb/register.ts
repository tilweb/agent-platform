/**
 * Phase 4 · Register-Workflows — die Governance-Register als deterministische
 * Zustandsmaschinen (PAKET_2 _REGEL-REVIEW-BACKLOG.md · _GOLD-REGISTRY.json ·
 * _BAUWEG-REGISTER.json).
 *
 * Leitregel (LIESMICH_ADACOR): „Standards ändern wir nur konsolidiert im Review,
 * nie nebenbei." Das erzwingt die Regel-Backlog-Zustandsmaschine: ein Muster-
 * Kandidat läuft erst BEOBACHTEND (bis 0 Fehlalarme auf Fixtures), dann durchs
 * REVIEW, erst dann wird er STANDARD (scharf). Kein Sprung Kandidat→Standard.
 *
 * Gold-Registry: **supersede-not-overwrite** — ein neu gepinnter Gold-Wert
 * ersetzt den alten nicht, sondern löst ihn ab (Historie bleibt, jede Änderung
 * ist erklärbar). Rein & deterministisch (kein LLM/DB).
 */

// ── Regel-Backlog (Kandidat → Review → Standard) ─────────────────────────────

export type KandidatStatus = 'kandidat' | 'beobachtend' | 'im_review' | 'standard' | 'verworfen';

export interface RegelKandidat {
  id: string;              // z.B. "K-13", "PM-W-a"
  titel: string;
  quelle: string;         // welcher Befund/Fixture den Kandidaten aufwarf
  status: KandidatStatus;
  begruendung?: string;   // Review-Notiz
  datum: string;          // Stand des letzten Übergangs (ISO)
}

/** Erlaubte Übergänge — der einzige Weg zu „standard" führt über „im_review". */
export const REGEL_UEBERGAENGE: Record<KandidatStatus, KandidatStatus[]> = {
  kandidat: ['beobachtend', 'verworfen'],
  beobachtend: ['im_review', 'verworfen'],   // erst nach 0 FP auf Fixtures ins Review
  im_review: ['standard', 'beobachtend', 'verworfen'],
  standard: [],                              // Endzustand (Änderung = neuer Kandidat)
  verworfen: ['kandidat'],                   // Wiederaufnahme nur als frischer Kandidat
};

export class UebergangFehler extends Error {}

/** Führt einen Backlog-Übergang aus; wirft, wenn der Sprung nicht erlaubt ist. */
export function uebergang(k: RegelKandidat, ziel: KandidatStatus, datum: string, begruendung?: string): RegelKandidat {
  if (!REGEL_UEBERGAENGE[k.status].includes(ziel)) {
    throw new UebergangFehler(`Übergang ${k.status} → ${ziel} nicht erlaubt (K ${k.id}). Standards werden nur im Review geändert, nie nebenbei.`);
  }
  if (ziel === 'standard' && k.status !== 'im_review') {
    throw new UebergangFehler(`„standard" ist nur aus „im_review" erreichbar (K ${k.id}).`);
  }
  return { ...k, status: ziel, datum, begruendung: begruendung ?? k.begruendung };
}

/** Ist der Kandidat scharf (in den Standard promotet)? Nur dann darf ein Muster hart eskalieren. */
export function istScharf(k: RegelKandidat): boolean {
  return k.status === 'standard';
}

// ── Gold-Registry (supersede-not-overwrite) ──────────────────────────────────

export interface GoldEintrag {
  key: string;
  wert: unknown;
  version: number;
  gepinntAm: string;
  begruendung?: string;
  /** Version, die diesen Eintrag abgelöst hat (undefined = aktueller Stand). */
  supersededBy?: number;
}

/**
 * Pinnt einen neuen Gold-Wert: der bisher aktive Eintrag des Keys wird ABGELÖST
 * (supersededBy gesetzt), der neue mit erhöhter Version angehängt. Nie überschrieben.
 */
export function pinGold(registry: GoldEintrag[], key: string, wert: unknown, gepinntAm: string, begruendung?: string): GoldEintrag[] {
  const aktiv = registry.filter((e) => e.key === key && e.supersededBy === undefined);
  const maxVersion = registry.filter((e) => e.key === key).reduce((m, e) => Math.max(m, e.version), 0);
  const neueVersion = maxVersion + 1;
  const next = registry.map((e) =>
    aktiv.includes(e) ? { ...e, supersededBy: neueVersion } : e,
  );
  next.push({ key, wert, version: neueVersion, gepinntAm, begruendung });
  return next;
}

/** Aktueller (nicht abgelöster) Gold-Wert eines Keys. */
export function aktuellerGold(registry: GoldEintrag[], key: string): GoldEintrag | undefined {
  return registry.find((e) => e.key === key && e.supersededBy === undefined);
}

/** Historie eines Keys, älteste zuerst. */
export function goldHistorie(registry: GoldEintrag[], key: string): GoldEintrag[] {
  return registry.filter((e) => e.key === key).sort((a, b) => a.version - b.version);
}

// ── Bauweg-Register (Variante + kippt_wenn) ──────────────────────────────────

export interface BauwegVariante {
  id: string;
  variante: string;      // die gewählte Bau-Variante
  kipptWenn: string;     // Bedingung, unter der die Variante nicht mehr trägt
  gewaehltAm: string;
}
