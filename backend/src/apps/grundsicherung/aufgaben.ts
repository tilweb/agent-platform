/**
 * Grundsicherung — Aufgaben-Aggregation (rein, DB-frei, testbar).
 *
 * Bündelt über alle Vorgänge: offene Todos + Wiedervorlagen/Fristen, angereichert um
 * Vorgangsnummer / Antragsteller / Status. Überfällige zuerst. Datumslogik aus dem Kern.
 */
import type { Vorgang, Akte, VorgangStatus } from './types';
import { istUeberfaellig } from './fristen';

interface AufgabeBasis {
  vorgangId: string;
  vorgangsnummer: string;
  antragsteller: string;
  status: VorgangStatus;
  sachbearbeiterId?: string;
  sachbearbeiter?: string;
}

export interface AufgabeTodo extends AufgabeBasis {
  art: 'todo';
  todoId: string;
  text: string;
}

export interface AufgabeFrist extends AufgabeBasis {
  art: 'frist';
  wiedervorlage?: string;
  frist?: string;
  /** Maßgebliches Datum: Wiedervorlage, sonst Frist. */
  faellig: string;
  ueberfaellig: boolean;
}

export type Aufgabe = AufgabeTodo | AufgabeFrist;

/** Aggregiert Aufgaben. Sortierung: Fristen (überfällige zuerst, dann nach Datum), danach Todos. */
export function aggregiereAufgaben(vorgaenge: Vorgang[], akten: Akte[], heute: string): Aufgabe[] {
  const akteById = new Map(akten.map((a) => [a.id, a]));
  const todos: AufgabeTodo[] = [];
  const fristen: AufgabeFrist[] = [];

  for (const v of vorgaenge) {
    const a = akteById.get(v.akteId);
    const basis: AufgabeBasis = {
      vorgangId: v.id, vorgangsnummer: v.vorgangsnummer,
      antragsteller: a?.antragstellerName || a?.name || '—', status: v.status,
      ...(v.sachbearbeiterId ? { sachbearbeiterId: v.sachbearbeiterId } : {}),
      ...(v.sachbearbeiter ? { sachbearbeiter: v.sachbearbeiter } : {}),
    };
    for (const t of v.todos ?? []) {
      if (!t.erledigt) todos.push({ ...basis, art: 'todo', todoId: t.id, text: t.text });
    }
    // Abgeschlossene Vorgänge erzeugen keine Frist-Aufgaben mehr.
    const faellig = v.wiedervorlage || v.frist;
    if (faellig && v.status !== 'abgeschlossen') {
      fristen.push({
        ...basis, art: 'frist', wiedervorlage: v.wiedervorlage, frist: v.frist, faellig,
        ueberfaellig: istUeberfaellig(faellig, heute),
      });
    }
  }

  fristen.sort((x, y) => {
    if (x.ueberfaellig !== y.ueberfaellig) return x.ueberfaellig ? -1 : 1;
    return x.faellig < y.faellig ? -1 : x.faellig > y.faellig ? 1 : 0;
  });
  return [...fristen, ...todos];
}
