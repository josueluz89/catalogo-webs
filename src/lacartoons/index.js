import { extractStreams } from './extractor.js';
import { withWorkingStreams } from '../shared/validate.js';
function withTimeout(promise, ms) {
  if (typeof setTimeout === 'undefined') return promise;
  return Promise.race([
    promise,
    new Promise(function(res) { setTimeout(function() { res([]); }, ms); }),
  ]);
}
function getStreams(tmdbId, mediaType, season, episode) {
  return withTimeout(
    withWorkingStreams(extractStreams(tmdbId, mediaType, season, episode)),
    40000
  );
}
module.exports = { getStreams };
