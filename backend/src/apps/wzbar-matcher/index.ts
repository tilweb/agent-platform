/**
 * WZ-Branchen-Matcher App Configuration
 */

import { APP_ID, type AppConfig } from './platform';
import { classifyPublicFunction, getNeighborhoodPublicFunction } from './public-functions';

export const wzbarMatcherConfig: AppConfig = {
  id: APP_ID,
  name: 'WZ-Branchen-Matcher',
  description: 'Tätigkeitsbeschreibung → passender WZ-2025-Schlüssel für EMMA',
  icon: 'classifier',
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/wzbar-matcher', component: 'MatcherPage' },
  ],
  publicFunctions: [classifyPublicFunction, getNeighborhoodPublicFunction],
};

export { wzbarMatcherRoutes } from './routes';
