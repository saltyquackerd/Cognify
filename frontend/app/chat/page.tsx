'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatBox from '../ChatBox';
import MessageList from '../MessageList';

export default function ChatPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const userData = localStorage.getItem('user');
    const sessionId = localStorage.getItem('session_id');
    
    if (userData && sessionId) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    } else {
      router.push('/');
    }
    
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('session_id');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to home
  }

  return (
    <div className="h-screen flex">
      <MessageList />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Cognify Chat
          </h1>
        </div>
        
        {/* Chat interface */}
        <div className="flex-1 flex flex-col">
          <ChatBox />
        </div>
      </div>
    </div>
  );
}
