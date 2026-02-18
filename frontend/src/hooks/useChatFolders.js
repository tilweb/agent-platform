import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';

export function useChatFolders() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiGet('/chats/folders');
      const data = await response.json();
      setFolders(data.folders || []);
      setError(null);
    } catch (err) {
      console.error('Error loading folders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Create folder
  const createFolder = useCallback(async (name, color) => {
    try {
      const response = await apiPost('/chats/folders', { name, color });
      const folder = await response.json();
      setFolders(prev => [...prev, folder]);
      return folder;
    } catch (err) {
      console.error('Error creating folder:', err);
      throw err;
    }
  }, []);

  // Delete folder
  const deleteFolder = useCallback(async (folderId) => {
    try {
      await apiDelete(`/chats/folders/${folderId}`);
      setFolders(prev => prev.filter(f => f.id !== folderId));
    } catch (err) {
      console.error('Error deleting folder:', err);
      throw err;
    }
  }, []);

  // Get chats in folder
  const getChatsInFolder = useCallback(async (folderId) => {
    try {
      const response = await apiGet(`/chats/folders/${folderId}/chats`);
      const data = await response.json();
      return data.chats || [];
    } catch (err) {
      console.error('Error getting chats in folder:', err);
      throw err;
    }
  }, []);

  // Get folder IDs for a chat
  const getChatFolderIds = useCallback(async (chatId) => {
    try {
      const response = await apiGet(`/chats/${chatId}/folders`);
      const data = await response.json();
      return data.folderIds || [];
    } catch (err) {
      console.error('Error getting chat folders:', err);
      return [];
    }
  }, []);

  // Update folder assignments for a chat
  const updateChatFolders = useCallback(async (chatId, folderIds) => {
    try {
      await apiPut(`/chats/${chatId}/folders`, { folderIds });
    } catch (err) {
      console.error('Error updating chat folders:', err);
      throw err;
    }
  }, []);

  return {
    folders,
    loading,
    error,
    loadFolders,
    createFolder,
    deleteFolder,
    getChatsInFolder,
    getChatFolderIds,
    updateChatFolders,
  };
}
