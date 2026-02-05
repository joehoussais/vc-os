import { useState, useEffect, useCallback } from 'react';

// Country code to region mapping
const countryToRegion = {
  'FR': 'France',
  'DE': 'Germany',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'ES': 'Spain',
  'IT': 'Italy',
  'PT': 'Portugal',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'AT': 'Austria',
  'CH': 'Switzerland',
  'IE': 'Ireland',
  'GB': 'UK',
  'UK': 'UK',
};

// Map country codes to broader regions for filtering
const countryToFilterRegion = {
  'FR': 'France',
  'DE': 'Germany',
  'NL': 'Germany', // Benelux grouped with Germany
  'BE': 'Germany',
  'LU': 'Germany',
  'SE': 'Nordics',
  'NO': 'Nordics',
  'DK': 'Nordics',
  'FI': 'Nordics',
  'IS': 'Nordics',
  'ES': 'Southern Europe',
  'IT': 'Southern Europe',
  'PT': 'Southern Europe',
  'GR': 'Southern Europe',
  'PL': 'Eastern Europe',
  'CZ': 'Eastern Europe',
  'HU': 'Eastern Europe',
  'RO': 'Eastern Europe',
  'BG': 'Eastern Europe',
  'SK': 'Eastern Europe',
  'SI': 'Eastern Europe',
  'HR': 'Eastern Europe',
  'RS': 'Eastern Europe',
  'UA': 'Eastern Europe',
  'EE': 'Eastern Europe',
  'LV': 'Eastern Europe',
  'LT': 'Eastern Europe',
};

// Map funding status to stage
const fundingStatusToStage = {
  'pre_seed': 'Pre-Seed',
  'seed': 'Seed',
  'series_a': 'Series A',
  'series_b': 'Series B',
  'series_c': 'Series C',
  'series_d': 'Series D',
  'series_e': 'Series E',
  'series_f': 'Series F',
  'series_unknown': 'Unknown',
  'venture_round': 'Venture',
  'corporate_round': 'Corporate',
  'private_equity': 'PE',
  'angel': 'Angel',
};

// Parse stage from deal_id (e.g., "Series A - Thorizon" -> "Series A")
function parseStageFromDealId(dealId) {
  if (!dealId) return null;
  const match = dealId.match(/^(Series [A-Z]|Seed|Pre-Seed|Venture|Grant|Private Equity|Corporate)/i);
  if (match) {
    const stage = match[1];
    if (stage.toLowerCase().includes('series')) {
      return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase().replace('series ', 'Series ');
    }
    return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase();
  }
  return null;
}

// Format currency amount
function formatAmount(amount) {
  if (!amount) return null;
  // Parse amount like "€15,362,722.00" or "US$1,400,000.00"
  const numMatch = amount.match(/[\d,]+/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[0].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return Math.round(num / 1000000); // Return in millions
}

// Format date to quarter
function dateToQuarter(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}

// Determine if deal was "seen" based on status
function wasDealSeen(status) {
  return status === 'Announced deals we saw' || status === 'deal flow';
}

// Determine if deal is "in scope" - for now, all deals are considered in scope
// This could be refined based on industry, region, etc.
function isDealInScope(deal, company) {
  // Basic scope: has a company linked and has announced date
  return !!company && !!deal.announced_date;
}

export function useAttioDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // This will be populated by the MCP tools - for now we'll expose a method to set deals
  // In a real integration, this would call the Attio API directly

  const processDeals = useCallback((rawDeals, companiesMap) => {
    return rawDeals.map(deal => {
      const dealAttrs = deal.attributes;
      const companyRef = dealAttrs.associated_company_domain;
      const company = companyRef ? companiesMap[companyRef.entity_instance_id] : null;
      const companyAttrs = company?.attributes || {};

      // Get country from company
      const countryCode = companyAttrs.primary_location?.country_code ||
                         companyAttrs.cross_checked_hq_country?.slice(0, 2)?.toUpperCase();
      const country = countryToRegion[countryCode] || companyAttrs.team_country || 'Unknown';
      const filterRegion = countryToFilterRegion[countryCode] || 'Other';

      // Get stage from deal_id or company's last funding status
      const stageFromDealId = parseStageFromDealId(dealAttrs.deal_id);
      const stageFromCompany = fundingStatusToStage[companyAttrs.last_funding_status_46];
      const stage = stageFromDealId || stageFromCompany || 'Unknown';

      // Get amount
      const amount = formatAmount(companyAttrs.last_funding_amount);

      // Get date
      const announcedDate = dealAttrs.announced_date;
      const quarter = dateToQuarter(announcedDate);

      // Determine seen/in-scope status
      const seen = wasDealSeen(dealAttrs.status);
      const inScope = isDealInScope(dealAttrs, company);

      return {
        id: deal.entity_instance_id,
        company: companyAttrs.name || dealAttrs.deal_id?.split(' - ').pop() || 'Unknown',
        companyId: companyRef?.entity_instance_id,
        country,
        filterRegion,
        countryCode,
        stage,
        amount,
        date: quarter,
        announcedDate,
        inScope,
        seen,
        status: dealAttrs.status,
        industry: dealAttrs.industry || companyAttrs.categories || [],
        source: companyAttrs.strongest_connection_strength ? 'Network' : 'Proactive',
        rating: companyAttrs.feeling ? companyAttrs.feeling * 2 : null, // Convert 1-5 to 2-10
        outcome: seen ? (companyAttrs.status_4 === 'Passed' ? 'Passed' :
                        companyAttrs.status_4 === 'Due Dilligence' ? 'DD' :
                        companyAttrs.status_4 === 'IC' ? 'IC' :
                        companyAttrs.status_4 === 'Portfolio' ? 'Invested' : '—') : 'Missed',
        logoUrl: companyAttrs.logo_url || companyAttrs.logo_url_7,
        description: companyAttrs.description,
        linkedinUrl: companyAttrs.linkedin,
        totalFunding: companyAttrs.total_funding_amount,
        employeeRange: companyAttrs.employee_range,
      };
    }).filter(deal => deal.announcedDate); // Only include deals with announced dates
  }, []);

  return {
    deals,
    setDeals,
    loading,
    setLoading,
    error,
    setError,
    processDeals,
  };
}

export default useAttioDeals;
