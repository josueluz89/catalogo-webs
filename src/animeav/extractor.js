/**
 * Extractor Logic for AnimeAV
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://animeav1.com';

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

function decryptAES(hexStr, keyStr, ivStr) {
    try {
        const key = CryptoJS.enc.Utf8.parse(keyStr);
        const iv = CryptoJS.enc.Utf8.parse(ivStr);
        const ciphertext = CryptoJS.enc.Hex.parse(hexStr);
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error(`[AnimeAV] AES Decryption error: ${e.message}`);
        return null;
    }
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
        const query = title || originalTitle;
        if (!query) return [];

        const searchUrl = `${MAIN_URL}/catalogo?search=${encodeURIComponent(query)}`;
        console.log(`[AnimeAV] Searching: ${searchUrl}`);
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('div.grid.grid-cols-2 article.group\\/item').each((i, el) => {
            const anchor = $(el).find('a');
            const href = anchor.attr('href');
            const name = $(el).find('h3').text().trim();
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
            console.log("[AnimeAV] Media not found on AnimeAV");
            return [];
        }

        let pageUrl = targetUrl;
        if (!pageUrl.startsWith('http')) {
            pageUrl = MAIN_URL + pageUrl;
        }

        console.log(`[AnimeAV] Fetching details page: ${pageUrl}`);
        const detailsHtml = await fetchText(pageUrl, { headers: { 'Referer': MAIN_URL } });
        const details$ = cheerio.load(detailsHtml);

        let svelteScript = '';
        details$('script').each((i, el) => {
            const txt = details$(el).html() || '';
            if (txt.includes('sveltekit')) {
                svelteScript = txt;
            }
        });

        // Find episode count and media ID
        const epCountMatch = svelteScript.match(/episodesCount:([0-9]+)/i);
        const mediaIdMatch = svelteScript.match(/\{media:\{id:([0-9]+)/i);
        const totalEp = epCountMatch ? parseInt(epCountMatch[1], 10) : 1;

        let epUrl = null;
        const episodeElements = details$('article.group\\/item');
        if (episodeElements.length > 0) {
            episodeElements.each((i, el) => {
                const href = details$(el).find('a').attr('href') || '';
                const epNumStr = details$(el).find('span.text-lead').text().trim() || '';
                const epNum = parseInt(epNumStr, 10) || 0;

                if (epNum === episode) {
                    epUrl = href;
                }
            });
        } else {
            // Dynamic fallback list
            if (episode <= totalEp) {
                epUrl = `${pageUrl}/${episode}`;
            }
        }

        if (!epUrl) {
            console.log(`[AnimeAV] Episode ${episode} not found`);
            return [];
        }

        if (!epUrl.startsWith('http')) {
            epUrl = MAIN_URL + epUrl;
        }

        console.log(`[AnimeAV] Fetching player page: ${epUrl}`);
        const playHtml = await fetchText(epUrl, { headers: { 'Referer': pageUrl } });
        const play$ = cheerio.load(playHtml);

        let playScript = '';
        play$('script').each((i, el) => {
            const txt = play$(el).html() || '';
            if (txt.includes('__sveltekit')) {
                playScript = txt;
            }
        });

        const embedsData = playScript.substring(playScript.indexOf("embeds:{"));
        const streams = [];

        // Parse embeds
        const types = ["DUB", "SUB"];
        for (const type of types) {
            const listPattern = new RegExp(`${type}:\\[(.*?)\\]`);
            const listMatch = embedsData.match(listPattern);
            if (listMatch) {
                const listStr = listMatch[1];
                const itemPattern = /\{server:"([^"]+)",\s*url:"([^"]+)"\}/g;
                let match;
                while ((match = itemPattern.exec(listStr)) !== null) {
                    const server = match[1];
                    let url = match[2].replace(/\\/g, '');

                    if (url.startsWith('//')) {
                        url = 'https:' + url;
                    }

                    // 1. Decrypt AnimeAVUpns (uns.bio / p2pplay secure players)
                    if (url.includes('uns.bio') || url.includes('api/v1/video')) {
                        try {
                            const hash = url.split('#').pop().split('/').pop();
                            const u = new URL(url);
                            const baseurl = `${u.protocol}//${u.host}`;
                            const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;

                            console.log(`[AnimeAV] Decrypting Upns player: ${videoApiUrl}`);
                            const encoded = (await fetchText(videoApiUrl)).trim();

                            const key = "kiemtienmua911ca";
                            const ivList = ["1234567890oiuytr", "0123456789abcdef"];
                            let decryptedText = null;

                            for (const iv of ivList) {
                                try {
                                    const decrypted = decryptAES(encoded, key, iv);
                                    if (decrypted && decrypted.includes('"source"')) {
                                        decryptedText = decrypted;
                                        break;
                                    }
                                } catch (e) {}
                            }

                            if (decryptedText) {
                                const parsed = JSON.parse(decryptedText);
                                if (parsed.source) {
                                    streams.push({
                                        name: `AnimeAV Direct (Upns - ${type})`,
                                        title: `${title || query} [${type}]`,
                                        url: parsed.source,
                                        quality: "1080p",
                                        headers: {
                                            'Referer': url,
                                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0'
                                        }
                                    });
                                    continue;
                                }
                            }
                        } catch (err) {
                            console.log(`[AnimeAV] Upns decryption failed: ${err.message}`);
                        }
                    }

                    // 2. Resolve PlayerZilla
                    if (url.includes('player.zilla-networks.com')) {
                        const id = url.split('/').pop();
                        streams.push({
                            name: `AnimeAV Direct (PlayerZilla - ${type})`,
                            title: `${title || query} [${type}]`,
                            url: `https://player.zilla-networks.com/m3u8/${id}`,
                            quality: "1080p",
                            headers: {
                                'Referer': epUrl
                            }
                        });
                        continue;
                    }

                    // Fallback embed
                    streams.push({
                        name: `AnimeAV Embed (${server} - ${type})`,
                        title: `${title || query} [${type}]`,
                        url: url,
                        quality: "720p",
                        headers: {
                            'Referer': epUrl
                        }
                    });
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[AnimeAV] Error in extractor: ${e.message}`);
        return [];
    }
}
