/**
 * Grundsicherung — KI-Verbrauch (Tokens) je Antrag (Adapter auf den Antrag-Kern).
 *
 * `messeKiVerbrauch(aktion, bezug, fn)` legt einen Token-Messbereich um eine fachliche Aktion
 * und speichert danach EINEN Datensatz mit der Summe aller darin ausgelösten LLM-Aufrufe.
 * Logik in `apps/_antrag-kern/ki-verbrauch.ts`; hier nur Aktionen + Labels.
 */
import { gsKiVerbrauch } from '../../db/schema/grundsicherung';
import {
  createKiVerbrauch, fasseZusammen as kernFasseZusammen,
  type KiVerbrauchEintrag, type KiVerbrauchUebersicht,
} from '../_antrag-kern/ki-verbrauch';

export type {
  KiPhase, KiVerbrauchEintrag, KiVerbrauchSumme, KiVerbrauchUebersicht, KiBezug,
} from '../_antrag-kern/ki-verbrauch';

export type KiAktion =
  | 'posteingang_auswertung' | 'posteingang_trennung' | 'dokument_upload' | 'fall_chat';

export const KI_AKTION_LABEL: Record<KiAktion, string> = {
  posteingang_auswertung: 'Posteingang: Erkennung & Auslesen',
  posteingang_trennung: 'Posteingang: Neuauswertung nach Trennungskorrektur',
  dokument_upload: 'Nachreichung am Vorgang: Erkennung & Auslesen',
  fall_chat: 'Assistent: Frage zum Fall',
};

const kern = createKiVerbrauch<KiAktion>({
  tabelle: gsKiVerbrauch,
  labels: KI_AKTION_LABEL,
  logPraefix: '[grundsicherung]',
  idPraefix: 'kv',
});

export const labelFuer = kern.labelFuer;

/** Aggregiert Einträge zu Summe, je Phase, je Aktion und je Modell. */
export function fasseZusammen(eintraege: KiVerbrauchEintrag[]): KiVerbrauchUebersicht {
  return kernFasseZusammen(eintraege, labelFuer);
}

export const speichereKiVerbrauch = kern.speichereKiVerbrauch;
/** Führt `fn` gemessen aus und speichert den Verbrauch (auch wenn `fn` wirft). */
export const messeKiVerbrauch = kern.messeKiVerbrauch;
/** Bei Zuordnung eines Eingangs: Datensätze des Eingangs gehen an den Vorgang. */
export const ordneKiVerbrauchZu = kern.ordneKiVerbrauchZu;
export const kiVerbrauchFuerVorgang = kern.kiVerbrauchFuerVorgang;
export const kiVerbrauchFuerPosteingang = kern.kiVerbrauchFuerPosteingang;
