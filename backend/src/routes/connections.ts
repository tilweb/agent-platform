/**
 * Connection Routes
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId, getCurrentUser } from '../auth';
import {
  connectionRegistry,
  saveConnection,
  loadConnection,
  deleteConnection,
  saveOAuthState,
  loadOAuthState,
  deleteOAuthState,
  isEncryptionConfigured,
  getProviderEnabledMap,
  setProviderEnabled,
} from '../connections';
import type { OAuthState, TokenSet } from '../connections';

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
    const all = await connectionRegistry.getProviderInfos(userId);

    // User-Ansicht ("Meine Verbindungen"): IMMER nur freigeschaltete Provider —
    // auch fuer Admins. Die vollstaendige Liste + Toggle gibt es im Admin-View
    // ueber GET /admin/providers.
    const providers = all.filter((p) => p.enabledForUsers);

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
 * GET /api/connections/admin/providers - Alle Provider + Freischalt-Status (Admin)
 * MUSS vor GET /:id registriert sein, sonst matcht /:id "admin".
 */
connectionRoutes.get('/admin/providers', authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  try {
    const providers = await connectionRegistry.getProviderInfos();
    return c.json({ providers });
  } catch (error: any) {
    console.error('Admin list providers error:', error);
    return c.json({ error: 'Failed to list providers' }, 500);
  }
});

/**
 * PUT /api/connections/admin/providers/:id/enabled - Provider fuer User freischalten (Admin)
 */
