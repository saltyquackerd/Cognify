'use client';

import { useState, useRef, KeyboardEvent, forwardRef } from 'react';

interface InputFieldProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  sidePopupOpen?: boolean;
  showInstructions?: boolean;
}

const InputField = forwardRef<HTMLTextAreaElement, InputFieldProps>(({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Message ChatGPT...",
  sidePopupOpen = false,
  showInstructions = true
}, ref) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Use the forwarded ref or fallback to internal ref
  const inputRef = ref || textareaRef;

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className={`w-full p-4 ${sidePopupOpen ? 'max-w-2xl' : 'pr-16'}`}>
      <div className="relative flex items-end bg-white border border-gray-300 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
      <textarea
        ref={inputRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent border-none outline-none px-4 py-3 text-gray-900 placeholder-gray-500 text-base leading-6 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300"
          style={{ minHeight: '24px' }}
        />
        
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`m-2 p-2 rounded-lg transition-all duration-200 ${
            message.trim() && !disabled
              ? 'bg-gray-900 hover:bg-gray-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="transform transition-transform duration-200 hover:scale-105"
          >
            <path
              d="M7 11L12 6L17 11M12 18V7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Helper text */}
      {showInstructions && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send, Shift + Enter for new line
        </div>
      )}
    </div>
  );
});

InputField.displayName = 'InputField';

export default InputField;