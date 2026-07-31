/**
 * Echo-Loop Router-Aggregator. `requireAppAccess('echoloop')` gilt für alle
 * Endpunkte; die Sub-Router werden unter '/' gemountet.
 */
import { Hono } from 'hono';
import { requireAppAccess } from '../permissions-middleware';
import { kundenRoutes } from './routes/kunden';
import { prozesseRoutes } from './routes/prozesse';
import { baustaendeRoutes } from './routes/baustaende';
import { analyseRoutes } from './routes/analyse';

const echoloop = new Hono();

echoloop.use('*', requireAppAccess('echoloop'));

echoloop.route('/', kundenRoutes);
echoloop.route('/', prozesseRoutes);
echoloop.route('/', baustaendeRoutes);
echoloop.route('/', analyseRoutes);

export { echoloop as echoloopRoutes };
