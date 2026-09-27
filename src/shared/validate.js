/**
 * Link validation for Nuvio providers.
 *
 * Guarantees that getStreams() only returns streams whose URLs actually
 * respond. Every candidate URL is probed with a ranged GET carrying the
 * stream's own headers (Referer/Origin/User-Agent), which these hosts
 * require. Dead links (4xx/5xx, network errors, timeouts) are dropped,
 * survivors are de-duplicated and sorted by quality (best first) so Nuvio
 * tries the best working link first.
 *
 * QuickJS-safe: works without setTimeout/AbortController (degrades to a
 * plain fetch; the app-level timeout still applies).
 */

var VALIDATE_TIMEOUT_MS = 7000;
var VALIDATE_CONCURRENCY = 4;

function qualityRank(q) {
  if (!q) return 0;
  var s = String(q).toLowerCase();
  if (s.indexOf('4k') !== -1 || s.indexOf('2160') !== -1) return 2160;
  var m = s.match(/(\d{3,4})\s*p/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

function isM3u8(url) {
  return /\.m3u8(\?|#|$)/i.test(url || '');
}

// Probe one URL. Resolves true only if the host answers with usable content.
function checkUrl(url, headers, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = null;
    var controller = null;

    function finish(ok) {
      if (done) return;
      done = true;
      if (timer) {
        try { clearTimeout(timer); } catch (e) {}
        timer = null;
      }
      if (controller) {
        try { controller.abort(); } catch (e) {}
      }
      resolve(!!ok);
    }

    if (!url || typeof url !== 'string' || url.indexOf('http') !== 0) {
      resolve(false);
      return;
    }

    if (typeof setTimeout !== 'undefined') {
      timer = setTimeout(function () {
        timer = null;
        finish(false);
      }, timeoutMs || VALIDATE_TIMEOUT_MS);
    }

    var reqHeaders = {
      'Range': 'bytes=0-2047',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (headers) {
      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k) && headers[k]) {
          reqHeaders[k] = headers[k];
        }
      }
    }

    var reqInit = { headers: reqHeaders, redirect: 'follow' };
    try {
      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        reqInit.signal = controller.signal;
      }
    } catch (e) {
      controller = null;
    }

    fetch(url, reqInit).then(function (res) {
      var status = res.status;
      // 2xx or 416 (range not satisfiable => server is alive) means reachable.
      // 3xx never surfaces here (fetch follows redirects).
      if (status === 200 || status === 206 || status === 416) {
        if (isM3u8(url)) {
          // Confirm it is really a playlist, not an error page.
          res.text().then(function (t) {
            finish(t && t.indexOf('#EXTM3U') !== -1);
          }).catch(function () {
            finish(true);
          });
        } else {
          finish(true);
        }
      } else {
        finish(false);
      }
    }).catch(function () {
      finish(false);
    });
  });
}

// Filter a stream list down to working links only.
// Never throws: on any internal error it returns the input list untouched
// rather than breaking the provider.
export function filterWorkingStreams(streams, opts) {
  opts = opts || {};
  var timeout = opts.timeoutMs || VALIDATE_TIMEOUT_MS;
  var concurrency = opts.concurrency || VALIDATE_CONCURRENCY;

  var seen = {};
  var uniq = [];
  (streams || []).forEach(function (s) {
    if (!s || !s.url || seen[s.url]) return;
    seen[s.url] = 1;
    uniq.push(s);
  });
  if (uniq.length === 0) return Promise.resolve([]);

  var results = new Array(uniq.length);
  var cursor = 0;

  function worker() {
    if (cursor >= uniq.length) return Promise.resolve();
    var i = cursor++;
    var st = uniq[i];
    return checkUrl(st.url, st.headers, timeout).then(function (ok) {
      results[i] = ok ? st : null;
    }).catch(function () {
      results[i] = null;
    }).then(worker);
  }

  var workers = [];
  var n = Math.min(concurrency, uniq.length);
  for (var w = 0; w < n; w++) workers.push(worker());

  return Promise.all(workers).then(function () {
    var alive = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i]) alive.push(results[i]);
    }
    alive.sort(function (a, b) {
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
    return alive;
  }).catch(function () {
    // Last-resort: never break the provider because of validation.
    return uniq;
  });
}

// Convenience: wrap a provider's extractStreams so Nuvio only ever sees
// functional links, best quality first.
export function withWorkingStreams(extractPromise) {
  return Promise.resolve(extractPromise)
    .then(function (streams) { return filterWorkingStreams(streams); })
    .catch(function () { return []; });
}
