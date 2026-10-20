/**
 * Akteur einer Anfrage für Arbeit, die außerhalb des HTTP-Requests läuft (Hintergrund-Job im Worker-Prozess).
 *
 * Audit (`audit(c, e)`) und Verteilung lesen den Akteur aus dem Hono-Context. Ein Job hat keinen Request — der
 * Akteur wird beim Einstellen serialisiert und im Job als schmaler Ersatz-Context wiederhergestellt, damit die
 * Audit-Zeile dieselbe Person, Rolle und IP trägt wie bei der Auswertung im Request.
 */

import type { Context } from 'hono';
import { getCurrentUser, getCurrentUserId } from '../../../auth/middleware';

export interface Akteur {
  userId: string | null;
  displayName: string | null;
  username: string | null;
  appRole: string | null;
  ip: string | null;
}

export function akteurAusKontext(c: Context): Akteur {
  const user = getCurrentUser(c);
  const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    userId: getCurrentUserId(c) ?? null,
    displayName: user?.displayName ?? null,
    username: user?.username ?? null,
    appRole: (c.get('appRole') as string | undefined) ?? null,
    ip: fwd || c.req.header('x-real-ip') || null,
  };
}

/** Ersatz-Context mit genau dem, was Audit/Gates lesen: `get('user'|'userId'|'appRole')`, `req.header`. */
export function kontextFuerAkteur(a: Akteur): Context {
  const werte: Record<string, unknown> = {
    userId: a.userId ?? undefined,
    user: a.userId ? { id: a.userId, displayName: a.displayName ?? undefined, username: a.username ?? undefined } : undefined,
    appRole: a.appRole ?? undefined,
  };
  const header: Record<string, string | undefined> = { 'x-real-ip': a.ip ?? undefined };
  return {
    get: (k: string) => werte[k],
    set: (k: string, v: unknown) => { werte[k] = v; },
    req: { header: (n: string) => header[n.toLowerCase()] },
  } as unknown as Context;
}
