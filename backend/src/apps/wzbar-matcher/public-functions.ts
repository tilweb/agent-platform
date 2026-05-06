/**
 * wzbar-matcher Public-API Functions.
 *
 * Registered via `AppConfig.publicFunctions` (see index.ts). Each function is
 * auto-exposed under `/api/public/v1/wzbar-matcher/<functionId>` by the
 * public-api router.
 */

import type { JsonSchema, PublicFunction } from '../../public-api/types';
import { match } from './service';
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
