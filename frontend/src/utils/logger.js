/**
 * Logger Utility
 *
 * Provides logging functions that are disabled in production builds.
 * This prevents debug information from leaking to browser consoles.
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('Debug message');
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message');  // Always logged
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

/**
 * Logger with environment-aware output
 */
export const logger = {
  /**
   * Debug level - only in development
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info level - only in development
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },

  /**
   * Warning level - only in development
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error level - always logged (errors should always be visible)
   */
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Group logging - only in development
   */
  group: (label) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Table logging - only in development
   */
  table: (data) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};

export default logger;
