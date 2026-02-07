import { useState, useMemo } from 'react';
import { useAttioPortfolio, BOARD_MEMBERS, formatFunding } from '../hooks/useAttioPortfolio';
import {
  FUND_DEFINITIONS,
  HEALTH_CONFIG,
  DESTINY_CONFIG,
  US_EXPANSION_CONFIG,
  PORTFOLIO_METRICS,
  computeHealth,
  computeDestinyControl,
  buildMetricsMap,
  computePortfolioSummary,
} from '../data/portfolioMetrics';

// ─── Trend Arrow SVGs ──────────────────────────────────────────────
const TrendArrow = ({ trend }) => {
  if (trend === 'up') return <span className="text-[#10B981]">&#9650;</span>;
  if (trend === 'down') return <span className="text-[#EF4444]">&#9660;</span>;
  return <span className="text-[var(--text-quaternary)]">&#9644;</span>;
};

// ─── Small Logo Component ──────────────────────────────────────────
const CompanyLogo = ({ url, name, size = 32 }) => {
  const sizeClass = size === 32 ? 'w-8 h-8' : size === 20 ? 'w-5 h-5' : 'w-6 h-6';
  const textSize = size === 32 ? 'text-[12px]' : 'text-[8px]';
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-md object-contain bg-white border border-[var(--border-subtle)] flex-shrink-0`}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-quaternary)] ${textSize} font-bold flex-shrink-0`}>
      {name?.charAt(0)}
    </div>
  );
};

