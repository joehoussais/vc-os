import { useState } from 'react';
import { funnelData, dealsData } from '../data/mockData';
import Modal from '../components/Modal';

const sourceFilters = [
  { id: 'all', label: 'All Sources' },
  { id: 'proactive', label: 'Proactive' },
  { id: 'vc_network', label: 'VC Network' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'banker', label: 'Banker' },
];

export default function DealFunnel() {
  const [currentSource, setCurrentSource] = useState('all');
  const [selectedStage, setSelectedStage] = useState(null);
  const [period, setPeriod] = useState('all');

  const counts = funnelData.counts[currentSource];
  const stages = funnelData.stages;

  const maxWidth = 100;
  const minWidth = 25;
  const widthStep = (maxWidth - minWidth) / (stages.length - 1);

  const overallConversion = ((counts.invested / counts.universe) * 100).toFixed(2);

  // Calculate conversion metrics
  const conversionMetrics = stages.slice(1).map((stage, i) => {
    const from = stages[i];
    const rate = Math.round((counts[stage.id] / counts[from.id]) * 100);
    return { from: from.name, to: stage.name, rate };
  });

  // Calculate drop-offs
  const dropoffs = stages.slice(1).map((stage, i) => {
    const from = stages[i];
    const dropoffRate = 100 - Math.round((counts[stage.id] / counts[from.id]) * 100);
    const dropoffCount = counts[from.id] - counts[stage.id];
    const key = `${from.id}→${stage.id}`;
    const reasons = funnelData.dropoffReasons[key] || {};
    return { from: from.name, to: stage.name, rate: dropoffRate, count: dropoffCount, reasons };
  }).sort((a, b) => b.rate - a.rate).slice(0, 3);

  const selectedStageData = selectedStage ? {
    stage: stages.find(s => s.id === selectedStage),
    deals: funnelData.dealsByStage[selectedStage] || [],
    count: counts[selectedStage]
  } : null;

  return (
    <div className="animate-in">
      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Source:</span>
            <div className="flex gap-2">
              {sourceFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setCurrentSource(filter.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    currentSource === filter.id
                      ? 'bg-[#E63424] border-[#E63424] text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-[#E63424] hover:text-[#E63424]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
            >
              <option value="12">Last 12 months</option>
              <option value="24">Last 24 months</option>
              <option value="all">Since inception</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Funnel + Metrics */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* LEFT: The Funnel (2 cols) */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Deal Flow Conversion Funnel</h3>
              <p className="text-sm text-gray-500">Click any stage to see deals</p>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">Overall conversion</span>
              <span className="text-2xl font-bold block text-[#E63424]">{overallConversion}%</span>
            </div>
          </div>

          <div className="py-5">
            {stages.map((stage, index) => {
              const count = counts[stage.id];
              const width = maxWidth - (widthStep * index);
              const prevCount = index > 0 ? counts[stages[index - 1].id] : count;
              const conversionRate = index > 0 ? Math.round((count / prevCount) * 100) : 100;

              return (
                <div key={stage.id}>
                  {/* Conversion arrow */}
                  {index > 0 && (
                    <div className="flex items-center justify-center gap-3 py-2 text-gray-400 text-xs">
                      <div className="h-px bg-gray-200 flex-1 max-w-[60px]" />
                      <span>{conversionRate}% converted</span>
                      <div className="h-px bg-gray-200 flex-1 max-w-[60px]" />
                    </div>
                  )}

                  {/* Stage */}
                  <div
                    onClick={() => setSelectedStage(stage.id)}
                    className={`mx-auto mb-2 px-6 py-4 text-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg rounded ${
                      selectedStage === stage.id ? 'ring-3 ring-[#E63424] ring-offset-2' : ''
                    }`}
                    style={{
                      width: `${width}%`,
                      background: `linear-gradient(135deg, ${getFunnelColor(index, 0)} 0%, ${getFunnelColor(index, 1)} 100%)`,
                      clipPath: 'polygon(0 0, 100% 0, calc(100% - 20px) 100%, 20px 100%)'
                    }}
                    title={stage.description}
                  >
                    <div className={`font-semibold text-sm ${index < 2 ? 'text-red-900' : 'text-white'}`} style={{ textShadow: index >= 2 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                      {stage.name}
                    </div>
                    <div className={`text-2xl font-bold ${index < 2 ? 'text-red-900' : 'text-white'}`} style={{ textShadow: index >= 2 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                      {count.toLocaleString()}
                    </div>
                    <div className={`text-xs ${index < 2 ? 'text-red-700' : 'text-white/85'}`}>
                      {index > 0 ? `${conversionRate}% of previous` : 'Total in scope'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Metrics Sidebar */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Conversion Rates</h3>
          <div className="space-y-0">
            {conversionMetrics.map((metric, i) => {
              const rateColor = metric.rate >= 40 ? 'text-emerald-600' : metric.rate >= 20 ? 'text-amber-600' : 'text-red-600';
              return (
                <div key={i} className="flex justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{metric.from.split(' ')[0]} → {metric.to.split(' ')[0]}</span>
                  <span className={`font-semibold ${rateColor}`}>{metric.rate}%</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-200 mt-4 pt-4">
            <h4 className="font-medium text-gray-700 mb-3">Key Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg. time to IC</span>
                <span className="font-semibold">47 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg. time to close</span>
                <span className="font-semibold">68 days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Best source</span>
                <span className="font-semibold text-emerald-600">VC Network</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drop-off Analysis */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Biggest Drop-offs</h3>
        <div className="space-y-3">
          {dropoffs.map((d, i) => {
            const topReasons = Object.entries(d.reasons)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([reason, pct]) => `${reason} (${pct}%)`)
              .join(', ');

            return (
              <div
                key={i}
                className={`rounded-lg p-4 border ${d.rate >= 70 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{d.from} → {d.to}</span>
                  <span className="font-bold text-red-600">{d.rate}% drop-off</span>
                </div>
                <div className="text-sm text-gray-600">
                  {d.count.toLocaleString()} deals lost · Top reasons: {topReasons || 'Not tracked'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{selectedStageData.stage.name}</h3>
              <p className="text-sm text-gray-500">{selectedStageData.count.toLocaleString()} companies at this stage</p>
            </div>
            <button onClick={() => setSelectedStage(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {selectedStageData.deals.length > 0 ? (
              selectedStageData.deals.map((company, i) => {
                const deal = dealsData.find(d => d.company === company) || {};
                return (
                  <div key={i} className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">{company}</span>
                        {deal.country && <span className="text-xs text-gray-400 ml-2">{deal.country}</span>}
                      </div>
                      {deal.rating && <span className="font-bold text-emerald-600">{deal.rating}/10</span>}
                    </div>
                    {deal.stage && <div className="text-xs text-gray-500 mt-1">{deal.stage} · €{deal.amount}M</div>}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>Sample data shown</p>
                <p className="text-sm">Connect to Attio CRM for real deal data</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getFunnelColor(index, variant) {
  const colors = [
    ['#FEE2E2', '#FECACA'],
    ['#FECACA', '#FCA5A5'],
    ['#FCA5A5', '#F87171'],
    ['#F87171', '#EF4444'],
    ['#EF4444', '#DC2626'],
    ['#DC2626', '#B91C1C'],
    ['#B91C1C', '#991B1B'],
    ['#991B1B', '#7F1D1D'],
  ];
  return colors[index]?.[variant] || colors[colors.length - 1][variant];
}
