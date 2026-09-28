/**
 * Grundsicherung — In-Memory-Fakes der Speicher für Tests der Verteilung und des Posteingangs.
 * Nur von Tests importiert (keine DB, kein LLM).
 */
import type { Context } from 'hono';
import type { VerteilungDeps } from './verteilung';
import type { AuditEvent } from './audit';
import type { Akte, Dokument, FeldStatus, Person, Vorgang } from './types';
import type { FeldStatusInput } from '../kern/feldstatus';

export function fakeVerteilungDeps(start: { akten?: Akte[]; vorgaenge?: Vorgang[]; personen?: Person[] } = {}) {
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const akten = new Map((start.akten ?? []).map((a) => [a.id, structuredClone(a)]));
  const vorgaenge = new Map((start.vorgaenge ?? []).map((v) => [v.id, structuredClone(v)]));
  const personen = new Map((start.personen ?? []).map((p) => [p.id, structuredClone(p)]));
  const dokumente = new Map<string, Dokument>();
  const feldStatus: FeldStatusInput[] = [];
  const audits: AuditEvent[] = [];
  const pruefungen: string[] = [];
  const meta = { version: 1, created_at: '', updated_at: '' };

  const deps: VerteilungDeps = {
    getAkte: async (x) => structuredClone(akten.get(x) ?? null),
    createAkte: async (input) => { const a = { ...input, id: id('akte'), ...meta } as Akte; akten.set(a.id, a); return structuredClone(a); },
    getVorgang: async (x) => structuredClone(vorgaenge.get(x) ?? null),
    createVorgang: async (input) => {
      const v = { antragsart: 'erstantrag', status: 'posteingang', prioritaet: 'normal', ...input, id: id('vorgang'), vorgangsnummer: `GS-${n}`, ...meta } as Vorgang;
      vorgaenge.set(v.id, v);
      return structuredClone(v);
    },
    updateVorgang: async (x, updates) => {
      const alt = vorgaenge.get(x);
      if (!alt) return null;
      const neu = { ...alt, ...updates, version: alt.version + 1 } as Vorgang;
      vorgaenge.set(x, neu);
      return structuredClone(neu);
    },
    listVorgaenge: async () => [...vorgaenge.values()].map((v) => structuredClone(v)),
    listPersonen: async (vid) => [...personen.values()].filter((p) => p.vorgangId === vid).map((p) => structuredClone(p)),
    createPerson: async (input) => { const p = { rolle: 'haushaltsangehoerig', nachname: '', vorname: '', ...input, id: id('person'), ...meta } as Person; personen.set(p.id, p); return structuredClone(p); },
    createDokument: async (input) => { const d = { istOriginal: false, typ: 'sonstiges', ...input, id: id('dok'), ...meta } as Dokument; dokumente.set(d.id, d); return structuredClone(d); },
    setFeldStatus: async (input) => { feldStatus.push(input); return { ...input, id: id('fs'), bestaetigt: !!input.bestaetigt } as unknown as FeldStatus; },
    audit: async (_c: Context, e: AuditEvent) => { audits.push(e); },
    resolveStorageRef: (ref?: string) => (ref?.startsWith('local:') ? { pfad: ref.slice(6) } : ref?.startsWith('s3:') ? { s3Key: ref.slice(3) } : {}),
    pruefeUndSynchronisiere: async (vid: string) => { pruefungen.push(vid); return 3; },
  };
  return { deps, akten, vorgaenge, personen, dokumente, feldStatus, audits, pruefungen };
}

/** Minimaler Hono-Context-Ersatz mit `userId` (für `getCurrentUserId`). */
export const fakeContext = (userId = 'u1') => ({ get: (k: string) => (k === 'userId' ? userId : undefined) }) as unknown as Context;
