// Utilidades internas de cinemitas: URL, HTTP, base64, desempaquetadores y
// extraccion de m3u8. QuickJS-safe: sin Buffer, sin new URL/URLSearchParams,
// sin matchAll, sin String.normalize.

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

var CABECERAS_BASE = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

function urlOrigen(url) {
  var m = String(url || '').match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : '';
}

function urlHost(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1] : '';
}

function urlAbsoluta(rel, base) {
  var r = String(rel || '');
  if (/^https?:\/\//i.test(r)) return r;
  if (r.indexOf('//') === 0) return 'https:' + r;
  var origen = urlOrigen(base);
  if (!origen) return r;
  if (r.charAt(0) === '/') return origen + r;
  var dir = String(base || '').match(/^(https?:\/\/[^?#]*\/)/);
  return (dir ? dir[1] : origen + '/') + r;
}

// Peticion cruda con cabeceras base + las propias del host. Devuelve la
// respuesta de fetch (para poder mirar el status); el que llama decide.
function pedir(url, cabeceras, opciones) {
  var cab = {};
  var k;
  for (k in CABECERAS_BASE) cab[k] = CABECERAS_BASE[k];
  for (k in (cabeceras || {})) cab[k] = cabeceras[k];
  var req = { headers: cab, redirect: 'follow' };
  var o = opciones || {};
  if (o.metodo) req.method = o.metodo;
  if (o.cuerpo !== undefined && o.cuerpo !== null) req.body = o.cuerpo;
  if (typeof AbortController !== 'undefined' && typeof setTimeout !== 'undefined') {
    try {
      var control = new AbortController();
      setTimeout(function () { try { control.abort(); } catch (e) {} }, o.timeout || 15000);
      req.signal = control.signal;
    } catch (e) {}
  }
  return fetch(url, req);
}

// Texto o null (nunca lanza): comodo para resolvers que solo quieren el HTML.
function pedirTextoOpcional(url, cabeceras, opciones) {
  return pedir(url, cabeceras, opciones)
    .then(function (res) { return res.ok ? res.text() : null; })
    .catch(function () { return null; });
}

function pedirTexto(url, cabeceras, opciones) {
  return pedir(url, cabeceras, opciones).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status + ' para ' + url);
    return res.text();
  });
}

function base64Decodificar(str) {
  try {
    if (typeof atob !== 'undefined') return atob(String(str).replace(/-/g, '+').replace(/_/g, '/'));
  } catch (e) {}
  return null;
}

// Packer de Dean Edwards con radix variable (el "q(...)" del original).
function desempacarRadix(packed, radix, symtab) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function desbase(str) {
    var resultado = 0;
    var i, pos;
    for (i = 0; i < str.length; i++) {
      pos = chars.indexOf(str.charAt(i));
      if (pos === -1) return NaN;
      resultado = resultado * radix + pos;
    }
    return resultado;
  }
  return String(packed).replace(/\b([0-9a-zA-Z]+)\b/g, function (token) {
    var idx = desbase(token);
    if (isNaN(idx) || idx >= symtab.length) return token;
    return symtab[idx] && symtab[idx] !== '' ? symtab[idx] : token;
  });
}

// Packer con relleno en base 36 (el "C(...)" del original): los tokens que no
// caben en la tabla se reescriben en base `radix`.
function desempacarBase36(texto) {
  var m = String(texto).match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m) return null;
  try {
    var payload = m[1];
    var radix = parseInt(m[2], 10);
    var symtab = m[4].split('|');
    var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    function enBase36(num, base) {
      var salida = '';
      while (num > 0) {
        salida = chars.charAt(num % base) + salida;
        num = Math.floor(num / base);
      }
      return salida || '0';
    }
    return payload.replace(/\b\w+\b/g, function (token) {
      var idx = parseInt(token, 36);
      return idx < symtab.length && symtab[idx] ? symtab[idx] : enBase36(idx, radix);
    });
  } catch (e) {
    return null;
  }
}

// Primer m3u8 absoluto del texto, normalizando los escapes de JSON.
function extraerM3u8(texto) {
  var m = String(texto || '').match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
  return m ? m[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/') : null;
}

// Claves hls4/hls3/hls2 dentro de un bloque ya desempaquetado (el "X(...)").
function extraerHls(desempacado, host) {
  var obj = String(desempacado).match(/\{[^{}]*"hls[234]"\s*:\s*"([^"]+)"[^{}]*\}/);
  if (obj) {
    try {
      var normalizado = obj[0].replace(/(\w+)\s*:/g, '"$1":');
      var json = JSON.parse(normalizado);
      var url = json.hls4 || json.hls3 || json.hls2;
      if (url) return url.charAt(0) === '/' ? host + url : url;
    } catch (e) {
      var solo = obj[0].match(/"hls[234]"\s*:\s*"([^"]+\.m3u8[^"]*)"/);
      if (solo) return solo[1].charAt(0) === '/' ? host + solo[1] : solo[1];
    }
  }
  var largo = String(desempacado).match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
  if (largo) return largo[1].charAt(0) === '/' ? host + largo[1] : largo[1];
  return null;
}

export { UA, TMDB_KEY, CABECERAS_BASE, urlOrigen, urlHost, urlAbsoluta, pedir, pedirTexto, pedirTextoOpcional, base64Decodificar, desempacarRadix, desempacarBase36, extraerM3u8, extraerHls };
