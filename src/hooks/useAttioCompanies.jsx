import { useState, useEffect, useCallback } from 'react';
import {
  fetchDealFlowEntries,
  fetchOwnedCompanies,
  fetchDealRecordNames,
  extractCompanyFields,
  getCachedDealFunnel,
  setCachedDealFunnel,
} from '../services/attioApi';
import { TEAM_MAP } from '../data/team';

// ─── Funnel stages ───────────────────────────────────────────────────
export const FUNNEL_STAGES = [
  { id: 'universe',  name: 'Qualified Universe',    description: 'Companies with an assigned owner' },
  { id: 'outreach',  name: 'Outreach',              description: 'Contact attempted (cold emails, VC intros)' },
  { id: 'contact',   name: 'Contact Established',   description: 'Founder responded / meeting scheduled' },
  { id: 'dealflow',  name: 'Dealflow',              description: 'Deck received, deal confirmed' },
  { id: 'met',       name: 'Met',                   description: 'First meeting held with founders' },
  { id: 'analysis',  name: 'In-Depth Analysis',     description: 'Deep-dive due diligence' },
  { id: 'committee', name: 'Committee',             description: 'IC presentation' },
  { id: 'portfolio', name: 'Won / Portfolio',       description: 'Investment made' },
];

// Stage order for cumulative comparison
const STAGE_ORDER = ['universe', 'outreach', 'contact', 'dealflow', 'met', 'analysis', 'committee', 'portfolio'];

function stageIndex(stageId) {
  return STAGE_ORDER.indexOf(stageId);
}

// ─── Source channels (from deal_flow_4 source_type_8 field) ──────────
export const SOURCE_CHANNELS = [
  { id: 'Proactively sourced', name: 'Proactive', color: '#3B82F6' },
  { id: 'Direct inbound', name: 'Direct Inbound', color: '#10B981' },
  { id: 'VC network', name: 'VC Network', color: '#8B5CF6' },
  { id: 'Other network (referrals...)', name: 'Referrals', color: '#F59E0B' },
  { id: 'Intermediate (Banker)', name: 'Banker', color: '#EF4444' },
  { id: 'Venture Partner', name: 'Venture Partner', color: '#EC4899' },
  { id: 'Other', name: 'Other', color: '#6B7280' },
  { id: 'unknown', name: 'Untagged', color: '#9CA3AF' },
];

// ─── Company status → top-of-funnel stage ────────────────────────────
const STATUS_TO_TOP_FUNNEL = {
  'Qualification':           'universe',
  'To contact':              'universe',
  'Contacted / to meet':     'outreach',
  'Ghosting (Help)':         'outreach',
  'Met':                     'contact',
  'To nurture':              'contact',
  // These have entered dealflow or beyond
  'Dealflow':                'dealflow_bridge',
  'Due Dilligence':          'dealflow_bridge',
  'IC':                      'dealflow_bridge',
  'Portfolio':               'dealflow_bridge',
  'Passed':                  'dealflow_bridge',
  'To Decline':              'dealflow_bridge',
  'Analysed but too early':  'dealflow_bridge',
  // Excluded (filtered at API level, but safety fallback)
  'Old/ Out of scope':       'excluded',
  'No US path for now':      'excluded',
};

// ─── Deal flow satus/max_status → bottom-of-funnel stage ────────────
const MAX_STATUS_TO_STAGE = {
  'Qualified':          'dealflow',
  'Screened':           'dealflow',
  'In depth analysis':  'analysis',
  'LOI':                'analysis',
  'Memo started':       'analysis',
};

const SATUS_TO_STAGE = {
  'Dealflow qualification': 'dealflow',
  'To Meet':                'dealflow',
  'Coming soon':            'dealflow',
  'Met':                    'met',
  'Committee':              'committee',
  'Won / Portfolio':        'portfolio',
  'Standby':                'dealflow',
  'Unqualified':            'dealflow',
  'To decline':             'declined',
  'Declined':               'declined',
};

function getHighestStage(satus, maxStatus5) {
  let highest = 'dealflow';
  if (maxStatus5 && MAX_STATUS_TO_STAGE[maxStatus5]) {
    const mapped = MAX_STATUS_TO_STAGE[maxStatus5];
    if (stageIndex(mapped) > stageIndex(highest)) highest = mapped;
  }
  if (satus && SATUS_TO_STAGE[satus]) {
    const mapped = SATUS_TO_STAGE[satus];
    if (mapped !== 'declined' && stageIndex(mapped) > stageIndex(highest)) highest = mapped;
  }
  if (satus === 'Met' && stageIndex('met') > stageIndex(highest)) highest = 'met';
  return highest;
}

function getCurrentStage(satus) {
  if (!satus) return 'dealflow';
  return SATUS_TO_STAGE[satus] || 'dealflow';
}

