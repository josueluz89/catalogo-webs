// elifilms — EliFilms (allcalidad.re).
// Portado a MasterScrap desde latinuvio (providers/elifilms.js), autor original del port
// a Nuvio: el equipo de latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/new URL/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.
//
// Cambios frente al original, además de los límites del runtime:
//  - Fuera el require("./stream_labels.js"): lo aprovechable queda en ./labels.js.
//  - Los embeds marcados castellano se descartan ANTES de resolverlos (ni una petición de España).
//  - El barrido de espejos de StreamWish ya no usa forEach(async) + setTimeout: con eso el
//    provider se colgaba (>70 s) y no llegaba a devolver nada en la película.
//  - Retirados GoodStream (HTTP 522 a los 20 s), FileMoon (API en 404) y los hosts que el
//    original ya saltaba a mano (sbcom/lvturbo/vanfem/fembed/1fichier/fireload).
//  - Presupuesto de 35 s para todo el provider.

import { datosTMDB, buscarPosts, capitulosDe, embedsDe, limpiarTitulo, consultaDe } from './sitio.js';
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

// Compara título del post con los títulos de TMDB (incluye original_title) y, si el post trae
// el año entre paréntesis, exige ±1 año. Igual que el original.
function coincideConTitulo(post, limpio, year) {
  var pt = limpiarTitulo(post.title);
  var po = limpiarTitulo(post.originalTitle || '');
  var ok = pt.indexOf(limpio) !== -1 || limpio.indexOf(pt) !== -1 ||
    (!!po && (po.indexOf(limpio) !== -1 || limpio.indexOf(po) !== -1));
  if (!ok) return false;
  if (year) {
    var m = String(post.title || '').match(/\((\d{4})\)/);
    if (m) return Math.abs(parseInt(m[1], 10) - parseInt(year, 10)) <= 1;
  }
  return true;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  var vencido = crearVencido(PRESUPUESTO_MS);
  try {
    var tipo = normalizarTipo(mediaType);
    console.log('[EliFilms] ID ' + tmdbId + ' tipo ' + tipo + ' S:' + season + ' E:' + episode);

    var info = await datosTMDB(tmdbId, tipo);
    if (!info) {
      console.log('[EliFilms] Sin datos de TMDB.');
      return [];
    }

    // 1) Buscar el post
    var matched = null;
    for (var i = 0; i < info.titles.length; i++) {
      var consulta = consultaDe(info.titles[i]);
      if (!consulta) continue;
      var limpio = limpiarTitulo(info.titles[i]);
      var posts = await buscarPosts(consulta, tipo);
      if (!posts.length) continue;
      for (var a = 0; a < posts.length; a++) {
        if (coincideConTitulo(posts[a], limpio, info.year)) { matched = posts[a]; break; }
      }
      if (matched) break;
      // Respaldo del original: el primer resultado solo si al menos comparte el título limpio.
      if (posts.length && coincideConTitulo(posts[0], limpio, '')) { matched = posts[0]; break; }
    }
    if (!matched) {
      console.log('[EliFilms] Sin coincidencia.');
      return [];
    }
    console.log('[EliFilms] Coincidencia: "' + matched.title + '" (ID ' + matched.id + ')');

    // 2) Episodio concreto para series
    var objetivo = matched.id;
    if (tipo === 'tv') {
      var caps = await capitulosDe(matched.id);
      if (!caps || !caps.length) {
        console.log('[EliFilms] Sin episodios.');
        return [];
      }
      var epMatch = null;
      for (var c = 0; c < caps.length; c++) {
        if (parseInt(caps[c].season_number, 10) === parseInt(season, 10) && parseInt(caps[c].episode_number, 10) === parseInt(episode, 10)) {
          epMatch = caps[c];
          break;
        }
      }
      if (!epMatch) {
        console.log('[EliFilms] Episodio S' + season + 'E' + episode + ' no encontrado.');
        return [];
      }
      objetivo = epMatch._id || epMatch.id;
      console.log('[EliFilms] Episodio S' + season + 'E' + episode + ' -> post ' + objetivo);
    }

    // 3) Players
    var embeds = await embedsDe(objetivo);
    if (!embeds.length) {
      console.log('[EliFilms] Sin embeds.');
      return [];
    }

    // 4) Resolver solo latino/subtitulado, descartando de entrada los embeds
    // sin resolver (goodstream, filemoon, videoapp). El orden del player ya
    // trae Vimeos primero y se conserva.
    var embedsUtiles = [];
    for (var f = 0; f < embeds.length; f++) {
      var fu = String((embeds[f] || {}).url || '').toLowerCase();
      if (fu.indexOf('goodstream') !== -1 || fu.indexOf('filemoon') !== -1 || fu.indexOf('videoapp') !== -1) continue;
      embedsUtiles.push(embeds[f]);
    }
    embeds = embedsUtiles;
    var streams = [];
    for (var e = 0; e < embeds.length; e++) {
      var embed = embeds[e] || {};
      var url = String(embed.url || '').replace(/\\\//g, '/');
      var etiqueta = etiquetaDeIdioma(embed.lang || embed.language || '');
      if (etiqueta === 'Esp' || etiqueta === 'Ing') {
        console.log('[EliFilms] Descartado por idioma (' + (embed.lang || embed.language || '') + '): ' + url);
        continue;
      }
      if (!/^https?:/i.test(url)) continue;
      var uLow = url.toLowerCase();
      if (uLow.indexOf('sbcom') !== -1 || uLow.indexOf('lvturbo') !== -1 || uLow.indexOf('vanfem') !== -1 ||
        uLow.indexOf('fembed') !== -1 || uLow.indexOf('1fichier') !== -1 || uLow.indexOf('fireload') !== -1) continue;
      if (/^magnet:/i.test(url) || uLow.indexOf('.torrent') !== -1) continue;
      if (vencido()) {
        console.log('[EliFilms] Presupuesto agotado, se corta con ' + streams.length + ' streams.');
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
    console.log('[EliFilms] Streams resueltos: ' + streams.length);

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
    console.log('[EliFilms] Error: ' + (e && e.message));
    return [];
  }
}

module.exports = { getStreams };
