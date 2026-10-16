// Resolvers de embeds de vimeus.com: voe.sx, vidhide/ds2play, streamwish,
// ok.ru, filemoon, goodstream, vimeos.net.
//
// Portado del provider original (nuvio-providers-latino-v2). Diferencias con el
// original: no usa new URL (no existe en QuickJS) ni Buffer; todo pasa por
// util.js. Los que no se pueden resolver devuelven null (nunca lanzan).

import { UA, urlOrigen, urlAbsoluta, pedirTexto, base64Decodificar, desempacar } from './util.js';

function resolverVoe(embedUrl) {
  return pedirTexto(embedUrl, { Referer: embedUrl })
    .then(function (data) {
      console.log('[Vimeus:VOE] Resolviendo: ' + embedUrl);
      if (/permanentToken/i.test(data)) {
        var redir = data.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (redir) {
          return pedirTexto(redir[1], { Referer: embedUrl }).then(function (d2) {
            return decodificarVoe(d2, embedUrl);
          });
        }
      }
      return decodificarVoe(data, embedUrl);
    })
    .catch(function (e) {
      console.log('[Vimeus:VOE] Error: ' + (e && e.message));
      return null;
    });
}

function decodificarVoe(data, embedUrl) {
  var rMain = data.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
  if (rMain) {
    var encodedArray = rMain[1];
    var loaderUrl = urlAbsoluta(rMain[2], embedUrl);
    return pedirTexto(loaderUrl, { Referer: embedUrl })
      .then(function (jsData) {
        var replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (replMatch) {
          var decoded = voeDecode(encodedArray, replMatch[1]);
          if (decoded && (decoded.source || decoded.direct_access_url)) {
            var url = decoded.source || decoded.direct_access_url;
            console.log('[Vimeus:VOE] URL encontrada: ' + url.substring(0, 80));
            return { url: url, quality: '1080p', headers: { 'User-Agent': UA, Referer: embedUrl, Origin: urlOrigen(embedUrl) } };
          }
        }
        return voeFallback(data, embedUrl);
      })
      .catch(function () { return voeFallback(data, embedUrl); });
  }
  return voeFallback(data, embedUrl);
}

// Plan B: pares mp4/hls '...' (algunos con la URL en base64 que empieza por aHR0).
function voeFallback(data, embedUrl) {
  var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
  var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
  var matches = [];
  var m;
  while ((m = re1.exec(data)) !== null) matches.push(m[1]);
  while ((m = re2.exec(data)) !== null) matches.push(m[1]);
  var i;
  for (i = 0; i < matches.length; i++) {
    var candidato = matches[i];
    if (!candidato) continue;
    var url = candidato;
    if (url.indexOf('aHR0') === 0) {
      var dec = base64Decodificar(url);
      if (dec) url = dec;
    }
    console.log('[Vimeus:VOE] URL encontrada (fallback): ' + url.substring(0, 80));
    return { url: url, quality: '720p', headers: { 'User-Agent': UA, Referer: embedUrl, Origin: urlOrigen(embedUrl) } };
  }
  console.log('[Vimeus:VOE] No se encontro URL');
  return null;
}

