import { useEffect, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';

const ALLOWED_DOMAIN = 'redriverwest.com';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAllowedEmail = (email) => {
    return email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
  };

  useEffect(() => {
    // Initialize Netlify Identity
    netlifyIdentity.init();

    // Check if user is already logged in
    const currentUser = netlifyIdentity.currentUser();
    if (currentUser && !isAllowedEmail(currentUser.email)) {
      // User is logged in but not allowed - log them out
      netlifyIdentity.logout();
      setError(`Access restricted to @${ALLOWED_DOMAIN} accounts`);
    } else {
      setUser(currentUser);
    }
    setLoading(false);

    // Listen for login
    netlifyIdentity.on('login', (user) => {
      if (!isAllowedEmail(user.email)) {
        // Not an allowed domain - log them out immediately
        netlifyIdentity.logout();
        setError(`Access restricted to @${ALLOWED_DOMAIN} accounts`);
        setUser(null);
      } else {
        setError(null);
        setUser(user);
        netlifyIdentity.close();
      }
    });

    // Listen for logout
    netlifyIdentity.on('logout', () => {
      setUser(null);
    });

    return () => {
      netlifyIdentity.off('login');
      netlifyIdentity.off('logout');
    };
  }, []);

  const login = () => {
    setError(null);
    // Go directly to Google OAuth, bypassing the widget
    const siteURL = window.location.origin;
    window.location.href = `${siteURL}/.netlify/identity/authorize?provider=google`;
  };
  const logout = () => netlifyIdentity.logout();

  return { user, loading, login, logout, error };
}

export function LoginScreen({ onLogin, error }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-6">
          <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="12" fill="#E63424"/>
            <path d="M25 30h20c8 0 14 6 14 14s-6 14-14 14h-8l14 17h-12l-14-17v17h-10V30h10zm10 8v12h10c3 0 5-2 5-6s-2-6-5-6H35z" fill="white"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">VC Operating System</h1>
        <p className="text-center text-gray-500 mb-8">Red River West</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={onLogin}
          className="w-full bg-[#E63424] text-white py-3 px-4 rounded-lg font-medium hover:bg-[#C42A1D] transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-xs text-center text-gray-400 mt-6">
          Access restricted to @redriverwest.com accounts
        </p>
      </div>
    </div>
  );
}
