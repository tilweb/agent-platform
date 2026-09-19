import type { Context } from 'hono';

type AppRole = 'owner' | 'editor' | 'viewer';

/** Editor-/Owner-Gate für Schreiboperationen. Gibt Fehlerobjekt zurück oder null. */
export function denyIfNotAppEditor(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AppRole | undefined;
  if (appRole !== 'owner' && appRole !== 'editor') {
    return { error: 'App-Editor- oder -Owner-Rolle erforderlich.' };
  }
  return null;
}
