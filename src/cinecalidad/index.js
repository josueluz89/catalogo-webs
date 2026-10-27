import { extractStreams } from './extractor.js';

// Reescritura limpia (2026-10-27): sin withWorkingStreams. La resolución
// ya es la prueba de que el stream existe (el m3u8 se extrae de la página
// viva del embed); re-sondear cada m3u8 desde este entorno solo añadía
// tiempo y borraba streams buenos cuando el CDN no responde a la sonda.
// En QuickJS sin setTimeout el tope queda sin efecto y manda el de la app.
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

function getStreams(tmdbId, mediaType, season, episode) {
  return withTimeout(
    extractStreams(tmdbId, mediaType, season, episode).catch(function () {
      return [];
    }),
    40000
  );
}

module.exports = { getStreams };
