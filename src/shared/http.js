const FETCH_TIMEOUT = 15000;

function fetchWithTimeout(url, options, timeout) {
  if (!options) options = {};
  var headers = Object.assign({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers: headers, redirect: 'follow' }));
}

function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout)
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.text();
    });
}

function fetchJson(url, options, timeout) {
  return fetchText(url, options, timeout)
    .then(function(raw) { return JSON.parse(raw); });
}

function fetchWithRetry(url, options, retries, timeout) {
  if (!retries) retries = 2;
  return fetchText(url, options, timeout)
    .catch(function(e) {
      if (retries <= 0) throw e;
      return new Promise(function(r) { setTimeout(r, 1000); })
        .then(function() { return fetchWithRetry(url, options, retries - 1, timeout); });
    });
}

export { fetchWithTimeout, fetchText, fetchJson, fetchWithRetry };
