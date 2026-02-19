/**
 * useSpaces Hook
 *
 * Custom hook for managing spaces via API.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useSpaces(includeArchived = false) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSpaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = includeArchived ? '/spaces?includeArchived=true' : '/spaces';
      const response = await apiGet(url);
      if (!response.ok) {
        throw new Error('Failed to load spaces');
      }
      const data = await response.json();
      setSpaces(data.spaces || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading spaces:', err);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const createSpace = useCallback(async (name, options = {}) => {
    try {
      const response = await apiPost('/spaces', { name, ...options });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create space');
      }
      const space = await response.json();
      setSpaces(prev => [space, ...prev]);
      return space;
    } catch (err) {
      console.error('Error creating space:', err);
      throw err;
    }
  }, []);

  const updateSpace = useCallback(async (spaceId, updates) => {
    try {
      const response = await apiPut(`/spaces/${spaceId}`, updates);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update space');
      }
      const space = await response.json();
      setSpaces(prev => prev.map(p => p.id === spaceId ? space : p));
      return space;
    } catch (err) {
      console.error('Error updating space:', err);
      throw err;
    }
  }, []);

  const deleteSpace = useCallback(async (spaceId) => {
    try {
      const response = await apiDelete(`/spaces/${spaceId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete space');
      }
      setSpaces(prev => prev.filter(p => p.id !== spaceId));
      return true;
    } catch (err) {
      console.error('Error deleting space:', err);
      throw err;
    }
  }, []);

  const archiveSpace = useCallback(async (spaceId) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/archive`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to archive space');
      }
      const space = await response.json();
      if (!includeArchived) {
        setSpaces(prev => prev.filter(p => p.id !== spaceId));
      } else {
        setSpaces(prev => prev.map(p => p.id === spaceId ? space : p));
      }
      return space;
    } catch (err) {
      console.error('Error archiving space:', err);
      throw err;
    }
  }, [includeArchived]);

  const unarchiveSpace = useCallback(async (spaceId) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/unarchive`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to unarchive space');
      }
      const space = await response.json();
      setSpaces(prev => prev.map(p => p.id === spaceId ? space : p));
      return space;
    } catch (err) {
      console.error('Error unarchiving space:', err);
      throw err;
    }
  }, []);

  return {
    spaces,
    loading,
    error,
    refresh: loadSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    archiveSpace,
    unarchiveSpace,
  };
}

export function useSpace(spaceId) {
  const [space, setSpace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSpace = useCallback(async () => {
    if (!spaceId) {
      setSpace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/spaces/${spaceId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load space');
      }
      const data = await response.json();
      setSpace(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading space:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadSpace();
  }, [loadSpace]);

  const updateSpace = useCallback(async (updates) => {
    try {
      const response = await apiPut(`/spaces/${spaceId}`, updates);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update space');
      }
      const updated = await response.json();
      setSpace(updated);
      return updated;
    } catch (err) {
      console.error('Error updating space:', err);
      throw err;
    }
  }, [spaceId]);

  const updateSettings = useCallback(async (settings) => {
    try {
      const response = await apiPut(`/spaces/${spaceId}/settings`, settings);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update settings');
      }
      const updated = await response.json();
      setSpace(prev => prev ? { ...prev, settings: updated } : null);
      return updated;
    } catch (err) {
      console.error('Error updating settings:', err);
      throw err;
    }
  }, [spaceId]);

  return {
    space,
    loading,
    error,
    refresh: loadSpace,
    updateSpace,
    updateSettings,
  };
}

export function useSpaceMemory(spaceId) {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMemory = useCallback(async () => {
    if (!spaceId) {
      setMemory(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/spaces/${spaceId}/memory`);
      if (!response.ok) {
        throw new Error('Failed to load memory');
      }
      const data = await response.json();
      setMemory(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading memory:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  const addAbout = useCallback(async (content) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/memory/about`, { content, source: 'manual' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add item');
      }
      const item = await response.json();
      setMemory(prev => ({
        ...prev,
        about: [...(prev.about || []), item],
      }));
      return item;
    } catch (err) {
      console.error('Error adding about item:', err);
      throw err;
    }
  }, [spaceId]);

  const addInstruction = useCallback(async (content, priority = 'normal') => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/memory/instructions`, { content, priority, source: 'manual' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add instruction');
      }
      const item = await response.json();
      setMemory(prev => ({
        ...prev,
        instructions: [...(prev.instructions || []), item],
      }));
      return item;
    } catch (err) {
      console.error('Error adding instruction:', err);
      throw err;
    }
  }, [spaceId]);

  const addContext = useCallback(async (name, description = '', active = true) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/memory/context`, { name, description, active, source: 'manual' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add context');
      }
      const item = await response.json();
      setMemory(prev => ({
        ...prev,
        context: [...(prev.context || []), item],
      }));
      return item;
    } catch (err) {
      console.error('Error adding context:', err);
      throw err;
    }
  }, [spaceId]);

  const setContextActive = useCallback(async (itemId, active) => {
    try {
      const response = await apiPut(`/spaces/${spaceId}/memory/context/${itemId}/active`, { active });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update context');
      }
      setMemory(prev => ({
        ...prev,
        context: prev.context.map(item =>
          item.id === itemId ? { ...item, active } : item
        ),
      }));
      return true;
    } catch (err) {
      console.error('Error updating context:', err);
      throw err;
    }
  }, [spaceId]);

  const deleteItem = useCallback(async (section, itemId) => {
    try {
      const response = await apiDelete(`/spaces/${spaceId}/memory/${section}/${itemId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete item');
      }
      setMemory(prev => ({
        ...prev,
        [section]: prev[section].filter(item => item.id !== itemId),
      }));
      return true;
    } catch (err) {
      console.error('Error deleting item:', err);
      throw err;
    }
  }, [spaceId]);

  const stats = memory ? {
    about: memory.about?.length || 0,
    instructions: memory.instructions?.length || 0,
    context: memory.context?.length || 0,
    activeContext: memory.context?.filter(c => c.active)?.length || 0,
  } : null;

  return {
    memory,
    loading,
    error,
    stats,
    refresh: loadMemory,
    addAbout,
    addInstruction,
    addContext,
    setContextActive,
    deleteItem,
  };
}

export function useSpaceMembers(spaceId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMembers = useCallback(async () => {
    if (!spaceId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/spaces/${spaceId}/members`);
      if (!response.ok) {
        throw new Error('Failed to load members');
      }
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading members:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const addMember = useCallback(async (userId, role) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/members`, { userId, role });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add member');
      }
      const member = await response.json();
      setMembers(prev => {
        const exists = prev.find(m => m.userId === userId);
        if (exists) {
          return prev.map(m => m.userId === userId ? member : m);
        }
        return [...prev, member];
      });
      return member;
    } catch (err) {
      console.error('Error adding member:', err);
      throw err;
    }
  }, [spaceId]);

  const updateMemberRole = useCallback(async (userId, role) => {
    try {
      const response = await apiPut(`/spaces/${spaceId}/members/${userId}`, { role });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update role');
      }
      setMembers(prev => prev.map(m =>
        m.userId === userId ? { ...m, role } : m
      ));
      return true;
    } catch (err) {
      console.error('Error updating member role:', err);
      throw err;
    }
  }, [spaceId]);

  const removeMember = useCallback(async (userId) => {
    try {
      const response = await apiDelete(`/spaces/${spaceId}/members/${userId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to remove member');
      }
      setMembers(prev => prev.filter(m => m.userId !== userId));
      return true;
    } catch (err) {
      console.error('Error removing member:', err);
      throw err;
    }
  }, [spaceId]);

  return {
    members,
    loading,
    error,
    refresh: loadMembers,
    addMember,
    updateMemberRole,
    removeMember,
  };
}

export function useSpaceKBLinks(spaceId) {
  const [links, setLinks] = useState({ collections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLinks = useCallback(async () => {
    if (!spaceId) {
      setLinks({ collections: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/spaces/${spaceId}/collections`);
      if (!response.ok) {
        throw new Error('Failed to load KB links');
      }
      const data = await response.json();
      setLinks(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading KB links:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const linkCollection = useCallback(async (collectionId) => {
    try {
      const response = await apiPost(`/spaces/${spaceId}/collections`, { collectionId });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to link collection');
      }
      const link = await response.json();
      setLinks(prev => ({
        ...prev,
        collections: [...prev.collections, link],
      }));
      return link;
    } catch (err) {
      console.error('Error linking collection:', err);
      throw err;
    }
  }, [spaceId]);

  const unlinkCollection = useCallback(async (collectionId) => {
    try {
      const response = await apiDelete(`/spaces/${spaceId}/collections/${collectionId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to unlink collection');
      }
      setLinks(prev => ({
        ...prev,
        collections: prev.collections.filter(c => c.collectionId !== collectionId),
      }));
      return true;
    } catch (err) {
      console.error('Error unlinking collection:', err);
      throw err;
    }
  }, [spaceId]);

  return {
    links,
    loading,
    error,
    refresh: loadLinks,
    linkCollection,
    unlinkCollection,
  };
}

export function useSpaceChats(spaceId) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadChats = useCallback(async () => {
    if (!spaceId) {
      setChats([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/spaces/${spaceId}/chats`);
      if (!response.ok) {
        throw new Error('Failed to load chats');
      }
      const data = await response.json();
      setChats(data.chats || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const deleteChat = useCallback(async (chatId) => {
    try {
      const response = await apiDelete(`/spaces/${spaceId}/chats/${chatId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete chat');
      }
      setChats(prev => prev.filter(c => c.id !== chatId));
      return true;
    } catch (err) {
      console.error('Error deleting chat:', err);
      throw err;
    }
  }, [spaceId]);

  return {
    chats,
    loading,
    error,
    refresh: loadChats,
    deleteChat,
  };
}
