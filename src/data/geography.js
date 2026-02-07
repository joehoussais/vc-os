// Shared country-to-region mappings used across hooks

// Country code to display region name
export const countryToRegion = {
  'FR': 'France', 'DE': 'Germany', 'NL': 'Netherlands', 'BE': 'Belgium',
  'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
  'ES': 'Spain', 'IT': 'Italy', 'PT': 'Portugal', 'PL': 'Poland',
  'CZ': 'Czech Republic', 'AT': 'Austria', 'CH': 'Switzerland',
  'IE': 'Ireland', 'GB': 'UK', 'UK': 'UK',
};

// Country code to broader filter region (for dashboard grouping)
export const countryToFilterRegion = {
  'FR': 'France',
  'DE': 'Germany', 'NL': 'Germany', 'BE': 'Germany', 'LU': 'Germany',
  'SE': 'Nordics', 'NO': 'Nordics', 'DK': 'Nordics', 'FI': 'Nordics', 'IS': 'Nordics',
  'ES': 'Southern Europe', 'IT': 'Southern Europe', 'PT': 'Southern Europe', 'GR': 'Southern Europe',
  'PL': 'Eastern Europe', 'CZ': 'Eastern Europe', 'HU': 'Eastern Europe',
  'RO': 'Eastern Europe', 'BG': 'Eastern Europe', 'SK': 'Eastern Europe',
  'SI': 'Eastern Europe', 'HR': 'Eastern Europe', 'RS': 'Eastern Europe',
  'UA': 'Eastern Europe', 'EE': 'Eastern Europe', 'LV': 'Eastern Europe', 'LT': 'Eastern Europe',
};

// Attio funding_status slug to display stage name
export const fundingStatusToStage = {
  'pre_seed': 'Pre-Seed', 'seed': 'Seed',
  'series_a': 'Series A', 'series_b': 'Series B', 'series_c': 'Series C',
  'series_d': 'Series D', 'series_e': 'Series E', 'series_f': 'Series F',
  'series_unknown': 'Unknown', 'venture_round': 'Venture',
  'corporate_round': 'Corporate', 'private_equity': 'PE', 'angel': 'Angel',
};

// Parse funding stage from deal_id string (e.g., "Series A - CompanyName")
export function parseStageFromDealId(dealId) {
  if (!dealId) return null;
  const match = dealId.match(/^(Series [A-Z]|Seed|Pre-Seed|Venture|Grant|Private Equity|Corporate)/i);
  if (!match) return null;
  const stage = match[1];
  if (stage.toLowerCase().includes('series')) {
    // Preserve "Series X" casing: e.g. "series a" → "Series A"
    const letter = stage.slice(-1).toUpperCase();
    return 'Series ' + letter;
  }
  return stage.charAt(0).toUpperCase() + stage.slice(1).toLowerCase();
}

// Format raw amount (base EUR) to millions
export function formatAmount(amount) {
  if (!amount) return null;
  if (typeof amount === 'number') return Math.round(amount / 1000000);
  const numMatch = String(amount).match(/[\d,]+/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[0].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return Math.round(num / 1000000);
}

// Convert date string to quarter label (e.g., "2024-03-15" → "Q1 2024")
export function dateToQuarter(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}
