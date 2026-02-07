// Netlify serverless function: fetches deal flow entries from Attio,
// strips heavy fields (email_content etc.) server-side, and returns
// only the lightweight fields the client needs.
// This avoids sending megabytes of email bodies to the browser.

const ATTIO_API_BASE = 'https://api.attio.com/v2';
const BATCH = 500;

// Helper: extract a value from entry_values
function getVal(entry, slug) {
  const attr = entry?.entry_values?.[slug];
  if (!attr || !attr.length) return null;
  const val = attr[0];
  if (val.value !== undefined) return val.value;
  if (val.currency_value !== undefined) return val.currency_value;
  if (val.status) return val.status.title;
  if (val.option) return val.option.title;
  return null;
}

// Helper: extract source workspace_membership_id
function getSourceWsId(entry) {
  const attr = entry?.entry_values?.source;
  if (!attr || !attr.length) return null;
  return attr[0]?.referenced_actor_id || attr[0]?.workspace_membership_id || null;
}

async function attioFetch(apiKey, endpoint, payload = {}) {
  const res = await fetch(`${ATTIO_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Attio API error: ${res.status}`);
  }
  return res.json();
}

export default async (req) => {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ATTIO_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Paginate through all deal flow entries
    let allDeals = [];
    let offset = 0;

    while (true) {
      const payload = { limit: BATCH };
      if (offset > 0) payload.offset = offset;

      const data = await attioFetch(apiKey, '/lists/deal_flow_4/entries/query', payload);
      const batch = data.data || [];

      // Extract only the fields the client needs — drop email_content, reasons, etc.
      for (const entry of batch) {
        allDeals.push({
          entry_id: entry.entry_id,
          record_id: entry.parent_record?.record_id || null,
          satus: getVal(entry, 'satus'),
          max_status_5: getVal(entry, 'max_status_5'),
          source_type_8: getVal(entry, 'source_type_8'),
          amount_in_meu: getVal(entry, 'amount_in_meu'),
          founding_team: getVal(entry, 'founding_team'),
          created_at: getVal(entry, 'created_at'),
          source_ws_id: getSourceWsId(entry),
        });
      }

      if (batch.length < BATCH) break;
      offset += BATCH;
    }

    return new Response(JSON.stringify({ deals: allDeals, total: allDeals.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 min CDN cache
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/deal-funnel',
};
