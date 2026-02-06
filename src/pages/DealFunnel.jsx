import { useState, useMemo } from 'react';
import { useAttioCompanies, FUNNEL_STAGES, SOURCE_CHANNELS } from '../hooks/useAttioCompanies';

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

const TEAM_MAP = {};
TEAM_MEMBERS.forEach(m => { TEAM_MAP[m.id] = m.name; });

const STAGE_DEFINITIONS = {
  universe: 'All startups tracked in our CRM',
  qualified: 'An owner has been assigned to the opportunity',
  contacted: 'Contact has been established through one of our channels',
  met: 'A first meeting has taken place',
  dealflow: 'Active fundraising round — deck received',
  analysis: 'Deep-dive due diligence underway',
  committee: 'Presented to Investment Committee',
  portfolio: 'Investment made',
};

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

// Helper to format Attio interaction dates ("12:12 21/04/2023" → "Apr 2023")
function formatInteractionDate(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return raw;
  const [, day, month, year] = match;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function formatInteractionDateShort(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return raw;
  const [, day, month, year] = match;
  return `${day}/${month}/${year}`;
}

export default function DealFunnel() {
  const { companies, loading, isLive } = useAttioCompanies();

  const [filters, setFilters] = useState({
    owner: 'all',
    region: 'all',
  });
  const [activeSource, setActiveSource] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);

  // Regions for filter
  const regions = useMemo(() => {
    const set = new Set();
    companies.forEach(c => { if (c.region && c.region !== 'Other') set.add(c.region); });
    return ['all', ...Array.from(set).sort()];
  }, [companies]);

  // Filter by owner & region
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

    const counts = {};
    const companiesByStage = {};
    const growthScores = {};
    stageOrder.forEach(id => {
      counts[id] = 0;
      companiesByStage[id] = [];
      growthScores[id] = [];
    });

    const sourceByStage = {};
    stageOrder.forEach(stageId => {
      sourceByStage[stageId] = {};
      SOURCE_CHANNELS.forEach(ch => { sourceByStage[stageId][ch.id] = 0; });
    });

    const sourceCompaniesByStage = {};
    stageOrder.forEach(stageId => {
      sourceCompaniesByStage[stageId] = {};
      SOURCE_CHANNELS.forEach(ch => { sourceCompaniesByStage[stageId][ch.id] = []; });
    });

    const sourceGrowthAtContacted = {};
    SOURCE_CHANNELS.forEach(ch => { sourceGrowthAtContacted[ch.id] = []; });

    // Interaction stats per stage
    const interactionStats = {};
    stageOrder.forEach(id => {
      interactionStats[id] = { withEmail: 0, withMeeting: 0, withIntroPath: 0, total: 0 };
    });

    filtered.forEach(c => {
      const idx = stageIndex[c.funnelStage];
      if (idx === undefined) return;

      companiesByStage[c.funnelStage].push(c);
      if (c.growthScore != null) growthScores[c.funnelStage].push(c.growthScore);

      // Interaction tracking for exact stage
      interactionStats[c.funnelStage].total++;
      if (c.firstEmailInteraction) interactionStats[c.funnelStage].withEmail++;
      if (c.firstCalendarInteraction) interactionStats[c.funnelStage].withMeeting++;
      if (c.introPathCount > 0) interactionStats[c.funnelStage].withIntroPath++;

      // Cumulative
      for (let i = 0; i <= idx; i++) {
        counts[stageOrder[i]]++;
        sourceByStage[stageOrder[i]][c.source]++;
      }

      sourceCompaniesByStage[c.funnelStage][c.source].push(c);

      if (idx >= stageIndex['contacted'] && c.growthScore != null) {
        sourceGrowthAtContacted[c.source].push(c.growthScore);
      }
    });

    const sourceSummary = SOURCE_CHANNELS.map(ch => {
      const contactedCount = sourceByStage['contacted'][ch.id];
      const scores = sourceGrowthAtContacted[ch.id];
      const avgGrowth = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      const qualifiedToRate = counts['qualified'] > 0
        ? Math.round((contactedCount / counts['qualified']) * 100) : 0;

      return {
        ...ch,
        contactedCount,
        avgGrowthScore: avgGrowth,
        qualifiedToContactRate: qualifiedToRate,
      };
    });

    const stages = FUNNEL_STAGES.map((stage, i) => {
      const count = counts[stage.id];
      const stageCompanies = companiesByStage[stage.id];
      const scores = growthScores[stage.id];
      const avgGrowth = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;
      const prevCount = i > 0 ? counts[stageOrder[i - 1]] : count;
      const conversionRate = i > 0 && prevCount > 0 ? Math.round((count / prevCount) * 100) : 100;

      return {
        ...stage,
        count,
        stageCount: stageCompanies.length,
        avgGrowthScore: avgGrowth,
        conversionRate,
        companies: stageCompanies,
        interactionStats: interactionStats[stage.id],
      };
    });

    const overallConversion = counts.universe > 0
      ? ((counts.portfolio / counts.universe) * 100).toFixed(2) : '0.00';

    return { stages, overallConversion, counts, sourceSummary, sourceByStage, sourceCompaniesByStage };
  }, [filtered]);

  // Source-specific funnel + analytics
  const sourceFunnel = useMemo(() => {
    if (!activeSource) return null;
    const stageOrder = FUNNEL_STAGES.map(s => s.id);
    const contactedIdx = stageOrder.indexOf('contacted');

    const stages = stageOrder.slice(contactedIdx).map((stageId, i, arr) => {
      const count = funnelData.sourceByStage[stageId]?.[activeSource] || 0;
      const prevCount = i > 0
        ? (funnelData.sourceByStage[arr[i - 1]]?.[activeSource] || 0)
        : (funnelData.counts['qualified'] || 0);
      const conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
      const stageDef = FUNNEL_STAGES.find(s => s.id === stageId);
      const companies = funnelData.sourceCompaniesByStage[stageId]?.[activeSource] || [];

      return {
        id: stageId,
        name: stageDef?.name || stageId,
        count,
        conversionRate,
        stageCount: companies.length,
        companies,
      };
    });

    return stages;
  }, [activeSource, funnelData]);

  // Source analytics: per-team-member, per-country breakdown
  const sourceAnalytics = useMemo(() => {
    if (!activeSource) return null;

    // All companies that went through this source (cumulative from contacted onward)
    const stageOrder = FUNNEL_STAGES.map(s => s.id);
    const contactedIdx = stageOrder.indexOf('contacted');

    // Collect all companies at contacted+ with this source
    const sourceCompanies = [];
    for (let i = contactedIdx; i < stageOrder.length; i++) {
      const list = funnelData.sourceCompaniesByStage[stageOrder[i]]?.[activeSource] || [];
      sourceCompanies.push(...list);
    }

    // By team member
    const byTeam = {};
    sourceCompanies.forEach(c => {
      c.ownerIds.forEach(oid => {
        const name = TEAM_MAP[oid] || 'Unknown';
        if (!byTeam[name]) byTeam[name] = { contacted: 0, met: 0, dealflow: 0, companies: [] };
        byTeam[name].contacted++;
        byTeam[name].companies.push(c);
        const idx = stageOrder.indexOf(c.funnelStage);
        if (idx >= stageOrder.indexOf('met')) byTeam[name].met++;
        if (idx >= stageOrder.indexOf('dealflow')) byTeam[name].dealflow++;
      });
      if (c.ownerIds.length === 0) {
        if (!byTeam['Unassigned']) byTeam['Unassigned'] = { contacted: 0, met: 0, dealflow: 0, companies: [] };
        byTeam['Unassigned'].contacted++;
        byTeam['Unassigned'].companies.push(c);
      }
    });

    // By country/region
    const byCountry = {};
    sourceCompanies.forEach(c => {
      const r = c.region || 'Other';
      if (!byCountry[r]) byCountry[r] = { contacted: 0, met: 0, dealflow: 0 };
      byCountry[r].contacted++;
      const idx = stageOrder.indexOf(c.funnelStage);
      if (idx >= stageOrder.indexOf('met')) byCountry[r].met++;
      if (idx >= stageOrder.indexOf('dealflow')) byCountry[r].dealflow++;
    });

    // Interaction stats
    const withEmail = sourceCompanies.filter(c => c.firstEmailInteraction).length;
    const withMeeting = sourceCompanies.filter(c => c.firstCalendarInteraction).length;
    const withIntro = sourceCompanies.filter(c => c.introPathCount > 0).length;
    const avgGrowth = sourceCompanies.filter(c => c.growthScore != null);
    const avgGrowthScore = avgGrowth.length > 0
      ? Math.round((avgGrowth.reduce((a, b) => a + b.growthScore, 0) / avgGrowth.length) * 10) / 10
      : null;

    return {
      total: sourceCompanies.length,
      byTeam: Object.entries(byTeam).sort((a, b) => b[1].contacted - a[1].contacted),
      byCountry: Object.entries(byCountry).sort((a, b) => b[1].contacted - a[1].contacted),
      withEmail,
      withMeeting,
      withIntro,
      avgGrowthScore,
    };
  }, [activeSource, funnelData]);

  const activeSourceInfo = activeSource
    ? SOURCE_CHANNELS.find(ch => ch.id === activeSource) : null;

  const selectedStageData = selectedStage
    ? (activeSource && sourceFunnel
      ? sourceFunnel.find(s => s.id === selectedStage)
      : funnelData.stages.find(s => s.id === selectedStage))
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
      {/* Status */}
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">
            {companies.length.toLocaleString()} startups
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
            options={regions.map(r => ({ value: r, label: r === 'all' ? 'All Regions' : r }))}
          />
          <FilterSelect
            label="Source"
            value={activeSource || 'all'}
            onChange={(v) => { setActiveSource(v === 'all' ? null : v); setSelectedStage(null); }}
            options={[
              { value: 'all', label: 'All Sources' },
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

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* LEFT: The Funnel */}
        <div className="col-span-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          {/* Source sub-funnel view */}
          {activeSource && sourceFunnel ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setActiveSource(null); setSelectedStage(null); }}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{activeSourceInfo?.name} Funnel</h3>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {sourceAnalytics?.total || 0} companies · Conversion from Contact Established through Portfolio
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-3">
                {sourceFunnel.map((stage, index) => {
                  const maxWidth = 95;
                  const minWidth = 30;
                  const widthStep = (maxWidth - minWidth) / Math.max(sourceFunnel.length - 1, 1);
                  const width = maxWidth - (widthStep * index);

                  return (
                    <div key={stage.id}>
                      {index > 0 && (
                        <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                          <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{stage.conversionRate}%</span>
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                        </div>
                      )}
                      <div
                        onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                        className={`mx-auto mb-1 py-3 px-5 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                          selectedStage === stage.id
                            ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                        }`}
                        style={{ width: `${width}%` }}
                      >
                        <div className="text-center">
                          <div className="text-lg font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                          <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                          <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{stage.stageCount} at this stage</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Blended funnel view */
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Deal Flow Conversion Funnel</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Click any stage to see companies · Click a source to drill down</p>
                </div>
              </div>

              <div className="py-3">
                {funnelData.stages.map((stage, index) => {
                  const maxWidth = 95;
                  const minWidth = 30;
                  const widthStep = (maxWidth - minWidth) / (funnelData.stages.length - 1);
                  const width = maxWidth - (widthStep * index);

                  if (stage.split) {
                    const unknownSource = funnelData.sourceSummary.find(s => s.id === 'unknown');

                    return (
                      <div key={stage.id}>
                        <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                          <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{stage.conversionRate}%</span>
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
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
                              <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                              <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                              <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                                {STAGE_DEFINITIONS[stage.id]}
                                {stage.avgGrowthScore != null && ` · ⌀ ${stage.avgGrowthScore}`}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-0 border-2 border-t-0 border-[var(--border-default)] rounded-b-lg overflow-hidden">
                            {SOURCE_CHANNELS.filter(ch => ch.id !== 'unknown').map((channel, ci) => {
                              const summary = funnelData.sourceSummary.find(s => s.id === channel.id);
                              const count = summary?.contactedCount || 0;
                              const rate = summary?.qualifiedToContactRate || 0;

                              return (
                                <div
                                  key={channel.id}
                                  onClick={() => setActiveSource(channel.id)}
                                  className={`py-3 px-2 text-center cursor-pointer transition-all hover:bg-[var(--rrw-red-subtle)] ${
                                    ci < 4 ? 'border-r border-[var(--border-default)]' : ''
                                  }`}
                                >
                                  <div className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1">{channel.name}</div>
                                  <div className="text-base font-bold text-[var(--text-primary)]">{count.toLocaleString()}</div>
                                  <div className="text-[10px] text-[var(--text-quaternary)]">{rate}%</div>
                                </div>
                              );
                            })}
                          </div>

                          {unknownSource && unknownSource.contactedCount > 0 && (
                            <div className="text-center mt-1.5 text-[10px] text-[var(--text-quaternary)]">
                              +{unknownSource.contactedCount.toLocaleString()} untagged
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={stage.id}>
                      {index > 0 && (
                        <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                          <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{stage.conversionRate}%</span>
                          <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                        </div>
                      )}

                      <div
                        onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                        className={`mx-auto mb-1 py-3 px-5 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                          selectedStage === stage.id
                            ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                        }`}
                        style={{ width: `${width}%` }}
                      >
                        <div className="text-center">
                          <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                          <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                          <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                            {STAGE_DEFINITIONS[stage.id]}
                            {stage.avgGrowthScore != null && ` · ⌀ ${stage.avgGrowthScore}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>
          {/* Source-specific analytics sidebar */}
          {activeSource && sourceAnalytics ? (
            <>
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">
                {activeSourceInfo?.name} Analytics
              </h3>

              {/* Conversion rates */}
              <div className="mb-4">
                <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Conversion</h4>
                <div className="space-y-0">
                  {sourceFunnel.slice(1).map((stage, i) => {
                    const prev = i === 0 ? sourceFunnel[0] : sourceFunnel[i];
                    const rate = stage.conversionRate;
                    const rateColor = rate >= 40 ? 'text-emerald-500' : rate >= 20 ? 'text-amber-500' : 'text-red-500';
                    return (
                      <div key={stage.id} className="flex justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
                        <span className="text-[11px] text-[var(--text-tertiary)]">{prev.name} → {stage.name}</span>
                        <span className={`font-semibold text-[12px] ${rateColor}`}>{rate}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By team member */}
              <div className="border-t border-[var(--border-default)] pt-4 mb-4">
                <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Team Member</h4>
                <div className="space-y-1.5">
                  {sourceAnalytics.byTeam.map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-secondary)] font-medium">{name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-quaternary)]" title="Contacted">
                          {data.contacted}
                        </span>
                        <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                        <span className="text-[var(--text-quaternary)]" title="Met">
                          {data.met}
                        </span>
                        <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                        <span className="font-semibold" style={{ color: 'var(--rrw-red)' }} title="Deal flow+">
                          {data.dealflow}
                        </span>
                      </div>
                    </div>
                  ))}
                  {sourceAnalytics.byTeam.length > 0 && (
                    <div className="text-[10px] text-[var(--text-quaternary)] flex justify-end gap-3 pt-1">
                      <span>contacted</span>
                      <span className="w-2" />
                      <span>met</span>
                      <span className="w-2" />
                      <span>deal flow</span>
                    </div>
                  )}
                </div>
              </div>

              {/* By region */}
              <div className="border-t border-[var(--border-default)] pt-4 mb-4">
                <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Region</h4>
                <div className="space-y-1.5">
                  {sourceAnalytics.byCountry.slice(0, 8).map(([region, data]) => {
                    const convRate = data.contacted > 0 ? Math.round((data.met / data.contacted) * 100) : 0;
                    return (
                      <div key={region} className="flex items-center justify-between text-[12px]">
                        <span className="text-[var(--text-secondary)]">{region}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-quaternary)]">{data.contacted}</span>
                          <span className="text-[10px] font-medium" style={{ color: convRate >= 30 ? 'var(--rrw-red)' : 'var(--text-quaternary)' }}>
                            {convRate}% met
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interaction coverage */}
              <div className="border-t border-[var(--border-default)] pt-4 mb-4">
                <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Interaction Data</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-tertiary)]">With email tracked</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {sourceAnalytics.withEmail}/{sourceAnalytics.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-tertiary)]">With meeting tracked</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {sourceAnalytics.withMeeting}/{sourceAnalytics.total}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-tertiary)]">With intro path</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {sourceAnalytics.withIntro}/{sourceAnalytics.total}
                    </span>
                  </div>
                  {sourceAnalytics.avgGrowthScore != null && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[var(--text-tertiary)]">Avg growth score</span>
                      <span className="font-semibold text-[var(--text-primary)]">{sourceAnalytics.avgGrowthScore}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Blended sidebar */
            <>
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Conversion Rates</h3>
              <div className="space-y-0">
                {funnelData.stages.slice(1).map((stage, i, arr) => {
                  const prev = i === 0 ? funnelData.stages[0] : arr[i - 1];
                  const rate = stage.conversionRate;
                  const rateColor = rate >= 40 ? 'text-emerald-500' : rate >= 20 ? 'text-amber-500' : 'text-red-500';
                  return (
                    <div key={stage.id || i} className="flex justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                      <span className="text-[12px] text-[var(--text-tertiary)]">{prev.name} → {stage.name}</span>
                      <span className={`font-semibold text-[13px] ${rateColor}`}>{rate}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Source comparison */}
              {funnelData.sourceSummary.some(s => s.contactedCount > 0 && s.id !== 'unknown') && (
                <div className="border-t border-[var(--border-default)] mt-4 pt-4">
                  <h4 className="font-medium text-[var(--text-secondary)] mb-3">By Source</h4>
                  <div className="space-y-2">
                    {funnelData.sourceSummary
                      .filter(s => s.contactedCount > 0 && s.id !== 'unknown')
                      .sort((a, b) => b.contactedCount - a.contactedCount)
                      .map(s => (
                        <div
                          key={s.id}
                          onClick={() => setActiveSource(s.id)}
                          className="flex items-center justify-between text-[13px] cursor-pointer hover:bg-[var(--bg-hover)] -mx-2 px-2 py-1 rounded"
                        >
                          <span className="text-[var(--text-tertiary)]">{s.name}</span>
                          <span className="font-semibold text-[var(--text-primary)]">{s.contactedCount.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Interaction coverage per stage */}
              <div className="border-t border-[var(--border-default)] mt-4 pt-4">
                <h4 className="font-medium text-[var(--text-secondary)] mb-3">Interaction Data</h4>
                <div className="space-y-2">
                  {funnelData.stages
                    .filter(s => s.interactionStats && s.interactionStats.total > 0)
                    .map(stage => {
                      const stats = stage.interactionStats;
                      const emailPct = stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) : 0;
                      const meetingPct = stats.total > 0 ? Math.round((stats.withMeeting / stats.total) * 100) : 0;
                      return (
                        <div key={stage.id} className="text-[12px]">
                          <div className="text-[var(--text-tertiary)] mb-1">{stage.name} ({stats.total})</div>
                          <div className="flex gap-3">
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${emailPct}%`, backgroundColor: 'var(--rrw-red)' }} />
                              </div>
                              <span className="text-[10px] text-[var(--text-quaternary)]">{emailPct}% email</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-10 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${meetingPct}%`, backgroundColor: 'var(--rrw-red)' }} />
                              </div>
                              <span className="text-[10px] text-[var(--text-quaternary)]">{meetingPct}% meeting</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Growth scores */}
              <div className="border-t border-[var(--border-default)] mt-4 pt-4">
                <h4 className="font-medium text-[var(--text-secondary)] mb-3">Avg Growth Score</h4>
                <div className="space-y-2">
                  {funnelData.stages.filter(s => s.avgGrowthScore != null).map(stage => (
                    <div key={stage.id} className="flex justify-between items-center text-[13px]">
                      <span className="text-[var(--text-tertiary)]">{stage.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(stage.avgGrowthScore, 100)}%`, backgroundColor: 'var(--rrw-red)' }}
                          />
                        </div>
                        <span className="font-semibold text-[var(--text-primary)] w-8 text-right">{stage.avgGrowthScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key stats */}
              <div className="border-t border-[var(--border-default)] mt-4 pt-4">
                <div className="space-y-2.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--text-tertiary)]">Total startups</span>
                    <span className="font-semibold text-[var(--text-primary)]">{filtered.length.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--text-tertiary)]">With owner</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {filtered.filter(c => c.hasOwner).length.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--text-tertiary)]">In deal flow+</span>
                    <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>
                      {filtered.filter(c => ['dealflow', 'analysis', 'committee', 'portfolio'].includes(c.funnelStage)).length.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{selectedStageData.name}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {selectedStageData.stageCount?.toLocaleString() || selectedStageData.companies?.length.toLocaleString()} companies at this stage
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

          {/* Column headers */}
          <div className="flex items-center px-3 py-2 text-[10px] font-medium text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-default)]">
            <div className="flex-1">Company</div>
            <div className="w-24 text-center">First Email</div>
            <div className="w-24 text-center">First Meeting</div>
            <div className="w-20 text-center">Last Touch</div>
            <div className="w-16 text-right">Growth</div>
            <div className="w-28 text-right">Status</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {selectedStageData.companies && selectedStageData.companies.length > 0 ? (
              selectedStageData.companies
                .sort((a, b) => (b.growthScore || 0) - (a.growthScore || 0))
                .slice(0, 50)
                .map((company, i) => (
                  <div key={company.id || i} className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt="" className="w-6 h-6 rounded object-contain bg-white flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-bold text-[var(--text-tertiary)] flex-shrink-0">
                          {company.name?.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-[var(--text-primary)] text-[13px] block truncate">{company.name}</span>
                        <span className="text-[10px] text-[var(--text-quaternary)]">{company.country} · {company.region}</span>
                      </div>
                    </div>
                    <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                      {formatInteractionDate(company.firstEmailInteraction) || (
                        <span className="text-[var(--text-quaternary)]">—</span>
                      )}
                    </div>
                    <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                      {formatInteractionDate(company.firstCalendarInteraction) || (
                        <span className="text-[var(--text-quaternary)]">—</span>
                      )}
                    </div>
                    <div className="w-20 text-center text-[11px] text-[var(--text-tertiary)]">
                      {formatInteractionDate(company.lastInteraction) || (
                        <span className="text-[var(--text-quaternary)]">—</span>
                      )}
                    </div>
                    <div className="w-16 text-right">
                      {company.growthScore != null ? (
                        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                          {company.growthScore.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--text-quaternary)]">—</span>
                      )}
                    </div>
                    <div className="w-28 text-right">
                      <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                        {company.status || 'No status'}
                      </span>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-[var(--text-quaternary)]">
                <p>No companies at this stage</p>
              </div>
            )}
            {selectedStageData.companies && selectedStageData.companies.length > 50 && (
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
