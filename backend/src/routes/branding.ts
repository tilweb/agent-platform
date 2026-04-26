/**
 * Branding endpoint — public, unauth'd.
 *
 * Liefert pro Customer-Environment den Title, optional ein Logo und einen
 * Login-Subtitle. Konfiguration via ENV (PLATFORM_TITLE, PLATFORM_LOGO_URL,
 * PLATFORM_LOGIN_SUBTITLE). Defaults entsprechen dem Standard-Workplace.
 *
 * Wird beim App-Boot vom Frontend einmal abgefragt und in einen Context
 * gepackt — keine Auth, kein Rate-Limit notwendig.
 */

import { Hono } from 'hono';

const router = new Hono();

router.get('/', (c) => {
  return c.json({
    title: process.env.PLATFORM_TITLE || 'Workplace',
    logoUrl: process.env.PLATFORM_LOGO_URL || null,
    loginSubtitle: process.env.PLATFORM_LOGIN_SUBTITLE || null,
  });
});

export { router as brandingRoutes };
