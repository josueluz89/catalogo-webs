// cinemitas — Cinemitas (cinemitas.org).
// Portado a MasterScrap desde nuvio-providers-latino-v2 / Latinuvio V2
// (providers/cinemitas.js; el bundle no declara autor).
// Adaptado a QuickJS: fuera cheerio y URLSearchParams, sin Buffer/matchAll/
// normalize y con parsing de URL propio; los resolvers de hosts que el original
// pedia a ./cdn_resolvers (uqload, goodstream, vimeos, bysezoxexe, audinifer,
// vidara) van inline. Salida filtrada a español latino y subtitulado: las
// opciones CASTELLANO del reproductor se descartan antes de resolverlas.

import { extraerStreams } from './extractor.js';
import { filtrarStreams } from './filtro.js';

function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = (mediaType === 'series' || mediaType === 'anime') ? 'tv' : (mediaType || 'movie');
  return Promise.resolve()
    .then(function () { return extraerStreams(tmdbId, tipo, season, episode); })
    .then(function (streams) { return filtrarStreams(streams); })
    .catch(function (e) {
      console.error('[Cinemitas] Error: ' + (e && e.message));
      return [];
    });
}

module.exports = { getStreams };
