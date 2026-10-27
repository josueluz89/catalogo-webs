// animeav1 — AnimeAV1 (animeav1.com).
// Portado a MasterScrap desde latinuvio (providers/animeav1.js), autor original Latinuvio.
// Adaptado a QuickJS (sin cheerio/Buffer/matchAll/normalize) y filtrado a español latino y
// subtitulado: DUB = latino, sin marca = subtitulado; se descartan los streams de español de España.

import { extraer } from './extractor.js';

// Tope de tiempo del provider (55 s): la app corta a los 60 s.
// 2026-10-27: ya NO se envuelve con withWorkingStreams — re-bajar cada
// stream para validarlo costaba ~20-30 s y era lo que lo dejaba sobre
// 60 s. La validacion vive ahora dentro de extraer (parada temprana +
// sonda solo del HLS propio; los demas resolvers traen su prueba en la
// pagina del embed viva, fail-open segun AGENTS §5).
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
  return withTimeout(
    extraer(tmdbId, tipo === 'movie' ? 'movie' : 'tv', season, episode).catch(function () {
      return [];
    }),
    55000
  );
}

module.exports = { getStreams };
