// Resolvers de embeds de cinemitas.org.
//
// El provider original resolvia: voe, streamwish, vidhide, filemoon y cvid por
// su cuenta, y los hosts uqload/goodstream/vimeos/bysezoxexe/audinifer/vidara
// los pedia a "./cdn_resolvers" (require local). Aquí TODO va inline para que
// el provider sea independiente; de cdn_resolvers solo se copiaron las seis
// funciones que cinemitas usa, con dos arreglos:
//   · sin new URL (QuickJS no lo trae) -> urlOrigen/urlAbsoluta
//   · el Referer de uqload se toma del propio embed (uqload.is/uqload.org) en
//     vez de uqload.com, que responde 403 a los enlaces frescos.

import {
  UA, urlOrigen, urlAbsoluta, pedir, pedirTexto, base64Decodificar, desempacarBase36, extraerM3u8, extraerHls
} from './util.js';

// ---------- packer de Dean Edwards (variante que recibe el script entero) ----------
function desempacarScript(script) {
  var m = String(script).match(/\(([\s\S]+?),\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
  if (!m) return null;
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var radix = parseInt(m[2], 10);
  var symtab = m[4].split('|');
  function desbase(s) {
    var v = 0;
    var i, idx;
    for (i = 0; i < s.length; i++) {
      idx = chars.indexOf(s.charAt(i));
      if (idx === -1) return NaN;
      v = v * radix + idx;
    }
    return v;
  }
  return m[1].replace(/\b([0-9a-zA-Z]+)\b/g, function (token) {
    var idx = desbase(token);
    return (!isNaN(idx) && idx < symtab.length && symtab[idx] && symtab[idx] !== '') ? symtab[idx] : token;
  });
}

// ---------- VOE (ROT13 -> ruido -> base64 -> -3 -> invertir -> base64 -> JSON) ----------
function voeDecode(ct, luts) {
  try {
    var trozos = String(luts).replace(/^\[|\]$/g, '').split("','");
    var escapadas = [];
    var i;
    for (i = 0; i < trozos.length; i++) {
      escapadas.push(trozos[i].replace(/^'+|'+$/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    var txt = '';
    for (i = 0; i < ct.length; i++) {
      var c = ct.charCodeAt(i);
      if (c > 64 && c < 91) c = (c - 52) % 26 + 65;
      else if (c > 96 && c < 123) c = (c - 84) % 26 + 97;
      txt += String.fromCharCode(c);
    }
    for (i = 0; i < escapadas.length; i++) txt = txt.replace(new RegExp(escapadas[i], 'g'), '_');
    txt = txt.split('_').join('');
    var paso1 = base64Decodificar(txt);
    if (!paso1) return null;
    var paso2 = '';
    for (i = 0; i < paso1.length; i++) paso2 += String.fromCharCode((paso1.charCodeAt(i) - 3 + 256) % 256);
    var invertido = paso2.split('').reverse().join('');
    var finalStr = base64Decodificar(invertido);
    return finalStr ? JSON.parse(finalStr) : null;
  } catch (e) {
    console.log('[Cinemitas:VOE] voeDecode error: ' + (e && e.message));
    return null;
  }
}

async function resolverVoe(embedUrl) {
  try {
    console.log('[Cinemitas:VOE] Resolviendo: ' + embedUrl);
    var res = await pedirTexto(embedUrl, { Referer: embedUrl });
    if (/permanentToken/i.test(res)) {
      var redir = res.match(/window\.location\.href\s*=\s*'([^']+)'/i);
      if (redir) res = await pedirTexto(redir[1], { Referer: embedUrl });
    }
    var u = res.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
    if (u) {
      var cifrado = u[1];
      var loader = urlAbsoluta(u[2], embedUrl);
      var js = await pedirTexto(loader, { Referer: embedUrl });
      var luts = js.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || js.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
      if (luts) {
        var dec = voeDecode(cifrado, luts[1]);
        if (dec && (dec.source || dec.direct_access_url)) {
          return { url: dec.source || dec.direct_access_url, server: 'VOE', quality: '1080p', headers: { Referer: embedUrl } };
        }
      }
    }
    var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
    var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
    var candidatos = [];
    var m;
    while ((m = re1.exec(res)) !== null) candidatos.push(m[1]);
    while ((m = re2.exec(res)) !== null) candidatos.push(m[1]);
    var i;
    for (i = 0; i < candidatos.length; i++) {
      if (!candidatos[i]) continue;
      var url = candidatos[i];
      if (url.indexOf('aHR0') === 0) url = base64Decodificar(url) || url;
      return { url: url, server: 'VOE', quality: '720p', headers: { Referer: embedUrl } };
    }
  } catch (e) {
    console.log('[Cinemitas:VOE] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- StreamWish ----------
async function resolverStreamwish(embedUrl) {
  try {
    var host = urlOrigen(embedUrl);
    console.log('[Cinemitas:StreamWish] Resolviendo: ' + embedUrl);
    var res = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    // Los embeds Vite SPA necesitan un navegador de verdad: se descartan.
    if (res.indexOf('id="root"') !== -1 && res.indexOf('__vite_is_modern_browser') !== -1) {
      console.log('[Cinemitas:StreamWish] Embed SPA (requiere navegador): ' + embedUrl);
      return null;
    }
    var cab = { 'User-Agent': UA, Referer: host + '/' };
    var file = res.match(/file\s*:\s*["']([^"']+)["']/i);
    if (file) {
      var urlF = file[1];
      if (urlF.charAt(0) === '/') urlF = host + urlF;
      return { url: urlF, server: 'StreamWish', quality: '1080p', headers: cab };
    }
    var pack = res.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
    if (pack) {
      var desempacado = desempacarScript(pack[0]);
      if (desempacado) {
        var hls = extraerHls(desempacado, host);
        if (hls) return { url: hls, server: 'StreamWish', quality: '1080p', headers: cab };
        var directo = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (directo) return { url: directo[0], server: 'StreamWish', quality: '1080p', headers: cab };
      }
    }
    var suelto = extraerM3u8(res);
    if (suelto) return { url: suelto, server: 'StreamWish', quality: '1080p', headers: cab };
  } catch (e) {
    console.log('[Cinemitas:StreamWish] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- VidHide ----------
async function resolverVidhide(embedUrl) {
  try {
    console.log('[Cinemitas:VidHide] Resolviendo: ' + embedUrl);
    var res = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    var bloque = res.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
    if (!bloque) {
      var m3 = extraerM3u8(res);
      if (m3) return { url: m3, server: 'VidHide', quality: '720p', headers: { Referer: embedUrl } };
      return null;
    }
    var desempacado = desempacarBase36(bloque[0]);
    if (!desempacado) return null;
    var hls = desempacado.match(/"hls4"\s*:\s*"([^"]+)"/) || desempacado.match(/"hls2"\s*:\s*"([^"]+)"/);
    if (!hls) return null;
    var origen = urlOrigen(embedUrl);
    var url = hls[1];
    if (!/^http/i.test(url)) url = origen + url;
    return { url: url, server: 'VidHide', quality: '1080p', headers: { 'User-Agent': UA, Referer: origen + '/', Origin: origen } };
  } catch (e) {
    console.log('[Cinemitas:VidHide] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- FileMoon ----------
async function resolverFilemoon(embedUrl) {
  try {
    console.log('[Cinemitas:FileMoon] Resolviendo: ' + embedUrl);
    var res = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    var bloque = res.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
    if (bloque) {
      var desempacado = desempacarBase36(bloque[0]);
      if (desempacado) {
        var m3 = desempacado.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (m3) return { url: m3[0], server: 'FileMoon', quality: '1080p', headers: { 'User-Agent': UA, Referer: embedUrl } };
      }
    }
    var suelto = extraerM3u8(res);
    if (suelto) return { url: suelto, server: 'FileMoon', quality: '720p', headers: { 'User-Agent': UA, Referer: embedUrl } };
  } catch (e) {
    console.log('[Cinemitas:FileMoon] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- Cvid ----------
async function resolverCvid(embedUrl) {
  try {
    // /f/ es el envoltorio; /e/ es el reproductor real.
    var url = String(embedUrl).replace(/\/f\//, '/e/');
    console.log('[Cinemitas:Cvid] Resolviendo: ' + url);
    var res = await pedirTexto(url, { Referer: 'https://cinemitas.org/' });
    var m3 = res.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
    if (m3) return { url: m3[0], server: 'Cvid', quality: '1080p', headers: { 'User-Agent': UA, Referer: 'https://cvid.lat/' } };
    var mp4 = res.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/i);
    if (mp4) return { url: mp4[0], server: 'Cvid', quality: '1080p', headers: { 'User-Agent': UA, Referer: 'https://cvid.lat/' } };
  } catch (e) {
    console.log('[Cinemitas:Cvid] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- Uqload (inlineado de cdn_resolvers.js) ----------
async function resolverUqload(embedUrl) {
  try {
    var html = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    if (!html) return null;
    var sm = html.match(/sources\s*:\s*\[([^\]]+)\]/);
    if (!sm) {
      var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
      if (pm) {
        var desempacado = desempacarScript(pm[0]);
        if (desempacado) sm = desempacado.match(/sources\s*:\s*\[([^\]]+)\]/);
      }
    }
    if (!sm) return null;
    var url = extraerM3u8(sm[1]) || (sm[1].match(/https?:\/\/[^\s"'<>]+/) || [])[0];
    if (!url || !/^http/.test(url)) return null;
    var origen = urlOrigen(embedUrl) || 'https://uqload.com';
    return { url: url, server: 'Uqload', quality: '1080p', headers: { Referer: origen + '/', 'User-Agent': UA } };
  } catch (e) {
    console.log('[Cinemitas:Uqload] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- GoodStream (inlineado de cdn_resolvers.js) ----------
async function resolverGoodstream(embedUrl) {
  try {
    var html = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    if (!html) return null;
    var fm = html.match(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);
    if (fm) return { url: fm[1], server: 'GoodStream', quality: '1080p', headers: { Referer: 'https://goodstream.one/', Origin: 'https://goodstream.one', 'User-Agent': UA } };
    var m3 = extraerM3u8(html);
    return m3 ? { url: m3, server: 'GoodStream', quality: '1080p', headers: { Referer: 'https://goodstream.one/', 'User-Agent': UA } } : null;
  } catch (e) {
    console.log('[Cinemitas:GoodStream] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- Vimeos (inlineado de cdn_resolvers.js) ----------
async function resolverVimeos(embedUrl) {
  try {
    var html = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    if (!html) return null;
    var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
    if (pm) {
      var desempacado = desempacarScript(pm[0]);
      if (desempacado) {
        var url = extraerM3u8(desempacado);
        if (url) return { url: url, server: 'Vimeos', quality: '1080p', headers: { Referer: 'https://vimeos.net/', Origin: 'https://vimeos.net', 'User-Agent': UA } };
      }
    }
    var m3 = extraerM3u8(html);
    return m3 ? { url: m3, server: 'Vimeos', quality: '1080p', headers: { Referer: 'https://vimeos.net/', 'User-Agent': UA } } : null;
  } catch (e) {
    console.log('[Cinemitas:Vimeos] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- Audinifer (inlineado de cdn_resolvers.js) ----------
async function resolverAudinifer(embedUrl) {
  try {
    var html = await pedirTexto(embedUrl, { Referer: 'https://cinemitas.org/' });
    if (!html) return null;
    var pm = html.match(/eval\s*\(\s*function\s*\(p,a,c,k,e,[dr]\)[\s\S]*?\.split\('\|'\)[^)]*\)\)/);
    if (pm) {
      var desempacado = desempacarScript(pm[0]);
      if (desempacado) {
        var m3u8 = extraerM3u8(desempacado);
        if (m3u8) return { url: m3u8, server: 'Audinifer', quality: '1080p', headers: { Referer: embedUrl, 'User-Agent': UA } };
        var f = desempacado.match(/(?:file|src)\s*[:=]\s*["']([^"']+)["']/i);
        if (f && f[1] && /^http/.test(f[1])) return { url: f[1], server: 'Audinifer', quality: '1080p', headers: { Referer: embedUrl, 'User-Agent': UA } };
      }
    }
    var m3 = extraerM3u8(html);
    return m3 ? { url: m3, server: 'Audinifer', quality: '1080p', headers: { Referer: embedUrl, 'User-Agent': UA } } : null;
  } catch (e) {
    console.log('[Cinemitas:Audinifer] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- Vidara ----------
// La API solo acepta POST con JSON {"filecode": "..."}: el GET anterior
// devolvía 405 "Method not allowed" y el embed quedaba sin resolver.
async function resolverVidara(embedUrl) {
  try {
    var id = (String(embedUrl).match(/\/e\/([^/]+)/i) || [])[1] || (String(embedUrl).match(/\/player\/([^/]+)/i) || [])[1];
    if (!id) return null;
    var res = await pedir('https://vidara.so/api/stream', {
      'User-Agent': UA, Referer: embedUrl, Origin: urlOrigen(embedUrl),
      Accept: 'application/json', 'Content-Type': 'application/json'
    }, { metodo: 'POST', cuerpo: JSON.stringify({ filecode: id }) });
    if (!res.ok) return null;
    var j = JSON.parse(await res.text());
    var f = j.streaming_url || j.file || j.url || j.source || (j.data && (j.data.streaming_url || j.data.url || j.data.file));
    if (f && /^http/.test(f)) return { url: f, server: 'Vidara', quality: '1080p', headers: { Referer: embedUrl, 'User-Agent': UA } };
  } catch (e) {
    console.log('[Cinemitas:Vidara] Error: ' + (e && e.message));
  }
  return null;
}

// ---------- reparto por URL ----------
function resolverEmbed(embedUrl) {
  var u = String(embedUrl || '').toLowerCase();
  if (u.indexOf('voe.sx') !== -1 || u.indexOf('/voe/') !== -1) return resolverVoe(embedUrl);
  if (u.indexOf('wish') !== -1 || u.indexOf('vibuxer') !== -1 || u.indexOf('hglink') !== -1 || u.indexOf('hanerix') !== -1) return resolverStreamwish(embedUrl);
  if (u.indexOf('vidhide') !== -1 || u.indexOf('ds2play') !== -1 || u.indexOf('do7go') !== -1 || u.indexOf('dintezuvio') !== -1) return resolverVidhide(embedUrl);
  if (u.indexOf('filemoon') !== -1 || u.indexOf('fmoon') !== -1) return resolverFilemoon(embedUrl);
  if (u.indexOf('cvid.lat') !== -1) return resolverCvid(embedUrl);
  if (u.indexOf('uqload') !== -1) return resolverUqload(embedUrl);
  if (u.indexOf('goodstream') !== -1) return resolverGoodstream(embedUrl);
  if (u.indexOf('vimeos') !== -1) return resolverVimeos(embedUrl);
  if (u.indexOf('audinifer') !== -1) return resolverAudinifer(embedUrl);
  if (u.indexOf('vidara') !== -1) return resolverVidara(embedUrl);
  console.log('[Cinemitas] Sin resolver para: ' + embedUrl);
  return Promise.resolve(null);
}

export { resolverEmbed, resolverVoe, resolverStreamwish, resolverVidhide, resolverFilemoon, resolverCvid, resolverUqload, resolverGoodstream, resolverVimeos, resolverAudinifer, resolverVidara };
