/**
 * Echo-Loop App — RPA-Prozess-Reifegradanalyse (EMMA Studio).
 * Baustein a (RGA-Analyzer) + Fundament (Kunde/Prozess/Baustand).
 */
import type { AppConfig } from '../types';

export const echoloopConfig: AppConfig = {
  id: 'echoloop',
  name: 'Echo-Loop',
  description: 'RPA-Prozesse analysieren, benoten (Reifegrad) und härten',
  icon: 'echoloop',
  version: '0.1.0',
  enabled: true,
  routes: [
    { path: '/apps/echoloop', component: 'EcholoopPage' },
    { path: '/apps/echoloop/prozess/:id', component: 'ProzessDetail' },
  ],
};

export { echoloopRoutes } from './routes';
export * from './types';
export * from './storage';
export * from './scoring';
export * from './analysis';
