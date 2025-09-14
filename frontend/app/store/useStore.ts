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
}

interface StoreState {
  // Conversations
  conversations: Conversation[];
  selectedConversationId: string | null;
  
  // Messages organized by conversation ID
  messagesByConversation: Record<string, Message[]>;
  
  // Actions
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  loadConversations: (userId: string) => Promise<void>;
  loadMessagesForConversation: (conversationId: string) => Promise<void>;
  createNewConversation: (userId: string) => Promise<Conversation>;
  
  addMessage: (message: Message) => void;
  setMessagesForConversation: (conversationId: string, messages: Message[]) => void;
  getMessagesForConversation: (conversationId: string) => Message[];
  updateConversationLastMessage: (conversationId: string, lastMessage: string) => void;
  
  // Computed values
  selectedConversation: Conversation | null;
  getConversationById: (id: string) => Conversation | null;
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  conversations: [],
  selectedConversationId: null,
  messagesByConversation: {},

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
      const transformedConversations = conversations.map((conv: any) => ({
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
      const transformedMessages = messages.map((msg: any) => ({
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

  // Computed values
  get selectedConversation() {
    const { conversations, selectedConversationId } = get();
    return conversations.find(conv => conv.id === selectedConversationId) || null;
  },

  getConversationById: (id) => {
    return get().conversations.find(conv => conv.id === id) || null;
  }
}));
