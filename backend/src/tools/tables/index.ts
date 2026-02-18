/**
 * Table Tools
 *
 * Agent tools for working with the table system.
 */

import { TableListTool } from './table-list';
import { TableQueryTool } from './table-query';
import { TableAddTool } from './table-add';
import { TableUpdateTool } from './table-update';
import { TableDeleteTool } from './table-delete';

export const tableTools = [
  new TableListTool(),
  new TableQueryTool(),
  new TableAddTool(),
  new TableUpdateTool(),
  new TableDeleteTool(),
];

export { TableListTool } from './table-list';
export { TableQueryTool } from './table-query';
export { TableAddTool } from './table-add';
export { TableUpdateTool } from './table-update';
export { TableDeleteTool } from './table-delete';
