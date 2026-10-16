// henaojara — resolver de familia vidhide/streamwish inlineado.
// Los hosts con rotacion de dominio de HenaoJara (dhcplay, filelions, streamwish,
// dramiyos, ...) publican la playlist en `links = {hls4: ...}` (a veces dentro de un
// eval(...) empaquetado de Dean Edwards). Este modulo no depende de Nuvio ni de
// modulos externos (ni Buffer, ni atob, ni matchAll).
//
// Portado a MasterScrap desde latinuvio (providers/embed69.js, providers/cdn_resolvers.js),
// autor original Latinuvio.

import { fetchText } from '../shared/http.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function originOf(url) {
  var m = String(url || '').match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : '';
}

function unpackPacked(html) {
  try {
    var pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch) return null;
    var p = pMatch[1];
    var a = parseInt(pMatch[2], 10);
    var k = pMatch[4].split('|');
    var symbols = '0123456789abcdefghijklmnopqrstuvwxyz';
    function decodeBase36(num, rad) {
      var res = '';
      while (num > 0) { res = symbols[num % rad] + res; num = Math.floor(num / rad); }
      return res || '0';
    }
    return p.replace(/\b\w+\b/g, function (w) {
      var idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}

function extractCandidates(html) {
  var text = html;
  var up = unpackPacked(html);
  if (up) text = up;

  var candidates = [];
  var seen = {};
  function push(u) {
    if (!u || typeof u !== 'string') return;
    var v = u.replace(/\\\//g, '/').replace(/\\"/g, '"').trim();
    if (v && seen[v] !== true) {
      seen[v] = true;
      candidates.push(v);
    }
  }

  var m = text.match(/links\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) {
    var obj = null;
    try { obj = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\'/g, "'")); } catch (e) { obj = null; }
    if (obj) {
      var keys = Object.keys(obj);
      var order = [];
      var prefer = ['hls4', 'hls3', 'hls2', 'hls1', 'hls'];
      for (var i = 0; i < prefer.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].toLowerCase().indexOf(prefer[i]) !== -1) order.push(keys[j]);
        }
      }
      for (var q = 0; q < keys.length; q++) {
        if (order.indexOf(keys[q]) === -1) order.push(keys[q]);
      }
      var used = {};
      for (var o = 0; o < order.length; o++) {
        var k2 = order[o];
        if (used[k2]) continue;
        used[k2] = true;
        var val = obj[k2];
        if (typeof val === 'string' && /\.m3u8|master\.txt|urlset/.test(val)) push(val);
      }
    }
  }

  var re = /(?:file|src)\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/gi;
  var mm;
  while ((mm = re.exec(text)) !== null) push(mm[1]);

  var reAbs = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|txt)[^\s"'<>\\]*/gi;
  while ((mm = reAbs.exec(text)) !== null) push(mm[0]);

  return candidates;
}

var VIDHIDE_HOSTS = ['vidhide', 'dintezuvio', 'minochinos', 'dramiyos', 'dhcplay', 'smoothpre', 'dhtpre',
  'vidspeeder', 'moorearn', 'travid', 'vidhidehub', 'vidhidevip', 'vidhidepre', 'kinoger', 'movearnpre',
  'peytonepre', 'filelions', 'callistanise', 'morencius'];
var STREAMWISH_HOSTS = ['hlswish', 'streamwish', 'vibuxer', 'strwish', 'hglink', 'ghbrisk', 'premilkyway', 'hgplaycdn'];

function familiaDe(url) {
  var u = String(url || '').toLowerCase();
  for (var i = 0; i < VIDHIDE_HOSTS.length; i++) if (u.indexOf(VIDHIDE_HOSTS[i]) !== -1) return 'vidhide';
  for (var j = 0; j < STREAMWISH_HOSTS.length; j++) if (u.indexOf(STREAMWISH_HOSTS[j]) !== -1) return 'streamwish';
  return null;
}

function rewriteHost(url) {
  return String(url || '')
    .replace(/`/g, '')
    .replace(/^(https?:\/\/)(?:www\.)?hglink\.to(\/|$)/i, '$1vibuxer.com$2')
    .replace(/^(https?:\/\/)(?:www\.)?filelions\.to(\/|$)/i, '$1callistanise.com$2');
}

function normalizeVidhideUrl(url) {
  var u = String(url || '');
  if (u.indexOf('/embed/') !== -1) return u;
  var m = u.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1] + '/embed/' + m[2];
  return u;
}

// Devuelve {url, quality, headers} o null.
function resolverFamilia(embedUrl, familia) {
  var target = rewriteHost(embedUrl);
  if (familia === 'vidhide') target = normalizeVidhideUrl(target);
  var origin = originOf(target);
  return fetchText(target, { headers: { Referer: 'https://embed69.org/', Origin: 'https://embed69.org', 'User-Agent': UA } }, 12000)
    .then(function (html) {
      var candidates = extractCandidates(html);
      if (!candidates.length) {
        var iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
        if (!iframe) return null;
        var iu = iframe[1];
        if (iu.indexOf('//') === 0) iu = 'https:' + iu;
        else if (iu.indexOf('/') === 0) iu = origin + iu;
        return fetchText(iu, { headers: { Referer: target, 'User-Agent': UA } }, 12000)
          .then(function (h2) { return extractCandidates(h2); })
          .catch(function () { return []; });
      }
      return candidates;
    })
    .then(function (candidates) {
      if (!candidates || !candidates.length) return null;
      var url = candidates[0];
      if (url.indexOf('//') === 0) url = 'https:' + url;
      else if (url.indexOf('/') === 0) url = origin + url;
      else if (url.indexOf('http') !== 0) url = origin + '/' + url;
      var qm = url.match(/[_-](\d{3,4})p/i);
      var labels = url.match(/_,([a-z,]+),\.urlset/);
      var quality = qm ? qm[1] + 'p' : 'HD';
      if (!qm && labels && labels[1].indexOf('x') !== -1) quality = '1080p';
      return { url: url, quality: quality, headers: { 'User-Agent': UA, Referer: origin + '/', Origin: origin } };
    })
    .catch(function () { return null; });
}

export { familiaDe, resolverFamilia, originOf };
