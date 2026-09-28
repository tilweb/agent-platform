/**
 * Optimistic Concurrency Control — aus dem Antrag-Kern (identisch zum Echo-Loop-/Projektmanagement-Muster).
 * VersionConflictError → 409 in den Routes; withLock serialisiert Read-Modify-Write.
 */
export { VersionConflictError, withLock, checkVersion } from '../kern/concurrency';
