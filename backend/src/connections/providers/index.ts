/**
 * Connection Providers - Auto-Discovery and Registration
 */

import { connectionRegistry } from '../registry';

// Import all providers
import { confluenceProvider } from './confluence';
import { googleDriveProvider } from './google-drive';
import { pipedriveProvider } from './pipedrive';

/**
 * Register all available connection providers
 */
export function registerProviders(): void {
  console.log('Registering connection providers...');

  // Register Confluence
  try {
    connectionRegistry.register(confluenceProvider);
  } catch (error: any) {
    console.warn('Failed to register Confluence provider:', error.message);
  }

  // Register Google Drive
  try {
    connectionRegistry.register(googleDriveProvider);
  } catch (error: any) {
    console.warn('Failed to register Google Drive provider:', error.message);
  }

  // Register Pipedrive
  try {
    connectionRegistry.register(pipedriveProvider);
  } catch (error: any) {
    console.warn('Failed to register Pipedrive provider:', error.message);
  }

  // Future providers can be added here:
  // - SharePoint
  // - YouTrack
  // - Jira
  // - etc.

  const stats = connectionRegistry.getStats();
  console.log(`Registered ${stats.total} connection provider(s)`);
}

/**
 * Get all registered provider IDs
 */
export function getProviderIds(): string[] {
  return connectionRegistry.getIds();
}

// Export providers for direct access
export { confluenceProvider } from './confluence';
export { googleDriveProvider } from './google-drive';
export { pipedriveProvider } from './pipedrive';
