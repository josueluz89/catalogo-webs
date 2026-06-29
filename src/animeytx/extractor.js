/**
 * Extractor Logic for AnimeYTX
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://wwv.animeytx.net';

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

        const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
        console.log(`[AnimeYTX] Searching: ${searchUrl}`);
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('article.bs').each((i, el) => {
            const a = $(el).find('a');
            const href = a.attr('href');
            const name = $(el).find('.tt').text().trim() || a.attr('title') || '';
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
            console.log("[AnimeYTX] Media not found on AnimeYTX");
            return [];
        }

        let pageUrl = targetUrl;
        if (mediaType === 'tv') {
            console.log(`[AnimeYTX] Fetching TV page: ${pageUrl}`);
            const tvHtml = await fetchText(pageUrl);
            const tv$ = cheerio.load(tvHtml);

            let epUrl = null;
            tv$('.eplister ul li').each((i, el) => {
                const a = tv$(el).find('a');
                const href = a.attr('href');
                const epNum = parseInt(tv$(el).find('.epl-num').text().trim(), 10);
                // Anime episodes are usually sequential, we match episode
                if (epNum === episode) {
                    epUrl = href;
                }
            });

            if (!epUrl) {
                console.log(`[AnimeYTX] Episode ${episode} not found`);
                return [];
            }
            pageUrl = epUrl;
        }

        console.log(`[AnimeYTX] Fetching player page: ${pageUrl}`);
        const playHtml = await fetchText(pageUrl);
        const play$ = cheerio.load(playHtml);

        const options = [];
        play$('select.mirror option').each((i, el) => {
            const val = play$(el).attr('value');
            const serverName = play$(el).text().trim();
            if (val) {
                options.push({ val, serverName });
            }
        });

        const streams = [];

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

        for (const opt of options) {
            try {
                // Decode base64
                const decodedHtml = base64Decode(opt.val);
                const iframeMatch = decodedHtml.match(/src="([^"]+)"/);
                if (!iframeMatch) continue;
                let iframeUrl = iframeMatch[1].replace(/\\/g, '');

                if (iframeUrl.startsWith('//')) {
                    iframeUrl = 'https:' + iframeUrl;
                }

                if (iframeUrl.includes('vipbanner') || opt.serverName.toLowerCase().includes('vip')) {
                    continue;
                }

                // Handle mytsumi.com custom player
                if (iframeUrl.includes('mytsumi.com')) {
                    console.log(`[AnimeYTX] Loading mytsumi player page: ${iframeUrl}`);
                    const initialRes = await fetchText(iframeUrl, { headers: { 'Referer': pageUrl } });
                    const init$ = cheerio.load(initialRes);
                    const playLink = init$('div.play a').attr('href') || '';
                    const targetUrl = playLink ? playLink : iframeUrl;

                    console.log(`[AnimeYTX] Fetching target player page: ${targetUrl}`);
                    const pageText = await fetchText(targetUrl, { headers: { 'Referer': iframeUrl } });

                    // Find qualities
                    const qualityRegex = /const\s+qualities\s*=\s*(\{.*?\});/;
                    const qualMatch = pageText.match(qualityRegex);
                    if (qualMatch) {
                        const qualJson = JSON.parse(qualMatch[1]);
                        for (const label of Object.keys(qualJson)) {
                            const videoUrl = qualJson[label].replace(/\\/g, '');
                            streams.push({
                                name: `AnimeYTX Direct (${opt.serverName} - ${label})`,
                                title: `${title || query} [Subbed]`,
                                url: videoUrl,
                                quality: label,
                                headers: {
                                    'Referer': 'https://mytsumi.com/'
                                }
                            });
                        }
                    }

                    // Find videoTabs
                    const tabsRegex = /const\s+videoTabs\s*=\s*(\[.*?\]);/;
                    const tabsMatch = pageText.match(tabsRegex);
                    if (tabsMatch) {
                        const tabsJson = JSON.parse(tabsMatch[1]);
                        for (const tab of tabsJson) {
                            let tabUrl = (tab.url || '').replace(/\\/g, '');
                            if (tabUrl && tabUrl !== 'about:blank') {
                                streams.push({
                                    name: `AnimeYTX Tab (${opt.serverName})`,
                                    title: `${title || query} [Subbed]`,
                                    url: tabUrl,
                                    quality: "720p",
                                    headers: {
                                        'Referer': targetUrl
                                    }
                                });
                            }
                        }
                    }

                    // Find downloadsByQuality
                    const dlRegex = /const\s+downloadsByQuality\s*=\s*(\{.*?\});/;
                    const dlMatch = pageText.match(dlRegex);
                    if (dlMatch) {
                        const dlJson = JSON.parse(dlMatch[1]);
                        for (const quality of Object.keys(dlJson)) {
                            const items = dlJson[quality] || [];
                            for (const item of items) {
                                let dlUrl = (item.download_url || '').replace(/\\/g, '');
                                if (dlUrl) {
                                    streams.push({
                                        name: `AnimeYTX Direct (${opt.serverName} - Download ${quality})`,
                                        title: `${title || query} [Subbed]`,
                                        url: dlUrl,
                                        quality: quality,
                                        headers: {
                                            'Referer': targetUrl
                                        }
                                    });
                                }
                            }
                        }
                    }
                    continue;
                }

                // General fallback embed link
                streams.push({
                    name: `AnimeYTX Embed (${opt.serverName})`,
                    title: `${title || query} [Subbed]`,
                    url: iframeUrl,
                    quality: "720p",
                    headers: {
                        'Referer': MAIN_URL
                    }
                });

            } catch (err) {
                console.log(`[AnimeYTX] Failed resolving option: ${err.message}`);
            }
        }

        return streams;

    } catch (e) {
        console.error(`[AnimeYTX] Error in extractor: ${e.message}`);
        return [];
    }
}
