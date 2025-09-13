'use client';

import React, { useState, useRef, useCallback } from 'react';
import InputField from './InputField';

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
  position: { x: number; y: number };
}

export default function SidePopup({ isOpen, onClose, initialMessage, title = "Continue Chat", position }: SidePopupProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessage) {
      return [{
        id: Date.now().toString(),
        content: initialMessage,
        role: 'assistant',
        timestamp: new Date()
      }];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(500);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "This is a follow-up response in the side popup. I can help you explore this topic further!",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || isFullscreen) return;
    
    const newWidth = Math.max(300, Math.min(600, e.clientX - position.x));
    const newHeight = Math.max(300, Math.min(window.innerHeight - position.y - 20, e.clientY - position.y));
    setWidth(newWidth);
    setHeight(newHeight);
  }, [isResizing, isFullscreen, position]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Add event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return (
    <div 
      ref={resizeRef}
      className={`fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-lg z-50 transition-all duration-300 ${
        isFullscreen 
          ? 'inset-4' 
          : `transform ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`
      }`}
      style={isFullscreen ? {} : { 
        left: `${position.x}px`, 
        top: `${position.y}px`, 
        width: `${width}px`, 
        height: `${height}px` 
      }}
    >
        {/* Resize Handle - Bottom Right Corner */}
        {!isFullscreen && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize hover:bg-blue-500 transition-colors bg-gray-300 dark:bg-gray-600 rounded-tl-lg"
            onMouseDown={handleMouseDown}
          />
        )}
        
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  {isFullscreen ? (
                    <path d="M8 3V5H4V9H2V3H8ZM2 15V21H8V19H4V15H2ZM22 9V3H16V5H20V9H22ZM22 15V21H16V19H20V15H22Z" fill="currentColor"/>
                  ) : (
                    <path d="M7 14H5V19H10V17H7V14ZM5 10H7V7H10V5H5V10ZM17 17H14V19H19V14H17V17ZM14 5V7H17V10H19V5H14Z" fill="currentColor"/>
                  )}
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  <span className="text-white font-bold">C</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Start a focused conversation here
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className="mb-4">
                    <div className={`text-xs font-medium mb-1 ${
                      message.role === 'user' 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {message.role === 'user' ? 'You' : 'Cognify'}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="mb-4">
                    <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                      Cognify
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <InputField
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Continue the conversation..."
            />
          </div>
        </div>
    </div>
  );
}