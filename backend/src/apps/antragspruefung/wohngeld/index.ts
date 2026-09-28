/**
 * Wohngeld-Antragsassistent — App-Config.
 *
 * Assistenz für die Vollständigkeits- und Plausibilitätsprüfung von Wohngeldanträgen
 * (Posteingang → Vorgang → Prüfung/Nachforderung). Human-in-the-Loop, keine Betragsberechnung.
 */
import type { AppConfig } from '../../types';

export const wohngeldConfig: AppConfig = {
  id: 'wohngeld',
  name: 'Wohngeld',
  description: 'Wohngeldanträge auf Vollständigkeit und Plausibilität prüfen und Nachforderungen erstellen',
  icon: 'wohngeld',
  version: '0.1.0',
  // Admin schaltet ein (gepflegtes `enabled` bleibt beim Registry-Abgleich erhalten) — so erscheint die
  // App auf Instanzen ohne ENABLED_APPS-Whitelist nicht ungewollt beim nächsten Deployment.
  enabled: false,
  routes: [
    { path: '/apps/wohngeld', component: 'WohngeldPage' },
    { path: '/apps/wohngeld/vorgang/:id', component: 'VorgangDetail' },
    { path: '/apps/wohngeld/posteingang', component: 'PosteingangPage' },
    { path: '/apps/wohngeld/posteingang/:id', component: 'PosteingangDetail' },
  ],
};

export { wohngeldRoutes } from './routes';
export * from './types';
export * from './storage';
