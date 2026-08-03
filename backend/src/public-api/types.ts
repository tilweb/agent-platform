/**
 * Public API Framework — Types
 */

export type ScopeType = 'service' | 'org' | 'user';

export interface ApiKeyScope {
  type: ScopeType;
  serviceName?: string;
  orgId?: string;
  userId?: string;
}

export interface ApiKeyRateLimit {
  requests: number;
  windowSec: number;
}

export interface ApiKey {
  id: string;
  label: string;
  hashedKey: string;
  prefix: string;
  scope: ApiKeyScope;
  permissions: string[];
  rateLimit: ApiKeyRateLimit;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  revokedAt: string | null;
}

/**
 * Minimal JSON Schema subset used for public function I/O contracts.
 * Supports: object, string, number, boolean, array, nested objects.
 * Intentionally does not attempt to be a full draft-07 implementation.
 */
export type JsonSchemaType = 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';

export interface JsonSchema {
  type: JsonSchemaType;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface PublicFunctionContext {
  apiKeyId: string;
  scope: ApiKeyScope;
  permissions: string[];
  requestId: string;
}

export interface PublicFunction<TIn = Record<string, unknown>, TOut = unknown> {
  id: string;
  description: string;
  input: JsonSchema;
  output?: JsonSchema;
  defaultRateLimit?: ApiKeyRateLimit;
  handler: (input: TIn, ctx: PublicFunctionContext) => Promise<TOut>;
}

/**
 * Fehler, den eine Function bewusst an den Aufrufer durchreichen will
 * (falsche Id, ueberschrittene Grenze, ungueltige Kombination). Alles andere
 * bleibt ein 500 `internal_error` — Interna gehoeren nicht nach draussen.
 */
export class PublicFunctionError extends Error {
  readonly status: 400 | 404 | 409 | 413 | 422;
  readonly code: string;

  constructor(message: string, status: PublicFunctionError['status'] = 400, code = 'invalid_request') {
    super(message);
    this.name = 'PublicFunctionError';
    this.status = status;
    this.code = code;
  }
}

export interface AuditEntry {
  timestamp: string;
  requestId: string;
  apiKeyId: string | null;
  scopeType: ScopeType | null;
  scopeId: string | null;
  method: string;
  path: string;
  appId: string | null;
  functionId: string | null;
  status: number;
  errorCode?: string;
  durationMs: number;
}
