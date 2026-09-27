/**
 * Grundsicherung — Protokollansicht + CSV-Export (Owner-Gate) — Adapter auf den Antrag-Kern.
 */
import { createAuditRoutes } from '../../_antrag-kern/audit';
import { listAuditEintraegeGesamt, countAuditEintraegeGesamt } from '../storage';
import { audit } from '../audit';
import { denyIfNotAppOwner } from './_shared';

export const auditRoutes = createAuditRoutes({
  store: { listAuditEintraegeGesamt, countAuditEintraegeGesamt },
  audit,
  denyIfNotAppOwner,
});
