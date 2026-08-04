/**
 * Projektmanagement App Configuration
 * KI PM-Assistent entry point
 */

import type { AppConfig } from '../types';

export const projektmanagementConfig: AppConfig = {
  id: 'projektmanagement',
  name: 'Projektmanagement',
  description: 'Projektaufträge erstellen, analysieren und verwalten',
  icon: 'briefcase',
  version: '1.0.0',
  enabled: true,
  routes: [
    { path: '/apps/projektmanagement', component: 'ProjektePage' },
    { path: '/apps/projektmanagement/neu', component: 'WizardPage' },
    { path: '/apps/projektmanagement/:id', component: 'WizardPage' },
  ],
};

export { projektmanagementRoutes } from './routes';
export * from './service';
export * from './storage';
export * from './types';
export * from './analysis';
// `updateProjektauftrag` wird sowohl von ./service (Wrapper) als auch ./storage
// exportiert — explizit die Service-Variante re-exportieren, um die Ambiguität
// aufzulösen (TS2308).
export { updateProjektauftrag } from './service';
