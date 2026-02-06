import { useState, useMemo } from 'react';
import { useAttioCompanies, FUNNEL_STAGES, SOURCE_CHANNELS } from '../hooks/useAttioCompanies';

// Team members for the owner filter
const TEAM_MEMBERS = [
  { id: '132dcc71-5c7a-41fa-a94c-aa9858d6cea3', name: 'Chloé' },
  { id: '7acbe6c2-21e1-4346-bcff-0ce4797d6e88', name: 'Joseph' },
  { id: '64d84369-bb20-4b9e-b313-69f423e24438', name: 'Alessandro' },
  { id: '82cfb7fc-f667-467d-97db-f5459047eeb6', name: 'Olivier' },
  { id: '93d8a2b8-e953-4c1d-bc62-2a57e5e8e481', name: 'Abel' },
  { id: 'fae2196e-dfb6-4edb-a279-adf24b1e151e', name: 'Max' },
  { id: '190fc1b3-2b0e-40b9-b1d3-3036ab9b936f', name: 'Thomas' },
  { id: 'e330fcd0-65a3-42ac-9b25-b0035cd175d2', name: 'Antoine' },
];

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

export default function DealFunnel() {
  const { companies, loading, error, isLive } = useAttioCompanies();

  const [filters, setFilters] = useState({
    owner: 'all',
    region: 'all',
    sourceFilter: 'all', // 'all' = blended view, or a specific source channel id
  });
  const [selectedStage, setSelectedStage] = useState(null);

  // Get unique regions for filter
  const regions = useMemo(() => {
    const set = new Set();
    companies.forEach(c => { if (c.region && c.region !== 'Other') set.add(c.region); });
    return ['all', ...Array.from(set).sort()];
  }, [companies]);

  // Filter companies by owner & region
  const filtered = useMemo(() => {
    return companies.filter(c => {
      if (filters.owner !== 'all' && !c.ownerIds.includes(filters.owner)) return false;
      if (filters.region !== 'all' && c.region !== filters.region) return false;
      return true;
    });
  }, [companies, filters]);

  // Build funnel data
  const funnelData = useMemo(() => {
    const stageOrder = FUNNEL_STAGES.map(s => s.id);
    const stageIndex = {};
    stageOrder.forEach((id, i) => { stageIndex[id] = i; });

    // Cumulative counts, per-stage companies, growth scores
    const counts = {};
    const companiesByStage = {};
    const growthScores = {};

    stageOrder.forEach(id => {
      counts[id] = 0;
      companiesByStage[id] = [];
      growthScores[id] = [];
    });

    // Source breakdown for 'contacted' stage
    const sourceBreakdown = {};
    SOURCE_CHANNELS.forEach(ch => {
      sourceBreakdown[ch.id] = { count: 0, companies: [], growthScores: [] };
    });

    // Also track source breakdown for stages BEYOND contacted (for per-source sub-funnels)
    const sourceByStage = {};
    stageOrder.forEach(stageId => {
      sourceByStage[stageId] = {};
      SOURCE_CHANNELS.forEach(ch => {
        sourceByStage[stageId][ch.id] = 0;
      });
    });

    filtered.forEach(c => {
      const idx = stageIndex[c.funnelStage];
      if (idx === undefined) return;

      // Company appears at its current stage
      companiesByStage[c.funnelStage].push(c);
      if (c.growthScore != null) growthScores[c.funnelStage].push(c.growthScore);

      // Cumulative: count at this stage and all earlier
      for (let i = 0; i <= idx; i++) {
        counts[stageOrder[i]]++;
        // Track source at every stage for sub-funnel views
        sourceByStage[stageOrder[i]][c.source]++;
      }

      // Source breakdown at 'contacted' level (companies that reached contacted or beyond)
      if (idx >= stageIndex['contacted']) {
        sourceBreakdown[c.source].count++;
        if (c.funnelStage === 'contacted') {
          sourceBreakdown[c.source].companies.push(c);
          if (c.growthScore != null) sourceBreakdown[c.source].growthScores.push(c.growthScore);
        }
      }
    });

    // Build stage objects
    const stages = FUNNEL_STAGES.map((stage, i) => {
      const count = counts[stage.id];
      const stageCompanies = companiesByStage[stage.id];
      const scores = growthScores[stage.id];
      const avgGrowth = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

      const prevCount = i > 0 ? counts[stageOrder[i - 1]] : count;
      const conversionRate = i > 0 && prevCount > 0 ? Math.round((count / prevCount) * 100) : 100;
      const dropoffRate = 100 - conversionRate;

      return {
        ...stage,
        count,
        stageCount: stageCompanies.length,
        avgGrowthScore: avgGrowth,
        conversionRate,
        dropoffRate,
        companies: stageCompanies,
      };
    });

    // Build source sub-funnel data: for each source, show conversion through stages
    const sourceSubFunnels = SOURCE_CHANNELS.map(ch => {
      const contactedCount = sourceBreakdown[ch.id].count;
      if (contactedCount === 0) return { ...ch, stages: [], contactedCount: 0 };

      // For each stage from 'contacted' onward, show count for this source
      const subStages = stageOrder
        .filter((_, i) => i >= stageIndex['contacted'])
        .map((stageId, i, arr) => {
          const cnt = sourceByStage[stageId][ch.id];
          const prevCnt = i > 0 ? sourceByStage[arr[i - 1]][ch.id] : counts['qualified'];
          const rate = prevCnt > 0 ? Math.round((cnt / prevCnt) * 100) : 0;
          return {
            id: stageId,
            name: FUNNEL_STAGES.find(s => s.id === stageId)?.name || stageId,
            count: cnt,
            conversionRate: rate,
          };
        });

      return {
        ...ch,
        contactedCount,
        avgGrowthScore: sourceBreakdown[ch.id].growthScores.length > 0
          ? Math.round((sourceBreakdown[ch.id].growthScores.reduce((a, b) => a + b, 0) / sourceBreakdown[ch.id].growthScores.length) * 10) / 10
          : null,
        // Conversion from qualified → this source's contacted
        qualifiedToContactRate: counts['qualified'] > 0 ? Math.round((contactedCount / counts['qualified']) * 100) : 0,
        stages: subStages,
      };
    }).filter(ch => ch.contactedCount > 0);

    const overallConversion = counts.universe > 0
      ? ((counts.portfolio / counts.universe) * 100).toFixed(2)
      : '0.00';

    return { stages, overallConversion, counts, sourceBreakdown, sourceSubFunnels, sourceByStage };
  }, [filtered]);

  // If filtering by specific source, compute source-specific funnel
  const isSourceFiltered = filters.sourceFilter !== 'all';
  const activeSourceChannel = isSourceFiltered
    ? SOURCE_CHANNELS.find(ch => ch.id === filters.sourceFilter)
    : null;

  // Conversion metrics for sidebar
  const conversionMetrics = funnelData.stages.slice(1).map((stage, i) => ({
    from: funnelData.stages[i].name,
    to: stage.name,
    rate: stage.conversionRate,
  }));

  // Biggest drop-offs
  const topDropoffs = funnelData.stages
    .slice(1)
    .filter(s => s.dropoffRate > 0)
    .sort((a, b) => b.dropoffRate - a.dropoffRate)
    .slice(0, 3);

  const selectedStageData = selectedStage
    ? funnelData.stages.find(s => s.id === selectedStage)
    : null;

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading company data from Attio...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">
            {companies.length.toLocaleString()} startups loaded
          </span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-6 flex-wrap">
          <FilterSelect
            label="Team Member"
            value={filters.owner}
            onChange={(v) => setFilters({ ...filters, owner: v })}
            options={[
              { value: 'all', label: 'Everyone' },
              ...TEAM_MEMBERS.map(m => ({ value: m.id, label: m.name })),
            ]}
          />
          <FilterSelect
            label="Region"
            value={filters.region}
            onChange={(v) => setFilters({ ...filters, region: v })}
            options={regions.map(r => ({
              value: r,
              label: r === 'all' ? 'All Regions' : r,
            }))}
          />
          <FilterSelect
            label="Source"
            value={filters.sourceFilter}
            onChange={(v) => setFilters({ ...filters, sourceFilter: v })}
            options={[
              { value: 'all', label: 'All Sources (Blended)' },
              ...SOURCE_CHANNELS.filter(ch => ch.id !== 'unknown').map(ch => ({
                value: ch.id,
                label: ch.name,
              })),
            ]}
          />
          <div className="ml-auto text-right">
            <span className="text-xs text-[var(--text-tertiary)] block">Overall conversion</span>
            <span className="text-2xl font-bold text-[var(--rrw-red)]">{funnelData.overallConversion}%</span>
          </div>
        </div>
      </div>

      {/* Main Content: Funnel + Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* LEFT: The Funnel (2 cols) */}
        <div className="col-span-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                {isSourceFiltered ? `${activeSourceChannel.name} Funnel` : 'Deal Flow Conversion Funnel'}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">Click any stage to see companies</p>
            </div>
          </div>

          <div className="py-3">
            {funnelData.stages.map((stage, index) => {
              const maxWidth = 100;
              const minWidth = 25;
              const widthStep = (maxWidth - minWidth) / (funnelData.stages.length - 1);
              const width = maxWidth - (widthStep * index);

              // The "Contact Initiated" stage gets the split view
              if (stage.split && !isSourceFiltered) {
                return (
                  <div key={stage.id}>
                    {/* Conversion label above */}
                    <div className="flex items-center justify-center gap-3 py-1.5 text-[var(--text-quaternary)] text-[11px]">
                      <div className="h-px bg-[var(--border-default)] flex-1 max-w-[60px]" />
                      <span>{stage.conversionRate}% converted</span>
                      <div className="h-px bg-[var(--border-default)] flex-1 max-w-[60px]" />
                    </div>

                    {/* Split cards for each source */}
                    <div className="mx-auto mb-1" style={{ width: `${width}%` }}>
                      <div className="text-center mb-2">
                        <span className="font-semibold text-[13px] text-[var(--text-primary)]">{stage.name}</span>
                        <span className="text-[var(--text-tertiary)] text-[13px] ml-2">{stage.count.toLocaleString()}</span>
                        {stage.avgGrowthScore != null && (
                          <span className="text-[11px] text-[var(--text-quaternary)] ml-2">
                            ⌀ {stage.avgGrowthScore}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {SOURCE_CHANNELS.filter(ch => ch.id !== 'unknown').map(channel => {
                          const subFunnel = funnelData.sourceSubFunnels.find(sf => sf.id === channel.id);
                          const count = subFunnel?.contactedCount || 0;
                          const rate = subFunnel?.qualifiedToContactRate || 0;
                          const avgGrowth = subFunnel?.avgGrowthScore;

                          return (
                            <div
                              key={channel.id}
                              onClick={() => setFilters({ ...filters, sourceFilter: channel.id })}
                              className="rounded-lg p-3 text-center cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md border border-[var(--border-default)]"
                              style={{
                                background: `${channel.color}10`,
                                borderColor: count > 0 ? `${channel.color}40` : undefined,
                              }}
                            >
                              <div className="text-[11px] font-medium text-[var(--text-tertiary)] mb-1 truncate">
                                {channel.name}
                              </div>
                              <div className="text-lg font-bold" style={{ color: channel.color }}>
                                {count.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-[var(--text-quaternary)]">
                                {rate}% of qualified
                              </div>
                              {avgGrowth != null && (
                                <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                                  ⌀ {avgGrowth}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Unknown source indicator */}
                      {(() => {
                        const unknownSub = funnelData.sourceSubFunnels.find(sf => sf.id === 'unknown');
                        if (!unknownSub || unknownSub.contactedCount === 0) return null;
                        return (
                          <div className="text-center mt-2 text-[10px] text-[var(--text-quaternary)]">
                            {unknownSub.contactedCount.toLocaleString()} with no source set —
                            <span className="underline cursor-help" title="Add a 'Source' select field to companies in Attio to categorize these">
                              tag them in Attio
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              }

              // Regular funnel bar
              return (
                <div key={stage.id}>
                  {index > 0 && (
                    <div className="flex items-center justify-center gap-3 py-1.5 text-[var(--text-quaternary)] text-[11px]">
                      <div className="h-px bg-[var(--border-default)] flex-1 max-w-[60px]" />
                      <span>{stage.conversionRate}% converted</span>
                      <div className="h-px bg-[var(--border-default)] flex-1 max-w-[60px]" />
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                    className={`mx-auto mb-1 px-6 py-3 text-center cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg rounded relative ${
                      selectedStage === stage.id ? 'ring-2 ring-[var(--rrw-red)] ring-offset-2' : ''
                    }`}
                    style={{
                      width: `${width}%`,
                      background: `linear-gradient(135deg, ${getFunnelColor(index, 0)} 0%, ${getFunnelColor(index, 1)} 100%)`,
                      clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 16px 100%)'
                    }}
                    title={stage.description}
                  >
                    <div className={`font-semibold text-[13px] ${index < 2 ? 'text-red-900' : 'text-white'}`}
                      style={{ textShadow: index >= 2 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                      {stage.name}
                    </div>
                    <div className={`text-xl font-bold ${index < 2 ? 'text-red-900' : 'text-white'}`}
                      style={{ textShadow: index >= 2 ? '0 1px 2px rgba(0,0,0,0.2)' : 'none' }}>
                      {stage.count.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <span className={`text-[11px] ${index < 2 ? 'text-red-700' : 'text-white/80'}`}>
                        {stage.stageCount.toLocaleString()} at this stage
                      </span>
                      {stage.avgGrowthScore != null && (
                        <span className={`text-[11px] font-medium ${index < 2 ? 'text-red-800' : 'text-white/90'}`}>
                          ⌀ {stage.avgGrowthScore}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Metrics Sidebar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">Conversion Rates</h3>
          <div className="space-y-0">
            {conversionMetrics.map((metric, i) => {
              const rateColor = metric.rate >= 40 ? 'text-emerald-500' : metric.rate >= 20 ? 'text-amber-500' : 'text-red-500';
              return (
                <div key={i} className="flex justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
                  <span className="text-[12px] text-[var(--text-tertiary)]">
                    {metric.from} → {metric.to}
                  </span>
                  <span className={`font-semibold ${rateColor}`}>{metric.rate}%</span>
                </div>
              );
            })}
          </div>

          {/* Source Conversion Comparison */}
          {funnelData.sourceSubFunnels.length > 0 && (
            <div className="border-t border-[var(--border-default)] mt-4 pt-4">
              <h4 className="font-medium text-[var(--text-secondary)] mb-3">Source → First Meeting</h4>
              <div className="space-y-2">
                {funnelData.sourceSubFunnels
                  .filter(sf => sf.id !== 'unknown')
                  .sort((a, b) => {
                    const aToMet = a.stages.find(s => s.id === 'met');
                    const bToMet = b.stages.find(s => s.id === 'met');
                    return (bToMet?.conversionRate || 0) - (aToMet?.conversionRate || 0);
                  })
                  .map(sf => {
                    const toMet = sf.stages.find(s => s.id === 'met');
                    const rate = toMet?.conversionRate || 0;
                    return (
                      <div key={sf.id} className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sf.color }} />
                          <span className="text-[var(--text-tertiary)]">{sf.name}</span>
                        </div>
                        <span className={`font-semibold ${rate >= 40 ? 'text-emerald-500' : rate >= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                          {rate}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Growth Score Summary */}
          <div className="border-t border-[var(--border-default)] mt-4 pt-4">
            <h4 className="font-medium text-[var(--text-secondary)] mb-3">Avg Growth Score</h4>
            <div className="space-y-2">
              {funnelData.stages.filter(s => s.avgGrowthScore != null).map(stage => (
                <div key={stage.id} className="flex justify-between items-center text-[13px]">
                  <span className="text-[var(--text-tertiary)]">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--rrw-red)] rounded-full"
                        style={{ width: `${Math.min(stage.avgGrowthScore, 100)}%` }}
                      />
                    </div>
                    <span className="font-semibold text-[var(--text-primary)] w-8 text-right">{stage.avgGrowthScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Stats */}
          <div className="border-t border-[var(--border-default)] mt-4 pt-4">
            <h4 className="font-medium text-[var(--text-secondary)] mb-3">Key Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Total startups</span>
                <span className="font-semibold text-[var(--text-primary)]">{companies.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">With owner</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {filtered.filter(c => c.hasOwner).length.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">In deal flow+</span>
                <span className="font-semibold text-emerald-500">
                  {filtered.filter(c => ['dealflow', 'analysis', 'committee', 'portfolio'].includes(c.funnelStage)).length.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Biggest Drop-offs */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Biggest Drop-offs</h3>
        <div className="space-y-3">
          {topDropoffs.map((stage, i) => {
            const prevStage = funnelData.stages[funnelData.stages.indexOf(stage) - 1];
            const dropoffCount = prevStage ? prevStage.count - stage.count : 0;
            return (
              <div
                key={i}
                className={`rounded-lg p-4 border ${stage.dropoffRate >= 70 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[var(--text-primary)]">{prevStage?.name} → {stage.name}</span>
                  <span className="font-bold text-red-500">{stage.dropoffRate}% drop-off</span>
                </div>
                <div className="text-[13px] text-[var(--text-secondary)]">
                  {dropoffCount.toLocaleString()} companies lost at this transition
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{selectedStageData.name}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {selectedStageData.stageCount.toLocaleString()} companies at this stage
                {selectedStageData.avgGrowthScore != null && ` · Avg growth score: ${selectedStageData.avgGrowthScore}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedStage(null)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {selectedStageData.companies.length > 0 ? (
              selectedStageData.companies
                .sort((a, b) => (b.growthScore || 0) - (a.growthScore || 0))
                .slice(0, 50)
                .map((company, i) => (
                  <div key={company.id || i} className="p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {company.logoUrl ? (
                          <img src={company.logoUrl} alt="" className="w-6 h-6 rounded object-contain bg-white" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-[var(--text-tertiary)]">
                            {company.name?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-[var(--text-primary)] text-[13px]">{company.name}</span>
                          <span className="text-[11px] text-[var(--text-quaternary)] ml-2">{company.country}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {company.source !== 'unknown' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${SOURCE_CHANNELS.find(ch => ch.id === company.source)?.color || '#9CA3AF'}15`,
                              color: SOURCE_CHANNELS.find(ch => ch.id === company.source)?.color || '#9CA3AF',
                            }}>
                            {SOURCE_CHANNELS.find(ch => ch.id === company.source)?.name}
                          </span>
                        )}
                        {company.growthScore != null && (
                          <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                            {company.growthScore.toFixed(0)}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                          {company.status || 'No status'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-[var(--text-quaternary)]">
                <p>No companies at this stage</p>
              </div>
            )}
            {selectedStageData.companies.length > 50 && (
              <div className="text-center py-3 text-[11px] text-[var(--text-quaternary)]">
                Showing top 50 by growth score · {selectedStageData.companies.length - 50} more
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
