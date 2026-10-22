// allpeliculasse — AllPeliculas (allpeliculas.la).
// Portado a MasterScrap desde latinuvio (providers/allpeliculasse.js), autor original del port
// a Nuvio: el equipo de latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/new URL/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.
//
// Cambios frente al original, además de los límites del runtime:
//  - Los helpers hermanos (./stream_labels.js) ya no se cargan con require(): lo que hacía falta
//    queda dentro de ./labels.js.
//  - Se resuelven SOLO los embeds marcados latino/subtitulado: los de castellano ni se piden
//    (cero peticiones de España y bastante menos tiempo).
//  - Presupuesto de 45 s para todo el provider (Nuvio corta a los 60 s): el original tardaba
//    ~65 s en la película por el barrido de espejos y los reintentos de goodstream (que hoy
//    responde 522 tras 20 s). 2026-10-16: el barrido StreamWish ya no incluye el espejo
//    muerto awish.pro y VOE aborta en cuanto ve su gate ALTCHA, así que el presupuesto
//    alcanza para llegar a Vimeos (el resolver más fiable hoy).
//  - Filtro final por idioma (título + language): solo 'Latino' o 'Subtitulado'.

import { datosTMDB, buscarPosts, buscarCapitulo, embedsDe, limpiarTitulo, consultaDe } from './sitio.js';
import { resolverEmbed, limpiarCabecerasVimeos } from './resolvers.js';
import { calidadDe, servidorDe, tituloStream } from './labels.js';

var PRESUPUESTO_MS = 55000;

function crearVencido(ms) {
  var t0 = Date.now();
  return function () { return Date.now() - t0 > ms; };
}

function normalizarTipo(mediaType) {
  var t = String(mediaType || 'movie').toLowerCase();
  if (t === 'series' || t === 'anime' || t === 'tv') return 'tv';
  return 'movie';
}

// Etiqueta del embed del sitio -> 'Lat' | 'Sub' | 'Esp' | 'Ing'.
// El original asumía latino por defecto y solo miraba "Latino"/"Castellano"/"Subtitulado"/"Inglés";
// aquí además se reconoce la abreviatura real ("Esp") y cualquier idioma no reconocido se trata
// como España y se descarta: preferimos perder un stream antes que colar castellano.
function etiquetaDeIdioma(langCrudo) {
  var s = String(langCrudo || '').toLowerCase();
  if (!s) return 'Lat';
  if (/castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/.test(s)) return 'Esp';
  if (/latino|\blat\b|\blat\.|\[lat\]/.test(s)) return 'Lat';
  if (/subtitulad|\bvose\b|\bvosi\b|\bsub\b|\[sub\]/.test(s)) return 'Sub';
  if (/ingl|\beng\b|\bing\b|english/.test(s)) return 'Ing';
  return 'Esp'; // Idioma no reconocido: se descarta (nunca castellano a la salida).
}

// Etiqueta que viaja en el título del stream.
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

