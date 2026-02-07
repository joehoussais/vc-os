import { useState, useEffect } from 'react';
import { extractCompanyFields } from '../services/attioApi';

const CACHE_KEY = 'attio-portfolio-cache-v1';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const API_PATH = '/api/attio';

async function attioQuery(endpoint, payload = {}) {
  const res = await fetch(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, payload, method: 'POST' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Attio API error: ${res.status}`);
  }
  return res.json();
}

// Board member mapping — manually maintained
// Each portfolio company maps to its board representatives from the RRW team
export const BOARD_MEMBERS = [
  { name: 'Joseph', color: '#E63424' },
  { name: 'Luc-Emmanuel', color: '#6366F1' },
  { name: 'Olivier', color: '#059669' },
  { name: 'Antoine', color: '#D97706' },
  { name: 'Alfred', color: '#8B5CF6' },
];

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
// These will be fetched by name search
const EXTRA_PORTFOLIO_NAMES = ['Veesion', 'Okeiro', 'Speach'];

export function useAttioPortfolio() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Try cache first
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setCompanies(data);
          setLoading(false);
          setIsLive(true);
          // Still refresh in background
          fetchPortfolio(true);
          return;
        }
      } catch (e) { /* ignore */ }
    }

    fetchPortfolio(false);
  }, []);

  async function fetchPortfolio(isBackground) {
    if (!isBackground) setLoading(true);
    try {
      // Step 1: Fetch all companies with status_4 = Portfolio
      const portfolioData = await attioQuery('/objects/companies/records/query', {
        filter: { status_4: { $eq: 'Portfolio' } },
        limit: 50,
      });

      let allRecords = portfolioData.data || [];

      // Step 2: Search for extra portfolio companies by name
      for (const name of EXTRA_PORTFOLIO_NAMES) {
        try {
          const searchData = await attioQuery('/objects/companies/records/query', {
            filter: {
              name: { $contains: name },
            },
            limit: 5,
          });
          const results = searchData.data || [];
          // Find exact or closest match
          const match = results.find(r => {
            const n = r.values?.name?.[0]?.value?.toLowerCase() || '';
            return n === name.toLowerCase() || n.startsWith(name.toLowerCase());
          });
          if (match && !allRecords.find(r => r.id?.record_id === match.id?.record_id)) {
            allRecords.push(match);
          }
        } catch (e) {
          console.warn(`Could not fetch extra portfolio company: ${name}`, e);
        }
      }

      // Step 3: Transform records
      const transformed = allRecords.map(record => {
        const base = extractCompanyFields(record);
        if (!base) return null;

        const v = record.values || {};

        // Extract additional fields
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

        // Build logo URL — try logo_url first, then construct from domain
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

      setCompanies(transformed);
      setIsLive(true);

      // Cache
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: transformed,
        ts: Date.now(),
      }));
    } catch (err) {
      console.error('Failed to fetch portfolio from Attio:', err);
    } finally {
      setLoading(false);
    }
  }

  return { companies, loading, isLive };
}
