'use client';

import React, { useState, useRef, useEffect } from 'react';
import InputField from './InputField';
import { useStore } from './store/useStore';
import { API_URLS } from '../lib/api';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface SidePopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage: string;
  title: string;
  onWidthChange?: (width: number) => void;
  messageId?: string | null;
  onResponseCountChange?: (count: number) => void;
}

export default function SidePopup({ isOpen, onClose, initialMessage, title = "Continue Chat", onWidthChange, messageId, onResponseCountChange }: SidePopupProps) {
  const { selectedConversationId, conversations } = useStore();
  // Subscribe to the specific quiz id for this message so changes trigger re-render
  const quizConversationId = useStore((state) => (messageId ? state.messageQuizMap[messageId] : null));
  
  // Get the current conversation's quiz mode
  const currentConversation = conversations.find(conv => conv.id === selectedConversationId);
  const isStrictMode = currentConversation?.quizMode === 'strict';
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [width, setWidth] = useState(384); // w-96 = 384px
  const [isResizing, setIsResizing] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [askedInitial, setAskedInitial] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  // Guard to ensure we only auto-ask once per quiz id (handles React StrictMode double-effect)
  const hasAskedForQuizRef = useRef<Record<string, boolean>>({});
  const resizeRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Reset state when messageId changes (popup opens for different message)
  useEffect(() => {
    console.log('SidePopup messageId changed, resetting state for messageId:', messageId);
    setMessages([]);
    setAskedInitial(false);
    setHasQuiz(false);
    setIsAskingQuestion(false);
    // Don't immediately reset response count - let it be calculated from loaded messages
  }, [messageId]);

  // Ensure quiz exists; always load messages on open/return; only auto-ask once per quiz
  useEffect(() => {
    console.log('SidePopup useEffect - messageId:', messageId);
    console.log('SidePopup useEffect - quizConversationId:', quizConversationId);
    console.log('SidePopup useEffect - askedInitial:', askedInitial);
    if (!messageId) return;
    if (quizConversationId) {
      console.log('Quiz exists, setting hasQuiz to true');
      setHasQuiz(true);
      (async () => {
        try {
          // Always load messages when (re)opening this quiz
          const hasExistingMessages = await loadQuizMessages(quizConversationId);
          // If no messages yet, auto-ask only once per quiz id
          if (!hasExistingMessages && !hasAskedForQuizRef.current[quizConversationId] && !isAskingQuestion) {
            console.log('No existing messages for this quiz; auto-asking initial question');
            setIsAskingQuestion(true);
            hasAskedForQuizRef.current[quizConversationId] = true;
            await askQuestion(quizConversationId);
          }
          setAskedInitial(true);
        } catch (e) {
          console.error('Error loading quiz or asking initial question:', e);
        } finally {
          setIsAskingQuestion(false);
        }
      })();
    } else {
      console.log('No quiz exists yet, setting hasQuiz to false');
      setHasQuiz(false);
      setAskedInitial(false);
    }
  }, [messageId, quizConversationId]);

  const loadQuizMessages = async (quizId: string) => {
    console.log('loadQuizMessages called for quizId:', quizId);
    try {
      const response = await fetch(API_URLS.QUIZ_MESSAGES(quizId));
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('Failed to load quiz messages', response.status, errText);
        throw new Error('Failed to load quiz messages');
      }
      const data = await response.json();
      console.log('loadQuizMessages response:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        // Convert backend messages to frontend Message format
        const messages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.timestamp)
        }));
        console.log('Loaded existing quiz messages:', messages);
        setMessages(messages);
        return true; // Has existing messages
      }
      return false; // No existing messages
    } catch (error) {
      console.error('Error loading quiz messages:', error);
      return false;
    }
  };

  const askQuestion = async (quizId: string) => {
    console.log('askQuestion called for quizId:', quizId);
    const response = await fetch(API_URLS.QUIZ_ASK_QUESTION(quizId), {
      method: 'POST'
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Failed to ask quiz question', response.status, errText);
      throw new Error('Failed to ask quiz question');
    }
    const data = await response.json();
    console.log('askQuestion response:', data);
    const questionMessage: Message = {
      id: data.quiz_message_id || (Date.now() + 1).toString(),
      content: typeof data.quiz_questions === 'string' ? data.quiz_questions : String(data.quiz_questions),
      role: 'assistant',
      timestamp: new Date(),
    };
    console.log('Adding question message:', questionMessage);
    setMessages(prev => {
      console.log('Previous messages:', prev);
      const newMessages = [...prev, questionMessage];
      console.log('New messages:', newMessages);
      return newMessages;
    });
  };


  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 270;
    const maxWidth = window.innerWidth * 0.8;
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setWidth(newWidth);
    } else if (newWidth > maxWidth) {
      // Snap to fullscreen when dragged beyond maximum width
      setIsFullscreen(true);
      setIsResizing(false);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Notify parent of width changes
  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(width);
    }
  }, [width, onWidthChange]);

  // Track response count and notify parent
  useEffect(() => {
    const userResponseCount = messages.filter(msg => msg.role === 'user').length;
    console.log('SidePopup - tracking response count:', userResponseCount, 'from messages:', messages);
    if (onResponseCountChange) {
      onResponseCountChange(userResponseCount);
    }
  }, [messages, onResponseCountChange]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (content: string) => {
    if (!messageId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Quiz should already exist when popup opens
      if (!quizConversationId) {
        throw new Error('No quiz found for this message');
      }

      // For quiz, send answers to the non-streaming endpoint
      const quizId = quizConversationId;
      const response = await fetch(API_URLS.QUIZ_ANSWER(quizId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: content
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Failed to submit quiz answer: ${errorMessage}`);
      }

      const data = await response.json();
      
      // Create assistant message from backend evaluation
      const assistantMessage: Message = {
        id: data.evaluation_message_id || (Date.now() + 1).toString(),
        content: data.evaluation,
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error sending message to thread:', error);
      
      // Fallback to simulated response if backend fails
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg text-gray-900">
            {title} - Fullscreen
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
              title="Exit fullscreen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? isStrictMode
                      ? 'bg-purple-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Field */}
        <div className="border-t border-gray-200 p-6">
          <InputField
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            placeholder={width < 390 ? "Continue..." : "Continue conversation..."}
            showInstructions={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={resizeRef}
      className="bg-white border-l border-gray-200 flex flex-col h-full flex-shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full bg-gray-200 hover:bg-gray-400 cursor-col-resize z-10 opacity-30 hover:opacity-100 transition-opacity duration-200"
        onMouseDown={handleMouseDown}
      />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Fullscreen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                message.role === 'user'
                  ? isStrictMode
                    ? 'bg-purple-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-3 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="p-4 space-y-3">
        <div className="w-full">
          <InputField
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            placeholder={width < 390 ? "Type your answer..." : "Type your answer to the question..."}
            showInstructions={false}
            sidePopupOpen={true}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!messageId) return;
              const quizId = quizConversationId;
              if (quizId) {
                askQuestion(quizId);
              }
            }}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200 rounded-lg shadow-sm hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]"
            disabled={!hasQuiz || !messageId || isLoading}
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              New quiz question
            </span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-400 hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M19 12H5m7-7l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}