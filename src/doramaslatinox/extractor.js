/**
 * Extractor Logic for DoramasLatinoX
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://doramafox.es'; // from DoramasLatinoX.kt line 15

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
        console.error(`[DoramasLatinoX] AES Decryption error: ${e.message}`);
        return null;
    }
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
        const query = title || originalTitle;
        if (!query) return [];

        const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
        console.log(`[DoramasLatinoX] Searching: ${searchUrl}`);
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('div.result-item article').each((i, el) => {
            const titleElement = $(el).find('div.details div.title a');
            const href = titleElement.attr('href');
            const name = titleElement.text().trim();
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
            console.log("[DoramasLatinoX] Media not found on DoramasLatinoX");
            return [];
        }

        let pageUrl = targetUrl;
        if (mediaType === 'tv') {
            console.log(`[DoramasLatinoX] Fetching TV series page: ${pageUrl}`);
            const tvHtml = await fetchText(pageUrl);
            const tv$ = cheerio.load(tvHtml);

            let epUrl = null;
            tv$('ul.episodios a').each((i, el) => {
                const href = tv$(el).attr('href');
                const numText = tv$(el).find('div.numerando').text() || '';
                const parts = numText.split('-');
                const s = parseInt(parts[0], 10) || 1;
                const e = parseInt(parts[1], 10) || 1;

                if (s === season && e === episode) {
                    epUrl = href;
                }
            });

            if (!epUrl) {
                console.log(`[DoramasLatinoX] Episode S${season}E${episode} not found`);
                return [];
            }
            pageUrl = epUrl;
        }

        console.log(`[DoramasLatinoX] Fetching player page: ${pageUrl}`);
        const playHtml = await fetchText(pageUrl);
        const play$ = cheerio.load(playHtml);

        const playerOptions = [];
        play$('li.dooplay_player_option').each((i, el) => {
            const post = play$(el).attr('data-post');
            const type = play$(el).attr('data-type');
            const nume = play$(el).attr('data-nume');
            if (post && type && nume) {
                playerOptions.push({ post, type, nume });
            }
        });

        console.log(`[DoramasLatinoX] Found ${playerOptions.length} player options`);
        const streams = [];

        for (const opt of playerOptions) {
            try {
                const apiUrl = `${MAIN_URL}/wp-json/dooplayer/v2/${opt.post}/${opt.type}/${opt.nume}`;
                console.log(`[DoramasLatinoX] Fetching player API: ${apiUrl}`);
                const apiRes = await fetch(apiUrl);
                if (!apiRes.ok) continue;
                const apiData = await apiRes.json();
                let embedUrl = apiData.embed_url;
                if (!embedUrl) continue;
                embedUrl = embedUrl.replace(/\\/g, '');

                console.log(`[DoramasLatinoX] Fetching embed page: ${embedUrl}`);
                const embedHtml = await fetchText(embedUrl, {
                    headers: { 'Referer': pageUrl }
                });
                const embed$ = cheerio.load(embedHtml);
                const iframeSrc = embed$('iframe').attr('src') || embedUrl;

                // Check for DoramasLatinoX Decryptor custom host
                if (iframeSrc.includes('p2pplay.online') || iframeSrc.includes('doramasfoxito')) {
                    const hash = iframeSrc.split('#').pop().split('/').pop();
                    const u = new URL(iframeSrc);
                    const baseurl = `${u.protocol}//${u.host}`;
                    const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;

                    console.log(`[DoramasLatinoX] Resolving secure player API: ${videoApiUrl}`);
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
                                name: `DoramasLatinoX Direct`,
                                title: `${title || query} [Latino]`,
                                url: parsed.source,
                                quality: "1080p",
                                headers: {
                                    'Referer': iframeSrc,
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0'
                                }
                            });
                            continue;
                        }
                    }
                }

                // Fallback as general embed link
                streams.push({
                    name: `DoramasLatinoX Embed`,
                    title: `${title || query} [Latino]`,
                    url: iframeSrc,
                    quality: "720p",
                    headers: {
                        'Referer': MAIN_URL
                    }
                });

            } catch (err) {
                console.log(`[DoramasLatinoX] Failed resolving option: ${err.message}`);
            }
        }

        return streams;

    } catch (e) {
        console.error(`[DoramasLatinoX] Error in extractor: ${e.message}`);
        return [];
    }
}
