import { Hono } from 'hono';
import { listVorgaenge, listAkten } from '../storage';
import { aggregiereAufgaben } from '../aufgaben';

export const aufgabenRoutes = new Hono();

/**
 * Aufgaben-/Fristen-Übersicht: offene Todos + Wiedervorlagen/Fristen über alle Vorgänge,
 * überfällige zuerst. Heute-Datum serverseitig.
 */
aufgabenRoutes.get('/aufgaben', async (c) => {
  const heute = new Date().toISOString().slice(0, 10);
  const [vorgaenge, akten] = await Promise.all([listVorgaenge(), listAkten()]);
  return c.json({ aufgaben: aggregiereAufgaben(vorgaenge, akten, heute) });
});
