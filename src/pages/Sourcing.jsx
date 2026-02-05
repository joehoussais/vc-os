import { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { dealsData, coverageTimeSeriesData, chartColors } from '../data/mockData';
import Modal from '../components/Modal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

export default function Sourcing({ dealState, setDealState, showToast }) {
  const [filters, setFilters] = useState({
    country: 'all',
    stage: 'all',
    from: 'Q1 2025',
    to: 'Q4 2025',
    show: 'all'
  });
  const [selectedDeal, setSelectedDeal] = useState(null);

  const filteredDeals = dealsData.map(d => ({
    ...d,
    inScope: dealState[d.id]?.inScope ?? d.inScope,
    seen: dealState[d.id]?.seen ?? d.seen
  })).filter(d => {
    if (filters.country !== 'all' && d.country !== filters.country) return false;
    if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
    if (filters.show === 'in-scope' && !d.inScope) return false;
    if (filters.show === 'unseen' && (!d.inScope || d.seen)) return false;
    return true;
  }).sort((a, b) => {
    const [aq, ay] = [parseInt(a.date.slice(1,2)), parseInt(a.date.slice(-4))];
    const [bq, by] = [parseInt(b.date.slice(1,2)), parseInt(b.date.slice(-4))];
    return (by * 4 + bq) - (ay * 4 + aq);
  });

  const inScopeCount = filteredDeals.filter(d => d.inScope).length;
  const seenCount = filteredDeals.filter(d => d.inScope && d.seen).length;
  const coverage = inScopeCount > 0 ? Math.round((seenCount / inScopeCount) * 100) : 0;

  const toggleDealState = (dealId, field) => {
    const current = dealState[dealId] || { ...dealsData.find(d => d.id === dealId) };
    const newState = { ...current, [field]: !current[field] };
    setDealState({ ...dealState, [dealId]: newState });
    showToast(`Updated ${field === 'inScope' ? 'scope' : 'seen'} status`);
  };

  const timeSeriesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { min: 50, max: 105, ticks: { callback: v => v + '%' } } }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
  };

  return (
    <div className="animate-in">
      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Country</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424] focus:ring-2 focus:ring-red-100"
            >
              <option value="all">All Countries</option>
              <option value="France">France</option>
              <option value="Germany">Germany</option>
              <option value="Nordics">Nordics</option>
              <option value="Southern Europe">Southern Europe</option>
              <option value="Eastern Europe">Eastern Europe</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Stage</label>
            <select
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424] focus:ring-2 focus:ring-red-100"
            >
              <option value="all">All Stages</option>
              <option value="Seed">Seed</option>
              <option value="Series A">Series A</option>
              <option value="Series B">Series B</option>
              <option value="Series C">Series C</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
            <select
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424] focus:ring-2 focus:ring-red-100"
            >
              <option value="Q1 2021">Q1 2021</option>
              <option value="Q1 2022">Q1 2022</option>
              <option value="Q1 2023">Q1 2023</option>
              <option value="Q1 2024">Q1 2024</option>
              <option value="Q1 2025">Q1 2025</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
            <select
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424] focus:ring-2 focus:ring-red-100"
            >
              <option value="Q4 2025">Q4 2025</option>
              <option value="Q3 2025">Q3 2025</option>
              <option value="Q2 2025">Q2 2025</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Show</label>
            <select
              value={filters.show}
              onChange={(e) => setFilters({ ...filters, show: e.target.value })}
              className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424] focus:ring-2 focus:ring-red-100"
            >
              <option value="all">All Deals</option>
              <option value="in-scope">In Scope Only</option>
              <option value="unseen">Unseen Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Section: Graph LEFT, Deals RIGHT */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* LEFT: Coverage Time Series */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Coverage Rate</h3>
              <p className="text-xs text-gray-500">2020 - Q3 2025</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-[#E63424]">86%</span>
              <span className="text-sm text-gray-500 block">Q3 2025</span>
            </div>
          </div>
          <div className="h-80">
            <Line
              data={{
                labels: coverageTimeSeriesData.labels,
                datasets: [{
                  label: 'Coverage %',
                  data: coverageTimeSeriesData.data,
                  borderColor: chartColors.rrwRed,
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 4,
                  pointBackgroundColor: chartColors.rrwRed
                }]
              }}
              options={timeSeriesOptions}
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">% of deals in RRW scope announced during the period received by RRW</p>
        </div>

        {/* RIGHT: Recent Deals */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent Deals</h3>
              <p className="text-sm text-gray-500">{filteredDeals.length} deals · {inScopeCount} in scope · {coverage}% coverage</p>
            </div>
            <button className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
              Export
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden flex-1 max-h-96 overflow-y-auto">
            {filteredDeals.map(deal => {
              const state = dealState[deal.id] || { inScope: deal.inScope, seen: deal.seen };
              const ratingColor = deal.rating >= 7 ? 'text-emerald-600' : deal.rating >= 4 ? 'text-amber-600' : deal.rating ? 'text-red-600' : 'text-gray-300';
              const outcomeStyle = deal.outcome === 'DD' || deal.outcome === 'IC' ? 'bg-blue-100 text-blue-700' :
                                   deal.outcome === 'Missed' ? 'bg-red-100 text-red-700' :
                                   deal.outcome === 'Passed' ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400';
              return (
                <div
                  key={deal.id}
                  className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{deal.company}</span>
                      <span className="text-xs text-gray-400">{deal.country}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${outcomeStyle}`}>{deal.outcome}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{deal.stage}</span>
                      <span className="text-gray-500">€{deal.amount}M</span>
                      <span className="text-gray-400">{deal.date}</span>
                    </div>
                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleDealState(deal.id, 'inScope')}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                            state.inScope ? 'bg-[#E63424] border-[#E63424] text-white' : 'border-gray-300'
                          }`}
                        >
                          {state.inScope && '✓'}
                        </button>
                        <span className="text-xs text-gray-400">Scope</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleDealState(deal.id, 'seen')}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                            state.seen ? 'bg-[#E63424] border-[#E63424] text-white' : 'border-gray-300'
                          }`}
                        >
                          {state.seen && '✓'}
                        </button>
                        <span className="text-xs text-gray-400">Seen</span>
                      </div>
                      <span className={`font-bold ${ratingColor} min-w-[40px] text-right`}>
                        {deal.rating ? deal.rating + '/10' : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="border-t border-gray-200 pt-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Analytics</h3>
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Dealflow by country</h4>
          <div className="h-48">
            <Pie
              data={{
                labels: ['France', 'Germany', 'Nordics', 'S. Europe', 'E. Europe', 'Other'],
                datasets: [{ data: [50, 14, 8, 6, 8, 14], backgroundColor: chartColors.colors }]
              }}
              options={pieOptions}
            />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Dealflow by stage</h4>
          <div className="h-48">
            <Pie
              data={{
                labels: ['Series A', 'Seed', 'Series B', 'Series C'],
                datasets: [{ data: [58, 25, 12, 5], backgroundColor: chartColors.colors }]
              }}
              options={pieOptions}
            />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Dealflow by source</h4>
          <div className="h-48">
            <Pie
              data={{
                labels: ['Proactive', 'Intermediate', 'VC Network', 'Inbound', 'Other'],
                datasets: [{ data: [40, 26, 18, 12, 4], backgroundColor: chartColors.colors }]
              }}
              options={pieOptions}
            />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">EU deal coverage</h4>
          <div className="h-48">
            <Pie
              data={{
                labels: ['Received', 'Contacted', 'On radar', 'Not ID'],
                datasets: [{ data: [50, 37, 13, 0], backgroundColor: [chartColors.rrwRed, '#6B7280', '#D1D5DB', '#F3F4F6'] }]
              }}
              options={pieOptions}
            />
          </div>
        </div>
      </div>

      {/* Cold Outreach Effectiveness */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Cold Outreach Effectiveness</h3>
            <p className="text-sm text-gray-500">Tracking proactive emails → coverage impact</p>
          </div>
          <span className="px-3 py-1 rounded-md bg-blue-100 text-blue-700 text-sm font-medium">Slack MCP Integration</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b">
              <th className="pb-3">Team Member</th>
              <th className="pb-3">Emails Sent</th>
              <th className="pb-3">Responses</th>
              <th className="pb-3">Meetings</th>
              <th className="pb-3">Coverage Impact</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 font-medium">Joseph</td>
              <td className="py-3">45</td>
              <td className="py-3">12 (27%)</td>
              <td className="py-3">8</td>
              <td className="py-3"><span className="text-emerald-600 font-medium">+3.2%</span></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 font-medium">Chloe</td>
              <td className="py-3">62</td>
              <td className="py-3">18 (29%)</td>
              <td className="py-3">11</td>
              <td className="py-3"><span className="text-emerald-600 font-medium">+4.1%</span></td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 font-medium">Olivier</td>
              <td className="py-3">38</td>
              <td className="py-3">14 (37%)</td>
              <td className="py-3">9</td>
              <td className="py-3"><span className="text-emerald-600 font-medium">+2.8%</span></td>
            </tr>
            <tr>
              <td className="py-3 font-bold">Total</td>
              <td className="py-3 font-bold">145</td>
              <td className="py-3 font-bold">44 (30%)</td>
              <td className="py-3 font-bold">28</td>
              <td className="py-3"><span className="text-emerald-600 font-bold">+10.1%</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Deal Modal */}
      <Modal isOpen={!!selectedDeal} onClose={() => setSelectedDeal(null)}>
        {selectedDeal && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedDeal.company}</h2>
                <p className="text-sm text-gray-500">{selectedDeal.country} · {selectedDeal.stage} · €{selectedDeal.amount}M</p>
              </div>
              <button onClick={() => setSelectedDeal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Announced</div>
                <div className="font-bold">{selectedDeal.date}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Source</div>
                <div className="font-bold">{selectedDeal.source || 'Unknown'}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Rating</div>
                <div className={`font-bold ${selectedDeal.rating >= 7 ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {selectedDeal.rating ? selectedDeal.rating + '/10' : 'Not rated'}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Outcome</div>
                <div className="font-bold">{selectedDeal.outcome}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedDeal(null)}
              className="w-full bg-[#E63424] text-white py-3 rounded-lg font-medium hover:bg-[#C42A1D] transition-colors"
            >
              {selectedDeal.seen ? 'View Full Assessment' : 'Mark as Seen'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
