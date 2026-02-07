import { useState, useMemo, useCallback, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, ScatterController, Filler, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Pie, Doughnut, Scatter, getElementAtEvent } from 'react-chartjs-2';
import { chartColors } from '../data/attioData';
import { useAttioCoverage } from '../hooks/useAttioCoverage';
import { updateListEntry } from '../services/attioApi';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { useTheme } from '../hooks/useTheme.jsx';
import { granolaMeetings } from '../data/mockData';
import { SHADOW_PORTFOLIO, SHADOW_PATTERNS } from '../data/shadowPortfolio';
import Modal from '../components/Modal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, ScatterController, Filler, Title, Tooltip, Legend);

// ─── Helpers ──────────────────────────────────────────────

function quarterToNum(q) {
  if (!q) return 0;
  const match = q.match(/Q(\d)\s+(\d{4})/);
  if (!match) return 0;
  return parseInt(match[2]) * 4 + parseInt(match[1]);
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Coverage = we actually engaged: Invested, Analysed & Passed, Analysed & Lost
const COVERED_OUTCOMES = new Set(['Invested', 'Analysed & Passed', 'Analysed & Lost']);
function isCovered(deal) { return COVERED_OUTCOMES.has(deal.outcome); }

function calculateCoverageByRegion(deals) {
  const regions = ['France', 'Germany', 'Nordics', 'Southern Europe', 'Eastern Europe', 'Other'];
  const result = {};
  for (const region of regions) {
    const regionDeals = deals.filter(d => d.filterRegion === region);
    const covered = regionDeals.filter(isCovered);
    result[region] = {
      total: regionDeals.length,
      covered: covered.length,
      coverage: regionDeals.length > 0 ? Math.round((covered.length / regionDeals.length) * 100) : 0,
    };
  }
  return result;
}

function monthsAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}


// ─── Constants ────────────────────────────────────────────

const OUTCOME_STYLES = {
  'Invested': 'bg-emerald-500/10 text-emerald-500',
  'Analysed & Passed': 'bg-blue-500/10 text-blue-500',
  'Analysed & Lost': 'bg-purple-500/10 text-purple-500',
  'Tried, No Response': 'bg-amber-500/10 text-amber-500',
  "Saw, Didn't Try": 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]',
  'Completely Missed': 'bg-red-500/10 text-red-500',
};

// Pie chart colors matching outcome badge colors
const OUTCOME_PIE_COLORS = {
  'Invested': '#10b981',        // emerald-500
  'Analysed & Passed': '#3b82f6', // blue-500
  'Analysed & Lost': '#a855f7',  // purple-500
  'Tried, No Response': '#f59e0b', // amber-500
  "Saw, Didn't Try": '#9ca3af',  // gray-400
  'Completely Missed': '#ef4444', // red-500
};

const REGION_FLAGS = {
  'France': '\u{1F1EB}\u{1F1F7}',
  'Germany': '\u{1F1E9}\u{1F1EA}',
  'Nordics': '\u{1F1F8}\u{1F1EA}',
  'Southern Europe': '\u{1F1EA}\u{1F1F8}',
  'Eastern Europe': '\u{1F1F5}\u{1F1F1}',
  'Other': '\u{1F1EC}\u{1F1E7}',
};

// ─── OBJECTIVE Market Score ───────────────────────────────
// Pure market signal: did the company succeed AFTER we passed?
// No opinions — only facts.
//
//  10 = Unicorn ($1B+) or IPO
//   8 = Raised $100M+ total / Series C+
//   6 = Raised $30-100M / Series B
//   4 = Raised $10-30M / Series A follow-on
//   2 = Raised <$10M follow-on
//   0 = No follow-on / dead
//
function computeMarketScore(deal) {
  // Total funding is the strongest signal
  const totalFunding = parseFundingAmount(deal.totalFunding);
  const roundAmount = deal.amount || 0;

  // Stage progression
  const stage = (deal.stage || '').toLowerCase();
  const isSeriesC = stage.includes('series c') || stage.includes('series d') || stage.includes('series e');
  const isSeriesB = stage.includes('series b');

  if (totalFunding >= 1000 || isSeriesC && totalFunding >= 500) return 10; // Unicorn territory
  if (totalFunding >= 100 || isSeriesC) return 8;
  if (totalFunding >= 30 || isSeriesB) return 6;
  if (totalFunding >= 10 || roundAmount >= 10) return 4;
  if (roundAmount > 0 || totalFunding > 0) return 2;
  return 0;
}

function parseFundingAmount(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str / 1000000;
  const match = String(str).match(/[\d,.]+/);
  if (!match) return 0;
  const num = parseFloat(match[0].replace(/,/g, ''));
  if (isNaN(num)) return 0;
  // If it looks like it's already in millions
  if (num < 10000) return num;
  return num / 1000000;
}

// Why we passed — derive from Attio company status
const PASS_REASONS = {
  'Passed': 'Reviewed and passed',
  'To Decline': 'Decided to decline',
  'Analysed but too early': 'Too early stage for us',
  'No US path for now': 'No clear US expansion path',
};

// Build a map of company name → Granola call ratings
function buildCallRatingsMap(meetings, storedRatings) {
  const map = {}; // company name → { ratings: [], avgRating }
  meetings.forEach(m => {
    if (!m.company) return;
    const name = m.company.toLowerCase().trim();
    if (!map[name]) map[name] = { ratings: [], meetings: [] };
    const rating = storedRatings?.[m.id] ?? m.rating;
    if (rating) map[name].ratings.push(rating);
    map[name].meetings.push(m);
  });
  // Compute averages
  for (const key of Object.keys(map)) {
    const ratings = map[key].ratings;
    map[key].avgRating = ratings.length > 0
      ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10
      : null;
  }
  return map;
}

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'shadow', label: 'Shadow Portfolio' },
  { id: 'scorecard', label: 'Scorecard' },
];

// ─── Main Component ───────────────────────────────────────

