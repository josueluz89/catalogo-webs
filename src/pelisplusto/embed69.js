// embed69.js — resolver de las páginas de embed69.org que usa PelisPlusHD.
//
// PelisPlusHD ya no pasa por embed69.org/uqlink.php (desapareció del sitio) y
// sus fichas traen solo 1-2 servidores, siempre embed69:
//   · /f/<imdb>/  — enlaces CIFRADOS en `dataLink`, detrás de un PoW SHA-256
//     (challenge + nonce -> ceros; llave AES = sha256(challenge+nonce+salt)).
//     Cada enlace es base64: IV (16 bytes) + AES-256-CBC. Se descifra con
//     CryptoJS (ver ../shared/powAes.js) y salen embeds reales de
//     VOE / StreamWish / VidHide.
//   · /video/<CODIGO>/ — servidores EN CLARO en `playServerVast('url')`,
//     agrupados por idioma en pestañas `data-lang` (alt="Latino"...).
//
// En ambos casos se devuelven los embeds SIN resolver (los resuelve el
// getEmbedResolver compartido). Solo LAT y SUB: el castellano se descarta.
// QuickJS-safe: sin eval/new Function, sin Buffer, sin TextEncoder.

import { fetchText } from '../shared/http.js';
import { resolverPoW, aesCbcDescifrar } from '../shared/powAes.js';

var MAIN_URL = 'https://pelisplushd.bz';

function clasificarIdioma(etiqueta) {
  var t = String(etiqueta || '').toLowerCase();
  if (t.indexOf('lat') !== -1) return 'LAT';
  if (t.indexOf('sub') !== -1 || t.indexOf('vose') !== -1) return 'SUB';
  return ''; // castellano/esp/otros: se descartan
}

function etiquetaServidor(nombre) {
  var n = String(nombre || 'Server').trim();
  if (!n) return 'Server';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function dedupe(entradas) {
  var vistos = {};
  var salida = [];
  var i;
  for (i = 0; i < entradas.length; i++) {
    var e = entradas[i];
    if (!e || !e.url || vistos[e.url]) continue;
    vistos[e.url] = 1;
    salida.push(e);
  }
  return salida;
}

// LAT primero; si no hay nada en latino, se cae a subtitulado.
function preferirLatino(entradas) {
  var lat = [];
  var sub = [];
  var i;
  for (i = 0; i < entradas.length; i++) {
    if (entradas[i].lang === 'LAT') lat.push(entradas[i]);
    else if (entradas[i].lang === 'SUB') sub.push(entradas[i]);
  }
  return lat.length > 0 ? lat : sub;
}

// ---------- /f/<id>/ : PoW + dataLink cifrado ----------
function resolverPaginaF(html) {
  var mChallenge = html.match(/POW_CHALLENGE\s*=\s*'([^']+)'/);
  var mDifficulty = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);
  var mSalt = html.match(/POW_SALT\s*=\s*'([^']+)'/);
  var mData = html.match(/let dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!mChallenge || !mDifficulty || !mSalt || !mData) return [];
  var llave = resolverPoW(mChallenge[1], parseInt(mDifficulty[1], 10), mSalt[1]);
  if (!llave) return [];
  var data;
  try {
    data = JSON.parse(mData[1]);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(data)) return [];
  var entradas = [];
  var i, j;
  for (i = 0; i < data.length; i++) {
    var file = data[i];
    var lang = clasificarIdioma(file && file.video_language);
    if (!lang) continue;
    var embeds = (file && file.sortedEmbeds) || [];
    for (j = 0; j < embeds.length; j++) {
      var emb = embeds[j];
      if (!emb || !emb.link) continue;
      var url = aesCbcDescifrar(emb.link, llave);
      if (url && url.indexOf('http') === 0) {
        entradas.push({ url: url, label: etiquetaServidor(emb.servername), lang: lang });
      }
    }
  }
  return preferirLatino(dedupe(entradas));
}

// ---------- /video/<codigo>/ : servidores en claro ----------
function resolverPaginaVideo(html) {
  // Pestañas de idioma: <li data-lang="0"><img alt="Latino">
  var langs = {};
  var reTab = /<li[^>]*data-lang="(\d+)"[^>]*>\s*<img[^>]*alt="([^"]*)"/gi;
  var mt;
  while ((mt = reTab.exec(html)) !== null) {
    var langTab = clasificarIdioma(mt[2]);
    if (langTab) langs[mt[1]] = langTab;
  }
  // Servidores: <li onclick="playServerVast('URL');" data-lang="N">...<span>nombre</span>
  // (los de descarga usan window.open, no playServerVast: se ignoran solos).
  var entradas = [];
  var reSrv = /<li[^>]*onclick="playServerVast\('([^']+)'\)[^>]*data-lang="(\d+)"[^>]*>\s*<img[^>]*>\s*<span>([^<]*)<\/span>/gi;
  var ms;
  while ((ms = reSrv.exec(html)) !== null) {
    var lang = langs[ms[2]];
    if (!lang) continue;
    var url = ms[1];
    if (url.indexOf('http') !== 0) continue;
    entradas.push({ url: url, label: etiquetaServidor(ms[3]), lang: lang });
  }
  return preferirLatino(dedupe(entradas));
}

function resolveEmbed69Servers(embedUrl) {
  return fetchText(embedUrl, { headers: { Referer: MAIN_URL + '/' } })
    .then(function (html) {
      if (!html) return [];
      if (html.indexOf('let dataLink') !== -1) return resolverPaginaF(html);
      if (html.indexOf('playServerVast(') !== -1) return resolverPaginaVideo(html);
      return [];
    })
    .catch(function () { return []; });
}

export { resolveEmbed69Servers, resolverPaginaF, resolverPaginaVideo };
