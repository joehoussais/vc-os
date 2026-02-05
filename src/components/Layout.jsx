import { useTheme } from '../hooks/useTheme';
import { RRWLogoMark } from './RRWLogo';

const tabs = [
  { id: 'lp-pipeline', label: 'LP Pipeline', icon: '💰' },
  { id: 'sourcing', label: 'Sourcing', icon: '🔍' },
  { id: 'deal-funnel', label: 'Deal Funnel', icon: '📊' },
  { id: 'deal-analysis', label: 'Deal Analysis', icon: '⚡' },
  { id: 'portfolio', label: 'Portfolio', icon: '🏢' },
];

// Theme Toggle Button
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
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

// User Menu
function UserMenu({ user, onLogout }) {
  if (!user) return null;

  const initials = user.email
    .split('@')[0]
    .split('.')
    .map(n => n[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-[var(--rrw-red)] flex items-center justify-center text-white text-xs font-medium">
        {initials}
      </div>
      <button
        onClick={onLogout}
        className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

export default function Layout({ children, activeTab, setActiveTab, onSync, user, onLogout }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      {/* Notion-style Header */}
      <header className="bg-[var(--bg-primary)] border-b border-[var(--border-color)] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <RRWLogoMark size={32} />
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  VC Operating System
                </h1>
                <span className="text-[var(--text-tertiary)] text-sm">/</span>
                <span className="text-[var(--text-secondary)] text-sm">Red River West</span>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={onSync}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Sync
              </button>

              <div className="w-px h-5 bg-[var(--border-color)] mx-1"/>

              <ThemeToggle />

              <div className="w-px h-5 bg-[var(--border-color)] mx-1"/>

              <UserMenu user={user} onLogout={onLogout} />
            </div>
          </div>

          {/* Notion-style Tab Navigation */}
          <div className="flex items-center px-4 gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-3 py-2 text-sm font-medium transition-all duration-150 rounded-t-md
                  ${activeTab === tab.id
                    ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--rrw-red)]"/>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6 animate-fadeIn">
        <div className="bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] min-h-[calc(100vh-140px)]">
          <div className="p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
