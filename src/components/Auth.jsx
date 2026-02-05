import { useEffect, useState } from 'react';
import netlifyIdentity from 'netlify-identity-widget';
import { RRWLogoMark } from './RRWLogo';
import { useTheme } from '../hooks/useTheme';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-[var(--rrw-red)] opacity-[0.02] rounded-full"/>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-[var(--rrw-red)] opacity-[0.02] rounded-full"/>
      </div>

      {/* Login Card */}
      <div
        className={`
          relative bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]
          shadow-lg max-w-sm w-full overflow-hidden
          transition-all duration-500 ease-out
          ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        {/* Red accent bar */}
        <div className="h-1 bg-[var(--rrw-red)]"/>

        <div className="p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className={`transition-transform duration-700 ${mounted ? 'scale-100' : 'scale-90'}`}>
              <RRWLogoMark size={56} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
              VC Operating System
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Red River West
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fadeIn">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {error}
              </p>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={onLogin}
            className="
              w-full flex items-center justify-center gap-3
              bg-[var(--bg-primary)] border border-[var(--border-color)]
              hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]
              text-[var(--text-primary)] font-medium
              py-3 px-4 rounded-lg
              transition-all duration-150
              shadow-sm hover:shadow-md
            "
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[var(--border-color)]"/>
            <span className="text-xs text-[var(--text-tertiary)]">or</span>
            <div className="flex-1 h-px bg-[var(--border-color)]"/>
          </div>

          {/* Alternative: Email (disabled placeholder for future) */}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="name@redriverwest.com"
              disabled
              className="
                w-full px-3 py-2.5 rounded-lg
                bg-[var(--bg-secondary)] border border-[var(--border-color)]
                text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                text-sm opacity-50 cursor-not-allowed
              "
            />
            <button
              disabled
              className="
                w-full py-2.5 rounded-lg
                bg-[var(--bg-secondary)] text-[var(--text-tertiary)]
                text-sm font-medium opacity-50 cursor-not-allowed
              "
            >
              Continue with email
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
          <p className="text-xs text-center text-[var(--text-tertiary)]">
            Access restricted to <span className="font-medium">@redriverwest.com</span> accounts
          </p>
        </div>
      </div>

      {/* Theme Toggle - Bottom Right */}
      <div className="fixed bottom-4 right-4">
        <LoginThemeToggle />
      </div>
    </div>
  );
}

// Simplified theme toggle for login screen (doesn't use context)
function LoginThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('rrw-theme');
    return saved || 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('rrw-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className="
        p-2 rounded-lg
        bg-[var(--bg-primary)] border border-[var(--border-color)]
        hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]
        transition-all duration-150 shadow-sm
      "
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
      ) : (
        <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      )}
    </button>
  );
}
