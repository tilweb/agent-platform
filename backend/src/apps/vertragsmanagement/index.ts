/**
 * Vertragsmanagement App Configuration
 * Contract management app entry point
 */

import type { AppConfig } from '../types';

export const vertragsmanagementConfig: AppConfig = {
  id: 'vertragsmanagement',
  name: 'Vertragsmanagement',
  description: 'Verträge hochladen, analysieren und verwalten',
  icon: 'contract',
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/vertragsmanagement', component: 'ContractsPage' },
    { path: '/apps/vertragsmanagement/upload', component: 'UploadPage' },
    { path: '/apps/vertragsmanagement/:id', component: 'ContractDetail' },
  ],
};

export { contractRoutes } from './routes';
export * from './service';
export * from './storage';
