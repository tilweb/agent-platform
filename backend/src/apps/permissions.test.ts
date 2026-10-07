import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { AppConfig } from './types';

// Registry und Gruppen ohne Datenbank: getApp liefert die App so, wie die
// Registry sie nach ENV-Klemme zurueckgibt (enabled=false bei Sperre).
let apps: Record<string, AppConfig> = {};
let groupsOf: Record<string, string[]> = {};

mock.module('./registry', () => ({
  getApp: async (id: string) => apps[id] ?? null,
  loadRegistry: async () => ({ apps }),
  saveRegistry: async () => {},
}));
mock.module('../auth/groups', () => ({
  getUserGroups: async (userId: string) => (groupsOf[userId] ?? []).map(id => ({ id })),
}));

const { resolveAppAccess } = await import('./permissions');

function app(overrides: Partial<AppConfig>): AppConfig {
  return {
    id: 'demo', name: 'Demo', description: '', icon: '', version: '1.0.0',
    enabled: true, routes: [], permissions: { groups: [] }, ...overrides,
  };
}

beforeEach(() => {
  apps = {};
  groupsOf = { alice: ['g-sach'], bob: ['g-andere'], carol: ['g-sach', 'g-leitung'] };
});

describe('resolveAppAccess', () => {
  test('unbekannte App → not_found', async () => {
    expect(await resolveAppAccess('alice', 'gibts-nicht')).toEqual({ allowed: false, reason: 'not_found' });
  });

  test('abgeschaltete App sperrt auch Berechtigte (L2)', async () => {
    apps.demo = app({ enabled: false, permissions: { groups: [{ groupId: 'g-sach', role: 'editor' }] } });
    expect(await resolveAppAccess('alice', 'demo')).toEqual({ allowed: false, reason: 'disabled' });
  });

  test('ohne Gruppenrechte → unconfigured', async () => {
    apps.demo = app({});
    expect(await resolveAppAccess('alice', 'demo')).toEqual({ allowed: false, reason: 'unconfigured' });
  });

  test('User ohne passende Gruppe → no_permission', async () => {
    apps.demo = app({ permissions: { groups: [{ groupId: 'g-sach', role: 'viewer' }] } });
    expect(await resolveAppAccess('bob', 'demo')).toEqual({ allowed: false, reason: 'no_permission' });
  });

  test('mehrere Gruppen → hoechste Rolle', async () => {
    apps.demo = app({
      permissions: { groups: [{ groupId: 'g-sach', role: 'viewer' }, { groupId: 'g-leitung', role: 'owner' }] },
    });
    expect(await resolveAppAccess('alice', 'demo')).toEqual({ allowed: true, role: 'viewer' });
    expect(await resolveAppAccess('carol', 'demo')).toEqual({ allowed: true, role: 'owner' });
  });
});
