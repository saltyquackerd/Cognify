'use client';

import { useState, useEffect } from 'react';

declare global {
  interface Window {
    google: any;
  }
}

interface GoogleUser {
  credential: string;
  select_by: string;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface LoginPopupProps {
  onLogin: (user: any, sessionId: string) => void;
}

export default function LoginPopup({ onLogin }: LoginPopupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleAuth;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const initializeGoogleAuth = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: 280,
          text: 'signin_with',
          shape: 'rectangular',
        }
      );
    }
  };

  const handleGoogleResponse = async (response: GoogleUser) => {
    setIsLoading(true);
    setError('');

    try {
      // Decode the JWT token to get user info
      const decodedToken = parseJwt(response.credential);
      
      // Send the token to your backend for verification and user creation
      const backendResponse = await fetch('http://localhost:5000/api/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential: response.credential,
          user_info: {
            google_id: decodedToken.sub,
            email: decodedToken.email,
            name: decodedToken.name,
            picture: decodedToken.picture,
          }
        }),
      });

      if (!backendResponse.ok) {
        throw new Error('Authentication failed');
      }

      const userData = await backendResponse.json();
      
      // Call the onLogin callback
      onLogin(userData.user, userData.session_id);
      
    } catch (error) {
      console.error('Google Auth Error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const parseJwt = (token: string): DecodedToken => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-200/20 dark:border-gray-700/20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to Cognify
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to continue your AI learning journey
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Google Sign In */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <div id="google-signin-button"></div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center space-x-2 py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-600 dark:text-gray-400 text-sm">Signing in...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
