import { pgSchema, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const authSchema = pgSchema('auth');

export const users = authSchema.table('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email'),
  displayName: text('display_name'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  usernameIdx: index('users_username_idx').on(t.username),
}));

export const sessions = authSchema.table('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
  expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
}));

export const oauthStates = authSchema.table('oauth_states', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  state: text('state').notNull(),
  redirectUri: text('redirect_uri'),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  expiresIdx: index('oauth_states_expires_idx').on(t.expiresAt),
}));

export const groups = authSchema.table('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const groupMembers = authSchema.table('group_members', {
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  addedAt: timestamp('added_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  pk: index('group_members_pk_idx').on(t.groupId, t.userId),
  userIdx: index('group_members_user_idx').on(t.userId),
}));

export const apiKeys = authSchema.table('api_keys', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  hashedKey: text('hashed_key').notNull(),
  prefix: text('prefix').notNull().unique(),
  scope: jsonb('scope').notNull(),                  // {type, serviceName?|orgId?|userId?}
  permissions: jsonb('permissions').notNull(),      // string[]
  rateLimit: jsonb('rate_limit').notNull(),         // {requests, windowSec}
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: text('created_by').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  isActive: boolean('is_active').notNull().default(true),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
}, (t) => ({
  prefixIdx: index('api_keys_prefix_idx').on(t.prefix),
  activeIdx: index('api_keys_active_idx').on(t.isActive),
}));
