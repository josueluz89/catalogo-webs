// megadedeoficial — MegaDede (megadede.mobi).
// Portado a MasterScrap desde latinuvio (providers/megadedeoficial.js), autor original del port
// a Nuvio: el equipo de latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/new URL/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.
//
// Cambios frente al original, además de los límites del runtime:
//  - require('crypto') (createHash/createDecipheriv) -> crypto-js empaquetado (./cifrado.js).
//    El original ni siquiera cargaba en el reproductor: el motor no tiene `crypto`.
//  - Buffer se sustituye por WordArrays de CryptoJS para el IV/texto cifrado.
//  - matchAll desaparece (barridos con RegExp.exec) y new URL() se reemplaza por regex.
//  - Los bloques dataLink marcados ESP/CAST se descartan ANTES de descifrar y resolver: la página
//    real trae LAT, ESP y SUB, así que sin este corte saldrían streams de España.
//  - Fuera el require("./stream_labels.js") y los embeds isEmbed (el reproductor no los reproduce:
//    el original los generaba y los filtraba después).
//  - Retirados GoodStream (HTTP 522 a los 20 s) y FileMoon (API en 404).
//  - Presupuesto de 35 s para todo el provider.

import { datosTMDB, rutaVidurl, buscarEnSitio, limpiarTitulo, consultaDe, pedirPagina, rutaVidurlDeHtml, paginaVidurl, HOST } from './sitio.js';
import { resolverPoW, aesCbcDescifrar } from './cifrado.js';
import { resolverEmbed, limpiarCabecerasVimeos } from './resolvers.js';
import { calidadDe, servidorDe, tituloStream } from './labels.js';

var PRESUPUESTO_MS = 35000;

function crearVencido(ms) {
  var t0 = Date.now();
  return function () { return Date.now() - t0 > ms; };
}

function normalizarTipo(mediaType) {
  var t = String(mediaType || 'movie').toLowerCase();
  if (t === 'series' || t === 'anime' || t === 'tv') return 'tv';
  return 'movie';
}

// video_language del dataLink -> 'Lat' | 'Sub' | 'Esp' | 'Ing'. Igual que el original
// (ESP/CAST -> español de España) y, si el valor es raro, decide el detector general.
function etiquetaDeVideoLanguage(raw) {
  var r = String(raw || '').toUpperCase();
  if (r === 'ESP' || r === 'CAST' || r === 'SPA') return 'Esp';
  if (r === 'SUB' || r === 'VOSE') return 'Sub';
  if (r === 'LAT' || r === 'LATINO') return 'Lat';
  if (r === 'ING' || r === 'ENG' || r === 'VOS') return 'Ing';
  return etiquetaDeIdioma(r);
}

function etiquetaDeIdioma(langCrudo) {
  var s = String(langCrudo || '').toLowerCase();
  if (!s) return 'Lat';
  if (/castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/.test(s)) return 'Esp';
  if (/latino|\blat\b|\blat\.|\[lat\]/.test(s)) return 'Lat';
  if (/subtitulad|\bvose\b|\bvosi\b|\bsub\b|\[sub\]/.test(s)) return 'Sub';
  if (/ingl|\beng\b|\bing\b|english/.test(s)) return 'Ing';
  return 'Esp'; // Idioma no reconocido: se descarta (nunca castellano a la salida).
}

function etiquetaVisible(etiqueta) {
  return etiqueta === 'Sub' ? 'Sub' : 'Lat';
}

// ── Filtro de idioma obligatorio (al final, sobre TODOS los streams) ──
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

function idiomaPermitido(titulo) {
  var t = String(titulo || '');
  if (RE_ESPANA.test(t)) return false; // primero descartar España
  return RE_LATINO.test(t) || RE_SUB.test(t);
}

