/**
 * Authentication Routes
 */

import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { authRateLimit, sensitiveRateLimit } from '../middleware/rateLimit';
import { auditLogin, auditLogout, auditUserAction, AuditAction } from '../services/auditLog';
import { getClientIp } from '../utils/clientIp';
import {
  createUser,
  findUserByUsername,
  hasUsers,
  verifyAndRehash,
  validatePassword,
  validateUsername,
  sanitizeUser,
  SESSION_CONFIG,
  createSession,
  deleteSession,
  getSession,
  loadUser,
  listUsers,
  updateUser,
  deleteUser,
  authMiddleware,
  getCurrentUser,
  hashPassword,
  // Groups
  createGroup,
  loadGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  addGroupMember,
  removeGroupMember,
} from '../auth';
import { randomBytes } from 'crypto';
import { internalError } from '../utils/errorHandler';

const authRoutes = new Hono();

/**
 * POST /api/auth/register - Register new user
 */
authRoutes.post('/register', authRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, email, displayName } = body;

    // Validate username
    if (!username) {
      return c.json({ error: 'Username is required' }, 400);
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return c.json({ error: usernameValidation.errors.join(', ') }, 400);
    }

    // Validate password
    if (!password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({ error: passwordValidation.errors.join(', ') }, 400);
    }

    // Check if username is taken
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return c.json({ error: 'Username is already taken' }, 409);
    }

    // Create user
    const user = await createUser({
      username,
      password,
      email,
      displayName,
    });

    // Create session
    const userAgent = c.req.header('User-Agent');
    const ipAddress = getClientIp(c);
    const session = await createSession(user, userAgent, ipAddress);

    // Set session cookie
    setCookie(c, SESSION_CONFIG.cookieName, session.id, SESSION_CONFIG.cookieOptions);

    return c.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/login - Login user
 */
