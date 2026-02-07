import { useState, useEffect, useCallback } from 'react';
import {
  fetchAllDeals, fetchCompaniesByIds, fetchListEntries,
  getAttrValue, getAttrValues, getEntryValue, getLocationCountryCode,
  getCachedCoverage, setCachedCoverage,
} from '../services/attioApi';

// Country code to region mapping
const countryToRegion = {
  'FR': 'France', 'DE': 'Germany', 'NL': 'Netherlands', 'BE': 'Belgium',
  'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
  'ES': 'Spain', 'IT': 'Italy', 'PT': 'Portugal', 'PL': 'Poland',
  'CZ': 'Czech Republic', 'AT': 'Austria', 'CH': 'Switzerland',
  'IE': 'Ireland', 'GB': 'UK', 'UK': 'UK',
};

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

// Deterministic hash for date redistribution
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Spread bulk-import clustered dates across 2022-2025 (48 months)
function redistributeBulkDates(items) {
  const dateCounts = {};
  for (const d of items) {
    if (d.announcedDate) {
      dateCounts[d.announcedDate] = (dateCounts[d.announcedDate] || 0) + 1;
    }
  }

  const CLUSTER_THRESHOLD = 10;
  const bulkDates = new Set(
    Object.entries(dateCounts)
      .filter(([, count]) => count >= CLUSTER_THRESHOLD)
      .map(([date]) => date)
  );

  if (bulkDates.size === 0) return items;

  return items.map(d => {
    if (!d.announcedDate || !bulkDates.has(d.announcedDate)) return d;

    // Spread across Jan 2022 – Dec 2025 (48 months)
    const hash = simpleHash(d.id);
    const monthOffset = hash % 48;
    const year = 2022 + Math.floor(monthOffset / 12);
    const month = (monthOffset % 12) + 1;
    const day = (hash % 28) + 1;
    const syntheticDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      ...d,
      announcedDate: syntheticDate,
      date: dateToQuarter(syntheticDate),
    };
  });
}

/**
 * useAttioCoverage — deal-based sourcing universe.
 *
 * Primary: all deals from deals_2 + coverage list entries from deal_coverage_6
 * Enriched with: linked companies (fetched by ID)
 *
 * Output shape matches useAttioDeals for UI compatibility.
 */
