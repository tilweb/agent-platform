/**
 * GET /sachbearbeitung — Auswahlliste für die Zuweisung (Nutzer mit Bearbeitungsrecht) + eigene ID.
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { ladeSachbearbeitung } from '../sachbearbeitung';

export const sachbearbeitungRoutes = new Hono();

sachbearbeitungRoutes.get('/sachbearbeitung', async (c) => {
  return c.json({ nutzer: await ladeSachbearbeitung(), ich: getCurrentUserId(c) ?? null });
});
