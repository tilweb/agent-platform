/**
 * Baustand-Routen: lesen, Review-Edit (Dimensionen → Kennzahlen serverseitig
 * neu berechnet), Freigabe (Mensch-Review-Gate), löschen. Plus stateless
 * /scoring für die Live-Neuberechnung im Reifegrad-Panel.
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { getCurrentUserId } from '../../../auth/middleware';
import { getBaustand, updateBaustand, deleteBaustand, listArtefakte, getProzess, getKunde } from '../storage';
import { renderReportHtml } from '../report';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';
import { computeScores, bewerteVereinbarungsGates } from '../scoring';
import { synthesizeNarrativ } from '../narrative';
import { generateBauanleitung } from '../bauanleitung';
import type { Baustand, Kennzahlen } from '../types';

export const baustaendeRoutes = new Hono();

/** Kennzahlen aus den Dimensionen ableiten (Single Source of Truth = scoring.ts). */
function kennzahlenAus(dimensionen: Baustand['dimensionen']): Kennzahlen {
  const s = computeScores(dimensionen ?? {});
  return { gesamtRg: s.gesamtRg, rgStar: s.rgStar, rgq: s.rgq, seQuotient: s.seQuotient, limiter: s.limiter, notenZeile: s.notenZeile };
}

/** Stateless: Dimensionen (+Gate-Nachweise) rein → Kennzahlen + Vereinbarungs-Gates raus (Panel-Live-Recompute). */
baustaendeRoutes.post('/scoring', async (c) => {
  const body = await c.req.json<{ dimensionen?: Baustand['dimensionen']; gateNachweise?: Baustand['gateNachweise'] }>();
  const dims = body?.dimensionen ?? ({} as Baustand['dimensionen']);
  return c.json({
    kennzahlen: kennzahlenAus(dims),
    gates: bewerteVereinbarungsGates(dims, body?.gateNachweise ?? {}),
  });
});

baustaendeRoutes.get('/baustaende/:id', async (c) => {
  const baustand = await getBaustand(c.req.param('id'));
  if (!baustand) return c.json({ error: 'Baustand nicht gefunden' }, 404);
  return c.json({ baustand });
});

/**
 * K1-Report als selbsttragendes HTML (Browser: Drucken → PDF; kein Renderer-Dep).
 * Kundenfassung + Bauanleitung + Kennzahlen + Zwei-Naturen-Gates in einem File.
 */
baustaendeRoutes.get('/baustaende/:id/report.html', async (c) => {
  const baustand = await getBaustand(c.req.param('id'));
  if (!baustand) return c.json({ error: 'Baustand nicht gefunden' }, 404);
  const prozess = baustand.prozessId ? await getProzess(baustand.prozessId) : null;
  const kunde = prozess?.kundeId ? await getKunde(prozess.kundeId) : null;
  const html = renderReportHtml({ kunde, prozess, baustand });
  return c.html(html);
});

baustaendeRoutes.put('/baustaende/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    delete (updates as Record<string, unknown>).prozessId;
    // Kennzahlen immer serverseitig aus den (ggf. neuen) Dimensionen ableiten
    if ((updates as Partial<Baustand>).dimensionen) {
      (updates as Partial<Baustand>).kennzahlen = kennzahlenAus((updates as Partial<Baustand>).dimensionen!);
    }
    const baustand = await updateBaustand(c.req.param('id'), updates as Partial<Baustand>, { expectedVersion, force });
    if (!baustand) return c.json({ error: 'Baustand nicht gefunden' }, 404);
    return c.json({ baustand });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

/** Mensch-Review-Gate: Baustand freigeben (entwurf/in_review → freigegeben). */
baustaendeRoutes.post('/baustaende/:id/freigabe', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number }>().catch(() => ({} as { expectedVersion?: number }));
    const existing = await getBaustand(c.req.param('id'));
    if (!existing) return c.json({ error: 'Baustand nicht gefunden' }, 404);
    const baustand = await updateBaustand(
      c.req.param('id'),
      { status: 'freigegeben', reviewerId: getCurrentUserId(c) },
      { expectedVersion: body?.expectedVersion },
    );
    return c.json({ baustand });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Freigabe fehlgeschlagen' }, 500);
  }
});

/**
 * Kundenfähige Narrativ-Synthese (Reasoning-Modell) — on-demand, SSE mit
 * Heartbeat (kann Minuten dauern). Speichert das Narrativ am Baustand.
 */
baustaendeRoutes.post('/baustaende/:id/narrativ', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const baustand = await getBaustand(c.req.param('id'));
  if (!baustand) return c.json({ error: 'Baustand nicht gefunden' }, 404);

  // Prozess-Export-Text aus den Artefakten zusammensetzen
  const artefakte = await listArtefakte(baustand.prozessId);
  const prozessText = artefakte
    .map((a) => (a.data as { extractedText?: string } | null)?.extractedText ?? '')
    .filter(Boolean)
    .join('\n\n');
  const userId = getCurrentUserId(c);

  return streamSSE(c, async (stream) => {
    const t0 = Date.now();
    let done = false;
    const heartbeat = setInterval(() => {
      if (!done) void stream.writeSSE({ event: 'heartbeat', data: JSON.stringify({ elapsedMs: Date.now() - t0 }) });
    }, 5000);
    try {
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ modell: 'reasoning' }) });
      const narrativ = await synthesizeNarrativ({ baustand, prozessText, userId });
      const updated = await updateBaustand(baustand.id, { narrativ }, { force: true });
      done = true;
      clearInterval(heartbeat);
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ baustand: updated }) });
    } catch (err) {
      done = true;
      clearInterval(heartbeat);
      console.error('[echoloop] Narrativ-Synthese fehlgeschlagen:', err);
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: err instanceof Error ? err.message : 'Narrativ-Synthese fehlgeschlagen' }) });
    }
  });
});

/**
 * Bauanleitung generieren (Instruct, D-061 interaktiv) — priorisierte Maßnahmen
 * zum Ziel-Reifegrad. Ersetzt eine bestehende Bauanleitung; abgehakte Stände
 * werden über PUT /baustaende/:id { bauanleitung } gespeichert.
 */
baustaendeRoutes.post('/baustaende/:id/bauanleitung', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const baustand = await getBaustand(c.req.param('id'));
  if (!baustand) return c.json({ error: 'Baustand nicht gefunden' }, 404);
  const body = await c.req.json<{ zielLevel?: number }>().catch(() => ({} as { zielLevel?: number }));
  try {
    const bauanleitung = await generateBauanleitung({ baustand, zielLevel: body?.zielLevel, userId: getCurrentUserId(c) });
    const updated = await updateBaustand(baustand.id, { bauanleitung }, { force: true });
    return c.json({ baustand: updated });
  } catch (err) {
    console.error('[echoloop] Bauanleitung-Generierung fehlgeschlagen:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Bauanleitung fehlgeschlagen' }, 500);
  }
});

baustaendeRoutes.delete('/baustaende/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteBaustand(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Baustand nicht gefunden' }, 404);
});
