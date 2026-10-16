// Utilidades internas de vimeus: URL, HTTP, base64 y desempaquetado del "packer"
// de Dean Edwards. Todo QuickJS-safe: sin Buffer, sin new URL/URLSearchParams,
// sin matchAll, sin String.normalize.

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var CABECERAS_BASE = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Connection': 'keep-alive'
};

// Origen (esquema + host) de una URL. Sustituye a new URL(u).origin, que no
// existe en QuickJS.
function urlOrigen(url) {
  var m = String(url || '').match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : '';
}

// Host con puerto (sin esquema), para cabeceras Referer tipo "host/".
function urlHost(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/]+)/i);
  return m ? m[1] : '';
}

// Convierte una URL relativa en absoluta tomando otra como base.
// Equivale a new URL(rel, base).href.
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

// GET de texto con cabeceras propias del host; lanza si la respuesta no es 2xx.
function pedirTexto(url, cabeceras, opciones) {
  var cab = {};
  var k;
  for (k in CABECERAS_BASE) cab[k] = CABECERAS_BASE[k];
  for (k in (cabeceras || {})) cab[k] = cabeceras[k];
  var req = { headers: cab, redirect: 'follow' };
  var o = opciones || {};
  if (o.metodo) req.method = o.metodo;
  if (o.cuerpo !== undefined && o.cuerpo !== null) req.body = o.cuerpo;
  return fetch(url, req).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status + ' para ' + url);
    return res.text();
  });
}

// base64 -> texto. Solo atob (el motor no tiene Buffer ni TextDecoder).
function base64Decodificar(str) {
  try {
    if (typeof atob !== 'undefined') return atob(String(str));
  } catch (e) {}
  return null;
}

// Desempaqueta eval(function(p,a,c,k,e,d){...}('...',radix,count,'claves'.split('|')))
// sin usar eval: sustituye cada token por su entrada de la tabla.
function desempacar(packed, radix, symtab) {
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

export { UA, CABECERAS_BASE, urlOrigen, urlHost, urlAbsoluta, pedirTexto, base64Decodificar, desempacar };
