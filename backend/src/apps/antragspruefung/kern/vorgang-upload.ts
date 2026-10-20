/**
 * Upload am Vorgang als fortsetzbarer Hintergrund-Job (Stufe S1).
 *
 * Bisher lief Erkennung → Verteilung → Prüfung (65–150 s je Sammel-PDF) synchron im HTTP-Request. Jetzt:
 * Die Route speichert die Dateien und stellt einen Job ein (202 + Job-ID). Die Oberfläche fragt den Status ab
 * (`GET /vorgaenge/:id/dokumente/upload/:jobId`) und erhält am Ende dieselbe Antwort wie früher.
 *
 * Fachfrei: Was „verarbeiten" heißt (Erkennung, Verteilung, Prüfung), liefert die App als Funktion.
 * Wiederholbar: Die Dateien liegen dauerhaft im Speicher der App, der Job trägt nur Referenzen.
 */

import type { Context } from 'hono';
import { jobStatus, PRIORITAET, registriereJobArt, setzeJobFortschritt, stelleEin } from '../../../extraction/queue/hintergrund';
import { akteurAusKontext, kontextFuerAkteur, type Akteur } from './akteur';

export type VorgangUploadErgebnis =
  | { ok: true; antwort: unknown }
  | { ok: false; error: string; status?: number };

interface VorgangUploadJob<TDatei> {
  vorgangId: string;
  dateien: TDatei[];
  akteur: Akteur;
}

export function createVorgangUploadJob<TDatei>(opts: {
  jobArt: string;
  /** Erkennung + Verteilung + Prüfung; `melde` setzt den Fortschrittstext. */
  verarbeite: (c: Context, eingabe: { vorgangId: string; dateien: TDatei[]; userId: string | null; melde: (text: string) => Promise<void> }) => Promise<VorgangUploadErgebnis>;
}) {
  registriereJobArt<VorgangUploadJob<TDatei>>(opts.jobArt, {
    async ausfuehren(n) {
      const r = await opts.verarbeite(kontextFuerAkteur(n.akteur), {
        vorgangId: n.vorgangId, dateien: n.dateien, userId: n.akteur.userId, melde: setzeJobFortschritt,
      });
      if (!r.ok) throw new Error(r.error);
      return r.antwort;
    },
  });

  /** Job einstellen; liefert die Job-ID für die Statusabfrage. */
  async function stelleUploadEin(c: Context, vorgangId: string, dateien: TDatei[]): Promise<string> {
    const akteur = akteurAusKontext(c);
    const { id } = await stelleEin<VorgangUploadJob<TDatei>>(opts.jobArt, { vorgangId, dateien, akteur }, {
      // Jeder Upload ist ein eigener Job (kein Zusammenfassen mehrerer Uploads am selben Vorgang).
      schluessel: `${opts.jobArt}:${vorgangId}:${crypto.randomUUID()}`, userId: akteur.userId, prioritaet: PRIORITAET.eingang,
    });
    return id;
  }

  /** Status für die Oberfläche; nur Jobs dieser Art und dieses Vorgangs. */
  async function uploadStatus(vorgangId: string, jobId: string) {
    const s = await jobStatus(jobId).catch(() => null);
    if (!s || s.art !== opts.jobArt || (s.nutzlast as { vorgangId?: string } | null)?.vorgangId !== vorgangId) return null;
    return { status: s.status, fortschritt: s.fortschritt?.text ?? null, ergebnis: s.status === 'fertig' ? s.ergebnis : null, fehler: s.fehler };
  }

  return { stelleUploadEin, uploadStatus };
}
