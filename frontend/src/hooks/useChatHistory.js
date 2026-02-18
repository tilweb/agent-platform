import { useState, useCallback } from 'react';
import { apiGet, apiDelete } from '../utils/apiFetch';

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 30;

export function useChatHistory() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const loadChats = useCallback(async () => {
    try {
      const res = await apiGet(`/chats?limit=${INITIAL_LIMIT}&offset=0`);
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.chats || []);
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  }, []);

  const loadMoreChats = useCallback(async () => {
    if (!hasMore) return;

    try {
      const offset = chats.length;
      const res = await apiGet(`/chats?limit=${LOAD_MORE_LIMIT}&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      setChats(prev => [...prev, ...(data.chats || [])]);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to load more chats:', err);
    }
  }, [chats.length, hasMore]);

  const loadChat = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const res = await apiGet(`/chats/${id}`);
      if (!res.ok) return null;
      const chat = await res.json();
      setActiveChatId(id);
      return chat;
    } catch (err) {
      console.error('Failed to load chat:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const deleteChat = useCallback(async (id) => {
    try {
      const res = await apiDelete(`/chats/${id}`);
      if (!res.ok) return;
      setChats(prev => prev.filter(c => c.id !== id));
      setTotal(prev => prev - 1);
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  }, [activeChatId]);

  const refreshChats = useCallback(async () => {
    await loadChats();
  }, [loadChats]);

  return {
    chats,
    activeChatId,
    setActiveChatId,
    isLoading,
    hasMore,
    total,
    loadChats,
    loadMoreChats,
    loadChat,
    startNewChat,
    deleteChat,
    refreshChats,
  };
}
