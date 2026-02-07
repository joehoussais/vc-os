// Attio API service - calls our Netlify serverless function proxy

const API_PATH = '/api/attio';
const CACHE_KEY = 'attio-deals-cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function attioQuery(endpoint, payload = {}, method = 'POST') {
  const res = await fetch(API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, payload, method }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Attio API error: ${res.status}`);
  }

  return res.json();
}

// Fetch all deals with pagination
export async function fetchAllDeals() {
  let allRecords = [];
  let offset = null;

  do {
    const payload = {
      sorts: [{ attribute: 'announced_date', direction: 'desc' }],
      limit: 100,
    };
    if (offset) payload.offset = offset;

    const data = await attioQuery('/objects/deals_2/records/query', payload);
    allRecords = allRecords.concat(data.data || []);
    offset = data.next_page_offset || null;
  } while (offset);

  return allRecords;
}

// Fetch deals by IDs using filter (for coverage-first flow)
export async function fetchDealsByIds(dealIds) {
  if (!dealIds.length) return [];

  const chunks = [];
  for (let i = 0; i < dealIds.length; i += 50) {
    chunks.push(dealIds.slice(i, i + 50));
  }

  let allRecords = [];

  for (const chunk of chunks) {
    let offset = null;
    do {
      const payload = {
        filter: { "record_id": { "$in": chunk } },
        limit: 100,
      };
      if (offset) payload.offset = offset;

      const data = await attioQuery('/objects/deals_2/records/query', payload);
      allRecords = allRecords.concat(data.data || []);
      offset = data.next_page_offset || null;
    } while (offset);
  }

  return allRecords;
}

// Fetch companies by IDs using filter (much faster than fetching all)
export async function fetchCompaniesByIds(companyIds) {
  if (!companyIds.length) return [];

  // Attio supports filtering by record IDs in the query endpoint
  // Batch into chunks of 50 to avoid overly large filter arrays
  const chunks = [];
  for (let i = 0; i < companyIds.length; i += 50) {
    chunks.push(companyIds.slice(i, i + 50));
  }

  let allRecords = [];

  for (const chunk of chunks) {
    let offset = null;
    do {
      const payload = {
        filter: {
          "record_id": { "$in": chunk }
        },
        limit: 100,
      };
      if (offset) payload.offset = offset;

      const data = await attioQuery('/objects/companies/records/query', payload);
      allRecords = allRecords.concat(data.data || []);
      offset = data.next_page_offset || null;
    } while (offset);
  }

  return allRecords;
}

// Fetch all companies (startups) with pagination — for deal funnel
export async function fetchAllCompanies() {
  let allRecords = [];
  let offset = null;

  do {
    const payload = {
      filter: {
        "type": { "$eq": "Startup" }
      },
      limit: 100,
    };
    if (offset) payload.offset = offset;

    const data = await attioQuery('/objects/companies/records/query', payload);
    allRecords = allRecords.concat(data.data || []);
    offset = data.next_page_offset || null;
  } while (offset);

  return allRecords;
}

// Fetch all companies with an owner set (sourcing universe ~2000+)
export async function fetchOwnedCompanies() {
  let allRecords = [];
  let offset = null;

  do {
    const payload = {
      filter: { "owner": { "$not_empty": true } },
      limit: 100,
    };
    if (offset) payload.offset = offset;

    const data = await attioQuery('/objects/companies/records/query', payload);
    allRecords = allRecords.concat(data.data || []);
    offset = data.next_page_offset || null;
  } while (offset);

  return allRecords;
}

// Fetch all LP records with pagination
export async function fetchAllLPs() {
  let allRecords = [];
  let offset = null;

  do {
    const payload = { limit: 100 };
    if (offset) payload.offset = offset;

    const data = await attioQuery('/objects/lp/records/query', payload);
    allRecords = allRecords.concat(data.data || []);
    offset = data.next_page_offset || null;
  } while (offset);

  return allRecords;
}

// Fetch all entries from the Deal Coverage list (has in_scope, received, amount)
// Note: Attio list entries API does not return next_page_offset, so we manually
// paginate by incrementing offset until we get fewer results than the batch size.
export async function fetchListEntries() {
  const BATCH = 500;
  let allEntries = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const payload = { limit: BATCH };
    if (offset > 0) payload.offset = offset;

    const data = await attioQuery('/lists/deal_coverage_6/entries/query', payload);
    const batch = data.data || [];
    allEntries = allEntries.concat(batch);

    // If we got fewer than BATCH, we've reached the end
    if (batch.length < BATCH) break;
    offset += BATCH;
  }

  return allEntries;
}

// Helper to extract only the fields we need from a deal flow entry (strips email_content etc.)
function extractDealFields(entry) {
  const ev = entry.entry_values || {};
  const getVal = (slug) => {
    const attr = ev[slug];
    if (!attr || !attr.length) return null;
    const v = attr[0];
    if (v.value !== undefined) return v.value;
    if (v.currency_value !== undefined) return v.currency_value;
    if (v.status) return v.status.title;
    if (v.option) return v.option.title;
    return null;
  };
  const sourceAttr = ev.source;
  const sourceWsId = sourceAttr?.[0]?.referenced_actor_id || sourceAttr?.[0]?.workspace_membership_id || null;

  return {
    entry_id: entry.id?.entry_id || null,
    record_id: entry.parent_record_id || null,
    satus: getVal('satus'),
    max_status_5: getVal('max_status_5'),
    source_type_8: getVal('source_type_8'),
    amount_in_meu: getVal('amount_in_meu'),
    founding_team: getVal('founding_team'),
    created_at: getVal('created_at'),
    source_ws_id: sourceWsId,
  };
}

// Fetch all deal flow entries using PARALLEL pagination
// First call gets page 1, then we fire all remaining pages in parallel
export async function fetchDealFlowEntries() {
  const BATCH = 500;

  // First page — sequential to discover if there are more
  const first = await attioQuery('/lists/deal_flow_4/entries/query', { limit: BATCH });
  const firstBatch = first.data || [];
  let allDeals = firstBatch.map(extractDealFields);

  if (firstBatch.length < BATCH) return allDeals;

  // Fire remaining pages in parallel (we know there are ~2500 entries = ~5 pages)
  const offsets = [];
  for (let off = BATCH; off < 5000; off += BATCH) {
    offsets.push(off);
  }

  const pages = await Promise.all(
    offsets.map(offset =>
      attioQuery('/lists/deal_flow_4/entries/query', { limit: BATCH, offset })
        .then(data => data.data || [])
        .catch(() => []) // if offset is past the end, empty array
    )
  );

  for (const batch of pages) {
    if (batch.length === 0) break;
    allDeals = allDeals.concat(batch.map(extractDealFields));
    if (batch.length < BATCH) break;
  }

  return allDeals;
}

// Qualified count: localStorage cache (1h) + hardcoded fallback for instant display
// The Proactive Sourcing list has 15,000+ entries — too slow to count every time
const QUALIFIED_CACHE_KEY = 'attio-qualified-count';
const QUALIFIED_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const QUALIFIED_FALLBACK = 15000; // reasonable estimate when we can't count

export async function fetchProactiveSourcingCount() {
  // Check localStorage first — instant
  try {
    const raw = localStorage.getItem(QUALIFIED_CACHE_KEY);
    if (raw) {
      const { count, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < QUALIFIED_CACHE_TTL) return count;
    }
  } catch { /* ignore */ }

  // Count via parallel pagination through the proxy
  const BATCH = 500;
  // Fire first batch to check if list is accessible
  try {
    const first = await attioQuery('/lists/old_2_6/entries/query', { limit: BATCH });
    const firstLen = (first.data || []).length;
    if (firstLen < BATCH) {
      setCachedQualifiedCount(firstLen);
      return firstLen;
    }

    // Fire remaining pages in parallel (up to 40 pages = 20,000 entries max)
    const offsets = [];
    for (let off = BATCH; off < 20000; off += BATCH) {
      offsets.push(off);
    }
    const pages = await Promise.all(
      offsets.map(offset =>
        attioQuery('/lists/old_2_6/entries/query', { limit: BATCH, offset })
          .then(data => (data.data || []).length)
          .catch(() => 0)
      )
    );

    let total = firstLen;
    for (const len of pages) {
      total += len;
      if (len < BATCH) break;
    }

    setCachedQualifiedCount(total);
    return total;
  } catch {
    return QUALIFIED_FALLBACK;
  }
}

function setCachedQualifiedCount(count) {
  try {
    localStorage.setItem(QUALIFIED_CACHE_KEY, JSON.stringify({ count, timestamp: Date.now() }));
  } catch { /* ignore */ }
}

// Fetch deal record names + owners in bulk using $in filter
// Returns Map<record_id, { name, ownerIds[] }>
// Batches record IDs into chunks of 50 and fetches in parallel
export async function fetchDealRecordNames(recordIds) {
  if (!recordIds.length) return new Map();

  const unique = [...new Set(recordIds)];
  const nameMap = new Map();
  const CHUNK = 25; // Keep chunks small to avoid rate limits

  // Split into chunks
  const chunks = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    chunks.push(unique.slice(i, i + CHUNK));
  }

  console.log(`[fetchDealRecordNames] ${unique.length} IDs → ${chunks.length} chunks`);

  // Fetch chunks sequentially to avoid rate limits on Netlify
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const res = await attioQuery('/objects/deals_2/records/query', {
        filter: { record_id: { $in: chunk } },
        limit: chunk.length,
      });
      const records = res.data || [];
      console.log(`[fetchDealRecordNames] Chunk ${i + 1}/${chunks.length}: got ${records.length} records`);
      for (const record of records) {
        const id = record.id?.record_id;
        if (!id) continue;
        const vals = record.values || {};
        const dealId = vals.deal_id?.[0]?.value || null;
        const ownerIds = (vals.owner || [])
          .map(o => o.referenced_actor_id || o.workspace_membership_id)
          .filter(Boolean);
        nameMap.set(id, { name: dealId, ownerIds });
      }
    } catch (err) {
      console.error(`[fetchDealRecordNames] Chunk ${i + 1} FAILED:`, err.message);
    }
  }

  console.log(`[fetchDealRecordNames] Total resolved: ${nameMap.size}/${unique.length}`);
  return nameMap;
}

// Update a single field on a coverage list entry (for toggling received/in_scope)
export async function updateListEntry(entryId, fieldSlug, value) {
  return attioQuery(`/lists/deal_coverage_6/entries/${entryId}`, {
    entry_values: { [fieldSlug]: [{ value }] },
  }, 'PUT');
}

// Helper: extract a value from a list entry's entry_values
export function getEntryValue(entry, slug) {
  const attr = entry?.entry_values?.[slug];
  if (!attr || !attr.length) return null;

  const val = attr[0];
  if (val.value !== undefined) return val.value;         // checkbox, text, number
  if (val.currency_value !== undefined) return val.currency_value; // currency (base unit, e.g. EUR)
  if (val.status) return val.status.title;
  if (val.option) return val.option.title;
  return val;
}

// Session cache: save processed deals so page refreshes are instant
export function getCachedDeals() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setCachedDeals(deals) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data: deals,
      timestamp: Date.now(),
    }));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// Coverage-specific session cache (separate from deals cache)
const COVERAGE_CACHE_KEY = 'attio-coverage-cache';

export function getCachedCoverage() {
  try {
    const raw = sessionStorage.getItem(COVERAGE_CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(COVERAGE_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setCachedCoverage(data) {
  try {
    sessionStorage.setItem(COVERAGE_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// Helper: extract a single attribute value from an Attio record
// Handles all Attio attribute types based on real API response format
export function getAttrValue(record, slug) {
  const attr = record?.values?.[slug];
  if (!attr || !attr.length) return null;

  const val = attr[0];

  // text, number, date, timestamp → .value
  if (val.value !== undefined) return val.value;
  // status → .status.title
  if (val.status) return val.status.title;
  // select → .option.title
  if (val.option) return val.option.title;
  // record-reference → .target_record_id
  if (val.target_record_id) return val.target_record_id;
  // domain → .domain
  if (val.domain !== undefined) return val.domain;
  // location → return the whole location object (has .country_code, .locality, etc.)
  if (val.country_code !== undefined) return val;
  // currency → .currency_value (base unit, e.g. EUR)
  if (val.currency_value !== undefined) return val.currency_value;
  // full name (person) → .full_name
  if (val.full_name !== undefined) return val.full_name;

  return val;
}

// Helper: extract the country code from a location attribute
export function getLocationCountryCode(record, slug) {
  const attr = record?.values?.[slug];
  if (!attr || !attr.length) return null;
  return attr[0].country_code || null;
}

// Deal funnel session cache
const DEAL_FUNNEL_CACHE_KEY = 'attio-deal-funnel-cache-v2'; // v2: names resolved

export function getCachedDealFunnel() {
  try {
    const raw = sessionStorage.getItem(DEAL_FUNNEL_CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(DEAL_FUNNEL_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setCachedDealFunnel(data) {
  try {
    sessionStorage.setItem(DEAL_FUNNEL_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

// Helper: extract all values for a multi-value attribute (e.g. categories, tags)
export function getAttrValues(record, slug) {
  const attr = record?.values?.[slug];
  if (!attr || !attr.length) return [];
  return attr.map(v => {
    if (v.option) return v.option.title;
    if (v.status) return v.status.title;
    if (v.value !== undefined) return v.value;
    return v;
  });
}
