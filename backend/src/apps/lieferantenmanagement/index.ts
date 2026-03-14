/**
 * Lieferantenmanagement App Configuration
 * Supplier management app entry point
 */

import type { AppConfig } from '../types';

export const lieferantenmanagementConfig: AppConfig = {
  id: 'lieferantenmanagement',
  name: 'Lieferantenmanagement',
  description: 'Lieferanten bewerten, Risiken steuern und Compliance sicherstellen',
  icon: 'supplier',
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/lieferantenmanagement', component: 'LieferantenPage' },
    { path: '/apps/lieferantenmanagement/:id', component: 'SupplierDetailPage' },
  ],
};

export { lieferantenmanagementRoutes } from './routes';
export * from './service';
export * from './storage';
