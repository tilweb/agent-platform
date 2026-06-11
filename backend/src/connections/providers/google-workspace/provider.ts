/**
 * Google Docs & Sheets Connection Provider
 *
 * Ein Connect für Sheets + Docs. Nutzt die ZENTRALE Adacor-Google-App und den
 * non-sensitive Scope `drive.file` → keine Google-Verifizierung nötig.
 */

import { OAuthProvider } from '../../base/OAuthProvider';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '../../types';
import { getGoogleWorkspaceConfig, GOOGLE_USERINFO_URL } from './config';
import { createCreateSpreadsheetTool } from './tools/create-spreadsheet';
import { createSheetsWriteRangeTool } from './tools/sheets-write-range';
import { createSheetsReadRangeTool } from './tools/sheets-read-range';
import { createCreateDocumentTool } from './tools/create-document';
import { createDocsAppendTool } from './tools/docs-append';
import { createDocsReadTool } from './tools/docs-read';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleWorkspaceProvider extends OAuthProvider {
  readonly id = 'google-workspace';
  readonly name = 'Google Docs & Sheets';
  readonly description = 'Google Sheets und Docs anlegen, lesen und bearbeiten (eigene/freigegebene Dateien)';
  readonly icon = '📄';
  readonly setupGuide = `## Google Docs & Sheets Setup (zentrale Adacor-App)

> Nutzt **dieselbe** zentrale Adacor-Google-App wie Google Drive (siehe Google-Drive-Anleitung).
> **Eine** App für alle Workplace-Instanzen, **kein** Setup pro Kunde. **Endnutzer** klicken nur „Verbinden".

### Scope ohne Google-Verifizierung
Verwendet den **non-sensitive** Scope \`.../auth/drive.file\` → **keine Google-Freigabe nötig**, auch in Production, unbegrenzt Nutzer.
Damit kann der Agent **eigene** Sheets/Docs anlegen und voll **lesen+schreiben** (sowie Dateien, die der Nutzer per Google-Picker freigibt) — **nicht** beliebige bestehende Privatdateien (das bräuchte sensible Scopes + Verifizierung).

### Einrichtung (einmal, Adacor)
1. Im **selben** zentralen Projekt: **Google Sheets API** und **Google Docs API** aktivieren.
2. Am OAuth-Consent-Screen den Scope \`.../auth/drive.file\` ergänzen.
3. Pro Instanz die Callback-URL in **denselben** OAuth-Client eintragen:
   \`https://<instanz-domain>/api/connections/google-workspace/callback\`
4. Dieselben \`GOOGLE_CLIENT_ID\` / \`GOOGLE_CLIENT_SECRET\` wie Drive — nichts Zusätzliches.

### Endnutzer
Ein Klick „Verbinden" → eigenes Google-Konto → fertig. Eigener Token, keine Google Console.`;

  private tools: ConnectionTool[] | null = null;

  protected getOAuthConfig(): OAuth2Config {
    return getGoogleWorkspaceConfig();
  }

  private async getCurrentUser(tokens: TokenSet): Promise<GoogleUserInfo> {
    const response = await this.authenticatedFetch(GOOGLE_USERINFO_URL, tokens);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get user info: ${response.status} - ${text}`);
    }
    return response.json() as Promise<GoogleUserInfo>;
  }

  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
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

  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createCreateSpreadsheetTool(this.id),
        createSheetsWriteRangeTool(this.id),
        createSheetsReadRangeTool(this.id),
        createCreateDocumentTool(this.id),
        createDocsAppendTool(this.id),
        createDocsReadTool(this.id),
      ];
    }
    return this.tools;
  }
}

// Export singleton instance
export const googleWorkspaceProvider = new GoogleWorkspaceProvider();
