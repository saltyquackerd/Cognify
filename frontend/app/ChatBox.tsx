'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
    updateConversationLastMessage,
    createOrSelectEmptyConversation,
    conversations,
    getQuizForMessage,
    createQuizForMessage
  } = useStore();
  
  const activeConversation = useMemo(() => {
    return conversations.find(conv => conv.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Helper to check if current conversation is in strict mode
  const isStrictMode = activeConversation?.quizMode === 'strict';
  
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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [currentSidePopupWidth, setCurrentSidePopupWidth] = useState(384);
  const [isQuizBlocking, setIsQuizBlocking] = useState(false);
  const [quizResponseCount, setQuizResponseCount] = useState(0);
  const [conversationTags, setConversationTags] = useState<{[conversationId: string]: string[]}>({});
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  
  console.log('ChatBox render - sidePopupOpen:', sidePopupOpen);
  console.log('ChatBox render - selectedConversationId:', selectedConversationId);
  console.log('ChatBox render - selectedConversation:', selectedConversation);
  console.log('ChatBox render - activeConversation:', activeConversation);
  console.log('ChatBox render - currentMessages length:', currentMessages.length);
  console.log('ChatBox render - conversations array:', conversations);
  console.log('ChatBox render - conversations length:', conversations.length);
  console.log('ChatBox render - isQuizBlocking:', isQuizBlocking);
  console.log('ChatBox render - quizResponseCount:', quizResponseCount);

  const handleSendMessage = async (content: string) => {
    console.log('handleSendMessage called with content:', content);
    console.log('selectedConversationId:', selectedConversationId);
    let conversationId = selectedConversationId;
    
    // Create new conversation if none is selected
    if (!conversationId) {
      try {
        console.log('Creating or selecting empty conversation for user: 1');
        console.log('Current selectedConversationId:', selectedConversationId);
        console.log('Current conversations:', conversations);
        const newConv = await createOrSelectEmptyConversation('1');
        console.log('Successfully created conversation:', newConv);
        console.log('New selectedConversationId after creation:', useStore.getState().selectedConversationId);
        conversationId = newConv.id;
      } catch (error) {
        console.error('Failed to create conversation:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        // Create a fallback local conversation if API fails
        const fallbackConv = {
          id: `local-${Date.now()}`,
          title: 'New conversation',
          lastMessage: 'Start a new conversation...',
          timestamp: new Date(),
          isActive: true
        };
        console.log('Using fallback conversation:', fallbackConv);
        useStore.getState().addConversation(fallbackConv);
        conversationId = fallbackConv.id;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
      conversationId: conversationId,
    };

    addMessage(userMessage);
    updateConversationLastMessage(conversationId, content);
    setIsLoading(true);

    try {
      // Send message to backend with streaming
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          session_id: conversationId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response (Server-Sent Events)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let placeholderAssistantId = '';
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.status === 'started') {
                  // Create initial assistant message
                  placeholderAssistantId = data.user_message_id + '_assistant';
                  const assistantMessage: Message = {
                    id: placeholderAssistantId,
                    content: '',
                    role: 'assistant',
                    timestamp: new Date(),
                    conversationId: conversationId,
                  };
                  addMessage(assistantMessage);
                } else if (data.status === 'chunk') {
                  // Stream content to the assistant message
                  fullResponse += data.content;
                  useStore.getState().updateMessageContent(placeholderAssistantId, fullResponse);
                  updateConversationLastMessage(conversationId, fullResponse);
                } else if (data.status === 'completed') {
                  // Finalize the message
                  useStore.getState().updateMessageId(placeholderAssistantId, data.chatbot_message_id);
                  
                  // Update conversation title if it was generated
                  if (data.title && data.title !== 'New conversation') {
                    useStore.getState().updateConversation(conversationId, { title: data.title });
                  }
                  
                  // Check if this is strict mode and auto-open quiz
                  // Wait a bit to ensure conversation mode is updated
                  setTimeout(async () => {
                    const currentConv = useStore.getState().conversations.find(c => c.id === conversationId);
                    const isCurrentStrictMode = currentConv?.quizMode === 'strict';
                    
                    console.log('Auto-quiz check - conversationId:', conversationId);
                    console.log('Auto-quiz check - currentConv:', currentConv);
                    console.log('Auto-quiz check - isCurrentStrictMode:', isCurrentStrictMode);
                    
                    if (isCurrentStrictMode) {
                      console.log('Opening quiz automatically for strict mode');
                      const assistantMessage = {
                        id: data.chatbot_message_id,
                        content: fullResponse,
                        role: 'assistant' as const,
                        timestamp: new Date(),
                        conversationId: conversationId,
                      };
                      setIsQuizBlocking(true);
                      setQuizResponseCount(0); // Reset response count for new quiz
                      await handleOpenSidePopup(assistantMessage);
                    } else {
                      console.log('Not opening quiz - not in strict mode');
                    }
                  }, 100);
                } else if (data.status === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback to simulated response if backend fails
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
        role: 'assistant',
        timestamp: new Date(),
        conversationId: conversationId,
      };
      addMessage(assistantMessage);
      updateConversationLastMessage(conversationId, assistantMessage.content);
    } finally {
      setIsLoading(false);
      // Only refocus input field if not in strict mode or quiz is not blocking
      if (!isStrictMode || !isQuizBlocking) {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    }
  };

  const handleOpenSidePopup = async (message: Message) => {
    console.log('Opening side popup with message:', message);
    console.log('Current quiz status for message:', getQuizForMessage(message.id));
    console.log('Selected conversation ID:', selectedConversationId);
    
    // Automatically create quiz if one doesn't exist
    if (!getQuizForMessage(message.id) && selectedConversationId) {
      try {
        console.log('Auto-creating quiz for message:', message.id);
        const quizConv = await createQuizForMessage({
          id: message.id,
          content: message.content,
          role: message.role,
          timestamp: message.timestamp,
          conversationId: selectedConversationId
        }, '1');
        console.log('Quiz created successfully:', quizConv);
      } catch (error) {
        console.error('Failed to auto-create quiz:', error);
        return; // Don't open popup if quiz creation failed
      }
    } else {
      console.log('Quiz already exists or no conversation ID');
    }
    
    // Now open the side popup after quiz is created
    setPopupMessage(message.content);
    setSelectedMessageId(message.id);
    setSidePopupOpen(true);
  };

  const handleCloseSidePopup = () => {
    setSidePopupOpen(false);
    setPopupMessage('');
    setSelectedMessageId(null);
    // Only unblock if we have at least one response
    if (quizResponseCount > 0) {
      setIsQuizBlocking(false);
    }
  };

  // Close sidebar when switching to another conversation
  useEffect(() => {
    if (sidePopupOpen) {
      handleCloseSidePopup();
    }
  }, [selectedConversationId]);

  const handleQuizResponseCountChange = (count: number) => {
    console.log('handleQuizResponseCountChange called with count:', count);
    console.log('Current isQuizBlocking state:', isQuizBlocking);
    setQuizResponseCount(count);
    // Unblock input if we have at least one response
    if (count > 0 && isQuizBlocking) {
      console.log('Unblocking input - response count > 0');
      setIsQuizBlocking(false);
      // Force focus to input field after unblocking
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          console.log('Focused input field after unblocking');
        }
      }, 100);
    }
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
                  {activeConversation ? activeConversation.title : ''}
                </h1>
            </div>
            <div className="flex items-center gap-4">
              {/* Mode Display */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    isStrictMode 
                      ? 'bg-red-100 text-red-700 border border-red-200' 
                      : 'bg-green-100 text-green-700 border border-green-200'
                  }`}
                >
                  {isStrictMode ? 'Supervised' : 'Freeform'}
                </span>
              </div>

              {/* Tags Section */}
              {activeConversation && (
                <div className="flex items-center">
                  {conversationTags[activeConversation.id] ? (
                    /* Show Tags */
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {conversationTags[activeConversation.id].map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    /* Show Generate Tags Button */
                    <button
                      onClick={async () => {
                        if (!activeConversation) return;
                        
                        setIsGeneratingTags(true);
                        try {
                          console.log('Requesting tags for session ID:', activeConversation.id);
                          console.log('Full URL:', `http://localhost:5000/api/sessions/${activeConversation.id}/tags`);
                          
                          const response = await fetch(`http://localhost:5000/api/sessions/${activeConversation.id}/tags`, {
                            method: 'GET',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                          });

                          if (!response.ok) {
                            console.error('Response not OK:', response.status, response.statusText);
                            const errorText = await response.text();
                            console.error('Error response body:', errorText);
                            throw new Error(`Failed to generate tags: ${response.status} ${response.statusText}`);
                          }

                          const data = await response.json();
                          const tags = data.tags || [];
                          console.log('Generated tags for conversation:', activeConversation.id, tags);
                          
                          // Store tags in state
                          setConversationTags(prev => ({
                            ...prev,
                            [activeConversation.id]: tags
                          }));
                        } catch (error) {
                          console.error('Error generating tags:', error);
                        } finally {
                          setIsGeneratingTags(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg border border-blue-200 hover:border-blue-300 transition-all duration-200 flex items-center space-x-1"
                      title="Generate tags for this conversation"
                      disabled={isGeneratingTags}
                    >
                      {isGeneratingTags ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span>Generate Tags</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
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
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center mt-24">
                <div className="w-full max-w-4xl">
                  <h2 className="text-4xl text-gray-900 mb-6 animate-fade-in-up">
                    Welcome to <span className="relative inline-block px-3 py-2">
                      <span className="relative z-10 text-white animate-pulse-text">Cognify</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 transform rounded-4xl -skew-y-[2deg] opacity-80 shadow-lg animate-gradient-shift"></span>
                    </span>
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {selectedConversation ? 'Start chatting in this conversation.' : ''}
                  </p>
                  
                  {/* Search bar right below welcome message - wide like ChatGPT */}
                  <div className="w-full">
                    <InputField
                      ref={inputRef}
                      onSendMessage={handleSendMessage}
                      disabled={isQuizBlocking}
                      placeholder={isQuizBlocking ? "Complete the quiz to continue..." : "Message Cognify..."}
                      sidePopupOpen={sidePopupOpen}
                      key={`input-${isQuizBlocking}`}
                    />
                  </div>
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
                            ? activeConversation?.quizMode === 'strict'
                              ? 'bg-purple-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                      
                      {/* Quiz Button - Only for assistant messages */}
                      {message.role === 'assistant' && (
                        <div className="flex items-center space-x-1 self-end mt-1">
                          <button
                            onClick={() => handleOpenSidePopup(message)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-200 ${
                              activeConversation?.quizMode === 'strict'
                                ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-200 hover:border-purple-400'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 hover:border-gray-400'
                            }`}
                            title="Quiz me on this message"
                          >
                            Quiz »
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && !isStrictMode && (
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

          {/* Input Field at Bottom - Only when conversation is active and not blocked by strict mode quiz */}
          {currentMessages.length > 0 && !(isStrictMode && isQuizBlocking) && (
            <div className="flex-shrink-0 border-t border-gray-200 bg-transparent">
              <InputField
                ref={inputRef}
                onSendMessage={handleSendMessage}
                disabled={isQuizBlocking}
                placeholder={isQuizBlocking ? "Complete the quiz to continue..." : "Message Cognify..."}
                sidePopupOpen={sidePopupOpen}
                key={`input-${isQuizBlocking}`}
              />
            </div>
          )}
          
          {/* Blocked message for strict mode */}
          {isStrictMode && isQuizBlocking && (
            <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-4">
              <div className="text-center text-gray-600">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Quiz Required</span>
                </div>
                <p className="text-sm">Complete the quiz on the right to continue the conversation</p>
              </div>
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Side Popup - Only render when open */}
      {sidePopupOpen && (
        <SidePopup
          isOpen={true}
          onClose={handleCloseSidePopup}
          initialMessage={popupMessage}
          title="Check Your Recall"
          onWidthChange={setCurrentSidePopupWidth}
          messageId={selectedMessageId}
          onResponseCountChange={handleQuizResponseCountChange}
        />
      )}
    </div>
  );
}