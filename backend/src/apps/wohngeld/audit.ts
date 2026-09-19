/**
 * Wohngeld GOV-1 — Zentraler Audit-/Protokoll-Helfer.
 *
 * `audit(c, event)` schreibt EINE append-only Zeile ins Audit-Log und liest den
 * Akteur (id + name + wirksame Rolle + IP) aus dem Hono-Context. Er wird in jeder
 * Schreib-Route sowie bei Lesezugriff auf einen Fall und bei Downloads/Exporten
 * aufgerufen (§ 35 SGB I, Art. 5/30 DSGVO, AI Act Art. 12).
 *
 * WICHTIG: Ein Fehler beim Protokollieren darf die eigentliche Fach-Aktion NIE
 * abbrechen — deshalb try/catch + console.error, kein re-throw.
 */
import type { Context } from 'hono';
import { getCurrentUser, getCurrentUserId } from '../../auth/middleware';
import { addAuditEintrag } from './storage';
import type { FeldDiff } from './types';

/** Objekt-Typen im Protokoll (siehe Spec Abschnitt 4). */
export type AuditObjektTyp =
  | 'vorgang' | 'person' | 'dokument' | 'pruefschritt' | 'schreiben'
  | 'notiz' | 'feldstatus' | 'akte' | 'verfuegung' | 'chat' | 'textbaustein' | 'posteingang';

export interface AuditEvent {
  aktion: string;
  objektTyp: AuditObjektTyp;
  objektId?: string;
  vorgangId?: string;
  ergebnis?: 'ok' | 'fehler';
  vorher?: unknown;
  nachher?: unknown;
  detail?: string;
}

/** Client-IP aus den üblichen Proxy-Headern (erste IP aus x-forwarded-for, sonst x-real-ip). */
function clientIp(c: Context): string | undefined {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return c.req.header('x-real-ip') || undefined;
}

/** Protokolliert eine fachlich relevante Aktion. Fehler werden geschluckt (nur geloggt). */
export async function audit(c: Context, e: AuditEvent): Promise<void> {
  try {
    const user = getCurrentUser(c);
    await addAuditEintrag({
      akteurId: getCurrentUserId(c) ?? null,
      akteurName: user?.displayName || user?.username || null,
      akteurRolle: (c.get('appRole') as string | undefined) ?? null,
      aktion: e.aktion,
      objektTyp: e.objektTyp,
      objektId: e.objektId ?? null,
      vorgangId: e.vorgangId ?? null,
      ergebnis: e.ergebnis ?? 'ok',
      vorher: e.vorher ?? null,
      nachher: e.nachher ?? null,
      detail: e.detail ?? null,
      ip: clientIp(c) ?? null,
    });
  } catch (err) {
    console.error('[wohngeld] audit fehlgeschlagen:', err);
  }
}

/**
 * Reiner Helfer: Diff zweier Objekte, beschränkt auf die angegebenen Felder.
 * Liefert nur die tatsächlich geänderten Felder als { feld: { alt, neu } }.
 * Vergleich per JSON-Serialisierung (deckt Objekte/Arrays wie `wohnung`/`bwz` ab);
 * `undefined` und fehlende Felder gelten als gleich.
 */
export function diffFelder<T extends object>(
  vorher: T | null | undefined,
  nachher: T | null | undefined,
  felder: Array<keyof T & string>,
): FeldDiff {
  const diff: FeldDiff = {};
  const v = (vorher ?? {}) as Record<string, unknown>;
  const n = (nachher ?? {}) as Record<string, unknown>;
  for (const feld of felder) {
    const alt = v[feld];
    const neu = n[feld];
    if (JSON.stringify(alt ?? null) !== JSON.stringify(neu ?? null)) {
      diff[feld] = { alt: alt ?? null, neu: neu ?? null };
    }
  }
  return diff;
}

/** true, wenn der Diff mindestens ein geändertes Feld enthält. */
export function hatAenderung(diff: FeldDiff): boolean {
  return Object.keys(diff).length > 0;
}

/** Zerlegt einen FeldDiff in getrennte vorher/nachher-Objekte (nur geänderte Felder). */
export function diffToVorherNachher(diff: FeldDiff): { vorher: Record<string, unknown>; nachher: Record<string, unknown> } {
  const vorher: Record<string, unknown> = {};
  const nachher: Record<string, unknown> = {};
  for (const [feld, { alt, neu }] of Object.entries(diff)) {
    vorher[feld] = alt;
    nachher[feld] = neu;
  }
  return { vorher, nachher };
}

/**
 * Bequemer Update-Audit: berechnet den Diff der Kernfelder und protokolliert
 * `vorher`/`nachher` NUR, wenn sich mindestens ein Feld geändert hat.
 * (Der Eintrag wird immer geschrieben — auch ohne Feldänderung, als Nachweis
 * der Bearbeitung; dann ohne Diff.)
 */
export async function auditUpdate<T extends object>(
  c: Context,
  opts: {
    aktion: string;
    objektTyp: AuditObjektTyp;
    objektId?: string;
    vorgangId?: string;
    before: T | null | undefined;
    after: T | null | undefined;
    felder: Array<keyof T & string>;
    detail?: string;
  },
): Promise<void> {
  const diff = diffFelder(opts.before, opts.after, opts.felder);
  const { vorher, nachher } = diffToVorherNachher(diff);
  await audit(c, {
    aktion: opts.aktion,
    objektTyp: opts.objektTyp,
    objektId: opts.objektId,
    vorgangId: opts.vorgangId,
    detail: opts.detail,
    vorher: hatAenderung(diff) ? vorher : undefined,
    nachher: hatAenderung(diff) ? nachher : undefined,
  });
}