// Sin imdb_id no hay vía rápida: se busca en el sitio y se saca la ruta /vidurl/ del iframe.
async function rutaPorBusqueda(info, tipo, season, episode) {
  for (var i = 0; i < info.titles.length; i++) {
    var consulta = consultaDe(info.titles[i]);
    if (!consulta) continue;
    var resultados = await buscarEnSitio(consulta, tipo);
    if (!resultados.length) continue;
    var limpio = limpiarTitulo(info.titles[i]);
    var elegido = null;
    for (var r = 0; r < resultados.length; r++) {
      var rt = limpiarTitulo(resultados[r].title);
      if (rt.indexOf(limpio) !== -1 || limpio.indexOf(rt) !== -1) { elegido = resultados[r]; break; }
    }
    if (!elegido) elegido = resultados[0];
    if (!elegido) continue;
    console.log('[Megadede] Coincidencia: "' + elegido.title + '" (' + elegido.slug + ')');

    if (tipo === 'tv') {
      // El patrón de episodio es determinista: /serie/<slug>/temporada/<S>/capitulo/<E>
      var epUrl = HOST + '/serie/' + elegido.slug + '/temporada/' + season + '/capitulo/' + episode;
      console.log('[Megadede] Capítulo: ' + epUrl);
      var epHtml = await pedirPagina(epUrl);
      var rutaEp = rutaVidurlDeHtml(epHtml);
      if (rutaEp) return rutaEp;
    } else {
      var html = await pedirPagina(elegido.url);
      var ruta = rutaVidurlDeHtml(html);
      if (ruta) return ruta;
    }
    break;
  }
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  var vencido = crearVencido(PRESUPUESTO_MS);
  try {
    var tipo = normalizarTipo(mediaType);
    console.log('[Megadede] ID ' + tmdbId + ' tipo ' + tipo + ' S:' + season + ' E:' + episode);

    var info = await datosTMDB(tmdbId, tipo);
    if (!info) {
      console.log('[Megadede] Sin datos de TMDB.');
      return [];
    }

    // 1) Ruta /vidurl/: por imdb_id y, si no hay, buscando en el sitio.
    var ruta = rutaVidurl(info.imdbId, tipo, season, episode);
    if (ruta) console.log('[Megadede] Vía rápida por imdb_id: ' + ruta);
    if (!ruta) ruta = await rutaPorBusqueda(info, tipo, season, episode);
    if (!ruta) {
      console.log('[Megadede] No se pudo determinar la ruta /vidurl/.');
      return [];
    }

    // 2) Página /vidurl/: PoW + dataLink cifrado
    var vid = await paginaVidurl(ruta);
    if (!vid) return [];

    // 3) PoW -> llave AES
    var llave = resolverPoW(vid.challenge, vid.difficulty, vid.salt, vencido);
    if (!llave) return [];

    // 4) Descifrar y resolver solo los bloques latino/subtitulado
    var streams = [];
    for (var b = 0; b < vid.dataLink.length; b++) {
      var bloque = vid.dataLink[b] || {};
      var etiqueta = etiquetaDeVideoLanguage(bloque.video_language);
      if (etiqueta === 'Esp' || etiqueta === 'Ing') {
        console.log('[Megadede] Bloque descartado por idioma: ' + bloque.video_language);
        continue;
      }
      var embeds = bloque.sortedEmbeds || [];
      for (var e = 0; e < embeds.length; e++) {
        var embed = embeds[e] || {};
        if (!embed.link || embed.type !== 'video') continue;
        var sn = String(embed.servername || '').toLowerCase();
        if (sn.indexOf('filemoon') !== -1 || sn.indexOf('1fichier') !== -1 || sn.indexOf('fireload') !== -1) continue;
        if (vencido()) {
          console.log('[Megadede] Presupuesto agotado con ' + streams.length + ' streams.');
          break;
        }
        var url = aesCbcDescifrar(embed.link, llave);
        if (!url || url.indexOf('http') !== 0) {
          console.log('[Megadede] No se pudo descifrar el enlace de ' + embed.servername);
          continue;
        }
        var resuelto = await resolverEmbed(url, vencido, embed.servername);
        if (!resuelto || !resuelto.url) continue;

        var calidad = resuelto.quality || calidadDe(resuelto.url, 'HD');
        var cabeceras = resuelto.headers || { 'Referer': url, 'User-Agent': '' };
        if (/vimeos\.|vms\.sh/i.test(resuelto.url)) cabeceras = limpiarCabecerasVimeos(resuelto.url, cabeceras);
        streams.push({
          title: tituloStream(calidad, etiquetaVisible(etiqueta), servidorDe(resuelto.url, resuelto.server)),
          quality: calidad,
          language: etiqueta === 'Sub' ? 'Subtitulado' : 'Latino',
          url: resuelto.url,
          headers: cabeceras
        });
      }
    }
    console.log('[Megadede] Streams resueltos: ' + streams.length);

    // 5) Filtro final de idioma + normalización de `language`
    var salida = [];
    for (var s = 0; s < streams.length; s++) {
      var st = streams[s];
      var texto = String(st.title || '') + ' ' + String(st.language || '');
      if (!idiomaPermitido(texto)) continue;
      st.language = (RE_SUB.test(texto) && !RE_LATINO.test(texto)) ? 'Subtitulado' : 'Latino';
      salida.push(st);
    }
    return salida;
  } catch (e) {
    console.log('[Megadede] Error: ' + (e && e.message));
    return [];
  }
}

module.exports = { getStreams };
