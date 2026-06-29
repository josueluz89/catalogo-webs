/**
 * Extractor Logic for Latanime
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://latanime.org';

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
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
    const data = await res.json();
    const title = mediaType === 'movie' ? data.title : data.name;
    const originalTitle = mediaType === 'movie' ? data.original_title : data.original_name;
    return { title, originalTitle };
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
        const query = title || originalTitle;
        if (!query) return [];

        const searchUrl = `${MAIN_URL}/buscar?q=${encodeURIComponent(query)}`;
        console.log(`[Latanime] Searching: ${searchUrl}`);
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('div.col-6, div.col-md-6, div.col-md-4, div.item').each((i, el) => {
            const anchor = $(el).find('a');
            const href = anchor.attr('href');
            const name = $(el).find('h2, h3, span.title, div.text-2xs').text().trim();
            if (href) {
                candidates.push({ name, href });
            }
        });

        let targetUrl = null;
        const normalizedQuery = normalizeText(query);
        const normalizedOriginal = normalizeText(originalTitle);

        for (const cand of candidates) {
            const normalizedCand = normalizeText(cand.name);
            if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
                targetUrl = cand.href;
                break;
            }
        }

        if (!targetUrl && candidates.length > 0) {
            targetUrl = candidates[0].href;
        }

        if (!targetUrl) {
            console.log("[Latanime] Media not found on Latanime");
            return [];
        }

        // Clean href
        let pageUrl = targetUrl;
        if (pageUrl.includes('/ver/')) {
            pageUrl = pageUrl.replace('/ver/', '/anime/').split('-episodio')[0];
        } else if (pageUrl.includes('/media/')) {
            const slug = pageUrl.split('/')[2];
            pageUrl = `${MAIN_URL}/anime/${slug}`;
        }

        if (!pageUrl.startsWith('http')) {
            pageUrl = MAIN_URL + pageUrl;
        }

        console.log(`[Latanime] Fetching details page: ${pageUrl}`);
        const tvHtml = await fetchText(pageUrl);
        const tv$ = cheerio.load(tvHtml);

        let epUrl = null;
        tv$("div[style*='overflow-y: auto'] > a").each((i, el) => {
            const href = tv$(el).attr('href') || '';
            const name = tv$(el).text().trim();
            const epMatch = name.match(/Capitulo\s+(\d+)/i);
            const epNum = epMatch ? parseInt(epMatch[1], 10) : null;
            
            if (epNum === episode) {
                epUrl = href;
            }
        });

        // Fallback if only 1 episode or Movie
        if (!epUrl && mediaType === 'movie') {
            // Find any episode link or use targetUrl directly
            epUrl = tv$("div[style*='overflow-y: auto'] > a").first().attr('href') || targetUrl;
        }

        if (!epUrl) {
            console.log(`[Latanime] Episode ${episode} not found`);
            return [];
        }

        if (!epUrl.startsWith('http')) {
            epUrl = MAIN_URL + epUrl;
        }

        console.log(`[Latanime] Fetching player page: ${epUrl}`);
        const playHtml = await fetchText(epUrl);
        const play$ = cheerio.load(playHtml);

        const playerList = [];
        play$('ul.cap_repro li a').each((i, el) => {
            const player = play$(el).attr('data-player');
            if (player) {
                playerList.push(player);
            }
        });

        const downloadList = [];
        play$('div.descarga2 div a').each((i, el) => {
            const href = play$(el).attr('href');
            if (href) {
                downloadList.push(href);
            }
        });

        const streams = [];

        // Helper to add streams
        const addStream = (url, name) => {
            let cleanUrl = url.replace(/\\/g, '');
            if (cleanUrl.startsWith('//')) {
                cleanUrl = 'https:' + cleanUrl;
            }
            if (cleanUrl.includes('pixeldrain.com')) {
                const id = cleanUrl.trim().split('/').pop();
                streams.push({
                    name: `Latanime Direct (Pixeldrain)`,
                    title: `${title || query} [Latino]`,
                    url: `https://pixeldrain.com/api/file/${id}?download`,
                    quality: "720p",
                    headers: {
                        'Referer': epUrl
                    }
                });
            } else {
                streams.push({
                    name: `Latanime Embed (${name})`,
                    title: `${title || query} [Latino]`,
                    url: cleanUrl,
                    quality: "720p",
                    headers: {
                        'Referer': MAIN_URL
                    }
                });
            }
        };

function base64Decode(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input.replace(/=+$/, '');
    let output = '';
    if (str.length % 4 === 1) return '';
    for (let i = 0, bc = 0, bs = 0; i < str.length; i++) {
        const char = str.charAt(i);
        const idx = chars.indexOf(char);
        if (idx === -1) continue;
        bs = bc % 4 ? bs * 64 + idx : idx;
        if (bc++ % 4) {
            output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
    }
    return output;
}

        // 1. Resolve players
        for (const playerVal of playerList) {
            try {
                const decoded = base64Decode(playerVal);
                const repUrl = `${MAIN_URL}/reproductor?url=${playerVal}`;
                console.log(`[Latanime] Fetching player: ${repUrl}`);
                const repHtml = await fetchText(repUrl);
                const rep$ = cheerio.load(repHtml);
                const iframeSrc = rep$('iframe, embed').attr('src') || decoded;
                if (iframeSrc) {
                    addStream(iframeSrc, "Player");
                }
            } catch (err) {
                console.log(`[Latanime] Error resolving player: ${err.message}`);
            }
        }

        // 2. Resolve downloads
        for (const dlUrl of downloadList) {
            addStream(dlUrl, "Download");
        }

        return streams;

    } catch (e) {
        console.error(`[Latanime] Error in extractor: ${e.message}`);
        return [];
    }
}
