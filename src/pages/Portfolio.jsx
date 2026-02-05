import { useState } from 'react';
import { portfolioData } from '../data/mockData';
import Modal from '../components/Modal';

function getRunwayColor(months) {
  if (months <= 6) return { dot: 'bg-red-500', border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700' };
  if (months <= 12) return { dot: 'bg-amber-500', border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-700' };
  return { dot: 'bg-emerald-500', border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700' };
}

export default function Portfolio() {
  const [sortBy, setSortBy] = useState('runway-asc');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState(null);

  let displayedData = [...portfolioData];

  // Apply filter
  if (filterBy === 'us-active') displayedData = displayedData.filter(c => c.usExpansion === 'active');
  else if (filterBy === 'us-planned') displayedData = displayedData.filter(c => c.usExpansion === 'planned');
  else if (filterBy === 'eu-only') displayedData = displayedData.filter(c => c.usExpansion === 'none');
  else if (filterBy === 'critical') displayedData = displayedData.filter(c => c.runway <= 6);
  else if (filterBy === 'at-risk') displayedData = displayedData.filter(c => c.runway <= 6 && !c.canRaise);

  // Apply sort
  if (sortBy === 'runway-asc') displayedData.sort((a, b) => a.runway - b.runway);
  else if (sortBy === 'runway-desc') displayedData.sort((a, b) => b.runway - a.runway);
  else if (sortBy === 'ownership') displayedData.sort((a, b) => (b.ownership || 0) - (a.ownership || 0));

  const criticalCount = portfolioData.filter(c => c.runway <= 6).length;
  const atRiskCount = portfolioData.filter(c => c.runway <= 6 && !c.canRaise).length;
  const totalInvested = portfolioData.reduce((sum, c) => sum + (c.invested || 0), 0);
  const avgOwnership = portfolioData.reduce((sum, c) => sum + (c.ownership || 0), 0) / portfolioData.filter(c => c.ownership).length;

  return (
    <div className="animate-in">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          onClick={() => setFilterBy(filterBy === 'critical' ? 'all' : 'critical')}
          className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
            filterBy === 'critical' ? 'border-[#E63424] shadow-md' : 'border-gray-200 hover:border-[#E63424] hover:shadow-md'
          }`}
        >
          <div className="text-sm text-gray-500 mb-1">Critical Runway</div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          <div className="text-xs text-gray-400">≤ 6 months</div>
        </div>
        <div
          onClick={() => setFilterBy(filterBy === 'at-risk' ? 'all' : 'at-risk')}
          className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
            filterBy === 'at-risk' ? 'border-[#E63424] shadow-md' : 'border-gray-200 hover:border-[#E63424] hover:shadow-md'
          }`}
        >
          <div className="text-sm text-gray-500 mb-1">At Risk</div>
          <div className="text-2xl font-bold text-amber-600">{atRiskCount}</div>
          <div className="text-xs text-gray-400">No destiny control</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500 mb-1">Total Invested</div>
          <div className="text-2xl font-bold text-gray-900">€{totalInvested.toFixed(1)}M</div>
          <div className="text-xs text-gray-400">Across {portfolioData.length} companies</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500 mb-1">Avg Ownership</div>
          <div className="text-2xl font-bold text-gray-900">{avgOwnership.toFixed(1)}%</div>
          <div className="text-xs text-gray-400">Fully diluted</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
          >
            <option value="runway-asc">Shortest Runway</option>
            <option value="runway-desc">Longest Runway</option>
            <option value="ownership">Highest Ownership</option>
          </select>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
          >
            <option value="all">All Companies</option>
            <option value="us-active">US Active</option>
            <option value="us-planned">US Planned</option>
            <option value="eu-only">EU Only</option>
          </select>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-500">≤6mo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-gray-500">6-12mo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-gray-500">&gt;12mo</span>
          </div>
        </div>
      </div>

      {/* Company Grid */}
      <div className="grid grid-cols-3 gap-4">
        {displayedData.map(company => {
          const colors = getRunwayColor(company.runway);
          const trend = company.runwayTrend === 'up' ? '↑' : company.runwayTrend === 'down' ? '↓' : '→';
          const trendColor = company.runwayTrend === 'up' ? 'text-emerald-600' : company.runwayTrend === 'down' ? 'text-red-600' : 'text-gray-400';

          return (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className={`bg-white rounded-xl p-4 border-2 ${colors.border} cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all`}
            >
              <div className="flex justify-between mb-3">
                <div>
                  <div className="font-semibold">{company.name}</div>
                  <div className="text-xs text-gray-500">{company.sector} · {company.stage}</div>
                </div>
                <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
              </div>
              <div className={`${colors.bg} rounded-lg p-3 mb-3`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Runway</span>
                  <span className={`${colors.text} text-xl font-bold`}>
                    {company.runway}mo <span className={trendColor}>{trend}</span>
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">€{company.cashPosition}M · €{company.burn}M/mo</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ownership</span>
                  <span className="font-medium">{company.ownership ? company.ownership + '%' : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invested</span>
                  <span className="font-medium">{company.invested ? '€' + company.invested + 'M' : '—'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Company Modal */}
      <Modal isOpen={!!selectedCompany} onClose={() => setSelectedCompany(null)}>
        {selectedCompany && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedCompany.name}</h2>
                <p className="text-sm text-gray-500">{selectedCompany.sector} · {selectedCompany.stage}</p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className={`${getRunwayColor(selectedCompany.runway).bg} rounded-lg p-4 mb-6`}>
              <div className="flex justify-between">
                <div>
                  <span className="text-sm text-gray-600">Runway</span>
                  <div className={`${getRunwayColor(selectedCompany.runway).text} text-3xl font-bold`}>
                    {selectedCompany.runway} months
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Cash</div>
                <div className="text-xl font-bold">€{selectedCompany.cashPosition}M</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Burn</div>
                <div className="text-xl font-bold">€{selectedCompany.burn}M/mo</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Ownership</div>
                <div className="text-xl font-bold">{selectedCompany.ownership || '—'}%</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Invested</div>
                <div className="text-xl font-bold">€{selectedCompany.invested || '—'}M</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedCompany(null)}
              className="w-full bg-[#E63424] text-white py-3 rounded-lg font-medium hover:bg-[#C42A1D] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
