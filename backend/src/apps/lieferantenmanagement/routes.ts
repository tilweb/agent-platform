/**
 * Lieferantenmanagement Routes
 * REST API endpoints for supplier management
 */

import { Hono } from 'hono';
import * as service from './service';
import * as storage from './storage';
import * as documents from './documents';
import { getChangelog, deleteChangelog, appendChangelog } from './changelog';
import { exportSuppliersCSV, exportAuditPlanCSV } from './export';
import {
  validateCreateSupplier, validateUpdateSupplier, validateAnsprechpartner,
  validateZertifizierung, validateLeistung, validateBia, validateRegulatorik,
  validateLifecycleTransition, validateCreateAudit, validateUpdateAudit,
} from './validation';
import { requireAppAccess } from '../permissions-middleware';

const lieferanten = new Hono();

// Berechtigungs-Pruefung
lieferanten.use('*', requireAppAccess('lieferantenmanagement'));

// ============== Config ==============

lieferanten.get('/config', async (c) => {
  try {
    const config = await storage.getConfig();
    return c.json(config || {});
  } catch (error) {
    console.error('Error getting config:', error);
    return c.json({ error: 'Failed to get config' }, 500);
  }
});

lieferanten.put('/config', async (c) => {
  try {
    const body = await c.req.json();
    const existing = await storage.getConfig() || {};
    const updated = { ...existing, ...body };
    await storage.saveConfig(updated);
    return c.json(updated);
  } catch (error) {
    console.error('Error saving config:', error);
    return c.json({ error: 'Failed to save config' }, 500);
  }
});

// ============== Stats ==============

