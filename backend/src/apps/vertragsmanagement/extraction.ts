/**
 * Vertragsmanagement Extraction Service
 * LLM-based contract metadata and obligation extraction
 */

import { llmService, type Message } from '../../services/llm';
import type { ContractSchema, ContractObligation } from '../types';
import { getSchemas, getSchema } from './storage';
import type { UsageContext } from '../../services/usageTracking';

/**
 * Detect contract type from document text
 */
export async function detectContractType(documentText: string, triggeringUserId?: string): Promise<string> {
  const schemas = await getSchemas();

  if (schemas.length === 0) {
    return 'unknown';
  }

  const schemaList = schemas
    .map((s) => `- ${s.id}: ${s.name}`)
    .join('\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `Du bist ein Experte für Vertragsanalyse. Analysiere den folgenden Vertragstext und bestimme den Vertragstyp.

Verfügbare Vertragstypen:
${schemaList}

Antworte NUR mit der ID des Vertragstyps (z.B. "mietvertrag" oder "dienstleistung"). Wenn der Typ nicht eindeutig ist, wähle den wahrscheinlichsten.`,
    },
    {
      role: 'user',
      content: `Analysiere diesen Vertrag und bestimme den Typ:\n\n${documentText.substring(0, 5000)}`,
    },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'contract',
    operation: 'detect_type',
  };

  const response = await llmService.chat(messages, undefined, usageContext);
  const detectedType = (response.content || 'unknown').trim().toLowerCase();

  // Verify detected type exists
  const schema = await getSchema(detectedType);
  if (schema) {
    return detectedType;
  }

  // Fallback to first available type
  return schemas[0]?.id || 'unknown';
}

/**
 * Extract metadata from contract document based on schema
 */
export async function extractMetadata(
  documentText: string,
  schema: ContractSchema,
  triggeringUserId?: string
): Promise<Record<string, any>> {
  // Build field description for the prompt
  const fieldDescriptions = Object.entries(schema.fields)
    .map(([groupName, fields]) => {
      const fieldList = Object.entries(fields)
        .map(([name, field]) => `    - ${name} (${field.type}${field.required ? ', pflicht' : ''}): ${field.label || name}`)
        .join('\n');
      return `  ${groupName}:\n${fieldList}`;
    })
    .join('\n');

  const messages: Message[] = [
    {
      role: 'system',
      content: `Du bist ein Experte für Vertragsanalyse. Extrahiere die folgenden Informationen aus dem Vertragstext.

Vertragstyp: ${schema.name}

Zu extrahierende Felder:
${fieldDescriptions}

Antworte im JSON-Format. Verwende null für fehlende Werte. Datumsformate: YYYY-MM-DD. Zahlen ohne Währungszeichen.

Beispiel-Antwort:
{
  "vertragspartner": {
    "vermieter": "Max Mustermann GmbH",
    "mieter": "Erika Musterfrau"
  },
  "laufzeit": {
    "beginn": "2024-01-01",
    "ende": "2026-12-31"
  }
}`,
    },
    {
      role: 'user',
      content: `Extrahiere die Metadaten aus diesem ${schema.name}:\n\n${documentText}`,
    },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'contract',
    operation: 'extract_metadata',
  };

  const response = await llmService.chat(messages, undefined, usageContext);

  try {
    // Try to extract JSON from response
    const content = response.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Failed to parse extracted metadata:', error);
    return {};
  }
}

/**
 * Extract obligations from contract document
 */
export async function extractObligations(
  documentText: string,
  parties: { party_a: string; party_b: string },
  triggeringUserId?: string
): Promise<ContractObligation[]> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Du bist ein Experte für Vertragsanalyse. Extrahiere alle Pflichten und Verpflichtungen aus dem Vertrag.

Die Vertragsparteien sind:
- Partei A: ${parties.party_a}
- Partei B: ${parties.party_b}

Kategorien für Pflichten:
- payment: Zahlungspflichten
- delivery: Lieferungs-/Leistungspflichten
- maintenance: Wartungs-/Instandhaltungspflichten
- reporting: Berichtspflichten
- confidentiality: Geheimhaltungspflichten
- compliance: Compliance-Pflichten
- other: Sonstige Pflichten

Antworte im JSON-Array-Format:
[
  {
    "party": "party_a" oder "party_b",
    "category": "payment",
    "description": "Monatliche Zahlung von X EUR bis zum Y.",
    "recurrence": "monatlich" (optional, für wiederkehrende Pflichten)
  }
]`,
    },
    {
      role: 'user',
      content: `Extrahiere alle Pflichten aus diesem Vertrag:\n\n${documentText}`,
    },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'contract',
    operation: 'extract_obligations',
  };

  const response = await llmService.chat(messages, undefined, usageContext);

  try {
    const content = response.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error('Failed to parse extracted obligations:', error);
    return [];
  }
}

/**
 * Compute derived fields from extracted metadata
 */
