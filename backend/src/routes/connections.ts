/**
 * Connection Routes
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth';
import {
  connectionRegistry,
  saveConnection,
  loadConnection,
  deleteConnection,
  saveOAuthState,
  loadOAuthState,
  deleteOAuthState,
  isEncryptionConfigured,
} from '../connections';
import type { OAuthState } from '../connections';

const connectionRoutes = new Hono();

// OAuth state expiration (10 minutes)
const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

// Allowed redirect URI hosts (whitelist)
const ALLOWED_REDIRECT_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  // Add production domains here
  ...(process.env.ALLOWED_OAUTH_HOSTS?.split(',').map(h => h.trim()) || []),
]);

/**
 * Validate that a URL is safe to use as OAuth redirect
 */
function validateRedirectUri(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);

    // Must be HTTPS in production (allow HTTP for localhost)
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
        console.warn('[OAuth] Non-HTTPS redirect URI rejected:', baseUrl);
        return false;
      }
    }

    // Host must be in whitelist
    if (!ALLOWED_REDIRECT_HOSTS.has(url.hostname)) {
      console.warn('[OAuth] Redirect URI host not in whitelist:', url.hostname);
      return false;
    }

    return true;
  } catch {
    console.warn('[OAuth] Invalid redirect URI:', baseUrl);
    return false;
  }
}

/**
 * Generate a secure random state for OAuth
 */
function generateOAuthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * GET /api/connections - List all providers with user's connection status
 */
connectionRoutes.get('/', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const providers = await connectionRegistry.getProviderInfos(userId);

    return c.json({
      providers,
      encryptionConfigured: isEncryptionConfigured(),
    });
  } catch (error: any) {
    console.error('List connections error:', error);
    return c.json({ error: 'Failed to list connections' }, 500);
  }
});

/**
 * GET /api/connections/:id - Get provider info and connection status
 */
connectionRoutes.get('/:id', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const providerId = c.req.param('id');

    const provider = connectionRegistry.get(providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    const connection = await loadConnection(userId, providerId);

    return c.json({
      provider: {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        icon: provider.icon,
        authType: provider.authType,
      },
      connected: !!connection,
      status: connection?.connection.status || null,
    });
  } catch (error: any) {
    console.error('Get connection error:', error);
    return c.json({ error: 'Failed to get connection' }, 500);
  }
});

/**
 * GET /api/connections/:id/connect - Start OAuth flow
 */
connectionRoutes.get('/:id/connect', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const providerId = c.req.param('id');

    // Check encryption is configured
    if (!isEncryptionConfigured()) {
      return c.json({
        error: 'Encryption not configured. Set CONNECTION_ENCRYPTION_KEY environment variable.',
      }, 500);
    }

    const provider = connectionRegistry.get(providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    if (provider.authType !== 'oauth2') {
      return c.json({ error: 'Provider does not use OAuth' }, 400);
    }

    // Generate state and redirect URI
    const state = generateOAuthState();
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

    // Validate redirect URI base URL
    if (!validateRedirectUri(baseUrl)) {
      console.error('[OAuth] Invalid API_BASE_URL configuration:', baseUrl);
      return c.json({ error: 'OAuth configuration error' }, 500);
    }

    const redirectUri = `${baseUrl}/api/connections/${providerId}/callback`;

    // Save state for validation
    const now = new Date();
    const oauthState: OAuthState = {
      providerId,
      userId,
      redirectUri,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_EXPIRY_MS).toISOString(),
    };

    await saveOAuthState(state, oauthState);

    // Get auth URL
    const authUrl = provider.getAuthUrl(state, redirectUri);

    return c.json({ authUrl, state });
  } catch (error: any) {
    console.error('Start OAuth error:', error);
    return c.json({ error: 'Failed to start OAuth flow' }, 500);
  }
});

/**
 * GET /api/connections/:id/callback - OAuth callback handler
 */
connectionRoutes.get('/:id/callback', async (c) => {
  const providerId = c.req.param('id');
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Helper to send HTML response for popup
  const sendPopupResponse = (success: boolean, message?: string) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth ${success ? 'Success' : 'Error'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 { margin: 0 0 0.5rem; color: ${success ? '#10b981' : '#ef4444'}; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✓' : '✗'}</div>
    <h1>${success ? 'Connected!' : 'Connection Failed'}</h1>
    <p>${message || (success ? 'You can close this window.' : 'Please try again.')}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'oauth_callback',
        success: ${success},
        providerId: '${providerId}',
        ${message ? `message: '${message.replace(/'/g, "\\'")}'` : ''}
      }, '*');
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>
    `;
    return c.html(html);
  };

  // Handle OAuth errors
  if (error) {
    // Log detailed error server-side, show generic message to client
    console.error(`OAuth error for ${providerId}:`, error, errorDescription);
    return sendPopupResponse(false, 'Autorisierung fehlgeschlagen. Bitte erneut versuchen.');
  }

  // Validate required params
  if (!code || !state) {
    return sendPopupResponse(false, 'Missing code or state parameter');
  }

  try {
    // Validate state
    const oauthState = await loadOAuthState(state);
    if (!oauthState) {
      return sendPopupResponse(false, 'Invalid or expired state');
    }

    if (oauthState.providerId !== providerId) {
      return sendPopupResponse(false, 'Provider mismatch');
    }

    // Delete state (one-time use)
    await deleteOAuthState(state);

    // Get provider
    const provider = connectionRegistry.get(providerId);
    if (!provider) {
      return sendPopupResponse(false, 'Provider not found');
    }

    // Exchange code for tokens
    const tokens = await provider.exchangeCode(code, oauthState.redirectUri);

    // Validate connection to get user info
    const status = await provider.validateConnection(tokens);
    console.log(`[OAuth callback] ${providerId} validation result:`, status.status, status.error || '');

    // Save connection
    await saveConnection(oauthState.userId, providerId, tokens, status);

    return sendPopupResponse(true);
  } catch (err: any) {
    // Log detailed error server-side, show generic message to client
    console.error('OAuth callback error:', err);
    return sendPopupResponse(false, 'Verbindung fehlgeschlagen. Bitte erneut versuchen.');
  }
});

/**
 * POST /api/connections/:id/disconnect - Disconnect a provider
 */
connectionRoutes.post('/:id/disconnect', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const providerId = c.req.param('id');

    const deleted = await deleteConnection(userId, providerId);

    if (!deleted) {
      return c.json({ error: 'Connection not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Disconnect error:', error);
    return c.json({ error: 'Failed to disconnect' }, 500);
  }
});

/**
 * GET /api/connections/:id/status - Check connection status
 */
connectionRoutes.get('/:id/status', authMiddleware, async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const providerId = c.req.param('id');

    const status = await connectionRegistry.validateConnection(userId, providerId);

    if (!status) {
      return c.json({ connected: false });
    }

    return c.json({
      connected: status.status === 'connected',
      status,
    });
  } catch (error: any) {
    console.error('Check status error:', error);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

export { connectionRoutes };
