/**
 * Generic OAuth Config Resolver
 *
 * Replaces per-provider config functions (getConfluenceConfig, etc.)
 * by reading static OAuth URLs/scopes from manifests and dynamic
 * credentials from encrypted plugin config storage.
 */

import type { OAuth2Config } from '../connections/types';
import { pluginRegistry } from './registry';
import { resolvePluginConfig } from './configStorage';

/**
 * Resolve a complete OAuth2Config for a plugin by combining
 * manifest data (static URLs/scopes) with stored credentials.
 */
export async function resolveOAuthConfig(pluginId: string): Promise<OAuth2Config> {
  const manifest = pluginRegistry.getManifest(pluginId);
  const oauth = manifest?.connector?.oauth;

  if (!oauth) {
    throw new Error(`Plugin "${pluginId}": manifest not loaded or missing connector.oauth section`);
  }

  const config = manifest.configSchema
    ? await resolvePluginConfig(pluginId, manifest.configSchema)
    : null;

  const clientId = config?.clientId;
  const clientSecret = config?.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error(
      `Plugin "${pluginId}": OAuth credentials not configured. Configure via Admin-UI under Connections.`
    );
  }

  return {
    authorizationUrl: oauth.authorizationUrl,
    tokenUrl: oauth.tokenUrl,
    clientId,
    clientSecret,
    scopes: oauth.scopes,
    additionalAuthParams: oauth.additionalAuthParams,
    additionalTokenParams: oauth.additionalTokenParams,
  };
}
