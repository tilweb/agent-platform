import { pgSchema, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const connectionsSchema = pgSchema('connections');

/**
 * OAuth-/API-Connections per User+Provider. Sensitive Felder (access/refresh
 * tokens) bleiben mit dem bestehenden CONNECTION_ENCRYPTION_KEY app-seitig
 * verschluesselt — `encrypted_payload` ist der Ciphertext.
 */
export const userConnections = connectionsSchema.table('user_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(),             // confluence | jira | docuware | ...
  account: text('account'),                          // optionaler Account-Identifier
  encryptedPayload: text('encrypted_payload').notNull(),
  metadata: jsonb('metadata'),                       // scopes, expires_at als ISO, ...
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  userProviderIdx: index('user_connections_user_provider_idx').on(t.userId, t.provider),
}));
