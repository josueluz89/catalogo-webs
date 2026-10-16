// animeav1 — AnimeAV1 (animeav1.com).
// Portado a MasterScrap desde latinuvio (providers/animeav1.js), autor original Latinuvio.
// Adaptado a QuickJS (sin cheerio/Buffer/matchAll/normalize) y filtrado a español latino y
// subtitulado: DUB = latino, sin marca = subtitulado; se descartan los streams de español de España.

import { extraer } from './extractor.js';
import { withWorkingStreams } from '../shared/validate.js';

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

/**
 * Anime (y sus peliculas) desde animeav1.com.
 * Doblaje = marca DUB en el embed -> 'Latino'; sin marca -> 'Subtitulado'.
 * Nunca devuelve espanol de Espana.
 *
 * @param {string} tmdbId
 * @param {string} mediaType 'movie' | 'series' | 'tv' | 'anime'
 * @param {number} season
 * @param {number} episode
 */
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = String(mediaType || 'tv').toLowerCase();
  return withWorkingStreams(withTimeout(
    extraer(tmdbId, tipo === 'movie' ? 'movie' : 'tv', season, episode).catch(function () {
      return [];
    }),
    40000
  ));
}

module.exports = { getStreams };
