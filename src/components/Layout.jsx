import { useState } from 'react';

const tabs = [
  { id: 'lp-pipeline', label: 'LP Pipeline', badge: '€45M' },
  { id: 'sourcing', label: 'Sourcing', badge: '67%' },
  { id: 'deal-funnel', label: 'Deal Funnel', badge: '0.3%' },
  { id: 'deal-analysis', label: 'Deal Analysis', badge: '8' },
  { id: 'portfolio', label: 'Portfolio', badge: '11' },
];

export default function Layout({ children, activeTab, setActiveTab, onSync, user, onLogout }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" rx="12" fill="#E63424"/>
                <path d="M25 30h20c8 0 14 6 14 14s-6 14-14 14h-8l14 17h-12l-14-17v17h-10V30h10zm10 8v12h10c3 0 5-2 5-6s-2-6-5-6H35z" fill="white"/>
              </svg>
              <div>
                <h1 className="text-xl font-bold text-gray-900">VC Operating System</h1>
                <p className="text-sm text-gray-500">LP Pipeline → Sourcing → Deal Funnel → Deal Analysis → Portfolio</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onSync}
                className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Sync
              </button>
              {user && (
                <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <button
                    onClick={onLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Browser-Style Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium transition-all flex items-center gap-2 border-b-[3px] ${
              activeTab === tab.id
                ? 'text-[#E63424] bg-white border-[#E63424]'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === tab.id
                ? 'bg-red-100 text-[#E63424]'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