async function getStreams(tmdbId, mediaType, season, episode) {
  var vencido = crearVencido(PRESUPUESTO_MS);
  try {
    var tipo = normalizarTipo(mediaType);
    console.log('[AllpeliculasSE] ID ' + tmdbId + ' tipo ' + tipo + ' S:' + season + ' E:' + episode);

    var info = await datosTMDB(tmdbId, tipo);
    if (!info) {
      console.log('[AllpeliculasSE] Sin datos de TMDB.');
      return [];
    }

    // 1) Buscar el post del título en el sitio
    var matched = null;
    var esperado = tipo === 'tv' ? 'tvshows' : 'movies';
    for (var i = 0; i < info.titles.length; i++) {
      var consulta = consultaDe(info.titles[i]);
      if (!consulta) continue;
      var limpio = limpiarTitulo(info.titles[i]);
      var posts = await buscarPosts(consulta, tipo);
      if (!posts.length) continue;
      for (var a = 0; a < posts.length; a++) {
        if (posts[a].type !== esperado) continue;
        var pt = limpiarTitulo(posts[a].title);
        if (pt.indexOf(limpio) !== -1 || limpio.indexOf(pt) !== -1) { matched = posts[a]; break; }
      }
      if (matched) break;
      for (var b = 0; b < posts.length; b++) {
        if (posts[b].type === esperado) { matched = posts[b]; break; }
      }
      if (matched) break;
    }
    if (!matched) {
      console.log('[AllpeliculasSE] Sin coincidencia en la búsqueda.');
      return [];
    }
    console.log('[AllpeliculasSE] Coincidencia: "' + matched.title + '" (ID ' + matched.id + ')');

    // 2) Episodio concreto para series
    var objetivo = matched.id;
    if (tipo === 'tv') {
      var epId = await buscarCapitulo(matched.id, season, episode);
      if (!epId) {
        console.log('[AllpeliculasSE] Episodio S' + season + 'E' + episode + ' no encontrado.');
        return [];
      }
      objetivo = epId;
      console.log('[AllpeliculasSE] Episodio S' + season + 'E' + episode + ' -> post ' + objetivo);
    }

    // 3) Players del post
    var embeds = await embedsDe(objetivo);
    if (!embeds.length) return [];

    // 4) Resolver solo latino/subtitulado, con embeds sin resolver fuera y
    // ordenados: Vimeos primero (el que siempre resuelve), luego StreamWish,
    // luego VOE y luego VidHide. Antes el barrido de StreamWish (2º en el
    // player) se comía el presupuesto antes de llegar a Vimeos (5º).
    function grupoEmbed(url) {
      var u = String(url || '').toLowerCase();
      if (u.indexOf('vimeos') !== -1 || u.indexOf('vms.sh') !== -1) return 0;
      if (u.indexOf('hlswish') !== -1 || u.indexOf('streamwish') !== -1 || u.indexOf('hglink') !== -1 ||
        u.indexOf('embedwish') !== -1 || u.indexOf('strwish') !== -1 || u.indexOf('hanerix') !== -1 ||
        u.indexOf('awish') !== -1) return 1;
      if (u.indexOf('voe') !== -1) return 2;
      if (u.indexOf('vidhide') !== -1) return 3;
      return 4;
    }
    var embedsOrdenados = [];
    for (var g = 0; g <= 4; g++) {
      for (var o = 0; o < embeds.length; o++) {
        var ou = String((embeds[o] || {}).url || '').toLowerCase();
        if (ou.indexOf('goodstream') !== -1 || ou.indexOf('filemoon') !== -1 || ou.indexOf('videoapp') !== -1) continue;
        if (grupoEmbed(embeds[o].url) === g) embedsOrdenados.push(embeds[o]);
      }
    }
    embeds = embedsOrdenados;
    var streams = [];
    for (var e = 0; e < embeds.length; e++) {
      var embed = embeds[e] || {};
      var url = String(embed.url || '');
      var etiqueta = etiquetaDeIdioma(embed.lang);
      if (etiqueta === 'Esp' || etiqueta === 'Ing') {
        console.log('[AllpeliculasSE] Descartado por idioma (' + embed.lang + '): ' + url);
        continue;
      }
      if (!/^https?:/i.test(url)) continue;
      if (/^(magnet:)/i.test(url) || /\.torrent/i.test(url)) continue;
      if (/sbcom|lvturbo|vanfem|fembed|1fichier|fireload/i.test(url)) continue;
      if (vencido()) {
        console.log('[AllpeliculasSE] Presupuesto agotado, se corta con ' + streams.length + ' streams.');
        break;
      }
      var resuelto = await resolverEmbed(url, vencido);
      if (!resuelto || !resuelto.url) continue;

      var calidad = resuelto.quality || calidadDe(resuelto.url, '1080p');
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
    console.log('[AllpeliculasSE] Streams resueltos: ' + streams.length);

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
    console.log('[AllpeliculasSE] Error: ' + (e && e.message));
    return [];
  }
}

module.exports = { getStreams };