connectionRoutes.put('/admin/providers/:id/enabled', authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  if (user?.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  const providerId = c.req.param('id');
  try {
    if (!connectionRegistry.has(providerId)) {
      return c.json({ error: 'Provider not found' }, 404);
    }
    const body = await c.req.json().catch(() => ({} as { enabled?: boolean }));
    const enabled = !!body.enabled;
    await setProviderEnabled(providerId, enabled);
    return c.json({ providerId, enabledForUsers: enabled });
  } catch (error: any) {
    console.error('Admin set provider enabled error:', error);
    return c.json({ error: 'Failed to update provider' }, 500);
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
        ...(provider.authType === 'client-credentials' && typeof provider.getCredentialFields === 'function'
          ? { credentialFields: provider.getCredentialFields() }
          : {}),
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

    // Nicht-Admins duerfen nur fuer User freigeschaltete Provider verbinden.
    const user = getCurrentUser(c);
    if (user?.role !== 'admin') {
      const enabledMap = await getProviderEnabledMap();
      if (!enabledMap[providerId]) {
        return c.json({ error: 'Diese Verbindung ist nicht freigeschaltet.' }, 403);
      }
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

    // Get auth URL (may include PKCE verifier)
    const authResult = provider.getAuthUrl(state, redirectUri);
    const authUrl = typeof authResult === 'string' ? authResult : authResult.url;
    const codeVerifier = typeof authResult === 'string' ? undefined : authResult.codeVerifier;

    // Save state for validation (including PKCE verifier if present)
    const now = new Date();
    const oauthState: OAuthState = {
      providerId,
      userId,
      redirectUri,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_EXPIRY_MS).toISOString(),
      ...(codeVerifier ? { codeVerifier } : {}),
    };

    await saveOAuthState(state, oauthState);

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

  // Implicit flow: token is in URL fragment (not visible to server)
  // Serve a JS page that extracts the token and posts it back
  if (!code && !state && !error) {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const html = `
<!DOCTYPE html>
<html>
<head><title>OAuth</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
  .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  h1 { margin: 0 0 0.5rem; }
  p { color: #666; margin: 0; }
</style>
</head>
<body>
<div class="container">
  <div class="icon" id="icon">⏳</div>
  <h1 id="title">Verbinde...</h1>
  <p id="msg">Bitte warten</p>
</div>
<script>
(async function() {
  const fullUrl = window.location.href;
  const hash = window.location.hash.substring(1);
  document.getElementById('msg').textContent = 'URL: ' + fullUrl.substring(0, 150);
  if (!hash) {
    document.getElementById('icon').textContent = '✗';
    document.getElementById('title').style.color = '#ef4444';
    document.getElementById('title').textContent = 'Fehler';
    document.getElementById('msg').textContent = 'Kein Fragment in URL: ' + fullUrl.substring(0, 200);
    return;
  }
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const tokenType = params.get('token_type') || 'Bearer';
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  if (!accessToken || !state) {
    document.getElementById('icon').textContent = '✗';
    document.getElementById('title').style.color = '#ef4444';
    document.getElementById('title').textContent = 'Fehler';
    document.getElementById('msg').textContent = 'Token oder State fehlt.';
    return;
  }

  try {
    const res = await fetch('${baseUrl}/api/connections/${providerId}/implicit-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accessToken, tokenType, expiresIn: expiresIn ? parseInt(expiresIn) : null, state })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('icon').textContent = '✓';
      document.getElementById('title').style.color = '#10b981';
      document.getElementById('title').textContent = 'Connected!';
      document.getElementById('msg').textContent = 'Fenster schliesst automatisch.';
      if (window.opener) {
        window.opener.postMessage({ type: 'oauth_callback', success: true, providerId: '${providerId}' }, '*');
        setTimeout(() => window.close(), 2000);
      }
    } else {
      throw new Error(data.error || 'Verbindung fehlgeschlagen');
    }
  } catch (e) {
    document.getElementById('icon').textContent = '✗';
    document.getElementById('title').style.color = '#ef4444';
    document.getElementById('title').textContent = 'Fehler';
    document.getElementById('msg').textContent = e.message;
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth_callback', success: false, providerId: '${providerId}', message: e.message }, '*');
    }
  }
})();
</script>
</body>
</html>`;
    return c.html(html);
  }

  // Authorization Code flow: validate required params
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

    // Exchange code for tokens (with PKCE verifier if present)
    const tokens = await provider.exchangeCode(code, oauthState.redirectUri, oauthState.codeVerifier);

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
 * POST /api/connections/:id/implicit-callback - Receive token from implicit OAuth flow
 * The token is extracted from the URL fragment by client-side JavaScript
 */
connectionRoutes.post('/:id/implicit-callback', async (c) => {
  const providerId = c.req.param('id');

  try {
    const body = await c.req.json() as {
      accessToken: string;
      tokenType: string;
      expiresIn: number | null;
      state: string;
    };

    if (!body.accessToken || !body.state) {
      return c.json({ error: 'Missing token or state' }, 400);
    }

    // Validate state
    const oauthState = await loadOAuthState(body.state);
    if (!oauthState) {
      return c.json({ error: 'Invalid or expired state' }, 400);
    }

    if (oauthState.providerId !== providerId) {
      return c.json({ error: 'Provider mismatch' }, 400);
    }

    // Delete state (one-time use)
    await deleteOAuthState(body.state);

    // Build token set
    const tokens: TokenSet = {
      accessToken: body.accessToken,
      tokenType: body.tokenType || 'Bearer',
      expiresAt: body.expiresIn
        ? new Date(Date.now() + body.expiresIn * 1000).toISOString()
        : undefined,
    };

    // Get provider and validate
    const provider = connectionRegistry.get(providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    const status = await provider.validateConnection(tokens);
    console.log(`[Implicit callback] ${providerId} validation:`, status.status, status.error || '');

    // Save connection
    await saveConnection(oauthState.userId, providerId, tokens, status);

    return c.json({ success: status.status === 'connected' });
  } catch (err: any) {
    console.error('Implicit callback error:', err);
    return c.json({ error: 'Token processing failed' }, 500);
  }
});

/**
 * POST /api/connections/:id/credentials - Connect via Client-Credentials / API-Key
 *
 * Wird fuer Provider mit authType='client-credentials' verwendet (z.B. Personio).
 * Body: vom Provider-getCredentialFields() definierte Felder (key/value).
 * Backend ruft provider.connect() auf, validiert, speichert.
 */
connectionRoutes.post('/:id/credentials', authMiddleware, async (c) => {
  const providerId = c.req.param('id');
  const userId = getCurrentUserId(c)!;

  try {
    if (!isEncryptionConfigured()) {
      return c.json({
        error: 'Encryption not configured. Set CONNECTION_ENCRYPTION_KEY environment variable.',
      }, 500);
    }

    const provider = connectionRegistry.get(providerId);
    if (!provider) {
      return c.json({ error: 'Provider not found' }, 404);
    }

    // Nicht-Admins duerfen nur fuer User freigeschaltete Provider verbinden.
    const user = getCurrentUser(c);
    if (user?.role !== 'admin') {
      const enabledMap = await getProviderEnabledMap();
      if (!enabledMap[providerId]) {
        return c.json({ error: 'Diese Verbindung ist nicht freigeschaltet.' }, 403);
      }
    }

    if (provider.authType !== 'client-credentials') {
      return c.json({ error: 'Provider does not support credentials-based connect' }, 400);
    }
    if (typeof provider.connect !== 'function') {
      return c.json({ error: 'Provider has no connect() implementation' }, 500);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;
    // Nur Strings akzeptieren — wir wollen keine geschachtelten Strukturen.
    const input: Record<string, string> = {};
    for (const [key, val] of Object.entries(body)) {
      if (typeof val === 'string') input[key] = val;
    }

    let tokens: TokenSet;
    try {
      tokens = await provider.connect(input);
    } catch (err: any) {
      console.warn(`[Credentials] ${providerId} connect failed:`, err.message);
      return c.json({ error: err.message || 'Connect failed' }, 400);
    }

    const status = await provider.validateConnection(tokens);
    console.log(`[Credentials] ${providerId} validation:`, status.status, status.error || '');

    if (status.status !== 'connected') {
      return c.json({ error: status.error || 'Connection validation failed' }, 400);
    }

    await saveConnection(userId, providerId, tokens, status);

    return c.json({ success: true, status });
  } catch (err: any) {
    console.error('Credentials connect error:', err);
    return c.json({ error: 'Failed to establish connection' }, 500);
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