lieferanten.get('/stats', async (c) => {
  try {
    const stats = await service.getStats();
    return c.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

lieferanten.get('/stats/risk-distribution', async (c) => {
  try {
    const distribution = await service.getRiskDistribution();
    return c.json({ distribution });
  } catch (error) {
    console.error('Error getting risk distribution:', error);
    return c.json({ error: 'Failed to get risk distribution' }, 500);
  }
});

lieferanten.get('/stats/compliance', async (c) => {
  try {
    const compliance = await service.getComplianceStats();
    return c.json({ compliance });
  } catch (error) {
    console.error('Error getting compliance stats:', error);
    return c.json({ error: 'Failed to get compliance stats' }, 500);
  }
});

lieferanten.get('/stats/expiring', async (c) => {
  try {
    const expiring = await service.getExpiringItems();
    return c.json({ expiring });
  } catch (error) {
    console.error('Error getting expiring items:', error);
    return c.json({ error: 'Failed to get expiring items' }, 500);
  }
});

lieferanten.get('/stats/pending-reviews', async (c) => {
  try {
    const reviews = await service.getPendingReviews();
    return c.json({ reviews });
  } catch (error) {
    console.error('Error getting pending reviews:', error);
    return c.json({ error: 'Failed to get pending reviews' }, 500);
  }
});

// ============== Export ==============

lieferanten.get('/export/csv', async (c) => {
  try {
    const csv = await exportSuppliersCSV();
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="lieferanten.csv"');
    return c.body(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return c.json({ error: 'Failed to export CSV' }, 500);
  }
});

lieferanten.get('/export/audit-plan/:year/csv', async (c) => {
  try {
    const year = parseInt(c.req.param('year'));
    const csv = await exportAuditPlanCSV(year);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="auditplan-${year}.csv"`);
    return c.body(csv);
  } catch (error: any) {
    console.error('Error exporting audit plan CSV:', error);
    return c.json({ error: error.message || 'Failed to export audit plan CSV' }, 500);
  }
});

// ============== Suppliers CRUD ==============

lieferanten.get('/suppliers', async (c) => {
  try {
    const filters = {
      search: c.req.query('search'),
      status: c.req.query('status') as any,
      abteilung: c.req.query('abteilung'),
      bia_level: c.req.query('bia_level') as any,
      dora: c.req.query('dora') ? c.req.query('dora') === 'true' : undefined,
    };

    const suppliers = await service.listSuppliers(filters);
    return c.json({ suppliers });
  } catch (error) {
    console.error('Error listing suppliers:', error);
    return c.json({ error: 'Failed to list suppliers' }, 500);
  }
});

lieferanten.post('/suppliers', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateCreateSupplier(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.createSupplier(body, userId);
    return c.json({ supplier }, 201);
  } catch (error) {
    console.error('Error creating supplier:', error);
    return c.json({ error: 'Failed to create supplier' }, 500);
  }
});

lieferanten.get('/suppliers/:id', async (c) => {
  try {
    const supplier = await storage.getSupplier(c.req.param('id'));
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error getting supplier:', error);
    return c.json({ error: 'Failed to get supplier' }, 500);
  }
});

lieferanten.put('/suppliers/:id', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateUpdateSupplier(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateSupplier(c.req.param('id'), body, userId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return c.json({ error: 'Failed to update supplier' }, 500);
  }
});

lieferanten.delete('/suppliers/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('x-user-id') || 'system';
    const success = await storage.deleteSupplier(id);
    if (!success) return c.json({ error: 'Supplier not found' }, 404);
    await deleteChangelog(id);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return c.json({ error: 'Failed to delete supplier' }, 500);
  }
});

// ============== Ansprechpartner ==============

lieferanten.post('/suppliers/:id/ansprechpartner', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateAnsprechpartner(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.addAnsprechpartner(c.req.param('id'), body, userId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error adding contact:', error);
    return c.json({ error: 'Failed to add contact' }, 500);
  }
});

lieferanten.put('/suppliers/:id/ansprechpartner/:apId', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateAnsprechpartner(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateAnsprechpartner(c.req.param('id'), c.req.param('apId'), body, userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating contact:', error);
    return c.json({ error: 'Failed to update contact' }, 500);
  }
});

lieferanten.delete('/suppliers/:id/ansprechpartner/:apId', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.deleteAnsprechpartner(c.req.param('id'), c.req.param('apId'), userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return c.json({ error: 'Failed to delete contact' }, 500);
  }
});

// ============== Zertifizierungen ==============

lieferanten.post('/suppliers/:id/zertifizierungen', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateZertifizierung(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.addZertifizierung(c.req.param('id'), body, userId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error adding certification:', error);
    return c.json({ error: 'Failed to add certification' }, 500);
  }
});

lieferanten.put('/suppliers/:id/zertifizierungen/:zertId', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateZertifizierung(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateZertifizierung(c.req.param('id'), c.req.param('zertId'), body, userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating certification:', error);
    return c.json({ error: 'Failed to update certification' }, 500);
  }
});

lieferanten.delete('/suppliers/:id/zertifizierungen/:zertId', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.deleteZertifizierung(c.req.param('id'), c.req.param('zertId'), userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error deleting certification:', error);
    return c.json({ error: 'Failed to delete certification' }, 500);
  }
});

// ============== Leistungen ==============

lieferanten.post('/suppliers/:id/leistungen', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateLeistung(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.addLeistung(c.req.param('id'), body, userId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error adding service:', error);
    return c.json({ error: 'Failed to add service' }, 500);
  }
});

lieferanten.put('/suppliers/:id/leistungen/:leistId', async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateLeistung(c.req.param('id'), c.req.param('leistId'), body, userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating service:', error);
    return c.json({ error: 'Failed to update service' }, 500);
  }
});

lieferanten.delete('/suppliers/:id/leistungen/:leistId', async (c) => {
  try {
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.deleteLeistung(c.req.param('id'), c.req.param('leistId'), userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error deleting service:', error);
    return c.json({ error: 'Failed to delete service' }, 500);
  }
});

// ============== BIA ==============

lieferanten.put('/suppliers/:id/leistungen/:leistId/bia', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateBia(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateBia(c.req.param('id'), c.req.param('leistId'), body, userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating BIA:', error);
    return c.json({ error: 'Failed to update BIA' }, 500);
  }
});

// ============== Regulatorik ==============

lieferanten.put('/suppliers/:id/leistungen/:leistId/regulatorik', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateRegulatorik(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.updateRegulatorik(c.req.param('id'), c.req.param('leistId'), body, userId);
    if (!supplier) return c.json({ error: 'Not found' }, 404);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error updating regulatorik:', error);
    return c.json({ error: 'Failed to update regulatorik' }, 500);
  }
});

// ============== Lifecycle ==============

lieferanten.put('/suppliers/:id/lifecycle/transition', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateLifecycleTransition(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const supplier = await service.transitionLifecycle(c.req.param('id'), body.phase, userId);
    if (!supplier) return c.json({ error: 'Invalid transition' }, 400);
    return c.json({ supplier });
  } catch (error) {
    console.error('Error transitioning lifecycle:', error);
    return c.json({ error: 'Failed to transition lifecycle' }, 500);
  }
});

lieferanten.get('/suppliers/:id/lifecycle', async (c) => {
  try {
    const supplier = await storage.getSupplier(c.req.param('id'));
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    return c.json({ lifecycle: supplier.lifecycle });
  } catch (error) {
    console.error('Error getting lifecycle:', error);
    return c.json({ error: 'Failed to get lifecycle' }, 500);
  }
});

// ============== Changelog ==============

lieferanten.get('/suppliers/:id/changelog', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const result = await getChangelog(c.req.param('id'), { limit, offset });
    return c.json(result);
  } catch (error) {
    console.error('Error getting changelog:', error);
    return c.json({ error: 'Failed to get changelog' }, 500);
  }
});

// ============== Documents ==============

lieferanten.post('/suppliers/:id/documents', async (c) => {
  try {
    const supplierId = c.req.param('id');
    const supplier = await storage.getSupplier(supplierId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'Keine Datei angegeben' }, 400);
    }

    const validation = documents.validateFile(file);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    const typ = formData.get('typ') as string;
    const VALID_DOK_TYPEN = ['zertifizierung_nachweis', 'avv_dokument', 'nda_dokument', 'rahmenvertrag_dokument', 'bonitaetsnachweis', 'audit_bericht', 'sonstiges'];
    if (!typ || !VALID_DOK_TYPEN.includes(typ)) {
      return c.json({ error: 'Ungueltiger Dokumenttyp' }, 400);
    }

    const userId = c.req.header('x-user-id') || 'system';
    const docId = documents.generateDokumentId();

    const meta = await documents.saveDokument(supplierId, file, {
      id: docId,
      supplier_id: supplierId,
      typ: typ as any,
      hochgeladen_von: userId,
      referenz_typ: (formData.get('referenz_typ') as any) || undefined,
      referenz_id: (formData.get('referenz_id') as string) || undefined,
      notizen: (formData.get('notizen') as string) || undefined,
    });

    await appendChangelog(supplierId, {
      user: userId,
      aktion: 'geaendert',
      bereich: 'dokument',
      feld: 'hochgeladen',
      neuer_wert: `${meta.dateiname} (${typ})`,
    });

    return c.json({ dokument: meta }, 201);
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json({ error: 'Failed to upload document' }, 500);
  }
});

lieferanten.get('/suppliers/:id/documents', async (c) => {
  try {
    const supplierId = c.req.param('id');
    const typ = c.req.query('typ') as any;
    const docs = await documents.getDokumente(supplierId, typ ? { typ } : undefined);
    return c.json({ dokumente: docs });
  } catch (error) {
    console.error('Error listing documents:', error);
    return c.json({ error: 'Failed to list documents' }, 500);
  }
});

lieferanten.get('/suppliers/:id/documents/:docId', async (c) => {
  try {
    const doc = await documents.getDokument(c.req.param('id'), c.req.param('docId'));
    if (!doc) return c.json({ error: 'Document not found' }, 404);
    return c.json({ dokument: doc });
  } catch (error) {
    console.error('Error getting document:', error);
    return c.json({ error: 'Failed to get document' }, 500);
  }
});

lieferanten.get('/suppliers/:id/documents/:docId/download', async (c) => {
  try {
    const supplierId = c.req.param('id');
    const docId = c.req.param('docId');
    const doc = await documents.getDokument(supplierId, docId);
    if (!doc) return c.json({ error: 'Document not found' }, 404);

    const filePath = documents.getDokumentFilePath(supplierId, docId, doc.dateiname);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return c.json({ error: 'File not found on disk' }, 404);
    }

    c.header('Content-Type', doc.dateityp || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.dateiname)}"`);
    c.header('Content-Length', String(doc.dateigroesse));
    return c.body(await file.arrayBuffer());
  } catch (error) {
    console.error('Error downloading document:', error);
    return c.json({ error: 'Failed to download document' }, 500);
  }
});

lieferanten.delete('/suppliers/:id/documents/:docId', async (c) => {
  try {
    const supplierId = c.req.param('id');
    const docId = c.req.param('docId');
    const doc = await documents.getDokument(supplierId, docId);
    if (!doc) return c.json({ error: 'Document not found' }, 404);

    const success = await documents.deleteDokument(supplierId, docId);
    if (!success) return c.json({ error: 'Document not found' }, 404);

    const userId = c.req.header('x-user-id') || 'system';
    await appendChangelog(supplierId, {
      user: userId,
      aktion: 'geaendert',
      bereich: 'dokument',
      feld: 'geloescht',
      alter_wert: `${doc.dateiname} (${doc.typ})`,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

// ============== Audits ==============

lieferanten.get('/audits', async (c) => {
  try {
    const filters = {
      supplier_id: c.req.query('supplier_id'),
      status: c.req.query('status'),
    };
    const audits = await service.listAudits(filters);
    return c.json({ audits });
  } catch (error) {
    console.error('Error listing audits:', error);
    return c.json({ error: 'Failed to list audits' }, 500);
  }
});

lieferanten.post('/audits', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateCreateAudit(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const audit = await service.createAudit(body, userId);
    return c.json({ audit }, 201);
  } catch (error) {
    console.error('Error creating audit:', error);
    return c.json({ error: 'Failed to create audit' }, 500);
  }
});

lieferanten.get('/audits/:auditId', async (c) => {
  try {
    const audit = await storage.getAudit(c.req.param('auditId'));
    if (!audit) return c.json({ error: 'Audit not found' }, 404);
    return c.json({ audit });
  } catch (error) {
    console.error('Error getting audit:', error);
    return c.json({ error: 'Failed to get audit' }, 500);
  }
});

lieferanten.put('/audits/:auditId', async (c) => {
  try {
    const body = await c.req.json();
    const v = validateUpdateAudit(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    const userId = c.req.header('x-user-id') || 'system';
    const audit = await service.updateAudit(c.req.param('auditId'), body, userId);
    if (!audit) return c.json({ error: 'Audit not found' }, 404);
    return c.json({ audit });
  } catch (error) {
    console.error('Error updating audit:', error);
    return c.json({ error: 'Failed to update audit' }, 500);
  }
});

lieferanten.delete('/audits/:auditId', async (c) => {
  try {
    const success = await storage.deleteAudit(c.req.param('auditId'));
    if (!success) return c.json({ error: 'Audit not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting audit:', error);
    return c.json({ error: 'Failed to delete audit' }, 500);
  }
});

// ============== Audit Plans ==============

async function enrichAuditPlan(plan: any) {
  const suppliers = await storage.getSuppliers();
  const audits = await storage.getAudits();
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  const entries = plan.eintraege.map((e: any) => {
    const supplier = supplierMap.get(e.supplier_id);
    const leistung = supplier?.leistungen?.find((l: any) => l.id === e.leistung_id);

    // Find all audits for this supplier/leistung in the plan year
    const erforderlich: string[] = e.erforderliche_scopes || [];
    const planYear = plan.jahr;
    const yearAudits = audits.filter(
      (a) => a.supplier_id === e.supplier_id && a.leistung_id === e.leistung_id && a.scope
        && (
          (a.durchgefuehrt_am && new Date(a.durchgefuehrt_am).getFullYear() === planYear)
          || (a.geplant_fuer && new Date(a.geplant_fuer).getFullYear() === planYear)
        )
    );

    // Completed scopes (only durchgefuehrt_am in plan year)
    const completedAudits = yearAudits.filter((a) => a.status === 'abgeschlossen' && a.durchgefuehrt_am && new Date(a.durchgefuehrt_am).getFullYear() === planYear);
    const erledigteScopes = new Set(completedAudits.map((a) => a.scope).filter(Boolean));
    const abgedeckt = erforderlich.filter((s: string) => erledigteScopes.has(s));

    // Map of scope → existing audit info (any status, for navigation)
    const vorhandeneAudits: Record<string, { audit_id: string; status: string; supplier_id: string }> = {};
    for (const a of yearAudits) {
      if (a.scope && !vorhandeneAudits[a.scope]) {
        vorhandeneAudits[a.scope] = { audit_id: a.id, status: a.status, supplier_id: a.supplier_id };
      }
    }

    let status = e.status || 'offen';
    if (erforderlich.length > 0) {
      if (abgedeckt.length >= erforderlich.length) {
        status = 'erledigt';
      } else if (abgedeckt.length > 0) {
        status = 'teilweise';
      } else {
        status = 'offen';
      }
    }

    return {
      ...e,
      supplier_name: supplier?.firmenname || '-',
      service_name: leistung?.bezeichnung || '-',
      status,
      erledigte_scopes: abgedeckt,
      vorhandene_audits: vorhandeneAudits,
    };
  });

  return { ...plan, entries };
}

lieferanten.get('/audit-plans/:year', async (c) => {
  try {
    const year = parseInt(c.req.param('year'));
    const plan = await storage.getAuditPlan(year);
    if (!plan) return c.json({ error: 'Plan not found' }, 404);
    const enriched = await enrichAuditPlan(plan);
    return c.json({ plan: enriched });
  } catch (error) {
    console.error('Error getting audit plan:', error);
    return c.json({ error: 'Failed to get audit plan' }, 500);
  }
});

lieferanten.post('/audit-plans/:year/generate', async (c) => {
  try {
    const year = parseInt(c.req.param('year'));
    const plan = await service.generateAuditPlan(year);
    const enriched = await enrichAuditPlan(plan);
    return c.json({ plan: enriched });
  } catch (error) {
    console.error('Error generating audit plan:', error);
    return c.json({ error: 'Failed to generate audit plan' }, 500);
  }
});

export { lieferanten as lieferantenmanagementRoutes };
