// vidhide.js — resolver VidHide propio de pelisplusto, escrito desde la
// página real de morencius (familia VidHide).
//
// Formato observado (morencius.com/embed/<id>, 200):
//   <script>eval(function(p,a,c,k,e,d){while(c--)...}('PAYLOAD',RADIX,N,'TABLA'.split('|')))</script>
// Al desempaquetar sale el setup de jwplayer con:
//   var links={"hls2":"https://.../master.m3u8?...","hls4":"/stream/.../master.m3u8"};
//   jwplayer("vplayer").setup({sources:[{file:links.hls4||links.hls3||links.hls2,...}]})
// El reproductor prefiere hls4 (relativa al origen) y cae a hls3/hls2.
// Este resolver NO sondea el m3u8 para detectar calidad: la sonda del
// resolver compartido es lo que anulaba el stream (el CDN responde 403 a
// la sonda aunque el m3u8 acabe de resolverse y reproduzca bien). La
// calidad se marca HD y la validación final vive en index.js (fail-open).

import { fetchText } from '../shared/http.js';

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function esVidhide(url) {
  var u = String(url || '').toLowerCase();
  return u.indexOf('vidhide') !== -1 || u.indexOf('morencius') !== -1 ||
    u.indexOf('filelions') !== -1 || u.indexOf('dintezuvio') !== -1 ||
    u.indexOf('vidhidehub') !== -1 || u.indexOf('vidhidevip') !== -1 ||
    u.indexOf('vidhidepre') !== -1 || u.indexOf('kinoger') !== -1 ||
    u.indexOf('movearnpre') !== -1 || u.indexOf('peytonepre') !== -1;
}

function origenDe(url) {
  var m = String(url || '').match(/^(https?:\/\/[^\/]+)/);
  return m ? m[1] : '';
}

// Desempaquetador Edwards: cada palabra del payload es un índice en base
// RADIX (alfabeto 0-9a-zA-Z) dentro de la tabla; si el índice no es válido
// la palabra se deja tal cual.
function desempacarEdwards(html) {
  var m = html.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
  if (!m) return null;
  var payload = m[1];
  var radix = parseInt(m[2], 10);
  var tabla = m[4].split('|');
  return payload.replace(/\b\w+\b/g, function (palabra) {
    var valor = 0;
    for (var i = 0; i < palabra.length; i++) {
      var digito = ALFABETO.indexOf(palabra.charAt(i));
      if (digito === -1 || digito >= radix) return palabra;
      valor = valor * radix + digito;
    }
    if (valor < 0 || valor >= tabla.length || !tabla[valor]) return palabra;
    return tabla[valor];
  });
}

// Extrae el m3u8 del objeto links, con la misma preferencia del player
// (hls4 -> hls3 -> hls2). Las rutas relativas se resuelven contra el origen.
function extraerDeLinks(texto, origen) {
  var m = texto.match(/var links\s*=\s*\{([\s\S]*?)\};/);
  if (m) {
    var cuerpo = m[1];
    var orden = ['hls4', 'hls3', 'hls2'];
    for (var i = 0; i < orden.length; i++) {
      var mm = cuerpo.match(new RegExp('"' + orden[i] + '"\\s*:\\s*"([^"]+)"'));
      if (mm && mm[1]) {
        var url = mm[1];
        if (url.indexOf('http') !== 0) url = origen + (url.charAt(0) === '/' ? '' : '/') + url;
        return url;
      }
    }
  }
  var directo = texto.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
  return directo ? directo[0] : null;
}

export function resolverVidhide(embedUrl) {
  var origen = origenDe(embedUrl);
  return fetchText(embedUrl, {
    headers: { Referer: 'https://embed69.org/', 'User-Agent': UA, 'Accept-Language': 'es-MX,es;q=0.9' },
  }).then(function (html) {
    if (!html) return null;
    var desempacado = desempacarEdwards(html);
    var url = null;
    if (desempacado) url = extraerDeLinks(desempacado, origen);
    if (!url) url = extraerDeLinks(html, origen);
    if (!url || url.indexOf('http') !== 0) return null;
    return {
      url: url,
      quality: 'HD',
      headers: { Referer: origen + '/', Origin: origen },
    };
  }).catch(function () { return null; });
}

export { esVidhide };
