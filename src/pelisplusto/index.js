import { extractStreams } from './extractor.js';

function getStreams(tmdbId, mediaType, season, episode) {
  return extractStreams(tmdbId, mediaType, season, episode)
    .catch(function() { return []; });
}

module.exports = { getStreams };
