import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAttioCompanies, FUNNEL_STAGES, SOURCE_CHANNELS } from '../hooks/useAttioCompanies';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { countryToFilterRegion } from '../data/geography';

// Stages where clicking "View in Deal Analysis" makes sense
const DEAL_ANALYSIS_STAGES = new Set(['dealflow', 'met', 'analysis', 'committee']);

// Top-of-funnel stages (company-based data)
const TOP_FUNNEL_STAGES = new Set(['universe', 'outreach', 'contact']);

// Stage order for cumulative logic
const STAGE_ORDER = ['universe', 'outreach', 'contact', 'dealflow', 'met', 'analysis', 'committee', 'portfolio'];
function stageIdx(id) { return STAGE_ORDER.indexOf(id); }

// Company statuses that mean "entered dealflow or beyond"
const DEALFLOW_BRIDGE_STATUSES = new Set([
  'Dealflow', 'Due Dilligence', 'IC', 'Portfolio', 'Passed', 'To Decline', 'Analysed but too early',
]);

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
  const navigate = useNavigate();
  const { funnelData, loading, isLive } = useAttioCompanies();

  const [filters, setFilters] = useState({
    source: 'all',
    timePeriod: 'all',
    owner: 'all',
  });
  const [selectedStage, setSelectedStage] = useState(null);

  const companies = funnelData?.companies || [];
  const deals = funnelData?.deals || [];
  const emailMetrics = funnelData?.emailMetrics || {};

  // Available years for filter (from deal entries)
  const years = useMemo(() => {
    const set = new Set();
    deals.forEach(d => { if (d.createdYear) set.add(d.createdYear); });
    return Array.from(set).sort((a, b) => b - a);
  }, [deals]);

  // Available owners (from companies)
  const ownerOptions = useMemo(() => {
    const ownerSet = new Set();
    companies.forEach(c => c.ownerIds.forEach(id => ownerSet.add(id)));
    return TEAM_MEMBERS.filter(t => ownerSet.has(t.id));
  }, [companies]);

  // Filtered deals (bottom-of-funnel)
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (filters.source !== 'all' && d.source !== filters.source) return false;
      if (filters.timePeriod !== 'all') {
        const yr = parseInt(filters.timePeriod, 10);
        if (d.createdYear !== yr) return false;
      }
      if (filters.owner !== 'all' && !d.ownerIds?.includes(filters.owner)) return false;
      return true;
    });
  }, [deals, filters]);

  // Filtered companies (top-of-funnel)
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      if (filters.owner !== 'all' && !c.ownerIds.includes(filters.owner)) return false;
      return true;
    });
  }, [companies, filters]);

  // ─── Build funnel data ──────────────────────────────────────────────
  const funnel = useMemo(() => {
    // Top-of-funnel: count companies by stage (cumulative)
    const companyByStage = { universe: 0, outreach: 0, contact: 0, dealflow_bridge: 0 };
    const companyListByStage = { universe: [], outreach: [], contact: [], dealflow_bridge: [] };

    // Outreach sub-breakdown
    let outreachColdEmail = 0;
    let outreachOther = 0;

    filteredCompanies.forEach(c => {
      const stage = c.topStage;
      if (companyByStage[stage] !== undefined) {
        companyByStage[stage]++;
        companyListByStage[stage].push(c);
      }

      // Sub-breakdown for outreach
      if (stage === 'outreach') {
        if (c.firstEmail) outreachColdEmail++;
        else outreachOther++;
      }
    });

    // Cumulative top-of-funnel
    const universeCount = filteredCompanies.length;
    const outreachCount = companyByStage.outreach + companyByStage.contact + companyByStage.dealflow_bridge;
    const contactCount = companyByStage.contact + companyByStage.dealflow_bridge;

    // Bottom-of-funnel: deal flow entries (cumulative using highestStage)
    const dealCumulative = { dealflow: 0, met: 0, analysis: 0, committee: 0, portfolio: 0 };
    const dealsByHighestStage = { dealflow: [], met: [], analysis: [], committee: [], portfolio: [] };
    const currentCounts = { dealflow: 0, met: 0, analysis: 0, committee: 0, portfolio: 0 };

    // Source breakdown at dealflow level
    const sourceTotals = {};
    SOURCE_CHANNELS.forEach(ch => { sourceTotals[ch.id] = 0; });

    // By source member
    const bySourceMember = {};

    filteredDeals.forEach(d => {
      const highIdx = stageIdx(d.highestStage);
      if (highIdx < stageIdx('dealflow')) return;

      if (dealsByHighestStage[d.highestStage]) {
        dealsByHighestStage[d.highestStage].push(d);
      }

      if (d.isActive && d.currentStage !== 'declined') {
        const cs = stageIdx(d.currentStage) >= stageIdx('dealflow') ? d.currentStage : 'dealflow';
        if (currentCounts[cs] !== undefined) currentCounts[cs]++;
      }

      for (let i = stageIdx('dealflow'); i <= highIdx; i++) {
        const sid = STAGE_ORDER[i];
        if (dealCumulative[sid] !== undefined) dealCumulative[sid]++;
      }

      sourceTotals[d.source] = (sourceTotals[d.source] || 0) + 1;

      if (d.sourceName) {
        if (!bySourceMember[d.sourceName]) {
          bySourceMember[d.sourceName] = { total: 0, active: 0, met: 0, analysis: 0, committee: 0, portfolio: 0 };
        }
        bySourceMember[d.sourceName].total++;
        if (d.isActive) bySourceMember[d.sourceName].active++;
        if (highIdx >= stageIdx('met')) bySourceMember[d.sourceName].met++;
        if (highIdx >= stageIdx('analysis')) bySourceMember[d.sourceName].analysis++;
        if (highIdx >= stageIdx('committee')) bySourceMember[d.sourceName].committee++;
        if (highIdx >= stageIdx('portfolio')) bySourceMember[d.sourceName].portfolio++;
      }
    });

    // By owner (top-of-funnel)
    const byOwner = {};
    filteredCompanies.forEach(c => {
      c.ownerIds.forEach(oid => {
        const ownerName = TEAM_MAP[oid] || 'Unknown';
        if (!byOwner[ownerName]) byOwner[ownerName] = { universe: 0, outreach: 0, contact: 0, dealflow: 0 };
        byOwner[ownerName].universe++;
        if (c.topStage === 'outreach' || c.topStage === 'contact' || c.topStage === 'dealflow_bridge') {
          byOwner[ownerName].outreach++;
        }
        if (c.topStage === 'contact' || c.topStage === 'dealflow_bridge') {
          byOwner[ownerName].contact++;
        }
        if (c.topStage === 'dealflow_bridge') {
          byOwner[ownerName].dealflow++;
        }
      });
    });

    // Combine into stage array
    const cumulativeCounts = {
      universe: universeCount,
      outreach: outreachCount,
      contact: contactCount,
      dealflow: dealCumulative.dealflow,
      met: dealCumulative.met,
      analysis: dealCumulative.analysis,
      committee: dealCumulative.committee,
      portfolio: dealCumulative.portfolio,
    };

    const stages = FUNNEL_STAGES.map((stage, i) => {
      const count = cumulativeCounts[stage.id] || 0;
      const prevId = i > 0 ? STAGE_ORDER[i - 1] : null;
      const prevCount = prevId ? cumulativeCounts[prevId] : null;
      const conversionRate = prevCount && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;

      let items = [];
      if (TOP_FUNNEL_STAGES.has(stage.id)) {
        items = companyListByStage[stage.id] || [];
      } else {
        items = dealsByHighestStage[stage.id] || [];
      }

      return {
        ...stage,
        count,
        conversionRate,
        currentCount: currentCounts[stage.id] || 0,
        items,
        totalAmount: (dealsByHighestStage[stage.id] || [])
          .filter(d => d.amountInMeu != null)
          .reduce((s, d) => s + d.amountInMeu, 0),
      };
    });

    const sourceSummary = SOURCE_CHANNELS.map(ch => {
      const count = sourceTotals[ch.id] || 0;
      const total = filteredDeals.length || 1;
      return { ...ch, count, pct: Math.round((count / total) * 100) };
    });

    const overallConversion = dealCumulative.dealflow > 0
      ? ((dealCumulative.portfolio / dealCumulative.dealflow) * 100).toFixed(2) : '0.00';

    // Universe breakdowns (owner, region, industry)
    const total = filteredCompanies.length || 1;
    const toBreakdown = (counts) =>
      Object.entries(counts)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count);

    const ownerCounts = {};
    const regionCounts = {};
    const industryCounts = {};
    filteredCompanies.forEach(c => {
      // Owners
      c.ownerIds.forEach(oid => {
        const name = TEAM_MAP[oid] || 'Unknown';
        ownerCounts[name] = (ownerCounts[name] || 0) + 1;
      });
      // Regions
      const region = countryToFilterRegion[c.location] || (c.location ? 'Other Europe' : 'Unknown');
      regionCounts[region] = (regionCounts[region] || 0) + 1;
      // Industry
      if (c.categories?.length) {
        c.categories.forEach(cat => {
          industryCounts[cat] = (industryCounts[cat] || 0) + 1;
        });
      } else {
        industryCounts['Uncategorized'] = (industryCounts['Uncategorized'] || 0) + 1;
      }
    });

    return {
      stages,
      counts: cumulativeCounts,
      overallConversion,
      sourceSummary,
      bySourceMember: Object.entries(bySourceMember).sort((a, b) => b[1].total - a[1].total),
      byOwner: Object.entries(byOwner).sort((a, b) => b[1].universe - a[1].universe),
      outreachColdEmail,
      outreachOther,
      totalDeals: filteredDeals.length,
      activeDeals: filteredDeals.filter(d => d.isActive).length,
      universeByOwner: toBreakdown(ownerCounts),
      universeByRegion: toBreakdown(regionCounts),
      universeByIndustry: toBreakdown(industryCounts),
    };
  }, [filteredCompanies, filteredDeals]);

  const selectedStageData = selectedStage
    ? funnel.stages.find(s => s.id === selectedStage)
    : null;

  if (loading && !funnelData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading deal funnel from Attio...</p>
        </div>
      </div>
    );
  }

  const visibleSources = funnel.sourceSummary
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div>
      {/* Status bar */}
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">
            {funnel.counts.universe.toLocaleString()} qualified companies
            {' · '}{funnel.totalDeals} in dealflow ({funnel.activeDeals} active)
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
                value: ch.id, label: ch.name,
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
            ]}
          />
          <FilterSelect
            label="Owner"
            value={filters.owner}
            onChange={(v) => setFilters({ ...filters, owner: v })}
            options={[
              { value: 'all', label: 'All Team' },
              ...ownerOptions.map(t => ({ value: t.id, label: t.name })),
            ]}
          />
          <div className="ml-auto text-right">
            <span className="text-xs text-[var(--text-tertiary)] block">Dealflow → Portfolio</span>
            <span className="text-2xl font-bold text-[var(--rrw-red)]">{funnel.overallConversion}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* LEFT: The Funnel */}
        <div className="col-span-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Deal Flow Pipeline</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                From qualified companies to portfolio \u2014 click any stage
              </p>
            </div>
          </div>

          <div className="py-3">
            {funnel.stages.map((stage, index) => {
              const maxWidth = 95;
              const minWidth = 30;
              const widthStep = (maxWidth - minWidth) / (funnel.stages.length - 1);
              const width = maxWidth - (widthStep * index);
              const isSelected = selectedStage === stage.id;

              {/* Universe stage with owner/region/industry breakdown */}
              if (stage.id === 'universe') {
                return (
                  <div key={stage.id}>
                    <div
                      onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                      className={`mx-auto mb-1 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                      }`}
                      style={{ width: `${width}%` }}
                    >
                      <div className="py-3 px-5 text-center">
                        <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                        <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                        <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{stage.description}</div>
                      </div>
                      <UniverseBreakdown
                        byOwner={funnel.universeByOwner}
                        byRegion={funnel.universeByRegion}
                        byIndustry={funnel.universeByIndustry}
                      />
                    </div>
                  </div>
                );
              }

              {/* Outreach stage with sub-breakdown */}
              if (stage.id === 'outreach') {
                return (
                  <div key={stage.id}>
                    <ConversionArrow rate={stage.conversionRate} />
                    <div
                      onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                      className={`mx-auto mb-1 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                          : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                      }`}
                      style={{ width: `${width}%` }}
                    >
                      <div className="py-3 px-5 text-center">
                        <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                        <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                        <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{stage.description}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-0 border-t border-[var(--border-default)]">
                        <div className="py-2 px-2 text-center border-r border-[var(--border-default)]">
                          <div className="text-[9px] font-medium text-[var(--text-tertiary)] mb-0.5">Cold Email</div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">{funnel.outreachColdEmail}</div>
                        </div>
                        <div className="py-2 px-2 text-center">
                          <div className="text-[9px] font-medium text-[var(--text-tertiary)] mb-0.5">VC Intro / Other</div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">{funnel.outreachOther}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              {/* Dealflow stage with source channel grid */}
              if (stage.id === 'dealflow' && visibleSources.length > 1) {
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-center gap-3 py-2 text-[11px]">
                      <div className="h-px flex-1 max-w-[60px] border-t-2 border-dashed border-[var(--rrw-red)]" style={{ opacity: 0.4 }} />
                      <span className="text-[var(--rrw-red)] font-medium" style={{ opacity: 0.7 }}>entered pipeline</span>
                      <div className="h-px flex-1 max-w-[60px] border-t-2 border-dashed border-[var(--rrw-red)]" style={{ opacity: 0.4 }} />
                    </div>

                    <div className="mx-auto mb-1" style={{ width: `${width}%` }}>
                      <div
                        onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                        className={`rounded-t-lg border-2 border-b py-2.5 px-5 cursor-pointer transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                            : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                          <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                          <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                            {stage.description}
                            {stage.currentCount > 0 && ` · ${stage.currentCount} currently here`}
                          </div>
                          {(
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate('/deal-analysis'); }}
                              className="text-[10px] mt-1 hover:underline"
                              style={{ color: 'var(--rrw-red)' }}
                            >
                              View in Deal Analysis →
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className="grid gap-0 border-2 border-t-0 border-[var(--border-default)] rounded-b-lg overflow-hidden"
                        style={{ gridTemplateColumns: `repeat(${Math.min(visibleSources.length, 4)}, 1fr)` }}
                      >
                        {visibleSources.slice(0, 4).map((channel, ci) => (
                          <div
                            key={channel.id}
                            onClick={(e) => { e.stopPropagation(); setFilters({ ...filters, source: channel.id }); }}
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

              {/* Default stage rendering */}
              return (
                <div key={stage.id}>
                  {index > 0 && stage.id !== 'dealflow' && (
                    <ConversionArrow rate={stage.conversionRate} />
                  )}
                  <div
                    onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                    className={`mx-auto mb-1 py-3 px-5 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <div className="text-center">
                      <div className="text-xl font-bold text-[var(--text-primary)]">{stage.count.toLocaleString()}</div>
                      <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                      <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                        {stage.description}
                        {!TOP_FUNNEL_STAGES.has(stage.id) && stage.currentCount > 0 &&
                          ` · ${stage.currentCount} currently here`
                        }
                        {stage.totalAmount > 0 && ` · ${stage.totalAmount.toFixed(0)}M€ raised`}
                      </div>
                      {DEAL_ANALYSIS_STAGES.has(stage.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/deal-analysis'); }}
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
            {funnel.stages.slice(1).map((stage, i) => {
              const prev = funnel.stages[i];
              const rate = stage.conversionRate;
              if (rate == null) return null;
              const rateColor = rate >= 40 ? 'text-emerald-500' : rate >= 20 ? 'text-amber-500' : 'text-red-500';
              return (
                <div key={stage.id} className="flex justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                  <span className="text-[12px] text-[var(--text-tertiary)]">{prev.name} → {stage.name}</span>
                  <span className={`font-semibold text-[13px] ${rateColor}`}>{rate}%</span>
                </div>
              );
            })}
          </div>

          {/* Email Performance */}
          {emailMetrics.totalEmails > 0 && (
            <div className="border-t border-[var(--border-default)] pt-4 mb-4">
              <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Email Performance</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">{emailMetrics.totalEmails}</div>
                    <div className="text-[9px] text-[var(--text-quaternary)]">Emails</div>
                  </div>
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">{emailMetrics.emailToCallCount}</div>
                    <div className="text-[9px] text-[var(--text-quaternary)]">→ Calls</div>
                  </div>
                  <div className="bg-[var(--bg-tertiary)] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-[var(--text-primary)]">{emailMetrics.emailToDealflowCount}</div>
                    <div className="text-[9px] text-[var(--text-quaternary)]">→ Dealflow</div>
                  </div>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-tertiary)]">Email → Call</span>
                  <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{emailMetrics.emailToCallRate}%</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--text-tertiary)]">Email → Dealflow</span>
                  <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{emailMetrics.emailToDealflowRate}%</span>
                </div>

                {emailMetrics.byYear?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="text-[10px] text-[var(--text-quaternary)] mb-1.5">By Year</div>
                    {emailMetrics.byYear.map(([year, data]) => (
                      <div key={year} className="flex items-center justify-between text-[11px] py-1">
                        <span className="text-[var(--text-tertiary)] font-medium">{year}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-quaternary)]">{data.emails} emails</span>
                          <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                          <span className="text-[var(--text-quaternary)]">{data.calls} calls</span>
                          <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                          <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{data.dealflow} deals</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* By Source Channel */}
          <div className="border-t border-[var(--border-default)] pt-4 mb-4">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Source Channel</h4>
            <div className="space-y-2">
              {funnel.sourceSummary
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

          {/* By Source Member */}
          {funnel.bySourceMember.length > 0 && (
            <div className="border-t border-[var(--border-default)] pt-4 mb-4">
              <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Source (Team)</h4>
              <div className="space-y-1.5">
                {funnel.bySourceMember.slice(0, 10).map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)] font-medium">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-quaternary)]">{data.total}</span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="text-[var(--text-quaternary)]">{data.met}</span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{data.committee}</span>
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-[var(--text-quaternary)] flex justify-end gap-3 pt-1">
                  <span>deals</span><span className="w-2" /><span>met</span><span className="w-2" /><span>committee</span>
                </div>
              </div>
            </div>
          )}

          {/* By Owner (top-of-funnel) */}
          {funnel.byOwner.length > 0 && (
            <div className="border-t border-[var(--border-default)] pt-4 mb-4">
              <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Owner (Sourcing)</h4>
              <div className="space-y-1.5">
                {funnel.byOwner.slice(0, 10).map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)] font-medium">{name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-quaternary)]">{data.universe}</span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="text-[var(--text-quaternary)]">{data.outreach}</span>
                      <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                      <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{data.dealflow}</span>
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-[var(--text-quaternary)] flex justify-end gap-3 pt-1">
                  <span>qualified</span><span className="w-2" /><span>outreach</span><span className="w-2" /><span>dealflow</span>
                </div>
              </div>
            </div>
          )}

          {/* Key stats */}
          <div className="border-t border-[var(--border-default)] pt-4">
            <div className="space-y-2.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Qualified Universe</span>
                <span className="font-semibold text-[var(--text-primary)]">{funnel.counts.universe.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">In Deal Flow</span>
                <span className="font-semibold text-[var(--text-primary)]">{funnel.counts.dealflow.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Active Deals</span>
                <span className="font-semibold" style={{ color: 'var(--rrw-red)' }}>{funnel.activeDeals}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Reached Committee+</span>
                <span className="font-semibold text-[var(--text-primary)]">{funnel.counts.committee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--text-tertiary)]">Portfolio (Won)</span>
                <span className="font-semibold text-[var(--text-primary)]">{funnel.counts.portfolio.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && (
        <StageDetailPanel
          stage={selectedStageData}
          stageId={selectedStage}
          onClose={() => setSelectedStage(null)}
        />
      )}
    </div>
  );
}

// ─── Stage Detail Panel ──────────────────────────────────────────────
function StageDetailPanel({ stage, stageId, onClose }) {
  const navigate = useNavigate();
  const isTopFunnel = TOP_FUNNEL_STAGES.has(stageId);
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">{stage.name}</h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            {stage.items?.length || 0} {isTopFunnel ? 'companies' : 'deals'} at this stage
            {!isTopFunnel && stage.currentCount > 0 && ` · ${stage.currentCount} currently here`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {DEAL_ANALYSIS_STAGES.has(stageId) && (
            <button
              onClick={() => navigate('/deal-analysis')}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[var(--rrw-red)] hover:bg-[var(--rrw-red-subtle)] transition-colors"
              style={{ color: 'var(--rrw-red)' }}
            >
              Open in Deal Analysis →
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {isTopFunnel ? <CompanyTable items={stage.items} /> : <DealTable items={stage.items} />}
    </div>
  );
}

// ─── Company table (top-of-funnel) ───────────────────────────────────
function CompanyTable({ items }) {
  return (
    <>
      <div className="flex items-center px-3 py-2 text-[10px] font-medium text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-default)]">
        <div className="flex-1">Company</div>
        <div className="w-28 text-center">Status</div>
        <div className="w-24 text-center">Owner</div>
        <div className="w-28 text-center">First Email</div>
        <div className="w-28 text-center">First Meeting</div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {(items || [])
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 100)
          .map((c, i) => (
            <div key={c.id || i} className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt="" className="w-5 h-5 rounded object-contain" />
                ) : (
                  <div className="w-5 h-5 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[9px] text-[var(--text-quaternary)]">
                    {c.name?.charAt(0) || '?'}
                  </div>
                )}
                <span className="font-medium text-[var(--text-primary)] text-[12px] truncate">{c.name}</span>
              </div>
              <div className="w-28 text-center">
                <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-quaternary)]">
                  {c.status4 || '--'}
                </span>
              </div>
              <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                {c.ownerIds.map(id => TEAM_MAP[id] || '?').join(', ') || '--'}
              </div>
              <div className="w-28 text-center text-[11px] text-[var(--text-tertiary)]">
                {c.firstEmail ? new Date(c.firstEmail).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '--'}
              </div>
              <div className="w-28 text-center text-[11px] text-[var(--text-tertiary)]">
                {c.firstCalendar ? new Date(c.firstCalendar).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '--'}
              </div>
            </div>
          ))}
        {(items || []).length > 100 && (
          <div className="text-center py-3 text-[11px] text-[var(--text-quaternary)]">
            Showing first 100 · {items.length - 100} more
          </div>
        )}
      </div>
    </>
  );
}

// ─── Deal table (bottom-of-funnel) ───────────────────────────────────
function DealTable({ items }) {
  return (
    <>
      <div className="flex items-center px-3 py-2 text-[10px] font-medium text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-default)]">
        <div className="flex-1">Deal</div>
        <div className="w-32 text-center">Pipeline Status</div>
        <div className="w-28 text-center">Max Status</div>
        <div className="w-28 text-center">Source</div>
        <div className="w-24 text-center">Source Member</div>
        <div className="w-20 text-right">Amount</div>
        <div className="w-16 text-center">Year</div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {(items || [])
          .sort((a, b) => (b.amountInMeu || 0) - (a.amountInMeu || 0))
          .slice(0, 50)
          .map((deal, i) => (
            <div key={deal.id || i} className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-[var(--text-primary)] text-[12px] block truncate" title={deal.name}>
                  {deal.name}
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
                {deal.maxStatus5 || '--'}
              </div>
              <div className="w-28 text-center text-[11px] text-[var(--text-tertiary)]">
                {deal.sourceType || '--'}
              </div>
              <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                {deal.sourceName || '--'}
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
              <div className="w-16 text-center text-[11px] text-[var(--text-tertiary)]">
                {deal.createdYear || '--'}
              </div>
            </div>
          ))}
        {(items || []).length > 50 && (
          <div className="text-center py-3 text-[11px] text-[var(--text-quaternary)]">
            Showing top 50 by amount · {items.length - 50} more
          </div>
        )}
      </div>
    </>
  );
}

// ─── Universe breakdown (owner / region / industry) ─────────────────
const SEGMENT_COLORS = ['#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED', '#EC4899'];
const SEGMENT_TABS = [
  { id: 'owner', label: 'Owner' },
  { id: 'region', label: 'Region' },
  { id: 'industry', label: 'Industry' },
];

function UniverseBreakdown({ byOwner, byRegion, byIndustry }) {
  const [tab, setTab] = useState('owner');
  const data = tab === 'owner' ? byOwner : tab === 'region' ? byRegion : byIndustry;
  const top = data.slice(0, 6);
  const rest = data.slice(6);
  const otherCount = rest.reduce((s, d) => s + d.count, 0);
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  const segments = [
    ...top.map((d, i) => ({ ...d, color: SEGMENT_COLORS[i] })),
    ...(otherCount > 0 ? [{ name: 'Other', count: otherCount, pct: Math.round((otherCount / total) * 100), color: '#9CA3AF' }] : []),
  ];

  return (
    <div className="border-t border-[var(--border-default)]">
      {/* Tab toggle */}
      <div className="flex items-center justify-center gap-0.5 py-2 px-3">
        {SEGMENT_TABS.map(t => (
          <button
            key={t.id}
            onClick={(e) => { e.stopPropagation(); setTab(t.id); }}
            className={`px-2.5 py-1 text-[10px] font-medium rounded transition-all ${
              tab === t.id
                ? 'bg-[var(--rrw-red)] text-white'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Segmented bar */}
      <div className="flex h-2.5 mx-3 mb-2 rounded-full overflow-hidden gap-px">
        {segments.map((s, i) => (
          <div
            key={i}
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.max((s.count / total) * 100, 1.5)}%`,
              backgroundColor: s.color,
              borderRadius: i === 0 ? '9999px 0 0 9999px' : i === segments.length - 1 ? '0 9999px 9999px 0' : '0',
            }}
            title={`${s.name}: ${s.count} (${s.pct}%)`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[var(--text-secondary)] truncate">{s.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              <span className="font-semibold text-[var(--text-primary)]">{s.count.toLocaleString()}</span>
              <span className="text-[var(--text-quaternary)]">{s.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Conversion arrow between stages ─────────────────────────────────
function ConversionArrow({ rate }) {
  if (rate == null) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-1.5 text-[11px]">
      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
      <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{rate}%</span>
      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
    </div>
  );
}