export function useAttioCoverage() {
  const cached = getCachedCoverage();
  const [companies, setCompanies] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  const processData = useCallback((rawDeals, companiesMap, listEntries) => {
    // Build coverage map: deal record ID → list entry
    const coverageMap = {};
    for (const entry of listEntries) {
      const dealId = entry.parent_record_id;
      if (dealId) coverageMap[dealId] = entry;
    }

    const result = rawDeals.map(deal => {
      const dealRecordId = deal.id?.record_id;
      const dealName = getAttrValue(deal, 'deal_id');
      const dealStatus = getAttrValue(deal, 'status');
      const announcedDate = getAttrValue(deal, 'announced_date');
      const receivedDate = getAttrValue(deal, 'received_date');
      const createdAt = getAttrValue(deal, 'created_at');
      const bestDate = announcedDate || receivedDate || (createdAt ? createdAt.slice(0, 10) : null);

      // Get linked company
      const companyRecordId = deal.values?.associated_company_domain?.[0]?.target_record_id;
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

      // Company status
      const companyStatus = company ? getAttrValue(company, 'status_4') : null;

      // Coverage list entry
      const coverage = coverageMap[dealRecordId];
      const coverageEntryId = coverage?.entry_id || null;
      const coverageInScope = coverage ? !!getEntryValue(coverage, 'in_scope') : false;

      // Interaction data from company
      const firstEmailInteraction = company ? getAttrValue(company, 'first_email_interaction') : null;
      const firstCalendarInteraction = company ? getAttrValue(company, 'first_calendar_interaction') : null;
      const hasEmailInteraction = !!firstEmailInteraction;
      const hasCalendarInteraction = !!firstCalendarInteraction;

      // Derive "seen" from multiple signals
      const statusSeen = dealStatus === 'deal flow' ||
        dealStatus === 'Announced deals we saw' ||
        dealStatus === 'deal rumors';

      const companyProgressed = companyStatus && [
        'Contacted / to meet', 'Met', 'To nurture', 'Dealflow',
        'Due Dilligence', 'Due Diligence', 'IC', 'Portfolio',
        'Passed', 'Analysed but too early', 'To Decline'
      ].includes(companyStatus);

      const seen = statusSeen || companyProgressed || hasEmailInteraction || hasCalendarInteraction || !!receivedDate;

      // In scope from coverage list — defaults to false if not in list
      const inScope = coverage ? coverageInScope : false;

      // Amount — coverage list stores in M€ already
      const coverageAmount = coverage ? getEntryValue(coverage, 'amount_raised_in_meu') : null;
      const amount = coverageAmount != null
        ? Math.round(coverageAmount)
        : (company ? formatAmount(getAttrValue(company, 'last_funding_amount')) : null);
      const dealScore = coverage ? getEntryValue(coverage, 'deal_score') : null;

      // Outcome
      let outcome = 'Missed';
      if (seen) {
        if (companyStatus === 'Passed' || companyStatus === 'To Decline' || companyStatus === 'Analysed but too early' || companyStatus === 'No US path for now') outcome = 'Passed';
        else if (companyStatus === 'Due Dilligence' || companyStatus === 'Due Diligence') outcome = 'DD';
        else if (companyStatus === 'IC') outcome = 'IC';
        else if (companyStatus === 'Portfolio') outcome = 'Invested';
        else if (dealStatus === 'deal flow') outcome = 'In Pipeline';
        else if (dealStatus === 'Announced deals we saw') outcome = 'Saw';
        else outcome = 'Tracked';
      }

      // Industry
      const dealIndustry = getAttrValues(deal, 'industry');
      const categories = dealIndustry.length > 0 ? dealIndustry : (company ? getAttrValues(company, 'categories') : []);

      // Feeling / rating
      const feeling = company ? getAttrValue(company, 'feeling') : null;

      // Owner from deal
      const ownerAttr = deal.values?.owner;
      const ownerIds = ownerAttr ? ownerAttr.map(o => o.referenced_actor_id).filter(Boolean) : [];

      // Extra fields
      const reasonsToDecline = company ? getAttrValue(company, 'reasons_to_decline') : null;
      const dealComment = getAttrValue(deal, 'comment');
      const fundingRaisedUsd = company ? getAttrValue(company, 'funding_raised_usd') : null;
      const lastFundingStatus = company ? getAttrValue(company, 'last_funding_status_46') : null;
      const lastFundingDate = company ? getAttrValue(company, 'last_funding_date') : null;
      const companyDescription = company ? getAttrValue(company, 'description') : null;

      return {
        id: dealRecordId,
        coverageEntryId,
        coverageInScope,
        dealName: dealName || companyName,
        company: companyName,
        country,
        filterRegion,
        countryCode,
        stage,
        amount,
        date: dateToQuarter(bestDate),
        announcedDate: bestDate,
        inScope,
        seen,
        hasEmailInteraction,
        hasCalendarInteraction,
        status: companyStatus || dealStatus,
        industry: categories,
        rating: feeling ? feeling * 2 : null,
        dealScore,
        outcome,
        ownerIds,
        receivedDate,
        logoUrl: company ? getAttrValue(company, 'logo_url') : null,
        description: companyDescription,
        linkedinUrl: company ? getAttrValue(company, 'linkedin') : null,
        totalFunding: company ? getAttrValue(company, 'total_funding_amount') : null,
        employeeRange: company ? getAttrValue(company, 'employee_range') : null,
        reasonsToDecline,
        dealComment,
        fundingRaisedUsd,
        lastFundingStatus,
        lastFundingDate,
      };
    }).filter(Boolean);

    return redistributeBulkDates(result);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        // Fetch deals and coverage list entries in parallel
        const [rawDeals, listEntries] = await Promise.all([
          fetchAllDeals(),
          fetchListEntries(),
        ]);
        if (cancelled) return;

        // Extract unique company IDs from deals
        const companyIds = [...new Set(
          rawDeals
            .map(d => d.values?.associated_company_domain?.[0]?.target_record_id)
            .filter(Boolean)
        )];

        // Fetch linked companies
        const rawCompanies = await fetchCompaniesByIds(companyIds);
        if (cancelled) return;

        // Build companies lookup
        const companiesMap = {};
        for (const c of rawCompanies) {
          companiesMap[c.id?.record_id] = c;
        }

        const processed = processData(rawDeals, companiesMap, listEntries);

        if (!cancelled && processed.length > 0) {
          setCompanies(processed);
          setIsLive(true);
          setError(null);
          setCachedCoverage(processed);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch coverage data:', err.message);
          setError(err.message);
          if (!cached) setIsLive(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [processData]);

  // Return as "deals" for backward-compat with Sourcing.jsx
  return { deals: companies, loading, error, isLive };
}

export default useAttioCoverage;
