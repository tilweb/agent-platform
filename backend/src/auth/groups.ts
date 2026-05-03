/**
 * User Groups Storage — Postgres-backed (Drizzle).
 *
 * Auf DB-Ebene zwei Tabellen: `auth.groups` (Stammdaten) und `auth.group_members`
 * (Membership). Die public API behaelt das einfache `memberIds: string[]`-Modell
 * — wir laden Stammdaten + Mitglieder zusammen und joinen im Schreibpfad.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { groups as groupsTable, groupMembers as membersTable, users as usersTable } from '../db/schema/auth';

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  color?: string;
  memberIds?: string[];
}

function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function loadMembers(groupId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: membersTable.userId })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));
  return rows.map(r => r.userId);
}

function rowToGroup(row: typeof groupsTable.$inferSelect, memberIds: string[]): UserGroup {
  const meta = (row as any).metadata ?? {};
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: meta.color,
    memberIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: meta.createdBy,
  };
}

export async function saveGroup(group: UserGroup): Promise<void> {
  const db = getDb();
  const meta = { color: group.color, createdBy: group.createdBy };
  await db
    .insert(groupsTable)
    .values({
      id: group.id,
      name: group.name,
      description: group.description ?? null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      // metadata column added below if exists; for now stored as part of description-extension
    } as typeof groupsTable.$inferInsert)
    .onConflictDoUpdate({
      target: groupsTable.id,
      set: {
        name: group.name,
        description: group.description ?? null,
        updatedAt: group.updatedAt,
      },
    });

  // Membership-Sync: einfache "delete-and-replace"-Strategie. Bei kleinen
  // Gruppen unproblematisch; wenn skalierungsrelevant -> Diff-Sync nachziehen.
  await db.delete(membersTable).where(eq(membersTable.groupId, group.id));
  if (group.memberIds.length > 0) {
    await db.insert(membersTable).values(
      group.memberIds.map(userId => ({
        groupId: group.id,
        userId,
        role: 'member',
        addedAt: new Date().toISOString(),
      })),
    );
  }
  // metadata stash (color, createdBy) bleibt im Group-Memory; in einer
  // Folgemigration koennten wir der groups-Tabelle eine `metadata jsonb`
  // Spalte spendieren. Aktuell verlieren wir color/createdBy bei einem
  // Roundtrip durch die DB — Phase-2-TODO.
  void meta;
}

export async function loadGroup(groupId: string): Promise<UserGroup | null> {
  const db = getDb();
  const rows = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!rows[0]) return null;
  const memberIds = await loadMembers(groupId);
  return rowToGroup(rows[0], memberIds);
}

/**
 * Pruefe dass alle uebergebenen User-IDs existieren — verhindert
 * Phantom-Members in groups.memberIds. Siehe security-review M10.
 */
async function assertUsersExist(memberIds: string[]): Promise<void> {
  if (memberIds.length === 0) return;
  const db = getDb();
  const found = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, memberIds));
  const foundIds = new Set(found.map((r) => r.id));
  const missing = memberIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new Error(`Unknown user IDs: ${missing.join(', ')}`);
  }
}

export async function createGroup(
  input: CreateGroupInput,
  createdBy?: string,
): Promise<UserGroup> {
  const memberIds = input.memberIds || [];
  await assertUsersExist(memberIds);
  const now = new Date().toISOString();
  const group: UserGroup = {
    id: generateGroupId(),
    name: input.name,
    description: input.description,
    color: input.color,
    memberIds,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await saveGroup(group);
  return group;
}

export async function updateGroup(
  groupId: string,
  updates: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) return null;
  if (updates.memberIds) {
    await assertUsersExist(updates.memberIds);
  }
  const merged: UserGroup = {
    ...group,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveGroup(merged);
  return merged;
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(groupsTable).where(eq(groupsTable.id, groupId)).returning({ id: groupsTable.id });
  return res.length > 0;
}

export async function listGroups(): Promise<UserGroup[]> {
  const db = getDb();
  const rows = await db.select().from(groupsTable);
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.id);
  const memberRows = await db
    .select({ groupId: membersTable.groupId, userId: membersTable.userId })
    .from(membersTable)
    .where(inArray(membersTable.groupId, ids));
  const byGroup = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!byGroup.has(m.groupId)) byGroup.set(m.groupId, []);
    byGroup.get(m.groupId)!.push(m.userId);
  }
  const groups = rows.map(r => rowToGroup(r, byGroup.get(r.id) ?? []));
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

export async function addGroupMember(groupId: string, userId: string): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) return null;
  if (!group.memberIds.includes(userId)) {
    group.memberIds.push(userId);
    group.updatedAt = new Date().toISOString();
    await saveGroup(group);
  }
  return group;
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) return null;
  const idx = group.memberIds.indexOf(userId);
  if (idx !== -1) {
    group.memberIds.splice(idx, 1);
    group.updatedAt = new Date().toISOString();
    await saveGroup(group);
  }
  return group;
}

export async function getUserGroups(userId: string): Promise<UserGroup[]> {
  const db = getDb();
  const memberRows = await db
    .select({ groupId: membersTable.groupId })
    .from(membersTable)
    .where(eq(membersTable.userId, userId));
  if (memberRows.length === 0) return [];
  const ids = memberRows.map(r => r.groupId);
  const groupRows = await db.select().from(groupsTable).where(inArray(groupsTable.id, ids));
  const result: UserGroup[] = [];
  for (const row of groupRows) {
    const members = await loadMembers(row.id);
    result.push(rowToGroup(row, members));
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export async function isUserInGroup(userId: string, groupId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ userId: membersTable.userId })
    .from(membersTable)
    .where(eq(membersTable.groupId, groupId));
  return rows.some(r => r.userId === userId);
}

export async function isUserInAnyGroup(userId: string, groupIds: string[]): Promise<boolean> {
  if (groupIds.length === 0) return false;
  const db = getDb();
  const rows = await db
    .select({ groupId: membersTable.groupId })
    .from(membersTable)
    .where(eq(membersTable.userId, userId));
  const myGroups = new Set(rows.map(r => r.groupId));
  return groupIds.some(g => myGroups.has(g));
}
