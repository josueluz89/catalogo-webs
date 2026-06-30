export { fetchWithTimeout, fetchText, fetchJson, fetchWithRetry } from '../shared/http.js';

export const PROTECTION_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3',
  'Sec-GPC': '1',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Priority': 'u=0, i',
  'Te': 'trailers',
};
