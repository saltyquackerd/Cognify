import { create } from 'zustand';

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  isActive?: boolean;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
  // Optional: thread conversation created from this message
  threadConversationId?: string;
}

interface StoreState {
  // Conversations
  conversations: Conversation[];
  selectedConversationId: string | null;
  
  // Messages organized by conversation ID
  messagesByConversation: Record<string, Message[]>;
  // Map parent message id -> thread conversation id
  messageThreadMap: Record<string, string>;
  
  // Actions
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  loadConversations: (userId: string) => Promise<void>;
  loadMessagesForConversation: (conversationId: string) => Promise<void>;
  createNewConversation: (userId: string) => Promise<Conversation>;
  linkMessageToThread: (messageId: string, threadConversationId: string) => void;
  getThreadForMessage: (messageId: string) => string | null;
  openOrCreateThreadForMessage: (message: Message, userId: string, selectThread?: boolean) => Promise<Conversation>;
  createThreadForMessage: (message: Message, userId: string) => Promise<Conversation>;
  
  addMessage: (message: Message) => void;
  updateMessageContent: (messageId: string, content: string) => void;
  updateMessageId: (oldMessageId: string, newMessageId: string) => void;
  setMessagesForConversation: (conversationId: string, messages: Message[]) => void;
  getMessagesForConversation: (conversationId: string) => Message[];
  updateConversationLastMessage: (conversationId: string, lastMessage: string) => void;
  
  // Helper functions
  findEmptyConversation: () => Conversation | null;
  createOrSelectEmptyConversation: (userId: string) => Promise<Conversation>;
  
  // Computed values
  selectedConversation: Conversation | null;
  getConversationById: (id: string) => Conversation | null;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  conversations: [],
  selectedConversationId: null,
  messagesByConversation: {},
  messageThreadMap: {},

