import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useAttioCompanies } from '../hooks/useAttioCompanies';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { useLocalStorage } from '../hooks/useLocalStorage';

// ─── Theme icons (inline SVGs, no emojis) ────────────────────────────
const THEME_ICONS = {
  founder: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  market: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
    </svg>
  ),
  product: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  traction: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  deal: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  legal: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 8v4l3 3" />
      <path d="M3.5 12H2m20 0h-1.5M12 3.5V2m0 20v-1.5" />
    </svg>
  ),
};

// ─── Assessment schema ───────────────────────────────────────────────
// Field types:
//   select  — dropdown with options
//   rating  — 1-10 button grid
//   check   — boolean checkbox (done/not done)
//   section — visual sub-header (not a real field, skipped in scoring)
const ASSESSMENT_THEMES = [
  {
    id: 'founder',
    label: 'Founders & Team',
    icon: 'founder',
    fields: [
      // ── Founders ──
      { id: '_s_founders', label: 'Founders', type: 'section' },
      { id: 'founderRolesConfirmed', label: 'Confirmed founder roles & complementarity (sales/action vs strategy/planning)', type: 'check' },
      { id: 'founderMotivation', label: 'Validated founder motivation & "why this problem"', type: 'check' },
      { id: 'founderReferenceCalls', label: 'Reference calls done on founders (colleagues, customers, investors)', type: 'check' },
      { id: 'decisionMakingStyle', label: 'Decision-making style & conflict handling assessed', type: 'check' },
      { id: 'usAmbitionValidated', label: 'US ambition validated: concrete plan, timing, relocation, hiring', type: 'check' },
      { id: 'executionDiscipline', label: 'Execution discipline: shipping pace, responsiveness in DD, data room quality', type: 'select', options: ['Exceptional', 'Good', 'Mediocre', 'Poor'] },
      { id: 'initialResponse', label: 'Initial response time', type: 'select', options: ['< 1 hour', '< 24 hours', '2-3 days', '> 3 days'] },
      { id: 'camePrepared', label: 'Came prepared to first call?', type: 'select', options: ['Yes', 'No'] },
      { id: 'curveball', label: 'Curveball handling (asked tough questions)', type: 'select', options: ['Exceptional', 'Good', 'Mediocre', 'Poor'] },
      { id: 'tenYears', label: 'Would work with them for 10 years?', type: 'select', options: ['Absolutely', 'Yes', 'Unsure', 'No'] },
      { id: 'founderGutScore', label: 'Founder gut score', type: 'rating' },

      // ── Org & Hiring ──
      { id: '_s_org', label: 'Org & Hiring', type: 'section' },
      { id: 'keyFunctionsMapped', label: 'Mapped key functions: product, eng, data/ML, sales, CSM, ops — identified gaps', type: 'check' },
      { id: 'techTeamValidated', label: 'Tech team strength validated via technical references / expert validation', type: 'check' },
      { id: 'hiringFunnel', label: 'Hiring funnel & retention reviewed (especially US sales/CSM)', type: 'check' },
      { id: 'incentivePlan', label: 'Incentive plan reviewed (equity split, ESOP/BSPCE pool, retention packages)', type: 'check' },
      { id: 'teamComposition', label: 'Team composition overall', type: 'select', options: ['Strong', 'Decent', 'Weak'] },

      // ── Governance & Alignment ──
      { id: '_s_gov', label: 'Governance & Alignment', type: 'section' },
      { id: 'capTableReviewed', label: 'Cap table reviewed: preferred terms, liquidation stack, option pool', type: 'check' },
      { id: 'boardGovernance', label: 'Board/observer rights, governance cadence, info rights confirmed', type: 'check' },
      { id: 'noSideActivity', label: 'No founder side activity, conflicts, or exit timing misalignment', type: 'check' },
      { id: 'cofounderDynamics', label: 'Cofounder dynamics', type: 'select', options: ['Excellent', 'Good', 'Some tension', 'Problematic'] },
    ],
  },
  {
    id: 'market',
    label: 'Market & Competition',
    icon: 'market',
    fields: [
      // ── Problem & Scope ──
      { id: '_s_problem', label: 'Problem Definition & Scope', type: 'section' },
      { id: 'problemClarity', label: 'Problem clearly defined and scoped', type: 'check' },
      { id: 'roiLogicValidated', label: 'ROI logic validated (customer savings vs cost of solution)', type: 'check' },
      { id: 'painIntensity', label: 'Customer pain intensity', type: 'select', options: ['Hair on fire', 'Strong', 'Moderate', 'Nice to have'] },

      // ── TAM & Segmentation ──
      { id: '_s_tam', label: 'TAM & Segmentation', type: 'section' },
      { id: 'tamSize', label: 'TAM size', type: 'select', options: ['< €100M', '€100M – €1B', '€1B – €10B', '> €10B'] },
      { id: 'icpSegmented', label: 'ICP clearly segmented (SMB, mid-market, enterprise)', type: 'check' },
      { id: 'geoReadiness', label: 'Country-by-country readiness assessed (localization, churn by geo)', type: 'check' },
      { id: 'samRealistic', label: 'SAM is realistic and well-supported', type: 'select', options: ['Yes', 'Somewhat', 'No'] },

      // ── Market Dynamics ──
      { id: '_s_dynamics', label: 'Market Dynamics', type: 'section' },
      { id: 'timing', label: 'Market timing', type: 'select', options: ['Too early', 'Right time', 'Late'] },
      { id: 'regulatoryRisk', label: 'Regulatory risk', type: 'select', options: ['Low', 'Medium', 'High'] },
      { id: 'marketGrowthRate', label: 'Market growth rate', type: 'select', options: ['Explosive (>30%)', 'Fast (15-30%)', 'Moderate (5-15%)', 'Slow (<5%)'] },
      { id: 'existingBigUSCompetitor', label: 'Existing big US competitor?', type: 'select', options: ['None', 'Weak/indirect', 'Strong/direct'] },
      { id: 'cyclicality', label: 'Market cyclicality / macro sensitivity', type: 'select', options: ['Resilient', 'Moderate', 'Cyclical'] },

      // ── Market Risks ──
      { id: '_s_marketRisks', label: 'Market Risks', type: 'section' },
      { id: 'patternChangeRisk', label: 'Stress-tested "pattern change" risk (does product adapt?)', type: 'check' },
      { id: 'platformRisk', label: 'Platform dependency risk (AWS, Apple, regulation)', type: 'select', options: ['None', 'Low', 'Medium', 'High'] },

      // ── Competitive Landscape ──
      { id: '_s_landscape', label: 'Competitive Landscape', type: 'section' },
      { id: 'competitorMapBuilt', label: 'Built competitor map (direct, adjacent, substitutes)', type: 'check' },
      { id: 'competitiveLandscape', label: 'Competitive density', type: 'select', options: ['Blue ocean', 'Few players', 'Crowded', 'Red ocean'] },
      { id: 'competitorCallsDone', label: 'Reference calls on named competitors done', type: 'check' },

      // ── Differentiation ──
      { id: '_s_diff', label: 'Differentiation', type: 'section' },
      { id: 'diffValidated', label: 'Differentiation verified with customers (not just founders)', type: 'check' },
      { id: 'deploymentAdvantage', label: 'Deployment advantage (ease of onboarding, time-to-value)', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'None'] },
      { id: 'costAdvantage', label: 'Cost advantage vs alternatives', type: 'select', options: ['Significantly cheaper', 'Somewhat cheaper', 'Similar', 'More expensive'] },
      { id: 'dataMoat', label: 'Data moat / network effects', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'None'] },
      { id: 'switchingCost', label: 'Customer switching cost', type: 'select', options: ['Very high', 'High', 'Medium', 'Low'] },
      { id: 'leadAsserted', label: 'Asserted lead (data, model, distribution) verified', type: 'check' },
      { id: 'marketScore', label: 'Overall market & competition score', type: 'rating' },
    ],
  },
  {
    id: 'product',
    label: 'Product & Technology',
    icon: 'product',
    fields: [
      // ── Workflow & UX ──
      { id: '_s_workflow', label: 'Workflow & UX', type: 'section' },
      { id: 'fullDemoDone', label: 'Full product demo done end-to-end', type: 'check' },
      { id: 'uxQuality', label: 'UX quality', type: 'select', options: ['Excellent', 'Good', 'Functional', 'Poor'] },
      { id: 'deterrentEffect', label: 'Deterrent / preventive effect validated (not just detection)', type: 'check' },
      { id: 'privacyCompliant', label: 'Privacy features verified (no facial recognition, data handling)', type: 'check' },

      // ── Deployment ──
      { id: '_s_deploy', label: 'Deployment & Operations', type: 'section' },
      { id: 'installComplexity', label: 'Install complexity / time-to-value', type: 'select', options: ['Plug & play', 'Easy (<1 day)', 'Moderate (days)', 'Complex (weeks+)'] },
      { id: 'integrationEase', label: 'Integration with existing customer systems', type: 'select', options: ['Seamless', 'Standard', 'Requires work', 'Difficult'] },
      { id: 'ongoingSupportNeeds', label: 'Ongoing support needs assessed (CSM burden)', type: 'check' },
      { id: 'staffAdoption', label: 'End-user / staff adoption friction', type: 'select', options: ['Very low', 'Low', 'Medium', 'High'] },

      // ── Roadmap ──
      { id: '_s_roadmap', label: 'Roadmap & Feature Set', type: 'section' },
      { id: 'currentFeatureSetValidated', label: 'Current feature set validated (customization, rules)', type: 'check' },
      { id: 'roadmapCredible', label: 'Roadmap is credible and funded', type: 'select', options: ['Strong', 'Reasonable', 'Ambitious', 'Unrealistic'] },
      { id: 'adjacentUseCases', label: 'Adjacent use cases validated (real roadmap vs vaporware)', type: 'check' },

      // ── Core Tech Performance ──
      { id: '_s_model', label: 'Core Tech Performance', type: 'section' },
      { id: 'detectionAccuracy', label: 'Detection / core accuracy validated and measured', type: 'check' },
      { id: 'performanceProgression', label: 'Historical performance progression documented', type: 'check' },
      { id: 'falsePositiveRate', label: 'False positive rate quantified and acceptable', type: 'check' },
      { id: 'techMoat', label: 'Tech moat strength', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'None'] },

      // ── Data Moat ──
      { id: '_s_data', label: 'Data Moat', type: 'section' },
      { id: 'datasetVerified', label: 'Dataset claims verified (size, diversity, geo coverage)', type: 'check' },
      { id: 'labelingPipeline', label: 'Labeling / annotation pipeline reviewed (QA, feedback loop)', type: 'check' },
      { id: 'modelUpdateCadence', label: 'Model update cadence & retraining process documented', type: 'check' },
      { id: 'dataDefensibility', label: 'Data defensibility vs synthetic data / competitors', type: 'select', options: ['Strong', 'Moderate', 'Vulnerable'] },

      // ── Infrastructure ──
      { id: '_s_infra', label: 'Infrastructure & Scalability', type: 'section' },
      { id: 'scalability', label: 'Scalability', type: 'select', options: ['Proven at scale', 'Likely', 'Uncertain', 'Unlikely'] },
      { id: 'edgeDeployment', label: 'Edge / on-prem deployment constraints validated', type: 'check' },
      { id: 'architectureCOGS', label: 'Architecture matches stated COGS (serverless claims etc.)', type: 'check' },
      { id: 'securityReview', label: 'Security review done (data in transit/at rest, access controls)', type: 'check' },

      // ── IP ──
      { id: '_s_ip', label: 'IP & Protection', type: 'section' },
      { id: 'ipProtection', label: 'IP protection strategy', type: 'select', options: ['Patents filed', 'Trade secret', 'Open source core', 'None'] },
      { id: 'ipOwnershipClear', label: 'IP ownership clear (code, models, data, contractor assignments)', type: 'check' },
      { id: 'productTechScore', label: 'Overall product & tech score', type: 'rating' },
    ],
  },
  {
    id: 'traction',
    label: 'Traction, GTM & Financials',
    icon: 'traction',
    fields: [
      // ── Customer Reality ──
      { id: '_s_customers', label: 'Customer Reality Checks', type: 'section' },
      { id: 'customerCountReconciled', label: 'Customer count reconciled (active paying vs signed vs churned)', type: 'check' },
      { id: 'referenceCalls', label: 'Reference calls done (happy, neutral, churned customers)', type: 'check' },
      { id: 'roiClaimsValidated', label: 'ROI claims validated with real customer data (before/after)', type: 'check' },
      { id: 'keyMetricsConfirmed', label: 'Key proof-point metrics confirmed via customer evidence', type: 'check' },

      // ── Cohorts & Retention ──
      { id: '_s_cohorts', label: 'Cohorts & Retention', type: 'section' },
      { id: 'cohortAnalysisDone', label: 'Cohort analysis done (churn concentration, vintage curves)', type: 'check' },
      { id: 'churnDrivers', label: 'Churn drivers identified by geo and segment', type: 'check' },
      { id: 'nrr', label: 'Net Revenue Retention (NRR)', type: 'select', options: ['>130%', '110-130%', '100-110%', '90-100%', '<90%'] },
      { id: 'nrrImprovementPlan', label: 'NRR improvement plan validated (features, pricing, upsells)', type: 'check' },
      { id: 'logoChurn', label: 'Logo churn (annual)', type: 'select', options: ['<5%', '5-10%', '10-20%', '20-30%', '>30%'] },

      // ── Usage & Stickiness ──
      { id: '_s_usage', label: 'Usage & Product Stickiness', type: 'section' },
      { id: 'usageKPIs', label: 'Usage KPIs correlate with retention / ROI', type: 'check' },
      { id: 'appExperience', label: 'App / UX experience is not a churn bottleneck', type: 'check' },

      // ── GTM: Funnel & Efficiency ──
      { id: '_s_funnel', label: 'GTM: Funnel & Efficiency', type: 'section' },
      { id: 'leadVolumeValidated', label: 'Inbound lead volume and conversion rates validated by geo', type: 'check' },
      { id: 'cacPayback', label: 'CAC payback period', type: 'select', options: ['<6 months', '6-12 months', '12-18 months', '18-24 months', '>24 months'] },
      { id: 'salesQuotas', label: 'Sales quotas: historical attainment reviewed', type: 'check' },
      { id: 'channelMix', label: 'Channel mix (inbound vs outbound vs partners)', type: 'select', options: ['Mostly inbound', 'Balanced', 'Mostly outbound', 'Partner-led'] },

      // ── GTM: Pricing ──
      { id: '_s_pricing', label: 'GTM: Pricing & Packaging', type: 'section' },
      { id: 'pricingStructureReviewed', label: 'Current pricing structure reviewed (subscription + setup)', type: 'check' },
      { id: 'setupFeeEconomics', label: 'Setup fee economics validated (true cost, sustainability)', type: 'check' },
      { id: 'pricingPower', label: 'Pricing power', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'Race to bottom'] },

      // ── GTM: Expansion ──
      { id: '_s_expansion', label: 'GTM: US / International Expansion', type: 'section' },
      { id: 'usPlanValidated', label: 'US plan validated: headcount ramp, ARR targets, channels', type: 'check' },
      { id: 'usOperationalReadiness', label: 'US operational readiness (entity, bank, hiring, compliance)', type: 'check' },
      { id: 'marketMixUS', label: 'US market segment mix (SMB vs mid-market vs enterprise)', type: 'select', options: ['Enterprise-focused', 'Mid-market', 'SMB', 'Mixed'] },

      // ── Financials: Current Performance ──
      { id: '_s_current', label: 'Financials: Current Performance', type: 'section' },
      { id: 'revenueStage', label: 'Revenue stage', type: 'select', options: ['Pre-revenue', '< €1M ARR', '€1M – €5M', '€5M – €20M', '> €20M'] },
      { id: 'arrReconciled', label: 'ARR, gross margin, contribution margin reconciled', type: 'check' },
      { id: 'grossMarginTrajectory', label: 'Gross margin trajectory validated', type: 'check' },
      { id: 'growthRate', label: 'YoY growth', type: 'select', options: ['< 50%', '50% – 100%', '100% – 200%', '> 200%'] },

      // ── Financials: Burn & Runway ──
      { id: '_s_burn', label: 'Financials: Burn & Runway', type: 'section' },
      { id: 'burnForecasts', label: 'Cumulative burn forecasts & break-even timing validated', type: 'check' },
      { id: 'headcountPlan', label: 'Headcount plan reviewed vs productivity assumptions', type: 'check' },
      { id: 'runway', label: 'Current runway (with this round)', type: 'select', options: ['24+ months', '18-24 mo', '12-18 mo', '<12 mo'] },

      // ── Financials: Unit Economics ──
      { id: '_s_unitEcon', label: 'Financials: Unit Economics', type: 'section' },
      { id: 'unitEconomics', label: 'Unit economics', type: 'select', options: ['Proven & strong', 'Proven & ok', 'Promising', 'Unclear', 'Negative'] },
      { id: 'ltv2cac', label: 'LTV / CAC ratio', type: 'select', options: ['>5x', '3-5x', '2-3x', '1-2x', '<1x'] },
      { id: 'cacLtvComputed', label: 'CAC, LTV, payback computed from raw inputs', type: 'check' },
      { id: 'churnVsCSMSpend', label: 'Churn vs CSM spend: confirmed support spend reduces churn', type: 'check' },

      // ── Financials: Plan Realism ──
      { id: '_s_plan', label: 'Financials: Plan Realism', type: 'section' },
      { id: 'planStressTested', label: 'Growth plan stress-tested (net adds/month, pricing, churn, sales capacity)', type: 'check' },
      { id: 'fundraisingClean', label: 'Clean fundraising process?', type: 'select', options: ['Yes', 'Mostly', 'No'] },
      { id: 'tractionScore', label: 'Overall traction, GTM & financials score', type: 'rating' },
    ],
  },
  {
    id: 'deal',
    label: 'Deal & Valuation',
    icon: 'deal',
    fields: [
      // ── Valuation ──
      { id: '_s_valuation', label: 'Valuation', type: 'section' },
      { id: 'revenueMultiple', label: 'Revenue multiple method done (inputs, comps)', type: 'check' },
      { id: 'saasCapSensitivity', label: 'SaaS "cap" method sensitivity (penalized by low NRR)', type: 'check' },
      { id: 'valuationFairness', label: 'Valuation fairness', type: 'select', options: ['Cheap', 'Fair', 'Expensive', 'Overpriced'] },

      // ── Terms ──
      { id: '_s_terms', label: 'Terms', type: 'section' },
      { id: 'preMoney', label: 'Pre-money, dilution, use of proceeds confirmed', type: 'check' },
      { id: 'termsReviewed', label: 'Terms reviewed: liq pref, participation, anti-dilution, pro-rata', type: 'check' },
      { id: 'governanceRights', label: 'Governance / board rights acceptable', type: 'select', options: ['Favorable', 'Standard', 'Unfavorable'] },

      // ── Exit ──
      { id: '_s_exit', label: 'Exit Scenarios', type: 'section' },
      { id: 'exitScenarios', label: 'Exit scenarios mapped (strategic acquirers, financial buyers)', type: 'check' },
      { id: 'exitTiming', label: 'Exit timing logic (why now / why later)', type: 'check' },
      { id: 'returnProfile', label: 'Return profile (base case)', type: 'select', options: ['>10x', '5-10x', '3-5x', '2-3x', '<2x'] },
      { id: 'dealScore', label: 'Overall deal score', type: 'rating' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal, Regulatory & ESG',
    icon: 'legal',
    fields: [
      // ── Privacy & Regulation ──
      { id: '_s_privacy', label: 'Privacy & Surveillance Regulation', type: 'section' },
      { id: 'gdprCompliance', label: 'GDPR compliance reviewed (DPIA, lawful basis, retention, access rights)', type: 'check' },
      { id: 'privacyEnforced', label: 'Privacy claims technically enforced and audited', type: 'check' },
      { id: 'regulatorCorrespondence', label: 'Regulator correspondence reviewed (written evidence, timelines)', type: 'check' },
      { id: 'regulatoryCompliance', label: 'Overall regulatory compliance', type: 'select', options: ['Compliant', 'In progress', 'Non-compliant'] },

      // ── Commercial / Legal ──
      { id: '_s_commercial', label: 'Commercial & Legal', type: 'section' },
      { id: 'customerContracts', label: 'Customer contracts reviewed (liability, SLAs, indemnities, termination)', type: 'check' },
      { id: 'vendorContracts', label: 'Vendor contracts reviewed (hardware, cloud, labeling — assignability)', type: 'check' },
      { id: 'legalStructure', label: 'Legal structure', type: 'select', options: ['Clean', 'Minor issues', 'Major issues'] },

      // ── Security ──
      { id: '_s_security', label: 'Security', type: 'section' },
      { id: 'securityPolicy', label: 'Security policy reviewed (incident response, pentests)', type: 'check' },
      { id: 'soc2Iso', label: 'SOC2 / ISO status', type: 'select', options: ['Certified', 'In progress', 'Planned', 'None'] },

      // ── ESG ──
      { id: '_s_esg', label: 'ESG & Compliance', type: 'section' },
      { id: 'socialRisk', label: 'Social risk profile assessed (surveillance, worker monitoring, bias)', type: 'check' },
      { id: 'governancePolicies', label: 'Governance policies reviewed (ethics, compliance, whistleblowing)', type: 'check' },
      { id: 'esgRating', label: 'ESG risk level', type: 'select', options: ['Low', 'Medium', 'High'] },
      { id: 'conflictsCheck', label: 'Conflicts of interest check done', type: 'check' },
      { id: 'thresholdFilings', label: 'Required notifications / threshold filings checked', type: 'check' },
      { id: 'legalScore', label: 'Overall legal & regulatory score', type: 'rating' },
    ],
  },
];

const KANBAN_STAGES = [
  { id: 'met', label: 'Met', color: '#10B981' },
  { id: 'analysis', label: 'In-Depth Analysis', color: '#8B5CF6' },
  { id: 'committee', label: 'Committee', color: '#F59E0B' },
];

const ACTIVE_SATUS = new Set(['Met', 'Committee']);

// ─── Required DD calls per theme ─────────────────────────────────────
// These are mandatory calls that must happen for proper due diligence.
// Each has an id (used for localStorage tracking), a label, and the theme it belongs to.
const REQUIRED_CALLS = [
  // Founders & Team
  { id: 'rc_founder_intro', label: 'First founder call', theme: 'founder', type: 'Founder' },
  { id: 'rc_founder_ref1', label: 'Founder reference #1 (ex-colleague)', theme: 'founder', type: 'Reference' },
  { id: 'rc_founder_ref2', label: 'Founder reference #2 (investor/board)', theme: 'founder', type: 'Reference' },
  { id: 'rc_founder_followup', label: 'Founder follow-up (deep character)', theme: 'founder', type: 'Founder' },
  // Market & Competition
  { id: 'rc_market_expert', label: 'Industry expert call', theme: 'market', type: 'Market' },
  { id: 'rc_market_competitor', label: 'Competitor analysis call', theme: 'market', type: 'Market' },
  // Product & Technology
  { id: 'rc_product_demo', label: 'Full product demo', theme: 'product', type: 'Product' },
  { id: 'rc_product_cto', label: 'CTO / tech deep-dive', theme: 'product', type: 'Product' },
  { id: 'rc_product_data', label: 'Data & model review call', theme: 'product', type: 'Product' },
  // Traction, GTM & Financials
  { id: 'rc_traction_customer1', label: 'Customer reference #1 (happy)', theme: 'traction', type: 'Reference' },
  { id: 'rc_traction_customer2', label: 'Customer reference #2 (neutral)', theme: 'traction', type: 'Reference' },
  { id: 'rc_traction_churned', label: 'Churned customer call', theme: 'traction', type: 'Reference' },
  { id: 'rc_traction_gtm_us', label: 'GTM deep-dive (US expansion)', theme: 'traction', type: 'GTM' },
  { id: 'rc_traction_financials', label: 'CFO / financials walkthrough', theme: 'traction', type: 'Financials' },
  // Deal & Valuation
  { id: 'rc_deal_terms', label: 'Terms negotiation call', theme: 'deal', type: 'Deal' },
  // Legal
  { id: 'rc_legal_review', label: 'Legal DD call (counsel)', theme: 'legal', type: 'Legal' },
];

// ─── Placeholder completed calls per company ────────────────────────
// Will be replaced by real Granola data later.
// `requiredCallId` links a completed call to a required call if applicable.
const PLACEHOLDER_CALLS = {
  'Upciti': [
    { id: 'u1', title: 'First founder call — Christophe', date: 'Jan 15, 2026', attendees: ['Olivier', 'Christophe'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'u2', title: 'Product deep-dive w/ CTO', date: 'Jan 22, 2026', attendees: ['Joseph', 'Marc (CTO)'], type: 'Product', requiredCallId: 'rc_product_cto' },
    { id: 'u3', title: 'Market reference — city of Lyon', date: 'Jan 28, 2026', attendees: ['Olivier', 'Deputy Mayor'], type: 'Reference', requiredCallId: 'rc_market_expert' },
    { id: 'u4', title: 'Follow-up — unit economics review', date: 'Feb 04, 2026', attendees: ['Olivier', 'Christophe'], type: 'Financials', requiredCallId: 'rc_traction_financials' },
    { id: 'u5', title: 'Customer ref — municipality pilot', date: 'Feb 06, 2026', attendees: ['Joseph', 'City ops manager'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
  ],
  'Sunrise Robotics': [
    { id: 'sr1', title: 'Intro call — CEO pitch', date: 'Jan 20, 2026', attendees: ['Joseph', 'CEO'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'sr2', title: 'Technical DD — robotics stack', date: 'Feb 01, 2026', attendees: ['Joseph', 'CTO'], type: 'Product', requiredCallId: 'rc_product_cto' },
  ],
  'Quiet': [
    { id: 'q1', title: 'First call — Anouar', date: 'Jan 18, 2026', attendees: ['Joseph', 'Anouar'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'q2', title: 'Customer reference — enterprise client', date: 'Jan 30, 2026', attendees: ['Joseph', 'VP Eng (client)'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
    { id: 'q3', title: 'Competitive landscape review', date: 'Feb 03, 2026', attendees: ['Anouar', 'Joseph'], type: 'Market', requiredCallId: 'rc_market_competitor' },
  ],
  'Cello': [
    { id: 'c1', title: 'Intro call — Stefan (CEO)', date: 'Jan 25, 2026', attendees: ['Joseph', 'Stefan'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'c2', title: 'GTM deep-dive — Series A', date: 'Feb 03, 2026', attendees: ['Stefan', 'Joseph'], type: 'GTM', requiredCallId: 'rc_traction_gtm_us' },
  ],
  'Satlyt': [
    { id: 's1', title: 'First meeting — Max Corbani', date: 'Jan 30, 2026', attendees: ['Max', 'Rama'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
  ],
  'Staer': [
    { id: 'st1', title: 'Intro — Jan Erik Solem', date: 'Jan 14, 2026', attendees: ['Joseph', 'Jan Erik'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'st2', title: 'Technical deep-dive — computer vision', date: 'Jan 22, 2026', attendees: ['Joseph', 'CTO'], type: 'Product', requiredCallId: 'rc_product_cto' },
    { id: 'st3', title: 'Customer call — logistics partner', date: 'Jan 30, 2026', attendees: ['Jan Erik', 'Abel'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
  ],
  'RMG': [
    { id: 'r1', title: 'Intro call — Rick Gittleman', date: 'Jan 28, 2026', attendees: ['Olivier', 'Rick'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'r2', title: 'Market sizing — minerals supply chain', date: 'Feb 03, 2026', attendees: ['Rick', 'Olivier'], type: 'Market', requiredCallId: 'rc_market_expert' },
  ],
};

// Match a deal name to placeholder calls
function getDealCalls(dealName) {
  if (!dealName) return [];
  const name = dealName.split(' - ')[0].trim().toLowerCase();
  for (const [key, calls] of Object.entries(PLACEHOLDER_CALLS)) {
    if (name.includes(key.toLowerCase())) return calls;
  }
  return [];
}

// Hardcoded initial overrides
const INITIAL_OVERRIDES = {
  'e9854ff6-6128-44f1-ab44-83f2e9fcf33e': 'analysis', // Upciti
  'cc2c5d68-b872-4f03-b82c-c1bbd6b7952d': 'analysis', // Sunrise Robotics
};

const ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Score weights for select options (higher = better)
const SELECT_SCORE_MAP = {
  // Generic positives
  'Exceptional': 10, 'Excellent': 10, 'Absolutely': 10, 'Strong': 9, 'Yes': 9,
  'Proven at scale': 10, 'Proven & strong': 10, 'Proven': 9, 'Plug & play': 10,
  'Seamless': 10, 'Cheap': 10, 'Favorable': 9, 'Certified': 10,
  'Hair on fire': 10, 'Blue ocean': 10, 'Significantly cheaper': 10,
  'Very high': 10, 'Resilient': 10, 'Low': 8, 'None': 8,
  'Compliant': 9, 'Clean': 9, 'Clear': 9, 'Mostly inbound': 9,
  'Patents filed': 9, '>130%': 10, '<5%': 10, '>5x': 10, '>10x': 10,
  'Explosive (>30%)': 10,

  // Moderate positives
  'Good': 7, 'Decent': 7, 'Promising': 7, 'Moderate': 6, 'Somewhat': 6,
  'Likely': 7, 'Standard': 7, 'Balanced': 7, 'In progress': 6,
  'Easy (<1 day)': 8, 'Reasonable': 7, 'Mostly': 7,
  'Few players': 7, 'Somewhat cheaper': 7, 'High': 6,
  'Medium': 5, 'Some tension': 5, 'Acceptable': 6,
  'Partially clear': 5, 'Trade secret': 7, 'Planned': 4,
  '110-130%': 8, '5-10%': 8, '3-5x': 8, '5-10x': 8,
  'Fast (15-30%)': 8,
  'Right time': 9, 'Unsure': 4,

  // Negatives
  'Mediocre': 4, 'Weak': 3, 'Poor': 2, 'No': 2, 'Unlikely': 2,
  'Crowded': 3, 'Uncertain': 3, 'Unclear': 2, 'Negative': 1,
  'Red ocean': 1, 'Messy': 2, 'Complex (weeks+)': 2, 'Difficult': 2,
  'Unrealistic': 1, 'Overpriced': 2, 'Unfavorable': 2,
  'Non-compliant': 1, 'Major issues': 1, 'Problematic': 1, 'Vulnerable': 2,
  'Race to bottom': 1, 'Cyclical': 3,
  '10-20%': 5, '20-30%': 3, '>30%': 1, '<90%': 2, '90-100%': 5,
  '100-110%': 7, '1-2x': 3, '<1x': 1, '2-3x': 5, '<2x': 2,
  'Slow (<5%)': 2, 'Moderate (5-15%)': 6,
  // CAC payback (shorter = better)
  '<6 months': 10, '6-12 months': 8, '12-18 months': 6, '18-24 months': 4, '>24 months': 2,
  // Runway (longer = better)
  '24+ months': 10, '18-24 mo': 8, '12-18 mo': 5, '<12 mo': 2,

  // Neutral
  'Too early': 4, 'Late': 3, 'Nice to have': 2,
  'Weak/indirect': 6, 'Strong/direct': 2,
  'Similar': 5, 'More expensive': 3,
  'Open source core': 5, 'Mixed': 6,
  'Enterprise-focused': 7, 'Mid-market': 7, 'SMB': 5, 'Partner-led': 6,
  'Mostly outbound': 5,
};

// ─── Helpers ─────────────────────────────────────────────────────────
function getRealFields(theme) {
  return theme.fields.filter(f => f.type !== 'section');
}

function emptyAssessment() {
  const data = {};
  ASSESSMENT_THEMES.forEach(theme => {
    data[theme.id] = {};
    getRealFields(theme).forEach(f => {
      data[theme.id][f.id] = f.type === 'rating' ? null : f.type === 'check' ? false : '';
    });
  });
  return data;
}

function getThemeCompletion(themeData, themeId) {
  const theme = ASSESSMENT_THEMES.find(t => t.id === themeId);
  if (!theme || !themeData) return 0;
  const real = getRealFields(theme);
  const filled = real.filter(f => {
    const val = themeData[f.id];
    if (f.type === 'check') return val === true;
    if (f.type === 'rating') return val !== null && val !== undefined;
    return val !== '' && val !== null && val !== undefined;
  }).length;
  return Math.round((filled / real.length) * 100);
}

function getOverallCompletion(assessment) {
  if (!assessment) return 0;
  const scores = ASSESSMENT_THEMES.map(t => getThemeCompletion(assessment[t.id], t.id));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getThemeScore(themeData, themeId) {
  const theme = ASSESSMENT_THEMES.find(t => t.id === themeId);
  if (!theme || !themeData) return null;
  const real = getRealFields(theme);
  let totalScore = 0;
  let scoredCount = 0;
  real.forEach(f => {
    const val = themeData[f.id];
    if (f.type === 'rating' && val != null) {
      totalScore += val;
      scoredCount++;
    } else if (f.type === 'check' && val === true) {
      totalScore += 10;
      scoredCount++;
    } else if (f.type === 'check' && val === false) {
      // not scored — skip
    } else if (f.type === 'select' && val && val !== '') {
      const s = SELECT_SCORE_MAP[val];
      if (s != null) { totalScore += s; scoredCount++; }
    }
  });
  return scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : null;
}

function getOverallScore(assessment) {
  if (!assessment) return null;
  const scores = ASSESSMENT_THEMES.map(t => getThemeScore(assessment[t.id], t.id)).filter(s => s !== null);
  return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
}

function scoreColor(score) {
  if (score == null) return 'var(--text-quaternary)';
  if (score >= 7.5) return '#10B981';
  if (score >= 5) return '#F59E0B';
  return '#EF4444';
}

function completionColor(pct) {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct > 0) return '#3B82F6';
  return 'var(--border-default)';
}

function getKanbanColumn(deal, columnOverrides) {
  if (columnOverrides[deal.id]) return columnOverrides[deal.id];
  const { satus, maxStatus5 } = deal;
  if (maxStatus5 === 'In depth analysis' || maxStatus5 === 'LOI' || maxStatus5 === 'Memo started') {
    if (satus !== 'Committee' && satus !== 'Won / Portfolio') return 'analysis';
  }
  if (satus === 'Committee') return 'committee';
  return 'met';
}

// ─── Components ──────────────────────────────────────────────────────

function GaugeRing({ pct, size = 48, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = completionColor(pct);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size < 40 ? 9 : 11} fontWeight="700">
        {pct}%
      </text>
    </svg>
  );
}

function MiniProgressBar({ pct, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-quaternary)] w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: completionColor(pct) }} />
      </div>
      <span className="text-[10px] font-medium w-7 text-right" style={{ color: completionColor(pct) }}>{pct}%</span>
    </div>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────────
function DraggableKanbanCard({ deal, assessment, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: deal.id, data: { deal } });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCardContent deal={deal} assessment={assessment} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function KanbanCardContent({ deal, assessment, onClick, isDragging }) {
  const ownerNames = (deal.ownerIds || []).map(id => TEAM_MAP[id]).filter(Boolean);
  const overall = getOverallCompletion(assessment);
  const shortName = deal.name?.split(' - ')[0] || deal.name || 'Unknown';
  const roundInfo = deal.name?.split(' - ').slice(1).join(' - ') || '';

  return (
    <div
      onClick={isDragging ? undefined : onClick}
      className={`bg-[var(--bg-primary)] border rounded-lg p-3 transition-all select-none ${
        isDragging
          ? 'border-[var(--rrw-red)] shadow-lg shadow-[var(--rrw-red)]/20 ring-2 ring-[var(--rrw-red)]/30'
          : 'border-[var(--border-default)] cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)]'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        {deal.domain ? (
          <img
            src={`https://www.google.com/s2/favicons?domain=${deal.domain}&sz=64`}
            alt=""
            className="w-7 h-7 rounded flex-shrink-0 mt-0.5 bg-[var(--bg-tertiary)]"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className="w-7 h-7 rounded bg-[var(--bg-tertiary)] items-center justify-center text-[11px] font-bold text-[var(--text-tertiary)] flex-shrink-0 mt-0.5"
          style={{ display: deal.domain ? 'none' : 'flex' }}
        >
          {shortName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-[var(--text-primary)] truncate leading-tight">{shortName}</div>
          {roundInfo && <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5 truncate">{roundInfo}</div>}
          {ownerNames.length > 0 && <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{ownerNames.join(', ')}</div>}
        </div>
        <GaugeRing pct={overall} size={36} strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        {ASSESSMENT_THEMES.map(theme => {
          const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
          return <MiniProgressBar key={theme.id} pct={pct} label={theme.label.split(' & ')[0].split(',')[0]} />;
        })}
      </div>
      {deal.amountInMeu != null && deal.amountInMeu > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-quaternary)]">
          Round size: <span className="font-medium text-[var(--text-secondary)]">{deal.amountInMeu}M€</span>
        </div>
      )}
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────
function DroppableColumn({ stage, dealIds, allDeals, assessments, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const deals = dealIds.map(id => allDeals.find(d => d.id === id)).filter(Boolean);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{stage.label}</h4>
        <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md">{deals.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2.5 min-h-[120px] rounded-lg p-1.5 transition-all duration-200 ${
          isOver ? 'bg-[var(--rrw-red)]/5 ring-2 ring-[var(--rrw-red)]/20' : ''
        }`}
      >
        {deals.map(d => (
          <DraggableKanbanCard
            key={d.id}
            deal={d}
            assessment={assessments[d.id]}
            onClick={() => onCardClick(d)}
          />
        ))}
        {deals.length === 0 && (
          <div className={`text-center py-8 text-[11px] border border-dashed rounded-lg transition-colors ${
            isOver
              ? 'text-[var(--rrw-red)] border-[var(--rrw-red)]/40 bg-[var(--rrw-red)]/5'
              : 'text-[var(--text-quaternary)] border-[var(--border-subtle)]'
          }`}>
            {isOver ? 'Drop here' : 'No deals at this stage'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assessment Modal ────────────────────────────────────────────────
function AssessmentField({ field, value, onChange }) {
  if (field.type === 'section') {
    return (
      <div className="col-span-2 mt-4 mb-1 first:mt-0">
        <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-1.5">{field.label}</h4>
      </div>
    );
  }
  if (field.type === 'check') {
    return (
      <label className="flex items-start gap-2.5 cursor-pointer group col-span-2 py-1">
        <div className="relative flex-shrink-0 mt-0.5">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
          <div className="w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 border-[var(--border-default)] peer-checked:border-[var(--rrw-red)] peer-checked:bg-[var(--rrw-red)] transition-all flex items-center justify-center group-hover:border-[var(--rrw-red)]/50">
            {value && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
        </div>
        <span className={`text-[12px] leading-snug transition-colors ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}>{field.label}</span>
      </label>
    );
  }
  if (field.type === 'rating') {
    return (
      <div className="col-span-2 mt-1">
        <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-2">{field.label}</label>
        <div className="flex gap-1 flex-wrap">
          {ratingOptions.map(n => (
            <button key={n} onClick={() => onChange(value === n ? null : n)} className={`rating-btn ${value === n ? 'selected' : ''}`}>{n}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{field.label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]">
        <option value="">Select...</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ScoreBadge({ score, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[18px] font-bold" style={{ color: scoreColor(score) }}>
        {score != null ? score.toFixed(1) : '—'}
      </div>
      <div className="text-[9px] text-[var(--text-quaternary)] uppercase tracking-wider">{label}</div>
    </div>
  );
}

const CALL_TYPE_COLORS = {
  Founder: { bg: 'rgba(139, 92, 246, 0.1)', fg: '#8B5CF6' },
  Product: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3B82F6' },
  Reference: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#10B981' },
  Market: { bg: 'rgba(245, 158, 11, 0.1)', fg: '#F59E0B' },
  Financials: { bg: 'rgba(239, 68, 68, 0.1)', fg: '#EF4444' },
  GTM: { bg: 'rgba(236, 72, 153, 0.1)', fg: '#EC4899' },
  Deal: { bg: 'rgba(99, 102, 241, 0.1)', fg: '#6366F1' },
  Legal: { bg: 'rgba(107, 114, 128, 0.1)', fg: '#6B7280' },
};

function CallTypeTag({ type }) {
  const c = CALL_TYPE_COLORS[type] || { bg: 'var(--bg-tertiary)', fg: 'var(--text-tertiary)' };
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.fg }}>{type}</span>
  );
}

function AssessmentModal({ deal, assessment, onUpdate, onClose, columnOverrides, meetingRatings, onRateMeeting }) {
  const [activeTheme, setActiveTheme] = useState(ASSESSMENT_THEMES[0].id);
  const currentTheme = ASSESSMENT_THEMES.find(t => t.id === activeTheme);
  const themeData = assessment?.[activeTheme] || {};
  const overall = getOverallCompletion(assessment);
  const overallScore = getOverallScore(assessment);
  const ownerNames = (deal.ownerIds || []).map(id => TEAM_MAP[id]).filter(Boolean);
  const kanbanCol = KANBAN_STAGES.find(s => s.id === getKanbanColumn(deal, columnOverrides));
  const dealCalls = getDealCalls(deal.name);

  const handleFieldChange = (fieldId, value) => onUpdate(deal.id, activeTheme, fieldId, value);

  // Count total checks done and total
  const totalChecks = ASSESSMENT_THEMES.reduce((sum, t) => sum + getRealFields(t).filter(f => f.type === 'check').length, 0);
  const doneChecks = ASSESSMENT_THEMES.reduce((sum, t) => {
    const d = assessment?.[t.id] || {};
    return sum + getRealFields(t).filter(f => f.type === 'check' && d[f.id] === true).length;
  }, 0);

  // Average call rating for this deal
  const ratedCalls = dealCalls.filter(c => meetingRatings?.[c.id] != null);
  const avgCallRating = ratedCalls.length > 0 ? Math.round((ratedCalls.reduce((s, c) => s + meetingRatings[c.id], 0) / ratedCalls.length) * 10) / 10 : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop — only closes on direct click, not drag/accidental */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      {/* Modal container — 3-panel layout */}
      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl flex overflow-hidden" style={{ width: 'min(1320px, calc(100vw - 48px))', height: 'min(85vh, 820px)' }}>

        {/* ─── Left sidebar: nav + scores ─── */}
        <div className="w-[220px] flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col">
          {/* Company header */}
          <div className="p-4 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--text-tertiary)] overflow-hidden flex-shrink-0">
                {deal.domain ? (
                  <img src={`https://www.google.com/s2/favicons?domain=${deal.domain}&sz=64`} alt="" className="w-8 h-8 object-contain" />
                ) : (deal.name?.split(' - ')[0] || 'D').charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{deal.name?.split(' - ')[0] || deal.name}</div>
                {kanbanCol && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white inline-block mt-0.5" style={{ backgroundColor: kanbanCol.color }}>{kanbanCol.label}</span>
                )}
              </div>
            </div>
            {/* Overall stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GaugeRing pct={overall} size={40} strokeWidth={3} />
                <div>
                  <div className="text-[16px] font-bold" style={{ color: scoreColor(overallScore) }}>{overallScore != null ? overallScore.toFixed(1) : '—'}</div>
                  <div className="text-[9px] text-[var(--text-quaternary)] uppercase">Score</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-semibold text-[var(--text-secondary)]">{doneChecks}/{totalChecks}</div>
                <div className="text-[9px] text-[var(--text-quaternary)]">checks</div>
              </div>
            </div>
          </div>

          {/* Theme nav buttons */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {ASSESSMENT_THEMES.map(theme => {
              const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
              const thScore = getThemeScore(assessment?.[theme.id], theme.id);
              const isActive = activeTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setActiveTheme(theme.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-r-2 border-[var(--rrw-red)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="flex-shrink-0 text-[var(--text-quaternary)]">{THEME_ICONS[theme.icon]?.(14)}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-medium truncate ${isActive ? 'text-[var(--text-primary)]' : ''}`}>{theme.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: completionColor(pct) }} />
                      </div>
                      <span className="text-[9px] font-semibold w-7 text-right" style={{ color: completionColor(pct) }}>{pct}%</span>
                    </div>
                  </div>
                  {thScore != null && (
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: scoreColor(thScore) }}>{thScore.toFixed(1)}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Deal metadata at sidebar bottom */}
          <div className="p-3 border-t border-[var(--border-default)] space-y-1.5">
            {deal.amountInMeu != null && deal.amountInMeu > 0 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Round</span><span className="text-[var(--text-secondary)] font-medium">{deal.amountInMeu}M€</span></div>
            )}
            {ownerNames.length > 0 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Owner</span><span className="text-[var(--text-secondary)] font-medium truncate ml-2">{ownerNames.join(', ')}</span></div>
            )}
            {deal.maxStatus5 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Status</span><span className="text-[var(--text-secondary)] font-medium">{deal.maxStatus5}</span></div>
            )}
          </div>
        </div>

        {/* ─── Center: scoring content area ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Content header with theme name + close button */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border-default)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">{THEME_ICONS[currentTheme?.icon]?.(20)}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{currentTheme?.label}</h3>
              {(() => {
                const pct = getThemeCompletion(assessment?.[activeTheme], activeTheme);
                return (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: pct > 0 ? completionColor(pct) + '15' : 'var(--bg-tertiary)', color: pct > 0 ? completionColor(pct) : 'var(--text-quaternary)' }}>
                    {pct}% complete
                  </span>
                );
              })()}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {currentTheme && (
              <div className="grid grid-cols-2 gap-x-5 gap-y-1">
                {currentTheme.fields.map(field => (
                  <AssessmentField key={field.id} field={field} value={themeData[field.id]} onChange={(val) => handleFieldChange(field.id, val)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right panel: calls timeline ─── */}
        {(() => {
          // Required calls for the active theme
          const themeRequired = REQUIRED_CALLS.filter(rc => rc.theme === activeTheme);
          // Which required calls are fulfilled by completed calls
          const fulfilledIds = new Set(dealCalls.map(c => c.requiredCallId).filter(Boolean));
          // Completed calls for this theme (matched by requiredCallId theme, or by type match)
          const themeCalls = dealCalls.filter(c => {
            if (c.requiredCallId) {
              const rc = REQUIRED_CALLS.find(r => r.id === c.requiredCallId);
              return rc?.theme === activeTheme;
            }
            return false;
          });
          // Ad-hoc calls: completed calls not linked to any required call for this theme
          // (We show all calls in "All calls" section below the required ones)
          const doneCount = themeRequired.filter(rc => fulfilledIds.has(rc.id)).length;
          const totalRequired = themeRequired.length;

          return (
            <div className="w-[260px] flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-default)] flex flex-col">
              {/* Calls header */}
              <div className="px-4 py-3 border-b border-[var(--border-default)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-quaternary)]">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">DD Calls</h3>
                  </div>
                  <span className="text-[10px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md">{dealCalls.length} total</span>
                </div>
                {avgCallRating != null && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-[var(--text-quaternary)]">Avg rating</span>
                    <span className="text-[12px] font-bold" style={{ color: avgCallRating >= 7 ? '#10B981' : avgCallRating >= 4 ? '#F59E0B' : '#EF4444' }}>{avgCallRating}/10</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* ── Required calls for this theme ── */}
                {themeRequired.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Required</span>
                      <span className="text-[10px] font-semibold" style={{ color: doneCount === totalRequired ? '#10B981' : doneCount > 0 ? '#F59E0B' : 'var(--text-quaternary)' }}>
                        {doneCount}/{totalRequired}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {themeRequired.map(rc => {
                        const fulfilled = fulfilledIds.has(rc.id);
                        const linkedCall = fulfilled ? dealCalls.find(c => c.requiredCallId === rc.id) : null;
                        const rating = linkedCall ? meetingRatings?.[linkedCall.id] : null;
                        return (
                          <div key={rc.id} className={`rounded-lg p-2 transition-colors ${fulfilled ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border border-dashed border-[var(--border-default)]'}`}>
                            <div className="flex items-start gap-2">
                              {/* Check circle */}
                              <div className={`w-[16px] h-[16px] rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${fulfilled ? 'bg-[#10B981]' : 'border-2 border-[var(--border-default)]'}`}>
                                {fulfilled && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[11px] font-medium leading-tight ${fulfilled ? 'text-[var(--text-primary)]' : 'text-[var(--text-quaternary)]'}`}>
                                  {rc.label}
                                </div>
                                {fulfilled && linkedCall && (
                                  <div className="mt-1">
                                    <div className="text-[10px] text-[var(--text-quaternary)] truncate">{linkedCall.title}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[9px] text-[var(--text-quaternary)]">{linkedCall.date}</span>
                                      {rating != null && (
                                        <span className="text-[10px] font-bold" style={{ color: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }}>{rating}/10</span>
                                      )}
                                    </div>
                                    {/* Inline rating */}
                                    <div className="flex gap-0.5 mt-1">
                                      {ratingOptions.map(n => (
                                        <button
                                          key={n}
                                          onClick={() => onRateMeeting(linkedCall.id, n)}
                                          className={`w-[17px] h-[17px] text-[8px] rounded flex items-center justify-center transition-all ${
                                            rating === n
                                              ? 'bg-[var(--rrw-red)] text-white font-bold'
                                              : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)]'
                                          }`}
                                        >
                                          {n}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {!fulfilled && (
                                  <div className="text-[9px] text-[var(--text-quaternary)] mt-0.5 italic">Not yet scheduled</div>
                                )}
                              </div>
                              <CallTypeTag type={rc.type} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── All completed calls timeline ── */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">All completed</span>
                    <span className="text-[10px] text-[var(--text-quaternary)]">{dealCalls.length} calls</span>
                  </div>
                  {dealCalls.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-[10px] text-[var(--text-quaternary)]">No calls recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {dealCalls.map((call, idx) => {
                        const rating = meetingRatings?.[call.id];
                        // Highlight calls that belong to the active theme
                        const rc = call.requiredCallId ? REQUIRED_CALLS.find(r => r.id === call.requiredCallId) : null;
                        const isThemeCall = rc?.theme === activeTheme;
                        return (
                          <div key={call.id} className={`relative pl-5 ${isThemeCall ? '' : 'opacity-50'}`}>
                            {/* Timeline line */}
                            {idx < dealCalls.length - 1 && (
                              <div className="absolute left-[7px] top-[18px] bottom-0 w-px bg-[var(--border-subtle)]" />
                            )}
                            {/* Timeline dot */}
                            <div className="absolute left-0 top-[6px] w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: rating != null ? (rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444') : 'var(--border-default)', backgroundColor: rating != null ? (rating >= 7 ? '#10B98115' : rating >= 4 ? '#F59E0B15' : '#EF444415') : 'var(--bg-primary)' }}>
                              {rating != null && <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }} />}
                            </div>
                            <div className="pb-2.5 pt-0.5">
                              <div className="flex items-start justify-between gap-1 mb-0.5">
                                <span className="text-[11px] font-medium text-[var(--text-primary)] leading-tight">{call.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[var(--text-quaternary)]">{call.date}</span>
                                <CallTypeTag type={call.type} />
                                {rating != null && (
                                  <span className="text-[10px] font-bold ml-auto" style={{ color: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }}>{rating}/10</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export default function DealAnalysis({ meetingRatings, setMeetingRatings, showToast }) {
  const { dealFlowData, loading, isLive } = useAttioCompanies();
  const [assessments, setAssessments] = useLocalStorage('deal-assessments', {});
  const [columnOverrides, setColumnOverrides] = useLocalStorage('deal-column-overrides', INITIAL_OVERRIDES);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [activeDragId, setActiveDragId] = useState(null);

  // Merge initial overrides with any persisted ones
  const mergedOverrides = useMemo(() => ({ ...INITIAL_OVERRIDES, ...columnOverrides }), [columnOverrides]);

  // DnD sensors — distance threshold prevents accidental drags when clicking
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Active pipeline deals
  const activeDeals = useMemo(() => {
    if (!dealFlowData?.deals) return [];
    return dealFlowData.deals
      .filter(d => ACTIVE_SATUS.has(d.satus) || mergedOverrides[d.id])
      .filter(d => ownerFilter === 'all' || (d.ownerIds || []).includes(ownerFilter))
      .map(d => ({ ...d, kanbanColumn: getKanbanColumn(d, mergedOverrides) }));
  }, [dealFlowData, ownerFilter, mergedOverrides]);

  // Group deal IDs by stage
  const dealIdsByStage = useMemo(() => {
    const grouped = {};
    KANBAN_STAGES.forEach(s => { grouped[s.id] = []; });
    activeDeals.forEach(d => {
      if (grouped[d.kanbanColumn]) grouped[d.kanbanColumn].push(d.id);
    });
    // Sort by assessment completion desc
    Object.keys(grouped).forEach(stageId => {
      grouped[stageId].sort((a, b) =>
        getOverallCompletion(assessments[b]) - getOverallCompletion(assessments[a])
      );
    });
    return grouped;
  }, [activeDeals, assessments]);

  const activeDragDeal = activeDragId ? activeDeals.find(d => d.id === activeDragId) : null;

  // Find which column a deal ID is in
  function findColumn(dealId) {
    for (const [stageId, ids] of Object.entries(dealIdsByStage)) {
      if (ids.includes(dealId)) return stageId;
    }
    return null;
  }

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const dealId = active.id;
    const sourceCol = findColumn(dealId);

    // The over.id is the droppable column ID (met, analysis, committee)
    const stageIds = new Set(KANBAN_STAGES.map(s => s.id));
    const targetCol = stageIds.has(over.id) ? over.id : null;
    if (!targetCol || targetCol === sourceCol) return;

    // Persist the column override
    setColumnOverrides(prev => ({ ...prev, [dealId]: targetCol }));
    const targetLabel = KANBAN_STAGES.find(s => s.id === targetCol)?.label;
    showToast?.(`Moved to ${targetLabel}`);
  }

  function handleDragCancel() {
    setActiveDragId(null);
  }

  // Assessment updates
  const handleAssessmentUpdate = useCallback((dealId, themeId, fieldId, value) => {
    setAssessments(prev => {
      const current = prev[dealId] || emptyAssessment();
      return {
        ...prev,
        [dealId]: {
          ...current,
          [themeId]: { ...current[themeId], [fieldId]: value },
        },
      };
    });
  }, [setAssessments]);

  const rateMeeting = (id, rating) => {
    setMeetingRatings({ ...meetingRatings, [id]: rating });
    showToast(`Rated ${rating}/10`);
  };

  if (loading && !dealFlowData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading deal flow data from Attio...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">{activeDeals.length} active deals</span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      <div>
        {/* Filter bar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 mb-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Owner</label>
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]">
                <option value="all">Everyone</option>
                {TEAM_MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-6">
              {KANBAN_STAGES.map(stage => (
                <div key={stage.id} className="text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{dealIdsByStage[stage.id]?.length || 0}</div>
                  <div className="text-[10px] text-[var(--text-quaternary)]">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kanban columns with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4">
            {KANBAN_STAGES.map(stage => (
              <DroppableColumn
                key={stage.id}
                stage={stage}
                dealIds={dealIdsByStage[stage.id] || []}
                allDeals={activeDeals}
                assessments={assessments}
                onCardClick={setSelectedDeal}
              />
            ))}
          </div>

          {/* Drag overlay — floating card while dragging */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragDeal && (
              <div className="w-[280px]">
                <KanbanCardContent
                  deal={activeDragDeal}
                  assessment={assessments[activeDragDeal.id]}
                  onClick={() => {}}
                  isDragging={true}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Assessment Modal */}
      {selectedDeal && (
        <AssessmentModal
          deal={selectedDeal}
          assessment={assessments[selectedDeal.id] || emptyAssessment()}
          onUpdate={handleAssessmentUpdate}
          onClose={() => setSelectedDeal(null)}
          columnOverrides={mergedOverrides}
          meetingRatings={meetingRatings}
          onRateMeeting={rateMeeting}
        />
      )}
    </div>
  );
}
