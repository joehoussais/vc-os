// Crunchbase-style deals data
export const dealsData = [
  { id: 1, company: "Mistral AI", country: "France", stage: "Series B", amount: 450, date: "Q1 2025", inScope: true, seen: true, rating: 9, outcome: "Passed", source: "VC Network" },
  { id: 2, company: "Poolside AI", country: "France", stage: "Series A", amount: 35, date: "Q1 2025", inScope: true, seen: true, rating: 8, outcome: "DD", source: "Proactive" },
  { id: 3, company: "Dust", country: "France", stage: "Series A", amount: 18, date: "Q1 2025", inScope: true, seen: true, rating: 7, outcome: "Passed", source: "Warm Intro" },
  { id: 4, company: "Qonto", country: "France", stage: "Series C", amount: 120, date: "Q4 2024", inScope: false, seen: true, rating: null, outcome: "N/A", source: "Inbound" },
  { id: 5, company: "Pennylane", country: "France", stage: "Series B", amount: 45, date: "Q4 2024", inScope: true, seen: true, rating: 8, outcome: "IC", source: "VC Network" },
  { id: 6, company: "Alan", country: "France", stage: "Series C", amount: 180, date: "Q3 2024", inScope: false, seen: false, rating: null, outcome: "N/A", source: null },
  { id: 7, company: "Yoobic", country: "France", stage: "Series A", amount: 25, date: "Q1 2025", inScope: true, seen: false, rating: null, outcome: "Missed", source: null },
  { id: 8, company: "N26", country: "Germany", stage: "Series A", amount: 40, date: "Q1 2025", inScope: true, seen: true, rating: 6, outcome: "Passed", source: "Proactive" },
  { id: 9, company: "Personio", country: "Germany", stage: "Series B", amount: 85, date: "Q4 2024", inScope: true, seen: true, rating: 7, outcome: "Passed", source: "VC Network" },
  { id: 10, company: "Celonis", country: "Germany", stage: "Series C", amount: 200, date: "Q3 2024", inScope: false, seen: false, rating: null, outcome: "N/A", source: null },
  { id: 11, company: "Klarna", country: "Nordics", stage: "Series B", amount: 75, date: "Q1 2025", inScope: true, seen: true, rating: 7, outcome: "Passed", source: "Warm Intro" },
  { id: 12, company: "Spotify Ventures", country: "Nordics", stage: "Seed", amount: 8, date: "Q1 2025", inScope: true, seen: false, rating: null, outcome: "Missed", source: null },
  { id: 13, company: "Glovo", country: "Southern Europe", stage: "Series A", amount: 28, date: "Q4 2024", inScope: true, seen: true, rating: 6, outcome: "Passed", source: "Inbound" },
  { id: 14, company: "Cabify", country: "Southern Europe", stage: "Series B", amount: 55, date: "Q3 2024", inScope: false, seen: false, rating: null, outcome: "N/A", source: null },
  { id: 15, company: "Quiet.app", country: "France", stage: "Seed", amount: 4, date: "Q1 2025", inScope: true, seen: true, rating: 7, outcome: "DD", source: "Proactive" },
  { id: 16, company: "Upciti", country: "France", stage: "Series A", amount: 12, date: "Q1 2025", inScope: true, seen: true, rating: 6, outcome: "DD", source: "VC Network" },
  { id: 17, company: "RMG Minerals", country: "Other", stage: "Series A", amount: 15, date: "Q1 2025", inScope: true, seen: true, rating: null, outcome: "DD", source: "Warm Intro" },
  { id: 18, company: "Cello", country: "Germany", stage: "Series A", amount: 22, date: "Q1 2025", inScope: true, seen: true, rating: null, outcome: "Met", source: "Proactive" },
  { id: 19, company: "Staer.ai", country: "Nordics", stage: "Seed", amount: 6, date: "Q1 2025", inScope: true, seen: true, rating: 8, outcome: "DD", source: "Warm Intro" },
  { id: 20, company: "Satlyt", country: "France", stage: "Seed", amount: 5, date: "Q1 2025", inScope: true, seen: true, rating: null, outcome: "Met", source: "VC Network" },
];

