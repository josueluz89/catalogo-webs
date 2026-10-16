// vimeus — Vimeus (vimeus.com).
// Portado a MasterScrap desde nuvio-providers-latino-v2 / Latinuvio V2
// (providers/vimeus.js; el bundle no declara autor).
// Adaptado a QuickJS (sin Buffer/require('crypto')/matchAll/normalize y con
// parsing de URL propio, porque QuickJS no trae URL) y filtrado a español
// latino y subtitulado: se descartan los streams de español de España.
//
// El original es un bundle de esbuild con un wrapper de reintentos sobre fetch
// (__FETCH_RETRY__) y un require("./stream_labels.js") que en la app siempre
// fallaba; aquí se conserva solo lo que el provider usa de verdad.

import { extraerStreams } from './extractor.js';
import { filtrarStreams } from './filtro.js';

function getStreams(tmdbId, mediaType, season, episode) {
  // Nuvio manda movie | series | anime; las dos últimas se tratan como tv.
  var tipo = (mediaType === 'series' || mediaType === 'anime') ? 'tv' : (mediaType || 'movie');
  return Promise.resolve()
    .then(function () { return extraerStreams(tmdbId, tipo, season, episode); })
    .then(function (streams) { return filtrarStreams(streams); })
    .catch(function () { return []; });
}

module.exports = { getStreams };
