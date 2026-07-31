/**
 * Gemeinsame App-Level-Berechtigungs-Gates. `requireAppAccess('echoloop')`
 * (im Aggregator) hat `appRole` bereits in den Context gesetzt.
 */
import type { Context } from 'hono';

type AppRole = 'owner' | 'editor' | 'viewer';

/** Editor- oder Owner-Rolle erforderlich (Schreiboperationen). */
export function denyIfNotAppEditor(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AppRole | undefined;
  if (appRole !== 'owner' && appRole !== 'editor') {
    return { error: 'App-Editor- oder -Owner-Rolle erforderlich.' };
  }
  return null;
}
