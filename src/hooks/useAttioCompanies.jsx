import { useState, useEffect, useCallback } from 'react';
import {
  fetchDealFlowEntries,
  fetchProactiveSourcingCount,
  fetchDealRecordNames,
  getCachedDealFunnel,
  setCachedDealFunnel,
} from '../services/attioApi';
import { TEAM_MAP } from '../data/team';

// Universe placeholder — real number unknown, estimated European ecosystem
export const UNIVERSE_PLACEHOLDER = '10,000+';
export const UNIVERSE_PLACEHOLDER_VALUE = 10000;

// The funnel stage order for display
// Stages are cumulative: each includes all deals that REACHED that stage (via max_status_5)
export const FUNNEL_STAGES = [
  { id: 'universe', name: 'Sourcing Universe', description: 'Estimated European startup ecosystem' },
  { id: 'qualified', name: 'Qualified', description: 'In Proactive Sourcing list (owner assigned)' },
  { id: 'dealflow', name: 'Dealflow Qualification', description: 'Entered the deal flow pipeline' },
  { id: 'screened', name: 'Screened', description: 'Initial screening completed' },
  { id: 'met', name: 'Met', description: 'First meeting held with founders' },
  { id: 'analysis', name: 'In-Depth Analysis', description: 'Deep-dive due diligence underway' },
  { id: 'committee', name: 'Committee', description: 'Presented to Investment Committee' },
  { id: 'portfolio', name: 'Won / Portfolio', description: 'Investment made' },
];

// Source channels — real values from source_type_8 field in deal flow list
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

// Map max_status_5 values to funnel stage IDs
// max_status_5 represents the HIGHEST stage a deal reached
const MAX_STATUS_TO_STAGE = {
  'Qualified': 'screened',   // "Qualified" in max_status means it was screened
  'Screened': 'screened',
  'In depth analysis': 'analysis',
  'LOI': 'analysis', // LOI is part of in-depth analysis stage
  'Memo started': 'analysis',
};

// Map satus (pipeline) values to funnel stage IDs for current status
const SATUS_TO_STAGE = {
  'Dealflow qualification': 'dealflow',
  'To Meet': 'dealflow',
  'Coming soon': 'dealflow',
  'Met': 'met',
  'Committee': 'committee',
  'Won / Portfolio': 'portfolio',
  'Standby': 'dealflow',
  'Unqualified': 'dealflow',
  'To decline': 'declined',
  'Declined': 'declined',
};

// Ordered stage IDs for comparison (higher index = further in funnel)
const STAGE_ORDER = ['universe', 'qualified', 'dealflow', 'screened', 'met', 'analysis', 'committee', 'portfolio'];

function stageIndex(stageId) {
  return STAGE_ORDER.indexOf(stageId);
}

// Determine the highest funnel stage a deal reached
// Uses max_status_5 for historical max AND satus for current position
function getHighestStage(satus, maxStatus5) {
  let highest = 'dealflow'; // minimum: if in deal flow list, they're at least dealflow

  // Check max_status_5 (historical max reached)
  if (maxStatus5 && MAX_STATUS_TO_STAGE[maxStatus5]) {
    const mapped = MAX_STATUS_TO_STAGE[maxStatus5];
    if (stageIndex(mapped) > stageIndex(highest)) {
      highest = mapped;
    }
  }

  // Check satus (current pipeline position)
  if (satus && SATUS_TO_STAGE[satus]) {
    const mapped = SATUS_TO_STAGE[satus];
    if (mapped !== 'declined' && stageIndex(mapped) > stageIndex(highest)) {
      highest = mapped;
    }
  }

  // Special: if satus is Met, ensure at least 'met'
  if (satus === 'Met' && stageIndex('met') > stageIndex(highest)) {
    highest = 'met';
  }

  return highest;
}

// Get current active stage (where deal sits NOW in pipeline)
function getCurrentStage(satus) {
  if (!satus) return 'dealflow';
  return SATUS_TO_STAGE[satus] || 'dealflow';
}

// Parse created_at to extract year
function parseCreatedYear(createdAt) {
  if (!createdAt) return null;
  const match = createdAt.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

export function useAttioCompanies() {
  const cached = getCachedDealFunnel();
  const [dealFlowData, setDealFlowData] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  // Process entries: merge deal entries with deal record names
  const processEntries = useCallback((entries, qualifiedCount, nameMap) => {
    const deals = entries.map(entry => {
      const satus = entry.satus;
      const maxStatus5 = entry.max_status_5;
      const sourceType = entry.source_type_8;
      const amountRaw = entry.amount_in_meu;
      const sourceName = entry.source_ws_id ? (TEAM_MAP[entry.source_ws_id] || 'Unknown') : null;

      // Determine funnel stages
      const highestStage = getHighestStage(satus, maxStatus5);
      const currentStage = getCurrentStage(satus);
      const isDeclined = satus === 'Declined' || satus === 'To decline';
      const isActive = !isDeclined;
      const createdYear = parseCreatedYear(entry.created_at);

      // Source channel
      const source = sourceType || 'unknown';

      // Deal name + owner IDs from the deals_2 record
      const recordInfo = nameMap?.get(entry.record_id);
      const name = recordInfo?.name || entry.record_id?.substring(0, 8) || 'Unknown Deal';
      const ownerIds = recordInfo?.ownerIds || [];

      return {
        id: entry.entry_id,
        dealRecordId: entry.record_id,
        name,
        ownerIds,
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

    return {
      deals,
      qualifiedCount,
      totalDeals: deals.length,
      activeDeals: deals.filter(d => d.isActive).length,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        // Phase 1: Fetch deal entries + qualified count in parallel
        const [entries, qualifiedCount] = await Promise.all([
          fetchDealFlowEntries(),
          fetchProactiveSourcingCount(),
        ]);

        if (cancelled) return;

        // Phase 2: Fetch deal record names for active deals only (much smaller set)
        // Only fetch names for non-declined deals to keep it fast
        const activeRecordIds = entries
          .filter(e => e.satus !== 'Declined' && e.satus !== 'To decline')
          .map(e => e.record_id)
          .filter(Boolean);

        // Deduplicate
        const uniqueIds = [...new Set(activeRecordIds)];
        const nameMap = await fetchDealRecordNames(uniqueIds).catch(() => new Map());

        if (cancelled) return;

        const processed = processEntries(entries, qualifiedCount, nameMap);

        if (!cancelled) {
          setDealFlowData(processed);
          setIsLive(true);
          setError(null);
          setCachedDealFunnel(processed);
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
  }, [processEntries]);

  return { dealFlowData, loading, error, isLive };
}

export default useAttioCompanies;
