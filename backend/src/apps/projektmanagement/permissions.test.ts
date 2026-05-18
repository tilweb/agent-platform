/**
 * Tests fuer den Permission-Resolver (Phase A + Phase-2-RBAC + App-Rolle-Floor).
 *
 * `resolveRole(userId, ownerId, permissions, userGroupIds, appRole)` ist die
 * zentrale Funktion, die effektive Resource-Rollen bestimmt. Sie wird von:
 * - `getEffectiveIdeeRole`, `getEffectiveAuftragRole`
 * - `listAccessibleIdeeIds`, `listAccessibleAuftragIds`
 * verwendet — und damit von praktisch jedem PM-Endpoint, der Sichtbarkeit
 * oder Edit-Recht prueft. Falsche Werte hier → Lecks oder gesperrte User.
 *
 * Run: `cd backend && bun test src/apps/projektmanagement/permissions.test.ts`
 */

import { test, expect, describe } from 'bun:test';
import { resolveRole, defaultOwnerPermissions } from './permissions';

const USER_A = 'user-a';
const USER_B = 'user-b';
const GROUP_PMO = 'group-pmo';
const GROUP_DEV = 'group-dev';

describe('resolveRole — ohne Permissions, ohne App-Rolle', () => {
  test('niemand: alle null → null', () => {
    const role = resolveRole(USER_A, null, null, new Set(), null);
    expect(role).toBeNull();
  });

  test('User ist Ersteller (ownerId === userId) → owner', () => {
    const role = resolveRole(USER_A, USER_A, null, new Set(), null);
    expect(role).toBe('owner');
  });

  test('User ist NICHT Ersteller, ohne weitere Rechte → null', () => {
    const role = resolveRole(USER_A, USER_B, null, new Set(), null);
    expect(role).toBeNull();
  });

  test('ownerId === user_default (Legacy-Wert) ≠ echter User → null', () => {
    const role = resolveRole(USER_A, 'user_default', null, new Set(), null);
    expect(role).toBeNull();
  });
});

describe('resolveRole — Resource-Level User-Permissions', () => {
  test('User in permissions.users mit Rolle owner → owner', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'owner' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('owner');
  });

  test('User in permissions.users mit Rolle editor → editor', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'editor' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('editor');
  });

  test('User in permissions.users mit Rolle viewer → viewer', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'viewer' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('viewer');
  });

  test('User nicht in permissions.users, andere Eintraege vorhanden → null', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_B, role: 'owner' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBeNull();
  });

  test('Ersteller (created_by) gewinnt gegen niedrigere permissions-Rolle (viewer)', () => {
    // User ist Ersteller (owner via created_by) UND auch als viewer eingetragen
    // → die hoechste Rolle gewinnt: owner
    const role = resolveRole(USER_A, USER_A, {
      users: [{ userId: USER_A, role: 'viewer' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('owner');
  });
});

describe('resolveRole — Resource-Level Group-Permissions', () => {
  test('User in Gruppe mit owner → owner', () => {
    const role = resolveRole(USER_A, null, {
      users: [],
      groups: [{ groupId: GROUP_PMO, role: 'owner' }],
    }, new Set([GROUP_PMO]), null);
    expect(role).toBe('owner');
  });

  test('User in unrelated Gruppe → null', () => {
    const role = resolveRole(USER_A, null, {
      users: [],
      groups: [{ groupId: GROUP_PMO, role: 'owner' }],
    }, new Set([GROUP_DEV]), null);
    expect(role).toBeNull();
  });

  test('User in mehreren Gruppen: hoechste Rolle gewinnt', () => {
    const role = resolveRole(USER_A, null, {
      users: [],
      groups: [
        { groupId: GROUP_DEV, role: 'viewer' },
        { groupId: GROUP_PMO, role: 'owner' },
      ],
    }, new Set([GROUP_DEV, GROUP_PMO]), null);
    expect(role).toBe('owner');
  });

  test('User+Gruppe parallel: User-Rolle gewinnt wenn hoeher', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'owner' }],
      groups: [{ groupId: GROUP_DEV, role: 'viewer' }],
    }, new Set([GROUP_DEV]), null);
    expect(role).toBe('owner');
  });
});

