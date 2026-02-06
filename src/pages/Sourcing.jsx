import { useState, useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { chartColors } from '../data/attioData';
import { useAttioDeals } from '../hooks/useAttioDeals';
import { useTheme } from '../hooks/useTheme.jsx';
import { granolaMeetings } from '../data/mockData';
import Modal from '../components/Modal';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, ArcElement, Title, Tooltip, Legend);

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
  'IC': 'bg-blue-500/10 text-blue-500',
  'DD': 'bg-blue-500/10 text-blue-500',
  'In Pipeline': 'bg-amber-500/10 text-amber-500',
  'Saw': 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
  'Tracked': 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]',
  'Passed': 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  'Missed': 'bg-red-500/10 text-red-500',
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

// ─── Hardcoded shadow deals (not in Attio) ─────────────────
// Deals we saw, analysed, and passed on — manually added because
// they aren't tracked in Attio with the right status.
const HARDCODED_SHADOW_DEALS = [
  {
    id: 'shadow-harmattan',
    dealName: 'Harmattan AI (fka Deep Mine)',
    company: 'Harmattan AI',
    country: 'France',
    filterRegion: 'France',
    stage: 'Series A',
    amount: 42, // $42M early funding
    date: 'Q4 2024',
    announcedDate: '2024-10-01',
    seen: true,
    status: 'Passed',
    outcome: 'Passed',
    industry: ['Defence', 'Drones', 'AI'],
    rating: 8, // deal rating from Attio
    logoUrl: 'https://www.harmattan.ai/favicon.ico',
    totalFunding: '$242M', // $42M + $200M Series B
    employeeRange: '50-100',
    // Shadow-specific overrides
    _shadowOverride: {
      marketScore: 10, // Unicorn: €1.4B valuation
      ourCallRating: 8,
      callCount: 2,
      passReason: 'Valuation too high (€300M pre-rev), founder perceived as too confident, partnership not ready for defence tech',
      truthLines: [
        'Series B: $200M led by Dassault Aviation (Jan 2026)',
        'Unicorn: €1.4B valuation',
        'French MoD ordered 1,000 drones',
        'UK MoD contract: 3,000 systems',
        'Founded April 2024 → unicorn in ~20 months',
      ],
      learningText: 'We underestimated the founder\'s ability to execute at speed. "Too confident" was actually conviction backed by deep domain expertise. The €300M pre-rev valuation seemed crazy — the market 5x\'d it within a year. Defence tech wave was real and we weren\'t ready to ride it.',
    },
  },
];

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
  const { deals: attioDeals, loading: attioLoading, error: attioError, isLive } = useAttioDeals();
  const { theme } = useTheme();
  const [subTab, setSubTab] = useState('overview');

  // Build Granola call ratings map
  const storedRatings = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('meetingRatings') || '{}'); }
    catch { return {}; }
  }, []);
  const callRatingsMap = useMemo(() => buildCallRatingsMap(granolaMeetings, storedRatings), [storedRatings]);

  const allQuarters = useMemo(() => {
    const quarters = [];
    for (let year = 2021; year <= 2026; year++) {
      const maxQ = year === 2026 ? 1 : 4;
      for (let q = 1; q <= maxQ; q++) quarters.push(`Q${q} ${year}`);
    }
    return quarters;
  }, []);

  const [filters, setFilters] = useState({ country: 'all', stage: 'all', from: '', to: '', show: 'all' });
  const [selectedDeal, setSelectedDeal] = useState(null);

  const effectiveFrom = filters.from || 'Q1 2021';
  const effectiveTo = filters.to || 'Q1 2026';

  const filteredDeals = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    return attioDeals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (filters.show === 'seen' && !d.seen) return false;
      if (filters.show === 'missed' && d.seen) return false;
      if (d.date) { const dNum = quarterToNum(d.date); if (dNum < fromNum || dNum > toNum) return false; }
      return true;
    }).sort((a, b) => new Date(b.announcedDate) - new Date(a.announcedDate));
  }, [attioDeals, filters, effectiveFrom, effectiveTo]);

  const stats = useMemo(() => {
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const filtered = attioDeals.filter(d => {
      if (filters.country !== 'all' && d.filterRegion !== filters.country) return false;
      if (filters.stage !== 'all' && d.stage !== filters.stage) return false;
      if (d.date) { const dNum = quarterToNum(d.date); if (dNum < fromNum || dNum > toNum) return false; }
      return true;
    });
    const seenCount = filtered.filter(d => d.seen).length;
    const coverage = filtered.length > 0 ? Math.round((seenCount / filtered.length) * 100) : 0;
    return { total: filtered.length, seen: seenCount, coverage };
  }, [attioDeals, filters, effectiveFrom, effectiveTo]);

  const coverageByRegion = useMemo(() => calculateCoverageByRegion(attioDeals), [attioDeals]);

  const pieData = useMemo(() => {
    const stageData = {};
    const outcomeData = {};
    attioDeals.forEach(d => {
      stageData[d.stage] = (stageData[d.stage] || 0) + 1;
      outcomeData[d.outcome] = (outcomeData[d.outcome] || 0) + 1;
    });
    return { stageData, outcomeData };
  }, [attioDeals]);

  const quarterlyData = useMemo(() => {
    const byQ = {};
    attioDeals.forEach(d => {
      if (!d.date) return;
      if (!byQ[d.date]) byQ[d.date] = { total: 0, seen: 0 };
      byQ[d.date].total++;
      if (d.seen) byQ[d.date].seen++;
    });
    const fromNum = quarterToNum(effectiveFrom);
    const toNum = quarterToNum(effectiveTo);
    const filtered = allQuarters.filter(q => { const n = quarterToNum(q); return n >= fromNum && n <= toNum; });
    const labels = filtered;
    const dealCounts = filtered.map(q => (byQ[q]?.total || 0));
    const coverageRates = filtered.map(q => byQ[q]?.total > 0 ? Math.round((byQ[q].seen / byQ[q].total) * 100) : 0);
    const trailing = coverageRates.map((_, i) => {
      if (i < 3) return null;
      const slice = coverageRates.slice(i - 3, i + 1);
      return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    });
    return { labels, dealCounts, coverageRates, trailing };
  }, [attioDeals, effectiveFrom, effectiveTo, allQuarters]);

  // ─── Shadow Portfolio — ONLY deals we saw, analysed, and passed on ──
  // This is NOT about deals we missed. Those belong in Coverage.
  // Shadow = we had a thesis, we made a prediction, we said no.
  // Now the market tells us if we were right.
  const shadowPortfolio = useMemo(() => {
    const fromAttio = attioDeals
      .filter(d => d.outcome === 'Passed') // Only passed — we actively decided "no"
      .map(d => {
        const companyKey = (d.company || '').toLowerCase().trim();
        const callData = callRatingsMap[companyKey];
        return {
          ...d,
          marketScore: computeMarketScore(d),
          ourCallRating: callData?.avgRating || d.rating || null,
          callCount: callData?.meetings?.length || 0,
          passReason: PASS_REASONS[d.status] || 'Reviewed and passed',
          timeAgo: monthsAgo(d.announcedDate),
        };
      });

    // Merge hardcoded shadow deals (not in Attio)
    const hardcoded = HARDCODED_SHADOW_DEALS.map(d => ({
      ...d,
      marketScore: d._shadowOverride?.marketScore ?? computeMarketScore(d),
      ourCallRating: d._shadowOverride?.ourCallRating ?? d.rating ?? null,
      callCount: d._shadowOverride?.callCount ?? 0,
      passReason: d._shadowOverride?.passReason ?? 'Reviewed and passed',
      timeAgo: monthsAgo(d.announcedDate),
    }));

    return [...fromAttio, ...hardcoded].sort((a, b) => b.marketScore - a.marketScore);
  }, [attioDeals, callRatingsMap]);

  // ─── Scorecard data ────────────────────────────────────
  const scorecard = useMemo(() => {
    const total = attioDeals.length;
    if (total === 0) return null;

    const seen = attioDeals.filter(d => d.seen).length;
    const passed = attioDeals.filter(d => d.outcome === 'Passed').length;
    const missed = attioDeals.filter(d => d.outcome === 'Missed').length;
    const invested = attioDeals.filter(d => d.outcome === 'Invested').length;
    const ic = attioDeals.filter(d => d.outcome === 'IC').length;
    const dd = attioDeals.filter(d => d.outcome === 'DD').length;

    const seenToDD = seen > 0 ? Math.round((dd + ic + invested) / seen * 100) : 0;
    const ddToIC = (dd + ic + invested) > 0 ? Math.round((ic + invested) / (dd + ic + invested) * 100) : 0;
    const icToInvested = (ic + invested) > 0 ? Math.round(invested / (ic + invested) * 100) : 0;
    const passRate = seen > 0 ? Math.round(passed / seen * 100) : 0;

    const highConvictionMisses = attioDeals.filter(d => (d.outcome === 'Passed' || d.outcome === 'Missed') && d.rating >= 6);

    const passedByRegion = {};
    const passedByStage = {};
    attioDeals.filter(d => d.outcome === 'Passed' || d.outcome === 'Missed').forEach(d => {
      passedByRegion[d.filterRegion] = (passedByRegion[d.filterRegion] || 0) + 1;
      passedByStage[d.stage] = (passedByStage[d.stage] || 0) + 1;
    });

    const ratingByOutcome = {};
    attioDeals.filter(d => d.rating).forEach(d => {
      if (!ratingByOutcome[d.outcome]) ratingByOutcome[d.outcome] = { sum: 0, count: 0 };
      ratingByOutcome[d.outcome].sum += d.rating;
      ratingByOutcome[d.outcome].count++;
    });
    const avgRatingByOutcome = {};
    for (const [outcome, { sum, count }] of Object.entries(ratingByOutcome)) {
      avgRatingByOutcome[outcome] = (sum / count).toFixed(1);
    }

    const ratedDeals = attioDeals.filter(d => d.rating);
    const highRatedGoodOutcome = ratedDeals.filter(d => d.rating >= 6 && (d.outcome === 'Invested' || d.outcome === 'IC' || d.outcome === 'DD')).length;
    const highRatedTotal = ratedDeals.filter(d => d.rating >= 6).length;
    const judgmentAccuracy = highRatedTotal > 0 ? Math.round(highRatedGoodOutcome / highRatedTotal * 100) : null;

    return {
      total, seen, passed, missed, invested, ic, dd,
      seenToDD, ddToIC, icToInvested, passRate,
      highConvictionMisses,
      passedByRegion, passedByStage,
      avgRatingByOutcome,
      judgmentAccuracy,
    };
  }, [attioDeals]);

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 20, boxHeight: 2, font: { size: 11 }, color: 'var(--text-tertiary)', usePointStyle: false, padding: 16 } },
      tooltip: { callbacks: { label: (ctx) => ctx.dataset.yAxisID === 'y' ? `${ctx.dataset.label}: ${ctx.parsed.y}%` : `${ctx.dataset.label}: ${ctx.parsed.y}` } }
    },
    scales: {
      y: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { callback: v => v + '%', color: 'var(--text-tertiary)' }, grid: { color: 'var(--border-subtle)' } },
      y1: { type: 'linear', position: 'right', min: 0, ticks: { color: 'var(--text-tertiary)', precision: 0 }, grid: { drawOnChartArea: false } },
      x: { ticks: { color: 'var(--text-tertiary)' }, grid: { color: 'var(--border-subtle)' } }
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

      {subTab === 'overview' && <OverviewTab attioDeals={attioDeals} filteredDeals={filteredDeals} filters={filters} setFilters={setFilters} effectiveFrom={effectiveFrom} effectiveTo={effectiveTo} allQuarters={allQuarters} stats={stats} coverageByRegion={coverageByRegion} pieData={pieData} quarterlyData={quarterlyData} chartOptions={chartOptions} pieOptions={pieOptions} theme={theme} setSelectedDeal={setSelectedDeal} />}
      {subTab === 'shadow' && <ShadowPortfolioTab shadowPortfolio={shadowPortfolio} attioDeals={attioDeals} setSelectedDeal={setSelectedDeal} />}
      {subTab === 'scorecard' && <ScorecardTab scorecard={scorecard} attioDeals={attioDeals} shadowPortfolio={shadowPortfolio} />}

      <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </div>
  );
}

