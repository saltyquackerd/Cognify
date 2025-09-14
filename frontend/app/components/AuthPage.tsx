'use client';

import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';

interface User {
  id: string;
  username: string;
  email: string;
  picture?: string;
  is_guest: boolean;
}

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState({ google_oauth_enabled: false, guest_enabled: true });

  useEffect(() => {
    // Check auth configuration
    fetch('http://localhost:5000/api/auth/config')
      .then(res => res.json())
      .then(config => setAuthConfig(config))
      .catch(() => setAuthConfig({ google_oauth_enabled: false, guest_enabled: true }));
  }, []);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: credentialResponse.credential,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user_data', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setError('Network error. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google authentication failed');
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/auth/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: guestName.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user_data', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        setError(data.error || 'Guest login failed');
      }
    } catch (error) {
      console.error('Guest login error:', error);
      setError('Network error. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cognify</h1>
          <p className="text-gray-600">Your AI-powered learning companion</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="space-y-6">
          {!showGuestForm ? (
            <>
              {/* Google OAuth Section */}
              {authConfig.google_oauth_enabled && (
                <div className="flex flex-col items-center space-y-4">
                  <h2 className="text-xl font-semibold text-gray-800">Sign in with Google</h2>
                  
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">Signing in...</span>
                    </div>
                  ) : (
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      theme="outline"
                      size="large"
                      text="signin_with"
                      shape="rectangular"
                    />
                  )}
                </div>
              )}

              {/* Divider */}
              {authConfig.google_oauth_enabled && authConfig.guest_enabled && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
              )}

              {/* Guest Option */}
              {authConfig.guest_enabled && (
                <div className="text-center">
                  <button
                    onClick={() => setShowGuestForm(true)}
                    disabled={isLoading}
                    className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Continue as Guest
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Guest Form */
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div>
                <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your name to continue as guest
                </label>
                <input
                  id="guestName"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowGuestForm(false)}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !guestName.trim()}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            {showGuestForm 
              ? "Guest sessions are temporary and won't be saved" 
              : "Choose your preferred way to access Cognify"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
