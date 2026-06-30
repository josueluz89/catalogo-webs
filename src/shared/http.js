const FETCH_TIMEOUT = 15000;

export async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options.headers,
      },
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, options = {}, timeout = FETCH_TIMEOUT) {
  const res = await fetchWithTimeout(url, options, timeout);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

export async function fetchJson(url, options = {}, timeout = FETCH_TIMEOUT) {
  const raw = await fetchText(url, options, timeout);
  return JSON.parse(raw);
}

export async function fetchWithRetry(url, options = {}, retries = 2, timeout = FETCH_TIMEOUT) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchText(url, options, timeout);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