// ─── Overview Tab (unchanged) ─────────────────────────────

function OverviewTab({ attioDeals, filteredDeals, filters, setFilters, effectiveFrom, effectiveTo, allQuarters, stats, coverageByRegion, pieData, quarterlyData, chartOptions, pieOptions, theme, setSelectedDeal }) {
  return (
    <>
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <FilterSelect label="Country" value={filters.country} onChange={(v) => setFilters({ ...filters, country: v })} options={[{ value: 'all', label: 'All Countries' }, { value: 'France', label: 'France' }, { value: 'Germany', label: 'Germany & Benelux' }, { value: 'Nordics', label: 'Nordics' }, { value: 'Southern Europe', label: 'Southern Europe' }, { value: 'Eastern Europe', label: 'Eastern Europe' }, { value: 'Other', label: 'Other (UK, etc.)' }]} />
          <FilterSelect label="Stage" value={filters.stage} onChange={(v) => setFilters({ ...filters, stage: v })} options={[{ value: 'all', label: 'All Stages' }, { value: 'Pre-Seed', label: 'Pre-Seed' }, { value: 'Seed', label: 'Seed' }, { value: 'Series A', label: 'Series A' }, { value: 'Series B', label: 'Series B' }, { value: 'Series C', label: 'Series C' }, { value: 'Venture', label: 'Venture' }]} />
          <FilterSelect label="From" value={effectiveFrom} onChange={(v) => setFilters({ ...filters, from: v })} options={allQuarters.map(q => ({ value: q, label: q }))} />
          <FilterSelect label="To" value={effectiveTo} onChange={(v) => setFilters({ ...filters, to: v })} options={allQuarters.map(q => ({ value: q, label: q }))} />
          <FilterSelect label="Show" value={filters.show} onChange={(v) => setFilters({ ...filters, show: v })} options={[{ value: 'all', label: 'All Deals' }, { value: 'seen', label: 'Seen Only' }, { value: 'missed', label: 'Missed Only' }]} />
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="text-[var(--text-tertiary)]">{stats.total} deals · {stats.seen} seen</span>
            <span className="px-2 py-1 rounded-md bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)] font-semibold">{stats.coverage}% coverage</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Coverage Rate</h3><p className="text-xs text-[var(--text-tertiary)]">Historical coverage over time</p></div>
            <div className="text-right"><span className="text-3xl font-bold text-[var(--rrw-red)]">{stats.coverage}%</span><span className="text-xs text-[var(--text-tertiary)] block">Current</span></div>
          </div>
          <div className="h-72">
            <Bar data={{ labels: quarterlyData.labels, datasets: [
              { type: 'bar', label: 'Deals tracked', data: quarterlyData.dealCounts, backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 3, yAxisID: 'y1', order: 2 },
              { type: 'line', label: 'Coverage %', data: quarterlyData.coverageRates, borderColor: chartColors.rrwRed, backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, pointBackgroundColor: chartColors.rrwRed, yAxisID: 'y', order: 0 },
              { type: 'line', label: '12-mo trailing avg', data: quarterlyData.trailing, borderColor: theme === 'dark' ? '#c2c0b6' : '#141413', backgroundColor: 'transparent', borderDash: [6, 3], borderWidth: 1.5, tension: 0.3, pointRadius: 0, spanGaps: false, yAxisID: 'y', order: 1 },
            ]}} options={chartOptions} />
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Deal Coverage</h3><p className="text-xs text-[var(--text-tertiary)]">{filteredDeals.length} deals</p></div>
          </div>
          <div className="border border-[var(--border-default)] rounded-lg overflow-hidden flex-1 max-h-80 overflow-y-auto">
            {filteredDeals.length === 0 ? <div className="p-8 text-center text-[var(--text-tertiary)]">No deals match your filters</div> : filteredDeals.map(deal => <DealRow key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />)}
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
        <PieCard title="Dealflow by region" labels={Object.keys(coverageByRegion)} data={Object.values(coverageByRegion).map(v => v.total)} options={pieOptions} />
        <PieCard title="Dealflow by stage" labels={Object.keys(pieData.stageData)} data={Object.values(pieData.stageData)} options={pieOptions} />
        <PieCard title="Outcome breakdown" labels={Object.keys(pieData.outcomeData)} data={Object.values(pieData.outcomeData)} options={pieOptions} />
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-semibold text-[var(--text-primary)]">Outcome Summary</h3><p className="text-xs text-[var(--text-tertiary)]">Derived from Attio status</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(pieData.outcomeData).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
            <div key={outcome} className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium mb-1 ${OUTCOME_STYLES[outcome] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>{outcome}</span>
              <div className="text-xl font-bold text-[var(--text-primary)]">{count}</div>
              <div className="text-[11px] text-[var(--text-quaternary)]">{attioDeals.length > 0 ? Math.round((count / attioDeals.length) * 100) : 0}%</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Shadow Portfolio Tab — REBUILT ───────────────────────

function ShadowPortfolioTab({ shadowPortfolio, attioDeals, setSelectedDeal }) {
  const [sortBy, setSortBy] = useState('market'); // market | amount | rating | date
  const [shadowFilter, setShadowFilter] = useState('all'); // all | wrong | right | tbd
  const [expandedDeal, setExpandedDeal] = useState(null);

  const filtered = useMemo(() => {
    let list = shadowPortfolio;
    if (shadowFilter === 'wrong') list = list.filter(d => d.marketScore >= 6);
    if (shadowFilter === 'right') list = list.filter(d => d.marketScore <= 2);
    if (shadowFilter === 'tbd') list = list.filter(d => d.marketScore > 2 && d.marketScore < 6);

    if (sortBy === 'amount') return [...list].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    if (sortBy === 'rating') return [...list].sort((a, b) => (b.ourCallRating || 0) - (a.ourCallRating || 0));
    if (sortBy === 'date') return [...list].sort((a, b) => new Date(b.announcedDate) - new Date(a.announcedDate));
    return list; // market score is default sort
  }, [shadowPortfolio, shadowFilter, sortBy]);

  const wrongCount = shadowPortfolio.filter(d => d.marketScore >= 6).length;
  const rightCount = shadowPortfolio.filter(d => d.marketScore <= 2).length;
  const tbdCount = shadowPortfolio.filter(d => d.marketScore > 2 && d.marketScore < 6).length;
  const avgMarket = shadowPortfolio.length > 0
    ? (shadowPortfolio.reduce((sum, d) => sum + d.marketScore, 0) / shadowPortfolio.length).toFixed(1) : '0';

  // Average of our call ratings across all shadow deals
  const ratedShadow = shadowPortfolio.filter(d => d.ourCallRating);
  const avgOurRating = ratedShadow.length > 0
    ? (ratedShadow.reduce((sum, d) => sum + d.ourCallRating, 0) / ratedShadow.length).toFixed(1) : null;

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <StatCard label="Deals Passed" value={shadowPortfolio.length} sub="We saw, analysed, and said no" />
        <StatCard label="We Were Wrong" value={wrongCount} sub="They raised $30M+ after" color="text-red-500" />
        <StatCard label="We Were Right" value={rightCount} sub="No significant follow-on" color="text-emerald-500" />
        <StatCard label="Too Early to Tell" value={tbdCount} sub="Outcome still developing" />
        {avgOurRating && <StatCard label="Our Avg Call Rating" value={avgOurRating + '/10'} sub={`vs ${avgMarket}/10 market avg`} />}
        {!avgOurRating && <StatCard label="Avg Market Score" value={avgMarket + '/10'} sub="Objective outcome" />}
      </div>

      {/* How it works */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-start gap-6 text-[11px] text-[var(--text-tertiary)]">
          <div><span className="font-semibold text-[var(--text-secondary)]">Market Score</span> = what happened after we passed. Pure facts, no opinions.</div>
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
            options={[{ value: 'all', label: 'All Passes' }, { value: 'wrong', label: 'We Were Wrong' }, { value: 'right', label: 'We Were Right' }, { value: 'tbd', label: 'Too Early to Tell' }]} />
          <FilterSelect label="Sort by" value={sortBy} onChange={setSortBy}
            options={[{ value: 'market', label: 'Market Score' }, { value: 'amount', label: 'Amount Raised' }, { value: 'rating', label: 'Our Call Rating' }, { value: 'date', label: 'Most Recent' }]} />
          <div className="ml-auto text-[13px] text-[var(--text-tertiary)]">{filtered.length} deals</div>
        </div>
      </div>

      {/* Deal List with Expandable Cards */}
      <div className="space-y-2 mb-4">
        {filtered.length === 0 ? (
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-8 text-center text-[var(--text-tertiary)]">No shadow deals found</div>
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

// ─── Shadow Deal Card — the core learning unit ───────────

function ShadowDealCard({ deal, expanded, onToggle }) {
  const marketColor = deal.marketScore >= 8 ? 'text-red-500 bg-red-500/10' :
                      deal.marketScore >= 6 ? 'text-amber-500 bg-amber-500/10' :
                      deal.marketScore >= 4 ? 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]' :
                      'text-emerald-500 bg-emerald-500/10';

  // Determine verdict — all shadow deals are Passed
  const isWrong = deal.marketScore >= 6;
  const isRight = deal.marketScore <= 2;
  const isTBD = !isWrong && !isRight;

  // Truth: what actually happened (use override if available)
  const truthLines = deal._shadowOverride?.truthLines || (() => {
    const lines = [];
    if (deal.amount > 0) lines.push(`Raised €${deal.amount}M`);
    if (deal.totalFunding) lines.push(`Total funding: ${deal.totalFunding}`);
    if (deal.stage) lines.push(`Reached ${deal.stage}`);
    if (deal.employeeRange) lines.push(`Team: ${deal.employeeRange}`);
    return lines;
  })();

  return (
    <div className={`bg-[var(--bg-primary)] border rounded-lg overflow-hidden transition-all ${
      isWrong ? 'border-red-500/30' : isRight ? 'border-emerald-500/20' : isTBD ? 'border-[var(--border-default)]' : 'border-[var(--border-default)]'
    }`}>
      {/* Header Row — always visible */}
      <div className="p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-6 h-6 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--text-primary)] truncate">{deal.company}</span>
                <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{deal.country} · {deal.stage}</span>
              </div>
              <div className="text-[11px] text-[var(--text-quaternary)]">
                {formatMonth(deal.announcedDate)}
                {deal.amount > 0 && ` · €${deal.amount}M`}
                {deal.callCount > 0 && ` · ${deal.callCount} call${deal.callCount > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Our call rating */}
            {deal.ourCallRating && (
              <div className="text-center">
                <div className="text-[10px] text-[var(--text-quaternary)]">Our call</div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{deal.ourCallRating}/10</div>
              </div>
            )}
            {/* Market score */}
            <div className="text-center">
              <div className="text-[10px] text-[var(--text-quaternary)]">Market</div>
              <div className={`text-[15px] font-bold px-2 py-0.5 rounded ${marketColor}`}>{deal.marketScore}/10</div>
            </div>
            {/* Verdict badge */}
            {isWrong && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-500">Wrong</span>}
            {isRight && <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">Right</span>}
            {isTBD && <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]">TBD</span>}
            {/* Expand arrow */}
            <svg className={`w-4 h-4 text-[var(--text-quaternary)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded section — Prediction vs Truth vs Learning */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Our Prediction */}
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Our Prediction</div>
              <div className="text-[13px] text-[var(--text-primary)] mb-2">{deal.passReason}</div>
              {deal.ourCallRating && (
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Avg call rating: <span className="font-semibold">{deal.ourCallRating}/10</span> across {deal.callCount} call{deal.callCount > 1 ? 's' : ''}
                </div>
              )}
              {deal.rating && (
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Deal rating: <span className="font-semibold">{deal.rating}/10</span>
                </div>
              )}
              {!deal.ourCallRating && !deal.rating && (
                <div className="text-[12px] text-[var(--text-quaternary)] italic">No ratings recorded</div>
              )}
            </div>

            {/* Truth */}
            <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Truth</div>
              {truthLines.length > 0 ? (
                <div className="space-y-1">
                  {truthLines.map((line, i) => (
                    <div key={i} className="text-[13px] text-[var(--text-primary)]">{line}</div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--text-quaternary)] italic">No follow-on data yet</div>
              )}
              {deal.industry?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {deal.industry.slice(0, 3).map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] text-[10px] rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Learning */}
            <div className={`p-3 rounded-lg border ${
              isWrong ? 'bg-red-500/5 border-red-500/20' :
              isRight ? 'bg-emerald-500/5 border-emerald-500/20' :
              'bg-[var(--bg-secondary)] border-[var(--border-subtle)]'
            }`}>
              <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Learning</div>
              {deal._shadowOverride?.learningText ? (
                <div className={`text-[13px] mb-1 ${isWrong ? 'text-red-500' : isRight ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>
                  {deal._shadowOverride.learningText}
                </div>
              ) : (
                <>
                  {isWrong && (
                    <div className="text-[13px] text-red-500 font-medium mb-1">
                      We were wrong. They went on to raise significantly.
                    </div>
                  )}
                  {isRight && (
                    <div className="text-[13px] text-emerald-500 font-medium mb-1">
                      Good pass — confirmed by market.
                    </div>
                  )}
                  {isTBD && (
                    <div className="text-[13px] text-[var(--text-secondary)] mb-1">
                      Outcome still developing. Check back later.
                    </div>
                  )}
                </>
              )}
              {/* Delta between our call and market */}
              {deal.ourCallRating && (
                <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Delta: <span className="font-semibold">
                    {deal.marketScore > deal.ourCallRating ? '+' : ''}{(deal.marketScore - deal.ourCallRating).toFixed(1)}
                  </span>
                  {' '}(market vs our call)
                </div>
              )}
              {deal.timeAgo !== null && (
                <div className="text-[11px] text-[var(--text-quaternary)] mt-1">
                  {deal.timeAgo <= 1 ? 'This month' : deal.timeAgo < 12 ? `${deal.timeAgo} months ago` : `${Math.round(deal.timeAgo / 12)} years ago`}
                </div>
              )}
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
  const passedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Passed').length);
  const missedByRating = bucketRange.map(([lo, hi]) => attioDeals.filter(d => d.rating >= lo && d.rating <= hi && d.outcome === 'Missed').length);

  // 4-quadrant analysis (Sequoia style)
  const quadrants = useMemo(() => {
    const invested = attioDeals.filter(d => d.outcome === 'Invested');
    const passed = attioDeals.filter(d => d.outcome === 'Passed');
    // For now, use deal amount as proxy for success signal
    const truePositives = invested.length; // We invested (all are "positive" decisions)
    const falseNegatives = shadowPortfolio.filter(d => d.outcome === 'Passed' && d.marketScore >= 6).length;
    const trueNegatives = shadowPortfolio.filter(d => d.outcome === 'Passed' && d.marketScore <= 2).length;
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
        <StatCard label="Total Deals" value={scorecard.total} sub="All tracked" />
        <StatCard label="Coverage" value={Math.round(scorecard.seen / scorecard.total * 100) + '%'} sub={`${scorecard.seen} of ${scorecard.total}`} />
        <StatCard label="Pass Rate" value={scorecard.passRate + '%'} sub={`${scorecard.passed} of ${scorecard.seen} seen`} />
        <StatCard label="Invested" value={scorecard.invested} sub={scorecard.seen > 0 ? Math.round(scorecard.invested / scorecard.seen * 100) + '% of seen' : ''} color="text-emerald-500" />
        <StatCard label="Seen to DD+" value={scorecard.seenToDD + '%'} sub="Conversion" />
        {scorecard.judgmentAccuracy !== null && <StatCard label="Rating Accuracy" value={scorecard.judgmentAccuracy + '%'} sub="Rated 6+ that reached DD/IC/Invest" color={scorecard.judgmentAccuracy >= 50 ? 'text-emerald-500' : 'text-amber-500'} />}
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
          <FunnelStep label="Seen" value={scorecard.seen} />
          <FunnelArrow pct={scorecard.seenToDD} />
          <FunnelStep label="DD+" value={scorecard.dd + scorecard.ic + scorecard.invested} />
          <FunnelArrow pct={scorecard.ddToIC} />
          <FunnelStep label="IC+" value={scorecard.ic + scorecard.invested} />
          <FunnelArrow pct={scorecard.icToInvested} />
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
              { label: 'Passed', data: passedByRating, backgroundColor: 'rgba(156, 163, 175, 0.5)', borderRadius: 3 },
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

function DealRow({ deal, onClick }) {
  const ratingColor = deal.rating >= 7 ? 'text-emerald-500' : deal.rating >= 4 ? 'text-amber-500' : deal.rating ? 'text-red-500' : 'text-[var(--text-quaternary)]';
  const outcomeStyle = OUTCOME_STYLES[deal.outcome] || 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]';
  return (
    <div className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors" onClick={onClick}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {deal.logoUrl && <img src={deal.logoUrl} alt="" className="w-5 h-5 rounded object-contain bg-[var(--bg-tertiary)] shrink-0" />}
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
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${deal.seen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>{deal.seen ? 'Seen' : 'Missed'}</span>
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
      <div className="text-[11px] text-[var(--text-quaternary)]">{data.seen}/{data.total} seen</div>
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
          <InfoCard label="Outcome" value={deal.outcome} highlight={deal.outcome === 'Invested' || deal.outcome === 'IC'} />
          <InfoCard label="Attio Status" value={deal.status || '—'} />
          <InfoCard label="Rating" value={deal.rating ? deal.rating + '/10' : 'Not rated'} highlight={deal.rating >= 7} />
          <InfoCard label="Total Funding" value={deal.totalFunding || '—'} />
          <InfoCard label="Team Size" value={deal.employeeRange || '—'} />
          {deal.marketScore !== undefined && <InfoCard label="Market Score" value={deal.marketScore + '/10'} highlight={deal.marketScore <= 2} />}
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-2.5 py-1 rounded text-[12px] font-medium ${deal.seen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{deal.seen ? 'Seen' : 'Missed'}</span>
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