export function computeDerivedFields(
  extracted: Record<string, any>,
  schema: ContractSchema
): {
  party_a: string;
  party_b: string;
  start_date: string;
  end_date: string;
  annual_value: number;
  status: 'active' | 'expiring' | 'expired';
  days_to_expiry: number | null;
} {
  // Helper to get nested value from path like "vertragspartner.vermieter"
  const getNestedValue = (obj: any, path: string): any => {
    if (!path || typeof path !== 'string') return undefined;
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  };

  // Defensive: wenn mapping fehlt oder unvollstaendig ist (User-Schema-Bug),
  // crashen wir nicht — leere Strings zurueckgeben + warnen, damit der Bug
  // in den Logs sichtbar wird.
  const mapping = schema.mapping ?? ({} as ContractSchema['mapping']);
  if (!mapping.party_a || !mapping.party_b || !mapping.start_date || !mapping.end_date || !mapping.value) {
    console.warn(`[VM-computeDerivedFields] Schema "${schema.id}" hat unvollstaendiges mapping — keine Basisdaten ableitbar. Pflege das Schema im Schema-Editor.`);
  }

  // Helper: liest, warnt einmal pro Lookup-Fehler.
  const lookupOrWarn = (key: keyof ContractSchema['mapping']): unknown => {
    const path = mapping[key];
    if (!path) return undefined;
    const value = getNestedValue(extracted, path);
    if (value === undefined || value === null || value === '') {
      console.warn(`[VM-computeDerivedFields] Schema "${schema.id}" mapping.${key} = "${path}" — Pfad fand keinen Wert im Extracted-Object. Pruefe ob Pfad zu fields-Block passt.`);
    }
    return value;
  };

  // Extract mapped values
  const party_a = String(lookupOrWarn('party_a') || '');
  const party_b = String(lookupOrWarn('party_b') || '');
  const start_date = String(lookupOrWarn('start_date') || '');
  const end_date = String(lookupOrWarn('end_date') || '');

  // Compute annual value (handle expressions like "finanzen.kaltmiete_monatlich * 12")
  let annual_value = 0;
  const valueMapping = mapping.value;
  if (valueMapping && valueMapping.includes('*')) {
    const parts = valueMapping.split('*').map((s) => s.trim());
    const path = parts[0] ?? '';
    const multiplierStr = parts[1] ?? '1';
    const baseValue = path ? (Number(getNestedValue(extracted, path)) || 0) : 0;
    const multiplier = Number(multiplierStr) || 1;
    annual_value = baseValue * multiplier;
  } else if (valueMapping) {
    annual_value = Number(getNestedValue(extracted, valueMapping)) || 0;
  }

  // Compute status and days to expiry
  let status: 'active' | 'expiring' | 'expired' = 'active';
  let days_to_expiry: number | null = null;

  if (end_date) {
    const endDateObj = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = endDateObj.getTime() - today.getTime();
    days_to_expiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days_to_expiry < 0) {
      status = 'expired';
    } else if (days_to_expiry <= 90) {
      status = 'expiring';
    }
  }

  return {
    party_a,
    party_b,
    start_date,
    end_date,
    annual_value,
    status,
    days_to_expiry,
  };
}

/**
 * Generate a schema suggestion for a contract type using AI
 */
export async function generateSchemaSuggestion(contractTypeDescription: string, triggeringUserId?: string): Promise<string> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Du bist ein Experte für Vertragsmanagement und YAML-Schemata.
Generiere ein vollständiges YAML-Schema für den angegebenen Vertragstyp.

Das Schema muss folgende Struktur haben:
- id: eindeutiger Identifier (lowercase, keine Leerzeichen, z.B. "reinigungsvertrag")
- name: Anzeigename (z.B. "Reinigungsvertrag")
- icon: "document" (Standard-Icon)
- fields: Kategorien mit Feldern (type: text, number, date; required: true/false; label: Anzeigename)
- mapping: Standard-Felder für Übersicht (party_a, party_b, start_date, end_date, value)

Wichtige Hinweise:
- Gruppiere Felder logisch in Kategorien (vertragspartner, laufzeit, finanzen, leistung, etc.)
- Füge vertragstypspezifische Felder hinzu
- Das Mapping muss auf existierende Felder verweisen (z.B. "vertragspartner.auftraggeber")
- Bei Wert-Mapping kannst du Berechnungen nutzen (z.B. "finanzen.monatspreis * 12")

Antworte NUR mit dem YAML-Schema, ohne zusätzliche Erklärungen oder Markdown-Code-Blöcke.`,
    },
    {
      role: 'user',
      content: `Erstelle ein YAML-Schema für: ${contractTypeDescription}`,
    },
  ];

  const usageContext: UsageContext = {
    triggeringUserId,
    source: 'contract',
    operation: 'generate_schema',
  };

  const response = await llmService.chat(messages, undefined, usageContext);
  let content = response.content || '';

  // Remove potential markdown code block markers
  content = content.replace(/^```ya?ml\n?/i, '').replace(/\n?```$/i, '').trim();

  return content;
}

/**
 * Full contract analysis pipeline
 */
export async function analyzeContract(
  documentText: string,
  contractType?: string,
  triggeringUserId?: string
): Promise<{
  contract_type: string;
  extracted: Record<string, any>;
  computed: ReturnType<typeof computeDerivedFields>;
  obligations: ContractObligation[];
}> {
  // Detect type if not provided
  const detectedType = contractType || (await detectContractType(documentText, triggeringUserId));

  // Get schema
  const schema = await getSchema(detectedType);
  if (!schema) {
    throw new Error(`Schema for type "${detectedType}" not found`);
  }

  // Extract metadata
  const extracted = await extractMetadata(documentText, schema, triggeringUserId);

  // Compute derived fields
  const computed = computeDerivedFields(extracted, schema);

  // Extract obligations
  const obligations = await extractObligations(documentText, {
    party_a: computed.party_a,
    party_b: computed.party_b,
  }, triggeringUserId);

  return {
    contract_type: detectedType,
    extracted,
    computed,
    obligations,
  };
}
