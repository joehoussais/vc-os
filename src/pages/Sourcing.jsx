import { useState, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import { coverageTimeSeriesData, chartColors, calculateCoverageByCountry } from '../data/attioData';
import { useAttioDeals } from '../hooks/useAttioDeals';
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
  const { deals: attioDeals, loading: attioLoading, error: attioError, isLive } = useAttioDeals();

  // Merge local state with Attio data
  const deals = useMemo(() => {
    return attioDeals.map(d => ({
      ...d,
      inScope: dealState[d.id]?.inScope ?? d.inScope,
      seen: dealState[d.id]?.seen ?? d.seen
    }));
  }, [dealState, attioDeals]);

  // Apply filters
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (filters.show === 'in-scope' && !d.inScope) return false;
      if (filters.show === 'unseen' && (!d.inScope || d.seen)) return false;
      return true;
    }).sort((a, b) => {
      // Sort by announced date descending
      return new Date(b.announcedDate) - new Date(a.announcedDate);
    });
  }, [deals, filters]);

  // Calculate coverage stats
  const stats = useMemo(() => {
    const filtered = deals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      return true;
    });
    const inScopeCount = filtered.filter(d => d.inScope).length;
    const seenCount = filtered.filter(d => d.inScope && d.seen).length;
    const coverage = inScopeCount > 0 ? Math.round((seenCount / inScopeCount) * 100) : 0;
    return { total: filtered.length, inScope: inScopeCount, seen: seenCount, coverage };
  }, [deals, filters]);

  // Calculate coverage by country for pie chart
  const coverageByCountry = useMemo(() => calculateCoverageByCountry(deals), [deals]);

  // Calculate pie chart data
  const pieData = useMemo(() => {
    const countryData = Object.entries(coverageByCountry)
      .filter(([_, v]) => v.total > 0)
      .map(([k, v]) => ({ label: k, value: v.total }));

    const stageData = {};
    deals.forEach(d => {
      stageData[d.stage] = (stageData[d.stage] || 0) + 1;
    });

    const sourceData = {};
    deals.filter(d => d.seen).forEach(d => {
      const source = d.source || 'Unknown';
      sourceData[source] = (sourceData[source] || 0) + 1;
    });

    return { countryData, stageData, sourceData };
  }, [deals, coverageByCountry]);

  const toggleDealState = (dealId, field) => {
    const deal = deals.find(d => d.id === dealId);
    const current = dealState[dealId] || { inScope: deal.inScope, seen: deal.seen };
    const newState = { ...current, [field]: !current[field] };
    setDealState({ ...dealState, [dealId]: newState });
    showToast(`Updated ${field === 'inScope' ? 'scope' : 'seen'} status`);
  };

  const timeSeriesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        min: 50,
        max: 105,
        ticks: {
          callback: v => v + '%',
          color: 'var(--text-tertiary)'
        },
        grid: { color: 'var(--border-subtle)' }
      },
      x: {
        ticks: { color: 'var(--text-tertiary)' },
        grid: { color: 'var(--border-subtle)' }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          font: { size: 10 },
          color: 'var(--text-secondary)'
        }
      }
    }
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <FilterSelect
            label="Country"
            value={filters.country}
            onChange={(v) => setFilters({ ...filters, country: v })}
            options={[
              { value: 'all', label: 'All Countries' },
              { value: 'France', label: 'France' },
              { value: 'Germany', label: 'Germany & Benelux' },
              { value: 'Nordics', label: 'Nordics' },
              { value: 'Southern Europe', label: 'Southern Europe' },
              { value: 'Eastern Europe', label: 'Eastern Europe' },
              { value: 'Other', label: 'Other (UK, etc.)' },
            ]}
          />
          <FilterSelect
            label="Stage"
            value={filters.stage}
            onChange={(v) => setFilters({ ...filters, stage: v })}
            options={[
              { value: 'all', label: 'All Stages' },
              { value: 'Pre-Seed', label: 'Pre-Seed' },
              { value: 'Seed', label: 'Seed' },
              { value: 'Series A', label: 'Series A' },
              { value: 'Series B', label: 'Series B' },
              { value: 'Series C', label: 'Series C' },
              { value: 'Venture', label: 'Venture' },
            ]}
          />
          <FilterSelect
            label="Show"
            value={filters.show}
            onChange={(v) => setFilters({ ...filters, show: v })}
            options={[
              { value: 'all', label: 'All Deals' },
              { value: 'in-scope', label: 'In Scope Only' },
              { value: 'unseen', label: 'Unseen Only' },
            ]}
          />
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="text-[var(--text-tertiary)]">
              {stats.total} deals · {stats.inScope} in scope
            </span>
            <span className="px-2 py-1 rounded-md bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)] font-semibold">
              {stats.coverage}% coverage
            </span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Coverage Chart */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Coverage Rate</h3>
              <p className="text-xs text-[var(--text-tertiary)]">Historical coverage over time</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-[var(--rrw-red)]">{stats.coverage}%</span>
              <span className="text-xs text-[var(--text-tertiary)] block">Current</span>
            </div>
          </div>
          <div className="h-72">
            <Line
              data={{
                labels: coverageTimeSeriesData.labels,
                datasets: [{
                  label: 'Coverage %',
                  data: coverageTimeSeriesData.data,
                  borderColor: chartColors.rrwRed,
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 3,
                  pointBackgroundColor: chartColors.rrwRed
                }]
              }}
              options={timeSeriesOptions}
            />
          </div>
        </div>

        {/* Recent Deals */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Deal Coverage</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {filteredDeals.length} deals shown · Mark as seen to update coverage
              </p>
            </div>
            <span className={`px-2 py-1 rounded text-[11px] font-medium ${
              attioLoading ? 'bg-amber-500/10 text-amber-500' :
              isLive ? 'bg-emerald-500/10 text-emerald-500' :
              'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            }`}>
              {attioLoading ? 'Syncing...' : isLive ? 'Attio Live' : 'Attio (Static)'}
            </span>
          </div>
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden flex-1 max-h-80 overflow-y-auto">
            {filteredDeals.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-tertiary)]">
                No deals match your filters
              </div>
            ) : (
              filteredDeals.map(deal => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  onToggle={toggleDealState}
                  onClick={() => setSelectedDeal(deal)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Coverage by Country */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Coverage by Region</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(coverageByCountry).map(([region, data]) => (
            <CoverageCard key={region} region={region} data={data} />
          ))}
        </div>
      </div>

      {/* Analytics */}
      <div className="border-t border-[var(--border-default)] pt-4 mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Analytics</h3>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <PieCard
          title="Dealflow by region"
          labels={Object.keys(coverageByCountry)}
          data={Object.values(coverageByCountry).map(v => v.total)}
          options={pieOptions}
        />
        <PieCard
          title="Dealflow by stage"
          labels={Object.keys(pieData.stageData)}
          data={Object.values(pieData.stageData)}
          options={pieOptions}
        />
        <PieCard
          title="Seen deals by source"
          labels={Object.keys(pieData.sourceData)}
          data={Object.values(pieData.sourceData)}
          options={pieOptions}
        />
        <PieCard
          title="Coverage breakdown"
          labels={['Seen (In Scope)', 'Not Seen (In Scope)', 'Out of Scope']}
          data={[
            deals.filter(d => d.inScope && d.seen).length,
            deals.filter(d => d.inScope && !d.seen).length,
            deals.filter(d => !d.inScope).length,
          ]}
          colors={[chartColors.rrwRed, '#6B7280', '#D1D5DB']}
          options={pieOptions}
        />
      </div>

      {/* Cold Outreach */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Cold Outreach Effectiveness</h3>
            <p className="text-xs text-[var(--text-tertiary)]">Tracking proactive emails → coverage impact</p>
          </div>
          <span className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500/10 text-blue-500">Slack MCP</span>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-[var(--text-tertiary)] uppercase border-b border-[var(--border-default)]">
              <th className="pb-3 font-medium">Team Member</th>
              <th className="pb-3 font-medium">Emails Sent</th>
              <th className="pb-3 font-medium">Responses</th>
              <th className="pb-3 font-medium">Meetings</th>
              <th className="pb-3 font-medium">Coverage Impact</th>
            </tr>
          </thead>
          <tbody className="text-[var(--text-primary)]">
            <OutreachRow name="Joseph" sent={45} responses="12 (27%)" meetings={8} impact="+3.2%" />
            <OutreachRow name="Chloe" sent={62} responses="18 (29%)" meetings={11} impact="+4.1%" />
            <OutreachRow name="Olivier" sent={38} responses="14 (37%)" meetings={9} impact="+2.8%" />
            <OutreachRow name="Total" sent={145} responses="44 (30%)" meetings={28} impact="+10.1%" isTotal />
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Modal isOpen={!!selectedDeal} onClose={() => setSelectedDeal(null)}>
        {selectedDeal && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {selectedDeal.logoUrl && (
                  <img
                    src={selectedDeal.logoUrl}
                    alt={selectedDeal.company}
                    className="w-12 h-12 rounded-lg object-contain bg-[var(--bg-tertiary)]"
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedDeal.company}</h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {selectedDeal.country} · {selectedDeal.stage} · €{selectedDeal.amount}M
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedDeal(null)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedDeal.description && (
              <p className="text-[13px] text-[var(--text-secondary)] mb-4">
                {selectedDeal.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              <InfoCard label="Announced" value={selectedDeal.date} />
              <InfoCard label="Total Funding" value={selectedDeal.totalFunding || '—'} />
              <InfoCard label="Team Size" value={selectedDeal.employeeRange || '—'} />
              <InfoCard label="Source" value={selectedDeal.source || 'Unknown'} />
              <InfoCard label="Rating" value={selectedDeal.rating ? selectedDeal.rating + '/10' : 'Not rated'} highlight={selectedDeal.rating >= 7} />
              <InfoCard label="Outcome" value={selectedDeal.outcome} />
            </div>

            {selectedDeal.industry?.length > 0 && (
              <div className="mb-6">
                <div className="text-[11px] text-[var(--text-tertiary)] mb-2">Industries</div>
                <div className="flex flex-wrap gap-2">
                  {selectedDeal.industry.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  toggleDealState(selectedDeal.id, 'seen');
                  setSelectedDeal({ ...selectedDeal, seen: !selectedDeal.seen });
                }}
                className={`flex-1 h-10 font-medium rounded-lg transition-colors ${
                  selectedDeal.seen
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    : 'bg-[var(--rrw-red)] hover:bg-[var(--rrw-red-hover)] text-white'
                }`}
              >
                {selectedDeal.seen ? 'Mark as Not Seen' : 'Mark as Seen'}
              </button>
              <button
                onClick={() => {
                  toggleDealState(selectedDeal.id, 'inScope');
                  setSelectedDeal({ ...selectedDeal, inScope: !selectedDeal.inScope });
                }}
                className="flex-1 h-10 bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] font-medium rounded-lg transition-colors"
              >
                {selectedDeal.inScope ? 'Mark Out of Scope' : 'Mark In Scope'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Components
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)] transition-colors"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function DealRow({ deal, onToggle, onClick }) {
  const ratingColor = deal.rating >= 7 ? 'text-emerald-500' : deal.rating >= 4 ? 'text-amber-500' : deal.rating ? 'text-red-500' : 'text-[var(--text-quaternary)]';
  const outcomeStyle = deal.outcome === 'DD' || deal.outcome === 'IC' ? 'bg-blue-500/10 text-blue-500' :
                       deal.outcome === 'Missed' ? 'bg-red-500/10 text-red-500' :
                       deal.outcome === 'Passed' ? 'bg-[var(--bg-hover)] text-[var(--text-secondary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]';

  return (
    <div
      className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {deal.logoUrl && (
            <img src={deal.logoUrl} alt="" className="w-5 h-5 rounded object-contain bg-[var(--bg-tertiary)]" />
          )}
          <span className="font-medium text-[var(--text-primary)]">{deal.company}</span>
          <span className="text-[11px] text-[var(--text-tertiary)]">{deal.country}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${outcomeStyle}`}>{deal.outcome}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">{deal.stage}</span>
          <span className="text-[var(--text-tertiary)]">€{deal.amount}M</span>
          <span className="text-[var(--text-quaternary)]">{deal.date}</span>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={deal.inScope} onChange={() => onToggle(deal.id, 'inScope')} label="Scope" />
          <Checkbox checked={deal.seen} onChange={() => onToggle(deal.id, 'seen')} label="Seen" />
          <span className={`font-semibold text-[13px] ${ratingColor} min-w-[36px] text-right`}>
            {deal.rating ? deal.rating + '/10' : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onChange}
        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
          checked
            ? 'bg-[var(--rrw-red)] border-[var(--rrw-red)]'
            : 'border-[var(--border-strong)] hover:border-[var(--rrw-red)]'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

function CoverageCard({ region, data }) {
  const coverageColor = data.coverage >= 80 ? 'text-emerald-500' :
                        data.coverage >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-1">{region}</div>
      <div className={`text-xl font-bold ${coverageColor}`}>{data.coverage}%</div>
      <div className="text-[11px] text-[var(--text-quaternary)]">
        {data.seen}/{data.inScope} seen
      </div>
    </div>
  );
}

function PieCard({ title, labels, data, colors, options }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
      <h4 className="text-[13px] font-medium text-[var(--text-primary)] mb-3">{title}</h4>
      <div className="h-40">
        <Pie
          data={{
            labels,
            datasets: [{ data, backgroundColor: colors || chartColors.colors }]
          }}
          options={options}
        />
      </div>
    </div>
  );
}

function OutreachRow({ name, sent, responses, meetings, impact, isTotal }) {
  return (
    <tr className={`border-b border-[var(--border-subtle)] ${isTotal ? 'font-semibold' : ''}`}>
      <td className="py-3">{name}</td>
      <td className="py-3">{sent}</td>
      <td className="py-3">{responses}</td>
      <td className="py-3">{meetings}</td>
      <td className="py-3"><span className="text-emerald-500 font-medium">{impact}</span></td>
    </tr>
  );
}

function InfoCard({ label, value, highlight }) {
  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-0.5">{label}</div>
      <div className={`font-medium ${highlight ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}
