import { useState, useEffect } from 'react';
import { extractCompanyFields, fetchPortfolioCompanies, getCachedPortfolio, setCachedPortfolio, useSyncTrigger } from '../services/attioApi';
import { BOARD_MEMBERS } from '../data/team';

// Re-export for backward compatibility
export { BOARD_MEMBERS };

// Map company name (normalized) → board members
// Names must match Attio company names or known aliases
const BOARD_MAP = {
  'okeiro': [{ name: 'Joseph', role: 'board' }, { name: 'Luc-Emmanuel', role: 'board' }],
  'veesion': [{ name: 'Joseph', role: 'board' }, { name: 'Luc-Emmanuel', role: 'board' }],
  'resilience': [{ name: 'Olivier', role: 'board' }],
  'robovision': [{ name: 'Olivier', role: 'board' }],
  'deepopinion': [{ name: 'Olivier', role: 'board' }],
  'otera': [{ name: 'Olivier', role: 'board' }],
  'iobeya': [{ name: 'Antoine', role: 'board' }],
  'le collectionist': [{ name: 'Antoine', role: 'board' }],
  'worldia': [{ name: 'Antoine', role: 'board' }],
  'wemaintain': [{ name: 'Antoine', role: 'board' }],
  'hypr space': [{ name: 'Luc-Emmanuel', role: 'board' }],
  'hypr space (hybrid propulsion for space)': [{ name: 'Luc-Emmanuel', role: 'board' }],
  'allo-media': [{ name: 'Luc-Emmanuel', role: 'board' }],
  'allo media': [{ name: 'Luc-Emmanuel', role: 'board' }],
  'the exploration company': [{ name: 'Alfred', role: 'board' }],
  'tec': [{ name: 'Alfred', role: 'board' }],
  'speach': [{ name: 'Joseph', role: 'board' }, { name: 'Alfred', role: 'board' }],
};

// Format currency value for display
export function formatFunding(value) {
  if (!value) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value; // already formatted string
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function getBoardMembers(companyName) {
  if (!companyName) return [];
  const key = companyName.toLowerCase().trim();
  return BOARD_MAP[key] || [];
}

// Additional portfolio companies not in status_4=Portfolio
const EXTRA_PORTFOLIO_NAMES = ['Veesion', 'Okeiro', 'Speach'];

export function useAttioPortfolio() {
  const syncVersion = useSyncTrigger();
  const cached = getCachedPortfolio();
  const [companies, setCompanies] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [isLive, setIsLive] = useState(!!cached);

  useEffect(() => {
    let cancelled = false;

    async function load(isBackground) {
      if (!isBackground) setLoading(true);
      try {
        const allRecords = await fetchPortfolioCompanies(EXTRA_PORTFOLIO_NAMES);
        if (cancelled) return;

        // Transform records
        const transformed = allRecords.map(record => {
          const base = extractCompanyFields(record);
          if (!base) return null;

          const v = record.values || {};

          const description = v.description?.[0]?.value || null;
          const lastFundingAmount = v.last_funding_amount?.[0]?.value || null;
          const totalFundingRaw = v.total_funding_amount?.[0]?.value
            || v.total_funding_amount?.[0]?.currency_value || null;
          const totalFunding = formatFunding(totalFundingRaw);
          const lastFundingStatus = v.last_funding_status_46?.[0]?.option?.title
            || v.last_funding_status_46?.[0]?.status?.title || null;
          const employeeRange = v.employee_range?.[0]?.value
            || v.employee_range?.[0]?.option?.title || null;
          const foundationDate = v.foundation_date?.[0]?.value || null;
          const categories = (v.categories || []).map(c => c.value || c.option?.title).filter(Boolean);
          const tags = (v.tags || []).map(t => t.value || t.option?.title).filter(Boolean);

          let logoUrl = v.logo_url?.[0]?.value || null;
          if (!logoUrl && base.domain) {
            logoUrl = `https://logo.clearbit.com/${base.domain}`;
          }

          return {
            ...base,
            logoUrl,
            description,
            lastFundingAmount,
            totalFunding,
            totalFundingRaw: totalFundingRaw ? parseFloat(totalFundingRaw) : null,
            lastFundingStatus,
            employeeRange,
            foundationDate,
            categories,
            tags,
            boardMembers: getBoardMembers(base.name),
          };
        }).filter(Boolean);

        if (!cancelled) {
          setCompanies(transformed);
          setIsLive(true);
          setCachedPortfolio(transformed);
        }
      } catch (err) {
        console.error('Failed to fetch portfolio from Attio:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (cached) {
      // Still refresh in background
      load(true);
    } else {
      load(false);
    }

    return () => { cancelled = true; };
  }, [syncVersion]);

  return { companies, loading, isLive };
}
