/**
 * useResourceAccess Hook
 *
 * Custom hook for managing resource access via the RBAC API.
 * Provides functions for listing, adding, updating, and removing access entries.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

/**
 * Resource types that support RBAC
 */
export const RESOURCE_TYPES = ['project', 'collection', 'contract', 'skill', 'agent'];

/**
 * Available roles
 */
export const RESOURCE_ROLES = ['owner', 'admin', 'editor', 'viewer'];

/**
 * Role labels in German
 */
export const ROLE_LABELS = {
  owner: 'Eigentümer',
  admin: 'Administrator',
  editor: 'Bearbeiter',
  viewer: 'Betrachter',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS = {
  owner: 'Vollzugriff inkl. Löschen und Eigentümer übertragen',
  admin: 'Kann bearbeiten und Berechtigungen verwalten',
  editor: 'Kann Inhalte bearbeiten',
  viewer: 'Kann nur lesen',
};

/**
 * Hook for managing resource access
 *
 * @param {string} resourceType - Type of resource (project, collection, etc.)
 * @param {string} resourceId - ID of the resource
 * @returns {object} Access management functions and state
 */
export function useResourceAccess(resourceType, resourceId) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAccess = useCallback(async () => {
    if (!resourceType || !resourceId) {
      setUsers([]);
      setGroups([]);
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/resources/${resourceType}/${resourceId}/access`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler beim Laden der Berechtigungen');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setGroups(data.groups || []);
      setCurrentUser(data.currentUser || null);
    } catch (err) {
      setError(err.message);
      console.error('Error loading resource access:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  /**
   * Add access for a user or group
   */
  const addAccess = useCallback(async (principalType, principalId, role) => {
    try {
      const response = await apiPost(`/resources/${resourceType}/${resourceId}/access`, {
        principalType,
        principalId,
        role,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler beim Hinzufügen');
      }

      const newAccess = await response.json();

      // Update local state
      if (principalType === 'user') {
        setUsers(prev => [...prev, newAccess]);
      } else {
        setGroups(prev => [...prev, newAccess]);
      }

      return newAccess;
    } catch (err) {
      console.error('Error adding access:', err);
      throw err;
    }
  }, [resourceType, resourceId]);

  /**
   * Update role for existing access
   */
  const updateRole = useCallback(async (principalType, principalId, newRole) => {
    try {
      const response = await apiPut(
        `/resources/${resourceType}/${resourceId}/access/${principalType}/${principalId}`,
        { role: newRole }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }

      const updated = await response.json();

      // Update local state
      if (principalType === 'user') {
        setUsers(prev =>
          prev.map(u => u.principalId === principalId ? { ...u, role: newRole } : u)
        );
      } else {
        setGroups(prev =>
          prev.map(g => g.principalId === principalId ? { ...g, role: newRole } : g)
        );
      }

      return updated;
    } catch (err) {
      console.error('Error updating role:', err);
      throw err;
    }
  }, [resourceType, resourceId]);

  /**
   * Remove access
   */
  const removeAccess = useCallback(async (principalType, principalId) => {
    try {
      const response = await apiDelete(
        `/resources/${resourceType}/${resourceId}/access/${principalType}/${principalId}`
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler beim Entfernen');
      }

      // Update local state
      if (principalType === 'user') {
        setUsers(prev => prev.filter(u => u.principalId !== principalId));
      } else {
        setGroups(prev => prev.filter(g => g.principalId !== principalId));
      }

      return true;
    } catch (err) {
      console.error('Error removing access:', err);
      throw err;
    }
  }, [resourceType, resourceId]);

  /**
   * Transfer ownership to a new user
   */
  const transferOwnership = useCallback(async (newOwnerId) => {
    try {
      const response = await apiPost(
        `/resources/${resourceType}/${resourceId}/access/transfer`,
        { newOwnerId }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fehler bei der Übertragung');
      }

      // Reload to get updated state
      await loadAccess();
      return true;
    } catch (err) {
      console.error('Error transferring ownership:', err);
      throw err;
    }
  }, [resourceType, resourceId, loadAccess]);

  /**
   * Check if current user can manage access
   */
  const canManage = currentUser?.canManageAccess || false;

  /**
   * Check if current user is the owner
   */
  const isOwner = currentUser?.role === 'owner';

  return {
    users,
    groups,
    currentUser,
    loading,
    error,
    canManage,
    isOwner,
    refresh: loadAccess,
    addAccess,
    updateRole,
    removeAccess,
    transferOwnership,
  };
}

/**
 * Hook for getting available users to add
 */
export function useAvailableUsers(resourceType, resourceId) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!resourceType || !resourceId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/resources/${resourceType}/${resourceId}/access/available-users`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Benutzer');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading available users:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { users, loading, error, refresh: load };
}

/**
 * Hook for getting available groups to add
 */
export function useAvailableGroups(resourceType, resourceId) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!resourceType || !resourceId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/resources/${resourceType}/${resourceId}/access/available-groups`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Gruppen');
      }

      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading available groups:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, error, refresh: load };
}

/**
 * Hook for getting user's permissions on a resource
 */
export function useResourcePermissions(resourceType, resourceId) {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!resourceType || !resourceId) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/resources/${resourceType}/${resourceId}/access/permissions`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Berechtigungen');
      }

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { permissions, loading, error, refresh: load };
}
