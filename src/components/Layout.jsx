import { useTheme } from '../hooks/useTheme.jsx';

const tabs = [
  { id: 'lp-pipeline', label: 'LP Pipeline' },
  { id: 'sourcing', label: 'Sourcing' },
  { id: 'deal-funnel', label: 'Deal Funnel' },
  { id: 'deal-analysis', label: 'Deal Analysis' },
  { id: 'portfolio', label: 'Portfolio' },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] transition-all duration-150"
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
  );
}

function UserMenu({ user, onLogout }) {
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-[var(--text-secondary)] hidden sm:block">
        {user.email.split('@')[0]}
      </span>
      <button
        onClick={onLogout}
        className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

export default function Layout({ children, activeTab, setActiveTab, onSync, user, onLogout }) {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="h-[52px] bg-[var(--bg-primary)] border-b border-[var(--border-default)] sticky top-0 z-50">
        <div className="h-full max-w-[1440px] mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img
              src={theme === 'dark' ? '/RRW_LOGO_WHITE.png' : '/RRW_LOGO_HORIZONTAL_RED.png'}
              alt="Red River West"
              className="h-7 w-auto"
            />
            <div className="hidden md:block h-4 w-px bg-[var(--border-default)]" />
            <span className="hidden md:block text-[13px] font-medium text-[var(--text-secondary)]">
              VC Operating System
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSync}
              className="h-8 px-3 flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="hidden sm:inline">Sync</span>
            </button>

            <div className="h-4 w-px bg-[var(--border-default)]" />

            <ThemeToggle />

            <div className="h-4 w-px bg-[var(--border-default)]" />

            <UserMenu user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-[var(--bg-primary)] border-b border-[var(--border-default)]">
        <div className="max-w-[1440px] mx-auto px-4">
          <div className="flex items-center gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative h-10 px-3 text-[13px] font-medium transition-all duration-150
                  ${activeTab === tab.id
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }
                `}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--rrw-red)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto p-4">
        <div className="animate-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}
