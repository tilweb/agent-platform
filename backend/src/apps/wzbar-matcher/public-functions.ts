/**
 * wzbar-matcher Public-API Functions.
 *
 * Registered via `AppConfig.publicFunctions` (see index.ts). Each function is
 * auto-exposed under `/api/public/v1/wzbar-matcher/<functionId>` by the
 * public-api router.
 */

import type { PublicFunction } from '../../public-api/types';
import { match } from './service';
import type { MatchCandidate } from './types';

interface ClassifyInput {
  text: string;
}

interface ClassifyOutput {
  primary: Pick<MatchCandidate, 'code' | 'kurztext' | 'langtext' | 'confidence' | 'reasoning'>;
  alternatives: Array<Pick<MatchCandidate, 'code' | 'kurztext' | 'langtext' | 'confidence' | 'reasoning'>>;
}

export const classifyPublicFunction: PublicFunction<ClassifyInput, ClassifyOutput> = {
  id: 'classify',
  description:
    'Klassifiziert einen freitextlichen Tätigkeitstext auf einen 4-stelligen WZ-2008-Schlüssel. Liefert einen primären Match plus bis zu 3 Alternativen mit Konfidenz und kurzer Begründung.',
  input: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Freitextliche Tätigkeitsbeschreibung (aus Handelsregister o.ä.).',
        minLength: 3,
        maxLength: 2000,
      },
    },
    required: ['text'],
  },
  output: {
    type: 'object',
    properties: {
      primary: {
        type: 'object',
        properties: {
          code: { type: 'string', description: '4-stelliger WZ-2008-Schlüssel.' },
          kurztext: { type: 'string' },
          langtext: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string' },
        },
        required: ['code', 'kurztext', 'confidence'],
      },
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            kurztext: { type: 'string' },
            langtext: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string' },
          },
          required: ['code', 'kurztext', 'confidence'],
        },
      },
    },
    required: ['primary', 'alternatives'],
  },
  defaultRateLimit: { requests: 60, windowSec: 60 },
  async handler({ text }, ctx) {
    const record = await match(text, `apk:${ctx.apiKeyId}`);
    const trim = (c: MatchCandidate) => ({
      code: c.code,
      kurztext: c.kurztext,
      langtext: c.langtext,
      confidence: c.confidence,
      reasoning: c.reasoning,
    });
    return {
      primary: trim(record.result.primary),
      alternatives: record.result.alternatives.map(trim),
    };
  },
};
