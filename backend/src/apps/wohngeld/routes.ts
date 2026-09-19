/**
 * Wohngeld — Route-Aggregator. App-Access-Gate für ALLE Endpunkte.
 */
import { Hono } from 'hono';
import { requireAppAccess } from '../permissions-middleware';
import { aktenRoutes } from './routes/akten';
import { vorgaengeRoutes } from './routes/vorgaenge';
import { personenRoutes } from './routes/personen';
import { dokumenteRoutes } from './routes/dokumente';
import { pruefschritteRoutes } from './routes/pruefschritte';
import { schreibenRoutes } from './routes/schreiben';
import { posteingangRoutes } from './routes/posteingang';
import { chatRoutes } from './routes/chat';
import { feldstatusRoutes } from './routes/feldstatus';
import { notizenRoutes } from './routes/notizen';

const wohngeld = new Hono();

wohngeld.use('*', requireAppAccess('wohngeld'));

wohngeld.route('/', aktenRoutes);
wohngeld.route('/', vorgaengeRoutes);
wohngeld.route('/', personenRoutes);
wohngeld.route('/', dokumenteRoutes);
wohngeld.route('/', pruefschritteRoutes);
wohngeld.route('/', schreibenRoutes);
wohngeld.route('/', posteingangRoutes);
wohngeld.route('/', chatRoutes);
wohngeld.route('/', feldstatusRoutes);
wohngeld.route('/', notizenRoutes);

export { wohngeld as wohngeldRoutes };
