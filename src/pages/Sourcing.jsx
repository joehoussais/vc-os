import { useState, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { chartColors } from '../data/attioData';
import { useAttioDeals } from '../hooks/useAttioDeals';
import { useTheme } from '../hooks/useTheme.jsx';
import Modal from '../components/Modal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Title, Tooltip, Legend);

// Helper to convert "Q1 2025" to a comparable number for sorting/filtering
function quarterToNum(q) {
  if (!q) return 0;
  const match = q.match(/Q(\d)\s+(\d{4})/);
  if (!match) return 0;
  return parseInt(match[2]) * 4 + parseInt(match[1]);
}

// Format a date string like "2025-03-12" to "Mar 2025"
function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Calculate coverage by region from deals
function calculateCoverageByRegion(deals) {
  const regions = ['France', 'Germany', 'Nordics', 'Southern Europe', 'Eastern Europe', 'Other'];
  const result = {};
  for (const region of regions) {
    const regionDeals = deals.filter(d => d.filterRegion === region);
    const seen = regionDeals.filter(d => d.seen);
    result[region] = {
      total: regionDeals.length,
      seen: seen.length,
      coverage: regionDeals.length > 0 ? Math.round((seen.length / regionDeals.length) * 100) : 0,
    };
  }
  return result;
}

// Outcome badge colors
const OUTCOME_STYLES = {
  'Invested': 'bg-emerald-500/10 text-emerald-500',
  'IC': 'bg-blue-500/10 text-blue-500',
  'DD': 'bg-blue-500/10 text-blue-500',
  'In Pipeline': 'bg-amber-500/10 text-amber-500',
  'Saw': 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
  'Tracked': 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]',
  'Passed': 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  'Missed': 'bg-red-500/10 text-red-500',
};