export default function Sourcing() {
  const { deals: attioDeals, loading: attioLoading, error: attioError, isLive } = useAttioCoverage();
  const { theme } = useTheme();
  const [subTab, setSubTab] = useState('overview');

  // Optimistic update state for checkbox write-back
  const [updatingFields, setUpdatingFields] = useState(new Set());
  const [localOverrides, setLocalOverrides] = useState({});

  // Merge optimistic overrides onto live data (only in_scope is toggleable)
  const deals = useMemo(() => {
    if (Object.keys(localOverrides).length === 0) return attioDeals;
    return attioDeals.map(d => {
      const sKey = `${d.id}:in_scope`;
      if (!(sKey in localOverrides)) return d;
      return { ...d, coverageInScope: localOverrides[sKey], inScope: localOverrides[sKey] };
    });
  }, [attioDeals, localOverrides]);

  // Toggle a coverage field and write to Attio
  const handleToggleField = useCallback(async (dealId, field, newValue) => {
    const deal = attioDeals.find(d => d.id === dealId);
    if (!deal?.coverageEntryId) return;
    const fieldKey = `${dealId}:${field}`;
    setLocalOverrides(prev => ({ ...prev, [fieldKey]: newValue }));
    setUpdatingFields(prev => new Set(prev).add(fieldKey));
    try {
      await updateListEntry(deal.coverageEntryId, field, newValue);
    } catch (err) {
      console.error(`Failed to update ${field} for ${dealId}:`, err);
      setLocalOverrides(prev => { const next = { ...prev }; delete next[fieldKey]; return next; });
    } finally {
      setUpdatingFields(prev => { const next = new Set(prev); next.delete(fieldKey); return next; });
    }
  }, [attioDeals]);

  const handleToggleInScope = useCallback((dealId, newValue) => handleToggleField(dealId, 'in_scope', newValue), [handleToggleField]);

  // Build Granola call ratings map
  const storedRatings = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('meetingRatings') || '{}'); }
    catch { return {}; }
  }, []);
  const callRatingsMap = useMemo(() => buildCallRatingsMap(granolaMeetings, storedRatings), [storedRatings]);

  const allQuarters = useMemo(() => {
    const quarters = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    for (let year = 2022; year <= currentYear; year++) {
      const maxQ = year === currentYear ? currentQ : 4;
      for (let q = 1; q <= maxQ; q++) quarters.push(`Q${q} ${year}`);
    }
    return quarters;
  }, []);

  const [filters, setFilters] = useState({ country: 'all', stage: 'all', owner: 'all', from: '', to: '', show: 'all' });
  const [selectedDeal, setSelectedDeal] = useState(null);

  const effectiveFrom = filters.from || 'Q1 2022';
  const effectiveTo = filters.to || allQuarters[allQuarters.length - 1] || 'Q1 2026';

  const filteredDeals = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    return deals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (filters.owner !== 'all' && !d.ownerIds?.includes(filters.owner)) return false;
      if (filters.show === 'covered' && !isCovered(d)) return false;
      if (filters.show === 'not_covered' && isCovered(d)) return false;
      if (d.date) { const dNum = quarterToNum(d.date); if (dNum < fromNum || dNum > toNum) return false; }
      return true;
    }).sort((a, b) => new Date(b.announcedDate || 0) - new Date(a.announcedDate || 0));
  }, [deals, filters, effectiveFrom, effectiveTo]);

  const stats = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const filtered = deals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (filters.owner !== 'all' && !d.ownerIds?.includes(filters.owner)) return false;
      if (d.date) { const dNum = quarterToNum(d.date); if (dNum < fromNum || dNum > toNum) return false; }
      return true;
    });
    const coveredCount = filtered.filter(isCovered).length;
    const coverage = filtered.length > 0 ? Math.round((coveredCount / filtered.length) * 100) : 0;
    return { total: filtered.length, covered: coveredCount, coverage };
  }, [deals, filters, effectiveFrom, effectiveTo]);

  const coverageByRegion = useMemo(() => calculateCoverageByRegion(deals), [deals]);

  const pieData = useMemo(() => {
    const stageData = {};
    const outcomeData = {};
    deals.forEach(d => {
      stageData[d.stage] = (stageData[d.stage] || 0) + 1;
      outcomeData[d.outcome] = (outcomeData[d.outcome] || 0) + 1;
    });
    return { stageData, outcomeData };
  }, [deals]);

  // Quarterly chart data — line only (coverage %) with rich tooltip breakdown
  const quarterlyChartData = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const displayQuarters = allQuarters.filter(q => {
      const n = quarterToNum(q);
      return n >= fromNum && n <= toNum;
    });
    const byQuarter = {};
    deals.forEach(d => {
      if (!d.date) return;
      if (filters.owner !== 'all' && !d.ownerIds?.includes(filters.owner)) return;
      if (!byQuarter[d.date]) byQuarter[d.date] = { total: 0, covered: 0, invested: 0, analysed: 0, tried: 0, saw: 0, missed: 0 };
      byQuarter[d.date].total++;
      if (d.outcome === 'Invested') { byQuarter[d.date].covered++; byQuarter[d.date].invested++; }
      else if (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost') { byQuarter[d.date].covered++; byQuarter[d.date].analysed++; }
      else if (d.outcome === 'Tried, No Response') byQuarter[d.date].tried++;
      else if (d.outcome === "Saw, Didn't Try") byQuarter[d.date].saw++;
      else byQuarter[d.date].missed++;
    });
    const labels = displayQuarters;
    const coverage = displayQuarters.map(q =>
      byQuarter[q]?.total > 0 ? Math.round((byQuarter[q].covered / byQuarter[q].total) * 100) : null
    );
    // Store raw data for tooltips
    const raw = displayQuarters.map(q => byQuarter[q] || { total: 0, covered: 0, invested: 0, analysed: 0, tried: 0, saw: 0, missed: 0 });
    return { labels, coverage, raw };
  }, [deals, effectiveFrom, effectiveTo, allQuarters, filters.owner]);

  // ─── Shadow Portfolio — ONLY deals we saw, analysed, and passed on ──
  // This is NOT about deals we missed. Those belong in Coverage.
  // Shadow = we had a thesis, we made a prediction, we said no.
  // Now the market tells us if we were right.
  const shadowPortfolio = useMemo(() => {
    return deals
      .filter(d => d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost')
      .map(d => {
        const companyKey = (d.company || '').toLowerCase().trim();
        const callData = callRatingsMap[companyKey];
        return {
          ...d,
          marketScore: computeMarketScore(d),
          ourCallRating: callData?.avgRating || d.rating || null,
          callCount: callData?.meetings?.length || 0,
          passReason: d.reasonsToDecline || PASS_REASONS[d.status] || 'Reviewed and passed',
          timeAgo: monthsAgo(d.announcedDate),
        };
      })
      .sort((a, b) => b.marketScore - a.marketScore);
  }, [deals, callRatingsMap]);

  // ─── Scorecard data ────────────────────────────────────
  const scorecard = useMemo(() => {
    const total = deals.length;
    if (total === 0) return null;

    const invested = deals.filter(d => d.outcome === 'Invested').length;
    const analysedPassed = deals.filter(d => d.outcome === 'Analysed & Passed').length;
    const analysedLost = deals.filter(d => d.outcome === 'Analysed & Lost').length;
    const covered = invested + analysedPassed + analysedLost;  // = isCovered
    const tried = deals.filter(d => d.outcome === 'Tried, No Response').length;
    const saw = deals.filter(d => d.outcome === "Saw, Didn't Try").length;
    const missed = deals.filter(d => d.outcome === 'Completely Missed').length;

    const coveragePct = total > 0 ? Math.round(covered / total * 100) : 0;
    const coveredToInvested = covered > 0 ? Math.round(invested / covered * 100) : 0;

    const highConvictionMisses = deals.filter(d => (d.outcome === 'Analysed & Passed' || d.outcome === 'Completely Missed') && d.rating >= 6);

    const passedByRegion = {};
    const passedByStage = {};
    deals.filter(d => d.outcome === 'Analysed & Passed' || d.outcome === 'Completely Missed').forEach(d => {
      passedByRegion[d.filterRegion] = (passedByRegion[d.filterRegion] || 0) + 1;
      passedByStage[d.stage] = (passedByStage[d.stage] || 0) + 1;
    });

    const ratingByOutcome = {};
    deals.filter(d => d.rating).forEach(d => {
      if (!ratingByOutcome[d.outcome]) ratingByOutcome[d.outcome] = { sum: 0, count: 0 };
      ratingByOutcome[d.outcome].sum += d.rating;
      ratingByOutcome[d.outcome].count++;
    });
    const avgRatingByOutcome = {};
    for (const [outcome, { sum, count }] of Object.entries(ratingByOutcome)) {
      avgRatingByOutcome[outcome] = (sum / count).toFixed(1);
    }

    const ratedDeals = deals.filter(d => d.rating);
    const highRatedGoodOutcome = ratedDeals.filter(d => d.rating >= 6 && (d.outcome === 'Invested' || d.outcome === 'Analysed & Lost')).length;
    const highRatedTotal = ratedDeals.filter(d => d.rating >= 6).length;
    const judgmentAccuracy = highRatedTotal > 0 ? Math.round(highRatedGoodOutcome / highRatedTotal * 100) : null;

    return {
      total, covered, coveragePct, missed, invested, analysedPassed, analysedLost, tried, saw,
      coveredToInvested,
      highConvictionMisses,
      passedByRegion, passedByStage,
      avgRatingByOutcome,
      judgmentAccuracy,
    };
  }, [deals]);

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    layout: { padding: { left: 5, right: 5, top: 10 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
        titleColor: theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
        bodyColor: theme === 'dark' ? '#a3a3a3' : '#525252',
        borderColor: theme === 'dark' ? '#404040' : '#e5e5e5',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: () => null,
          afterBody: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined) return [];
            const q = quarterlyChartData.raw[idx];
            if (!q || q.total === 0) return ['No deals this quarter'];
            const pct = Math.round((q.covered / q.total) * 100);
            return [
              `Coverage: ${pct}% (${q.covered}/${q.total})`,
              '',
              `  Invested: ${q.invested}`,
              `  Analysed: ${q.analysed}`,
              `  Tried: ${q.tried}`,
              `  Saw: ${q.saw}`,
              `  Missed: ${q.missed}`,
            ];
          },
        },
      },
    },
    scales: {
      y: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { callback: v => v + '%', color: 'var(--text-tertiary)', font: { size: 11 } }, grid: { color: 'var(--border-subtle)' } },
      x: { ticks: { color: 'var(--text-tertiary)', maxRotation: 45, maxTicksLimit: 18, font: { size: 11 } }, grid: { color: 'var(--border-subtle)' } }
    }
  };

  const pieOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, color: 'var(--text-secondary)' } } }
  };

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1 mb-4">
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-[13px] rounded-lg transition-all duration-150 ${
              subTab === tab.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium border border-[var(--border-default)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}>
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <span className={`px-2 py-1 rounded text-[11px] font-medium ${
            attioLoading ? 'bg-amber-500/10 text-amber-500' : isLive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
          }`}>
            {attioLoading ? 'Syncing...' : isLive ? 'Attio Live' : 'Attio (Static)'}
          </span>
        </div>
      </div>

      {subTab === 'overview' && <OverviewTab deals={deals} filteredDeals={filteredDeals} filters={filters} setFilters={setFilters} effectiveFrom={effectiveFrom} effectiveTo={effectiveTo} allQuarters={allQuarters} stats={stats} coverageByRegion={coverageByRegion} pieData={pieData} quarterlyChartData={quarterlyChartData} chartOptions={chartOptions} pieOptions={pieOptions} theme={theme} setSelectedDeal={setSelectedDeal} onToggleInScope={handleToggleInScope} updatingFields={updatingFields} />}
      {subTab === 'shadow' && <ShadowPortfolioTab shadowPortfolio={shadowPortfolio} attioDeals={deals} setSelectedDeal={setSelectedDeal} />}
      {subTab === 'scorecard' && <ScorecardTab scorecard={scorecard} attioDeals={deals} shadowPortfolio={shadowPortfolio} />}

      <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────

function OverviewTab({ deals, filteredDeals, filters, setFilters, effectiveFrom, effectiveTo, allQuarters, stats, coverageByRegion, pieData, quarterlyChartData, chartOptions, pieOptions, theme, setSelectedDeal, onToggleInScope, updatingFields }) {
  return (
    <>
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <FilterSelect label="Owner" value={filters.owner} onChange={(v) => setFilters({ ...filters, owner: v })} options={[{ value: 'all', label: 'All Owners' }, ...TEAM_MEMBERS.map(m => ({ value: m.id, label: m.name }))]} />
          <FilterSelect label="Country" value={filters.country} onChange={(v) => setFilters({ ...filters, country: v })} options={[{ value: 'all', label: 'All Countries' }, { value: 'France', label: '\u{1F1EB}\u{1F1F7} France' }, { value: 'Germany', label: '\u{1F1E9}\u{1F1EA} Germany & Benelux' }, { value: 'Nordics', label: '\u{1F1F8}\u{1F1EA} Nordics' }, { value: 'Southern Europe', label: '\u{1F1EA}\u{1F1F8} Southern Europe' }, { value: 'Eastern Europe', label: '\u{1F1F5}\u{1F1F1} Eastern Europe' }, { value: 'Other', label: '\u{1F1EC}\u{1F1E7} Other (UK, etc.)' }]} />
          <FilterSelect label="Stage" value={filters.stage} onChange={(v) => setFilters({ ...filters, stage: v })} options={[{ value: 'all', label: 'All Stages' }, { value: 'Pre-Seed', label: 'Pre-Seed' }, { value: 'Seed', label: 'Seed' }, { value: 'Series A', label: 'Series A' }, { value: 'Series B', label: 'Series B' }, { value: 'Series C', label: 'Series C' }, { value: 'Venture', label: 'Venture' }]} />
          <FilterSelect label="From" value={effectiveFrom} onChange={(v) => setFilters({ ...filters, from: v })} options={allQuarters.map(q => ({ value: q, label: q }))} />
          <FilterSelect label="To" value={effectiveTo} onChange={(v) => setFilters({ ...filters, to: v })} options={allQuarters.map(q => ({ value: q, label: q }))} />
          <FilterSelect label="Show" value={filters.show} onChange={(v) => setFilters({ ...filters, show: v })} options={[{ value: 'all', label: 'All Companies' }, { value: 'covered', label: 'Covered (analysed)' }, { value: 'not_covered', label: 'Not Covered' }]} />
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="text-[var(--text-tertiary)]">{stats.total} companies · {stats.covered} covered</span>
            <span className="px-2 py-1 rounded-md bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)] font-semibold">{stats.coverage}% coverage</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Coverage Rate</h3><p className="text-xs text-[var(--text-tertiary)]">% of deals we analysed per quarter</p></div>
            <div className="text-right"><span className="text-3xl font-bold text-[var(--rrw-red)]">{stats.coverage}%</span><span className="text-xs text-[var(--text-tertiary)] block">Overall</span></div>
          </div>
          <div className="h-72">
            <Line data={{ labels: quarterlyChartData.labels, datasets: [
              { label: 'Coverage %', data: quarterlyChartData.coverage, borderColor: chartColors.rrwRed, backgroundColor: 'rgba(230, 52, 36, 0.08)', fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: chartColors.rrwRed, pointBorderColor: theme === 'dark' ? '#1a1a1a' : '#fff', pointBorderWidth: 2, spanGaps: false, clip: false, borderWidth: 2.5 },
            ]}} options={chartOptions} />
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Company Coverage</h3><p className="text-xs text-[var(--text-tertiary)]">{filteredDeals.length} companies</p></div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-quaternary)] mb-2 px-3 flex-wrap">
            {Object.entries(OUTCOME_STYLES).map(([label, cls]) => (
              <span key={label} className={`px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
            ))}
          </div>
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden flex-1 max-h-80 overflow-y-auto">
            {filteredDeals.length === 0 ? <div className="p-8 text-center text-[var(--text-tertiary)]">No companies match your filters</div> : filteredDeals.map(deal => <DealRow key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} onToggleInScope={onToggleInScope} updatingFields={updatingFields} />)}
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Coverage by Region</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(coverageByRegion).map(([region, data]) => <CoverageCard key={region} region={region} data={data} />)}
        </div>
      </div>

      <div className="border-t border-[var(--border-default)] pt-4 mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Analytics</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <PieCard title="Companies by region" labels={Object.keys(coverageByRegion)} data={Object.values(coverageByRegion).map(v => v.total)} options={pieOptions} />
        <PieCard title="Companies by stage" labels={Object.keys(pieData.stageData)} data={Object.values(pieData.stageData)} options={pieOptions} />
        <PieCard title="Outcome breakdown" labels={Object.keys(pieData.outcomeData)} data={Object.values(pieData.outcomeData)} colors={Object.keys(pieData.outcomeData).map(k => OUTCOME_PIE_COLORS[k] || '#6b7280')} options={pieOptions} />
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-semibold text-[var(--text-primary)]">Outcome Summary</h3><p className="text-xs text-[var(--text-tertiary)]">How we engaged with {deals.length} in-scope deals</p></div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="w-56 h-56 relative shrink-0">
            <Doughnut
              data={{
                labels: Object.keys(pieData.outcomeData),
                datasets: [{
                  data: Object.values(pieData.outcomeData),
                  backgroundColor: Object.keys(pieData.outcomeData).map(k => OUTCOME_PIE_COLORS[k] || '#6b7280'),
                  borderWidth: 0,
                  hoverOffset: 4,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const pct = deals.length > 0 ? Math.round((ctx.parsed / deals.length) * 100) : 0;
                        return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                      }
                    }
                  }
                }
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.coverage}%</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">coverage</div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {Object.entries(pieData.outcomeData).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => {
              const pct = deals.length > 0 ? Math.round((count / deals.length) * 100) : 0;
              return (
                <div key={outcome} className="flex items-center gap-2 py-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: OUTCOME_PIE_COLORS[outcome] || '#6b7280' }} />
                  <div className="min-w-0">
                    <div className="text-[12px] text-[var(--text-secondary)] truncate">{outcome}</div>
                    <div className="text-[13px] font-semibold text-[var(--text-primary)]">{count} <span className="font-normal text-[var(--text-quaternary)]">({pct}%)</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shadow Portfolio Tab — Calibration scatter + compact cards ─────

const VERDICT_CONFIG = {
  wrong: { label: 'Wrong', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', color: 'rgba(239, 68, 68, 0.7)', borderColor: '#EF4444' },
  right: { label: 'Right', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', color: 'rgba(16, 185, 129, 0.7)', borderColor: '#10B981' },
  tbd: { label: 'TBD', bg: 'bg-[var(--bg-tertiary)]', text: 'text-[var(--text-quaternary)]', border: 'border-[var(--border-default)]', color: 'rgba(156, 163, 175, 0.5)', borderColor: '#9CA3AF' },
  active: { label: 'Active', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30', color: 'rgba(59, 130, 246, 0.7)', borderColor: '#3B82F6' },
};

const PATTERN_ICONS = {
  'macro-tailwinds': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>,
  'founder-audacity': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" /></svg>,
  'too-early-followup': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  'staying-in-lane': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

function ShadowPortfolioTab({ shadowPortfolio: _unused, attioDeals, setSelectedDeal }) {
  const { theme } = useTheme();
  const chartRef = useRef();
  const [selectedShadow, setSelectedShadow] = useState(null);

  const sorted = useMemo(() => [...SHADOW_PORTFOLIO].sort((a, b) => b.marketScore - a.marketScore), []);

  const scatterData = useMemo(() => ({
    datasets: [
      {
        label: 'Perfect Calibration',
        type: 'line',
        data: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        borderColor: theme === 'dark' ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        order: 1,
      },
      {
        label: 'Companies',
        data: SHADOW_PORTFOLIO.map(d => ({
          x: d.ourFeeling,
          y: d.marketScore,
        })),
        pointRadius: SHADOW_PORTFOLIO.map(d => Math.min(22, Math.max(7, Math.sqrt(d.totalFunding) * 1.8))),
        pointBackgroundColor: SHADOW_PORTFOLIO.map(d => (VERDICT_CONFIG[d.verdict] || VERDICT_CONFIG.tbd).color),
        pointBorderColor: SHADOW_PORTFOLIO.map(d => (VERDICT_CONFIG[d.verdict] || VERDICT_CONFIG.tbd).borderColor),
        pointBorderWidth: 2,
        pointHoverRadius: SHADOW_PORTFOLIO.map(d => Math.min(26, Math.max(10, Math.sqrt(d.totalFunding) * 1.8 + 3))),
        pointHoverBorderWidth: 3,
        order: 0,
      },
    ],
  }), [theme]);

  const scatterOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        min: 0, max: 10,
        title: { display: true, text: 'Our Feeling', color: 'var(--text-tertiary)', font: { size: 12, weight: '600' } },
        ticks: { stepSize: 2, color: 'var(--text-tertiary)', font: { size: 11 } },
        grid: { color: 'var(--border-subtle)' },
      },
      y: {
        min: 0, max: 10,
        title: { display: true, text: 'Market Outcome', color: 'var(--text-tertiary)', font: { size: 12, weight: '600' } },
        ticks: { stepSize: 2, color: 'var(--text-tertiary)', font: { size: 11 } },
        grid: { color: 'var(--border-subtle)' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
        titleColor: theme === 'dark' ? '#e5e5e5' : '#1a1a1a',
        bodyColor: theme === 'dark' ? '#a3a3a3' : '#525252',
        borderColor: theme === 'dark' ? '#404040' : '#e5e5e5',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            if (idx === undefined || items[0]?.datasetIndex !== 1) return '';
            return SHADOW_PORTFOLIO[idx]?.company || '';
          },
          label: (item) => {
            if (item.datasetIndex !== 1) return null;
            const d = SHADOW_PORTFOLIO[item.dataIndex];
            if (!d) return null;
            const delta = d.marketScore - d.ourFeeling;
            const dir = delta > 0 ? 'underestimated' : delta < 0 ? 'overestimated' : 'calibrated';
            return [
              `Feel: ${d.ourFeeling}/10  |  Market: ${d.marketScore}/10`,
              `Delta: ${delta > 0 ? '+' : ''}${delta} (${dir})`,
              `Total raised: \u20AC${d.totalFunding}M`,
            ];
          },
        },
      },
    },
  }), [theme]);

  const handleChartClick = useCallback((event) => {
    if (!chartRef.current) return;
    const elements = getElementAtEvent(chartRef.current, event);
    if (elements.length > 0 && elements[0].datasetIndex === 1) {
      setSelectedShadow(SHADOW_PORTFOLIO[elements[0].index]);
    }
  }, []);

  return (
    <>
      {/* Hero: Calibration Scatter */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Judgment Calibration</h3>
            <p className="text-xs text-[var(--text-tertiary)]">Our feeling at the time vs what the market said — {SHADOW_PORTFOLIO.length} companies tracked</p>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {Object.entries(VERDICT_CONFIG).map(([key, v]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.borderColor }} />
                <span className="text-[var(--text-tertiary)]">{v.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="relative h-[380px]">
          <Scatter ref={chartRef} data={scatterData} options={scatterOptions} onClick={handleChartClick} />
          {/* Zone labels */}
          <div className="absolute top-3 left-14 text-[10px] text-[var(--text-quaternary)] flex items-center gap-1 opacity-60 pointer-events-none">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            We underestimated
          </div>
          <div className="absolute bottom-12 right-4 text-[10px] text-[var(--text-quaternary)] flex items-center gap-1 opacity-60 pointer-events-none">
            We overestimated
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </div>
        </div>
        <div className="text-[11px] text-[var(--text-quaternary)] text-center mt-1">Click a dot to see the full story. Dot size = total funding raised.</div>
      </div>

      {/* Compact Company Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {sorted.map(deal => {
          const v = VERDICT_CONFIG[deal.verdict] || VERDICT_CONFIG.tbd;
          const delta = deal.marketScore - deal.ourFeeling;
          const snippet = deal.learning.length > 100 ? deal.learning.substring(0, 100) + '...' : deal.learning;
          return (
            <div key={deal.id} className={`bg-[var(--bg-primary)] border rounded-lg p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${v.border}`}
              onClick={() => setSelectedShadow(deal)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-6 h-6 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" onError={e => { e.target.style.display = 'none'; }} />}
                  <span className="font-medium text-[13px] text-[var(--text-primary)] truncate">{deal.company}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${v.bg} ${v.text}`}>{v.label}</span>
              </div>
              <div className="flex items-center gap-3 mb-2 text-[12px]">
                <span className="text-[var(--text-tertiary)]">{deal.ourFeeling}/10</span>
                <span className={`font-semibold ${delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
                <span className="text-[var(--text-tertiary)]">{deal.marketScore}/10</span>
                <span className="text-[var(--text-quaternary)] ml-auto">{deal.totalFunding > 0 ? `\u20AC${deal.totalFunding}M` : ''}</span>
              </div>
              <p className="text-[11px] text-[var(--text-quaternary)] leading-relaxed">{snippet}</p>
            </div>
          );
        })}
      </div>

      {/* Pattern Learnings */}
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Key Learnings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SHADOW_PATTERNS.map(pattern => {
            const accentBorder = pattern.accent === 'red' ? 'border-l-red-500' :
                                 pattern.accent === 'amber' ? 'border-l-amber-500' :
                                 'border-l-emerald-500';
            const accentText = pattern.accent === 'red' ? 'text-red-500' :
                               pattern.accent === 'amber' ? 'text-amber-500' :
                               'text-emerald-500';
            const linkedCompanies = SHADOW_PORTFOLIO.filter(d => pattern.companies.includes(d.id));
            return (
              <div key={pattern.id} className={`bg-[var(--bg-primary)] border border-[var(--border-default)] border-l-[3px] ${accentBorder} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 ${accentText}`}>
                    {PATTERN_ICONS[pattern.id]}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">{pattern.title}</h4>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-2">{pattern.description}</p>
                    <div className="flex items-center gap-1.5">
                      {linkedCompanies.map(c => (
                        <span key={c.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-quaternary)]">
                          {c.logoUrl && <img src={c.logoUrl} alt="" className="w-3.5 h-3.5 rounded object-contain" onError={e => { e.target.style.display = 'none'; }} />}
                          {c.company}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shadow Detail Modal */}
      <ShadowDetailModal deal={selectedShadow} onClose={() => setSelectedShadow(null)} />
    </>
  );
}

// ─── Shadow Detail Modal ─────────────────────────────────

function ShadowDetailModal({ deal, onClose }) {
  if (!deal) return null;
  const v = VERDICT_CONFIG[deal.verdict] || VERDICT_CONFIG.tbd;
  const delta = deal.marketScore - deal.ourFeeling;
  const deltaLabel = delta > 0 ? 'underestimated' : delta < 0 ? 'overestimated' : 'calibrated';
  const deltaColor = delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-[var(--text-secondary)]';

  return (
    <Modal isOpen={!!deal} onClose={onClose}>
      <div className="p-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-[var(--bg-tertiary)]" onError={e => { e.target.style.display = 'none'; }} />}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{deal.company}</h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
              </div>
              <p className="text-[13px] text-[var(--text-tertiary)]">{deal.country} · {deal.sector} · {deal.currentStage}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <p className="text-[13px] text-[var(--text-secondary)] mb-4">{deal.description}</p>

        {/* Calibration bar */}
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-[var(--text-tertiary)]">Our Feeling</span>
            <span className={`font-semibold ${deltaColor}`}>{delta > 0 ? '+' : ''}{delta} ({deltaLabel})</span>
            <span className="text-[var(--text-tertiary)]">Market Score</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold text-[var(--text-primary)]">{deal.ourFeeling}/10</span>
            <div className="flex-1 h-2 bg-[var(--bg-secondary)] rounded-full relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-blue-400/50 rounded-full" style={{ width: `${deal.ourFeeling * 10}%` }} />
              <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${deal.marketScore * 10}%`, backgroundColor: v.borderColor, opacity: 0.5 }} />
            </div>
            <span className={`text-[15px] font-bold px-2 py-0.5 rounded ${v.bg} ${v.text}`}>{deal.marketScore}/10</span>
          </div>
        </div>

        {deal.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {deal.tags.map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] text-[10px] rounded-full">{tag}</span>
            ))}
          </div>
        )}

        {/* Two column: What we said + What happened */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">What We Said</div>
            <div className="text-[13px] text-[var(--text-primary)] mb-2">{deal.reasonsToPass}</div>
            {deal.teamDiscussion && (
              <div className="text-[12px] text-[var(--text-secondary)] mt-2 border-t border-[var(--border-subtle)] pt-2 italic leading-relaxed">{deal.teamDiscussion}</div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">What Happened Since</div>
            {deal.latestRound && <div className="text-[13px] text-[var(--text-primary)] font-medium mb-1">{deal.latestRound}</div>}
            <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2">{deal.keyMilestone}</div>
            <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)] text-[12px]">
              <div className="flex justify-between"><span className="text-[var(--text-quaternary)]">Total funding</span><span className="text-[var(--text-primary)] font-medium">{'\u20AC'}{deal.totalFunding}M</span></div>
              {deal.currentEmployees && <div className="flex justify-between"><span className="text-[var(--text-quaternary)]">Team</span><span className="text-[var(--text-primary)]">{deal.currentEmployees}</span></div>}
              {deal.currentARR && <div className="flex justify-between"><span className="text-[var(--text-quaternary)]">ARR</span><span className="text-[var(--text-primary)]">{deal.currentARR}</span></div>}
            </div>
          </div>
        </div>

        {/* Learning — full width */}
        <div className={`p-4 rounded-lg border ${
          deal.verdict === 'wrong' ? 'bg-red-500/5 border-red-500/20' :
          deal.verdict === 'right' ? 'bg-emerald-500/5 border-emerald-500/20' :
          deal.verdict === 'active' ? 'bg-blue-500/5 border-blue-500/20' :
          'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
        }`}>
          <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Learning</div>
          <div className="text-[13px] text-[var(--text-primary)] leading-relaxed">{deal.learning}</div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Scorecard Tab — Learnings first, compact quality metrics ──

function ScorecardTab({ scorecard, attioDeals, shadowPortfolio }) {
  if (!scorecard) return <div className="p-8 text-center text-[var(--text-tertiary)]">No data available</div>;

  const ratingBuckets = ['1-2', '3-4', '5-6', '7-8', '9-10'];
  const bucketRange = [[1,2],[3,4],[5,6],[7,8],[9,10]];
  const investedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Invested').length);
  const passedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost')).length);
  const missedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Completely Missed').length);

  const quadrants = useMemo(() => {
    const invested = attioDeals.filter(d => d.outcome === 'Invested');
    const truePositives = invested.length;
    const falseNegatives = shadowPortfolio.filter(d => (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost') && d.marketScore >= 6).length;
    const trueNegatives = shadowPortfolio.filter(d => (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost') && d.marketScore <= 2).length;
    const falsePositives = 0;
    return { truePositives, falseNegatives, trueNegatives, falsePositives };
  }, [attioDeals, shadowPortfolio]);

  return (
    <>
      {/* Hero: Key Learnings */}
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">What We Learned</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SHADOW_PATTERNS.map(pattern => {
            const accentBorder = pattern.accent === 'red' ? 'border-l-red-500' :
                                 pattern.accent === 'amber' ? 'border-l-amber-500' :
                                 'border-l-emerald-500';
            const accentText = pattern.accent === 'red' ? 'text-red-500' :
                               pattern.accent === 'amber' ? 'text-amber-500' :
                               'text-emerald-500';
            const linkedCompanies = SHADOW_PORTFOLIO.filter(d => pattern.companies.includes(d.id));
            return (
              <div key={pattern.id} className={`bg-[var(--bg-primary)] border border-[var(--border-default)] border-l-[3px] ${accentBorder} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 ${accentText}`}>
                    {PATTERN_ICONS[pattern.id]}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">{pattern.title}</h4>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-2">{pattern.description}</p>
                    <div className="flex items-center gap-1.5">
                      {linkedCompanies.map(c => (
                        <span key={c.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-quaternary)]">
                          {c.logoUrl && <img src={c.logoUrl} alt="" className="w-3.5 h-3.5 rounded object-contain" onError={e => { e.target.style.display = 'none'; }} />}
                          {c.company}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Quality — compact 3-column row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Quadrant Matrix */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Decision Matrix</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-center">
              <div className="text-xl font-bold text-emerald-500">{quadrants.truePositives}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">True Pos</div>
            </div>
            <div className="p-2.5 rounded bg-red-500/5 border border-red-500/20 text-center">
              <div className="text-xl font-bold text-red-500">{quadrants.falseNegatives}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">False Neg</div>
            </div>
            <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20 text-center">
              <div className="text-xl font-bold text-amber-500">{quadrants.falsePositives || '\u2014'}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">False Pos</div>
            </div>
            <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-center">
              <div className="text-xl font-bold text-emerald-500">{quadrants.trueNegatives}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">True Neg</div>
            </div>
          </div>
        </div>

        {/* Decision Funnel */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Decision Funnel</h3>
          <div className="flex items-center justify-between gap-2">
            <FunnelStep label="Universe" value={scorecard.total} />
            <FunnelArrow pct={scorecard.coveragePct} />
            <FunnelStep label="Covered" value={scorecard.covered} />
            <FunnelArrow pct={scorecard.coveredToInvested} />
            <FunnelStep label="Invested" value={scorecard.invested} highlight />
          </div>
        </div>

        {/* Key Stats */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Key Numbers</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{scorecard.coveragePct}%</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Coverage</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-500">{scorecard.invested}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Invested</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-500">{scorecard.missed}</div>
              <div className="text-[10px] text-[var(--text-tertiary)]">Missed</div>
            </div>
            {scorecard.judgmentAccuracy !== null && (
              <div>
                <div className={`text-xl font-bold ${scorecard.judgmentAccuracy >= 50 ? 'text-emerald-500' : 'text-amber-500'}`}>{scorecard.judgmentAccuracy}%</div>
                <div className="text-[10px] text-[var(--text-tertiary)]">Accuracy</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supporting Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Rating vs Outcome</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">Do higher ratings predict better outcomes?</p>
          <div className="h-52">
            <Bar data={{ labels: ratingBuckets, datasets: [
              { label: 'Invested', data: investedByRating, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 3 },
              { label: 'Analysed', data: passedByRating, backgroundColor: 'rgba(59, 130, 246, 0.5)', borderRadius: 3 },
              { label: 'Missed', data: missedByRating, backgroundColor: 'rgba(239, 68, 68, 0.5)', borderRadius: 3 },
            ]}} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 }, color: 'var(--text-tertiary)' } } }, scales: { x: { stacked: true, ticks: { color: 'var(--text-tertiary)', font: { size: 10 } }, grid: { display: false }, title: { display: true, text: 'Initial Rating', color: 'var(--text-tertiary)', font: { size: 10 } } }, y: { stacked: true, ticks: { color: 'var(--text-tertiary)', precision: 0, font: { size: 10 } }, grid: { color: 'var(--border-subtle)' } } } }} />
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Avg Rating by Outcome</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">Are we rating future winners higher?</p>
          <div className="space-y-2.5">
            {Object.entries(scorecard.avgRatingByOutcome).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])).map(([outcome, avg]) => (
              <div key={outcome}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${OUTCOME_STYLES[outcome] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>{outcome}</span>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{avg}/10</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--rrw-red)] rounded-full transition-all" style={{ width: `${(parseFloat(avg) / 10) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shared Components ────────────────────────────────────

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 px-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-md text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)] transition-colors">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}

function DealRow({ deal, onClick, onToggleInScope, updatingFields }) {
  const ratingColor = deal.rating >= 7 ? 'text-emerald-500' : deal.rating >= 4 ? 'text-amber-500' : deal.rating ? 'text-red-500' : 'text-[var(--text-quaternary)]';
  const outcomeStyle = OUTCOME_STYLES[deal.outcome] || 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]';
  const hasEntry = !!deal.coverageEntryId;
  const isUpdatingS = updatingFields?.has(`${deal.id}:in_scope`);

  return (
    <div className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* In Scope checkbox (manual) */}
          <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
            <span className="relative" title="In Scope (fits our thesis)">
              <input type="checkbox" checked={deal.coverageInScope || false}
                onChange={() => hasEntry && onToggleInScope?.(deal.id, !deal.coverageInScope)}
                disabled={!hasEntry || isUpdatingS}
                className="w-3.5 h-3.5 accent-blue-500 cursor-pointer disabled:opacity-40" />
              {isUpdatingS && <span className="absolute -right-1.5 -top-1.5 w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin text-[var(--text-quaternary)]" />}
            </span>
          </div>
          {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-5 h-5 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" />}
          <span className="font-medium text-[var(--text-primary)] truncate cursor-pointer" onClick={onClick}>{deal.dealName || deal.company}</span>
          <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{deal.country}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${outcomeStyle}`}>{deal.outcome}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] pl-[28px]">
          {deal.amount > 0 && <span className="text-[var(--text-tertiary)]">€{deal.amount}M</span>}
          <span className="text-[var(--text-quaternary)]">{formatMonth(deal.announcedDate) || deal.date}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-semibold text-[13px] ${ratingColor} min-w-[36px] text-right`}>{deal.rating ? deal.rating + '/10' : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-[var(--text-primary)]'}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-quaternary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelStep({ label, value, highlight }) {
  return (
    <div className={`flex-1 p-4 rounded-lg text-center ${highlight ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-[var(--bg-tertiary)]'}`}>
      <div className={`text-2xl font-bold ${highlight ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>{value}</div>
      <div className="text-[11px] text-[var(--text-tertiary)] mt-1">{label}</div>
    </div>
  );
}

function FunnelArrow({ pct }) {
  return (
    <div className="flex flex-col items-center px-1 shrink-0">
      <span className="text-[11px] font-semibold text-[var(--rrw-red)]">{pct}%</span>
      <svg className="w-5 h-5 text-[var(--text-quaternary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
    </div>
  );
}

function CoverageCard({ region, data }) {
  const coverageColor = data.coverage >= 80 ? 'text-emerald-500' : data.coverage >= 60 ? 'text-amber-500' : 'text-red-500';
  const flag = REGION_FLAGS[region];
  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-1">{flag && <span className="mr-1">{flag}</span>}{region}</div>
      <div className={`text-xl font-bold ${coverageColor}`}>{data.coverage}%</div>
      <div className="text-[11px] text-[var(--text-quaternary)]">{data.covered}/{data.total} covered</div>
    </div>
  );
}

function PieCard({ title, labels, data, colors, options }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
      <h4 className="text-[13px] font-medium text-[var(--text-primary)] mb-3">{title}</h4>
      <div className="h-40"><Pie data={{ labels, datasets: [{ data, backgroundColor: colors || chartColors.colors }] }} options={options} /></div>
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

function DealModal({ deal, onClose }) {
  if (!deal) return null;
  return (
    <Modal isOpen={!!deal} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {deal.logoUrl && <img src={deal.logoUrl} alt={deal.company} className="w-12 h-12 rounded-lg object-contain bg-[var(--bg-tertiary)]" />}
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{deal.dealName || deal.company}</h2>
              <p className="text-[13px] text-[var(--text-secondary)]">{deal.country}{deal.amount > 0 ? ` · €${deal.amount}M` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {deal.description && <p className="text-[13px] text-[var(--text-secondary)] mb-4">{deal.description}</p>}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <InfoCard label="Quarter" value={deal.date} />
          <InfoCard label="Outcome" value={deal.outcome} highlight={deal.outcome === 'Invested'} />
          <InfoCard label="Attio Status" value={deal.status || '—'} />
          <InfoCard label="Rating" value={deal.rating ? deal.rating + '/10' : 'Not rated'} highlight={deal.rating >= 7} />
          <InfoCard label="Total Funding" value={deal.totalFunding || '—'} />
          <InfoCard label="Team Size" value={deal.employeeRange || '—'} />
          {deal.marketScore !== undefined && <InfoCard label="Market Score" value={deal.marketScore + '/10'} highlight={deal.marketScore <= 2} />}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-2.5 py-1 rounded text-[12px] font-medium ${OUTCOME_STYLES[deal.outcome] || 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]'}`}>{deal.outcome}</span>
          {deal.receivedDate && <span className="text-[12px] text-[var(--text-tertiary)]">Received {formatMonth(deal.receivedDate)}</span>}
        </div>
        {deal.industry?.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] text-[var(--text-tertiary)] mb-2">Industries</div>
            <div className="flex flex-wrap gap-2">{deal.industry.map((tag, i) => <span key={i} className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] rounded">{tag}</span>)}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
