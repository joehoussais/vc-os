import { useState, useMemo, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Filler, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { chartColors } from '../data/attioData';
import { useAttioCoverage } from '../hooks/useAttioCoverage';
import { updateListEntry } from '../services/attioApi';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { useTheme } from '../hooks/useTheme.jsx';
import { granolaMeetings } from '../data/mockData';
import { SHADOW_PORTFOLIO } from '../data/shadowPortfolio';
import Modal from '../components/Modal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Filler, Title, Tooltip, Legend);

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
          <FilterSelect label="Country" value={filters.country} onChange={(v) => setFilters({ ...filters, country: v })} options={[{ value: 'all', label: 'All Countries' }, { value: 'France', label: 'France' }, { value: 'Germany', label: 'Germany & Benelux' }, { value: 'Nordics', label: 'Nordics' }, { value: 'Southern Europe', label: 'Southern Europe' }, { value: 'Eastern Europe', label: 'Eastern Europe' }, { value: 'Other', label: 'Other (UK, etc.)' }]} />
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
        <PieCard title="Outcome breakdown" labels={Object.keys(pieData.outcomeData)} data={Object.values(pieData.outcomeData)} options={pieOptions} />
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-semibold text-[var(--text-primary)]">Outcome Summary</h3><p className="text-xs text-[var(--text-tertiary)]">Derived from Attio status</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(pieData.outcomeData).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
            <div key={outcome} className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-1 ${OUTCOME_STYLES[outcome] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>{outcome}</span>
              <div className="text-xl font-bold text-[var(--text-primary)]">{count}</div>
              <div className="text-[11px] text-[var(--text-quaternary)]">{deals.length > 0 ? Math.round((count / deals.length) * 100) : 0}%</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Shadow Portfolio Tab — Hard-coded deep analysis ─────

function ShadowPortfolioTab({ shadowPortfolio: _unused, attioDeals, setSelectedDeal }) {
  const [sortBy, setSortBy] = useState('market'); // market | feeling | date
  const [shadowFilter, setShadowFilter] = useState('all'); // all | wrong | right | tbd | active
  const [expandedDeal, setExpandedDeal] = useState(null);

  const filtered = useMemo(() => {
    let list = SHADOW_PORTFOLIO;
    if (shadowFilter === 'wrong') list = list.filter(d => d.verdict === 'wrong');
    if (shadowFilter === 'right') list = list.filter(d => d.verdict === 'right');
    if (shadowFilter === 'tbd') list = list.filter(d => d.verdict === 'tbd');
    if (shadowFilter === 'active') list = list.filter(d => d.verdict === 'active');

    if (sortBy === 'feeling') return [...list].sort((a, b) => (b.ourFeeling || 0) - (a.ourFeeling || 0));
    if (sortBy === 'date') return [...list].sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
    if (sortBy === 'funding') return [...list].sort((a, b) => (b.totalFunding || 0) - (a.totalFunding || 0));
    return [...list].sort((a, b) => b.marketScore - a.marketScore);
  }, [shadowFilter, sortBy]);

  const wrongCount = SHADOW_PORTFOLIO.filter(d => d.verdict === 'wrong').length;
  const rightCount = SHADOW_PORTFOLIO.filter(d => d.verdict === 'right').length;
  const tbdCount = SHADOW_PORTFOLIO.filter(d => d.verdict === 'tbd').length;
  const activeCount = SHADOW_PORTFOLIO.filter(d => d.verdict === 'active').length;
  const avgMarket = (SHADOW_PORTFOLIO.reduce((sum, d) => sum + d.marketScore, 0) / SHADOW_PORTFOLIO.length).toFixed(1);
  const avgFeeling = (SHADOW_PORTFOLIO.reduce((sum, d) => sum + (d.ourFeeling || 0), 0) / SHADOW_PORTFOLIO.length).toFixed(1);

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <StatCard label="Companies Tracked" value={SHADOW_PORTFOLIO.length} sub="Curated shadow portfolio" />
        <StatCard label="We Were Wrong" value={wrongCount} sub="Raised big after we passed" color="text-red-500" />
        <StatCard label="We Were Right" value={rightCount} sub="Good pass — confirmed" color="text-emerald-500" />
        <StatCard label="Too Early to Tell" value={tbdCount} sub="Outcome still developing" />
        <StatCard label="Calibration" value={`${avgFeeling} → ${avgMarket}`} sub="Our feeling vs market outcome" />
      </div>

      {/* How it works */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-start gap-6 text-[11px] text-[var(--text-tertiary)]">
          <div><span className="font-semibold text-[var(--text-secondary)]">Shadow Portfolio</span> = companies we saw, analysed, and passed on. Now the market tells us if we were right. AI-assisted analysis from Attio data & team discussions.</div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-semibold">10</span> <span>Unicorn</span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">8</span> <span>$100M+</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">6</span> <span>$30M+</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] font-semibold">2-4</span> <span>Some raise</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">0</span> <span>Nothing</span>
          </div>
        </div>
      </div>

      {/* Filter + Sort Bar */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <FilterSelect label="Verdict" value={shadowFilter} onChange={setShadowFilter}
            options={[{ value: 'all', label: 'All Companies' }, { value: 'wrong', label: 'We Were Wrong' }, { value: 'right', label: 'We Were Right' }, { value: 'tbd', label: 'Too Early to Tell' }, { value: 'active', label: 'Still Pursuing' }]} />
          <FilterSelect label="Sort by" value={sortBy} onChange={setSortBy}
            options={[{ value: 'market', label: 'Market Score' }, { value: 'funding', label: 'Total Funding' }, { value: 'feeling', label: 'Our Feeling' }, { value: 'date', label: 'Most Recent' }]} />
          <div className="ml-auto text-[13px] text-[var(--text-tertiary)]">{filtered.length} companies</div>
        </div>
      </div>

      {/* Deal List with Expandable Cards */}
      <div className="space-y-2 mb-4">
        {filtered.length === 0 ? (
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-8 text-center text-[var(--text-tertiary)]">No companies match this filter</div>
        ) : filtered.map(deal => (
          <ShadowDealCard
            key={deal.id}
            deal={deal}
            expanded={expandedDeal === deal.id}
            onToggle={() => setExpandedDeal(expandedDeal === deal.id ? null : deal.id)}
          />
        ))}
      </div>
    </>
  );
}

// ─── Shadow Deal Card — rich analysis from hard-coded data ──

function ShadowDealCard({ deal, expanded, onToggle }) {
  const marketColor = deal.marketScore >= 8 ? 'text-red-500 bg-red-500/10' :
                      deal.marketScore >= 6 ? 'text-amber-500 bg-amber-500/10' :
                      deal.marketScore >= 4 ? 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]' :
                      'text-emerald-500 bg-emerald-500/10';

  const feelingColor = deal.ourFeeling >= 8 ? 'text-emerald-500' :
                       deal.ourFeeling >= 6 ? 'text-amber-500' :
                       'text-[var(--text-tertiary)]';

  const verdictConfig = {
    wrong: { label: 'Wrong', bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
    right: { label: 'Right', bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
    tbd: { label: 'TBD', bg: 'bg-[var(--bg-tertiary)]', text: 'text-[var(--text-quaternary)]', border: 'border-[var(--border-default)]' },
    active: { label: 'Pursuing', bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
  };
  const v = verdictConfig[deal.verdict] || verdictConfig.tbd;

  const firstSeenLabel = deal.firstSeen ? new Date(deal.firstSeen).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

  return (
    <div className={`bg-[var(--bg-primary)] border rounded-lg overflow-hidden transition-all ${v.border}`}>
      {/* Header Row — always visible */}
      <div className="p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-7 h-7 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" onError={e => { e.target.style.display = 'none'; }} />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text-primary)] truncate">{deal.company}</span>
                <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{deal.country} · {deal.sector}</span>
              </div>
              <div className="text-[11px] text-[var(--text-quaternary)]">
                First seen {firstSeenLabel}
                {deal.totalFunding > 0 && ` · €${deal.totalFunding}M total raised`}
                {deal.currentStage && ` · ${deal.currentStage}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Our feeling at the time */}
            <div className="text-center">
              <div className="text-[10px] text-[var(--text-quaternary)]">Our feel</div>
              <div className={`text-[13px] font-semibold ${feelingColor}`}>{deal.ourFeeling}/10</div>
            </div>
            {/* Market score */}
            <div className="text-center">
              <div className="text-[10px] text-[var(--text-quaternary)]">Market</div>
              <div className={`text-[15px] font-bold px-2 py-0.5 rounded ${marketColor}`}>{deal.marketScore}/10</div>
            </div>
            {/* Verdict badge */}
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
            {/* Expand arrow */}
            <svg className={`w-4 h-4 text-[var(--text-quaternary)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded section — rich 3-column analysis */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          {/* Description */}
          <div className="text-[13px] text-[var(--text-secondary)] mb-4">{deal.description}</div>

          {/* Tags */}
          {deal.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {deal.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] text-[10px] rounded-full">{tag}</span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Our Assessment */}
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">What We Said</div>
              <div className="text-[13px] text-[var(--text-primary)] mb-2">{deal.reasonsToPass}</div>
              {deal.teamDiscussion && (
                <div className="text-[12px] text-[var(--text-secondary)] mt-2 border-t border-[var(--border-subtle)] pt-2">
                  <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">Team Discussion</div>
                  <div className="italic leading-relaxed">{deal.teamDiscussion}</div>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[11px] text-[var(--text-quaternary)]">Feeling:</span>
                <span className={`text-[12px] font-semibold ${feelingColor}`}>{deal.ourFeeling}/10</span>
                <span className="text-[11px] text-[var(--text-quaternary)]">·</span>
                <span className="text-[11px] text-[var(--text-quaternary)]">{deal.ourVerdict}</span>
              </div>
            </div>

            {/* What happened since */}
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">What Happened Since</div>
              {deal.latestRound && (
                <div className="text-[13px] text-[var(--text-primary)] font-medium mb-1">{deal.latestRound}</div>
              )}
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2">{deal.keyMilestone}</div>
              <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-quaternary)]">Total funding</span>
                  <span className="text-[var(--text-primary)] font-medium">€{deal.totalFunding}M</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-quaternary)]">Stage</span>
                  <span className="text-[var(--text-primary)]">{deal.currentStage}</span>
                </div>
                {deal.currentEmployees && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-quaternary)]">Team</span>
                    <span className="text-[var(--text-primary)]">{deal.currentEmployees}</span>
                  </div>
                )}
                {deal.currentARR && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-quaternary)]">ARR</span>
                    <span className="text-[var(--text-primary)]">{deal.currentARR}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Learning */}
            <div className={`p-3 rounded-lg border ${
              deal.verdict === 'wrong' ? 'bg-red-500/5 border-red-500/20' :
              deal.verdict === 'right' ? 'bg-emerald-500/5 border-emerald-500/20' :
              deal.verdict === 'active' ? 'bg-blue-500/5 border-blue-500/20' :
              'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
            }`}>
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Learning</div>
              <div className="text-[13px] text-[var(--text-primary)] leading-relaxed">{deal.learning}</div>
              {/* Delta */}
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[var(--border-subtle)]">
                <div className="text-[11px] text-[var(--text-quaternary)]">
                  Feel → Market: <span className={`font-semibold ${deal.marketScore > deal.ourFeeling ? 'text-red-500' : deal.marketScore < deal.ourFeeling ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>
                    {deal.ourFeeling}/10 → {deal.marketScore}/10
                  </span>
                  {deal.marketScore > deal.ourFeeling && ' (underestimated)'}
                  {deal.marketScore < deal.ourFeeling && ' (overestimated)'}
                  {deal.marketScore === deal.ourFeeling && ' (calibrated)'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scorecard Tab ────────────────────────────────────────

function ScorecardTab({ scorecard, attioDeals, shadowPortfolio }) {
  if (!scorecard) return <div className="p-8 text-center text-[var(--text-tertiary)]">No data available</div>;

  const ratingBuckets = ['1-2', '3-4', '5-6', '7-8', '9-10'];
  const bucketRange = [[1,2],[3,4],[5,6],[7,8],[9,10]];
  const investedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Invested').length);
  const passedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost')).length);
  const missedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Completely Missed').length);

  // 4-quadrant analysis (Sequoia style)
  const quadrants = useMemo(() => {
    const invested = attioDeals.filter(d => d.outcome === 'Invested');
    // For now, use deal amount as proxy for success signal
    const truePositives = invested.length; // We invested (all are "positive" decisions)
    const falseNegatives = shadowPortfolio.filter(d => (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost') && d.marketScore >= 6).length;
    const trueNegatives = shadowPortfolio.filter(d => (d.outcome === 'Analysed & Passed' || d.outcome === 'Analysed & Lost') && d.marketScore <= 2).length;
    const falsePositives = 0; // Would need portfolio performance data
    return { truePositives, falseNegatives, trueNegatives, falsePositives };
  }, [attioDeals, shadowPortfolio]);

  return (
    <>
      <div className="mb-4">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Judgment calibration — comparing initial ratings against outcomes. Inspired by Sequoia's 4-quadrant framework: true positives, false positives, true negatives, false negatives.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
        <StatCard label="Total Deals" value={scorecard.total} sub="In-scope universe" />
        <StatCard label="Coverage" value={scorecard.coveragePct + '%'} sub={`${scorecard.covered} of ${scorecard.total} analysed`} />
        <StatCard label="Invested" value={scorecard.invested} sub={scorecard.covered > 0 ? Math.round(scorecard.invested / scorecard.covered * 100) + '% of covered' : ''} color="text-emerald-500" />
        <StatCard label="Covered → Invested" value={scorecard.coveredToInvested + '%'} sub="Conversion" />
        <StatCard label="Completely Missed" value={scorecard.missed} sub={scorecard.total > 0 ? Math.round(scorecard.missed / scorecard.total * 100) + '% of total' : ''} color="text-red-500" />
        {scorecard.judgmentAccuracy !== null && <StatCard label="Rating Accuracy" value={scorecard.judgmentAccuracy + '%'} sub="Rated 6+ that reached IC/Invest" color={scorecard.judgmentAccuracy >= 50 ? 'text-emerald-500' : 'text-amber-500'} />}
      </div>

      {/* 4-Quadrant Grid */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-1">Decision Quality Matrix</h3>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">Updated as new data emerges — reviewed quarterly</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
            <div className="text-3xl font-bold text-emerald-500">{quadrants.truePositives}</div>
            <div className="text-[13px] font-medium text-emerald-600 mt-1">True Positives</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">We invested — good call</div>
          </div>
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
            <div className="text-3xl font-bold text-red-500">{quadrants.falseNegatives}</div>
            <div className="text-[13px] font-medium text-red-600 mt-1">False Negatives</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">We passed — company succeeded</div>
          </div>
          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
            <div className="text-3xl font-bold text-amber-500">{quadrants.falsePositives || '—'}</div>
            <div className="text-[13px] font-medium text-amber-600 mt-1">False Positives</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">We invested — didn't work (needs portfolio data)</div>
          </div>
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
            <div className="text-3xl font-bold text-emerald-500">{quadrants.trueNegatives}</div>
            <div className="text-[13px] font-medium text-emerald-600 mt-1">True Negatives</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">We passed — company didn't raise</div>
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Decision Funnel</h3>
        <div className="flex items-center justify-between gap-2">
          <FunnelStep label="Universe" value={scorecard.total} />
          <FunnelArrow pct={scorecard.coveragePct} />
          <FunnelStep label="Covered" value={scorecard.covered} />
          <FunnelArrow pct={scorecard.coveredToInvested} />
          <FunnelStep label="Invested" value={scorecard.invested} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Rating vs Outcome</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">Do higher ratings predict better outcomes?</p>
          <div className="h-64">
            <Bar data={{ labels: ratingBuckets, datasets: [
              { label: 'Invested', data: investedByRating, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderRadius: 3 },
              { label: 'Analysed', data: passedByRating, backgroundColor: 'rgba(59, 130, 246, 0.5)', borderRadius: 3 },
              { label: 'Missed', data: missedByRating, backgroundColor: 'rgba(239, 68, 68, 0.5)', borderRadius: 3 },
            ]}} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 11 }, color: 'var(--text-tertiary)' } } }, scales: { x: { stacked: true, ticks: { color: 'var(--text-tertiary)' }, grid: { display: false }, title: { display: true, text: 'Initial Rating', color: 'var(--text-tertiary)', font: { size: 11 } } }, y: { stacked: true, ticks: { color: 'var(--text-tertiary)', precision: 0 }, grid: { color: 'var(--border-subtle)' } } } }} />
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Avg Rating by Outcome</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">Are we rating future winners higher?</p>
          <div className="space-y-3">
            {Object.entries(scorecard.avgRatingByOutcome).sort((a, b) => parseFloat(b[1]) - parseFloat(a[1])).map(([outcome, avg]) => (
              <div key={outcome}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] px-2 py-0.5 rounded font-medium ${OUTCOME_STYLES[outcome] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>{outcome}</span>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{avg}/10</span>
                </div>
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--rrw-red)] rounded-full transition-all" style={{ width: `${(parseFloat(avg) / 10) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Passes by Region + Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Passes by Region</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">Where are you saying no?</p>
          <div className="space-y-2">
            {Object.entries(scorecard.passedByRegion).sort((a, b) => b[1] - a[1]).map(([region, count]) => {
              const regionTotal = attioDeals.filter(d => d.filterRegion === region).length;
              const pct = regionTotal > 0 ? Math.round(count / regionTotal * 100) : 0;
              return (
                <div key={region} className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-secondary)]">{region}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden"><div className="h-full bg-[var(--rrw-red)] rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[11px] text-[var(--text-quaternary)] w-16 text-right">{count} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">Passes by Stage</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">At which stages are you passing?</p>
          <div className="space-y-2">
            {Object.entries(scorecard.passedByStage).sort((a, b) => b[1] - a[1]).map(([stage, count]) => {
              const stageTotal = attioDeals.filter(d => d.stage === stage).length;
              const pct = stageTotal > 0 ? Math.round(count / stageTotal * 100) : 0;
              return (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-secondary)]">{stage}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[11px] text-[var(--text-quaternary)] w-16 text-right">{count} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* High-conviction misses */}
      {scorecard.highConvictionMisses.length > 0 && (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-1">High-Conviction Misses</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-4">Rated 6+ but passed or missed</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scorecard.highConvictionMisses.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 9).map(deal => (
              <div key={deal.id} className="p-3 border border-[var(--border-default)] rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-5 h-5 rounded object-contain bg-[var(--bg-tertiary)]" />}
                  <span className="font-medium text-[var(--text-primary)] text-[13px] truncate">{deal.company}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${OUTCOME_STYLES[deal.outcome]}`}>{deal.outcome}</span>
                    {deal.amount > 0 && <span className="text-[11px] text-[var(--text-tertiary)]">€{deal.amount}M</span>}
                  </div>
                  <span className="text-[13px] font-semibold text-amber-500">{deal.rating}/10</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-[11px] text-[var(--text-tertiary)] mb-1">{region}</div>
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
