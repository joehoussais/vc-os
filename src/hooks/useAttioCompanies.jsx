import { useState, useEffect, useCallback } from 'react';
import { fetchAllCompanies, getAttrValue, getAttrValues, getLocationCountryCode } from '../services/attioApi';

const CACHE_KEY = 'attio-companies-cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Funnel stages derived from company status_4
// Universe = all startups (no owner)
// Qualified = has owner assigned
// Then status_4 maps to stages:
const STATUS_TO_FUNNEL = {
  'Qualification': 'sourcing',       // pre-contact — part of universe/qualified
  'To contact': 'sourcing',          // pre-contact — part of universe/qualified
  'Ghosting (Help)': 'contacted',    // attempted contact
  'Contacted / to meet': 'contacted',
  'Met': 'met',
  'To nurture': 'met',               // met but nurturing
  'Dealflow': 'dealflow',
  'Due Dilligence': 'analysis',      // note: typo in Attio data
  'Due Diligence': 'analysis',
  'To Decline': 'passed',
  'Passed': 'passed',
  'IC': 'committee',
  'Portfolio': 'portfolio',
  'Analysed but too early': 'passed',
  'No US path for now': 'passed',
  'Old/ Out of scope': 'passed',
};

// The funnel stage order for display
export const FUNNEL_STAGES = [
  { id: 'universe', name: 'Sourcing Universe', description: 'All startups in the database' },
  { id: 'qualified', name: 'Qualified', description: 'Owner assigned — actively being worked' },
  { id: 'contacted', name: 'Contact Established', description: 'Contact established through one of our channels', split: true },
  { id: 'met', name: 'First Meeting', description: 'First meeting held' },
  { id: 'dealflow', name: 'Deal Flow', description: 'Active fundraising round — deck received' },
  { id: 'analysis', name: 'In-Depth Analysis', description: 'Deep-dive due diligence underway' },
  { id: 'committee', name: 'Committee (IC)', description: 'Presented to Investment Committee' },
  { id: 'portfolio', name: 'Portfolio', description: 'Investment made' },
];

// Source channels for the contact-initiated split
export const SOURCE_CHANNELS = [
  { id: 'cold_email', name: 'Cold Email', color: '#3B82F6' },
  { id: 'vc_intro', name: 'VC Intro', color: '#8B5CF6' },
  { id: 'banker', name: 'Banker', color: '#F59E0B' },
  { id: 'other_intro', name: 'Other Intro', color: '#10B981' },
  { id: 'cold_outreach', name: 'Cold Outreach', color: '#6366F1' },
  { id: 'unknown', name: 'Unknown', color: '#9CA3AF' },
];

// Map Attio source field values to our channel IDs
const SOURCE_VALUE_MAP = {
  'Cold Email': 'cold_email',
  'cold_email': 'cold_email',
  'VC Introduction': 'vc_intro',
  'VC Intro': 'vc_intro',
  'vc_intro': 'vc_intro',
  'Banker': 'banker',
  'banker': 'banker',
  'Other Introduction': 'other_intro',
  'Other Intro': 'other_intro',
  'other_intro': 'other_intro',
  'Cold Outreach': 'cold_outreach',
  'cold_outreach': 'cold_outreach',
};

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

      // Determine funnel stage
      const statusFunnel = STATUS_TO_FUNNEL[status] || 'sourcing';
      let funnelStage;
      if (statusFunnel === 'sourcing') {
        funnelStage = hasOwner ? 'qualified' : 'universe';
      } else {
        funnelStage = statusFunnel;
      }

      // Created date for time-based filtering
      const createdAt = getAttrValue(company, 'created_at');

      // Logo
      const logoUrl = getAttrValue(company, 'logo_url') || getAttrValue(company, 'logo_url_7');

      // Industry
      const industry = getAttrValues(company, 'industry');

      // Feeling
      const feeling = getAttrValue(company, 'feeling');

      // Source channel (will be populated once the 'source' field is created in Attio)
      const rawSource = getAttrValue(company, 'source');
      const source = rawSource ? (SOURCE_VALUE_MAP[rawSource] || 'unknown') : 'unknown';

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
        logoUrl,
        industry,
        feeling,
        description: getAttrValue(company, 'description'),
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        const rawCompanies = await fetchAllCompanies();
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
