import { useState, useEffect, useCallback } from 'react';
import { fetchAllDeals, fetchCompaniesByIds, getAttrValue, getAttrValues, getLocationCountryCode, getCachedDeals, setCachedDeals } from '../services/attioApi';
import { attioDeals as staticDeals } from '../data/attioData';

// Country code to region mapping
const countryToRegion = {
  'FR': 'France', 'DE': 'Germany', 'NL': 'Netherlands', 'BE': 'Belgium',
  'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
  'ES': 'Spain', 'IT': 'Italy', 'PT': 'Portugal', 'PL': 'Poland',
  'CZ': 'Czech Republic', 'AT': 'Austria', 'CH': 'Switzerland',
  'IE': 'Ireland', 'GB': 'UK', 'UK': 'UK',
};

// Map country codes to broader regions for filtering
const countryToFilterRegion = {
  'FR': 'France',
  'DE': 'Germany', 'NL': 'Germany', 'BE': 'Germany', 'LU': 'Germany',
  'SE': 'Nordics', 'NO': 'Nordics', 'DK': 'Nordics', 'FI': 'Nordics', 'IS': 'Nordics',
  'ES': 'Southern Europe', 'IT': 'Southern Europe', 'PT': 'Southern Europe', 'GR': 'Southern Europe',
  'PL': 'Eastern Europe', 'CZ': 'Eastern Europe', 'HU': 'Eastern Europe',
  'RO': 'Eastern Europe', 'BG': 'Eastern Europe', 'SK': 'Eastern Europe',
  'SI': 'Eastern Europe', 'HR': 'Eastern Europe', 'RS': 'Eastern Europe',
  'UA': 'Eastern Europe', 'EE': 'Eastern Europe', 'LV': 'Eastern Europe', 'LT': 'Eastern Europe',
};

const fundingStatusToStage = {
  'pre_seed': 'Pre-Seed', 'seed': 'Seed',
  'series_a': 'Series A', 'series_b': 'Series B', 'series_c': 'Series C',
  'series_d': 'Series D', 'series_e': 'Series E', 'series_f': 'Series F',
  'series_unknown': 'Unknown', 'venture_round': 'Venture',
  'corporate_round': 'Corporate', 'private_equity': 'PE', 'angel': 'Angel',
};

function parseStageFromDealId(dealId) {
  if (!dealId) return null;
  const match = dealId.match(/^(Series [A-Z]|Seed|Pre-Seed|Venture|Grant|Private Equity|Corporate)/i);
  if (!match) return null;
  const stage = match[1];
  if (stage.toLowerCase().includes('series')) {
    return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase().replace('series ', 'Series ');
  }
  return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase();
}

function formatAmount(amount) {
  if (!amount) return null;
  if (typeof amount === 'number') return Math.round(amount / 1000000);
  const numMatch = String(amount).match(/[\d,]+/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[0].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return Math.round(num / 1000000);
}

function dateToQuarter(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}

function wasDealSeen(status) {
  if (!status) return false;
  return status === 'Announced deals we saw' || status === 'deal flow' || status === 'deal rumors';
}

export function useAttioDeals() {
  // Load from session cache immediately for instant page refreshes
  const cached = getCachedDeals();
  const [deals, setDeals] = useState(cached || staticDeals);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  const processRawDeals = useCallback((rawDeals, companiesMap) => {
    return rawDeals.map(deal => {
      const dealName = getAttrValue(deal, 'deal_id');       // "Series A - Thorizon"
      const status = getAttrValue(deal, 'status');           // "Announced deals we saw" (from status.title)
      const announcedDate = getAttrValue(deal, 'announced_date'); // "2025-03-12"

      // Get linked company via record-reference
      const companyRecordId = getAttrValue(deal, 'associated_company_domain'); // target_record_id UUID
      const company = companyRecordId ? companiesMap[companyRecordId] : null;

      // Company fields
      const companyName = company ? getAttrValue(company, 'name') : (dealName?.split(' - ').pop() || 'Unknown');
      const countryCode = company
        ? (getLocationCountryCode(company, 'primary_location') ||
           getAttrValue(company, 'cross_checked_hq_country')?.slice(0, 2)?.toUpperCase())
        : null;
      const country = countryToRegion[countryCode] || (company ? getAttrValue(company, 'team_country') : null) || 'Unknown';
      const filterRegion = countryToFilterRegion[countryCode] || 'Other';

      // Stage
      const stageFromDeal = parseStageFromDealId(dealName);
      const stageFromCompany = company ? fundingStatusToStage[getAttrValue(company, 'last_funding_status_46')] : null;
      const stage = stageFromDeal || stageFromCompany || 'Unknown';

      // Amount
      const amount = company ? formatAmount(getAttrValue(company, 'last_funding_amount')) : null;

      // Seen / In Scope
      const seen = wasDealSeen(status);
      const inScope = !!company && !!announcedDate;

      // Outcome
      const companyStatus = company ? getAttrValue(company, 'status_4') : null;
      let outcome = 'Missed';
      if (seen) {
        if (companyStatus === 'Passed') outcome = 'Passed';
        else if (companyStatus === 'Due Dilligence' || companyStatus === 'Due Diligence') outcome = 'DD';
        else if (companyStatus === 'IC') outcome = 'IC';
        else if (companyStatus === 'Portfolio') outcome = 'Invested';
        else outcome = '—';
      }

      // Industry / categories (multi-select)
      const categories = company ? getAttrValues(company, 'categories') : [];

      // Feeling / rating
      const feeling = company ? getAttrValue(company, 'feeling') : null;

      return {
        id: deal.id?.record_id,
        dealName: dealName || 'Unknown Deal',  // Full series name e.g. "Series A - Thorizon"
        company: companyName,
        country,
        filterRegion,
        countryCode,
        stage,
        amount,
        date: dateToQuarter(announcedDate),
        announcedDate,
        inScope,
        seen,
        status,
        industry: categories,
        rating: feeling ? feeling * 2 : null,
        outcome,
        logoUrl: company ? getAttrValue(company, 'logo_url') : null,
        description: company ? getAttrValue(company, 'description') : null,
        linkedinUrl: company ? getAttrValue(company, 'linkedin') : null,
        totalFunding: company ? getAttrValue(company, 'total_funding_amount') : null,
        employeeRange: company ? getAttrValue(company, 'employee_range') : null,
      };
    }).filter(deal => deal.announcedDate);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFromApi() {
      try {
        // If we have cache, don't show loading — data is already on screen
        if (!cached) setLoading(true);

        const rawDeals = await fetchAllDeals();
        if (cancelled) return;

        // Extract unique company IDs from deals
        const companyIds = [...new Set(
          rawDeals
            .map(d => d.values?.associated_company_domain?.[0]?.target_record_id)
            .filter(Boolean)
        )];

        const rawCompanies = await fetchCompaniesByIds(companyIds);
        if (cancelled) return;

        // Build companies lookup by record_id
        const companiesMap = {};
        for (const c of rawCompanies) {
          companiesMap[c.id?.record_id] = c;
        }

        const processed = processRawDeals(rawDeals, companiesMap);

        if (!cancelled && processed.length > 0) {
          setDeals(processed);
          setIsLive(true);
          setError(null);
          setCachedDeals(processed); // Cache for instant reloads
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch live Attio data, using fallback:', err.message);
          setError(err.message);
          if (!cached) setIsLive(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFromApi();
    return () => { cancelled = true; };
  }, [processRawDeals]);

  return { deals, loading, error, isLive };
}

export default useAttioDeals;
