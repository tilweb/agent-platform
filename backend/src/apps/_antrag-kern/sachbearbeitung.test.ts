import { expect, test } from 'bun:test';
import { sachbearbeitungAusRechten } from './sachbearbeitung';

test('nur aktive Mitglieder von Gruppen mit Bearbeitungsrecht, alphabetisch', () => {
  const liste = sachbearbeitungAusRechten(
    [{ groupId: 'g-edit', role: 'editor' }, { groupId: 'g-view', role: 'viewer' }, { groupId: 'g-own', role: 'owner' }],
    [{ id: 'g-edit', memberIds: ['u1', 'u2'] }, { id: 'g-view', memberIds: ['u3'] }, { id: 'g-own', memberIds: ['u4', 'u1'] }],
    [
      { id: 'u1', username: 'zoe', displayName: 'Zoe Zander', isActive: true },
      { id: 'u2', username: 'alt', isActive: false },
      { id: 'u3', username: 'leser', isActive: true },
      { id: 'u4', username: 'anna', isActive: true },
    ],
  );
  expect(liste).toEqual([{ id: 'u4', name: 'anna' }, { id: 'u1', name: 'Zoe Zander' }]);
});
