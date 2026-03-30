/**
 * Connection Providers - Auto-Discovery and Registration
 */

import { connectionRegistry } from '../registry';

// Import all providers
import { confluenceProvider } from './confluence';
import { googleDriveProvider } from './google-drive';
import { googleMailProvider } from './google-mail';
import { jiraProvider } from './jira';
import { pipedriveProvider } from './pipedrive';
import { docuwareProvider } from './docuware';

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

  // Register Google Mail
  try {
    connectionRegistry.register(googleMailProvider);
  } catch (error: any) {
    console.warn('Failed to register Google Mail provider:', error.message);
  }

  // Register Jira
  try {
    connectionRegistry.register(jiraProvider);
  } catch (error: any) {
    console.warn('Failed to register Jira provider:', error.message);
  }

  // Register Docuware
  try {
    connectionRegistry.register(docuwareProvider);
  } catch (error: any) {
    console.warn('Failed to register Docuware provider:', error.message);
  }

  // Future providers can be added here:
  // - SharePoint
  // - YouTrack
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
export { googleMailProvider } from './google-mail';
export { jiraProvider } from './jira';
export { pipedriveProvider } from './pipedrive';
export { docuwareProvider } from './docuware';