// VOE: ROT13 + quitar ruido + base64 -> desplazar -3 -> invertir -> base64 -> JSON.
function voeDecode(ct, luts) {
  try {
    var rawLuts = luts.replace(/^\[|\]$/g, '').split("','");
    var escapadas = [];
    var i, ch;
    for (i = 0; i < rawLuts.length; i++) {
      var limpio = rawLuts[i].replace(/^'+|'+$/g, '');
      escapadas.push(limpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    var txt = '';
    for (i = 0; i < ct.length; i++) {
      ch = ct.charCodeAt(i);
      if (ch > 64 && ch < 91) ch = (ch - 52) % 26 + 65;
      else if (ch > 96 && ch < 123) ch = (ch - 84) % 26 + 97;
      txt += String.fromCharCode(ch);
    }
    for (i = 0; i < escapadas.length; i++) {
      txt = txt.replace(new RegExp(escapadas[i], 'g'), '_');
    }
    txt = txt.split('_').join('');
    var decodificado = base64Decodificar(txt);
    if (!decodificado) return null;
    var paso4 = '';
    for (i = 0; i < decodificado.length; i++) {
      paso4 += String.fromCharCode((decodificado.charCodeAt(i) - 3 + 256) % 256);
    }
    var invertido = paso4.split('').reverse().join('');
    var finalStr = base64Decodificar(invertido);
    if (!finalStr) return null;
    return JSON.parse(finalStr);
  } catch (e) {
    console.log('[Vimeus:VOE] voeDecode error: ' + (e && e.message));
    return null;
  }
}

function resolverVidhide(embedUrl) {
  return pedirTexto(embedUrl, { Referer: 'https://vimeus.com/' })
    .then(function (html) {
      console.log('[Vimeus:VidHide] Resolviendo: ' + embedUrl);
      var evalMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (!evalMatch) {
        var directo = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (directo) return { url: directo[0], quality: '720p', headers: { Referer: embedUrl } };
        var fuentes = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i);
        if (fuentes) return { url: fuentes[1], quality: '720p', headers: { Referer: embedUrl } };
        return null;
      }
      var desempacado = desempacar(evalMatch[1], 36, evalMatch[4].split('|'));
      var hls4 = desempacado.match(/"hls4"\s*:\s*"([^"]+)"/);
      var hls2 = desempacado.match(/"hls2"\s*:\s*"([^"]+)"/);
      var hls = desempacado.match(/"hls"\s*:\s*"([^"]+)"/);
      var elegido = hls4 || hls2 || hls;
      if (!elegido) {
        console.log('[Vimeus:VidHide] Sin hls4/hls2/hls');
        return null;
      }
      var rel = elegido[1];
      var m3u8 = /^http/i.test(rel) ? rel : urlOrigen(embedUrl) + rel;
      var origen = urlOrigen(embedUrl);
      console.log('[Vimeus:VidHide] URL encontrada: ' + m3u8.substring(0, 80));
      return { url: m3u8, quality: '720p', headers: { 'User-Agent': UA, Referer: origen + '/', Origin: origen } };
    })
    .catch(function (e) {
      console.log('[Vimeus:VidHide] Error: ' + (e && e.message));
      return null;
    });
}

function resolverStreamwish(embedUrl) {
  var embedHost = urlOrigen(embedUrl) || 'https://streamwish.com';
  return pedirTexto(embedUrl, { Referer: 'https://vimeus.com/' })
    .then(function (data) {
      console.log('[Vimeus:StreamWish] Resolviendo: ' + embedUrl);
      var cab = { 'User-Agent': UA, Referer: embedHost + '/', Origin: embedHost };
      var fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        var url = fileMatch[1];
        if (url.charAt(0) === '/') url = embedHost + url;
        console.log('[Vimeus:StreamWish] URL encontrada: ' + url.substring(0, 80));
        return { url: url, quality: '720p', headers: cab };
      }
      var packMatch = data.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
      if (packMatch) {
        var desempacado = desempacar(packMatch[1], parseInt(packMatch[2], 10), packMatch[4].split('|'));
        var objMatch = desempacado.match(/\{[^{}]*"hls[234]"\s*:\s*"([^"]+)"[^{}]*\}/);
        if (objMatch) {
          try {
            var normalizado = objMatch[0].replace(/(\w+)\s*:/g, '"$1":');
            var obj = JSON.parse(normalizado);
            var urlP = obj.hls4 || obj.hls3 || obj.hls2;
            if (urlP) {
              var completa = urlP.charAt(0) === '/' ? embedHost + urlP : urlP;
              console.log('[Vimeus:StreamWish] URL encontrada (packed): ' + completa.substring(0, 80));
              return { url: completa, quality: '720p', headers: cab };
            }
          } catch (e) {}
        }
        var enPacked = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (enPacked) {
          console.log('[Vimeus:StreamWish] URL m3u8 en packed: ' + enPacked[0].substring(0, 80));
          return { url: enPacked[0], quality: '720p', headers: cab };
        }
      }
      var rawM3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (rawM3u8) {
        console.log('[Vimeus:StreamWish] URL m3u8 raw: ' + rawM3u8[0].substring(0, 80));
        return { url: rawM3u8[0], quality: '720p', headers: cab };
      }
      console.log('[Vimeus:StreamWish] No se encontro URL');
      return null;
    })
    .catch(function (e) {
      console.log('[Vimeus:StreamWish] Error: ' + (e && e.message));
      return null;
    });
}

