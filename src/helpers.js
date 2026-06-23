const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function fetchPage(url, referer = '') {
  try {
    const res = await axios.get(url, {
      httpsAgent,
      headers: {
        'User-Agent': UA,
        'Referer': referer || 'https://lacartoons.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch (err) {
    console.log(`[Helpers] Error fetching ${url}: ${err.message}`);
    return '';
  }
}

module.exports = { fetchPage, httpsAgent, UA };
