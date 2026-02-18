/**
 * useProjects Hook
 *
 * Custom hook for managing projects via API.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useProjects(includeArchived = false) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = includeArchived ? '/projects?includeArchived=true' : '/projects';
      const response = await apiGet(url);
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(async (name, options = {}) => {
    try {
      const response = await apiPost('/projects', { name, ...options });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create project');
      }
      const project = await response.json();
      setProjects(prev => [project, ...prev]);
      return project;
    } catch (err) {
      console.error('Error creating project:', err);
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (projectId, updates) => {
    try {
      const response = await apiPut(`/projects/${projectId}`, updates);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update project');
      }
      const project = await response.json();
      setProjects(prev => prev.map(p => p.id === projectId ? project : p));
      return project;
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (projectId) => {
    try {
      const response = await apiDelete(`/projects/${projectId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete project');
      }
      setProjects(prev => prev.filter(p => p.id !== projectId));
      return true;
    } catch (err) {
      console.error('Error deleting project:', err);
      throw err;
    }
  }, []);

  const archiveProject = useCallback(async (projectId) => {
    try {
      const response = await apiPost(`/projects/${projectId}/archive`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to archive project');
      }
      const project = await response.json();
      if (!includeArchived) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
      } else {
        setProjects(prev => prev.map(p => p.id === projectId ? project : p));
      }
      return project;
    } catch (err) {
      console.error('Error archiving project:', err);
      throw err;
    }
  }, [includeArchived]);

  const unarchiveProject = useCallback(async (projectId) => {
    try {
      const response = await apiPost(`/projects/${projectId}/unarchive`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to unarchive project');
      }
      const project = await response.json();
      setProjects(prev => prev.map(p => p.id === projectId ? project : p));
      return project;
    } catch (err) {
      console.error('Error unarchiving project:', err);
      throw err;
    }
  }, []);

  return {
    projects,
    loading,
    error,
    refresh: loadProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
  };
}

export function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/projects/${projectId}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load project');
      }
      const data = await response.json();
      setProject(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading project:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const updateProject = useCallback(async (updates) => {
    try {
      const response = await apiPut(`/projects/${projectId}`, updates);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update project');
      }
      const updated = await response.json();
      setProject(updated);
      return updated;
    } catch (err) {
      console.error('Error updating project:', err);
      throw err;
    }
  }, [projectId]);

  const updateSettings = useCallback(async (settings) => {
    try {
      const response = await apiPut(`/projects/${projectId}/settings`, settings);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update settings');
      }
      const updated = await response.json();
      setProject(prev => prev ? { ...prev, settings: updated } : null);
      return updated;
    } catch (err) {
      console.error('Error updating settings:', err);
      throw err;
    }
  }, [projectId]);

  return {
    project,
    loading,
    error,
    refresh: loadProject,
    updateProject,
    updateSettings,
  };
}

export function useProjectMemory(projectId) {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMemory = useCallback(async () => {
    if (!projectId) {
      setMemory(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/projects/${projectId}/memory`);
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
  }, [projectId]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  const addAbout = useCallback(async (content) => {
    try {
      const response = await apiPost(`/projects/${projectId}/memory/about`, { content, source: 'manual' });
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
  }, [projectId]);

  const addInstruction = useCallback(async (content, priority = 'normal') => {
    try {
      const response = await apiPost(`/projects/${projectId}/memory/instructions`, { content, priority, source: 'manual' });
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
  }, [projectId]);

  const addContext = useCallback(async (name, description = '', active = true) => {
    try {
      const response = await apiPost(`/projects/${projectId}/memory/context`, { name, description, active, source: 'manual' });
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
  }, [projectId]);

  const setContextActive = useCallback(async (itemId, active) => {
    try {
      const response = await apiPut(`/projects/${projectId}/memory/context/${itemId}/active`, { active });
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
  }, [projectId]);

  const deleteItem = useCallback(async (section, itemId) => {
    try {
      const response = await apiDelete(`/projects/${projectId}/memory/${section}/${itemId}`);
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
  }, [projectId]);

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

export function useProjectMembers(projectId) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/projects/${projectId}/members`);
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
  }, [projectId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const addMember = useCallback(async (userId, role) => {
    try {
      const response = await apiPost(`/projects/${projectId}/members`, { userId, role });
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
  }, [projectId]);

  const updateMemberRole = useCallback(async (userId, role) => {
    try {
      const response = await apiPut(`/projects/${projectId}/members/${userId}`, { role });
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
  }, [projectId]);

  const removeMember = useCallback(async (userId) => {
    try {
      const response = await apiDelete(`/projects/${projectId}/members/${userId}`);
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
  }, [projectId]);

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

export function useProjectKBLinks(projectId) {
  const [links, setLinks] = useState({ collections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLinks = useCallback(async () => {
    if (!projectId) {
      setLinks({ collections: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/projects/${projectId}/collections`);
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
  }, [projectId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const linkCollection = useCallback(async (collectionId) => {
    try {
      const response = await apiPost(`/projects/${projectId}/collections`, { collectionId });
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
  }, [projectId]);

  const unlinkCollection = useCallback(async (collectionId) => {
    try {
      const response = await apiDelete(`/projects/${projectId}/collections/${collectionId}`);
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
  }, [projectId]);

  return {
    links,
    loading,
    error,
    refresh: loadLinks,
    linkCollection,
    unlinkCollection,
  };
}

export function useProjectChats(projectId) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadChats = useCallback(async () => {
    if (!projectId) {
      setChats([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiGet(`/projects/${projectId}/chats`);
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
  }, [projectId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const deleteChat = useCallback(async (chatId) => {
    try {
      const response = await apiDelete(`/projects/${projectId}/chats/${chatId}`);
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
  }, [projectId]);

  return {
    chats,
    loading,
    error,
    refresh: loadChats,
    deleteChat,
  };
}
