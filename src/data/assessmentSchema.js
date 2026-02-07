// ─── Assessment schema ───────────────────────────────────────────────
// Field types:
//   select  — dropdown with options
//   rating  — 1-10 button grid
//   check   — boolean checkbox (done/not done)
//   section — visual sub-header (not a real field, skipped in scoring)
export const ASSESSMENT_THEMES = [
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
      { id: 'tamSize', label: 'TAM size', type: 'select', options: ['< \u20AC100M', '\u20AC100M \u2013 \u20AC1B', '\u20AC1B \u2013 \u20AC10B', '> \u20AC10B'] },
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
      { id: 'revenueStage', label: 'Revenue stage', type: 'select', options: ['Pre-revenue', '< \u20AC1M ARR', '\u20AC1M \u2013 \u20AC5M', '\u20AC5M \u2013 \u20AC20M', '> \u20AC20M'] },
      { id: 'arrReconciled', label: 'ARR, gross margin, contribution margin reconciled', type: 'check' },
      { id: 'grossMarginTrajectory', label: 'Gross margin trajectory validated', type: 'check' },
      { id: 'growthRate', label: 'YoY growth', type: 'select', options: ['< 50%', '50% \u2013 100%', '100% \u2013 200%', '> 200%'] },

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

// ─── Required DD calls per theme ─────────────────────────────────────
// These are mandatory calls that must happen for proper due diligence.
// Each has an id (used for localStorage tracking), a label, and the theme it belongs to.
export const REQUIRED_CALLS = [
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
export const PLACEHOLDER_CALLS = {
  'Upciti': [
    { id: 'u1', title: 'First founder call \u2014 Christophe', date: 'Jan 15, 2026', attendees: ['Olivier', 'Christophe'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'u2', title: 'Product deep-dive w/ CTO', date: 'Jan 22, 2026', attendees: ['Joseph', 'Marc (CTO)'], type: 'Product', requiredCallId: 'rc_product_cto' },
    { id: 'u3', title: 'Market reference \u2014 city of Lyon', date: 'Jan 28, 2026', attendees: ['Olivier', 'Deputy Mayor'], type: 'Reference', requiredCallId: 'rc_market_expert' },
    { id: 'u4', title: 'Follow-up \u2014 unit economics review', date: 'Feb 04, 2026', attendees: ['Olivier', 'Christophe'], type: 'Financials', requiredCallId: 'rc_traction_financials' },
    { id: 'u5', title: 'Customer ref \u2014 municipality pilot', date: 'Feb 06, 2026', attendees: ['Joseph', 'City ops manager'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
  ],
  'Sunrise Robotics': [
    { id: 'sr1', title: 'Intro call \u2014 CEO pitch', date: 'Jan 20, 2026', attendees: ['Joseph', 'CEO'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'sr2', title: 'Technical DD \u2014 robotics stack', date: 'Feb 01, 2026', attendees: ['Joseph', 'CTO'], type: 'Product', requiredCallId: 'rc_product_cto' },
  ],
  'Quiet': [
    { id: 'q1', title: 'First call \u2014 Anouar', date: 'Jan 18, 2026', attendees: ['Joseph', 'Anouar'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'q2', title: 'Customer reference \u2014 enterprise client', date: 'Jan 30, 2026', attendees: ['Joseph', 'VP Eng (client)'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
    { id: 'q3', title: 'Competitive landscape review', date: 'Feb 03, 2026', attendees: ['Anouar', 'Joseph'], type: 'Market', requiredCallId: 'rc_market_competitor' },
  ],
  'Cello': [
    { id: 'c1', title: 'Intro call \u2014 Stefan (CEO)', date: 'Jan 25, 2026', attendees: ['Joseph', 'Stefan'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'c2', title: 'GTM deep-dive \u2014 Series A', date: 'Feb 03, 2026', attendees: ['Stefan', 'Joseph'], type: 'GTM', requiredCallId: 'rc_traction_gtm_us' },
  ],
  'Satlyt': [
    { id: 's1', title: 'First meeting \u2014 Max Corbani', date: 'Jan 30, 2026', attendees: ['Max', 'Rama'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
  ],
  'Staer': [
    { id: 'st1', title: 'Intro \u2014 Jan Erik Solem', date: 'Jan 14, 2026', attendees: ['Joseph', 'Jan Erik'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'st2', title: 'Technical deep-dive \u2014 computer vision', date: 'Jan 22, 2026', attendees: ['Joseph', 'CTO'], type: 'Product', requiredCallId: 'rc_product_cto' },
    { id: 'st3', title: 'Customer call \u2014 logistics partner', date: 'Jan 30, 2026', attendees: ['Jan Erik', 'Abel'], type: 'Reference', requiredCallId: 'rc_traction_customer1' },
  ],
  'RMG': [
    { id: 'r1', title: 'Intro call \u2014 Rick Gittleman', date: 'Jan 28, 2026', attendees: ['Olivier', 'Rick'], type: 'Founder', requiredCallId: 'rc_founder_intro' },
    { id: 'r2', title: 'Market sizing \u2014 minerals supply chain', date: 'Feb 03, 2026', attendees: ['Rick', 'Olivier'], type: 'Market', requiredCallId: 'rc_market_expert' },
  ],
};

export const KANBAN_STAGES = [
  { id: 'met', label: 'Met', color: '#10B981' },
  { id: 'analysis', label: 'In-Depth Analysis', color: '#8B5CF6' },
  { id: 'committee', label: 'Committee', color: '#F59E0B' },
];

export const ACTIVE_SATUS = new Set(['Met', 'Committee']);

// Hardcoded initial kanban column overrides
export const INITIAL_OVERRIDES = {
  'e9854ff6-6128-44f1-ab44-83f2e9fcf33e': 'analysis', // Upciti
  'cc2c5d68-b872-4f03-b82c-c1bbd6b7952d': 'analysis', // Sunrise Robotics
};

// Score weights for select options (higher = better)
export const SELECT_SCORE_MAP = {
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
