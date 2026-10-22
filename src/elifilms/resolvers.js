// resolvers.js — resolvedores de embeds portados a QuickJS (elifilms).
//
// Frente al original (latinuvio/providers/elifilms.js):
//  - `new URL(...)` desaparece (URL no existe en el runtime): origen/host/ruta se sacan con regex.
//  - El barrido de espejos de StreamWish ya no usa forEach(async) + Promise + setTimeout (con el
//    que el provider se colgaba sin resolver): ahora es secuencial, con presupuesto de tiempo y
//    sin depender de ningún timer.
//  - Se retiran los resolvedores que hoy no pueden dar nada, medidos antes de tocar el código:
//      · GoodStream: goodstream.one responde HTTP 522 a los ~20 s (y el reintento del original
//        lo repetía 3 veces = ~60 s, todo el presupuesto del reproductor).
//      · FileMoon: /api/videos/<id>/embed/details responde 404.
//      · DoodStream / StreamTape / Waaw / OkRu: no aparecen en ningún embed de este sitio.
//    Se conservan los cuatro que sí devuelven m3u8 hoy: StreamWish, VidHide, VOE y Vimeos.

import { fetchText } from '../shared/http.js';

export var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Reemplazo de `new URL(url)`: devuelve {protocolo, host, origin, ruta}.
export function partesDeUrl(u) {
  var s = String(u || '');
  var m = s.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^\/?#]+)([^?#]*)/);
  if (!m) return { protocolo: '', host: '', origin: '', ruta: '' };
  var proto = m[1].toLowerCase();
  var host = m[2].toLowerCase();
  return { protocolo: proto, host: host, origin: proto + '://' + host, ruta: m[3] || '/' };
}

// Base64 en JS puro (el contrato pide no asumir atob/btoa).
export function localAtob(input) {
  if (!input) return '';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(input).replace(/=+$/, '').replace(/[\s\n\r\t]/g, '');
  var output = '';
  if (str.length % 4 === 1) return '';
  for (var bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> (-2 * bc & 6)))) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

// Unpacker "eval(function(p,a,c,k,e,r)…)" de Dean Edwards, sin eval(): se resuelve el diccionario.
function unpackEval(payload, radix, symtab) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return payload.replace(/\b([0-9a-zA-Z]+)\b/g, function (match) {
    var idx = 0;
    for (var i = 0; i < match.length; i++) {
      var pos = chars.indexOf(match[i]);
      if (pos === -1) return match;
      idx = idx * radix + pos;
    }
    if (isNaN(idx) || idx >= symtab.length) return match;
    return symtab[idx] && symtab[idx] !== '' ? symtab[idx] : match;
  });
}

function desempacar(script) {
  try {
    var m = String(script || '').match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
    if (!m) return null;
    return unpackEval(m[1], parseInt(m[2], 10), m[4].split('|'));
  } catch (e) {
    return null;
  }
}

// Los CDN de la familia vimeos rechazan el Referer (el original los borraba al final).
export function limpiarCabecerasVimeos(url, cabeceras) {
  var limpio = {};
  var keys = Object.keys(cabeceras || {});
  for (var i = 0; i < keys.length; i++) {
    if (!/^(referer|origin)$/i.test(keys[i])) limpio[keys[i]] = cabeceras[keys[i]];
  }
  return limpio;
}

// ── StreamWish ────────────────────────────────────────────────────────────────
// El origen rota de dominio a cada rato; el file_code se mantiene. Se prueban los espejos
// que hoy responden y se para en cuanto uno da el m3u8.
var ESPEJOS_WISH = [
  'https://hanerix.com/e/',
  'https://embedwish.com/e/'
];

