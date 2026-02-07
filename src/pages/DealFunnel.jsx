import { useState, useMemo } from 'react';
import { useAttioCompanies, FUNNEL_STAGES, SOURCE_CHANNELS, UNIVERSE_PLACEHOLDER, UNIVERSE_PLACEHOLDER_VALUE } from '../hooks/useAttioCompanies';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';

const STAGE_DEFINITIONS = {
  universe: 'Estimated European startup ecosystem',
  qualified: 'In Proactive Sourcing list (owner assigned)',
  dealflow: 'Entered the deal flow pipeline',
  screened: 'Initial screening completed',
  met: 'First meeting held with founders',
  analysis: 'Deep-dive due diligence underway',
  committee: 'Presented to Investment Committee',
  portfolio: 'Investment made',
};

const DEAL_ANALYSIS_STAGES = new Set(['dealflow', 'screened', 'met', 'analysis', 'committee']);

// Ordered stage IDs for cumulative comparison
const STAGE_ORDER = ['universe', 'qualified', 'dealflow', 'screened', 'met', 'analysis', 'committee', 'portfolio'];

function stageIndex(stageId) {
  return STAGE_ORDER.indexOf(stageId);
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function DealFunnel({ setActiveTab }) {
  const { dealFlowData, loading, isLive } = useAttioCompanies();

  const [filters, setFilters] = useState({
    source: 'all',
    timePeriod: 'all',
    status: 'all', // all, active, declined
  });
  const [selectedStage, setSelectedStage] = useState(null);

  const deals = dealFlowData?.deals || [];
  const qualifiedCount = dealFlowData?.qualifiedCount || 0;

  // Available years for filter
  const years = useMemo(() => {
    const set = new Set();
    deals.forEach(d => { if (d.createdYear) set.add(d.createdYear); });
    return Array.from(set).sort((a, b) => b - a);
  }, [deals]);

  // Filtered deals
  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (filters.source !== 'all' && d.source !== filters.source) return false;
      if (filters.timePeriod !== 'all') {
        if (filters.timePeriod === 'recent') {
          if (d.createdYear !== 2025 && d.createdYear !== 2026) return false;
        } else {
          const yr = parseInt(filters.timePeriod, 10);
          if (d.createdYear !== yr) return false;
        }
      }
      if (filters.status === 'active' && !d.isActive) return false;
      if (filters.status === 'declined' && !d.isDeclined) return false;
      return true;
    });
  }, [deals, filters]);

  // Build funnel data
  const funnelData = useMemo(() => {
    // Cumulative counts: how many deals REACHED each stage (using highestStage)
    // A deal that reached "analysis" counts in dealflow, screened, met, and analysis
    const cumulativeCounts = {};
    const currentCounts = {};  // deals currently AT this exact stage
    const dealsByHighestStage = {};
    const dealsByCurrentStage = {};

    STAGE_ORDER.forEach(id => {
      cumulativeCounts[id] = 0;
      currentCounts[id] = 0;
      dealsByHighestStage[id] = [];
      dealsByCurrentStage[id] = [];
    });

    // Source breakdown per stage (cumulative)
    const sourceByStage = {};
    STAGE_ORDER.forEach(stageId => {
      sourceByStage[stageId] = {};
      SOURCE_CHANNELS.forEach(ch => { sourceByStage[stageId][ch.id] = 0; });
    });

    // Source totals across all deal flow
    const sourceTotals = {};
    SOURCE_CHANNELS.forEach(ch => { sourceTotals[ch.id] = 0; });

    // By source member
    const bySourceMember = {};

    filtered.forEach(d => {
      const highIdx = stageIndex(d.highestStage);
      if (highIdx < 0) return;

      // Track by highest stage
      dealsByHighestStage[d.highestStage].push(d);

      // Track by current stage (only for active deals)
      if (d.isActive && d.currentStage !== 'declined') {
        const curStage = stageIndex(d.currentStage) >= stageIndex('dealflow') ? d.currentStage : 'dealflow';
        currentCounts[curStage]++;
        dealsByCurrentStage[curStage].push(d);
      }

      // Cumulative: count this deal in all stages up to its highest
      for (let i = stageIndex('dealflow'); i <= highIdx; i++) {
        cumulativeCounts[STAGE_ORDER[i]]++;
        sourceByStage[STAGE_ORDER[i]][d.source]++;
      }

      // Source totals (at dealflow level = total deals)
      sourceTotals[d.source]++;

      // By source member
      if (d.sourceName) {
        if (!bySourceMember[d.sourceName]) {
          bySourceMember[d.sourceName] = { total: 0, active: 0, met: 0, analysis: 0, committee: 0, portfolio: 0 };
        }
        bySourceMember[d.sourceName].total++;
        if (d.isActive) bySourceMember[d.sourceName].active++;
        if (highIdx >= stageIndex('met')) bySourceMember[d.sourceName].met++;
        if (highIdx >= stageIndex('analysis')) bySourceMember[d.sourceName].analysis++;
        if (highIdx >= stageIndex('committee')) bySourceMember[d.sourceName].committee++;
        if (highIdx >= stageIndex('portfolio')) bySourceMember[d.sourceName].portfolio++;
      }
    });

    // Universe & Qualified are special
    cumulativeCounts['universe'] = UNIVERSE_PLACEHOLDER_VALUE;
    cumulativeCounts['qualified'] = qualifiedCount;

    // Source summary for the split bar
    const sourceSummary = SOURCE_CHANNELS.map(ch => {
      const count = sourceTotals[ch.id] || 0;
      const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
      return { ...ch, count, pct };
    });

    // Build stages array
    const stages = FUNNEL_STAGES.map((stage, i) => {
      const count = cumulativeCounts[stage.id];
      const currentCount = currentCounts[stage.id] || 0;
      const stageDeals = dealsByHighestStage[stage.id] || [];

      let conversionRate;
      if (stage.id === 'universe' || stage.id === 'qualified') {
        conversionRate = null;
      } else {
        const prevId = STAGE_ORDER[stageIndex(stage.id) - 1];
        const prevCount = cumulativeCounts[prevId];
        conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      }

      // Amount sum for deals at this stage
      const totalAmount = stageDeals
        .filter(d => d.amountInMeu != null)
        .reduce((sum, d) => sum + d.amountInMeu, 0);

      return {
        ...stage,
        count,
        currentCount,
        conversionRate,
        deals: stageDeals,
        totalAmount,
      };
    });

    const overallConversion = cumulativeCounts.dealflow > 0
      ? ((cumulativeCounts.portfolio / cumulativeCounts.dealflow) * 100).toFixed(2) : '0.00';

    return {
      stages,
      overallConversion,
      counts: cumulativeCounts,
      currentCounts,
      sourceSummary,
      sourceByStage,
      bySourceMember: Object.entries(bySourceMember).sort((a, b) => b[1].total - a[1].total),
      totalFiltered: filtered.length,
      activeFiltered: filtered.filter(d => d.isActive).length,
      declinedFiltered: filtered.filter(d => d.isDeclined).length,
    };
  }, [filtered, qualifiedCount]);

  // Founding team breakdown
  const foundingTeamBreakdown = useMemo(() => {
    const byTeam = {};
    filtered.forEach(d => {
      const ft = d.foundingTeam || 'Unknown';
      if (!byTeam[ft]) byTeam[ft] = 0;
      byTeam[ft]++;
    });
    return Object.entries(byTeam).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Status breakdown (satus pipeline values)
  const statusBreakdown = useMemo(() => {
    const byStatus = {};
    filtered.forEach(d => {
      const s = d.satus || 'Unknown';
      if (!byStatus[s]) byStatus[s] = 0;
      byStatus[s]++;
    });
    return Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const selectedStageData = selectedStage
    ? funnelData.stages.find(s => s.id === selectedStage)
    : null;

  if (loading && !dealFlowData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading deal funnel from Attio...</p>
        </div>
      </div>
    );
  }

  // Top 5 source channels for the split display (skip unknown if others exist)
  const visibleSources = funnelData.sourceSummary
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div>
      {/* Status */}
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">
            {funnelData.totalFiltered} deals ({funnelData.activeFiltered} active, {funnelData.declinedFiltered} declined)
            {qualifiedCount > 0 && ` · ${qualifiedCount} qualified companies`}
          </span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-6 flex-wrap">
          <FilterSelect
            label="Source Channel"
            value={filters.source}
            onChange={(v) => setFilters({ ...filters, source: v })}
            options={[
              { value: 'all', label: 'All Sources' },
              ...SOURCE_CHANNELS.filter(ch => ch.id !== 'unknown').map(ch => ({
                value: ch.id,
                label: ch.name,
              })),
            ]}
          />
          <FilterSelect
            label="Period"
            value={filters.timePeriod}
            onChange={(v) => setFilters({ ...filters, timePeriod: v })}
            options={[
              { value: 'all', label: 'All Time' },
              ...years.map(y => ({ value: String(y), label: String(y) })),
              { value: 'recent', label: '2025-2026' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={[
              { value: 'all', label: 'All Deals' },
              { value: 'active', label: 'Active Only' },
              { value: 'declined', label: 'Declined Only' },
            ]}
          />
          <div className="ml-auto text-right">
            <span className="text-xs text-[var(--text-tertiary)] block">Dealflow → Portfolio</span>
            <span className="text-2xl font-bold text-[var(--rrw-red)]">{funnelData.overallConversion}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* LEFT: The Funnel */}
        <div className="col-span-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Deal Flow Conversion Funnel</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Cumulative counts based on highest stage reached (max_status + pipeline) · Click any stage to see deals
              </p>
            </div>
          </div>

          <div className="py-3">
            {funnelData.stages.map((stage, index) => {
              const maxWidth = 95;
              const minWidth = 30;
              const widthStep = (maxWidth - minWidth) / (funnelData.stages.length - 1);
              const width = maxWidth - (widthStep * index);

              const displayCount = stage.id === 'universe'
                ? UNIVERSE_PLACEHOLDER
                : stage.count.toLocaleString();

              const showConversion = stage.conversionRate != null && index > 0;

              // For dealflow stage, show the source split
              if (stage.id === 'dealflow' && visibleSources.length > 1) {
                return (
                  <div key={stage.id}>
                    {/* Dotted separator between qualified and dealflow */}
                    <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                      <div className="h-px flex-1 max-w-[50px] border-t border-dashed border-[var(--text-quaternary)]" />
                      <span className="text-[var(--text-quaternary)]">entered pipeline</span>
                      <div className="h-px flex-1 max-w-[50px] border-t border-dashed border-[var(--text-quaternary)]" />
                    </div>

                    <div className="mx-auto mb-1" style={{ width: `${width}%` }}>
                      <div
                        onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                        className={`rounded-t-lg border-2 border-b py-2.5 px-5 cursor-pointer transition-all hover:shadow-md ${
                          selectedStage === stage.id
                            ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xl font-bold text-[var(--text-primary)]">{displayCount}</div>
                          <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                          <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                            {STAGE_DEFINITIONS[stage.id]}
                            {stage.currentCount > 0 && ` · ${stage.currentCount} currently here`}
                          </div>
                          {DEAL_ANALYSIS_STAGES.has(stage.id) && setActiveTab && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('deal-analysis'); }}
                              className="text-[10px] mt-1 hover:underline"
                              style={{ color: 'var(--rrw-red)' }}
                            >
                              View in Deal Analysis →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Source split grid */}
                      <div className={`grid gap-0 border-2 border-t-0 border-[var(--border-default)] rounded-b-lg overflow-hidden`}
                        style={{ gridTemplateColumns: `repeat(${Math.min(visibleSources.length, 4)}, 1fr)` }}
                      >
                        {visibleSources.slice(0, 4).map((channel, ci) => (
                          <div
                            key={channel.id}
                            onClick={() => setFilters({ ...filters, source: channel.id })}
                            className={`py-2.5 px-1.5 text-center cursor-pointer transition-all hover:bg-[var(--rrw-red-subtle)] ${
                              ci < Math.min(visibleSources.length, 4) - 1 ? 'border-r border-[var(--border-default)]' : ''
                            }`}
                          >
                            <div className="text-[9px] font-medium text-[var(--text-tertiary)] mb-0.5 truncate">{channel.name}</div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">{channel.count}</div>
                            <div className="text-[9px] text-[var(--text-quaternary)]">{channel.pct}%</div>
                          </div>
                        ))}
                      </div>

                      {visibleSources.length > 4 && (
                        <div className="text-center mt-1.5 text-[10px] text-[var(--text-quaternary)]">
                          +{visibleSources.slice(4).reduce((s, c) => s + c.count, 0)} from {visibleSources.length - 4} other sources
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={stage.id}>
                  {index > 0 && showConversion && (
                    <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                      <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{stage.conversionRate}%</span>
                      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                    </div>
                  )}

                  {/* Dotted separator between universe and qualified */}
                  {stage.id === 'qualified' && (
                    <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                      <div className="h-px flex-1 max-w-[50px] border-t border-dashed border-[var(--text-quaternary)]" />
                      <span className="text-[var(--text-quaternary)]">curated from</span>
                      <div className="h-px flex-1 max-w-[50px] border-t border-dashed border-[var(--text-quaternary)]" />
                    </div>
                  )}

                  <div
                    onClick={() => stage.id !== 'universe' ? setSelectedStage(selectedStage === stage.id ? null : stage.id) : null}
                    className={`mx-auto mb-1 py-3 px-5 rounded-lg border-2 transition-all ${
                      stage.id === 'universe' ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
                    } ${
                      selectedStage === stage.id
                        ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                        : stage.id === 'universe'
                          ? 'border-dashed border-[var(--border-default)] bg-[var(--bg-tertiary)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <div className="text-center">
                      <div className={`font-bold text-[var(--text-primary)] ${stage.id === 'universe' ? 'text-lg' : 'text-xl'}`}>
                        {displayCount}
                      </div>
                      <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                      <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                        {STAGE_DEFINITIONS[stage.id]}
                        {stage.id !== 'universe' && stage.id !== 'qualified' && stage.currentCount > 0 &&
                          ` · ${stage.currentCount} currently here`
                        }
                        {stage.totalAmount > 0 && ` · ${stage.totalAmount.toFixed(0)}M\u20AC raised`}
                      </div>
                      {DEAL_ANALYSIS_STAGES.has(stage.id) && setActiveTab && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTab('deal-analysis'); }}
                          className="text-[10px] mt-1 hover:underline"
                          style={{ color: 'var(--rrw-red)' }}
                        >
                          View in Deal Analysis →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>
          {/* Conversion Rates */}
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Conversion Rates</h3>
          <div className="space-y-0 mb-6">
            {funnelData.stages.slice(3).map((stage, i, arr) => {
              const prev = i === 0 ? funnelData.stages[2] : arr[i - 1];
              const rate = stage.conversionRate;
              if (rate == null) return null;
              const rateColor = rate >= 40 ? 'text-emerald-500' : rate >= 20 ? 'text-amber-500' : 'text-red-500';
              return (
                <div key={stage.id || i} className="flex justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                  <span className="text-[12px] text-[var(--text-tertiary)]">{prev.name} → {stage.name}</span>
                  <span className={`font-semibold text-[13px] ${rateColor}`}>{rate}%</span>
                </div>
              );
            })}
          </div>

          {/* By Source Member */}
          {funnelData.bySourceMember.length > 0 && (
            <div className="border-t border-[var(--border-default)] pt-4 mb-4">
              <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Source (Team)</h4>
              <div className="space-y-1.5">
                {funnelData.bySourceMember.slice(0, 10).map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)] font-medium">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-quaternary)]" title="Total deals">
                        {data.total}
                      </span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="text-[var(--text-quaternary)]" title="Met+">
                        {data.met}
                      </span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="font-semibold" style={{ color: 'var(--rrw-red)' }} title="Committee+">
                        {data.committee}
                      </span>
                    </div>
                  </div>
                ))}
                {funnelData.bySourceMember.length > 0 && (
                  <div className="text-[10px] text-[var(--text-quaternary)] flex justify-end gap-3 pt-1">
                    <span>deals</span>
                    <span className="w-2" />
                    <span>met</span>
                    <span className="w-2" />
                    <span>committee</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source channel summary */}
          <div className="border-t border-[var(--border-default)] pt-4 mb-4">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Source Channel</h4>
            <div className="space-y-2">
              {funnelData.sourceSummary
                .filter(s => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(s => (
                  <div
                    key={s.id}
                    onClick={() => setFilters({ ...filters, source: s.id === filters.source ? 'all' : s.id })}
                    className={`flex items-center justify-between text-[13px] cursor-pointer -mx-2 px-2 py-1 rounded transition-colors ${
                      filters.source === s.id ? 'bg-[var(--rrw-red-subtle)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[var(--text-tertiary)]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{s.count}</span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">{s.pct}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Pipeline Status Breakdown */}
          <div className="border-t border-[var(--border-default)] pt-4 mb-4">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Current Pipeline Status</h4>
            <div className="space-y-1.5">
              {statusBreakdown.map(([status, count]) => (
                <div key={status} className="flex justify-between items-center text-[12px]">
                  <span className="text-[var(--text-tertiary)]">{status}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Founding Team breakdown */}
          {foundingTeamBreakdown.length > 0 && foundingTeamBreakdown.some(([ft]) => ft !== 'Unknown') && (
            <div className="border-t border-[var(--border-default)] pt-4 mb-4">
              <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Founding Team</h4>
              <div className="space-y-1.5">
                {foundingTeamBreakdown.filter(([ft]) => ft !== 'Unknown').map(([team, count]) => {
                  const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
                  return (
                    <div key={team} className="flex justify-between items-center text-[12px]">
                      <span className="text-[var(--text-tertiary)]">{team}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">{count}</span>
                        <span className="text-[10px] text-[var(--text-quaternary)]">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key stats */}
          <div className="border-t border-[var(--border-default)] pt-4">
            <div className="space-y-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Qualified (Proactive Sourcing)</span>
                <span className="font-semibold text-[var(--text-primary)]">{qualifiedCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Total in deal flow</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {funnelData.counts.dealflow?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Active deals</span>
                <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>
                  {funnelData.activeFiltered}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Reached committee+</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {funnelData.counts.committee?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Portfolio (Won)</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {funnelData.counts.portfolio?.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && selectedStageData.id !== 'universe' && selectedStageData.id !== 'qualified' && (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{selectedStageData.name}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {selectedStageData.deals?.length || 0} deals reached this stage
                {selectedStageData.currentCount > 0 && ` · ${selectedStageData.currentCount} currently here`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {DEAL_ANALYSIS_STAGES.has(selectedStageData.id) && setActiveTab && (
                <button
                  onClick={() => setActiveTab('deal-analysis')}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[var(--rrw-red)] hover:bg-[var(--rrw-red-subtle)] transition-colors"
                  style={{ color: 'var(--rrw-red)' }}
                >
                  Open in Deal Analysis →
                </button>
              )}
              <button
                onClick={() => setSelectedStage(null)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-3 py-2 text-[10px] font-medium text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-default)]">
            <div className="flex-1">Deal ID</div>
            <div className="w-32 text-center">Pipeline Status</div>
            <div className="w-28 text-center">Max Status</div>
            <div className="w-28 text-center">Source</div>
            <div className="w-24 text-center">Source Member</div>
            <div className="w-20 text-right">Amount</div>
            <div className="w-24 text-center">Team</div>
            <div className="w-16 text-center">Year</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {selectedStageData.deals && selectedStageData.deals.length > 0 ? (
              selectedStageData.deals
                .sort((a, b) => (b.amountInMeu || 0) - (a.amountInMeu || 0))
                .slice(0, 50)
                .map((deal, i) => (
                  <div key={deal.id || i} className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-[var(--text-primary)] text-[12px] block truncate" title={deal.dealRecordId}>
                        {deal.dealRecordId?.slice(0, 8)}...
                      </span>
                    </div>
                    <div className="w-32 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded ${
                        deal.isDeclined
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]'
                      }`}>
                        {deal.satus || 'Unknown'}
                      </span>
                    </div>
                    <div className="w-28 text-center text-[11px] text-[var(--text-tertiary)]">
                      {deal.maxStatus5 || <span className="text-[var(--text-quaternary)]">--</span>}
                    </div>
                    <div className="w-28 text-center text-[11px] text-[var(--text-tertiary)]">
                      {deal.sourceType || <span className="text-[var(--text-quaternary)]">--</span>}
                    </div>
                    <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                      {deal.sourceName || <span className="text-[var(--text-quaternary)]">--</span>}
                    </div>
                    <div className="w-20 text-right">
                      {deal.amountInMeu != null ? (
                        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                          {deal.amountInMeu.toFixed(1)}M
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-quaternary)]">--</span>
                      )}
                    </div>
                    <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                      {deal.foundingTeam || <span className="text-[var(--text-quaternary)]">--</span>}
                    </div>
                    <div className="w-16 text-center text-[11px] text-[var(--text-tertiary)]">
                      {deal.createdYear || <span className="text-[var(--text-quaternary)]">--</span>}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-[var(--text-quaternary)]">
                <p>No deals at this stage</p>
              </div>
            )}
            {selectedStageData.deals && selectedStageData.deals.length > 50 && (
              <div className="text-center py-3 text-[11px] text-[var(--text-quaternary)]">
                Showing top 50 by amount · {selectedStageData.deals.length - 50} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