// ─── Health Badge ──────────────────────────────────────────────────
const HealthBadge = ({ health, compact = false }) => {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.amber;
  return (
    <span
      className={`inline-flex items-center gap-1 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'} rounded-full font-medium`}
      style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
};

// ─── Destiny Badge ─────────────────────────────────────────────────
const DestinyBadge = ({ destiny, compact = false }) => {
  const cfg = DESTINY_CONFIG[destiny] || DESTINY_CONFIG.at_risk;
  return (
    <span
      className={`inline-flex items-center gap-1 ${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'} rounded-full font-medium`}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
};

// ─── US Expansion Badge ────────────────────────────────────────────
const USBadge = ({ status }) => {
  const cfg = US_EXPANSION_CONFIG[status] || US_EXPANSION_CONFIG.none;
  if (status === 'none') return <span className="text-[10px]" style={{ color: cfg.color }}>—</span>;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
};

// ─── Fund Chip ─────────────────────────────────────────────────────
const FundChip = ({ fundId, small = false }) => {
  const fund = FUND_DEFINITIONS.find(f => f.id === fundId);
  if (!fund) return null;
  return (
    <span
      className={`inline-flex items-center ${small ? 'px-1 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'} rounded font-bold text-white`}
      style={{ backgroundColor: fund.color }}
    >
      {fund.shortLabel}
    </span>
  );
};

// ─── Drive Folder Button ───────────────────────────────────────────
const DriveButton = ({ url }) => (
  <button
    onClick={(e) => { e.stopPropagation(); if (url) window.open(url, '_blank'); }}
    className={`p-1 rounded transition-all ${url ? 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]' : 'text-[var(--text-quaternary)] opacity-40 cursor-default'}`}
    title={url ? 'Open Drive folder' : 'Drive folder — coming soon'}
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  </button>
);

// ─── Company Detail Modal ──────────────────────────────────────────
function CompanyDetailModal({ company, onClose }) {
  if (!company) return null;
  const m = company.metrics;
  const health = company.health;
  const destiny = company.destiny;
  const boardMembers = company.boardMembers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-[var(--bg-primary)] rounded-xl border border-[var(--border-default)] shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-primary)] border-b border-[var(--border-default)] p-5 rounded-t-xl flex items-start gap-4">
          <CompanyLogo url={company.logoUrl} name={company.name} size={32} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg text-[var(--text-primary)]">{company.name}</div>
            <div className="text-[12px] text-[var(--text-tertiary)]">
              {company.domain || '—'}
              {m?.sector && ` · ${m.sector}`}
              {company.location && ` · ${company.location}`}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-quaternary)] hover:text-[var(--text-primary)] transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {m ? (
            <>
              {/* Investment */}
              <div>
                <h4 className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider mb-2">Investment</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)]">Fund</div>
                    <div className="mt-1"><FundChip fundId={m.fund} /></div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)]">Ownership</div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5">
                      {m.ownership != null ? `${m.ownership}%` : '—'}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)]">Invested</div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5">
                      {m.invested != null ? `${m.invested}M` : '—'}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)]">Total Funding</div>
                    <div className="text-[15px] font-bold text-[var(--text-primary)] mt-0.5">
                      {company.totalFunding || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Health & Destiny */}
              <div>
                <h4 className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider mb-2">Health & Destiny Control</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)] mb-1">Runway</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-[var(--text-primary)]">{m.runwayMonths}m</span>
                      <TrendArrow trend={m.runwayTrend} />
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)] mb-1">Health</div>
                    <HealthBadge health={health} />
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)] mb-1">Destiny Control</div>
                    <DestinyBadge destiny={destiny} />
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                    <div className="text-[10px] text-[var(--text-quaternary)] mb-1">Can Raise</div>
                    <span className={`text-[13px] font-semibold ${m.canRaise ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {m.canRaise ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* US Expansion */}
              <div>
                <h4 className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider mb-2">US Expansion</h4>
                <USBadge status={m.usExpansion} />
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-[var(--text-quaternary)] text-[13px]">
              No monitoring data available
            </div>
          )}

          {/* Description */}
          {company.description && (
            <div>
              <h4 className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider mb-2">About</h4>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">{company.description}</p>
            </div>
          )}

          {/* Board Members */}
          {boardMembers.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider mb-2">Board Representation</h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                {boardMembers.map((bm, i) => {
                  const color = BOARD_MEMBERS.find(b => b.name === bm.name)?.color || '#6B7280';
                  return (
                    <span
                      key={i}
                      className="px-2 py-1 rounded text-[11px] font-medium text-white"
                      style={{ backgroundColor: color }}
                    >
                      {bm.name}{bm.role === 'observer' ? ' (obs)' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)]">
            <button
              onClick={() => m?.driveFolderUrl && window.open(m.driveFolderUrl, '_blank')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                m?.driveFolderUrl
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] opacity-50 cursor-default'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {m?.driveFolderUrl ? 'Open Drive Folder' : 'Drive Folder — Coming Soon'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Portfolio Page
// ═══════════════════════════════════════════════════════════════════
export default function Portfolio() {
  const { companies, loading, isLive } = useAttioPortfolio();
  const [selectedFund, setSelectedFund] = useState('all');
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const metricsMap = useMemo(() => buildMetricsMap(PORTFOLIO_METRICS), []);

  // ─── Enrich companies with metrics ─────────────────────────────
  const enrichedCompanies = useMemo(() => {
    return companies.map(company => {
      const key = company.name?.toLowerCase().trim();
      const metrics = metricsMap[key] || null;
      return {
        ...company,
        metrics,
        health: metrics ? computeHealth(metrics) : null,
        destiny: metrics ? computeDestinyControl(metrics) : null,
      };
    });
  }, [companies, metricsMap]);

  // ─── Summary stats ─────────────────────────────────────────────
  const summary = useMemo(() => computePortfolioSummary(PORTFOLIO_METRICS), []);

  // ─── Fund counts ───────────────────────────────────────────────
  const fundCounts = useMemo(() => {
    const counts = { all: enrichedCompanies.length };
    FUND_DEFINITIONS.forEach(f => {
      counts[f.id] = enrichedCompanies.filter(c => c.metrics?.fund === f.id).length;
    });
    return counts;
  }, [enrichedCompanies]);

  // ─── Board member breakdown ────────────────────────────────────
  const teamBreakdown = useMemo(() => {
    const byMember = {};
    enrichedCompanies.forEach(company => {
      (company.boardMembers || []).forEach(bm => {
        if (!byMember[bm.name]) {
          byMember[bm.name] = { count: 0, totalInvested: 0 };
        }
        byMember[bm.name].count++;
        if (company.metrics?.invested) {
          byMember[bm.name].totalInvested += company.metrics.invested;
        }
      });
    });
    return Object.entries(byMember).sort((a, b) => b[1].count - a[1].count);
  }, [enrichedCompanies]);

  // ─── Filtered + sorted companies ───────────────────────────────
  const displayedCompanies = useMemo(() => {
    let list = enrichedCompanies;

    // Fund filter
    if (selectedFund !== 'all') {
      list = list.filter(c => c.metrics?.fund === selectedFund);
    }

    // Board member filter
    if (selectedMember && selectedMember !== '__none__') {
      list = list.filter(c => (c.boardMembers || []).some(bm => bm.name === selectedMember));
    } else if (selectedMember === '__none__') {
      list = list.filter(c => (c.boardMembers || []).length === 0);
    }

    // Sort: red first → amber → green, within each by runway ascending
    const healthOrder = { red: 0, amber: 1, green: 2 };
    list = [...list].sort((a, b) => {
      const ha = healthOrder[a.health] ?? 1;
      const hb = healthOrder[b.health] ?? 1;
      if (ha !== hb) return ha - hb;
      const ra = a.metrics?.runwayMonths ?? 99;
      const rb = b.metrics?.runwayMonths ?? 99;
      return ra - rb;
    });

    return list;
  }, [enrichedCompanies, selectedFund, selectedMember]);

  const getMemberColor = (name) => BOARD_MEMBERS.find(m => m.name === name)?.color || '#6B7280';

  // ─── Loading state ─────────────────────────────────────────────
  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading portfolio from Attio...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sync status */}
      {isLive && loading && (
        <div className="flex items-center justify-end mb-1">
          <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>
        </div>
      )}

      {/* ═══ Filter Bar ═══ */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        {/* Fund filters */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-12">Fund</span>
          <button
            onClick={() => setSelectedFund('all')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              selectedFund === 'all'
                ? 'bg-[var(--rrw-red)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            All ({fundCounts.all})
          </button>
          {FUND_DEFINITIONS.map(f => {
            const isActive = selectedFund === f.id;
            const count = fundCounts[f.id] || 0;
            if (count === 0) return null;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFund(isActive ? 'all' : f.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={isActive ? { backgroundColor: f.color } : {}}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Board member filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-12">Board</span>
          <button
            onClick={() => setSelectedMember(null)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              !selectedMember
                ? 'bg-[var(--rrw-red)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            All
          </button>
          {teamBreakdown.map(([name, data]) => {
            const color = getMemberColor(name);
            const isActive = selectedMember === name;
            return (
              <button
                key={name}
                onClick={() => setSelectedMember(isActive ? null : name)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={isActive ? { backgroundColor: color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {name}
                <span className={`text-[9px] ${isActive ? 'text-white/70' : 'text-[var(--text-quaternary)]'}`}>
                  {data.count}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setSelectedMember(selectedMember === '__none__' ? null : '__none__')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              selectedMember === '__none__'
                ? 'bg-[var(--text-quaternary)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            No seat
          </button>
        </div>
      </div>

      {/* ═══ Health Summary Strip ═══ */}
      <div className="flex items-center gap-6 mb-4 px-1">
        <div className="flex items-center gap-4">
          {['green', 'amber', 'red'].map(h => (
            <div key={h} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: HEALTH_CONFIG[h].dot }} />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{summary.healthCounts[h]}</span>
              <span className="text-[11px] text-[var(--text-quaternary)]">{HEALTH_CONFIG[h].label}</span>
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-[var(--text-quaternary)]">
            <span className="font-semibold text-[var(--text-secondary)]">{summary.companyCount}</span> companies
          </span>
          <span className="text-[var(--text-quaternary)]">
            <span className="font-semibold text-[var(--text-secondary)]">{summary.totalInvested.toFixed(1)}M</span> invested
          </span>
          <span className="text-[var(--text-quaternary)]">
            <span className="font-semibold text-[var(--text-secondary)]">{summary.avgOwnership.toFixed(1)}%</span> avg ownership
          </span>
        </div>
      </div>

      {/* ═══ Hero: Health Matrix Table ═══ */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[220px]">Company</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[70px]">Runway</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[90px]">Destiny</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[65px]">US</th>
                <th className="text-right py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[60px]">Own%</th>
                <th className="text-right py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[65px]">Invested</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[45px]">Fund</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[80px]">Health</th>
                <th className="text-center py-2.5 px-2 text-[10px] font-semibold text-[var(--text-quaternary)] uppercase tracking-wider w-[100px]">Board</th>
                <th className="w-[30px]"></th>
              </tr>
            </thead>
            <tbody>
              {displayedCompanies.map((company, idx) => {
                const m = company.metrics;
                const healthColor = HEALTH_CONFIG[company.health]?.dot || HEALTH_CONFIG.amber.dot;
                const boardMembers = company.boardMembers || [];

                return (
                  <tr
                    key={company.id || idx}
                    onClick={() => setSelectedCompany(company)}
                    className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                  >
                    {/* Company */}
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: healthColor }} />
                        <CompanyLogo url={company.logoUrl} name={company.name} size={20} />
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text-primary)] truncate">{company.name}</div>
                          {m?.sector && (
                            <div className="text-[9px] text-[var(--text-quaternary)] truncate">{m.sector}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Runway */}
                    <td className="text-center py-2 px-2">
                      {m ? (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="font-semibold text-[var(--text-primary)]">{m.runwayMonths}m</span>
                          <TrendArrow trend={m.runwayTrend} />
                        </span>
                      ) : (
                        <span className="text-[var(--text-quaternary)]">—</span>
                      )}
                    </td>

                    {/* Destiny */}
                    <td className="text-center py-2 px-2">
                      {company.destiny ? <DestinyBadge destiny={company.destiny} compact /> : <span className="text-[var(--text-quaternary)]">—</span>}
                    </td>

                    {/* US */}
                    <td className="text-center py-2 px-2">
                      <USBadge status={m?.usExpansion || 'none'} />
                    </td>

                    {/* Ownership */}
                    <td className="text-right py-2 px-2 font-medium text-[var(--text-primary)]">
                      {m?.ownership != null ? `${m.ownership}%` : '—'}
                    </td>

                    {/* Invested */}
                    <td className="text-right py-2 px-2 font-medium text-[var(--text-primary)]">
                      {m?.invested != null ? `${m.invested}M` : '—'}
                    </td>

                    {/* Fund */}
                    <td className="text-center py-2 px-2">
                      {m?.fund ? <FundChip fundId={m.fund} small /> : '—'}
                    </td>

                    {/* Health */}
                    <td className="text-center py-2 px-2">
                      {company.health ? <HealthBadge health={company.health} compact /> : '—'}
                    </td>

                    {/* Board */}
                    <td className="text-center py-2 px-2">
                      <div className="flex items-center gap-1 justify-center flex-wrap">
                        {boardMembers.length > 0 ? boardMembers.map((bm, i) => (
                          <span
                            key={i}
                            className="w-5 h-5 rounded-full text-[8px] font-bold text-white flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: getMemberColor(bm.name) }}
                            title={`${bm.name}${bm.role === 'observer' ? ' (obs)' : ''}`}
                          >
                            {bm.name.charAt(0)}
                          </span>
                        )) : (
                          <span className="text-[var(--text-quaternary)]">—</span>
                        )}
                      </div>
                    </td>

                    {/* Drive */}
                    <td className="py-2 px-1">
                      <DriveButton url={m?.driveFolderUrl} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Company Cards + Sidebar ═══ */}
      <div className="grid grid-cols-4 gap-4">
        {/* Company Cards (3 cols) */}
        <div className="col-span-3 grid grid-cols-3 gap-3">
          {displayedCompanies.map((company, idx) => {
            const m = company.metrics;
            const healthColor = HEALTH_CONFIG[company.health]?.dot || '#6B7280';
            const boardMembers = company.boardMembers || [];

            return (
              <div
                key={company.id || idx}
                onClick={() => setSelectedCompany(company)}
                className="bg-[var(--bg-primary)] rounded-lg p-3.5 border border-[var(--border-default)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all cursor-pointer"
                style={{ borderLeft: `3px solid ${healthColor}` }}
              >
                {/* Header */}
                <div className="flex items-start gap-2.5 mb-2.5">
                  <CompanyLogo url={company.logoUrl} name={company.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[13px] text-[var(--text-primary)] truncate">{company.name}</span>
                      {m?.fund && <FundChip fundId={m.fund} small />}
                    </div>
                    <div className="text-[10px] text-[var(--text-quaternary)] truncate">
                      {m?.sector || company.domain || '—'}
                    </div>
                  </div>
                </div>

                {/* Metrics grid */}
                {m && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-quaternary)]">Ownership</span>
                      <span className="font-semibold text-[var(--text-primary)]">{m.ownership != null ? `${m.ownership}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-quaternary)]">Invested</span>
                      <span className="font-semibold text-[var(--text-primary)]">{m.invested != null ? `${m.invested}M` : '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-quaternary)]">Runway</span>
                      <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-0.5">
                        {m.runwayMonths}m <TrendArrow trend={m.runwayTrend} />
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-quaternary)]">Health</span>
                      <HealthBadge health={company.health} compact />
                    </div>
                  </div>
                )}

                {/* Badges row */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {company.destiny && <DestinyBadge destiny={company.destiny} compact />}
                  {m?.usExpansion && m.usExpansion !== 'none' && <USBadge status={m.usExpansion} />}
                </div>

                {/* Board + Drive */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1">
                    {boardMembers.length > 0 ? (
                      <>
                        <span className="text-[9px] text-[var(--text-quaternary)] mr-0.5">Board</span>
                        {boardMembers.map((bm, i) => (
                          <span
                            key={i}
                            className="px-1 py-0.5 rounded text-[8px] font-semibold text-white"
                            style={{ backgroundColor: getMemberColor(bm.name) }}
                          >
                            {bm.name}{bm.role === 'observer' ? ' ○' : ''}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-[9px] text-[var(--text-quaternary)]">No board seat</span>
                    )}
                  </div>
                  <DriveButton url={m?.driveFolderUrl} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ Right Sidebar: Team Breakdown ═══ */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 self-start">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Team Overview</h3>

          {/* Mini health distribution */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-subtle)]">
            {['green', 'amber', 'red'].map(h => (
              <div key={h} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: HEALTH_CONFIG[h].dot }} />
                <span className="text-[10px] font-semibold text-[var(--text-primary)]">{summary.healthCounts[h]}</span>
              </div>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-[var(--text-quaternary)]">{summary.totalInvested.toFixed(1)}M</span>
          </div>

          {/* Team members */}
          <div className="space-y-2">
            {teamBreakdown.map(([name, data]) => {
              const color = getMemberColor(name);
              const isActive = selectedMember === name;
              return (
                <div
                  key={name}
                  onClick={() => setSelectedMember(isActive ? null : name)}
                  className={`cursor-pointer rounded-lg p-2 -mx-1 transition-all flex items-center gap-2.5 ${
                    isActive
                      ? 'ring-1 shadow-sm'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                  style={isActive ? { backgroundColor: `${color}10`, ringColor: color } : {}}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[12px] text-[var(--text-secondary)] font-medium flex-1">{name}</span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{data.count}</span>
                  {data.totalInvested > 0 && (
                    <span className="text-[9px] text-[var(--text-quaternary)]">{data.totalInvested.toFixed(1)}M</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* No board seat section */}
          {enrichedCompanies.filter(c => (c.boardMembers || []).length === 0).length > 0 && (
            <div className="border-t border-[var(--border-subtle)] pt-3 mt-3">
              <div
                onClick={() => setSelectedMember(selectedMember === '__none__' ? null : '__none__')}
                className={`cursor-pointer rounded-lg p-2 -mx-1 transition-all ${
                  selectedMember === '__none__' ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--text-quaternary)] opacity-40" />
                  <span className="text-[12px] text-[var(--text-quaternary)] font-medium flex-1">No seat</span>
                  <span className="text-[11px] font-bold text-[var(--text-quaternary)]">
                    {enrichedCompanies.filter(c => (c.boardMembers || []).length === 0).length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Company Detail Modal ═══ */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
