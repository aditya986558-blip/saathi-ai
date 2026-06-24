// api/suggest.js — Autocomplete proxy with fallback chain
// Layer 1: Google Suggest
// Layer 2: DuckDuckGo Autocomplete
// Layer 3: Empty array (index.html fallback handle karega)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = (req.query.q || '').trim();
  const hl = req.query.hl === 'hi' ? 'hi' : 'en';
  if (!q || q.length < 2) return res.status(200).json([]);

  // Helper: fetch with timeout (AbortController — Node 16+ compatible)
  async function fetchWithTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(timer);
      return r;
    } catch(e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // Layer 1: Google Suggest
  try {
    const googleUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}&hl=${hl}&gl=in`;
    const r = await fetchWithTimeout(googleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' }
    }, 2500);
    if (r.ok) {
      const data = await r.json();
      const suggestions = Array.isArray(data[1]) ? data[1].filter(s => typeof s === 'string').slice(0, 5) : [];
      if (suggestions.length) return res.status(200).json(suggestions);
    }
  } catch(e) {}

  // Layer 2: DuckDuckGo Autocomplete
  try {
    const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&kl=in-en`;
    const r = await fetchWithTimeout(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' }
    }, 2500);
    if (r.ok) {
      const data = await r.json();
      const suggestions = Array.isArray(data)
        ? data.slice(0, 5).map(item => typeof item === 'string' ? item : item.phrase).filter(Boolean)
        : [];
      if (suggestions.length) return res.status(200).json(suggestions);
    }
  } catch(e) {}

  // Layer 3: dono fail
  return res.status(200).json([]);
};
