/**
 * useSearch Hook
 *
 * Custom hook for unified search with debouncing and selection management.
 * Includes hybrid search: fast substring search + intelligent LLM-based search.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Hook for unified search across all sources
 */
export function useSearch() {
  const [query, setQueryInternal] = useState('');
  const [results, setResults] = useState({
    chats: [],
    knowledge: [],
    confluence: [],
    gdrive: [],
    contracts: [],
  });
  const [loading, setLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartReasoning, setSmartReasoning] = useState(null);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [sources, setSources] = useState(null);
  const debounceRef = useRef(null);
  const smartSearchRef = useRef(null);

  // Load available sources on mount
  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/search/sources`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      }
    } catch (err) {
      console.error('Error loading search sources:', err);
    }
  }, []);

  // Execute fast search
  const search = useCallback(async (searchQuery, connectedSourceIds) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults({ chats: [], knowledge: [], confluence: [], gdrive: [], contracts: [] });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let url = `${API_URL}/search?q=${encodeURIComponent(searchQuery)}`;

      if (connectedSourceIds && connectedSourceIds.length > 0) {
        url += `&sources=${connectedSourceIds.join(',')}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || { chats: [], knowledge: [], confluence: [], gdrive: [], contracts: [] });

      if (data.errors && data.errors.length > 0) {
        console.warn('Some search sources had errors:', data.errors);
      }
    } catch (err) {
      setError(err.message);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute smart/intelligent search (LLM-based) for Knowledge Base
  const smartSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      return;
    }

    setSmartReasoning(null);

    try {
      const response = await fetch(
        `${API_URL}/search/smart?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.warn('Smart search failed');
        return;
      }

      const data = await response.json();
      const smartResults = data.results || [];
      const reasoning = data.reasoning || null;

      setSmartReasoning(reasoning);

      // Merge smart results into knowledge results (avoid duplicates)
      if (smartResults.length > 0) {
        setResults(prev => {
          const existingIds = new Set(prev.knowledge.map(r => r.id));
          const newResults = smartResults.filter(r => !existingIds.has(r.id));

          // Mark smart results
          const markedResults = newResults.map(r => ({
            ...r,
            metadata: { ...r.metadata, fromSmartSearch: true },
          }));

          return {
            ...prev,
            knowledge: [...prev.knowledge, ...markedResults],
          };
        });
      }
    } catch (err) {
      console.error('Smart search error:', err);
    }
  }, []);

  // Execute smart chat search (LLM-based re-ranking)
  const smartChatSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/search/chats/smart?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.warn('Smart chat search failed');
        return;
      }

      const data = await response.json();
      const smartResults = data.results || [];

      if (data.isSmartRanked && smartResults.length > 0) {
        setResults(prev => ({
          ...prev,
          chats: smartResults.map(r => ({
            ...r,
            type: 'chat', // Ensure type is set for chat results
            metadata: {
              ...r.metadata,
              fromSmartSearch: r.isSmartResult,
              matchedIn: r.matchedIn,
              updatedAt: r.updatedAt,
            },
          })),
        }));
      }
    } catch (err) {
      console.error('Smart chat search error:', err);
    }
  }, []);

  // Execute smart contract search (LLM-based)
  const smartContractSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/search/contracts/smart?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.warn('Smart contract search failed');
        return;
      }

      const data = await response.json();
      const smartResults = data.results || [];

      if (smartResults.length > 0) {
        setResults(prev => {
          const existingIds = new Set(prev.contracts.map(r => r.id));
          const newResults = smartResults.filter(r => !existingIds.has(r.id));

          const markedResults = newResults.map(r => ({
            ...r,
            metadata: { ...r.metadata, fromSmartSearch: true },
          }));

          return {
            ...prev,
            contracts: [...prev.contracts, ...markedResults],
          };
        });
      }
    } catch (err) {
      console.error('Smart contract search error:', err);
    }
  }, []);

  // Debounced search - runs fast search immediately, then smart searches
  const debouncedSearch = useCallback((value) => {
    setQueryInternal(value);

    // Clear existing timeouts
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (smartSearchRef.current) {
      clearTimeout(smartSearchRef.current);
    }

    if (!value || value.length < 2) {
      setResults({ chats: [], knowledge: [], confluence: [], gdrive: [], contracts: [] });
      setSmartLoading(false);
      setSmartReasoning(null);
      return;
    }

    // Fast search with short debounce
    debounceRef.current = setTimeout(() => {
      const connectedSourceIds = (sources || [])
        .filter(s => s.connected)
        .map(s => s.id);

      search(value, connectedSourceIds);

      // Smart searches start slightly later (after fast search begins)
      // This gives the user immediate feedback while smart search runs in background
      smartSearchRef.current = setTimeout(() => {
        setSmartLoading(true);

        // Run all smart searches in parallel
        Promise.all([
          smartSearch(value),           // KB smart search
          smartChatSearch(value),       // Chat smart search
          smartContractSearch(value),   // Contract smart search
        ]).finally(() => {
          setSmartLoading(false);
        });
      }, 100);
    }, 300);
  }, [search, smartSearch, smartChatSearch, smartContractSearch, sources]);

  // Set query (with debounce)
  const setQuery = useCallback((value) => {
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Toggle item selection
  const toggleSelection = useCallback((item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id && i.type === item.type);
      if (exists) {
        return prev.filter(i => !(i.id === item.id && i.type === item.type));
      }
      return [...prev, item];
    });
  }, []);

  // Check if item is selected
  const isSelected = useCallback((item) => {
    return selectedItems.some(i => i.id === item.id && i.type === item.type);
  }, [selectedItems]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  // Remove single selection
  const removeSelection = useCallback((item) => {
    setSelectedItems(prev =>
      prev.filter(i => !(i.id === item.id && i.type === item.type))
    );
  }, []);

  // Get total result count (only from connected sources)
  const getTotalCount = useCallback(() => {
    if (!sources) return 0;

    const connectedSourceIds = sources
      .filter(s => s.connected)
      .map(s => s.id);

    return connectedSourceIds.reduce((total, sourceId) => {
      return total + (results[sourceId]?.length || 0);
    }, 0);
  }, [results, sources]);

  return {
    query,
    setQuery,
    results,
    loading,
    smartLoading,
    smartReasoning,
    error,
    sources,
    selectedItems,
    toggleSelection,
    isSelected,
    clearSelection,
    removeSelection,
    getTotalCount,
    refresh: () => {
      const connectedSourceIds = (sources || [])
        .filter(s => s.connected)
        .map(s => s.id);
      search(query, connectedSourceIds);

      // Run smart searches
      setSmartLoading(true);
      Promise.all([
        smartSearch(query),
        smartChatSearch(query),
        smartContractSearch(query),
      ]).finally(() => {
        setSmartLoading(false);
      });
    },
  };
}

export default useSearch;