// Granola meetings
export const granolaMeetings = [
  { id: "5ef36ca1", title: "Olivier/Christophe re: upciti", date: "Feb 04, 2026", attendees: ["Olivier Huez", "Christophe Desrumaux"], company: "Upciti", rating: 6 },
  { id: "c3b865d6", title: "RRW & RMG minerals", date: "Feb 03, 2026", attendees: ["Rick Gittleman", "Olivier Huez"], company: "RMG Minerals", rating: null },
  { id: "ef9cddd2", title: "RRW x quiet", date: "Feb 03, 2026", attendees: ["Anouar Benattia"], company: "Quiet.app", rating: 7 },
  { id: "2c6707e6", title: "Cello x Red River West | Series A", date: "Feb 03, 2026", attendees: ["Stefan"], company: "Cello", rating: null },
  { id: "0eff1c3f", title: "Rendezvous with Rama (Max Corbani)", date: "Jan 30, 2026", attendees: ["Max", "Rama"], company: "Satlyt", rating: null },
  { id: "e5b1e90c", title: "30 min with Joseph (Jan Erik Solem)", date: "Jan 30, 2026", attendees: ["Janerik", "Abel Samot"], company: "Staer.ai", rating: 8 },
  { id: "87091037", title: "Task force TEC", date: "Jan 30, 2026", attendees: ["Chloé Merlet", "Luc-Emmanuel Barreau"], company: null, rating: null },
  { id: "443649fa", title: "30 min teams between Bastian Behrens", date: "Jan 30, 2026", attendees: ["Bastian Behrens"], company: null, rating: null },
];

// Portfolio data
// boardRole: 'board' = board seat, 'observer' = board observer, null = no seat
// boardMembers: array of { name, role } for RRW team members on the board
export const portfolioData = [
  { id: 1, name: "uh!ive", sector: "Voice AI", stage: "Series A", runway: 5, runwayTrend: "down", cashPosition: 1.8, burn: 0.35, ownership: null, invested: null, usExpansion: "none", canRaise: false, boardMembers: [] },
  { id: 2, name: "Ada Health", sector: "Digital Health", stage: "Series B", runway: 6, runwayTrend: "down", cashPosition: 12, burn: 2, ownership: 3.2, invested: 8.5, usExpansion: "active", canRaise: false, boardMembers: [{ name: 'Antoine', role: 'observer' }] },
  { id: 3, name: "ZML", sector: "AI Infrastructure", stage: "Series A", runway: 18, runwayTrend: "stable", cashPosition: 8, burn: 0.45, ownership: 5.1, invested: 3.2, usExpansion: "planned", canRaise: true, boardMembers: [] },
  { id: 4, name: "Resilience", sector: "Digital Health", stage: "Series B", runway: 14, runwayTrend: "up", cashPosition: 15, burn: 1.1, ownership: 4.8, invested: 6.5, usExpansion: "active", canRaise: true, boardMembers: [{ name: 'Olivier', role: 'board' }] },
  { id: 5, name: "HyPr Space", sector: "New Space", stage: "Series A", runway: 24, runwayTrend: "stable", cashPosition: 20, burn: 0.85, ownership: 12.5, invested: 5, usExpansion: "none", canRaise: true, boardMembers: [{ name: 'Olivier', role: 'observer' }] },
  { id: 6, name: "Veesion", sector: "AI/Retail Tech", stage: "Series B", runway: 16, runwayTrend: "up", cashPosition: 18, burn: 1.1, ownership: 6.2, invested: 4.5, usExpansion: "active", canRaise: true, boardMembers: [{ name: 'Joseph', role: 'board' }] },
  { id: 7, name: "Worldia", sector: "Travel Tech", stage: "Series B", runway: 10, runwayTrend: "stable", cashPosition: 8, burn: 0.8, ownership: 7.8, invested: 5.5, usExpansion: "planned", canRaise: true, boardMembers: [{ name: 'Antoine', role: 'board' }] },
  { id: 8, name: "Jiko", sector: "Fintech", stage: "Series C", runway: 20, runwayTrend: "up", cashPosition: 25, burn: 1.25, ownership: 4.1, invested: 8, usExpansion: "active", canRaise: true, boardMembers: [{ name: 'Antoine', role: 'board' }] },
  { id: 9, name: "iObeya", sector: "Enterprise SaaS", stage: "Series A", runway: 15, runwayTrend: "stable", cashPosition: 6, burn: 0.4, ownership: 9.5, invested: 3.5, usExpansion: "planned", canRaise: true, boardMembers: [{ name: 'Olivier', role: 'board' }] },
  { id: 10, name: "Le Collectionist", sector: "Luxury Travel", stage: "Venture", runway: 8, runwayTrend: "down", cashPosition: 4, burn: 0.5, ownership: 11.2, invested: 4, usExpansion: "active", canRaise: false, boardMembers: [{ name: 'Antoine', role: 'board' }] },
  { id: 11, name: "WeMaintain", sector: "Proptech", stage: "Series B", runway: 12, runwayTrend: "stable", cashPosition: 10, burn: 0.85, ownership: 8.5, invested: 6, usExpansion: "planned", canRaise: true, boardMembers: [{ name: 'Luc-Emmanuel', role: 'board' }] },
  { id: 12, name: "Okeiro", sector: "Digital Health", stage: "Series A", runway: 22, runwayTrend: "stable", cashPosition: 7, burn: 0.32, ownership: 15.0, invested: 3.5, usExpansion: "none", canRaise: true, boardMembers: [{ name: 'Joseph', role: 'board' }] },
  { id: 13, name: "Otera", sector: "AI/Automation", stage: "Series A", runway: 14, runwayTrend: "up", cashPosition: 5, burn: 0.35, ownership: 8.0, invested: 3.0, usExpansion: "planned", canRaise: true, boardMembers: [{ name: 'Abel', role: 'board' }] },
  { id: 14, name: "Kontakt.io", sector: "IoT/Healthcare", stage: "Series A", runway: 16, runwayTrend: "stable", cashPosition: 9, burn: 0.55, ownership: 7.5, invested: 4.5, usExpansion: "active", canRaise: true, boardMembers: [{ name: 'Olivier', role: 'board' }] },
  { id: 15, name: "Robovision", sector: "AI/Computer Vision", stage: "Series A", runway: 12, runwayTrend: "down", cashPosition: 6, burn: 0.5, ownership: 10.0, invested: 5.0, usExpansion: "none", canRaise: true, boardMembers: [{ name: 'Olivier', role: 'board' }] }
];

