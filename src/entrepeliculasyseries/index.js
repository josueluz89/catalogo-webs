// entrepeliculasyseries — EntrePeliculasySeries (entrepeliculasyseries.nz).
// Portado a MasterScrap desde latinuvio (providers/entrepeliculasyseries.js), autor original Latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/require('https')/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.

import { extraer } from './extractor.js';
import { withWorkingStreams } from '../shared/validate.js';

// Tope de tiempo del provider (40 s): la app corta a los 60 s. En QuickJS no hay
// setTimeout y el Promise.race se salta (el limite de la app sigue aplicando).
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
 * Peliculas y series en latino/subtitulado desde entrepeliculasyseries.nz.
 * Nunca devuelve streams de espanol de Espana (los embeds ESP/CAST se descartan).
 *
 * @param {string} tmdbId
 * @param {string} mediaType 'movie' | 'series' | 'tv' | 'anime'
 * @param {number} season
 * @param {number} episode
 */
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = String(mediaType || 'movie').toLowerCase();
  return withWorkingStreams(withTimeout(
    extraer(tmdbId, tipo === 'movie' ? 'movie' : 'tv', season, episode).catch(function () {
      return [];
    }),
    40000
  ));
}

module.exports = { getStreams };
