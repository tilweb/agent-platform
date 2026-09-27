/**
 * Wohngeld GOV-1 — Zentraler Audit-/Protokoll-Helfer (Adapter auf den Antrag-Kern).
 *
 * `audit(c, event)` schreibt EINE append-only Zeile ins Audit-Log und liest den
 * Akteur (id + name + wirksame Rolle + IP) aus dem Hono-Context. Er wird in jeder
 * Schreib-Route sowie bei Lesezugriff auf einen Fall und bei Downloads/Exporten
 * aufgerufen (§ 35 SGB I, Art. 5/30 DSGVO, AI Act Art. 12).
 *
 * Logik liegt in `apps/_antrag-kern/audit.ts`; hier nur die Wohngeld-Objekttypen
 * und der Log-Präfix. Fehler beim Protokollieren brechen die Fach-Aktion NIE ab.
 */
import { createAudit, type AuditEvent as KernAuditEvent } from '../_antrag-kern/audit';
import { addAuditEintrag } from './storage';

export {
  diffFelder, hatAenderung, diffToVorherNachher, auditEintraegeToCsv,
} from '../_antrag-kern/audit';

/** Objekt-Typen im Protokoll (siehe Spec Abschnitt 4). */
export type AuditObjektTyp =
  | 'vorgang' | 'person' | 'dokument' | 'pruefschritt' | 'schreiben'
  | 'notiz' | 'feldstatus' | 'akte' | 'verfuegung' | 'chat' | 'textbaustein' | 'posteingang' | 'protokoll';

export type AuditEvent = KernAuditEvent<AuditObjektTyp>;

const kern = createAudit<AuditObjektTyp>({
  // Lazy, damit ein späterer Import-Zyklus nie ein undefiniertes addAuditEintrag einfriert.
  store: { addAuditEintrag: (e) => addAuditEintrag(e) },
  logPraefix: '[wohngeld]',
});

/** Protokolliert eine fachlich relevante Aktion. Fehler werden geschluckt (nur geloggt). */
export const audit = kern.audit;

/**
 * Bequemer Update-Audit: protokolliert `vorher`/`nachher` NUR bei geänderten Feldern
 * (der Eintrag selbst wird immer geschrieben).
 */
export const auditUpdate = kern.auditUpdate;
