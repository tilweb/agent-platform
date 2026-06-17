/**
 * Podcast-Repurposing — App Configuration.
 *
 * Iteration 1: Podcast-Video hochladen → Transkript → Social-Posts, Blogpost,
 * Danke-Mail + Visuals erzeugen und im UI prüfen/editieren/neu generieren.
 * Publishing (geteiltes Marken-Konto) + Analytics: spätere Phasen.
 */

import type { AppConfig } from '../types';

export const podcastRepurposingConfig: AppConfig = {
  id: 'podcast-repurposing',
  name: 'Podcast-Repurposing',
  description: 'Podcast-Video in Social-Posts, Blog, Mail & Visuals überführen',
  icon: 'sparkles',
  version: '1.0.0',
  enabled: false, // Admin schaltet ein
  routes: [
    { path: '/apps/podcast-repurposing',           component: 'EpisodesListPage' },
    { path: '/apps/podcast-repurposing/upload',     component: 'UploadPage' },
    { path: '/apps/podcast-repurposing/settings',   component: 'SettingsPage' },
    { path: '/apps/podcast-repurposing/:id',        component: 'EpisodeDetailPage' },
  ],
  publicFunctions: [],
};

export { podcastRepurposingRoutes } from './routes';
