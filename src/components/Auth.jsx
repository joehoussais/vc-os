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
    netlifyIdentity.init();

    const currentUser = netlifyIdentity.currentUser();
    if (currentUser && !isAllowedEmail(currentUser.email)) {
      netlifyIdentity.logout();
      setError(`Access restricted to @${ALLOWED_DOMAIN} accounts`);
    } else {
      setUser(currentUser);
    }
    setLoading(false);

    netlifyIdentity.on('login', (user) => {
      if (!isAllowedEmail(user.email)) {
        netlifyIdentity.logout();
        setError(`Access restricted to @${ALLOWED_DOMAIN} accounts`);
        setUser(null);
      } else {
        setError(null);
        setUser(user);
        netlifyIdentity.close();
      }
    });

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
    const siteURL = window.location.origin;
    window.location.href = `${siteURL}/.netlify/identity/authorize?provider=google`;
  };
  const logout = () => netlifyIdentity.logout();

  return { user, loading, login, logout, error };
}

export function LoginScreen({ onLogin, error }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('rrw-theme');
    return saved || 'light';
  });

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('rrw-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex flex-col">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--rrw-red-subtle)] via-transparent to-transparent opacity-50" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div
          className={`
            w-full max-w-[380px]
            transition-all duration-500 ease-out
            ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src={theme === 'dark' ? '/RRW_LOGO_WHITE.png' : '/RRW_LOGO_HORIZONTAL_RED.png'}
              alt="Red River West"
              className="h-10 w-auto"
            />
          </div>

          {/* Card */}
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-lg)] overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <h1 className="text-xl font-semibold text-[var(--text-primary)] text-center">
                Welcome back
              </h1>
              <p className="text-[13px] text-[var(--text-secondary)] text-center mt-1">
                Sign in to access the VC Operating System
              </p>
            </div>

            {/* Body */}
            <div className="px-6 pb-6">
              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-slideDown">
                  <p className="text-[13px] text-red-500 text-center font-medium">
                    {error}
                  </p>
                </div>
              )}

              {/* Google Sign In */}
              <button
                onClick={onLogin}
                className="
                  w-full h-11 flex items-center justify-center gap-3
                  bg-[var(--bg-primary)] border border-[var(--border-strong)]
                  hover:bg-[var(--bg-hover)] hover:border-[var(--border-default)]
                  text-[var(--text-primary)] font-medium text-[14px]
                  rounded-lg transition-all duration-150
                  shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-sm)]
                "
              >
                <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[var(--border-default)]" />
                <span className="text-[11px] text-[var(--text-quaternary)] uppercase tracking-wider">
                  Restricted access
                </span>
                <div className="flex-1 h-px bg-[var(--border-default)]" />
              </div>

              {/* Email hint */}
              <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                Only <span className="text-[var(--text-secondary)] font-medium">@redriverwest.com</span> accounts are permitted
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-[var(--text-quaternary)] text-center mt-6">
            Protected by Netlify Identity
          </p>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={toggleTheme}
          className="
            w-9 h-9 flex items-center justify-center
            bg-[var(--bg-primary)] border border-[var(--border-default)]
            hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]
            rounded-lg transition-all duration-150 shadow-[var(--shadow-sm)]
          "
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
