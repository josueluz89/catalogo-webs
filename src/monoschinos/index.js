// monoschinos — MonosChinos (vww.monoschinos2.net).
// Portado a MasterScrap desde latinuvio (providers/monoschinos.js), autor original Latinuvio.
// Adaptado a QuickJS (helpers ./cdn_resolvers.js y ./embed69.js inlineados, sin Buffer/matchAll/normalize)
// y filtrado a español latino y subtitulado: se descartan los streams de español de España.

import { extraer } from './extractor.js';
import { filterWorkingStreams } from '../shared/validate.js';

// Tope de tiempo del provider (40 s): la app corta a los 60 s.
function withTimeout(promise, ms) {
  if (typeof setTimeout === 'undefined') return promise;
  return Promise.race([
    promise,
    new Promise(function (res) {
      setTimeout(function () {
        res([]);
      }, ms);
    }),
  ]);
}

// Validación acotada: solo los 2 primeros streams pasan por ranged GET.
// Validar todos duplicaba el tiempo (cada URL resuelta se volvía a bajar)
// y dejaba al provider con 3 s de margen bajo el tope. El resto pasa tal
// cual: ya viene de resolver el embed, no es un enlace inventado.
function validateFirst2(streams) {
  var list = streams || [];
  if (list.length === 0) return Promise.resolve([]);
  var first = list.slice(0, 2);
  var rest = list.slice(2);
  return filterWorkingStreams(first).then(function (valid) {
    var seen = {};
    var out = [];
    for (var i = 0; i < valid.length; i++) { seen[valid[i].url] = 1; out.push(valid[i]); }
    for (var j = 0; j < rest.length; j++) {
      if (!seen[rest[j].url]) { seen[rest[j].url] = 1; out.push(rest[j]); }
    }
    return out;
  });
}

/**
 * Anime desde vww.monoschinos2.net (sitio de anime subtitulado/latino).
 * Sin marca DUB en la ficha -> 'Subtitulado'; con DUB/doblaje/latino -> 'Latino'.
 * Nunca devuelve espanol de Espana.
 *
 * @param {string} tmdbId
 * @param {string} mediaType 'movie' | 'series' | 'tv' | 'anime'
 * @param {number} season
 * @param {number} episode
 */
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = String(mediaType || 'tv').toLowerCase();
  // Nuvio pasa solo 4 argumentos: tmdbId, mediaType, season, episode.
  // El título se resuelve dentro, vía TMDB; extraer() no recibe título.
  return withTimeout(
    extraer(tmdbId, tipo === 'movie' ? 'movie' : 'tv', season, episode).catch(function () {
      return [];
    }).then(validateFirst2),
    40000
  );
}

module.exports = { getStreams };