// Funnel data
export const funnelData = {
  stages: [
    { id: 'universe', name: 'Sourcing Universe', description: 'All EU Series A/B/C in scope' },
    { id: 'identified', name: 'Identified', description: 'We know about them' },
    { id: 'contacted', name: 'Contacted', description: 'We reached out' },
    { id: 'first_meeting', name: 'First Meeting', description: 'Initial call completed' },
    { id: 'dd', name: 'Due Diligence', description: 'Deep dive in progress' },
    { id: 'ic', name: 'Investment Committee', description: 'Presented to IC' },
    { id: 'term_sheet', name: 'Term Sheet', description: 'Terms proposed' },
    { id: 'invested', name: 'Invested', description: 'Deal closed' },
  ],
  counts: {
    all: { universe: 2847, identified: 1842, contacted: 847, first_meeting: 312, dd: 87, ic: 24, term_sheet: 11, invested: 8 },
    proactive: { universe: 1200, identified: 980, contacted: 520, first_meeting: 145, dd: 38, ic: 10, term_sheet: 4, invested: 3 },
    vc_network: { universe: 800, identified: 450, contacted: 180, first_meeting: 95, dd: 32, ic: 9, term_sheet: 5, invested: 4 },
    inbound: { universe: 500, identified: 280, contacted: 100, first_meeting: 52, dd: 12, ic: 4, term_sheet: 2, invested: 1 },
    banker: { universe: 347, identified: 132, contacted: 47, first_meeting: 20, dd: 5, ic: 1, term_sheet: 0, invested: 0 },
  },
  dropoffReasons: {
    'identified→contacted': { 'No contact info': 25, 'Low priority': 45, 'Out of thesis': 30 },
    'contacted→first_meeting': { 'No response': 63, 'Declined meeting': 22, 'Bad timing': 15 },
    'first_meeting→dd': { 'Founder quality': 42, 'Market too small': 28, 'Competitive dynamics': 18, 'Valuation': 12 },
    'dd→ic': { 'Failed DD checks': 35, 'Team concerns': 30, 'Unit economics': 20, 'Market timing': 15 },
    'ic→term_sheet': { 'IC declined': 45, 'Valuation gap': 35, 'Competition won': 20 },
    'term_sheet→invested': { 'Terms rejected': 40, 'Founder chose other VC': 45, 'Deal fell through': 15 },
  },
  dealsByStage: {
    invested: ['Resilience', 'Veesion', 'HyPr Space', 'Jiko', 'iObeya', 'WeMaintain', 'Worldia', 'ZML'],
    term_sheet: ['Mistral AI', 'Poolside AI', 'Quiet.app'],
    ic: ['Dust', 'Pennylane', 'Upciti', 'RMG Minerals', 'Cello'],
    dd: ['Staer.ai', 'Satlyt', 'N26', 'Personio', 'Klarna'],
    first_meeting: ['Glovo', 'Yoobic', 'Spotify Ventures'],
  }
};

// Coverage time series data
export const coverageTimeSeriesData = {
  labels: ['Q1 21', 'Q2 21', 'Q3 21', 'Q4 21', 'Q1 22', 'Q2 22', 'Q3 22', 'Q4 22', 'Q1 23', 'Q2 23', 'Q3 23', 'Q4 23', 'Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25', 'Q3 25'],
  data: [67, 60, 60, 80, 71, 60, 60, 60, 80, 100, 89, 83, 92, 75, 71, 71, 78, 80, 86]
};

// Chart colors
export const chartColors = {
  rrwRed: '#E63424',
  colors: ['#E63424', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB']
};
