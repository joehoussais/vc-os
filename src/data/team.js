// Canonical team member definitions — single source of truth
// All modules should import from here instead of maintaining separate lists.

// Core investment team (appears in deal-related views)
export const TEAM_MEMBERS = [
  { id: '132dcc71-5c7a-41fa-a94c-aa9858d6cea3', name: 'Chloé' },
  { id: '7acbe6c2-21e1-4346-bcff-0ce4797d6e88', name: 'Joseph' },
  { id: '64d84369-bb20-4b9e-b313-69f423e24438', name: 'Alessandro' },
  { id: '82cfb7fc-f667-467d-97db-f5459047eeb6', name: 'Olivier' },
  { id: '93d8a2b8-e953-4c1d-bc62-2a57e5e8e481', name: 'Abel' },
  { id: 'fae2196e-dfb6-4edb-a279-adf24b1e151e', name: 'Max' },
  { id: '190fc1b3-2b0e-40b9-b1d3-3036ab9b936f', name: 'Thomas' },
  { id: 'e330fcd0-65a3-42ac-9b25-b0035cd175d2', name: 'Antoine' },
];

// Extended team — includes partners and advisors for LP pipeline
export const EXTENDED_TEAM_MEMBERS = [
  ...TEAM_MEMBERS,
  { id: 'e7f8f60f-b83f-45a5-89b7-5650e3c2b4ea', name: 'Alfred' },
  { id: '2f31b424-0e2e-4f97-beb0-8facf25077a3', name: 'Luc-Emmanuel' },
  { id: '58d63f40-928b-49b9-bdca-2336a0b2b6bc', name: 'Bertrand' },
  { id: '673a35f2-c184-48dc-9dc5-0e5114980f7e', name: 'Bettina' },
];

// Lookup maps: workspace member ID → name
export const TEAM_MAP = {};
TEAM_MEMBERS.forEach(m => { TEAM_MAP[m.id] = m.name; });

export const EXTENDED_TEAM_MAP = {};
EXTENDED_TEAM_MEMBERS.forEach(m => { EXTENDED_TEAM_MAP[m.id] = m.name; });

// Board members — for portfolio view (name + color)
export const BOARD_MEMBERS = [
  { name: 'Joseph', color: '#E63424' },
  { name: 'Luc-Emmanuel', color: '#6366F1' },
  { name: 'Olivier', color: '#059669' },
  { name: 'Antoine', color: '#D97706' },
  { name: 'Alfred', color: '#8B5CF6' },
];
