// entrepeliculasyseries — EntrePeliculasySeries (entrepeliculasyseries.nz).
// Portado a MasterScrap desde latinuvio (providers/entrepeliculasyseries.js), autor original Latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/require('https')/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.

import { extraer } from './extractor.js';
import { filterWorkingStreams } from '../shared/validate.js';

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

// Validación con fail-open (2026-10-16): las sondas de validación piden el m3u8 con
// Range y los headers del stream, y los CDN de esta familia (morencius/vibuxer, detrás
// de Cloudflare) a veces responden 403 a la sonda aunque la URL acabe de resolverse y
// reproduzca bien. Si la validación mata TODOS los streams recién resueltos, se
// devuelven sin filtrar: un enlace que el reproductor puede intentar vale más que un
// [] por un falso negativo de la sonda. Si extraer() no dio nada, sigue siendo [].
// Recibe la PROMESA de streams (como withWorkingStreams) y la espera antes de filtrar.
function validarConFailOpen(promesaStreams) {
  return Promise.resolve(promesaStreams).then(function (streams) {
    return filterWorkingStreams(streams).then(function (vivos) {
      if (vivos.length) return vivos;
      if (streams && streams.length) return streams;
      return [];
    }).catch(function () {
      return streams || [];
    });
  });
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
  return validarConFailOpen(withTimeout(
    extraer(tmdbId, tipo === 'movie' ? 'movie' : 'tv', season, episode).catch(function () {
      return [];
    }),
    40000
  ));
}

module.exports = { getStreams };