function parseYear(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Process company records into top-of-funnel data ─────────────────
function processCompanies(rawRecords) {
  const companies = [];
  for (const rec of rawRecords) {
    const c = extractCompanyFields(rec);
    if (!c) continue;
    const topStage = STATUS_TO_TOP_FUNNEL[c.status4] || 'universe';
    if (topStage === 'excluded') continue; // shouldn't happen with API filter, but safety
    companies.push({
      ...c,
      topStage,
      emailYear: parseYear(c.firstEmail),
      calendarYear: parseYear(c.firstCalendar),
    });
  }
  return companies;
}

// ─── Process deal flow entries (same as before, minus screened) ───────
function processDealEntries(entries, nameMap) {
  return entries.map(entry => {
    const satus = entry.satus;
    const maxStatus5 = entry.max_status_5;
    const sourceType = entry.source_type_8;
    const amountRaw = entry.amount_in_meu;
    const sourceName = entry.source_ws_id ? (TEAM_MAP[entry.source_ws_id] || 'Unknown') : null;
    const highestStage = getHighestStage(satus, maxStatus5);
    const currentStage = getCurrentStage(satus);
    const isDeclined = satus === 'Declined' || satus === 'To decline';
    const isActive = !isDeclined;
    const createdYear = parseYear(entry.created_at);
    const source = sourceType || 'unknown';

    const recordInfo = nameMap?.get(entry.record_id);
    const name = recordInfo?.name || entry.record_id?.substring(0, 8) || 'Unknown Deal';
    const ownerIds = recordInfo?.ownerIds || [];
    const domain = recordInfo?.domain || null;
    const logoUrl = recordInfo?.logoUrl || null;

    return {
      id: entry.entry_id,
      dealRecordId: entry.record_id,
      name,
      ownerIds,
      domain,
      logoUrl,
      satus,
      maxStatus5,
      highestStage,
      currentStage,
      isDeclined,
      isActive,
      source,
      sourceType,
      sourceName,
      amountInMeu: amountRaw != null ? parseFloat(amountRaw) : null,
      foundingTeam: entry.founding_team,
      createdAt: entry.created_at,
      createdYear,
    };
  });
}

// ─── Compute email performance metrics ───────────────────────────────
function computeEmailMetrics(companies) {
  const withEmail = companies.filter(c => c.firstEmail);
  const withCalendar = companies.filter(c => c.firstCalendar);
  const emailToCalendar = withEmail.filter(c => c.firstCalendar);
  const dealflowStatuses = new Set([
    'Dealflow', 'Due Dilligence', 'IC', 'Portfolio', 'Passed', 'To Decline', 'Analysed but too early',
  ]);
  const emailToDealflow = withEmail.filter(c => dealflowStatuses.has(c.status4));

  // By year
  const byYear = {};
  for (const c of withEmail) {
    const yr = c.emailYear || 'Unknown';
    if (!byYear[yr]) byYear[yr] = { emails: 0, calls: 0, dealflow: 0 };
    byYear[yr].emails++;
    if (c.firstCalendar) byYear[yr].calls++;
    if (dealflowStatuses.has(c.status4)) byYear[yr].dealflow++;
  }

  return {
    totalEmails: withEmail.length,
    totalCalls: withCalendar.length,
    emailToCallCount: emailToCalendar.length,
    emailToCallRate: withEmail.length > 0 ? Math.round((emailToCalendar.length / withEmail.length) * 100) : 0,
    emailToDealflowCount: emailToDealflow.length,
    emailToDealflowRate: withEmail.length > 0 ? Math.round((emailToDealflow.length / withEmail.length) * 100) : 0,
    byYear: Object.entries(byYear)
      .filter(([yr]) => yr !== 'Unknown')
      .sort(([a], [b]) => parseInt(b) - parseInt(a)),
  };
}

// ─── The hook ────────────────────────────────────────────────────────
export function useAttioCompanies() {
  const cached = getCachedDealFunnel();
  const [data, setData] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        // Phase 1: Fetch both data sources in parallel
        const [rawCompanies, dealEntries] = await Promise.all([
          fetchOwnedCompanies(),
          fetchDealFlowEntries(),
        ]);

        if (cancelled) return;

        // Phase 2: Fetch deal record names for kanban deals (Met + Committee)
        const KANBAN_STATUSES = new Set(['Met', 'Committee']);
        const kanbanRecordIds = dealEntries
          .filter(e => KANBAN_STATUSES.has(e.satus))
          .map(e => e.record_id)
          .filter(Boolean);
        const uniqueIds = [...new Set(kanbanRecordIds)];
        const nameMap = await fetchDealRecordNames(uniqueIds).catch(() => new Map());

        if (cancelled) return;

        // Process both data sources
        const companies = processCompanies(rawCompanies);
        const deals = processDealEntries(dealEntries, nameMap);
        const emailMetrics = computeEmailMetrics(companies);

        // Build the combined result
        const result = {
          companies,
          deals,
          emailMetrics,
          universeCount: companies.length,
        };

        if (!cancelled) {
          setData(result);
          setIsLive(true);
          setError(null);
          setCachedDealFunnel(result);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch deal funnel data:', err.message);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Backward-compatible dealFlowData for DealAnalysis.jsx
  const dealFlowData = data ? {
    deals: data.deals,
    qualifiedCount: data.universeCount,
    totalDeals: data.deals.length,
    activeDeals: data.deals.filter(d => d.isActive).length,
  } : null;

  return {
    // New funnel data
    funnelData: data,
    // Backward compatible for DealAnalysis
    dealFlowData,
    loading,
    error,
    isLive,
  };
}

export default useAttioCompanies;
