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
  conversations: [
    {
      id: '1',
      title: 'Welcome to Cognify',
      lastMessage: 'Hello! How can I help you today?',
      timestamp: new Date('2024-01-15T10:30:00'),
      isActive: true
    },
    {
      id: '2',
      title: 'JavaScript help',
      lastMessage: 'What are the best practices for error handling?',
      timestamp: new Date('2024-01-14T15:45:00')
    },
    {
      id: '3',
      title: 'CSS questions',
      lastMessage: 'When should I use CSS Grid over Flexbox?',
      timestamp: new Date('2024-01-13T09:20:00')
    },
    {
      id: '4',
      title: 'TypeScript generics',
      lastMessage: 'How do I create a generic function that works with arrays?',
      timestamp: new Date('2024-01-12T14:10:00')
    },
    {
      id: '5',
      title: 'Next.js optimization',
      lastMessage: 'What are the best ways to optimize a Next.js app?',
      timestamp: new Date('2024-01-11T16:30:00')
    }
  ],
  selectedConversationId: '1',
  messages: [
    {
      id: 'msg1',
      content: 'Hello! How can I help you today?',
      role: 'assistant',
      timestamp: new Date('2024-01-15T10:30:00'),
      conversationId: '1'
    },
    {
      id: 'msg2',
      content: 'What are the best practices for error handling?',
      role: 'user',
      timestamp: new Date('2024-01-14T15:45:00'),
      conversationId: '2'
    },
    {
      id: 'msg3',
      content: 'Great question! Here are some key best practices for error handling in JavaScript...',
      role: 'assistant',
      timestamp: new Date('2024-01-14T15:46:00'),
      conversationId: '2'
    }
  ],

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