authRoutes.post('/login', authRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const userAgent = c.req.header('User-Agent');
    const ipAddress = getClientIp(c);

    // Find user
    const user = await findUserByUsername(username);
    if (!user) {
      await auditLogin(false, username, ipAddress, userAgent, 'User not found');
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // Verify password and check if rehash is needed
    const [validPassword, newHash] = await verifyAndRehash(password, user.passwordHash);
    if (!validPassword) {
      await auditLogin(false, username, ipAddress, userAgent, 'Invalid password');
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // Update password hash if parameters have changed (transparent rehashing)
    if (newHash) {
      await updateUser(user.id, { passwordHash: newHash });
    }

    // Check if user is active
    if (!user.isActive) {
      await auditLogin(false, username, ipAddress, userAgent, 'Account deactivated');
      return c.json({ error: 'Account is deactivated' }, 403);
    }

    // Session fixation prevention: invalidate any existing session
    const existingSessionId = getCookie(c, SESSION_CONFIG.cookieName);
    if (existingSessionId) {
      await deleteSession(existingSessionId);
    }

    // Create new session (always generates new ID)
    const session = await createSession(user, userAgent, ipAddress);

    // Set session cookie
    setCookie(c, SESSION_CONFIG.cookieName, session.id, SESSION_CONFIG.cookieOptions);

    // Audit successful login
    await auditLogin(true, username, ipAddress, userAgent);

    return c.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/logout - Logout user
 */
authRoutes.post('/logout', async (c) => {
  try {
    const sessionId = getCookie(c, SESSION_CONFIG.cookieName);
    const ipAddress = getClientIp(c);

    let userId: string | undefined;
    if (sessionId) {
      const session = await getSession(sessionId);
      userId = session?.userId;
      await deleteSession(sessionId);
    }

    deleteCookie(c, SESSION_CONFIG.cookieName, {
      path: '/',
    });

    // Audit logout
    if (userId) {
      await auditLogout(userId, undefined, ipAddress);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/auth/me - Get current user
 */
authRoutes.get('/me', async (c) => {
  try {
    const sessionId = getCookie(c, SESSION_CONFIG.cookieName);

    if (!sessionId) {
      return c.json({ authenticated: false });
    }

    const session = await getSession(sessionId);
    if (!session) {
      deleteCookie(c, SESSION_CONFIG.cookieName, { path: '/' });
      return c.json({ authenticated: false });
    }

    const user = await loadUser(session.userId);
    if (!user || !user.isActive) {
      deleteCookie(c, SESSION_CONFIG.cookieName, { path: '/' });
      return c.json({ authenticated: false });
    }

    return c.json({
      authenticated: true,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/auth/status - Check if any users exist (for initial setup)
 */
authRoutes.get('/status', async (c) => {
  try {
    const usersExist = await hasUsers();

    return c.json({
      initialized: usersExist,
      requiresSetup: !usersExist,
    });
  } catch (error: any) {
    console.error('Auth status error:', error);
    return internalError(c, error);
  }
});

// ============ Admin Routes ============

import type { Context, Next, MiddlewareHandler } from 'hono';

/**
 * Middleware to check if user is admin
 */
const adminMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = getCurrentUser(c);
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
};

/**
 * GET /api/auth/users - List all users (admin only)
 */
authRoutes.get('/users', authMiddleware, adminMiddleware, async (c) => {
  try {
    const users = await listUsers();
    return c.json({
      users: users.map(sanitizeUser),
    });
  } catch (error: any) {
    console.error('List users error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/users - Create a new user (admin only)
 */
authRoutes.post('/users', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { username, email, displayName, role } = body;

    // Validate username
    if (!username) {
      return c.json({ error: 'Username is required' }, 400);
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return c.json({ error: usernameValidation.errors.join(', ') }, 400);
    }

    // Check if username is taken
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return c.json({ error: 'Username is already taken' }, 409);
    }

    // Generate initial password
    const initialPassword = generateInitialPassword();

    // Create user
    const user = await createUser({
      username,
      password: initialPassword,
      email,
      displayName,
      role: role || 'user',
    });

    // Note: Password is returned ONCE for admin to share with user.
    // This is a conscious design decision for internal admin tools.
    // For production with external users, implement email-based password setup.
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    return c.json({
      success: true,
      user: sanitizeUser(user),
      initialPassword, // Shown once - admin should copy and share securely
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/auth/users/:id - Update a user (admin only)
 */
authRoutes.put('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { email, displayName, role, isActive } = body;

    const user = await loadUser(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Prevent demoting the last admin
    if (user.role === 'admin' && role === 'user') {
      const users = await listUsers();
      const adminCount = users.filter(u => u.role === 'admin' && u.isActive).length;
      if (adminCount <= 1) {
        return c.json({ error: 'Cannot demote the last admin' }, 400);
      }
    }

    const updates: any = { updatedAt: new Date().toISOString() };
    if (email !== undefined) updates.email = email;
    if (displayName !== undefined) updates.displayName = displayName;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const updatedUser = await updateUser(userId, updates);
    return c.json({
      success: true,
      user: sanitizeUser(updatedUser!),
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/users/:id/reset-password - Reset password (admin only)
 */
authRoutes.post('/users/:id/reset-password', sensitiveRateLimit, authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = getCurrentUser(c);

    const user = await loadUser(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Generate new password
    const newPassword = generateInitialPassword();
    const passwordHash = await hashPassword(newPassword);

    await updateUser(userId, { passwordHash });

    // Audit password reset
    await auditUserAction(
      AuditAction.PASSWORD_RESET,
      { userId: currentUser?.id || 'unknown', username: currentUser?.username },
      userId,
      { targetUsername: user.username }
    );

    // Note: Password is returned ONCE for admin to share with user.
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    return c.json({
      success: true,
      newPassword, // Shown once - admin should copy and share securely
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/auth/users/:id - Delete a user (admin only)
 */
authRoutes.delete('/users/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Prevent self-deletion
    if (currentUser?.id === userId) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    const user = await loadUser(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const users = await listUsers();
      const adminCount = users.filter(u => u.role === 'admin' && u.isActive).length;
      if (adminCount <= 1) {
        return c.json({ error: 'Cannot delete the last admin' }, 400);
      }
    }

    await deleteUser(userId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return internalError(c, error);
  }
});

/**
 * Generate a random initial password
 */
function generateInitialPassword(): string {
  // Generate 12 random characters (URL-safe)
  return randomBytes(9).toString('base64url');
}

// ============ Group Routes ============

/**
 * GET /api/auth/groups - List all groups (admin only)
 */
authRoutes.get('/groups', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groups = await listGroups();
    return c.json({ groups });
  } catch (error: any) {
    console.error('List groups error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/groups - Create a new group (admin only)
 */
authRoutes.post('/groups', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, color, memberIds } = body;

    if (!name?.trim()) {
      return c.json({ error: 'Group name is required' }, 400);
    }

    const currentUser = getCurrentUser(c);
    const group = await createGroup(
      { name: name.trim(), description, color, memberIds },
      currentUser?.id
    );

    return c.json({ success: true, group });
  } catch (error: any) {
    console.error('Create group error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/auth/groups/:id - Get a specific group (admin only)
 */
authRoutes.get('/groups/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groupId = c.req.param('id');
    const group = await loadGroup(groupId);

    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    return c.json({ group });
  } catch (error: any) {
    console.error('Get group error:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/auth/groups/:id - Update a group (admin only)
 */
authRoutes.put('/groups/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groupId = c.req.param('id');
    const body = await c.req.json();
    const { name, description, color, memberIds } = body;

    const group = await loadGroup(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (memberIds !== undefined) updates.memberIds = memberIds;

    const updatedGroup = await updateGroup(groupId, updates);
    return c.json({ success: true, group: updatedGroup });
  } catch (error: any) {
    console.error('Update group error:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/auth/groups/:id - Delete a group (admin only)
 */
authRoutes.delete('/groups/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groupId = c.req.param('id');

    const group = await loadGroup(groupId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    await deleteGroup(groupId);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete group error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/auth/groups/:id/members - Add member to group (admin only)
 */
authRoutes.post('/groups/:id/members', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groupId = c.req.param('id');
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    const group = await addGroupMember(groupId, userId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    return c.json({ success: true, group });
  } catch (error: any) {
    console.error('Add group member error:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/auth/groups/:id/members/:userId - Remove member from group (admin only)
 */
authRoutes.delete('/groups/:id/members/:userId', authMiddleware, adminMiddleware, async (c) => {
  try {
    const groupId = c.req.param('id');
    const userId = c.req.param('userId');

    const group = await removeGroupMember(groupId, userId);
    if (!group) {
      return c.json({ error: 'Group not found' }, 404);
    }

    return c.json({ success: true, group });
  } catch (error: any) {
    console.error('Remove group member error:', error);
    return internalError(c, error);
  }
});

export { authRoutes };
