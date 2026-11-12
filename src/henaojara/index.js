// henaojara — HenaoJara (ww1.henaojara.net).
// Portado a MasterScrap desde latinuvio (providers/henaojara.js), autor original Latinuvio.
// Adaptado a QuickJS (sin cheerio/Buffer/matchAll/normalize) y filtrado a español latino y
// subtitulado: se descartan los streams de español de España.
//
// Reescrito limpio 2026-11-12 (ronda catalogo-webs, grupo 4):
// el getStreams anterior encadenaba filterWorkingStreams tras el tope de 55 s.
// Esa validación re-descarga cada URL ya resuelta (el resolver ya fetcheó el
// m3u8 para detectar calidad, así que la sonda no prueba nada nuevo en m3u8)
// y en el arnés su temporizador de 7 s no corta un fetch bloqueado (curl -m 45,
// AbortController ignorado; AGENTS.md §5: la garantía real es menos trabajo,
// no un tope más corto). Medido en la ronda: AoT S1E1 77,5 s y DBS S1E1 60,8 s
// (extraer ~55 s + sonda ~22 s); monoschinos y animeav1 no validan y devuelven
// streams verificados por el propio resolver. henaojara hace lo mismo ahora:
// sin validación, el peor caso es el tope de extraer (55 s) y la app corta
// a los 60 s. AGENTS.md §5: no se re-baja un m3u8 solo para verificarlo si
// la resolución ya es la prueba.

// Tope de tiempo del provider (55 s): la app corta a los 60 s. El extractor
// ya se autolimita (plazo por oleada + guarda de 30 s con 1 stream); este
// tope es solo red de seguridad.
import { extraer } from './extractor.js';

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
 * Anime (series y peliculas) desde ww1.henaojara.net.
 * La ficha marca "Sub Espanol y Latino": si menciona latino/doblaje -> 'Latino', si solo
 * menciona sub/subtitulado -> 'Subtitulado'. Una ficha con castellano se descarta entera:
 * nunca se devuelve espanol de Espana.
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
