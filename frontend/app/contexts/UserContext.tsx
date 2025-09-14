'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface UserContextType {
  user: User | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  login: (userData: User, sessionId: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing authentication on mount
    const storedUser = localStorage.getItem('user');
    const storedSessionId = localStorage.getItem('session_id');

    if (storedUser && storedSessionId) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setSessionId(storedSessionId);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        logout();
      }
    }
  }, []);

  const login = (userData: User, sessionId: string) => {
    setUser(userData);
    setSessionId(sessionId);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('session_id', sessionId);
  };

  const logout = () => {
    setUser(null);
    setSessionId(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('session_id');
  };

  return (
    <UserContext.Provider value={{
      user,
      sessionId,
      isAuthenticated,
      login,
      logout
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
