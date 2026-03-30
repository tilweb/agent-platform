/**
 * VSM App - Value Stream Mapping
 * Entry point and configuration export
 */

import type { AppConfig } from '../types';

export const vsmConfig: AppConfig = {
  id: 'vsm',
  name: 'Value Stream Mapping',
  description: 'Wertströme erfassen, visualisieren und KI-gestützt analysieren',
  icon: 'vsm',
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/vsm', component: 'VsmPage' },
    { path: '/apps/vsm/:id', component: 'VsmDetailPage' },
  ],
};

export { vsmRoutes } from './routes';
export * from './service';
export * from './storage';
