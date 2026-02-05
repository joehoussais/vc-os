import { useState } from 'react';
import Layout from './components/Layout';
import Toast from './components/Toast';
import { useAuth, LoginScreen } from './components/Auth';
import { useLocalStorage } from './hooks/useLocalStorage';

// Pages
import LPPipeline from './pages/LPPipeline';
import Sourcing from './pages/Sourcing';
import DealFunnel from './pages/DealFunnel';
import DealAnalysis from './pages/DealAnalysis';
import Portfolio from './pages/Portfolio';

function App() {
  const { user, loading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('sourcing');
  const [toast, setToast] = useState({ show: false, message: '' });

  // Persistent state
  const [dealState, setDealState] = useLocalStorage('dealState', {});
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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'lp-pipeline':
        return <LPPipeline />;
      case 'sourcing':
        return (
          <Sourcing
            dealState={dealState}
            setDealState={setDealState}
            showToast={showToast}
          />
        );
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
        return <Sourcing dealState={dealState} setDealState={setDealState} showToast={showToast} />;
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

export default App;
