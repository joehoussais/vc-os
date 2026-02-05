import { useState } from 'react';
import Layout from './components/Layout';
import Toast from './components/Toast';
import { useLocalStorage } from './hooks/useLocalStorage';

// Pages
import LPPipeline from './pages/LPPipeline';
import Sourcing from './pages/Sourcing';
import DealFunnel from './pages/DealFunnel';
import DealAnalysis from './pages/DealAnalysis';
import Portfolio from './pages/Portfolio';

function App() {
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
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} onSync={handleSync}>
        {renderTab()}
      </Layout>
      <Toast message={toast.message} show={toast.show} onHide={hideToast} />
    </>
  );
}

export default App;
