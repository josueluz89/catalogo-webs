// Pelisplusto — validación con fail-open (reescrita en limpio).
//
// La validación estricta anterior (withWorkingStreams) borraba streams
// recién resueltos cuando el CDN respondía 403 a la sonda, aunque el
// enlace reprodujera bien. La regla nueva: si la validación deja algún
// vivo, se devuelven esos; si mata TODOS los resueltos, se devuelven los
// resueltos sin filtrar; si no se resolvió nada, sigue siendo [].

import { extractStreams } from './extractor.js';
import { filterWorkingStreams } from '../shared/validate.js';

// Cap total lookup at 40s (Nuvio/QuickJS has no setTimeout: runs uncapped there,
// where the app enforces its own 60s limit).
function withTimeout(promise, ms) {
  if (typeof setTimeout === 'undefined') return promise;
  return Promise.race([
    promise,
    new Promise(function(res) { setTimeout(function() { res([]); }, ms); }),
  ]);
}

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

function getStreams(tmdbId, mediaType, season, episode) {
  return withTimeout(
    validarConFailOpen(extractStreams(tmdbId, mediaType, season, episode)),
    40000
  );
}

module.exports = { getStreams };
