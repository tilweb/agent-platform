import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStreaming } from '../hooks/useStreaming';
import { useChatHistory } from '../hooks/useChatHistory';
import { useChatFolders } from '../hooks/useChatFolders';
import { useAgentContext } from '../context/AgentContext';
import ChatWindow from '../components/ChatWindow';
import ChatSidebar from '../components/ChatSidebar';
import { theme } from '../config/theme';
import { apiPost, apiDelete } from '../utils/apiFetch';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const pageStyles = {
  container: {
    height: `calc(100vh - ${theme.layout.headerHeight} - ${theme.spacing.xl} - ${theme.spacing.xl})`,
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: theme.layout.maxContentWidth,
    margin: '0 auto',
    width: '100%',
    minWidth: 0,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    border: `1px solid ${theme.colors.error}20`,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
  },
};

function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    messages,
    isStreaming,
    agentStatus,
    activeAgentId,
    error,
    sendMessage,
    clearMessages,
    loadExistingChat,
    sessionIdRef,
    activeTasks,
    onTaskCompleted,
    fileProcessingState,
  } = useStreaming();

  const {
    chats,
    activeChatId,
    setActiveChatId,
    hasMore,
    total,
    loadChats,
    loadMoreChats,
    loadChat,
    startNewChat,
    deleteChat,
    refreshChats,
  } = useChatHistory();

  const {
    agents,
    selectedAgentId,
    isAutoRoute,
    selectAgent,
    selectAutoRoute,
  } = useAgentContext();

  const {
    folders,
    createFolder,
    deleteFolder,
    getChatsInFolder,
    getChatFolderIds,
    updateChatFolders,
  } = useChatFolders();

  const [activeFolder, setActiveFolder] = useState(null);
  const [folderChats, setFolderChats] = useState([]);
  const [chatFolderIds, setChatFolderIds] = useState([]);

  const wasStreamingRef = useRef(false);
  const initialSessionLoadedRef = useRef(false);
  const processedAttachmentIdsRef = useRef(new Set()); // Track already processed attachments
  const [loadedReaders, setLoadedReaders] = useState([]);
  const [preparedSessionId, setPreparedSessionId] = useState(null);
  const [isPreparingReaders, setIsPreparingReaders] = useState(false);

  // Model selection state (from /model command)
  const [selectedModel, setSelectedModel] = useState(null);

  // Materials state
  const [materials, setMaterials] = useState([]);
  // { providerId, modelId, modelName }

  // Table selection state (from /table command)
  const [selectedTable, setSelectedTable] = useState(null);
  // { tableId, tableName, table }

  // Load chat list on mount
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Load chats when folder is selected
  useEffect(() => {
    if (activeFolder) {
      getChatsInFolder(activeFolder).then(setFolderChats);
    } else {
      setFolderChats([]);
    }
  }, [activeFolder, getChatsInFolder]);

  // Load folder IDs when active chat changes
  useEffect(() => {
    if (activeChatId) {
      getChatFolderIds(activeChatId).then(setChatFolderIds);
    } else {
      setChatFolderIds([]);
    }
  }, [activeChatId, getChatFolderIds]);

  // Handle session parameter from URL (e.g., from search results)
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId && !initialSessionLoadedRef.current && !isStreaming) {
      initialSessionLoadedRef.current = true;
      // Load the chat from the session parameter
      loadChat(sessionId).then(chat => {
        if (chat && chat.messages) {
          loadExistingChat(chat.messages, chat.id);
          setMaterials(chat.materials || []); // Load materials from chat
          // Reset processed attachments and mark existing material attachments as processed
          processedAttachmentIdsRef.current = new Set();
          (chat.materials || []).forEach(m => {
            if (m.metadata?.attachmentId) {
              processedAttachmentIdsRef.current.add(m.metadata.attachmentId);
            }
          });
        }
      });
      // Clear the URL parameter after loading
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, loadChat, loadExistingChat, isStreaming]);

  // Handle readers parameter from URL (from search page "Chat starten")
  // This now calls the prepare-readers endpoint to pre-process documents
  useEffect(() => {
    const readersParam = searchParams.get('readers');
    if (readersParam && !isStreaming && !isPreparingReaders) {
      try {
        const readers = JSON.parse(readersParam);
        if (Array.isArray(readers) && readers.length > 0) {
          // Clear URL parameter first
          setSearchParams({}, { replace: true });

          // Start preparing readers
          setIsPreparingReaders(true);

          console.log(`[ChatPage] Preparing ${readers.length} reader(s) via API`);

          // Call prepare-readers endpoint
          fetch(`${API_URL}/chat/prepare-readers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ readers }),
          })
            .then(response => response.json())
            .then(data => {
              if (data.prepared && data.sessionId) {
                console.log(`[ChatPage] Prepared ${data.successCount}/${data.totalCount} documents, session: ${data.sessionId}`);
                setPreparedSessionId(data.sessionId);
                setLoadedReaders(readers);

                // Check for errors
                const failedDocs = data.documents?.filter(d => !d.success) || [];
                if (failedDocs.length > 0) {
                  console.warn('[ChatPage] Some documents failed to load:', failedDocs);
                }
              } else {
                console.error('[ChatPage] Failed to prepare readers:', data.error);
                // Fallback: still set readers, will be processed on first message
                setLoadedReaders(readers);
              }
            })
            .catch(error => {
              console.error('[ChatPage] Error preparing readers:', error);
              // Fallback: still set readers, will be processed on first message
              setLoadedReaders(readers);
            })
            .finally(() => {
              setIsPreparingReaders(false);
            });
        }
      } catch (e) {
        console.error('Failed to parse readers parameter:', e);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, isStreaming, isPreparingReaders]);

  // Detect stream completion: isStreaming went from true -> false
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      // Stream just finished — refresh chat list and mark active
      loadChats();
      const sid = sessionIdRef.current;
      if (sid) setActiveChatId(sid);
    }
    wasStreamingRef.current = isStreaming;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Auto-detect attachments and add them as materials
  useEffect(() => {
    // Go through all messages and find attachments that haven't been processed yet
    messages.forEach((msg, msgIndex) => {
      if (!msg.attachments || msg.attachments.length === 0) return;

      msg.attachments.forEach((attachment) => {
        // Skip if already processed
        if (processedAttachmentIdsRef.current.has(attachment.id)) return;

        // Mark as processed
        processedAttachmentIdsRef.current.add(attachment.id);

        // Determine material type based on attachment type
        let materialType = 'upload';
        if (attachment.type === 'audio' && attachment.transcription) {
          // For audio with transcription, create two materials: one for audio, one for transcript
          // First: the audio file itself
          const audioMaterial = {
            id: `material_${attachment.id}_audio`,
            type: 'upload',
            title: attachment.filename || 'Audio-Datei',
            content: `Audio-Datei: ${attachment.filename}`,
            mimeType: attachment.mimeType,
            sourceMessageIndex: msgIndex,
            createdAt: Date.now(),
            metadata: {
              filename: attachment.filename,
              attachmentId: attachment.id,
            },
          };
          setMaterials(prev => {
            if (prev.some(m => m.id === audioMaterial.id)) return prev;
            return [...prev, audioMaterial];
          });

          // Second: the transcription
          const transcriptMaterial = {
            id: `material_${attachment.id}_transcript`,
            type: 'transcript',
            title: `Transkript: ${attachment.filename || 'Audio'}`,
            content: attachment.transcription,
            sourceMessageIndex: msgIndex,
            createdAt: Date.now(),
            metadata: {
              filename: attachment.filename,
              attachmentId: attachment.id,
            },
          };
          setMaterials(prev => {
            if (prev.some(m => m.id === transcriptMaterial.id)) return prev;
            return [...prev, transcriptMaterial];
          });
        } else {
          // Regular upload (document, image, audio without transcription)
          const material = {
            id: `material_${attachment.id}`,
            type: 'upload',
            title: attachment.filename || 'Datei',
            content: attachment.preview || `Datei: ${attachment.filename}`,
            mimeType: attachment.mimeType,
            sourceMessageIndex: msgIndex,
            createdAt: Date.now(),
            metadata: {
              filename: attachment.filename,
              attachmentId: attachment.id,
            },
          };
          setMaterials(prev => {
            if (prev.some(m => m.id === material.id)) return prev;
            return [...prev, material];
          });
        }
      });
    });
  }, [messages]);

  const handleSendMessage = useCallback((message, files, skillId) => {
    sendMessage(message, {
      agentId: selectedAgentId,
      autoRoute: isAutoRoute,
      files,
      skillId,
      readers: loadedReaders.length > 0 ? loadedReaders : undefined,
      preparedSessionId: preparedSessionId || undefined,
    });
    // Keep readers for follow-up questions - user can clear manually via X button
    // Clear preparedSessionId after first use (cache is tied to this session)
    if (preparedSessionId) {
      setPreparedSessionId(null);
    }
  }, [sendMessage, selectedAgentId, isAutoRoute, loadedReaders, preparedSessionId]);

  const handleSelectChat = useCallback(async (id) => {
    if (isStreaming) return;
    const chat = await loadChat(id);
    if (chat && chat.messages) {
      loadExistingChat(chat.messages, chat.id);
      setLoadedReaders([]); // Clear readers when switching chats
      setPreparedSessionId(null); // Clear prepared session
      setSelectedModel(null); // Clear model selection
      setSelectedTable(null); // Clear table selection
      setMaterials(chat.materials || []); // Load materials from chat
      // Reset processed attachments and mark existing material attachments as processed
      processedAttachmentIdsRef.current = new Set();
      (chat.materials || []).forEach(m => {
        if (m.metadata?.attachmentId) {
          processedAttachmentIdsRef.current.add(m.metadata.attachmentId);
        }
      });
    }
  }, [loadChat, loadExistingChat, isStreaming]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    clearMessages();
    startNewChat();
    setLoadedReaders([]); // Clear readers when starting new chat
    setPreparedSessionId(null); // Clear prepared session
    setSelectedModel(null); // Clear model selection
    setSelectedTable(null); // Clear table selection
    setMaterials([]); // Clear materials when starting new chat
    processedAttachmentIdsRef.current = new Set(); // Clear processed attachments
  }, [clearMessages, startNewChat, isStreaming]);

  // Handle model change from /model command
  const handleModelChanged = useCallback((payload) => {
    setSelectedModel({
      providerId: payload.providerId,
      modelId: payload.modelId,
      modelName: payload.modelName,
    });
  }, []);

  // Handle table selection from /table command
  const handleTableSelected = useCallback((payload) => {
    setSelectedTable({
      id: payload.tableId,
      name: payload.tableName,
      table: payload.table,
    });
  }, []);

  // Remove model selection (back to default)
  const handleRemoveModel = useCallback(() => {
    setSelectedModel(null);
  }, []);

  // Remove table selection
  const handleRemoveTable = useCallback(() => {
    setSelectedTable(null);
  }, []);

  const handleDeleteChat = useCallback(async (id) => {
    if (isStreaming) return;
    const wasActive = id === activeChatId;
    await deleteChat(id);
    if (wasActive) {
      clearMessages();
    }
  }, [deleteChat, activeChatId, clearMessages, isStreaming]);

  // Handle folder assignment changes
  const handleUpdateChatFolders = useCallback(async (folderIds) => {
    if (!activeChatId) return;
    await updateChatFolders(activeChatId, folderIds);
    setChatFolderIds(folderIds);
    // Refresh folder chats if we're viewing a folder
    if (activeFolder) {
      getChatsInFolder(activeFolder).then(setFolderChats);
    }
  }, [activeChatId, updateChatFolders, activeFolder, getChatsInFolder]);

  // Handle adding a material
  const handleAddMaterial = useCallback(async (material) => {
    if (!activeChatId) {
      // If no active chat yet, just add to local state
      // It will be persisted when the chat is saved
      setMaterials(prev => [...prev, material]);
      return;
    }

    // Save to backend
    try {
      const res = await apiPost(`/chats/${activeChatId}/materials`, material);
      if (res.ok) {
        setMaterials(prev => [...prev, material]);
      } else {
        console.error('Failed to add material');
      }
    } catch (err) {
      console.error('Error adding material:', err);
    }
  }, [activeChatId]);

  // Handle removing a material
  const handleRemoveMaterial = useCallback(async (materialId) => {
    if (!activeChatId) {
      // If no active chat, just remove from local state
      setMaterials(prev => prev.filter(m => m.id !== materialId));
      return;
    }

    // Remove from backend
    try {
      const res = await apiDelete(`/chats/${activeChatId}/materials/${materialId}`);
      if (res.ok) {
        setMaterials(prev => prev.filter(m => m.id !== materialId));
      } else {
        console.error('Failed to remove material');
      }
    } catch (err) {
      console.error('Error removing material:', err);
    }
  }, [activeChatId]);

  // Handle folder deletion
  const handleDeleteFolder = useCallback(async (folderId) => {
    await deleteFolder(folderId);
    // Clear active folder if it was the deleted one
    if (activeFolder === folderId) {
      setActiveFolder(null);
      setFolderChats([]);
    }
  }, [deleteFolder, activeFolder]);

  return (
    <div style={pageStyles.container}>
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        hasMore={hasMore}
        onLoadMore={loadMoreChats}
        total={total}
        // Folder props
        folders={folders}
        activeFolder={activeFolder}
        onSelectFolder={setActiveFolder}
        onCreateFolder={createFolder}
        onDeleteFolder={handleDeleteFolder}
        folderChats={folderChats}
      />
      <div style={pageStyles.chatArea}>
        {error && (
          <div style={pageStyles.error}>
            {error}
          </div>
        )}
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          agentStatus={agentStatus}
          activeAgentId={activeAgentId}
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={selectAgent}
          onSelectAuto={selectAutoRoute}
          onSendMessage={handleSendMessage}
          activeTasks={activeTasks}
          onTaskCompleted={onTaskCompleted}
          loadedReaders={loadedReaders}
          onClearReaders={() => setLoadedReaders([])}
          isPreparingReaders={isPreparingReaders}
          fileProcessingState={fileProcessingState}
          // Model selection props
          selectedModelId={selectedModel?.modelId}
          selectedModelName={selectedModel?.modelName}
          onModelChanged={handleModelChanged}
          onRemoveModel={handleRemoveModel}
          // Table selection props
          selectedTable={selectedTable}
          onTableSelected={handleTableSelected}
          onRemoveTable={handleRemoveTable}
          // Chat info for header
          chatId={activeChatId}
          chatTitle={chats.find(c => c.id === activeChatId)?.title}
          // Folder props
          folders={folders}
          chatFolderIds={chatFolderIds}
          onUpdateChatFolders={handleUpdateChatFolders}
          // Materials props
          materials={materials}
          onAddMaterial={handleAddMaterial}
          onRemoveMaterial={handleRemoveMaterial}
        />
      </div>
    </div>
  );
}

export default ChatPage;
