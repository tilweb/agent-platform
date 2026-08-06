/**
 * WZ-Branchen-Matcher App Configuration
 */

import type { AppConfig } from '../types';
import { classifyPublicFunction, getNeighborhoodPublicFunction } from './public-functions';

export const wzbarMatcherConfig: AppConfig = {
  id: 'wzbar-matcher',
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
