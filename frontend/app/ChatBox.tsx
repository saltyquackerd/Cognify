'use client';

import { useState, useEffect, useRef } from 'react';
import InputField from './InputField';
import { useStore } from './store/useStore';
import SidePopup from './SidePopup';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  conversationId: string;
}

interface ChatBoxProps {
  sidePopupWidth?: number;
}

export default function ChatBox({ sidePopupWidth = 384 }: ChatBoxProps) {
  const { 
    selectedConversation, 
    selectedConversationId, 
    addMessage, 
    getMessagesForConversation,
    // loadMessagesForConversation, // now triggered from store.selectConversation
    messagesByConversation,
    updateConversationLastMessage
  } = useStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Update current messages when conversation changes
  useEffect(() => {
    if (selectedConversationId) {
      // Focus the input field when a conversation is selected
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100); // Small delay to ensure the component is rendered
    } else {
      setCurrentMessages([]);
    }
  }, [selectedConversationId]);

  // Update current messages when messagesByConversation changes
  useEffect(() => {
    if (selectedConversationId) {
      const conversationMessages = messagesByConversation[selectedConversationId] || [];
      setCurrentMessages(conversationMessages);
    }
  }, [selectedConversationId, messagesByConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isLoading]);
  const [sidePopupOpen, setSidePopupOpen] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [currentSidePopupWidth, setCurrentSidePopupWidth] = useState(384);
  
  console.log('ChatBox render - sidePopupOpen:', sidePopupOpen);

  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
      conversationId: selectedConversationId,
    };

    addMessage(userMessage);
    updateConversationLastMessage(selectedConversationId, content);
    setIsLoading(true);

    try {
      // Send message to backend
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          session_id: selectedConversationId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Create assistant message from backend response
      const assistantMessage: Message = {
        id: data.chatbot_message_id || (Date.now() + 1).toString(),
        content: data.chat_response,
        role: 'assistant',
        timestamp: new Date(),
        conversationId: selectedConversationId,
      };
      
      addMessage(assistantMessage);
      updateConversationLastMessage(selectedConversationId, assistantMessage.content);
      
      // Update conversation title if it was generated
      if (data.title && data.title !== 'New conversation') {
        useStore.getState().updateConversation(selectedConversationId, { title: data.title });
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback to simulated response if backend fails
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
        role: 'assistant',
        timestamp: new Date(),
        conversationId: selectedConversationId,
      };
      addMessage(assistantMessage);
      updateConversationLastMessage(selectedConversationId, assistantMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSidePopup = (message: string) => {
    console.log('Opening side popup with message:', message);
    setPopupMessage(message);
    setSidePopupOpen(true);
  };

  const handleCloseSidePopup = () => {
    setSidePopupOpen(false);
    setPopupMessage('');
  };

  return (
    <div className={`flex-1 flex bg-gray-50 ${sidePopupOpen ? 'flex' : 'flex'}`}>
      {/* Main Chat Area - Compressed */}
      <div className={`flex flex-col min-w-0 ${sidePopupOpen ? 'flex-1' : 'flex-1'}`}>
        {/* Header */}
        <header className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className={`px-4 py-4 ${sidePopupOpen ? 'max-w-2xl ml-16' : 'w-full px-16'}`} style={sidePopupOpen ? { maxWidth: `${Math.max(400, window.innerWidth - currentSidePopupWidth - 100)}px` } : {}}>
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl text-gray-900">
                  {selectedConversation ? selectedConversation.title : 'Cognify'}
                </h1>
              {selectedConversation && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedConversation.lastMessage}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">
                Conversation ID
              </div>
              <div className="text-sm font-mono text-gray-700">
                {selectedConversationId || 'None'}
              </div>
            </div>
          </div>
          </div>
        </header>

        {/* Chat Content */}
        <main className="flex-1 overflow-hidden">
            <div className={`h-full flex flex-col ${sidePopupOpen ? 'max-w-2xl ml-16' : 'w-full px-16'}`} style={sidePopupOpen ? { maxWidth: `${Math.max(400, window.innerWidth - currentSidePopupWidth - 100)}px` } : {}}>
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="max-w-md">
                  <h2 className="text-4xl text-gray-900 mb-4">
                    {selectedConversation ? `Welcome to ${selectedConversation.title}` : 'Welcome to Cognify'}
                  </h2>
                  <p className="text-gray-600 mb-8">
                    {selectedConversation ? 'Start chatting in this conversation.' : 'Select a conversation from the sidebar to start learning.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {currentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    } group`}
                  >
                    <div className={`flex max-w-[70%] ${
                      message.role === 'assistant' ? 'flex-col items-start' : 'items-start space-x-2'
                    }`}>
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                      
                      {/* Side Popup Trigger Button - Only for assistant messages */}
                      {message.role === 'assistant' && (
                        <button
                          onClick={() => handleOpenSidePopup(message.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 self-end mt-1"
                          title="Continue this conversation in side panel"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Field at Bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-transparent">
            <InputField
              ref={inputRef}
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Message Cognify..."
              sidePopupOpen={sidePopupOpen}
            />
            </div>
        </div>
      </main>
      </div>

      {/* Side Popup - Only render when open */}
      {sidePopupOpen && (
        <SidePopup
          isOpen={true}
          onClose={handleCloseSidePopup}
          initialMessage={popupMessage}
          title="Continue Chat"
          onWidthChange={setCurrentSidePopupWidth}
        />
      )}
    </div>
  );
}