import { useState, useMemo } from 'react';
import { useAttioLPs, FUNDS, COMMIT_STAGES, FUND3_STAGES, FUND2_STAGES, LP_TEAM_MEMBERS, LP_TEAM_MAP } from '../hooks/useAttioLPs';

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

function formatCurrency(amount, currency) {
  if (amount == null) return '—';
  if (currency === 'USD') {
    return amount >= 1_000_000
      ? `$${(amount / 1_000_000).toFixed(1)}M`
      : amount >= 1_000
        ? `$${(amount / 1_000).toFixed(0)}K`
        : `$${amount.toLocaleString()}`;
  }
  return amount >= 1_000_000
    ? `€${(amount / 1_000_000).toFixed(1)}M`
    : amount >= 1_000
      ? `€${(amount / 1_000).toFixed(0)}K`
      : `€${amount.toLocaleString()}`;
}

function formatCurrencyFull(amount, currency) {
  if (amount == null) return '—';
  const sym = currency === 'USD' ? '$' : '€';
  return `${sym}${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function LPPipeline() {
  const { lps, loading, isLive } = useAttioLPs();

  const [selectedFund, setSelectedFund] = useState('commit');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedType, setSelectedType] = useState('all');

  const fund = FUNDS.find(f => f.id === selectedFund);
  const stages = selectedFund === 'fund3' ? FUND3_STAGES : selectedFund === 'fund2' ? FUND2_STAGES : COMMIT_STAGES;

  // LP types for filter
  const lpTypes = useMemo(() => {
    const set = new Set();
    lps.forEach(lp => { if (lp.lpType) set.add(lp.lpType); });
    return ['all', ...Array.from(set).sort()];
  }, [lps]);

  // Filter LPs by owner and type
  const filtered = useMemo(() => {
    return lps.filter(lp => {
      if (selectedOwner !== 'all' && !lp.ownerIds.includes(selectedOwner)) return false;
      if (selectedType !== 'all' && lp.lpType !== selectedType) return false;
      return true;
    });
  }, [lps, selectedOwner, selectedType]);

  // Build funnel data for selected fund
  const funnelData = useMemo(() => {
    const statusSlug = selectedFund === 'fund3' ? 'fund3Status' : selectedFund === 'fund2' ? 'fund2Status' : 'commitStatus';
    const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';
    const currency = fund?.currency || 'EUR';

    // Build stage lookup from attio values
    const statusToStage = {};
    stages.forEach(stage => {
      stage.attioValues.forEach(v => { statusToStage[v] = stage.id; });
    });

    // Categorize LPs into stages
    const stageMap = {};
    stages.forEach(s => { stageMap[s.id] = { lps: [], totalAmount: 0, weightedAmount: 0 }; });

    // Also track "no status" LPs (ones that don't have a status for this fund)
    let noStatusCount = 0;

    filtered.forEach(lp => {
      const status = lp[statusSlug];
      const amount = lp[amountSlug] || 0;
      const stageId = status ? statusToStage[status] : null;

      if (!stageId || !stageMap[stageId]) {
        noStatusCount++;
        return;
      }

      const stageDef = stages.find(s => s.id === stageId);
      const weight = stageDef?.weight || 0;

      stageMap[stageId].lps.push(lp);
      stageMap[stageId].totalAmount += amount;
      stageMap[stageId].weightedAmount += amount * weight;
    });

    // Build stage array
    const stageData = stages.map(stage => ({
      ...stage,
      count: stageMap[stage.id].lps.length,
      lps: stageMap[stage.id].lps,
      totalAmount: stageMap[stage.id].totalAmount,
      weightedAmount: stageMap[stage.id].weightedAmount,
    }));

    // Exclude declined and pre-pipeline (interested) from active pipeline calculations
    const activeStages = stageData.filter(s => s.id !== 'declined' && s.id !== 'interested');
    const pipelineTotal = activeStages.reduce((sum, s) => sum + s.totalAmount, 0);
    const weightedTotal = activeStages.reduce((sum, s) => sum + s.weightedAmount, 0);
    const totalLPs = activeStages.reduce((sum, s) => sum + s.count, 0);

    // Committed = oral agreement + second closing agreement (for >Commit) or oral agreement (for Fund III)
    // For Fund II, all LPs are committed (historical fund)
    const committedStageIds = selectedFund === 'fund2'
      ? ['invested']
      : selectedFund === 'fund3'
        ? ['oral_agreement']
        : ['oral_agreement', 'second_closing_agreement'];
    const committedAmount = stageData
      .filter(s => committedStageIds.includes(s.id))
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const committedCount = stageData
      .filter(s => committedStageIds.includes(s.id))
      .reduce((sum, s) => sum + s.count, 0);

    // Declined stats
    const declinedStage = stageData.find(s => s.id === 'declined');
    const declinedCount = declinedStage?.count || 0;
    const declinedAmount = declinedStage?.totalAmount || 0;

    return {
      stages: stageData,
      pipelineTotal,
      weightedTotal,
      committedAmount,
      committedCount,
      totalLPs,
      declinedCount,
      declinedAmount,
      noStatusCount,
      currency,
    };
  }, [filtered, selectedFund, stages, fund]);

  // By owner breakdown
  const ownerBreakdown = useMemo(() => {
    const statusSlug = selectedFund === 'fund3' ? 'fund3Status' : selectedFund === 'fund2' ? 'fund2Status' : 'commitStatus';
    const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';

    const byOwner = {};

    filtered.forEach(lp => {
      const status = lp[statusSlug];
      if (!status) return;

      const amount = lp[amountSlug] || 0;
      const owners = lp.ownerIds.length > 0 ? lp.ownerIds : ['unassigned'];

      owners.forEach(oid => {
        const name = LP_TEAM_MAP[oid] || 'Unassigned';
        if (!byOwner[name]) byOwner[name] = { count: 0, amount: 0, weighted: 0 };
        byOwner[name].count++;
        byOwner[name].amount += amount;

        // Find weight for this LP's stage
        const statusToStage = {};
        stages.forEach(stage => {
          stage.attioValues.forEach(v => { statusToStage[v] = stage; });
        });
        const stageDef = statusToStage[status];
        byOwner[name].weighted += amount * (stageDef?.weight || 0);
      });
    });

    return Object.entries(byOwner)
      .sort((a, b) => b[1].weighted - a[1].weighted);
  }, [filtered, selectedFund, stages]);

  // By LP type breakdown
  const typeBreakdown = useMemo(() => {
    const statusSlug = selectedFund === 'fund3' ? 'fund3Status' : selectedFund === 'fund2' ? 'fund2Status' : 'commitStatus';
    const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';

    const byType = {};

    filtered.forEach(lp => {
      const status = lp[statusSlug];
      if (!status) return;

      const amount = lp[amountSlug] || 0;
      const type = lp.lpType || 'Unknown';

      if (!byType[type]) byType[type] = { count: 0, amount: 0 };
      byType[type].count++;
      byType[type].amount += amount;
    });

    return Object.entries(byType)
      .sort((a, b) => b[1].amount - a[1].amount);
  }, [filtered, selectedFund]);

  // By country breakdown
  const countryBreakdown = useMemo(() => {
    const statusSlug = selectedFund === 'fund3' ? 'fund3Status' : selectedFund === 'fund2' ? 'fund2Status' : 'commitStatus';
    const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';

    const byCountry = {};

    filtered.forEach(lp => {
      const status = lp[statusSlug];
      if (!status) return;

      const amount = lp[amountSlug] || 0;
      const c = lp.country || 'Unknown';

      if (!byCountry[c]) byCountry[c] = { count: 0, amount: 0 };
      byCountry[c].count++;
      byCountry[c].amount += amount;
    });

    return Object.entries(byCountry)
      .sort((a, b) => b[1].amount - a[1].amount);
  }, [filtered, selectedFund]);

  const selectedStageData = selectedStage
    ? funnelData.stages.find(s => s.id === selectedStage)
    : null;

  if (loading && lps.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading LP data from Attio...</p>
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
            {lps.length} LPs
          </span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-6 flex-wrap">
          <FilterSelect
            label="Fund"
            value={selectedFund}
            onChange={(v) => { setSelectedFund(v); setSelectedStage(null); }}
            options={FUNDS.map(f => ({ value: f.id, label: f.name }))}
          />
          <FilterSelect
            label="Team Member"
            value={selectedOwner}
            onChange={(v) => { setSelectedOwner(v); setSelectedStage(null); }}
            options={[
              { value: 'all', label: 'Everyone' },
              ...LP_TEAM_MEMBERS.map(m => ({ value: m.id, label: m.name })),
            ]}
          />
          <FilterSelect
            label="LP Type"
            value={selectedType}
            onChange={(v) => { setSelectedType(v); setSelectedStage(null); }}
            options={lpTypes.map(t => ({ value: t, label: t === 'all' ? 'All Types' : t }))}
          />
          <div className="ml-auto text-right">
            <span className="text-xs text-[var(--text-tertiary)] block">Weighted Pipeline</span>
            <span className="text-2xl font-bold text-[var(--rrw-red)]">
              {formatCurrency(funnelData.weightedTotal, funnelData.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Pipeline Total</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatCurrency(funnelData.pipelineTotal, funnelData.currency)}
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)] mt-1">
            {funnelData.totalLPs} active LPs
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Weighted Pipeline</div>
          <div className="text-xl font-bold text-[var(--rrw-red)]">
            {formatCurrency(funnelData.weightedTotal, funnelData.currency)}
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)] mt-1">
            Expected fund size
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Committed</div>
          <div className="text-xl font-bold text-emerald-500">
            {formatCurrency(funnelData.committedAmount, funnelData.currency)}
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)] mt-1">
            {funnelData.committedCount} LPs with oral agreement
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Declined</div>
          <div className="text-xl font-bold text-[var(--text-quaternary)]">
            {formatCurrency(funnelData.declinedAmount, funnelData.currency)}
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)] mt-1">
            {funnelData.declinedCount} LPs
          </div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1">Conversion</div>
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {funnelData.totalLPs > 0
              ? `${((funnelData.committedCount / funnelData.totalLPs) * 100).toFixed(1)}%`
              : '0%'}
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)] mt-1">
            Pipeline to committed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* LEFT: The Funnel */}
        <div className="col-span-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">
                {fund?.name} Fundraising Funnel
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Click any stage to see LPs · Amounts shown are unweighted totals
              </p>
            </div>
          </div>

          <div className="py-3">
            {funnelData.stages.map((stage, index) => {
              // Progressive narrowing — like the Deal Flow pipeline
              // Exclude declined and interested from the funnel width progression
              const funnelStages = funnelData.stages.filter(s => s.id !== 'declined' && s.id !== 'interested');
              const funnelIndex = funnelStages.findIndex(s => s.id === stage.id);
              const maxWidth = 95;
              const minWidth = 30;
              let width;
              if (stage.id === 'declined') {
                width = 30;
              } else if (stage.id === 'interested') {
                width = 98; // Widest — pre-pipeline pool
              } else {
                const widthStep = (maxWidth - minWidth) / Math.max(funnelStages.length - 1, 1);
                width = maxWidth - (widthStep * funnelIndex);
              }

              const isDeclined = stage.id === 'declined';
              const isInterested = stage.id === 'interested';
              const isCommitted = stage.id === 'oral_agreement' || stage.id === 'second_closing_agreement';

              // Conversion rate from previous funnel stage
              const prevFunnelStage = funnelIndex > 0 ? funnelStages[funnelIndex - 1] : null;
              const prevStageData = prevFunnelStage ? funnelData.stages.find(s => s.id === prevFunnelStage.id) : null;
              const conversionRate = prevStageData && prevStageData.count > 0
                ? Math.round((stage.count / prevStageData.count) * 100) : null;

              return (
                <div key={stage.id}>
                  {index > 0 && !isDeclined && !isInterested && conversionRate !== null && (
                    <div className="flex items-center justify-center gap-3 py-1 text-[11px]">
                      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                      <span className="font-medium" style={{ color: 'var(--rrw-red)' }}>{conversionRate}%</span>
                      <div className="h-px flex-1 max-w-[50px]" style={{ backgroundColor: 'var(--rrw-red)' }} />
                    </div>
                  )}

                  {/* Show separator between pre-pipeline and active pipeline */}
                  {!isInterested && !isDeclined && index > 0 && funnelData.stages[index - 1]?.id === 'interested' && (
                    <div className="flex items-center justify-center gap-3 py-3 text-[11px]">
                      <div className="h-px flex-1 max-w-[100px] border-t border-dashed border-amber-500/40" />
                      <span className="text-amber-600 text-[10px] uppercase tracking-wider">Active Pipeline</span>
                      <div className="h-px flex-1 max-w-[100px] border-t border-dashed border-amber-500/40" />
                    </div>
                  )}

                  {isDeclined && (
                    <div className="flex items-center justify-center gap-3 py-3 text-[11px]">
                      <div className="h-px flex-1 max-w-[100px] border-t border-dashed border-[var(--border-default)]" />
                      <span className="text-[var(--text-quaternary)] text-[10px] uppercase tracking-wider">Exited Pipeline</span>
                      <div className="h-px flex-1 max-w-[100px] border-t border-dashed border-[var(--border-default)]" />
                    </div>
                  )}

                  <div
                    onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                    className={`mx-auto mb-1 py-2.5 px-5 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      selectedStage === stage.id
                        ? 'border-[var(--rrw-red)] bg-[var(--rrw-red-subtle)]'
                        : isDeclined
                          ? 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--text-quaternary)]'
                          : isInterested
                            ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500'
                            : isCommitted
                              ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500'
                              : 'border-[var(--border-default)] bg-[var(--bg-secondary)] hover:border-[var(--rrw-red)]'
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-[var(--text-secondary)]">{stage.name}</div>
                        <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
                          {stage.count} LP{stage.count !== 1 ? 's' : ''}
                          {stage.weight > 0 && !isDeclined && ` · ${Math.round(stage.weight * 100)}% weight`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          isCommitted ? 'text-emerald-500' : isDeclined ? 'text-[var(--text-quaternary)]' : 'text-[var(--text-primary)]'
                        }`}>
                          {formatCurrency(stage.totalAmount, funnelData.currency)}
                        </div>
                        {stage.weightedAmount > 0 && !isDeclined && (
                          <div className="text-[10px] text-[var(--rrw-red)]">
                            {formatCurrency(stage.weightedAmount, funnelData.currency)} weighted
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>
          {/* By team member */}
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">By Team Member</h3>
          <div className="space-y-2 mb-6">
            {ownerBreakdown.map(([name, data]) => (
              <div key={name} className="text-[12px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[var(--text-secondary)] font-medium">{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-quaternary)]">{data.count} LPs</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatCurrency(data.amount, funnelData.currency)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${funnelData.pipelineTotal > 0 ? (data.amount / funnelData.pipelineTotal) * 100 : 0}%`,
                        backgroundColor: 'var(--rrw-red)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--rrw-red)] font-medium w-16 text-right">
                    {formatCurrency(data.weighted, funnelData.currency)} w.
                  </span>
                </div>
              </div>
            ))}
            {ownerBreakdown.length === 0 && (
              <p className="text-[11px] text-[var(--text-quaternary)]">No LP data for this fund</p>
            )}
          </div>

          {/* By LP type */}
          <div className="border-t border-[var(--border-default)] pt-4 mb-6">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By LP Type</h4>
            <div className="space-y-1.5">
              {typeBreakdown.slice(0, 10).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">{type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-quaternary)]">{data.count}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatCurrency(data.amount, funnelData.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By country */}
          <div className="border-t border-[var(--border-default)] pt-4 mb-6">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">By Country</h4>
            <div className="space-y-1.5">
              {countryBreakdown.slice(0, 8).map(([country, data]) => (
                <div key={country} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text-secondary)]">{country}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-quaternary)]">{data.count}</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatCurrency(data.amount, funnelData.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weighted pipeline explanation */}
          <div className="border-t border-[var(--border-default)] pt-4">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Weight Scale</h4>
            <div className="space-y-1">
              {stages.filter(s => s.id !== 'declined' && s.id !== 'interested').map(stage => (
                <div key={stage.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-quaternary)]">{stage.name}</span>
                  <span className="font-medium text-[var(--text-tertiary)]">{Math.round(stage.weight * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Detail Panel */}
      {selectedStageData && (
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{selectedStageData.name}</h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                {selectedStageData.count} LP{selectedStageData.count !== 1 ? 's' : ''} · Total: {formatCurrencyFull(selectedStageData.totalAmount, funnelData.currency)}
                {selectedStageData.weightedAmount > 0 && ` · Weighted: ${formatCurrencyFull(selectedStageData.weightedAmount, funnelData.currency)}`}
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
            <div className="flex-1">LP Name</div>
            {selectedFund === 'fund3' && <div className="w-20 text-center">Interest</div>}
            <div className="w-28 text-center">Type</div>
            <div className="w-20 text-center">Country</div>
            <div className="w-24 text-center">Owner</div>
            <div className="w-28 text-right">Amount</div>
            <div className="w-28 text-right">Weighted</div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {selectedStageData.lps.length > 0 ? (
              selectedStageData.lps
                .sort((a, b) => {
                  const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';
                  return (b[amountSlug] || 0) - (a[amountSlug] || 0);
                })
                .map((lp, i) => {
                  const amountSlug = selectedFund === 'fund3' ? 'fund3Amount' : selectedFund === 'fund2' ? 'fund2Amount' : 'commitAmount';
                  const amount = lp[amountSlug] || 0;
                  const weighted = amount * (selectedStageData.weight || 0);
                  const ownerNames = lp.ownerIds
                    .map(id => LP_TEAM_MAP[id])
                    .filter(Boolean)
                    .join(', ') || 'Unassigned';
                  const isEstimate = selectedFund === 'fund3' && lp.fund3AmountIsEstimate;

                  return (
                    <div key={lp.id || i} className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-[var(--text-primary)] text-[13px] block truncate">{lp.name}</span>
                      </div>
                      {selectedFund === 'fund3' && (
                        <div className="w-20 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            lp.fund3Interest === 'Yes' ? 'bg-emerald-500/10 text-emerald-600' :
                            lp.fund3Interest === 'Maybe' ? 'bg-amber-500/10 text-amber-600' :
                            lp.fund3Interest === 'No' ? 'bg-red-500/10 text-red-500' :
                            'text-[var(--text-quaternary)]'
                          }`}>
                            {lp.fund3Interest || '—'}
                          </span>
                        </div>
                      )}
                      <div className="w-28 text-center">
                        <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                          {lp.lpType || '—'}
                        </span>
                      </div>
                      <div className="w-20 text-center text-[11px] text-[var(--text-tertiary)]">
                        {lp.country || '—'}
                      </div>
                      <div className="w-24 text-center text-[11px] text-[var(--text-tertiary)]">
                        {ownerNames}
                      </div>
                      <div className="w-28 text-right">
                        <span className={`text-[13px] font-semibold ${isEstimate ? 'text-[var(--text-tertiary)] italic' : 'text-[var(--text-primary)]'}`}>
                          {amount > 0 ? formatCurrencyFull(amount, funnelData.currency) : '—'}
                        </span>
                        {isEstimate && amount > 0 && (
                          <span className="block text-[9px] text-[var(--text-quaternary)]">est. from &gt;Commit</span>
                        )}
                      </div>
                      <div className="w-28 text-right text-[12px] text-[var(--rrw-red)] font-medium">
                        {weighted > 0 ? formatCurrencyFull(weighted, funnelData.currency) : '—'}
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-center py-8 text-[var(--text-quaternary)]">
                <p>No LPs at this stage</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
