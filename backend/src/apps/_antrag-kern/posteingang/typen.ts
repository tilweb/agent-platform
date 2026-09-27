/**
 * Antrag-Kern — Posteingang: fachfreie Typen.
 *
 * Ein Eingang ist ein Umschlag/Batch (1..n Dateien). Die Datei trägt die fachfreien
 * Ablage-/Trennungsfelder; fachliche Auswertungsfelder ergänzt die App über `TAnalyse`
 * (bzw. über ein eigenes Interface, das `PosteingangDateiBasis` erweitert).
 */

/** Kanal, über den ein Eingang eingeliefert wurde. */
export type PosteingangQuelle = 'manuell' | 'scan' | 'email' | 'import' | 'weiterleitung';

/** Alle bekannten Kanäle. Eine App kann über die Routen-Konfiguration eine Teilmenge zulassen. */
export const POSTEINGANG_QUELLEN: readonly PosteingangQuelle[] = ['manuell', 'scan', 'email', 'import', 'weiterleitung'];

/** Zustand eines Eingangs im Zustandsautomaten. */
export type PosteingangStatus =
  | 'eingegangen'
  | 'in_analyse'
  | 'analysiert'
  | 'fehler'
  | 'zugeordnet'
  | 'verworfen';

/** Herkunft eines Teil-Dokuments: das Original + Seitenbereich. */
export interface PosteingangTeilVon {
  dateiname: string;
  s3Key?: string;
  pfad?: string;
  hash: string;
  contentType: string;
  groesse: number;
  seitenGesamt: number;
  seiteVon: number;
  seiteBis: number;
  teilNr: number;
  teileGesamt: number;
  manuell?: boolean;
}

/** Ergebnis der Dokumentgrenzen-Prüfung einer (ungetrennten) PDF. */
export interface PosteingangTrennung {
  status: 'ein_dokument' | 'unsicher' | 'nicht_moeglich';
  seitenGesamt?: number;
  hinweis?: string;
  manuell?: boolean;
}

/**
 * Fachfreier Teil einer Datei im Umschlag. `typ` ist die (überschreibbare) Klassifikation,
 * `analyseFehler` markiert eine fehlgeschlagene Auswertung.
 */
export interface PosteingangDateiBasis<TTyp extends string = string> {
  dateiname: string;
  s3Key?: string;
  pfad?: string;
  contentType: string;
  groesse: number;
  hash: string;                 // Datei-Hash (SHA-256, hex) — Dedupe/Idempotenz
  typ?: TTyp;
  analyseFehler?: string;
  /** Gesetzt an jedem Teil einer getrennten Sammel-PDF (Mehrdokument-Split). */
  teilVon?: PosteingangTeilVon;
  /** Ergebnis der Grenzprüfung an einer ungetrennten PDF. */
  trennung?: PosteingangTrennung;
}

/** Datei im Umschlag mit fachlichen Auswertungsfeldern `TAnalyse`. */
export type PosteingangDatei<TTyp extends string = string, TAnalyse extends object = object> =
  PosteingangDateiBasis<TTyp> & TAnalyse;

/**
 * Eingang = Umschlag/Batch (persistente Warteschlange). `matchVorschlag` hält die
 * fachlichen Zuordnungs-Kandidaten der App.
 */
export interface Posteingang<TDatei extends PosteingangDateiBasis = PosteingangDateiBasis, TMatch = unknown> {
  id: string;
  quelle: PosteingangQuelle;
  eingegangenAm: string;          // ISO — fristauslösend (rechtlich relevant)
  betreff?: string;
  status: PosteingangStatus;
  dateien: TDatei[];
  matchVorschlag?: TMatch[];
  zugeordneterVorgangId?: string;
  zugeordneteAkteId?: string;
  bearbeiterId?: string;
  verworfenGrund?: string;
  hash?: string;                  // Umschlag-Hash (Dedupe gegen Doppel-Scans)
  data?: Record<string, unknown>; // Erweiterungen (z. B. demo:true, fortschritt)
  version: number;
  created_at: string;
  updated_at: string;
}
