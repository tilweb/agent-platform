/**
 * Vorgangsmappe — App Configuration
 *
 * Schlanke Workplace-App fuer Cofermin (Rohstoff-Trader): Ueberblick aller
 * Dokumente eines Vorgangs (Auftragsbestaetigung) aus DocuWare. Reine View —
 * keine eigene DB-Persistenz. Zwei Such-Eingaenge: AB-Nummer (Format
 * AB26-xxxxx) und freie Suche mit LLM-NLU.
 */

import type { AppConfig } from '../types';

export const vorgangsmappeConfig: AppConfig = {
  id: 'vorgangsmappe',
  name: 'Vorgangsmappe',
  description: 'Doku-Uebersicht aller Vorgaenge — DocuWare-basiert',
  icon: 'briefcase',
  version: '1.0.0',
  enabled: false,        // Admin schaltet ein
  routes: [
    { path: '/apps/vorgangsmappe',            component: 'VorgangListPage' },
    { path: '/apps/vorgangsmappe/settings',   component: 'SettingsPage' },
    { path: '/apps/vorgangsmappe/:reference', component: 'VorgangDetailPage' },
  ],
  publicFunctions: [],   // Hook fuer spaeter (vorgang.get, vorgang.compliance_check)
};

export { vorgangsmappeRoutes } from './routes';
