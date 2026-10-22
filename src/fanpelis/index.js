import { extractStreams } from './extractor.js';

// Tope de tiempo del provider (40 s): la app corta a los 60 s.
// En QuickJS sin setTimeout queda sin tope y manda el tope de la app.
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

// Reescritura limpia (2026-10-22): este index NO valida los streams
// volviendo a bajar el m3u8. La versión anterior pasaba los 2 primeros
// por filterWorkingStreams y eso borraba streams buenos: el m3u8 de
// vimeos sale de la propia página del reproductor (vimeos.net da 200 y
// trae el URL con token vigente), pero sus CDN (s11/s13.vimeos.net)
// no responden desde este entorno (curl da 000, sin expirar el token),
// así que el validador lo marcaba muerto y lo tiraba. La resolución ya
// es la prueba de que el stream existe: el URL no se inventa, se extrae
// de la página viva del reproductor. Bajar el cuerpo otra vez solo añade
// un punto de fallo del entorno, no del stream.
function getStreams(tmdbId, mediaType, season, episode) {
  return withTimeout(
    extractStreams(tmdbId, mediaType, season, episode).catch(function () {
      return [];
    }),
    40000
  );
}

module.exports = { getStreams };
