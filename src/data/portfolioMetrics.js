// Portfolio monitoring metrics — hardcoded company-level data
// Merged with live Attio data (logos, domains, total funding) at render time

// ─── Fund Definitions ──────────────────────────────────────────────
export const FUND_DEFINITIONS = [
  { id: 'fund-1', label: 'Fund I', shortLabel: 'F1', color: '#E63424' },
  { id: 'fund-2', label: 'Fund II', shortLabel: 'F2', color: '#6366F1' },
  { id: 'fund-3', label: 'Fund III', shortLabel: 'F3', color: '#059669' },
  { id: 'fund-ocommit', label: 'O Commit', shortLabel: 'OC', color: '#D97706' },
];

// ─── Health Status Config ──────────────────────────────────────────
export const HEALTH_CONFIG = {
  green: { label: 'Healthy', dot: '#10B981', bg: '#10B98118', border: '#10B98140', text: '#10B981' },
  amber: { label: 'Watch', dot: '#F59E0B', bg: '#F59E0B18', border: '#F59E0B40', text: '#F59E0B' },
  red:   { label: 'Critical', dot: '#EF4444', bg: '#EF444418', border: '#EF444440', text: '#EF4444' },
};

// ─── Destiny Control Config ────────────────────────────────────────
export const DESTINY_CONFIG = {
  secured:    { label: 'Secured', color: '#10B981', bg: '#10B98115', text: '#10B981' },
  manageable: { label: 'Manageable', color: '#3B82F6', bg: '#3B82F615', text: '#3B82F6' },
  at_risk:    { label: 'At Risk', color: '#F59E0B', bg: '#F59E0B15', text: '#F59E0B' },
  critical:   { label: 'Critical', color: '#EF4444', bg: '#EF444415', text: '#EF4444' },
};

// ─── US Expansion Config ───────────────────────────────────────────
export const US_EXPANSION_CONFIG = {
  none:    { label: '—', color: 'var(--text-quaternary)' },
  planned: { label: 'Planned', color: '#3B82F6', bg: '#3B82F615' },
  active:  { label: 'Active', color: '#10B981', bg: '#10B98115' },
};

// ─── Per-Company Portfolio Metrics ─────────────────────────────────
// key: normalized lowercase name for matching with Attio data
// fund: matches FUND_DEFINITIONS.id
// ownership: % owned by RRW (null if not applicable)
// invested: amount invested in M EUR (null if not applicable)
// runwayMonths: months of cash remaining
// runwayTrend: 'up' | 'down' | 'stable'
// canRaise: boolean — can likely raise next round
// nearProfitability: boolean — near break-even or profitable
// usExpansion: 'none' | 'planned' | 'active'
// driveFolderUrl: Google Drive URL or null (placeholder)

