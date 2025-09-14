'use client';

import { useAuth } from './components/AuthProvider';
import AuthPage from './components/AuthPage';
import ChatBox from './ChatBox';
import MessageList from './MessageList';

export default function Home() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={login} />;
  }

  return (
    <div className="h-screen flex">
      <MessageList />
      <div className="flex-1 relative">
        {/* User info and logout button */}
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-3 bg-white rounded-lg shadow-sm px-3 py-2">
          {user.picture && (
            <img 
              src={user.picture} 
              alt={user.username}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">{user.username}</span>
            {user.is_guest && (
              <span className="text-xs text-gray-500">Guest</span>
            )}
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
        
        <ChatBox />
      </div>
    </div>
  );
}
