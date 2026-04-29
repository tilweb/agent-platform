/**
 * RBAC Storage — Postgres-backed (Drizzle).
 *
 * Frueher YAML-Files (`data/projects/<id>/access.yaml` etc.), jetzt eine
 * generische `auth.resource_access`-Tabelle. Composite-Key auf
 * (resourceType, resourceId, principalType, principalId).
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { resourceAccess } from '../db/schema/auth';
import type { ResourceType, ResourceAccess, PrincipalType, ResourceRole } from './types';

function rowToAccess(row: typeof resourceAccess.$inferSelect): ResourceAccess {
  return {
    principalType: row.principalType as PrincipalType,
    principalId: row.principalId,
    role: row.role as ResourceRole,
    grantedAt: row.grantedAt,
    grantedBy: row.grantedBy,
  };
}

export async function loadResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
): Promise<ResourceAccess[]> {
  const db = getDb();
  const rows = await db.select().from(resourceAccess)
    .where(and(eq(resourceAccess.resourceType, resourceType), eq(resourceAccess.resourceId, resourceId)));
  return rows.map(rowToAccess);
}

export async function saveResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  accessList: ResourceAccess[],
): Promise<void> {
  const db = getDb();
  // Replace-all-Semantik: alte Eintraege loeschen, neue rein.
  await db.delete(resourceAccess)
    .where(and(eq(resourceAccess.resourceType, resourceType), eq(resourceAccess.resourceId, resourceId)));
  if (accessList.length === 0) return;
  await db.insert(resourceAccess).values(accessList.map(a => ({
    resourceType,
    resourceId,
    principalType: a.principalType,
    principalId: a.principalId,
    role: a.role,
    grantedAt: a.grantedAt,
    grantedBy: a.grantedBy,
  })));
}

export async function getResourceAccessEntry(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
): Promise<ResourceAccess | null> {
  const db = getDb();
  const rows = await db.select().from(resourceAccess).where(and(
    eq(resourceAccess.resourceType, resourceType),
    eq(resourceAccess.resourceId, resourceId),
    eq(resourceAccess.principalType, principalType),
    eq(resourceAccess.principalId, principalId),
  )).limit(1);
  return rows[0] ? rowToAccess(rows[0]) : null;
}

export async function grantAccess(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
  role: ResourceRole,
  grantedBy: string,
): Promise<ResourceAccess> {
  const db = getDb();
  const now = new Date().toISOString();
  // Upsert: gleicher Composite-Key -> update.
  await db.delete(resourceAccess).where(and(
    eq(resourceAccess.resourceType, resourceType),
    eq(resourceAccess.resourceId, resourceId),
    eq(resourceAccess.principalType, principalType),
    eq(resourceAccess.principalId, principalId),
  ));
  await db.insert(resourceAccess).values({
    resourceType,
    resourceId,
    principalType,
    principalId,
    role,
    grantedAt: now,
    grantedBy,
  });
  return { principalType, principalId, role, grantedAt: now, grantedBy };
}

export async function updateAccessRole(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
  newRole: ResourceRole,
  updatedBy: string,
): Promise<ResourceAccess | null> {
  const existing = await getResourceAccessEntry(resourceType, resourceId, principalType, principalId);
  if (!existing) return null;
  return grantAccess(resourceType, resourceId, principalType, principalId, newRole, updatedBy);
}

export async function revokeAccess(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(resourceAccess).where(and(
    eq(resourceAccess.resourceType, resourceType),
    eq(resourceAccess.resourceId, resourceId),
    eq(resourceAccess.principalType, principalType),
    eq(resourceAccess.principalId, principalId),
  )).returning({ resourceId: resourceAccess.resourceId });
  return res.length > 0;
}

export async function getUsersWithAccess(
  resourceType: ResourceType,
  resourceId: string,
): Promise<ResourceAccess[]> {
  const list = await loadResourceAccess(resourceType, resourceId);
  return list.filter(a => a.principalType === 'user');
}

export async function getGroupsWithAccess(
  resourceType: ResourceType,
  resourceId: string,
): Promise<ResourceAccess[]> {
  const list = await loadResourceAccess(resourceType, resourceId);
  return list.filter(a => a.principalType === 'group');
}

export async function getResourceOwner(
  resourceType: ResourceType,
  resourceId: string,
): Promise<ResourceAccess | null> {
  const list = await loadResourceAccess(resourceType, resourceId);
  return list.find(a => a.role === 'owner') ?? null;
}

export async function transferOwnership(
  resourceType: ResourceType,
  resourceId: string,
  newOwnerId: string,
  transferredBy: string,
): Promise<boolean> {
  const list = await loadResourceAccess(resourceType, resourceId);
  const owner = list.find(a => a.role === 'owner');
  if (!owner) return false;
  // Demote alter Owner -> admin, neuer User -> owner (oder neu anlegen).
  await grantAccess(resourceType, resourceId, owner.principalType, owner.principalId, 'admin', transferredBy);
  await grantAccess(resourceType, resourceId, 'user', newOwnerId, 'owner', transferredBy);
  return true;
}

export async function initializeResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  creatorId: string,
): Promise<ResourceAccess> {
  return grantAccess(resourceType, resourceId, 'user', creatorId, 'owner', creatorId);
}

export async function deleteResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
): Promise<void> {
  const db = getDb();
  await db.delete(resourceAccess).where(and(
    eq(resourceAccess.resourceType, resourceType),
    eq(resourceAccess.resourceId, resourceId),
  ));
}

export async function hasAccessEntries(
  resourceType: ResourceType,
  resourceId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db.select({ rid: resourceAccess.resourceId }).from(resourceAccess).where(and(
    eq(resourceAccess.resourceType, resourceType),
    eq(resourceAccess.resourceId, resourceId),
  )).limit(1);
  return rows.length > 0;
}