export const PORTFOLIO_METRICS = [
  {
    key: 'allo media',
    aliases: ['allo-media', 'allo media / uhlive'],
    name: 'Allo Media',
    fund: 'fund-1',
    ownership: null,
    invested: null,
    sector: 'Voice AI',
    runwayMonths: 5,
    runwayTrend: 'down',
    canRaise: false,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
  {
    key: 'brut',
    aliases: ['brut.'],
    name: 'Brut',
    fund: 'fund-1',
    ownership: 3.2,
    invested: 8.5,
    sector: 'Media',
    runwayMonths: 6,
    runwayTrend: 'down',
    canRaise: false,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'zml',
    aliases: [],
    name: 'ZML',
    fund: 'fund-2',
    ownership: 5.1,
    invested: 3.2,
    sector: 'AI Infrastructure',
    runwayMonths: 18,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'resilience',
    aliases: [],
    name: 'Resilience',
    fund: 'fund-1',
    ownership: 4.8,
    invested: 6.5,
    sector: 'Digital Health',
    runwayMonths: 14,
    runwayTrend: 'up',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'hypr space',
    aliases: ['hypr space (hybrid propulsion for space)'],
    name: 'HyPr Space',
    fund: 'fund-2',
    ownership: 12.5,
    invested: 5.0,
    sector: 'New Space',
    runwayMonths: 24,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
  {
    key: 'veesion',
    aliases: [],
    name: 'Veesion',
    fund: 'fund-2',
    ownership: 6.2,
    invested: 4.5,
    sector: 'AI/Retail Tech',
    runwayMonths: 16,
    runwayTrend: 'up',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'worldia',
    aliases: [],
    name: 'Worldia',
    fund: 'fund-1',
    ownership: 7.8,
    invested: 5.5,
    sector: 'Travel Tech',
    runwayMonths: 10,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'atuin',
    aliases: ['jiko'],
    name: 'Atuin',
    fund: 'fund-1',
    ownership: 4.1,
    invested: 8.0,
    sector: 'Fintech',
    runwayMonths: 20,
    runwayTrend: 'up',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'iobeya',
    aliases: [],
    name: 'iObeya',
    fund: 'fund-1',
    ownership: 9.5,
    invested: 3.5,
    sector: 'Enterprise SaaS',
    runwayMonths: 15,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'le collectionist',
    aliases: ['collectionist'],
    name: 'Le Collectionist',
    fund: 'fund-1',
    ownership: 11.2,
    invested: 4.0,
    sector: 'Luxury Travel',
    runwayMonths: 8,
    runwayTrend: 'down',
    canRaise: false,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'wemaintain',
    aliases: [],
    name: 'WeMaintain',
    fund: 'fund-1',
    ownership: 8.5,
    invested: 6.0,
    sector: 'Proptech',
    runwayMonths: 12,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'okeiro',
    aliases: [],
    name: 'Okeiro',
    fund: 'fund-2',
    ownership: 15.0,
    invested: 3.5,
    sector: 'Digital Health',
    runwayMonths: 22,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
  {
    key: 'otera',
    aliases: [],
    name: 'Otera',
    fund: 'fund-2',
    ownership: 8.0,
    invested: 3.0,
    sector: 'AI/Automation',
    runwayMonths: 14,
    runwayTrend: 'up',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'robovision',
    aliases: [],
    name: 'Robovision',
    fund: 'fund-1',
    ownership: 10.0,
    invested: 5.0,
    sector: 'AI/Computer Vision',
    runwayMonths: 12,
    runwayTrend: 'down',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
  {
    key: 'the exploration company',
    aliases: ['tec'],
    name: 'The Exploration Company',
    fund: 'fund-2',
    ownership: 6.0,
    invested: 4.0,
    sector: 'New Space',
    runwayMonths: 18,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'active',
    driveFolderUrl: null,
  },
  {
    key: 'speach',
    aliases: [],
    name: 'Speach',
    fund: 'fund-2',
    ownership: 12.0,
    invested: 2.5,
    sector: 'Enterprise SaaS',
    runwayMonths: 20,
    runwayTrend: 'up',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
  {
    key: 'deepopinion',
    aliases: [],
    name: 'DeepOpinion',
    fund: 'fund-2',
    ownership: 7.5,
    invested: 3.0,
    sector: 'AI/Automation',
    runwayMonths: 15,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'planned',
    driveFolderUrl: null,
  },
  {
    key: 'open payments',
    aliases: ['uma'],
    name: 'Open Payments',
    fund: 'fund-1',
    ownership: 5.5,
    invested: 4.0,
    sector: 'Fintech/Payments',
    runwayMonths: 10,
    runwayTrend: 'stable',
    canRaise: true,
    nearProfitability: false,
    usExpansion: 'none',
    driveFolderUrl: null,
  },
];

// ─── Health Computation ────────────────────────────────────────────
// Green: runway > 12 AND (canRaise OR nearProfitability)
// Red: runway < 6 AND !canRaise AND !nearProfitability
// Amber: everything else
export function computeHealth(m) {
  if (!m) return 'amber';
  const { runwayMonths, canRaise, nearProfitability } = m;
  if (runwayMonths > 12 && (canRaise || nearProfitability)) return 'green';
  if (runwayMonths < 6 && !canRaise && !nearProfitability) return 'red';
  return 'amber';
}

// ─── Destiny Control Computation ───────────────────────────────────
// Secured: runway > 18 OR nearProfitability
// Manageable: canRaise AND runway >= 6
// At Risk: runway 6–12 AND !canRaise
// Critical: runway < 6 AND !canRaise AND !nearProfitability
export function computeDestinyControl(m) {
  if (!m) return 'at_risk';
  const { runwayMonths, canRaise, nearProfitability } = m;
  if (runwayMonths > 18 || nearProfitability) return 'secured';
  if (canRaise && runwayMonths >= 6) return 'manageable';
  if (runwayMonths < 6 && !canRaise && !nearProfitability) return 'critical';
  return 'at_risk';
}

// ─── Lookup Map Builder ────────────────────────────────────────────
// Returns a map of normalized name → metrics entry for fast joins
export function buildMetricsMap(metrics) {
  const map = {};
  metrics.forEach(m => {
    map[m.key] = m;
    map[m.name.toLowerCase().trim()] = m;
    (m.aliases || []).forEach(alias => {
      map[alias.toLowerCase().trim()] = m;
    });
  });
  return map;
}

// ─── Aggregate Portfolio Summary ───────────────────────────────────
export function computePortfolioSummary(metrics) {
  const withData = metrics.filter(m => m.invested != null);
  const totalInvested = withData.reduce((sum, m) => sum + m.invested, 0);
  const withOwnership = metrics.filter(m => m.ownership != null);
  const avgOwnership = withOwnership.length > 0
    ? withOwnership.reduce((sum, m) => sum + m.ownership, 0) / withOwnership.length
    : 0;

  const healthCounts = { green: 0, amber: 0, red: 0 };
  const destinyCounts = { secured: 0, manageable: 0, at_risk: 0, critical: 0 };

  metrics.forEach(m => {
    healthCounts[computeHealth(m)]++;
    destinyCounts[computeDestinyControl(m)]++;
  });

  return { totalInvested, avgOwnership, healthCounts, destinyCounts, companyCount: metrics.length };
}
