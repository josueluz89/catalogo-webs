/**
 * DoramasLatinoX Provider
 * Main entry point.
 */

import { extractStreams } from './extractor.js';

/**
 * Main function called by Nuvio
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[DoramasLatinoX] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
        const streams = await extractStreams(tmdbId, mediaType, season, episode);
        return streams;
    } catch (error) {
        console.error(`[DoramasLatinoX] Error in getStreams: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
