import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Toast from './components/Toast';
import { useAuth, LoginScreen } from './components/Auth';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ThemeProvider } from './hooks/useTheme.jsx';

// Pages
import LPPipeline from './pages/LPPipeline';
import Sourcing from './pages/Sourcing';
import DealFunnel from './pages/DealFunnel';
import DealAnalysis from './pages/DealAnalysis';
import Portfolio from './pages/Portfolio';

function AppContent() {
  const { user, loading, login, logout, error } = useAuth();
  const [activeTab, setActiveTab] = useState('coverage');
  const [toast, setToast] = useState({ show: false, message: '' });

  // Persistent state
  const [meetingRatings, setMeetingRatings] = useLocalStorage('meetingRatings', {});

  const showToast = (message) => {
    setToast({ show: true, message });
  };

  const hideToast = () => {
    setToast({ show: false, message: '' });
  };

  const handleSync = () => {
    showToast('Syncing...');
    setTimeout(() => showToast('Data synced!'), 1000);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin"/>
          <span className="text-[var(--text-secondary)] text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLogin={login} error={error} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'lp-pipeline':
        return <LPPipeline />;
      case 'coverage':
        return <Sourcing />;
      case 'deal-funnel':
        return <DealFunnel />;
      case 'deal-analysis':
        return (
          <DealAnalysis
            meetingRatings={meetingRatings}
            setMeetingRatings={setMeetingRatings}
            showToast={showToast}
          />
        );
      case 'portfolio':
        return <Portfolio />;
      default:
        return <Sourcing />;
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSync={handleSync}
        user={user}
        onLogout={logout}
      >
        {renderTab()}
      </Layout>
      <Toast message={toast.message} show={toast.show} onHide={hideToast} />
    </>
  );
}

function App() {
  // Apply theme on initial load (before React renders)
  useEffect(() => {
    const savedTheme = localStorage.getItem('rrw-theme') || 'light';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
