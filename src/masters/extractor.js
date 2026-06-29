/**
 * Extractor Logic for Masters Provider (GnulaHD)
 * Parses movie and series pages, filters for Latino & Subtitulado, and resolves they.tube & voe.sx streams.
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';

// Helpers for Voe.sx decryption
function rot13(str) {
    return str.replace(/[A-Za-z]/g, (c) => {
        return String.fromCharCode(
            c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13)
        );
    });
}

function replacePatterns(str) {
    const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
    let res = str;
    for (const p of patterns) {
        res = res.split(p).join("_");
    }
    return res;
}

function charShift(str, shift) {
    return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) - shift)).join('');
}

function decryptVoe(encoded) {
    try {
        const vF = rot13(encoded);
        const vF2 = replacePatterns(vF);
        const vF3 = vF2.split("_").join("");
        
        // Base64 decode (Hermes compatible)
        const vF4 = atob(vF3);
        const vF5 = charShift(vF4, 3);
        const vF6 = vF5.split('').reverse().join('');
        const vAtob = atob(vF6);
        
        return JSON.parse(vAtob);
    } catch (e) {
        console.log(`[Masters] Voe decryption failed: ${e.message}`);
        return null;
    }
}

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

        // Extract Resolver AUTH token for they.tube
        let resolvePath = null;
        let authParam = null;
        const resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
        if (resolveMatch) {
            resolvePath = resolveMatch[1];
            authParam = resolveMatch[2];
        }

        const languages = JSON.parse(dataStr);
        const streams = [];

        for (const lang of languages) {
            const langLabel = lang.label || 'Latino';
            const normalizedLabel = langLabel.toLowerCase();

            // ONLY keep Latino (or MX) and Subtitulado (US)
            if (normalizedLabel.includes('latino') || normalizedLabel.includes('subtitulado') || normalizedLabel.includes('sub')) {
                for (const srv of lang.servers || []) {
                    let cleanSrc = (srv.src || '').replace(/\\/g, '');
                    if (!cleanSrc) continue;
                    if (cleanSrc.startsWith('//')) {
                        cleanSrc = 'https:' + cleanSrc;
                    }

                    // Resolve they.tube or the.tube links
                    if ((cleanSrc.includes('they.tube') || cleanSrc.includes('the.tube')) && resolvePath && authParam) {
                        try {
                            const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
                            if (codeMatch) {
                                const code = codeMatch[1];
                                const resolveUrl = `https://ww3.gnulahd.nu${resolvePath}${encodeURIComponent(code)}${authParam}`;
                                console.log(`[Masters] Resolving they.tube link: ${resolveUrl}`);
                                
                                const resolveRes = await fetch(resolveUrl, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                                        'Referer': pageUrl
                                    }
                                });
                                if (resolveRes.ok) {
                                    const resolveData = await resolveRes.json();
                                    if (resolveData && resolveData.master) {
                                        streams.push({
                                            name: `GnulaHD Direct (${srv.title || 'they.tube'})`,
                                            title: `${title || query} [${langLabel}]`,
                                            url: resolveData.master,
                                            quality: "1080p",
                                            headers: {
                                                "Referer": "https://ww3.gnulahd.nu/",
                                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                                            }
                                        });
                                        continue; // Skipped embed fallback
                                    }
                                }
                            }
                        } catch (e) {
                            console.log(`[Masters] Failed to resolve they.tube: ${e.message}`);
                        }
                    }

                    // Resolve voe.sx links
                    if (cleanSrc.includes('voe.sx')) {
                        try {
                            console.log(`[Masters] Resolving voe.sx link: ${cleanSrc}`);
                            const voeHtml = await fetchText(cleanSrc);
                            const voe$ = cheerio.load(voeHtml);
                            
                            let encodedVoe = null;
                            voe$('script').each((i, el) => {
                                const type = voe$(el).attr('type');
                                if (type === 'application/json') {
                                    const text = voe$(el).html().trim();
                                    const m = text.match(/\[\s*"([^"]+)"\s*\]/);
                                    if (m) {
                                        encodedVoe = m[1];
                                    }
                                }
                            });

                            if (encodedVoe) {
                                const decrypted = decryptVoe(encodedVoe);
                                const directUrl = decrypted ? (decrypted.source || decrypted.direct_access_url) : null;
                                if (directUrl) {
                                    streams.push({
                                        name: `GnulaHD Direct (${srv.title || 'voe.sx'})`,
                                        title: `${title || query} [${langLabel}]`,
                                        url: directUrl,
                                        quality: "720p",
                                        headers: {
                                            "Referer": cleanSrc,
                                            "Origin": "https://voe.sx/"
                                        }
                                    });
                                    continue; // Skipped embed fallback
                                }
                            }
                        } catch (e) {
                            console.log(`[Masters] Failed to resolve voe.sx: ${e.message}`);
                        }
                    }

                    // Fallback to original embed if resolver failed or wasn't available
                    streams.push({
                        name: `GnulaHD Embed (${srv.title || 'Server'})`,
                        title: `${title || query} [${langLabel}]`,
                        url: cleanSrc,
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
