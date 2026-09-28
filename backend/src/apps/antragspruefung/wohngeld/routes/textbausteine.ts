/**
 * Wohngeld — Textbausteine für Anforderungsschreiben (WP6).
 *
 *  - GET    /textbausteine            → { textbausteine }
 *  - POST   /textbausteine            { kategorie, titel, text } → { textbaustein }
 *  - PUT    /textbausteine/:id        { kategorie?, titel?, text? } → { textbaustein }
 *  - DELETE /textbausteine/:id        → { ok }
 */
import { Hono } from 'hono';
import { listTextbausteine, createTextbaustein, updateTextbaustein, loescheTextbaustein } from '../storage';
import { denyIfNotAppEditor } from './_shared';
import { audit } from '../audit';

export const textbausteineRoutes = new Hono();

textbausteineRoutes.get('/textbausteine', async (c) => {
  return c.json({ textbausteine: await listTextbausteine() });
});

textbausteineRoutes.post('/textbausteine', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ kategorie?: string; titel?: string; text?: string }>().catch(() => null);
  if (!body?.titel?.trim()) return c.json({ error: 'titel ist erforderlich' }, 400);
  if (!body?.text?.trim()) return c.json({ error: 'text ist erforderlich' }, 400);
  const textbaustein = await createTextbaustein({
    kategorie: (body.kategorie || 'Allgemein').trim(), titel: body.titel.trim(), text: body.text.trim(),
  });
  await audit(c, { aktion: 'textbaustein.erstellt', objektTyp: 'textbaustein', objektId: textbaustein.id, detail: textbaustein.titel });
  return c.json({ textbaustein }, 201);
});

textbausteineRoutes.put('/textbausteine/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ kategorie?: string; titel?: string; text?: string }>().catch(() => ({} as { kategorie?: string; titel?: string; text?: string }));
  const textbaustein = await updateTextbaustein(c.req.param('id'), {
    kategorie: body?.kategorie?.trim(), titel: body?.titel?.trim(), text: body?.text?.trim(),
  });
  if (!textbaustein) return c.json({ error: 'Textbaustein nicht gefunden' }, 404);
  await audit(c, { aktion: 'textbaustein.geaendert', objektTyp: 'textbaustein', objektId: textbaustein.id, detail: textbaustein.titel });
  return c.json({ textbaustein });
});

textbausteineRoutes.delete('/textbausteine/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const ok = await loescheTextbaustein(id);
  if (ok) await audit(c, { aktion: 'textbaustein.geloescht', objektTyp: 'textbaustein', objektId: id });
  return ok ? c.json({ ok: true }) : c.json({ error: 'Textbaustein nicht gefunden' }, 404);
});
