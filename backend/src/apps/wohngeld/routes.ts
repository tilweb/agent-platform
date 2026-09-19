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

const wohngeld = new Hono();

wohngeld.use('*', requireAppAccess('wohngeld'));

wohngeld.route('/', aktenRoutes);
wohngeld.route('/', vorgaengeRoutes);
wohngeld.route('/', personenRoutes);
wohngeld.route('/', dokumenteRoutes);
wohngeld.route('/', pruefschritteRoutes);
wohngeld.route('/', schreibenRoutes);

export { wohngeld as wohngeldRoutes };
