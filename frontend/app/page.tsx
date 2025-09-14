'use client';

import { useUser } from './contexts/UserContext';
import LoginPopup from './LandingPage';
import ChatBox from './ChatBox';
import MessageList from './MessageList';

export default function Home() {
  const { isAuthenticated, login, user } = useUser();

  const handleLogin = (userData: any, sessionId: string) => {
    login(userData, sessionId);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('session_id');
    window.location.reload();
  };

  return (
    <div className="h-screen flex relative">
      {/* Main UI - always rendered */}
      <div className={`h-full w-full flex ${!isAuthenticated ? 'pointer-events-none' : ''}`}>
        <MessageList />
        <div className="flex-1 flex flex-col">
          {/* Header with app title */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Cognify Chat
            </h1>
          </div>
          
          {/* Chat interface */}
          <div className="flex-1">
            <ChatBox />
          </div>
        </div>
      </div>


      {/* Login popup overlay when not authenticated */}
      {!isAuthenticated && (
        <LoginPopup onLogin={handleLogin} />
      )}
    </div>
  );
}
