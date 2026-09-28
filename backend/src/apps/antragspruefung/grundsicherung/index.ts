/**
 * Grundsicherung (SGB XII, 4. Kapitel) — App-Config.
 *
 * Assistenz für die Vollständigkeits- und Plausibilitätsprüfung von Anträgen auf Grundsicherung
 * im Alter und bei Erwerbsminderung. Human-in-the-Loop, keine Bedarfs- oder Zahlbetragsberechnung.
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md
 */
import type { AppConfig } from '../../types';

export const grundsicherungConfig: AppConfig = {
  id: 'grundsicherung',
  name: 'Grundsicherung',
  description: 'Anträge auf Grundsicherung im Alter und bei Erwerbsminderung auf Vollständigkeit und Plausibilität prüfen',
  icon: 'grundsicherung',
  version: '0.1.0',
  // Admin schaltet ein (noch im Aufbau; gepflegtes `enabled` bleibt beim Registry-Abgleich erhalten).
  enabled: false,
  routes: [
    { path: '/apps/grundsicherung', component: 'GrundsicherungPage' },
    { path: '/apps/grundsicherung/vorgang/:id', component: 'VorgangDetail' },
    { path: '/apps/grundsicherung/posteingang', component: 'PosteingangPage' },
    { path: '/apps/grundsicherung/posteingang/:id', component: 'PosteingangDetail' },
  ],
};

// Routen bewusst NICHT hier re-exportiert: registry.ts importiert diese Datei, und die Routen
// ziehen über sachbearbeitung → permissions → registry einen Zyklus. Mount: routes/apps.ts
// importiert './grundsicherung/routes' direkt.
export * from './types';
export * from './storage';
