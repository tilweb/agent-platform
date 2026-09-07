/** Keep all positions unless independent source identity proves duplication.
 * Value equality alone is never evidence: repeated lines are valid business data.
 * The compatibility name remains for callers; no indexes or boxes are shifted.
 */
import type { ProjectItemField } from './types';
export function dedupeListItems(items: unknown[], _itemFields: Record<string, ProjectItemField>): unknown[] {
  return [...items];
}
