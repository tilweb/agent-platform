/**
 * Grundsicherung — Route-Aggregator. App-Access-Gate für ALLE Endpunkte.
 * Fall-Chat folgt in einer späteren Welle.
 */
import { Hono } from 'hono';
import { requireAppAccess } from '../permissions-middleware';
import { aktenRoutes } from './routes/akten';
import { vorgaengeRoutes } from './routes/vorgaenge';
import { personenRoutes } from './routes/personen';
import { dokumenteRoutes } from './routes/dokumente';
import { pruefschritteRoutes } from './routes/pruefschritte';
import { feldstatusRoutes } from './routes/feldstatus';
import { notizenRoutes } from './routes/notizen';
import { textbausteineRoutes } from './routes/textbausteine';
import { aufgabenRoutes } from './routes/aufgaben';
import { auditRoutes } from './routes/audit';
import { sachbearbeitungRoutes } from './routes/sachbearbeitung';
import { posteingangQueueRoutes } from './routes/posteingang-queue';
import { schreibenRoutes } from './routes/schreiben';

const grundsicherung = new Hono();

grundsicherung.use('*', requireAppAccess('grundsicherung'));

grundsicherung.route('/', aktenRoutes);
grundsicherung.route('/', vorgaengeRoutes);
grundsicherung.route('/', personenRoutes);
grundsicherung.route('/', dokumenteRoutes);
grundsicherung.route('/', pruefschritteRoutes);
grundsicherung.route('/', feldstatusRoutes);
grundsicherung.route('/', notizenRoutes);
grundsicherung.route('/', textbausteineRoutes);
grundsicherung.route('/', aufgabenRoutes);
grundsicherung.route('/', auditRoutes);
grundsicherung.route('/', sachbearbeitungRoutes);
grundsicherung.route('/', posteingangQueueRoutes);
grundsicherung.route('/', schreibenRoutes);

export { grundsicherung as grundsicherungRoutes };
