/**
 * Grundsicherung — Audit-/Protokoll-Helfer (Adapter auf den Antrag-Kern).
 *
 * `audit(c, event)` schreibt EINE append-only Zeile ins Audit-Log (Akteur, Rolle, IP aus dem
 * Hono-Context). Aufruf in jeder Schreib-Route sowie bei Lesezugriff auf einen Fall und bei
 * Downloads/Exporten (§ 35 SGB I, §§ 67 ff. SGB X, Art. 5/30 DSGVO, AI Act Art. 12).
 * Fehler beim Protokollieren brechen die Fach-Aktion NIE ab.
 */
import { createAudit, type AuditEvent as KernAuditEvent } from '../kern/audit';
import { addAuditEintrag } from './storage';

export {
  diffFelder, hatAenderung, diffToVorherNachher, auditEintraegeToCsv,
} from '../kern/audit';

/** Objekt-Typen im Protokoll. */
export type AuditObjektTyp =
  | 'vorgang' | 'person' | 'dokument' | 'pruefschritt' | 'schreiben'
  | 'notiz' | 'feldstatus' | 'akte' | 'chat' | 'textbaustein' | 'posteingang' | 'protokoll';

export type AuditEvent = KernAuditEvent<AuditObjektTyp>;

const kern = createAudit<AuditObjektTyp>({
  // Lazy, damit ein Import-Zyklus nie ein undefiniertes addAuditEintrag einfriert.
  store: { addAuditEintrag: (e) => addAuditEintrag(e) },
  logPraefix: '[grundsicherung]',
});

/** Protokolliert eine fachlich relevante Aktion. Fehler werden geschluckt (nur geloggt). */
export const audit = kern.audit;

/** Update-Audit: `vorher`/`nachher` NUR bei geänderten Feldern (Eintrag wird immer geschrieben). */
export const auditUpdate = kern.auditUpdate;
