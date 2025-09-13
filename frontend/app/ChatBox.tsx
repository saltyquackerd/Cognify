'use client';

import { useState, useEffect } from 'react';
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

export default function ChatBox() {
  const { 
    selectedConversation, 
    selectedConversationId, 
    messages, 
    addMessage, 
    getMessagesForConversation,
    updateConversationLastMessage
  } = useStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);

  // Update current messages when conversation changes
  useEffect(() => {
    if (selectedConversationId) {
      const conversationMessages = getMessagesForConversation(selectedConversationId);
      setCurrentMessages(conversationMessages);
    } else {
      setCurrentMessages([]);
    }
  }, [selectedConversationId, messages, getMessagesForConversation]);
  const [sidePopupOpen, setSidePopupOpen] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

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

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm a multiline output, similar to chatgpt. this is used to test the popup aksdfhaksjdhfaksjdfh hihihiadjfasldjfhaksjdhfaldf asdjhflajksdhfalkjdshfalksdfj haskdjhalksdjfhalkjsdfhalksjdfha sdlafkjsdhlakjdhfalksjd hfalkjdsh falkjdfhalksjdh falksdj fhalsd kjfashld f.",
        role: 'assistant',
        timestamp: new Date(),
        conversationId: selectedConversationId,
      };
      addMessage(assistantMessage);
      updateConversationLastMessage(selectedConversationId, assistantMessage.content);
      setIsLoading(false);
    }, 1000);
  };

  const handleOpenSidePopup = (message: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({ 
      x: rect.right + 8, 
      y: rect.top 
    });
    setPopupMessage(message);
    setSidePopupOpen(true);
  };

  const handleCloseSidePopup = () => {
    setSidePopupOpen(false);
    setPopupMessage('');
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Chat Area */}
      <div className="h-full flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedConversation ? selectedConversation.title : 'Cognify'}
                </h1>
              {selectedConversation && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedConversation.lastMessage}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Conversation ID
              </div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                {selectedConversationId || 'None'}
              </div>
            </div>
          </div>
          </div>
        </header>

        {/* Chat Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full max-w-4xl mx-auto flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="max-w-md">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                    {selectedConversation ? `Welcome to ${selectedConversation.title}` : 'Welcome to Cognify'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {selectedConversation ? 'Start chatting in this conversation.' : 'Select a conversation from the sidebar to start chatting.'}
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
                    <div className="flex items-start space-x-2 max-w-[70%]">
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                      
                      {/* Side Popup Trigger Button - Only for assistant messages */}
                      {message.role === 'assistant' && (
                        <button
                          onClick={(e) => handleOpenSidePopup(message.content, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
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
          </div>

          {/* Input Field at Bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <InputField
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Message Cognify..."
            />
            </div>
          </div>
        </main>
      </div>

      {/* Side Popup */}
      {sidePopupOpen && (
        <SidePopup
          isOpen={sidePopupOpen}
          onClose={handleCloseSidePopup}
          initialMessage={popupMessage}
          title="Continue Chat"
          position={popupPosition}
        />
      )}
    </div>
  );
}