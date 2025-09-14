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
  
  // Messages
  messages: Message[];
  
  // Actions
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  selectConversation: (id: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  loadConversations: (userId: string) => Promise<void>;
  
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
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
  messages: [],

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
      
      return {
        conversations: remaining,
        selectedConversationId: newSelectedId,
        messages: state.messages.filter(msg => msg.conversationId !== id)
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
  },

  setConversations: (conversations) => {
    set({ conversations });
  },

  loadConversations: async (userId) => {
    try {
      const response = await fetch('http://localhost:5000/api/conversations');
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const conversations = await response.json();
      
      // Transform the API response to match our Conversation interface
      const transformedConversations = conversations.map((conv: any) => ({
        id: conv.id.toString(),
        title: conv.title || 'Untitled Conversation',
        lastMessage: conv.last_message || '',
        timestamp: new Date(conv.created_at || conv.timestamp),
        isActive: false
      }));
      
      set({ conversations: transformedConversations });
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Keep the existing conversations if API fails
    }
  },

  // Message actions
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message]
    }));
  },

  setMessages: (messages) => {
    set({ messages });
  },

  getMessagesForConversation: (conversationId) => {
    return get().messages.filter(msg => msg.conversationId === conversationId);
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
