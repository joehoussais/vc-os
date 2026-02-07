import { useState, useEffect, useCallback } from 'react';
import { fetchOwnedCompanies, getAttrValue, getAttrValues, getLocationCountryCode } from '../services/attioApi';

const CACHE_KEY = 'attio-owned-companies-cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Universe placeholder — real number unknown, estimated European ecosystem
export const UNIVERSE_PLACEHOLDER = '10,000+';
export const UNIVERSE_PLACEHOLDER_VALUE = 10000;

// Status overrides: these always map to their stage regardless of interaction signals
const STATUS_OVERRIDES = {
  'Portfolio': 'portfolio',
  'IC': 'committee',
  'Due Dilligence': 'analysis', // typo in Attio data
  'Due Diligence': 'analysis',
  'Dealflow': 'dealflow',
};

// Status hints: suggest a stage, interaction signals can also trigger these
const STATUS_HINTS = {
  'Met': 'met',
  'To nurture': 'met',
  'Contacted / to meet': 'contacted',
  'Ghosting (Help)': 'contacted',
};

// Passed statuses — determine highest reached stage via interaction signals
const PASSED_STATUSES = new Set([
  'To Decline', 'Passed', 'Analysed but too early',
  'No US path for now', 'Old/ Out of scope',
]);

// The funnel stage order for display
export const FUNNEL_STAGES = [
  { id: 'universe', name: 'Sourcing Universe', description: 'Estimated European startup ecosystem' },
  { id: 'qualified', name: 'Qualified', description: 'Owner assigned — actively tracked in our CRM' },
  { id: 'contacted', name: 'Contact Established', description: 'First email interaction recorded', split: true },
  { id: 'met', name: 'First Meeting', description: 'First calendar interaction recorded' },
  { id: 'dealflow', name: 'Deal Flow', description: 'Active fundraising round — deck under review' },
  { id: 'analysis', name: 'In-Depth Analysis', description: 'Deep-dive due diligence underway' },
  { id: 'committee', name: 'Committee (IC)', description: 'Presented to Investment Committee' },
  { id: 'portfolio', name: 'Portfolio', description: 'Investment made' },
];

// Source channels — heuristic from interaction data (no source field in Attio)
export const SOURCE_CHANNELS = [
  { id: 'cold_outreach', name: 'Cold Outreach', color: '#3B82F6' },
  { id: 'intro', name: 'Intro / Referral', color: '#8B5CF6' },
  { id: 'unknown', name: 'Untagged', color: '#9CA3AF' },
];

// Country code to region mapping (for filters)
const countryToFilterRegion = {
  'FR': 'France',
  'DE': 'DACH', 'AT': 'DACH', 'CH': 'DACH',
  'NL': 'Benelux', 'BE': 'Benelux', 'LU': 'Benelux',
  'SE': 'Nordics', 'NO': 'Nordics', 'DK': 'Nordics', 'FI': 'Nordics', 'IS': 'Nordics',
  'ES': 'Southern Europe', 'IT': 'Southern Europe', 'PT': 'Southern Europe', 'GR': 'Southern Europe',
  'GB': 'UK', 'UK': 'UK', 'IE': 'UK & Ireland',
  'PL': 'Eastern Europe', 'CZ': 'Eastern Europe', 'HU': 'Eastern Europe',
  'RO': 'Eastern Europe', 'BG': 'Eastern Europe', 'SK': 'Eastern Europe',
  'SI': 'Eastern Europe', 'HR': 'Eastern Europe', 'RS': 'Eastern Europe',
  'UA': 'Eastern Europe', 'EE': 'Eastern Europe', 'LV': 'Eastern Europe', 'LT': 'Eastern Europe',
};

// Parse interaction date ("HH:MM DD/MM/YYYY") to extract year
function parseInteractionYear(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? parseInt(match[3], 10) : null;
}

// Determine funnel stage from status + interaction signals
function determineFunnelStage(status, firstEmailInteraction, firstCalendarInteraction) {
  // 1. Status overrides always win
  if (status && STATUS_OVERRIDES[status]) {
    return STATUS_OVERRIDES[status];
  }

  // 2. Status hints
  if (status && STATUS_HINTS[status]) {
    return STATUS_HINTS[status];
  }

  // 3. Passed statuses — determine highest reached stage from interaction signals
  if (status && PASSED_STATUSES.has(status)) {
    if (firstCalendarInteraction) return 'met';
    if (firstEmailInteraction) return 'contacted';
    return 'qualified';
  }

  // 4. Pre-contact statuses (Qualification, To contact, or unknown) — check interaction signals
  if (firstCalendarInteraction) return 'met';
  if (firstEmailInteraction) return 'contacted';
  return 'qualified';
}

