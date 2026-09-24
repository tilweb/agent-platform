/**
 * Wohngeld — Fortschritt der Posteingang-Auswertung (sichtbar in Liste und Detail).
 *
 * Die Auswertung läuft im Hintergrund; ihr Fortschritt steht im Eingang (`data.fortschritt`)
 * und wird von der Oberfläche abgefragt. Geschrieben wird gedrosselt und ohne Versionssprung.
 */
import type { FortschrittEreignis } from '../../extraction/fortschritt';

export type FortschrittPhase = 'wartet' | 'laden' | 'seiten' | 'trennen' | 'auslesen' | 'abschluss';

export interface PosteingangFortschritt {
  phase: FortschrittPhase;
  /** Lesbarer Schritt, z. B. „Seite 7 von 18 erkannt". */
  text: string;
  fertig?: number;
  gesamt?: number;
  /** Aktuelle Datei (bei mehreren Dateien je Eingang). */
  datei?: string;
  dateiNr?: number;
  dateienGesamt?: number;
  /** ISO-Zeitpunkte. */
  gestartet: string;
  aktualisiert: string;
}

/** Reihenfolge der Schritte (für die Anzeige als Schrittliste). */
export const FORTSCHRITT_PHASEN: Array<{ phase: FortschrittPhase; label: string }> = [
  { phase: 'wartet', label: 'In Warteschlange' },
  { phase: 'laden', label: 'Datei laden' },
  { phase: 'seiten', label: 'Seiten erkennen' },
  { phase: 'trennen', label: 'Dokumente trennen' },
  { phase: 'auslesen', label: 'Dokumente auslesen' },
  { phase: 'abschluss', label: 'Zuordnung vorschlagen' },
];

/** Ereignis der Dokumentenerkennung → Phase + Text (rein). */
export function ausErkennung(e: FortschrittEreignis): Pick<PosteingangFortschritt, 'phase' | 'text' | 'fertig' | 'gesamt'> {
  switch (e.schritt) {
    case 'seiten_gerendert': return { phase: 'seiten', text: `${e.gesamt} Seiten werden erkannt`, fertig: 0, gesamt: e.gesamt };
    case 'seite_klassifiziert': return { phase: 'seiten', text: `Seite ${e.fertig} von ${e.gesamt} erkannt`, fertig: e.fertig, gesamt: e.gesamt };
    case 'abschnitte_erkannt': return { phase: 'trennen', text: `${e.anzahl} ${e.anzahl === 1 ? 'Dokument' : 'Dokumente'} erkannt` };
    case 'abschnitt_auslesen': return { phase: 'auslesen', text: `Dokument ${e.fertig + 1} von ${e.gesamt} wird ausgelesen${e.label ? `: ${e.label}` : ''}`, fertig: e.fertig, gesamt: e.gesamt };
  }
}

/** Seit 10 Minuten ohne Fortschritt ⇒ Auswertung gilt als abgebrochen (z. B. Neustart des Servers). */
export const HAENGT_NACH_MS = 10 * 60 * 1000;
export function istHaengend(f: PosteingangFortschritt | undefined | null, jetzt: number = Date.now()): boolean {
  if (!f) return true;
  const t = Date.parse(f.aktualisiert);
  return !Number.isFinite(t) || jetzt - t > HAENGT_NACH_MS;
}

type Schreiber = (id: string, f: PosteingangFortschritt | null) => Promise<void>;

/**
 * Sammelt Fortschritt und schreibt ihn gedrosselt (Phasenwechsel sofort, sonst höchstens alle
 * 700 ms). `ende()` wartet auf ausstehende Schreibvorgänge und entfernt den Fortschritt.
 */
export class FortschrittMelder {
  private stand: PosteingangFortschritt;
  private kette: Promise<void> = Promise.resolve();
  private letzterSchreib = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private beendet = false;

  constructor(private readonly id: string, private readonly schreibe: Schreiber, start?: Partial<PosteingangFortschritt>) {
    const jetzt = new Date().toISOString();
    this.stand = { phase: 'laden', text: 'Auswertung startet', gestartet: jetzt, aktualisiert: jetzt, ...start };
  }

  get aktuell(): PosteingangFortschritt { return this.stand; }

  setze(teil: Partial<PosteingangFortschritt>): void {
    if (this.beendet) return;
    const phasenwechsel = teil.phase !== undefined && teil.phase !== this.stand.phase;
    const neu: PosteingangFortschritt = { ...this.stand, ...teil, aktualisiert: new Date().toISOString() };
    if (phasenwechsel && teil.fertig === undefined) { delete neu.fertig; delete neu.gesamt; }
    this.stand = neu;
    if (phasenwechsel || Date.now() - this.letzterSchreib >= 700) this.schreibeJetzt();
    else if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.schreibeJetzt(); }, 700);
  }

  private schreibeJetzt(): void {
    if (this.beendet) return;
    this.letzterSchreib = Date.now();
    const f = this.stand;
    this.kette = this.kette.then(() => this.schreibe(this.id, f)).catch(() => { /* Anzeige best-effort */ });
  }

  async ende(): Promise<void> {
    this.beendet = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    await this.kette;
    await this.schreibe(this.id, null).catch(() => {});
  }
}
