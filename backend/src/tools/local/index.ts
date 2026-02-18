/**
 * Local tools - filesystem operations
 */

export { FileReadTool, fileReadTool } from './file-read';
export { FileWriteTool, fileWriteTool } from './file-write';
export { FileListTool, fileListTool } from './file-list';

import { fileReadTool } from './file-read';
import { fileWriteTool } from './file-write';
import { fileListTool } from './file-list';

// All local tools for easy registration
export const localTools = [
  fileReadTool,
  fileWriteTool,
  fileListTool,
];
