'use client';

import React, { useState, useRef, useEffect } from 'react';
import InputField from './InputField';
import { useStore } from './store/useStore';

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
}

export default function SidePopup({ isOpen, onClose, initialMessage, title = "Continue Chat", onWidthChange, messageId }: SidePopupProps) {
  const { getQuizForMessage, createQuizForMessage, selectedConversationId } = useStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [width, setWidth] = useState(384); // w-96 = 384px
  const [isResizing, setIsResizing] = useState(false);
  const [hasQuiz, setHasQuiz] = useState(false);
  const [askedInitial, setAskedInitial] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Ensure quiz exists and ask initial question
  useEffect(() => {
    if (messageId) {
      const quizConversationId = getQuizForMessage(messageId);
      if (quizConversationId) {
        setHasQuiz(true);
        if (!askedInitial) {
          // Ask the first question automatically
          (async () => {
            try {
              await askQuestion(quizConversationId);
              setAskedInitial(true);
            } catch (e) {
              console.error(e);
            }
          })();
        }
      } else {
        // No quiz exists yet; show nothing until user creates
        setHasQuiz(false);
        setAskedInitial(false);
      }
    }
  }, [messageId, getQuizForMessage, askedInitial]);

  const askQuestion = async (quizId: string) => {
    const response = await fetch(`http://localhost:5000/api/quiz/${quizId}/ask-question`, {
      method: 'POST'
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Failed to ask quiz question', response.status, errText);
      throw new Error('Failed to ask quiz question');
    }
    const data = await response.json();
    const questionMessage: Message = {
      id: data.quiz_message_id || (Date.now() + 1).toString(),
      content: typeof data.quiz_questions === 'string' ? data.quiz_questions : String(data.quiz_questions),
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, questionMessage]);
  };

  const handleCreateQuizThread = async () => {
    if (!messageId || !selectedConversationId || isCreatingThread) return;
    
    setIsCreatingThread(true);
    try {
      // Create quiz conversation (non-streaming backend)
      const quizConv = await createQuizForMessage({
        id: messageId,
        content: initialMessage,
        role: 'assistant',
        timestamp: new Date(),
        conversationId: selectedConversationId
      }, '1');
      
      setHasQuiz(true);
      setMessages([]);
      setAskedInitial(true);
      await askQuestion(quizConv.id);
    } catch (error) {
      console.error('Failed to create quiz thread:', error);
    } finally {
      setIsCreatingThread(false);
    }
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
      // Get or create quiz conversation
      let threadConversationId = getQuizForMessage(messageId);
      
      if (!threadConversationId) {
        // Create a new quiz conversation (without selecting it)
        const threadConv = await createQuizForMessage({
          id: messageId,
          content: initialMessage,
          role: 'assistant',
          timestamp: new Date(),
          conversationId: selectedConversationId || ''
        }, '1');
        threadConversationId = threadConv.id;
      }

      // For quiz, send answers to the non-streaming endpoint
      const quizId = threadConversationId;
      const response = await fetch(`http://localhost:5000/api/quiz/${quizId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz answer');
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
            {!hasQuiz && messageId && (
              <button
                onClick={handleCreateQuizThread}
                disabled={isCreatingThread}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Create quiz thread for this message"
              >
                {isCreatingThread ? 'Creating...' : 'Create Quiz'}
              </button>
            )}
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
                    ? 'bg-blue-600 text-white'
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
          {!hasQuiz && messageId && (
            <button
              onClick={handleCreateQuizThread}
              disabled={isCreatingThread}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create quiz thread for this message"
            >
              {isCreatingThread ? 'Creating...' : 'Create Quiz'}
            </button>
          )}
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
                  ? 'bg-blue-600 text-white'
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
      </div>

      {/* Input Field */}
      <div className="border-t border-gray-200 p-4 space-y-3">
        <InputField
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          placeholder={width < 390 ? "Type your answer..." : "Type your answer to the question..."}
          showInstructions={false}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!messageId) return;
              const quizId = getQuizForMessage(messageId);
              if (quizId) {
                askQuestion(quizId);
              }
            }}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={!hasQuiz || !messageId || isLoading}
          >
            Quiz me again
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}