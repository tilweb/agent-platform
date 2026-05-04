/**
 * Connection Registry - Central management for connection providers
 */

import type { ConnectionProvider, ProviderInfo, ConnectionStatus, TokenSet } from './types';
import { loadConnection, listUserConnections, saveConnection, updateConnectionTokens } from './storage';
import { toolRegistry } from '../tools/registry';

class ConnectionRegistry {
  private providers = new Map<string, ConnectionProvider>();

  /**
   * Register a connection provider
   */
  register(provider: ConnectionProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`Connection provider "${provider.id}" is already registered, replacing...`);
    }

    this.providers.set(provider.id, provider);
    console.log(`Registered connection provider: ${provider.id} (${provider.authType})`);

    // Register provider's tools in the global tool registry
    const tools = provider.getTools();
    for (const tool of tools) {
      toolRegistry.register(tool);
    }
  }

  /**
   * Unregister a connection provider
   */
  unregister(id: string): boolean {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    // Unregister provider's tools
    const tools = provider.getTools();
    for (const tool of tools) {
      toolRegistry.unregister(tool.name);
    }

    return this.providers.delete(id);
  }

  /**
   * Get a provider by ID
   */
  get(id: string): ConnectionProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Check if a provider exists
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Get all registered providers
   */
  getAll(): ConnectionProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider IDs
   */
  getIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider info for the frontend (without sensitive data)
   */
  async getProviderInfos(userId?: string): Promise<ProviderInfo[]> {
    const infos: ProviderInfo[] = [];

    for (const provider of this.providers.values()) {
      const info: ProviderInfo = {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        icon: provider.icon,
        authType: provider.authType,
        setupGuide: provider.setupGuide,
      };

      // Setup-Felder bei Non-OAuth-Providern (z.B. Personio Client-Credentials)
      if (provider.authType === 'client-credentials' && typeof provider.getCredentialFields === 'function') {
        info.credentialFields = provider.getCredentialFields();
      }

      // Add connection status if userId is provided
      if (userId) {
        const connection = await loadConnection(userId, provider.id);
        if (connection) {
          info.status = connection.connection.status;
        }
      }

      infos.push(info);
    }

    return infos;
  }

  /**
   * Get tokens for a user's connection, refreshing if needed
   */
  async getTokens(userId: string, providerId: string): Promise<TokenSet | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return null;
    }

    const connection = await loadConnection(userId, providerId);
    if (!connection) {
      return null;
    }

    let { tokens } = connection;

    // Check if tokens are expired and need refresh
    if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
      if (!tokens.refreshToken) {
        // Cannot refresh, token is expired
        return null;
      }

      try {
        // Refresh the tokens, preserving provider-specific fields (cloudId, apiDomain)
        const oldCloudId = tokens.cloudId;
        const oldApiDomain = tokens.apiDomain;
        tokens = await provider.refreshToken(tokens.refreshToken);
        if (oldCloudId && !tokens.cloudId) tokens.cloudId = oldCloudId;
        if (oldApiDomain && !tokens.apiDomain) tokens.apiDomain = oldApiDomain;

        // Save the new tokens
        await updateConnectionTokens(userId, providerId, tokens);

        console.log(`Refreshed tokens for ${userId}/${providerId}`);
      } catch (error) {
        console.error(`Failed to refresh tokens for ${userId}/${providerId}:`, error);
        return null;
      }
    }

    return tokens;
  }

  /**
   * Validate and update a connection's status
   */
  async validateConnection(userId: string, providerId: string): Promise<ConnectionStatus | null> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return null;
    }

    const tokens = await this.getTokens(userId, providerId);
    if (!tokens) {
      return {
        status: 'expired',
        lastChecked: new Date().toISOString(),
        error: 'Token expired or unavailable',
      };
    }

    try {
      const status = await provider.validateConnection(tokens);
      return status;
    } catch (error: any) {
      return {
        status: 'error',
        lastChecked: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Get statistics about registered providers
   */
  getStats(): { total: number; byAuthType: Record<string, number> } {
    const providers = this.getAll();
    const byAuthType: Record<string, number> = {};

    for (const provider of providers) {
      byAuthType[provider.authType] = (byAuthType[provider.authType] || 0) + 1;
    }

    return {
      total: providers.length,
      byAuthType,
    };
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    // Unregister all tools
    for (const provider of this.providers.values()) {
      const tools = provider.getTools();
      for (const tool of tools) {
        toolRegistry.unregister(tool.name);
      }
    }

    this.providers.clear();
  }
}

// Singleton instance
export const connectionRegistry = new ConnectionRegistry();

// Export class for testing or multiple instances
export { ConnectionRegistry };
