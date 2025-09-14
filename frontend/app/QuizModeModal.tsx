'use client';

import { useState } from 'react';

interface QuizModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'strict' | 'unsupervised') => void;
}

export default function QuizModeModal({ isOpen, onClose, onSelectMode }: QuizModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<'strict' | 'unsupervised'>('unsupervised');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectMode(selectedMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-white/20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Quiz Mode</h2>
        <p className="text-gray-600 mb-6">
          Select how you'd like to be quizzed during this conversation:
        </p>
        
        <div className="space-y-4 mb-6">
          {/* Unsupervised Mode */}
          <div 
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedMode === 'unsupervised' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedMode('unsupervised')}
          >
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Unsupervised</h3>
              <p className="text-sm text-gray-600">
                Quiz yourself when you want. Click "Quiz me" on any AI response to test your understanding.
              </p>
            </div>
          </div>

          {/* Strict Mode */}
          <div 
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedMode === 'strict' 
                ? 'border-purple-500 bg-purple-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedMode('strict')}
          >
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Strict</h3>
              <p className="text-sm text-gray-600">
                Automatically quiz you on every AI response. Perfect for intensive learning sessions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100/80 hover:bg-gray-200/80 backdrop-blur-sm rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors backdrop-blur-sm ${
              selectedMode === 'unsupervised' 
                ? 'bg-blue-500/90 hover:bg-blue-600/90' 
                : 'bg-purple-500/90 hover:bg-purple-600/90'
            }`}
          >
            Start Chat
          </button>
        </div>
      </div>
    </div>
  );
}