async function resolverStreamwish(embedUrl, vencido) {
  try {
    var rawId = String(embedUrl).split('?')[0].split('/').pop().replace(/\.html$/, '');
    if (!rawId) return null;
    var mirrors = [];
    for (var i = 0; i < ESPEJOS_WISH.length; i++) mirrors.push(ESPEJOS_WISH[i] + rawId);
    mirrors.push(embedUrl);

    for (var j = 0; j < mirrors.length; j++) {
      if (vencido()) return null;
      var mirror = mirrors[j];
      var origen = partesDeUrl(mirror).origin;
      try {
        var html = await fetchText(mirror, { headers: { 'Referer': mirror, 'User-Agent': USER_AGENT } });
        if (!html || html.length < 500 || html.indexOf('__vite_is_modern_browser') !== -1) continue;

        var m3u8Url = null;
        var hashMatch = html.match(/[0-9a-f]{32}/i);
        if (hashMatch && !vencido()) {
          var dlUrl = origen + '/dl?op=view&file_code=' + rawId + '&hash=' + hashMatch[0] + '&embed=1&referer=&adb=1&hls4=1';
          try {
            var dlText = await fetchText(dlUrl, {
              headers: { 'User-Agent': USER_AGENT, 'Referer': mirror, 'X-Requested-With': 'XMLHttpRequest' }
            });
            var mDl = dlText ? dlText.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/) : null;
            if (mDl) m3u8Url = mDl[0];
          } catch (e) {}
        }
        if (!m3u8Url) {
          var packed = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('[\s\S]+?',\s*\d+,\s*\d+,\s*'[\s\S]+?'\.split\('\|'\)/);
          if (packed) {
            var des = desempacar(packed[0]);
            if (des) {
              var mDes = des.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
              if (mDes) m3u8Url = mDes[0];
            }
          }
        }
        if (!m3u8Url) {
          var fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
          if (fileMatch) m3u8Url = fileMatch[1];
        }
        if (!m3u8Url) {
          var bare = html.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
          if (bare) m3u8Url = bare[0];
        }
        if (m3u8Url) {
          m3u8Url = m3u8Url.replace(/\\/g, '');
          if (m3u8Url.charAt(0) === '/') m3u8Url = origen + m3u8Url;
          return {
            url: m3u8Url,
            server: 'StreamWish',
            quality: '1080p',
            headers: { 'Referer': mirror, 'Origin': origen, 'User-Agent': USER_AGENT }
          };
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

// ── VidHide ───────────────────────────────────────────────────────────────────
async function resolverVidhide(embedUrl, vencido) {
  try {
    var origin = partesDeUrl(embedUrl).origin;
    var html = await fetchText(embedUrl, { headers: { 'User-Agent': USER_AGENT, 'Referer': origin + '/' } });
    var finalUrl = null;
    var packedMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
    if (packedMatch) {
      var des = desempacar(packedMatch[0]);
      if (des) {
        var hlsMatch = des.match(/"hls[24]"\s*:\s*"([^"]+)"/);
        if (hlsMatch) finalUrl = hlsMatch[1];
        if (!finalUrl) {
          var m3 = des.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/i);
          if (m3) finalUrl = m3[0];
        }
      }
    }
    if (!finalUrl) {
      var rawMatch = html.match(/"hls[24]"\s*:\s*"([^"]+)"/)
        || html.match(/file\s*:\s*["']([^"']+)["']/i)
        || html.match(/["'](https?:\/\/[^\s"']+?\/stream\/[^\s"']+?\.m3u8[^\s"']*)["']/i);
      if (rawMatch) finalUrl = rawMatch[1];
    }
    if (!finalUrl) return null;
    if (finalUrl.indexOf('http') !== 0) finalUrl = origin + finalUrl;
    return {
      url: finalUrl,
      server: 'VidHide',
      quality: '1080p',
      headers: { 'User-Agent': USER_AGENT, 'Referer': origin + '/', 'Origin': origin, 'X-Requested-With': 'XMLHttpRequest' }
    };
  } catch (e) {
    return null;
  }
}

// ── VOE ───────────────────────────────────────────────────────────────────────
// Cadena del original: ROT13 de los caracteres ASCII → quitar separadores → base64 → +3 → invertir
// → base64 → JSON con `source`.
async function resolverVoe(embedUrl, vencido) {
  try {
    var html = await fetchText(embedUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (html.indexOf('window.location.href') !== -1 && html.length < 2000) {
      var rm = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
      if (rm) {
        try {
          var next = await fetchText(rm[1], { headers: { 'User-Agent': USER_AGENT } });
          if (next) html = next;
        } catch (e) {}
      }
    }
    var jsonMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[1].trim());
        var encText = Array.isArray(parsed) ? parsed[0] : parsed;
        if (typeof encText === 'string') {
          var decoded = encText.replace(/[a-zA-Z]/g, function (c) {
            var code = c.charCodeAt(0);
            var limit = c <= 'Z' ? 90 : 122;
            var shifted = code + 13;
            return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
          });
          var ruido = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];
          for (var i = 0; i < ruido.length; i++) decoded = decoded.split(ruido[i]).join('');
          var b64_1 = localAtob(decoded);
          if (b64_1) {
            var shifted2 = '';
            for (var j = 0; j < b64_1.length; j++) shifted2 += String.fromCharCode(b64_1.charCodeAt(j) - 3);
            var reversed = shifted2.split('').reverse().join('');
            var decrypted = localAtob(reversed);
            if (decrypted) {
              var data = JSON.parse(decrypted);
              if (data && data.source) {
                return {
                  url: data.source,
                  server: 'VOE',
                  quality: '1080p',
                  headers: { 'User-Agent': USER_AGENT, 'Referer': embedUrl }
                };
              }
            }
          }
        }
      } catch (e) {}
    }
    var m3 = html.match(/["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i);
    if (m3) return { url: m3[1], server: 'VOE', quality: '1080p', headers: { 'Referer': embedUrl, 'User-Agent': USER_AGENT } };
  } catch (e) {}
  return null;
}

// ── Vimeos (Vimeo) ────────────────────────────────────────────────────────────
async function resolverVimeos(embedUrl, vencido) {
  try {
    var html = await fetchText(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://vimeos.net/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8'
      }
    });
    var vimeoIdMatch = html.match(/vimeo\.com\/video\/(\d+)/i);
    if (!vimeoIdMatch) vimeoIdMatch = String(embedUrl).match(/\/(\d{7,10})/);
    if (vimeoIdMatch && !vencido()) {
      var vimeoId = vimeoIdMatch[1];
      try {
        var config = await fetchText('https://player.vimeo.com/video/' + vimeoId + '/config', {
          headers: { 'User-Agent': USER_AGENT, 'Referer': embedUrl }
        });
        if (config) {
          var cfg = JSON.parse(config);
          var hlsUrl = null;
          if (cfg && cfg.request && cfg.request.files && cfg.request.files.hls && cfg.request.files.hls.cdns && cfg.request.files.hls.cdns.default) {
            hlsUrl = cfg.request.files.hls.cdns.default.url;
          }
          if (hlsUrl) {
            return {
              url: hlsUrl,
              server: 'Vimeos',
              quality: '1080p',
              headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://player.vimeo.com/', 'Accept-Language': 'es-MX,es;q=0.9' }
            };
          }
          var progressive = cfg && cfg.request && cfg.request.files ? cfg.request.files.progressive : null;
          if (progressive && progressive.length > 0) {
            progressive.sort(function (a, b) { return (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0); });
            var best = progressive[0];
            return {
              url: best.url,
              server: 'Vimeos',
              quality: best.quality ? best.quality + 'p' : '1080p',
              headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://player.vimeo.com/', 'Accept-Language': 'es-MX,es;q=0.9' }
            };
          }
        }
      } catch (e) {}
    }
    var packMatch = html.match(/eval\(function\(p,a,c,k,e,[dr]\)\{[\s\S]+?\}\('([\s\S]+?)',(\d+),(\d+),'([\s\S]+?)'\.split\('\|'\)/);
    if (packMatch) {
      var radix = parseInt(packMatch[2], 10);
      var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var symtab = packMatch[4].split('|');
      var unpacked = packMatch[1].replace(/\b(\w+)\b/g, function (match) {
        var idx = 0;
        for (var i = 0; i < match.length; i++) idx = idx * radix + chars.indexOf(match[i]);
        return symtab[idx] && symtab[idx] !== '' ? symtab[idx] : match;
      });
      var m3u8Match = unpacked.match(/["']([^"']+\.m3u8[^"']*)['"]/i);
      if (m3u8Match) {
        return {
          url: m3u8Match[1],
          server: 'Vimeos',
          quality: '1080p',
          headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://vimeos.net/', 'Accept-Language': 'es-MX,es;q=0.9' }
        };
      }
    }
  } catch (e) {}
  return null;
}

// ── Router ────────────────────────────────────────────────────────────────────
var MIRRORS = {
  STREAMWISH: ['hlswish', 'streamwish', 'hglink', 'hglamioz', 'audinifer', 'embedwish', 'awish', 'dwish', 'strwish', 'wishembed', 'wishfast', 'hanerix', 'sfastwish', 'jodwish', 'swhoi', 'swdyu', 'playerwish', 'filelions'],
  VIDHIDE: ['vidhide', 'minochinos', 'vadisov', 'vaiditv', 'amusemre', 'callistanise', 'vhaudm', 'mdfury', 'dintezuvio', 'acek-cdn', 'vedonm', 'vidhidepro', 'vidhidevip', 'masukestin'],
  VOE: ['voe.sx', 'voe-sx', 'voex.sx', 'marissashare', 'cloudwindow'],
  VIMEOS: ['vimeos.net', 'vimeos.cc', 'vimeos.zip', 'vms.sh']
};

function esEspejo(url, grupo) {
  var u = String(url || '').toLowerCase();
  var lista = MIRRORS[grupo] || [];
  for (var i = 0; i < lista.length; i++) {
    if (u.indexOf(lista[i]) !== -1) return true;
  }
  return false;
}

export async function resolverEmbed(url, vencido) {
  try {
    if (esEspejo(url, 'VIDHIDE')) return await resolverVidhide(url, vencido);
    if (esEspejo(url, 'STREAMWISH')) return await resolverStreamwish(url, vencido);
    if (esEspejo(url, 'VOE')) return await resolverVoe(url, vencido);
    if (esEspejo(url, 'VIMEOS')) return await resolverVimeos(url, vencido);
  } catch (e) {}
  return null;
}
