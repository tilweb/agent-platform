/**
 * Aufgaben-Aggregation (Gap J, Welle 5, WP9) — rein, DB-frei, testbar.
 *
 * Bündelt über alle Vorgänge: offene Todos (WP8) + gesetzte Wiedervorlagen (WP7),
 * angereichert um Antrags-ID / Antragsteller / Status. Überfällige Fristen zuerst.
 * KEIN eigenes Kalender-Modul, keine Rechteverwaltung.
 */
import type { Vorgang, Akte, VorgangStatus } from './types';
import { istUeberfaellig } from './fristen';

export interface AufgabeTodo {
  art: 'todo';
  vorgangId: string;
  todoId: string;
  text: string;
  antragsId: string;
  antragsteller: string;
  status: VorgangStatus;
}

export interface AufgabeFrist {
  art: 'frist';
  vorgangId: string;
  antragsId: string;
  antragsteller: string;
  status: VorgangStatus;
  wiedervorlage?: string;
  frist?: string;
  ueberfaellig: boolean;
}

export type Aufgabe = AufgabeTodo | AufgabeFrist;

/**
 * Aggregiert Aufgaben aus allen Vorgängen. Sortierung: erst Fristen (überfällige
 * zuerst, dann nach Wiedervorlagedatum), danach offene Todos.
 */
export function aggregiereAufgaben(vorgaenge: Vorgang[], akten: Akte[], heute: string): Aufgabe[] {
  const akteById = new Map(akten.map((a) => [a.id, a]));
  const nameFuer = (v: Vorgang): string => {
    const a = akteById.get(v.akteId);
    return a?.antragstellerName || a?.name || '—';
  };

  const todos: AufgabeTodo[] = [];
  const fristen: AufgabeFrist[] = [];

  for (const v of vorgaenge) {
    const antragsteller = nameFuer(v);
    for (const t of v.todos ?? []) {
      if (t.erledigt) continue;
      todos.push({
        art: 'todo', vorgangId: v.id, todoId: t.id, text: t.text,
        antragsId: v.antragsId, antragsteller, status: v.status,
      });
    }
    if (v.wiedervorlage) {
      fristen.push({
        art: 'frist', vorgangId: v.id, antragsId: v.antragsId, antragsteller, status: v.status,
        wiedervorlage: v.wiedervorlage, frist: v.frist,
        ueberfaellig: istUeberfaellig(v.wiedervorlage, heute),
      });
    }
  }

  fristen.sort((a, b) => {
    if (a.ueberfaellig !== b.ueberfaellig) return a.ueberfaellig ? -1 : 1;
    return (a.wiedervorlage ?? '') < (b.wiedervorlage ?? '') ? -1 : (a.wiedervorlage ?? '') > (b.wiedervorlage ?? '') ? 1 : 0;
  });

  return [...fristen, ...todos];
}