  // Conversation actions
  addConversation: (conversation) => {
    set((state) => ({
      conversations: [conversation, ...state.conversations.map(conv => ({ ...conv, isActive: false }))],
      selectedConversationId: conversation.id
    }));
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === id ? { ...conv, ...updates } : conv
      )
    }));
  },

  deleteConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter(conv => conv.id !== id);
      const newSelectedId = state.selectedConversationId === id 
        ? (remaining.length > 0 ? remaining[0].id : null)
        : state.selectedConversationId;
      
      // Remove messages for this conversation
      const { [id]: deletedMessages, ...remainingMessages } = state.messagesByConversation;
      
      return {
        conversations: remaining,
        selectedConversationId: newSelectedId,
        messagesByConversation: remainingMessages
      };
    });
  },

  selectConversation: (id) => {
    set((state) => ({
      selectedConversationId: id,
      conversations: state.conversations.map(conv => ({
        ...conv,
        isActive: conv.id === id
      }))
    }));
    
    // Always load messages for the selected conversation
    get().loadMessagesForConversation(id);
  },

  setConversations: (conversations) => {
    set({ conversations });
  },

  loadConversations: async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}/conversations`);
      console.log(response);
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const conversations = await response.json();
      
      // Transform the API response to match our Conversation interface
      const transformedConversations = conversations.map((conv: {
        id: string | number;
        title?: string;
        lastMessage?: string;
        timestamp: string | Date;
      }) => ({
        id: conv.id.toString(),
        title: conv.title || 'Untitled Conversation',
        lastMessage: conv.lastMessage || '',
        timestamp: new Date(conv.timestamp),
        isActive: false
      }));
      
      set({ conversations: transformedConversations });
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Keep the existing conversations if API fails
    }
  },

  loadMessagesForConversation: async (conversationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/conversations/${conversationId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      const messages = await response.json();
      
      // Transform the API response to match our Message interface
      const transformedMessages = messages.map((msg: {
        id: string | number;
        content?: string;
        role?: 'user' | 'assistant';
        timestamp: string | Date;
        conversationId: string;
      }) => ({
        id: msg.id.toString(),
        content: msg.content || '',
        role: msg.role || 'user',
        timestamp: new Date(msg.timestamp),
        conversationId: msg.conversationId
      }));
      
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: transformedMessages
        }
      }));
    } catch (error) {
      console.error('Error loading messages for conversation:', conversationId, error);
      // Keep existing messages if API fails
    }
  },

  createNewConversation: async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create new conversation');
      }
      
      const sessionData = await response.json();
      
      // Transform the API response to match our Conversation interface
      const newConversation: Conversation = {
        id: sessionData.session_id,
        title: 'New conversation',
        lastMessage: 'Start a new conversation...',
        timestamp: new Date(sessionData.created_at),
        isActive: true
      };
      
      // Add the new conversation to the store
      set((state) => ({
        conversations: [newConversation, ...state.conversations.map(conv => ({ ...conv, isActive: false }))],
        selectedConversationId: newConversation.id
      }));
      
      return newConversation;
    } catch (error) {
      console.error('Error creating new conversation:', error);
      throw error;
    }
  },

  linkMessageToThread: (messageId, threadConversationId) => {
    set((state) => ({
      messageThreadMap: {
        ...state.messageThreadMap,
        [messageId]: threadConversationId
      }
    }));
  },

  getThreadForMessage: (messageId) => {
    const { messageThreadMap } = get();
    return messageThreadMap[messageId] || null;
  },

  openOrCreateThreadForMessage: async (message, userId, selectThread = false) => {
    const existingThreadId = get().getThreadForMessage(message.id);
    if (existingThreadId) {
      // Return existing thread conversation
      if (selectThread) {
        get().selectConversation(existingThreadId);
      }
      return get().getConversationById(existingThreadId)!;
    }

    // Create a new conversation/thread
    const newConv = await get().createNewConversation(userId);

    // Give it a thread-like title and initial last message
    const threadTitle = `Thread: ${message.content.slice(0, 30)}${message.content.length > 30 ? '…' : ''}`;
    get().updateConversation(newConv.id, { title: threadTitle });
    get().updateConversationLastMessage(newConv.id, message.content);

    // Seed the thread with the original assistant message
    const seededAssistantMessage: Message = {
      id: `${message.id}-seed`,
      content: message.content,
      role: 'assistant',
      timestamp: new Date(),
      conversationId: newConv.id,
    };
    get().setMessagesForConversation(newConv.id, [seededAssistantMessage]);

    // Link original message -> thread and also annotate original message
    set((state) => {
      const { [message.conversationId]: msgs = [] } = state.messagesByConversation;
      const updatedMsgs = msgs.map((m) => m.id === message.id ? { ...m, threadConversationId: newConv.id } : m);
      return {
        messageThreadMap: { ...state.messageThreadMap, [message.id]: newConv.id },
        messagesByConversation: {
          ...state.messagesByConversation,
          [message.conversationId]: updatedMsgs
        }
      };
    });

    // Only select the thread if explicitly requested
    if (selectThread) {
      get().selectConversation(newConv.id);
    }
    return newConv;
  },

  createThreadForMessage: async (message, userId) => {
    // Create quiz thread using the dedicated endpoint
    try {
      const response = await fetch(`http://localhost:5000/api/create-quiz-thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_id: message.id,
          session_id: message.conversationId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create quiz thread');
      }
      
      const quizData = await response.json();
      
      // Create thread conversation (not added to main conversations)
      const threadConversation: Conversation = {
        id: quizData.quiz_id,
        title: `Quiz Thread: ${message.content.slice(0, 30)}${message.content.length > 30 ? '…' : ''}`,
        lastMessage: message.content,
        timestamp: new Date(),
        isActive: false
      };
      
      // Seed the thread with the original assistant message and quiz questions
      const seededAssistantMessage: Message = {
        id: `${message.id}-seed`,
        content: message.content,
        role: 'assistant',
        timestamp: new Date(),
        conversationId: threadConversation.id,
      };
      
      // Add quiz questions as assistant messages
      const quizMessages: Message[] = quizData.quiz_questions.map((q: { question: string }, index: number) => ({
        id: `${quizData.quiz_id}-quiz-${index}`,
        content: `Q${index + 1}: ${q.question}`,
        role: 'assistant' as const,
        timestamp: new Date(),
        conversationId: threadConversation.id,
      }));
      
      // Store thread messages separately (not in main conversations)
      set((state) => ({
        messageThreadMap: {
          ...state.messageThreadMap,
          [message.id]: threadConversation.id
        },
        messagesByConversation: {
          ...state.messagesByConversation,
          [threadConversation.id]: [seededAssistantMessage, ...quizMessages]
        }
      }));
      
      return threadConversation;
    } catch (error) {
      console.error('Error creating quiz thread:', error);
      throw error;
    }
  },

  // Message actions
  addMessage: (message) => {
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [message.conversationId]: [
          ...(state.messagesByConversation[message.conversationId] || []),
          message
        ]
      }
    }));
  },

  updateMessageContent: (messageId, content) => {
    set((state) => ({
      messagesByConversation: Object.fromEntries(
        Object.entries(state.messagesByConversation).map(([convId, messages]) => [
          convId,
          messages.map(msg => 
            msg.id === messageId 
              ? { ...msg, content }
              : msg
          )
        ])
      )
    }));
  },

  updateMessageId: (oldMessageId, newMessageId) => {
    set((state) => ({
      messagesByConversation: Object.fromEntries(
        Object.entries(state.messagesByConversation).map(([convId, messages]) => [
          convId,
          messages.map(msg => 
            msg.id === oldMessageId 
              ? { ...msg, id: newMessageId }
              : msg
          )
        ])
      )
    }));
  },

  setMessagesForConversation: (conversationId, messages) => {
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages
      }
    }));
  },

  getMessagesForConversation: (conversationId) => {
    return get().messagesByConversation[conversationId] || [];
  },

  updateConversationLastMessage: (conversationId, lastMessage) => {
    set((state) => ({
      conversations: state.conversations.map(conv =>
        conv.id === conversationId 
          ? { ...conv, lastMessage, timestamp: new Date() }
          : conv
      )
    }));
  },

  // Helper functions
  findEmptyConversation: () => {
    console.log('findEmptyConversation called');
    const { conversations, messagesByConversation } = get();
    console.log('Total conversations:', conversations.length);
    console.log('MessagesByConversation keys:', Object.keys(messagesByConversation));
    
    const emptyConv = conversations.find(conv => {
      // Check if this conversation has been initialized in messagesByConversation
      const hasMessagesEntry = conv.id in messagesByConversation;
      const messages = messagesByConversation[conv.id] || [];
      // A conversation is empty if it either has no messages entry OR has 0 messages
      const isEmpty = !hasMessagesEntry || messages.length === 0;
      console.log(`Checking conversation ${conv.id} (${conv.title}): hasEntry: ${hasMessagesEntry}, ${messages.length} messages, isEmpty: ${isEmpty}`);
      return isEmpty;
    }) || null;
    console.log('Found empty conversation:', emptyConv);
    return emptyConv;
  },

  createOrSelectEmptyConversation: async (userId) => {
    console.log('createOrSelectEmptyConversation called for user:', userId);
    // Always create a new conversation when starting fresh
    // This prevents reusing old conversations that might have messages
    console.log('Creating new conversation for fresh start');
    return await get().createNewConversation(userId);
  },

  // Computed values
  get selectedConversation() {
    const { conversations, selectedConversationId } = get();
    console.log('selectedConversation computed - selectedConversationId:', selectedConversationId);
    console.log('selectedConversation computed - conversations:', conversations);
    const found = conversations.find(conv => conv.id === selectedConversationId);
    console.log('selectedConversation computed - found:', found);
    return found || null;
  },

  getConversationById: (id) => {
    return get().conversations.find(conv => conv.id === id) || null;
  }
}));
