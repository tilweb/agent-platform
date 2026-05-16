/**
 * wzbar-matcher Public-API Functions.
 *
 * Registered via `AppConfig.publicFunctions` (see index.ts). Each function is
 * auto-exposed under `/api/public/v1/wzbar-matcher/<functionId>` by the
 * public-api router.
 */

import type { JsonSchema, PublicFunction } from '../../public-api/types';
import { match } from './service';
import { getNeighborhood, type NeighborhoodNode } from './neighborhood';
import type { MatchCandidate } from './types';

interface ClassifyInput {
  text: string;
}

type CandidateSlim = Pick<MatchCandidate, 'code' | 'kurztext' | 'langtext' | 'confidence' | 'reasoning'>;

interface ActivityOutput {
  activity: string;
  primary: CandidateSlim;
  alternatives: CandidateSlim[];
}

interface ClassifyOutput {
  activities: ActivityOutput[];
}

const CANDIDATE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: '4- bis 6-stelliger WZ-2008-Schlüssel.' },
    kurztext: { type: 'string' },
    langtext: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
  },
  required: ['code', 'kurztext', 'confidence'],
};

interface NeighborhoodInput {
  code: string;
}

interface NeighborhoodOutput {
  code: string;
  nodes: NeighborhoodNode[];
}

const NEIGHBORHOOD_NODE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: '4- bis 6-stelliger WZ-2008-Schlüssel.' },
    kurztext: { type: 'string' },
    langtext: { type: 'string' },
    level: { type: 'integer', minimum: 4, maximum: 6, description: 'Hierarchie-Ebene (4=Klasse, 5=Unterklasse, 6=Wirtschaftsabteilung).' },
    indent: { type: 'integer', minimum: 0, maximum: 2, description: 'Einrueckung relativ zur Klasse (level - 4).' },
    isCurrent: { type: 'boolean', description: 'true fuer den angefragten Code.' },
  },
  required: ['code', 'kurztext', 'langtext', 'level', 'indent', 'isCurrent'],
};

export const getNeighborhoodPublicFunction: PublicFunction<NeighborhoodInput, NeighborhoodOutput> = {
  id: 'getNeighborhood',
  description:
    'Liefert das hierarchische Umfeld (Klasse, Geschwister, Kinder) eines WZ-2008-Schlüssels — alle Codes mit gleichem Klassen-Praefix (4-stellig) auf den Ebenen 4-6. Nuetzlich um den Kontext eines Match-Ergebnisses zu inspizieren und manuell auf benachbarte Codes zu wechseln.',
  input: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: '4- bis 6-stelliger WZ-2008-Schlüssel (nur Ziffern).',
        minLength: 4,
        maxLength: 6,
      },
    },
    required: ['code'],
  },
  output: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Der angefragte Code (Echo).' },
      nodes: {
        type: 'array',
        description: 'Hierarchisch sortierte Knoten (kurz → lang) mit Markierung des aktuellen Codes.',
        items: NEIGHBORHOOD_NODE_SCHEMA,
      },
    },
    required: ['code', 'nodes'],
  },
  defaultRateLimit: { requests: 120, windowSec: 60 },
  async handler({ code }) {
    const nodes = await getNeighborhood(code);
    return { code, nodes };
  },
};

export const classifyPublicFunction: PublicFunction<ClassifyInput, ClassifyOutput> = {
  id: 'classify',
  description:
    'Klassifiziert einen freitextlichen Tätigkeitstext auf 4- bis 6-stellige WZ-2008-Schlüssel. Erkennt automatisch mehrere distinkte Tätigkeiten in einem Text (max. 3) und liefert pro Tätigkeit einen primären Match plus bis zu 3 Alternativen mit Konfidenz und Begründung.',
  input: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Freitextliche Tätigkeitsbeschreibung (aus Handelsregister o.ä.). Kann mehrere Tätigkeiten enthalten.',
        minLength: 3,
        maxLength: 2000,
      },
    },
    required: ['text'],
  },
  output: {
    type: 'object',
    properties: {
      activities: {
        type: 'array',
        description: '1–3 erkannte Tätigkeiten mit jeweils einem primären WZ-Code und bis zu 3 Alternativen.',
        items: {
          type: 'object',
          properties: {
            activity: { type: 'string', description: 'Erkannte Einzeltätigkeit (Splitter-Output).' },
            primary: CANDIDATE_SCHEMA,
            alternatives: {
              type: 'array',
              items: CANDIDATE_SCHEMA,
            },
          },
          required: ['activity', 'primary', 'alternatives'],
        },
      },
    },
    required: ['activities'],
  },
  defaultRateLimit: { requests: 60, windowSec: 60 },
  async handler({ text }, ctx) {
    const record = await match(text, `apk:${ctx.apiKeyId}`);
    const trim = (c: MatchCandidate): CandidateSlim => ({
      code: c.code,
      kurztext: c.kurztext,
      langtext: c.langtext,
      confidence: c.confidence,
      reasoning: c.reasoning,
    });
    return {
      activities: record.result.activities.map(am => ({
        activity: am.activity,
        primary: trim(am.result.primary),
        alternatives: am.result.alternatives.map(trim),
      })),
    };
  },
};
