// Netlify serverless function to proxy Attio API requests
// This keeps the API key server-side and not exposed in the browser

const ATTIO_API_BASE = 'https://api.attio.com/v2';

export default async (req) => {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ATTIO_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only allow POST requests (Attio list endpoints use POST)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { endpoint, payload, method } = body;
    const httpMethod = method || 'POST';

    // Whitelist allowed endpoints to prevent abuse
    const allowedReadEndpoints = [
      '/objects/deals_2/records/query',
      '/objects/companies/records/query',
      '/objects/lp/records/query',
      '/lists/deal_coverage_6/entries/query',
      '/objects/people/records/query',
    ];

    // Write endpoints use regex: only allow updating deal_coverage_6 entries
    const writePattern = /^\/lists\/deal_coverage_6\/entries\/[a-f0-9-]{36}$/;

    if (httpMethod === 'POST') {
      if (!allowedReadEndpoints.includes(endpoint)) {
        return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (httpMethod === 'PUT' || httpMethod === 'PATCH') {
      if (!writePattern.test(endpoint)) {
        return new Response(JSON.stringify({ error: 'Write endpoint not allowed' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(`${ATTIO_API_BASE}${endpoint}`, {
      method: httpMethod,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/attio',
};