function resolverOkru(embedUrl) {
  return pedirTexto(embedUrl, { Referer: 'https://ok.ru/' })
    .then(function (raw) {
      console.log('[Vimeus:OkRu] Resolviendo: ' + embedUrl);
      if (raw.indexOf('copyrightsRestricted') !== -1 || raw.indexOf('COPYRIGHTS_RESTRICTED') !== -1 ||
          raw.indexOf('LIMITED_ACCESS') !== -1 || raw.indexOf('notFound') !== -1 || raw.indexOf('urls') === -1) {
        console.log('[Vimeus:OkRu] Video no disponible');
        return null;
      }
      var data = raw.replace(/\\&quot;/g, '"').replace(/\\u0026/g, '&').replace(/\\/g, '');
      var re = /"name":"([^"]+)","url":"([^"]+)"/g;
      var m;
      var videos = [];
      while ((m = re.exec(data)) !== null) {
        if (!/mobile/i.test(m[1]) && /^http/.test(m[2])) videos.push({ type: m[1], url: m[2] });
      }
      if (!videos.length) {
        console.log('[Vimeus:OkRu] No se encontraron URLs');
        return null;
      }
      var orden = ['full', 'hd', 'sd', 'low', 'lowest'];
      videos.sort(function (a, b) {
        var ai = orden.indexOf(a.type.toLowerCase());
        var bi = orden.indexOf(b.type.toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      var mejor = videos[0];
      var mapa = { full: '1080p', hd: '720p', sd: '480p', low: '360p', lowest: '240p' };
      console.log('[Vimeus:OkRu] URL encontrada (' + mejor.type + '): ' + mejor.url.substring(0, 80));
      return {
        url: mejor.url,
        quality: mapa[mejor.type] || mejor.type,
        headers: { 'User-Agent': UA, Referer: 'https://ok.ru/', Origin: 'https://ok.ru' }
      };
    })
    .catch(function (e) {
      console.log('[Vimeus:OkRu] Error: ' + (e && e.message));
      return null;
    });
}

function resolverFilemoon(embedUrl) {
  return pedirTexto(embedUrl, { Referer: 'https://vimeus.com/' })
    .then(function (data) {
      console.log('[Vimeus:FileMoon] Resolviendo: ' + embedUrl);
      var evalMatch = data.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (evalMatch) {
        var symtab = evalMatch[4] ? evalMatch[4].split('|') : [];
        var desempacado = desempacar(evalMatch[1], 36, symtab);
        var enPacked = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (enPacked) {
          console.log('[Vimeus:FileMoon] URL en packed: ' + enPacked[0].substring(0, 80));
          return { url: enPacked[0], quality: '1080p', headers: { 'User-Agent': UA, Referer: embedUrl, Origin: 'https://filemoon.sx' } };
        }
      }
      var m3u8 = data.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
      if (m3u8) {
        console.log('[Vimeus:FileMoon] URL m3u8 directa: ' + m3u8[0].substring(0, 80));
        return { url: m3u8[0], quality: '720p', headers: { 'User-Agent': UA, Referer: embedUrl, Origin: 'https://filemoon.sx' } };
      }
      console.log('[Vimeus:FileMoon] No se encontro URL');
      return null;
    })
    .catch(function (e) {
      console.log('[Vimeus:FileMoon] Error: ' + (e && e.message));
      return null;
    });
}

function resolverGoodstream(embedUrl) {
  return pedirTexto(embedUrl, { Referer: 'https://vimeus.com/' })
    .then(function (data) {
      console.log('[Vimeus:GoodStream] Resolviendo: ' + embedUrl);
      var origen = urlOrigen(embedUrl);
      var cab = { 'User-Agent': UA, Referer: origen + '/', Origin: origen };
      var evalMatch = data.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
      if (evalMatch) {
        var symtab = evalMatch[4] ? evalMatch[4].split('|') : [];
        var desempacado = desempacar(evalMatch[1], 36, symtab);
        var enPacked = desempacado.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || desempacado.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
        if (enPacked) {
          console.log('[Vimeus:GoodStream] URL en packed: ' + enPacked[1].substring(0, 80));
          return { url: enPacked[1], quality: '720p', headers: cab };
        }
        var m3u8P = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (m3u8P) {
          console.log('[Vimeus:GoodStream] m3u8 en packed: ' + m3u8P[0].substring(0, 80));
          return { url: m3u8P[0], quality: '720p', headers: cab };
        }
      }
      var fileMatch = data.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || data.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
      if (fileMatch) {
        console.log('[Vimeus:GoodStream] URL directa: ' + fileMatch[1].substring(0, 80));
        return { url: fileMatch[1], quality: '720p', headers: cab };
      }
      var m3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3u8) {
        console.log('[Vimeus:GoodStream] m3u8 directo: ' + m3u8[0].substring(0, 80));
        return { url: m3u8[0], quality: '720p', headers: cab };
      }
      console.log('[Vimeus:GoodStream] No se encontro URL');
      return null;
    })
    .catch(function (e) {
      console.log('[Vimeus:GoodStream] Error: ' + (e && e.message));
      return null;
    });
}

function resolverVimeos(embedUrl) {
  var embedHost = urlOrigen(embedUrl) || 'https://vimeos.net';
  return pedirTexto(embedUrl, { Referer: 'https://vimeus.com/' })
    .then(function (data) {
      console.log('[Vimeus:Vimeos] Resolviendo: ' + embedUrl);
      var origen = urlOrigen(embedUrl);
      var cab = { 'User-Agent': UA, Referer: origen + '/', Origin: origen };
      var evalRe = /eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\('([\s\S]+?)',\s*(\d+),\s*\d+,\s*'([\s\S]+?)'\.split\('\|'\)\)\)/;
      var evalMatch = data.match(evalRe);
      if (evalMatch) {
        var desempacado = desempacar(evalMatch[1], parseInt(evalMatch[2], 10), evalMatch[3].split('|'));
        var sourceMatch = desempacado.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                          desempacado.match(/["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                          desempacado.match(/sources\s*:\s*\[\s*\{[^}]*url\s*:\s*["']([^"']+)["']/i);
        if (sourceMatch) {
          var url = sourceMatch[1].charAt(0) === '/' ? embedHost + sourceMatch[1] : sourceMatch[1];
          console.log('[Vimeus:Vimeos] URL en packed: ' + url.substring(0, 80));
          return { url: url, quality: '1080p', headers: cab };
        }
        var m3u8P = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (m3u8P) {
          console.log('[Vimeus:Vimeos] m3u8 en packed: ' + m3u8P[0].substring(0, 80));
          return { url: m3u8P[0], quality: '720p', headers: cab };
        }
      }
      var fileMatch = data.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                      data.match(/["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                      data.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
      if (fileMatch) {
        var urlD = fileMatch[1].charAt(0) === '/' ? embedHost + fileMatch[1] : fileMatch[1];
        console.log('[Vimeus:Vimeos] URL directa: ' + urlD.substring(0, 80));
        return { url: urlD, quality: '720p', headers: cab };
      }
      var m3u8 = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3u8) {
        console.log('[Vimeus:Vimeos] m3u8 raw: ' + m3u8[0].substring(0, 80));
        return { url: m3u8[0], quality: '720p', headers: cab };
      }
      console.log('[Vimeus:Vimeos] No se encontro URL');
      return null;
    })
    .catch(function (e) {
      console.log('[Vimeus:Vimeos] Error: ' + (e && e.message));
      return null;
    });
}

// Reparte el embed al resolver que corresponde segun la URL o el nombre del servidor.
function resolverVideo(embedUrl, serverName) {
  console.log('[Vimeus:Resolver] Dispatching para ' + serverName + ': ' + embedUrl);
  var u = String(embedUrl).toLowerCase();
  var s = String(serverName).toLowerCase();
  if (u.indexOf('voe.sx') !== -1 || u.indexOf('voe') !== -1 || s.indexOf('voe') !== -1) return resolverVoe(embedUrl);
  if (u.indexOf('do7go.com') !== -1 || u.indexOf('ds2play.com') !== -1 || u.indexOf('vidhide') !== -1 ||
      s.indexOf('do7go') !== -1 || s.indexOf('ds2play') !== -1 || s.indexOf('vidhide') !== -1) return resolverVidhide(embedUrl);
  if (u.indexOf('hlswish.com') !== -1 || u.indexOf('flaswish.com') !== -1 || u.indexOf('streamwish') !== -1 ||
      u.indexOf('sfastwish') !== -1 || s.indexOf('streamwish') !== -1 || s.indexOf('hlswish') !== -1 ||
      s.indexOf('flaswish') !== -1 || s.indexOf('wish') !== -1) return resolverStreamwish(embedUrl);
  if (u.indexOf('ok.ru') !== -1 || s.indexOf('okru') !== -1) return resolverOkru(embedUrl);
  if (u.indexOf('filemoon') !== -1 || s.indexOf('filemoon') !== -1) return resolverFilemoon(embedUrl);
  if (u.indexOf('goodstream.one') !== -1 || s.indexOf('goodstream') !== -1) return resolverGoodstream(embedUrl);
  if (u.indexOf('vimeos.net') !== -1 || s.indexOf('vimeos') !== -1) return resolverVimeos(embedUrl);
  console.log('[Vimeus:Resolver] Sin resolver para ' + serverName);
  return Promise.resolve(null);
}

export { resolverVoe, resolverVidhide, resolverStreamwish, resolverOkru, resolverFilemoon, resolverGoodstream, resolverVimeos, resolverVideo };