describe('resolveRole — App-Rolle als Floor (Phase-A-Update)', () => {
  test('App-Owner ohne Resource-Permissions → owner (Floor)', () => {
    const role = resolveRole(USER_A, USER_B, null, new Set(), 'owner');
    expect(role).toBe('owner');
  });

  test('App-Editor ohne Resource-Permissions → editor (Floor)', () => {
    const role = resolveRole(USER_A, USER_B, null, new Set(), 'editor');
    expect(role).toBe('editor');
  });

  test('App-Viewer ohne Resource-Permissions → viewer (Floor)', () => {
    const role = resolveRole(USER_A, USER_B, null, new Set(), 'viewer');
    expect(role).toBe('viewer');
  });

  test('MAX-Logik: App-Viewer + Resource-Editor → editor (höchste gewinnt)', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'editor' }],
      groups: [],
    }, new Set(), 'viewer');
    expect(role).toBe('editor');
  });

  test('MAX-Logik: App-Owner + Resource-Viewer → owner (App-Floor gewinnt)', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'viewer' }],
      groups: [],
    }, new Set(), 'owner');
    expect(role).toBe('owner');
  });

  test('App-Owner + Ersteller (created_by) → owner', () => {
    // Ersteller-Fallback gibt owner; App-Floor sagt auch owner → owner
    const role = resolveRole(USER_A, USER_A, null, new Set(), 'owner');
    expect(role).toBe('owner');
  });

  test('App-Floor null (kein App-Zugriff): nur Resource-Rolle zählt', () => {
    const role = resolveRole(USER_A, null, {
      users: [{ userId: USER_A, role: 'editor' }],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('editor');
  });
});

describe('defaultOwnerPermissions — Helper für neue Ressourcen', () => {
  test('liefert User-Owner-Eintrag + leere Groups', () => {
    const perms = defaultOwnerPermissions(USER_A);
    expect(perms).toEqual({
      users: [{ userId: USER_A, role: 'owner' }],
      groups: [],
    });
  });

  test('mit resolveRole: neuer Ersteller hat owner-Rolle', () => {
    const perms = defaultOwnerPermissions(USER_A);
    const role = resolveRole(USER_A, null, perms, new Set(), null);
    expect(role).toBe('owner');
  });

  test('anderer User hat keinen Zugriff via Default-Perms', () => {
    const perms = defaultOwnerPermissions(USER_A);
    const role = resolveRole(USER_B, null, perms, new Set(), null);
    expect(role).toBeNull();
  });
});

describe('resolveRole — Edge Cases', () => {
  test('leere permissions.users + permissions.groups → null (wenn nichts anderes greift)', () => {
    const role = resolveRole(USER_A, null, { users: [], groups: [] }, new Set(), null);
    expect(role).toBeNull();
  });

  test('undefined permissions (legacy null-Cast) → kein Crash, null-Rückgabe', () => {
    const role = resolveRole(USER_A, null, undefined, new Set(), null);
    expect(role).toBeNull();
  });

  test('ownerId undefined → behandelt wie null (kein owner-Match)', () => {
    const role = resolveRole(USER_A, undefined, null, new Set(), null);
    expect(role).toBeNull();
  });

  test('Duplikate in permissions.users: höchste Rolle gewinnt', () => {
    const role = resolveRole(USER_A, null, {
      users: [
        { userId: USER_A, role: 'viewer' },
        { userId: USER_A, role: 'owner' },
        { userId: USER_A, role: 'editor' },
      ],
      groups: [],
    }, new Set(), null);
    expect(role).toBe('owner');
  });

  test('Komplexer Real-World-Case: Demo-User in PMO-Gruppe sieht Demo-Auftrag', () => {
    // Auftrag wurde von "migration" angelegt (Legacy-Bug), keine permissions.
    // andreas_bachmann ist in PMO-Gruppe, die App-Owner ist. Floor → owner.
    const role = resolveRole(
      'user_andreas_bachmann',
      'migration',   // Legacy-created_by
      null,           // keine expliziten Resource-Permissions
      new Set(['group-pmo']),
      'owner',        // App-Owner via PMO-Gruppe
    );
    expect(role).toBe('owner');
  });
});
