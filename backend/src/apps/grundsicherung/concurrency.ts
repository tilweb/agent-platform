/**
 * Optimistic Concurrency Control — aus dem Antrag-Kern.
 * VersionConflictError → 409 in den Routen.
 */
export { VersionConflictError, withLock, checkVersion } from '../_antrag-kern/concurrency';
