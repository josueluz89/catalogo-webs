// embed69.js — resolver de las páginas de embed69.org que usa PelisPlusHD.
//
// Estado real verificado 2026-11-12 (curl contra el sitio vivo):
//   · PelisPlusHD (pelisplushd.bz) trae UN solo servidor por título:
//     embed69 — /f/<imdb>/ en pelis, /f/<imdb>-<t>x<e>/ en series.
//   · GET /f/... ya NO devuelve la página de video directamente: embed69
//     puso delante un reto Anubis (bot-check PoW SHA-256, v1.28.2,
//     difficulty 4). La página del reto trae el challenge en
//     <script id="anubis_challenge"> (JSON: rules + challenge.id,
//     challenge.randomData, challenge.difficulty). El navegador resuelve
//     el PoW y hace GET a /.within.website/x/cmd/anubis/api/pass-challenge
//     (?id&response&nonce&redir&elapsedTime); el servidor responde 302 con
//     una cookie de sesión (JWT) y redirige a la página real. Sin esa
//     cookie, la página real no se sirve: vuelve a salir el reto.
//   · La página real trae `let dataLink = [{video_language,
//     sortedEmbeds:[{servername, link}]}]` con los enlaces CIFRADOS
//     AES-256-CBC: clave = SHA-256(LINK_CHALLENGE + LINK_SALT) (32 bytes
//     crudos), cada link es base64 con IV = primeros 16 bytes y el resto
//     ciphertext. El viejo esquema POW_CHALLENGE / POW_DIFFICULTY /
//     POW_SALT con nonce ya NO existe en la página (0 ocurrencias).
//     Los embeds que salen son de StreamWish / VOE / VidHide.
//   · La variante vieja /video/<codigo>/ con playServerVast en claro
//     tampoco existe ya: las fichas solo enlazan /f/.
//
// POR QUÉ NO SE INTENTA RESOLVER EL RETO ANUBIS AQUÍ (medido 2026-11-12):
//   · El PoW sí se puede resolver: con curl+node se resolvió en <1 s
//     (SHA-256 de randomData+nonce, difficulty 4 ~= 65.000 intentos) y
//     con jarra de cookies el flujo completo devuelve la página real
//     (70 KB, dataLink con LAT/SUB/ESP, 18 embeds). Sin jarra, no.
//   · Pero en QuickJS el mismo bucle con CryptoJS cuesta ~5 min de CPU
//     (medido: el arnés marcó CUELGA a los 90 s con 4m53s de CPU y
//     getStreams sin resolver; el bucle síncrono bloquea hasta el
//     withTimeout). La app da 60 s por provider: inviable.
//   · Y aunque se resolviera, el fetch del motor/arnés no expone
//     Set-Cookie ni persiste cookies entre peticiones, así que la
//     cookie de sesión del pass-challenge se pierde y la re-petición
//     vuelve a traer el reto. Dos bloqueos independientes, ambos
//     fuera del provider.
//   · Por eso este resolver NO intenta el PoW: si la página trae el
//     reto, devuelve [] rápido. El descifrado nuevo sí queda
//     implementado y verificado (ver abajo): si el motor llega a la
//     página real —porque Anubis no salta desde esa red o porque la
//     sesión ya existe—, los enlaces salen.
//
// VERIFICACIÓN DEL DESCIFRADO (2026-11-12, sin Anubis): con la página
// real guardada (curl + cookie) como stub del fetch, el provider
// completo devuelve Dune 2 streams (Streamwish 720p LAT, Vidhide HD
// LAT, 22 s) y Boys S1E1 1 stream (Vidhide HD LAT, 19 s). En el arnés
// real da 0 por el reto Anubis, no por el descifrado.
//
// Se devuelven los embeds SIN resolver (los resuelve el
// getEmbedResolver compartido). Solo LAT y SUB: el castellano (ESP)
// se descarta. QuickJS-safe: sin eval/new Function, sin Buffer,
// sin TextEncoder, sin crypto.subtle (CryptoJS empaquetado).

import { fetchText } from '../shared/http.js';
import { aesCbcDescifrar } from '../shared/powAes.js';
import CryptoJS from 'crypto-js';

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

// ---------- Página real: dataLink cifrado (LINK_CHALLENGE + LINK_SALT) ----------
function resolverPaginaEmbed(html) {
  var mChallenge = html.match(/LINK_CHALLENGE\s*=\s*'([^']+)'/);
  var mSalt = html.match(/LINK_SALT\s*=\s*'([^']+)'/);
  var mData = html.match(/let dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!mChallenge || !mSalt || !mData) return [];
  var llave = CryptoJS.SHA256(mChallenge[1] + mSalt[1]);
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

function resolveEmbed69Servers(embedUrl) {
  return fetchText(embedUrl, { headers: { Referer: MAIN_URL + '/' } })
    .then(function (html) {
      if (!html) return [];
      if (html.indexOf('let dataLink') !== -1) return resolverPaginaEmbed(html);
      // Sin dataLink es el reto Anubis (o una página vacía): no hay nada
      // que resolver y no se intenta el PoW (ver cabecera: ~5 min de CPU
      // en QuickJS y la cookie no persistiría de todos modos).
      return [];
    })
    .catch(function () { return []; });
}

export { resolveEmbed69Servers, resolverPaginaEmbed };
