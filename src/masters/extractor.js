/**
 * Extractor Logic for Masters Provider (GnulaHD)
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ' ')      // replace special characters with spaces
        .replace(/\s+/g, ' ')            // collapse spaces
        .trim();
}

async function getMediaTitle(tmdbId, mediaType) {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    console.log(`[Masters] Fetching title from TMDB: ${url}`);
    
    // We can use standard fetch
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
    const data = await res.json();
    const title = mediaType === 'movie' ? data.title : data.name;
    const originalTitle = mediaType === 'movie' ? data.original_title : data.original_name;
    const year = (data.release_date || data.first_air_date || '').split('-')[0];
    return { title, originalTitle, year };
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
        const query = title || originalTitle;
        if (!query) return [];

        const searchUrl = `https://ww3.gnulahd.nu/?s=${encodeURIComponent(query)}`;
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim() || $(el).find('img').attr('alt') || '';
            if (href && href.includes('/ver/')) {
                candidates.push({ text, href });
            }
        });

        let targetUrl = null;
        const normalizedQuery = normalizeText(query);
        const normalizedOriginal = normalizeText(originalTitle);

        for (const cand of candidates) {
            const normalizedCand = normalizeText(cand.text);
            if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
                targetUrl = cand.href;
                break;
            }
        }

        if (!targetUrl && candidates.length > 0) {
            targetUrl = candidates[0].href;
        }

        if (!targetUrl) {
            console.log("[Masters] No media page found on GnulaHD");
            return [];
        }

        let pageUrl = targetUrl;
        if (mediaType === 'tv') {
            console.log(`[Masters] Fetching TV series page to find episode S${season}E${episode}: ${pageUrl}`);
            const tvHtml = await fetchText(pageUrl);
            const tv$ = cheerio.load(tvHtml);

            let epUrl = null;
            const epPattern1 = `-${season}x${episode < 10 ? '0' + episode : episode}`;
            const epPattern2 = `-${season}x${episode}`;

            tv$('a').each((i, el) => {
                const href = tv$(el).attr('href');
                if (href && (href.includes(epPattern1) || href.includes(epPattern2))) {
                    epUrl = href;
                }
            });

            if (!epUrl) {
                console.log(`[Masters] Could not find episode link for S${season}E${episode}`);
                return [];
            }
            pageUrl = epUrl;
        }

        console.log(`[Masters] Fetching player page: ${pageUrl}`);
        const playHtml = await fetchText(pageUrl);

        let dataStr = null;
        const gdMatch = playHtml.match(/var\s+_gd\s*=\s*(\[[\s\S]*?\])\s*;/);
        const epLangsMatch = playHtml.match(/var\s+_gnpv_ep_langs\s*=\s*(\[[\s\S]*?\])\s*;/);

        if (gdMatch) {
            dataStr = gdMatch[1];
        } else if (epLangsMatch) {
            dataStr = epLangsMatch[1];
        }

        if (!dataStr) {
            console.log("[Masters] No video servers found in script tags");
            return [];
        }

        const languages = JSON.parse(dataStr);
        const streams = [];

        for (const lang of languages) {
            const langLabel = lang.label || 'Latino';
            for (const srv of lang.servers || []) {
                if (srv.src) {
                    streams.push({
                        name: `GnulaHD (${srv.title || 'Servidor'})`,
                        title: `${title || query} [${langLabel}]`,
                        url: srv.src,
                        quality: "720p",
                        headers: {
                            "Referer": "https://ww3.gnulahd.nu/"
                        }
                    });
                }
            }
        }

        return streams;

    } catch (err) {
        console.error(`[Masters] Error in extractor: ${err.message}`);
        return [];
    }
}
