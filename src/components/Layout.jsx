import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme.jsx';

const tabs = [
  { path: '/lp-pipeline', label: 'LP Pipeline' },
  { path: '/coverage', label: 'Coverage' },
  { path: '/deal-funnel', label: 'Deal Flow Pipeline' },
  { path: '/deal-analysis', label: 'Deal Analysis' },
  { path: '/portfolio', label: 'Portfolio' },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-all duration-150"
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? (
        <svg className="w-[15px] h-[15px] text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg className="w-[15px] h-[15px] text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}

function UserMenu({ user, onLogout }) {
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-[var(--text-tertiary)] hidden sm:block">
        {user.email.split('@')[0]}
      </span>
      <button
        onClick={onLogout}
        className="text-[13px] text-[var(--text-quaternary)] hover:text-[var(--text-primary)] transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

export default function Layout({ children, onSync, user, onLogout }) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] bg-knot-pattern">
      {/* Header */}
      <header className="h-[52px] bg-[var(--bg-secondary)] border-b border-[var(--border-default)] sticky top-0 z-50 backdrop-blur-sm bg-opacity-90">
        <div className="h-full max-w-[1440px] mx-auto px-5 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img
              src={theme === 'dark' ? '/RRW_LOGO_WHITE.png' : '/RRW_LOGO_HORIZONTAL_RED.png'}
              alt="Red River West"
              className="h-6 w-auto"
            />
            <div className="hidden md:block h-4 w-px bg-[var(--border-default)]" />
            <span className="hidden md:block text-[13px] font-bold tracking-wide text-[var(--text-primary)]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              VC OS: Red River West Operations Console
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onSync}
              className="h-8 px-3 flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-all duration-150"
            >
              <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="hidden sm:inline">Sync</span>
            </button>

            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

            <ThemeToggle />

            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

            <UserMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)] relative z-10">
        <div className="max-w-[1440px] mx-auto px-5">
          <div className="flex items-center gap-0.5 -mb-px">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`
                    relative h-10 px-3 text-[13px] transition-all duration-150 rounded-md
                    ${isActive
                      ? 'text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-tertiary)] font-medium hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }
                  `}
                >
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--rrw-red)] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto p-5 relative z-10">
        <div className="animate-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}