export default function Sourcing() {
  const { deals: attioDeals, loading: attioLoading, error: attioError, isLive } = useAttioDeals();
  const { theme } = useTheme();

  // Build full quarter range from Q1 2021 to Q1 2026
  const allQuarters = useMemo(() => {
    const quarters = [];
    for (let year = 2021; year <= 2026; year++) {
      const maxQ = year === 2026 ? 1 : 4;
      for (let q = 1; q <= maxQ; q++) {
        quarters.push(`Q${q} ${year}`);
      }
    }
    return quarters;
  }, []);

  const [filters, setFilters] = useState({
    country: 'all',
    stage: 'all',
    from: '',
    to: '',
    show: 'all'
  });
  const [selectedDeal, setSelectedDeal] = useState(null);

  // Default from/to: Q1 2021 → Q1 2026
  const effectiveFrom = filters.from || 'Q1 2021';
  const effectiveTo = filters.to || 'Q1 2026';

  // Apply filters including date range
  const filteredDeals = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    return attioDeals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (filters.show === 'seen' && !d.seen) return false;
      if (filters.show === 'missed' && d.seen) return false;
      if (d.date) {
        const dNum = quarterToNum(d.date);
        if (dNum < fromNum || dNum > toNum) return false;
      }
      return true;
    }).sort((a, b) => {
      return new Date(b.announcedDate) - new Date(a.announcedDate);
    });
  }, [attioDeals, filters, effectiveFrom, effectiveTo]);

  // Calculate coverage stats (also respects date range)
  const stats = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const filtered = attioDeals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (d.date) {
        const dNum = quarterToNum(d.date);
        if (dNum < fromNum || dNum > toNum) return false;
      }
      return true;
    });
    const seenCount = filtered.filter(d => d.seen).length;
    const coverage = filtered.length > 0 ? Math.round((seenCount / filtered.length) * 100) : 0;
    return { total: filtered.length, seen: seenCount, coverage };
  }, [attioDeals, filters, effectiveFrom, effectiveTo]);

  // Calculate coverage by region
  const coverageByRegion = useMemo(() => calculateCoverageByRegion(attioDeals), [attioDeals]);

  // Calculate pie chart data
  const pieData = useMemo(() => {
    const stageData = {};
    const outcomeData = {};
    attioDeals.forEach(d => {
      stageData[d.stage] = (stageData[d.stage] || 0) + 1;
      outcomeData[d.outcome] = (outcomeData[d.outcome] || 0) + 1;
    });
    return { stageData, outcomeData };
  }, [attioDeals]);

  // Compute per-quarter stats from real deal data across the full selected range
  const quarterlyData = useMemo(() => {
    // Group deals by quarter
    const byQ = {};
    attioDeals.forEach(d => {
      if (!d.date) return;
      if (!byQ[d.date]) byQ[d.date] = { total: 0, seen: 0 };
      byQ[d.date].total++;
      if (d.seen) byQ[d.date].seen++;
    });

    // Use ALL quarters in range, not just those with data
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const filtered = allQuarters.filter(q => {
      const n = quarterToNum(q);
      return n >= fromNum && n <= toNum;
    });

    const labels = filtered;
    const dealCounts = filtered.map(q => (byQ[q]?.total || 0));
    const coverageRates = filtered.map(q =>
      byQ[q]?.total > 0 ? Math.round((byQ[q].seen / byQ[q].total) * 100) : 0
    );

    // Trailing 4-quarter average on coverage
    const trailing = coverageRates.map((_, i) => {
      if (i < 3) return null;
      const slice = coverageRates.slice(i - 3, i + 1);
      return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    });

    return { labels, dealCounts, coverageRates, trailing };
  }, [attioDeals, effectiveFrom, effectiveTo, allQuarters]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 20,
          boxHeight: 2,
          font: { size: 11 },
          color: 'var(--text-tertiary)',
          usePointStyle: false,
          padding: 16,
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.yAxisID === 'y') return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
            return `${ctx.dataset.label}: ${ctx.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        min: 0,
        max: 100,
        ticks: { callback: v => v + '%', color: 'var(--text-tertiary)' },
        grid: { color: 'var(--border-subtle)' },
        title: { display: false },
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: 0,
        ticks: { color: 'var(--text-tertiary)', precision: 0 },
        grid: { drawOnChartArea: false },
        title: { display: false },
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
            label="From"
            value={effectiveFrom}
            onChange={(v) => setFilters({ ...filters, from: v })}
            options={allQuarters.map(q => ({ value: q, label: q }))}
          />
          <FilterSelect
            label="To"
            value={effectiveTo}
            onChange={(v) => setFilters({ ...filters, to: v })}
            options={allQuarters.map(q => ({ value: q, label: q }))}
          />
          <FilterSelect
            label="Show"
            value={filters.show}
            onChange={(v) => setFilters({ ...filters, show: v })}
            options={[
              { value: 'all', label: 'All Deals' },
              { value: 'seen', label: 'Seen Only' },
              { value: 'missed', label: 'Missed Only' },
            ]}
          />
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="text-[var(--text-tertiary)]">
              {stats.total} deals · {stats.seen} seen
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
            <Bar
              data={{
                labels: quarterlyData.labels,
                datasets: [
                  {
                    type: 'bar',
                    label: 'Deals tracked',
                    data: quarterlyData.dealCounts,
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 3,
                    yAxisID: 'y1',
                    order: 2,
                  },
                  {
                    type: 'line',
                    label: 'Coverage %',
                    data: quarterlyData.coverageRates,
                    borderColor: chartColors.rrwRed,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: chartColors.rrwRed,
                    yAxisID: 'y',
                    order: 0,
                  },
                  {
                    type: 'line',
                    label: '12-mo trailing avg',
                    data: quarterlyData.trailing,
                    borderColor: theme === 'dark' ? '#c2c0b6' : '#141413',
                    backgroundColor: 'transparent',
                    borderDash: [6, 3],
                    borderWidth: 1.5,
                    tension: 0.3,
                    pointRadius: 0,
                    spanGaps: false,
                    yAxisID: 'y',
                    order: 1,
                  },
                ]
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Recent Deals */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Deal Coverage</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {filteredDeals.length} deals · derived from Attio deal & company status
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
                  onClick={() => setSelectedDeal(deal)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Coverage by Region */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Coverage by Region</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(coverageByRegion).map(([region, data]) => (
            <CoverageCard key={region} region={region} data={data} />
          ))}
        </div>
      </div>

      {/* Analytics */}
      <div className="border-t border-[var(--border-default)] pt-4 mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Analytics</h3>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <PieCard
          title="Dealflow by region"
          labels={Object.keys(coverageByRegion)}
          data={Object.values(coverageByRegion).map(v => v.total)}
          options={pieOptions}
        />
        <PieCard
          title="Dealflow by stage"
          labels={Object.keys(pieData.stageData)}
          data={Object.values(pieData.stageData)}
          options={pieOptions}
        />
        <PieCard
          title="Outcome breakdown"
          labels={Object.keys(pieData.outcomeData)}
          data={Object.values(pieData.outcomeData)}
          options={pieOptions}
        />
      </div>

      {/* Outcome Summary */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Outcome Summary</h3>
            <p className="text-xs text-[var(--text-tertiary)]">How deals were handled · derived from Attio status</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(pieData.outcomeData).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
            <div key={outcome} className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-1 ${OUTCOME_STYLES[outcome] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                {outcome}
              </span>
              <div className="text-xl font-bold text-[var(--text-primary)]">{count}</div>
              <div className="text-[11px] text-[var(--text-quaternary)]">
                {attioDeals.length > 0 ? Math.round((count / attioDeals.length) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
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
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedDeal.dealName || selectedDeal.company}</h2>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {selectedDeal.country}{selectedDeal.amount > 0 ? ` · €${selectedDeal.amount}M` : ''}
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
              <InfoCard label="Quarter" value={selectedDeal.date} />
              <InfoCard label="Outcome" value={selectedDeal.outcome} highlight={selectedDeal.outcome === 'Invested' || selectedDeal.outcome === 'IC'} />
              <InfoCard label="Attio Status" value={selectedDeal.status || '—'} />
              <InfoCard label="Rating" value={selectedDeal.rating ? selectedDeal.rating + '/10' : 'Not rated'} highlight={selectedDeal.rating >= 7} />
              <InfoCard label="Total Funding" value={selectedDeal.totalFunding || '—'} />
              <InfoCard label="Team Size" value={selectedDeal.employeeRange || '—'} />
            </div>

            {/* Seen/Coverage status */}
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-2.5 py-1 rounded text-[12px] font-medium ${selectedDeal.seen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {selectedDeal.seen ? 'Seen' : 'Missed'}
              </span>
              {selectedDeal.receivedDate && (
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  Received {formatMonth(selectedDeal.receivedDate)}
                </span>
              )}
            </div>

            {selectedDeal.industry?.length > 0 && (
              <div className="mb-4">
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

function DealRow({ deal, onClick }) {
  const ratingColor = deal.rating >= 7 ? 'text-emerald-500' : deal.rating >= 4 ? 'text-amber-500' : deal.rating ? 'text-red-500' : 'text-[var(--text-quaternary)]';
  const outcomeStyle = OUTCOME_STYLES[deal.outcome] || 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]';

  return (
    <div
      className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {deal.logoUrl && (
            <img src={deal.logoUrl} alt="" className="w-5 h-5 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" />
          )}
          <span className="font-medium text-[var(--text-primary)] truncate">{deal.dealName || deal.company}</span>
          <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{deal.country}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${outcomeStyle}`}>{deal.outcome}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          {deal.amount > 0 && <span className="text-[var(--text-tertiary)]">€{deal.amount}M</span>}
          <span className="text-[var(--text-quaternary)]">{formatMonth(deal.announcedDate) || deal.date}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${deal.seen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
            {deal.seen ? 'Seen' : 'Missed'}
          </span>
          <span className={`font-semibold text-[13px] ${ratingColor} min-w-[36px] text-right`}>
            {deal.rating ? deal.rating + '/10' : '—'}
          </span>
        </div>
      </div>
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
        {data.seen}/{data.total} seen
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

function InfoCard({ label, value, highlight }) {
  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-0.5">{label}</div>
      <div className={`font-medium ${highlight ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  );
}