// Derive source channel heuristically from available data
function deriveSource(introPathCount, firstEmailInteraction) {
  if (introPathCount > 0) return 'intro';
  if (firstEmailInteraction) return 'cold_outreach';
  return 'unknown';
}

function getCachedCompanies() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedCompanies(companies) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data: companies,
      timestamp: Date.now(),
    }));
  } catch {
    // ignore
  }
}

export function useAttioCompanies() {
  const cached = getCachedCompanies();
  const [companies, setCompanies] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  const processCompanies = useCallback((rawCompanies) => {
    return rawCompanies.map(company => {
      const recordId = company.id?.record_id;
      const name = getAttrValue(company, 'name') || 'Unknown';
      const status = getAttrValue(company, 'status_4');
      const countryCode = getLocationCountryCode(company, 'primary_location') ||
        getAttrValue(company, 'cross_checked_hq_country')?.slice(0, 2)?.toUpperCase();
      const region = countryToFilterRegion[countryCode] || getAttrValue(company, 'region') || 'Other';
      const country = getAttrValue(company, 'team_country') || getAttrValue(company, 'cross_checked_hq_country') || 'Unknown';

      // Owner: actor-reference (multiselect)
      const ownerAttr = company?.values?.owner;
      const hasOwner = ownerAttr && ownerAttr.length > 0;
      const ownerIds = hasOwner ? ownerAttr.map(o => o.referenced_actor_id).filter(Boolean) : [];

      // Growth score
      const growthScore = getAttrValue(company, 'new_growth_score') ||
        getAttrValue(company, 'growth_score_rrw') || null;

      // Interaction data (auto-tracked by Attio from email/calendar sync)
      const firstEmailInteraction = getAttrValue(company, 'first_email_interaction');
      const lastEmailInteraction = getAttrValue(company, 'last_email_interaction');
      const firstCalendarInteraction = getAttrValue(company, 'first_calendar_interaction');
      const lastCalendarInteraction = getAttrValue(company, 'last_calendar_interaction');
      const firstInteraction = getAttrValue(company, 'first_interaction');
      const lastInteraction = getAttrValue(company, 'last_interaction');

      // Determine funnel stage using status + interaction signals
      const funnelStage = determineFunnelStage(status, firstEmailInteraction, firstCalendarInteraction);

      // Created date for time-based filtering
      const createdAt = getAttrValue(company, 'created_at');

      // Year parsing for time-period filters
      const contactYear = parseInteractionYear(firstEmailInteraction);
      const meetingYear = parseInteractionYear(firstCalendarInteraction);

      // Logo
      const logoUrl = getAttrValue(company, 'logo_url') || getAttrValue(company, 'logo_url_7');

      // Industry
      const industry = getAttrValues(company, 'industry');

      // Feeling
      const feeling = getAttrValue(company, 'feeling');

      // Intro path (people who introduced this company)
      const introPathAttr = company?.values?.intro_path;
      const introPathCount = introPathAttr?.length || 0;

      // Source channel — heuristic derivation (no source field in Attio)
      const source = deriveSource(introPathCount, firstEmailInteraction);

      // Connection strength
      const connectionStrength = getAttrValue(company, 'strongest_connection_strength');

      // Notes
      const notes = getAttrValue(company, 'notes');

      // Funding info
      const lastFundingStatus = getAttrValue(company, 'last_funding_status_46');
      const estimatedArr = getAttrValue(company, 'estimated_arr_usd');
      const employeeRange = getAttrValue(company, 'employee_range');

      // Domains (for linking to deals)
      const domain = company?.values?.domains?.[0]?.domain || null;

      return {
        id: recordId,
        name,
        status,
        funnelStage,
        hasOwner,
        ownerIds,
        country,
        countryCode,
        region,
        growthScore: growthScore ? parseFloat(growthScore) : null,
        source,
        createdAt,
        contactYear,
        meetingYear,
        logoUrl,
        industry,
        feeling,
        description: getAttrValue(company, 'description'),
        // Interaction data
        firstEmailInteraction,
        lastEmailInteraction,
        firstCalendarInteraction,
        lastCalendarInteraction,
        firstInteraction,
        lastInteraction,
        connectionStrength,
        introPathCount,
        notes,
        // Business data
        lastFundingStatus,
        estimatedArr,
        employeeRange,
        domain,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        const rawCompanies = await fetchOwnedCompanies();
        if (cancelled) return;

        const processed = processCompanies(rawCompanies);

        if (!cancelled && processed.length > 0) {
          setCompanies(processed);
          setIsLive(true);
          setError(null);
          setCachedCompanies(processed);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch companies:', err.message);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [processCompanies]);

  return { companies, loading, error, isLive };
}

export default useAttioCompanies;
