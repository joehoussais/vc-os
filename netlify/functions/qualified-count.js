// Netlify serverless function: counts entries in the Proactive Sourcing list (old_2_6).
// Does all pagination server-side and returns just the count.
// The list has 15,000+ entries — this avoids 30+ round trips from the browser.

const ATTIO_API_BASE = 'https://api.attio.com/v2';
const BATCH = 500;

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
    let total = 0;
    let offset = 0;

    while (true) {
      const payload = { limit: BATCH };
      if (offset > 0) payload.offset = offset;

      const res = await fetch(`${ATTIO_API_BASE}/lists/old_2_6/entries/query`, {
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

      const data = await res.json();
      const batch = data.data || [];
      total += batch.length;

      if (batch.length < BATCH) break;
      offset += BATCH;
    }

    return new Response(JSON.stringify({ count: total }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // 1h CDN cache — this barely changes
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
  path: '/api/qualified-count',
};
