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
export * from './types';
export * from './analysis';
// Re-export storage items not already exported from service
export {
  getProjektauftrag,
  getProjektauftraege,
  deleteProjektauftrag,
  saveProjektauftrag,
  getVorlage,
  getVorlagen,
  saveVorlage,
  deleteVorlage,
  generateProjektauftragId,
  initializeStorage,
} from './storage';
