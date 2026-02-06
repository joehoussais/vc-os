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

export const TEAM_MAP = {};
TEAM_MEMBERS.forEach(m => { TEAM_MAP[m.id] = m.name; });
