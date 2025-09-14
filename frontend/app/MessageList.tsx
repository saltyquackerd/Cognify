'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, Conversation } from './store/useStore';

export default function MessageList() {
  const router = useRouter();
  const { 
    conversations, 
    addConversation, 
    selectConversation, 
    deleteConversation,
    loadConversations,
    createOrSelectEmptyConversation
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load conversations from API on mount
  useEffect(() => {
    loadConversations('1');
  }, [loadConversations]);

  const filteredConversations = conversations.filter((conv: Conversation) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(conversationId);
  };

  const handleNewChat = async () => {
    try {
      console.log('MessageList - Creating or selecting empty conversation');
      await createOrSelectEmptyConversation('1'); // Using user ID '1' for now
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      // Fallback to local creation if backend fails
      const newConversation = {
        id: Date.now().toString(),
        title: 'New conversation',
        lastMessage: 'Start a new conversation...',
        timestamp: new Date(),
        isActive: true
      };
      addConversation(newConversation);
    }
  };

  const handleSelectConversation = (id: string) => {
    console.log('MessageList - Selecting conversation:', id);
    selectConversation(id);
    console.log('MessageList - After selectConversation, selectedConversationId:', useStore.getState().selectedConversationId);
  };

  const handleDeleteConfirm = (conversationId: string) => {
    deleteConversation(conversationId);
    setShowDeleteConfirm(null);
  };

  return (
    <div className={`flex flex-col h-full ${isCollapsed ? 'w-16' : 'w-80'} bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300`}>
      {/* Header with Logo/Brand */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isCollapsed && <span className="text-lg font-inter text-gray-900">Cognify</span>}
        </div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* New Chat Button */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium border border-gray-200 text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {/* Search */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 text-sm"
                />
              </div>
            </div>

            {/* Conversation Items */}
            <div className="px-2 py-2">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredConversations.map((conversation: Conversation) => (
                    <div
                      key={conversation.id}
                      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                        conversation.isActive
                          ? 'bg-blue-50 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectConversation(conversation.id)}
                    >
                      {/* Chat Icon */}
                      <div className="flex-shrink-0">
                        <svg className={`w-4 h-4 ${conversation.isActive ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>

                      {/* Conversation Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-medium truncate ${
                          conversation.isActive 
                            ? 'text-blue-900' 
                            : 'text-gray-900'
                        }`}>
                          {conversation.title}
                        </h3>
                        <p className={`text-xs truncate mt-0.5 ${
                          conversation.isActive 
                            ? 'text-blue-700' 
                            : 'text-gray-500'
                        }`}>
                          {conversation.lastMessage}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(conversation.timestamp)}
                        </span>
                        <button
                          onClick={(e) => handleDeleteClick(e, conversation.id)}
                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>User Account</span>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Delete conversation
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(showDeleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
