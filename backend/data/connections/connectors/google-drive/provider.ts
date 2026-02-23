/**
 * Google Drive Connection Provider
 */

import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { GOOGLE_USERINFO_URL } from './config';
import { createListFilesTool } from './tools/list-files';
import { createReadFileTool } from './tools/read-file';
import { createSearchFilesTool } from './tools/search-files';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleDriveProvider extends OAuthProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';
  readonly description = 'Google Drive Dateien durchsuchen und lesen';
  readonly icon = 'google-drive';

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  /**
   * Get current user info from Google
   */
  private async getCurrentUser(tokens: TokenSet): Promise<GoogleUserInfo> {
    const response = await this.authenticatedFetch(
      GOOGLE_USERINFO_URL,
      tokens
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }

    return response.json() as Promise<GoogleUserInfo>;
  }

  /**
   * Validate connection and get user info
   */
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      // Get user info to validate the connection
      const user = await this.getCurrentUser(tokens);

      return this.createConnectedStatus({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.picture,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  /**
   * Get Google Drive tools
   */
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createListFilesTool(this.id),
        createReadFileTool(this.id),
        createSearchFilesTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Default export for dynamic loader
export default new GoogleDriveProvider();
