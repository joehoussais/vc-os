import { useState, useEffect, useCallback } from 'react';
import {
  fetchOwnedCompanies, fetchAllDeals, fetchListEntries,
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
 * useAttioCoverage — company-first sourcing universe.
 *
 * Primary: all companies with owner set (~2000+)
 * Enriched with: deals (deal names, announced dates, status) + coverage list entries (in_scope)
 *
 * Output shape matches useAttioDeals for UI compatibility.
 */
export function useAttioCoverage() {
  const cached = getCachedCoverage();
  const [companies, setCompanies] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  const processData = useCallback((rawCompanies, rawDeals, listEntries) => {
    // Build deal → company map (company record ID → best deal)
    const dealsByCompanyId = {};
    for (const deal of rawDeals) {
      const companyRecordId = deal.values?.associated_company_domain?.[0]?.target_record_id;
      if (!companyRecordId) continue;
      // Keep the deal with the most recent announced_date
      const existing = dealsByCompanyId[companyRecordId];
      if (!existing) {
        dealsByCompanyId[companyRecordId] = deal;
      } else {
        const existingDate = getAttrValue(existing, 'announced_date') || '';
        const newDate = getAttrValue(deal, 'announced_date') || '';
        if (newDate > existingDate) dealsByCompanyId[companyRecordId] = deal;
      }
    }

    // Build coverage map: deal record ID → list entry
    const coverageMap = {};
    for (const entry of listEntries) {
      const dealId = entry.parent_record_id;
      if (dealId) coverageMap[dealId] = entry;
    }

    const result = rawCompanies.map(company => {
      const companyRecordId = company.id?.record_id;
      const companyName = getAttrValue(company, 'name') || 'Unknown';

      // Linked deal (if any)
      const deal = dealsByCompanyId[companyRecordId];
      const dealRecordId = deal?.id?.record_id;
      const dealName = deal ? getAttrValue(deal, 'deal_id') : null;
      const dealStatus = deal ? getAttrValue(deal, 'status') : null;

      // Best date: deal announced_date > deal received_date > company created_at
      const announcedDate = deal ? getAttrValue(deal, 'announced_date') : null;
      const receivedDate = deal ? getAttrValue(deal, 'received_date') : null;
      const createdAt = getAttrValue(company, 'created_at');
      const bestDate = announcedDate || receivedDate || (createdAt ? createdAt.slice(0, 10) : null);

      // Country
      const countryCode = getLocationCountryCode(company, 'primary_location') ||
        getAttrValue(company, 'cross_checked_hq_country')?.slice(0, 2)?.toUpperCase();
      const country = countryToRegion[countryCode] || getAttrValue(company, 'team_country') || 'Unknown';
      const filterRegion = countryToFilterRegion[countryCode] || 'Other';

      // Stage
      const stageFromDeal = parseStageFromDealId(dealName);
      const stageFromCompany = fundingStatusToStage[getAttrValue(company, 'last_funding_status_46')] || null;
      const stage = stageFromDeal || stageFromCompany || 'Unknown';

      // Company status
      const companyStatus = getAttrValue(company, 'status_4');

      // Coverage list entry (linked through deal, if exists)
      const coverage = dealRecordId ? coverageMap[dealRecordId] : null;
      const coverageEntryId = coverage?.entry_id || null;
      const coverageInScope = coverage ? !!getEntryValue(coverage, 'in_scope') : false;

      // Interaction data from company
      const firstEmailInteraction = getAttrValue(company, 'first_email_interaction');
      const firstCalendarInteraction = getAttrValue(company, 'first_calendar_interaction');
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

      // In scope — defaults to true if no coverage entry
      const inScope = coverage ? coverageInScope : true;

      // Amount
      const coverageAmount = coverage ? getEntryValue(coverage, 'amount_raised_in_meu') : null;
      const amount = coverageAmount != null
        ? Math.round(coverageAmount)
        : formatAmount(getAttrValue(company, 'last_funding_amount'));
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
      const dealIndustry = deal ? getAttrValues(deal, 'industry') : [];
      const categories = dealIndustry.length > 0 ? dealIndustry : getAttrValues(company, 'categories');

      // Feeling / rating
      const feeling = getAttrValue(company, 'feeling');

      // Owner (actor-reference multiselect)
      const ownerAttr = company?.values?.owner;
      const ownerIds = ownerAttr ? ownerAttr.map(o => o.referenced_actor_id).filter(Boolean) : [];

      // Extra fields
      const reasonsToDecline = getAttrValue(company, 'reasons_to_decline');
      const dealComment = deal ? getAttrValue(deal, 'comment') : null;
      const fundingRaisedUsd = getAttrValue(company, 'funding_raised_usd');
      const lastFundingStatus = getAttrValue(company, 'last_funding_status_46');
      const lastFundingDate = getAttrValue(company, 'last_funding_date');
      const companyDescription = getAttrValue(company, 'description');

      return {
        id: companyRecordId,
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
        logoUrl: getAttrValue(company, 'logo_url'),
        description: companyDescription,
        linkedinUrl: getAttrValue(company, 'linkedin'),
        totalFunding: getAttrValue(company, 'total_funding_amount'),
        employeeRange: getAttrValue(company, 'employee_range'),
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

        // Fetch all three data sources in parallel
        const [rawCompanies, rawDeals, listEntries] = await Promise.all([
          fetchOwnedCompanies(),
          fetchAllDeals(),
          fetchListEntries(),
        ]);
        if (cancelled) return;

        const processed = processData(rawCompanies, rawDeals, listEntries);

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
