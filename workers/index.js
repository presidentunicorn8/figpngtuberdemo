const SUPABASE_URL = 'https://jiosqsebvezruvhnyplv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_N-vBuDo54MrJfLygIacYVA_TibdMxis';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const cb = url.searchParams.get('cb');

    // CORS headers for safety
    const baseHeaders = {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
    };

    // GET: fetch 24h poke count
    if (action === 'count') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/pokes?select=id&created_at=gte.${since}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'count=exact',
            Range: '0-0',
          },
        }
      );
      const contentRange = res.headers.get('content-range');
      let count = 0;
      if (contentRange && contentRange.includes('/')) {
        count = parseInt(contentRange.split('/')[1], 10) || 0;
      }
      return new Response(`${cb}(${count})`, { headers: baseHeaders });
    }

    // GET: record a poke (called via script tag, so must be GET)
    if (action === 'poke') {
      await fetch(`${SUPABASE_URL}/rest/v1/pokes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ created_at: new Date().toISOString() }),
      });
      return new Response(`${cb}("ok")`, { headers: baseHeaders });
    }

    return new Response(`${cb || 'console.log'}("unknown action")`, {
      status: 400,
      headers: baseHeaders,
    });
  },
};
