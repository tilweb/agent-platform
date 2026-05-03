/**
 * Auth Module - Public API
 */

// Types
export type { User, UserWithoutPassword, UserRole, Session, CreateUserInput, LoginInput, AuthResult } from './types';
export { SESSION_CONFIG, sanitizeUser } from './types';

// Password utilities
export { hashPassword, verifyPassword, verifyAndRehash, needsRehash, validatePassword, validateUsername } from './password';

// User storage
export {
  saveUser,
  loadUser,
  findUserByUsername,
  findUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  hasUsers,
} from './storage';

// Session management
export {
  createSession,
  getSession,
  validateSession,
  deleteSession,
  deleteUserSessions,
  extendSession,
  cleanupExpiredSessions,
  getUserSessions,
} from './session';

// Middleware
export {
  authMiddleware,
  adminMiddleware,
  optionalAuthMiddleware,
  isAuthenticated,
  getCurrentUser,
  getCurrentUserId,
} from './middleware';

// Groups
export {
  createGroup,
  loadGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  addGroupMember,
  removeGroupMember,
  getUserGroups,
  isUserInGroup,
  isUserInAnyGroup,
} from './groups';
export type { UserGroup, CreateGroupInput } from './groups';
