/**
 * Flixlatam Provider
 * Main entry point.
 */

import { extractStreams } from './extractor.js';

/**
 * Main function called by Nuvio
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[Flixlatam] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
        const streams = await extractStreams(tmdbId, mediaType, season, episode);
        return streams;
    } catch (error) {
        console.error(`[Flixlatam] Error in getStreams: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
