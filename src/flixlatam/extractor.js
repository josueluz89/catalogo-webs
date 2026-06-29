/**
 * Extractor Logic for Flixlatam
 * Resolves secure embeds, solves SHA-256 Proof of Work, and resolves Vidhide/Streamwish & Voe.sx to direct streams.
 */

import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://flixlatam.com';

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

function solvePow(challenge, difficulty, salt) {
    const prefix = "0".repeat(difficulty);
    let nonce = 0;
    while (true) {
        const hash = CryptoJS.SHA256(challenge + nonce).toString(CryptoJS.enc.Hex);
        if (hash.startsWith(prefix)) {
            return CryptoJS.SHA256(challenge + nonce + salt);
        }
        nonce++;
    }
}

function decryptAES(encryptedBase64, powKey) {
    try {
        const decoded = CryptoJS.enc.Base64.parse(encryptedBase64);
        const iv = CryptoJS.lib.WordArray.create(decoded.words.slice(0, 4), 16);
        const ciphertext = CryptoJS.lib.WordArray.create(decoded.words.slice(4), decoded.sigBytes - 16);
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            powKey,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.log(`[Flixlatam] Decryption error: ${e.message}`);
        return null;
    }
}

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

function decryptVoe(encoded) {
    try {
        const vF = rot13(encoded);
        const vF2 = replacePatterns(vF);
        const vF3 = vF2.split("_").join("");
        const vF4 = base64Decode(vF3);
        const vF5 = charShift(vF4, 3);
        const vF6 = vF5.split('').reverse().join('');
        const vAtob = base64Decode(vF6);
        return JSON.parse(vAtob);
    } catch (e) {
        return null;
    }
}

async function resolveVoeStream(embedUrl) {
    try {
        const html = await fetchText(embedUrl);
        const $ = cheerio.load(html);
        
        let encodedVoe = null;
        $('script').each((i, el) => {
            const type = $(el).attr('type');
            if (type === 'application/json') {
                const text = $(el).html().trim();
                const m = text.match(/\[\s*"([^"]+)"\s*\]/);
                if (m) {
                    encodedVoe = m[1];
                }
            }
        });

        if (encodedVoe) {
            const decrypted = decryptVoe(encodedVoe);
            if (decrypted) {
                return decrypted.source || decrypted.direct_access_url;
            }
        }
    } catch (e) {
        console.log(`[Flixlatam] Failed to resolve voe: ${e.message}`);
    }
    return null;
}

async function resolveByseStream(embedUrl) {
    try {
        const u = new URL(embedUrl);
        const code = u.pathname.split('/').pop();
        const apiUrl = `${u.protocol}//${u.host}/api/video`;
        
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': embedUrl,
                'Origin': `${u.protocol}//${u.host}`,
                'Accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify({ code: code })
        });
        
        if (res.ok) {
            const json = await res.json();
            if (json.status === 'success' && json.data && json.data.video) {
                return json.data.video.master;
            }
        }
    } catch (e) {
        console.log(`[Flixlatam] Byse resolver error: ${e.message}`);
    }
    return null;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
    try {
        const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
        const query = title || originalTitle;
        if (!query) return [];

        const searchUrl = `${MAIN_URL}/search?s=${encodeURIComponent(query)}`;
        console.log(`[Flixlatam] Searching: ${searchUrl}`);
        const html = await fetchText(searchUrl);
        const $ = cheerio.load(html);

        const candidates = [];
        $('article.item').each((i, el) => {
            const linkElement = $(el).find('.data h3 a').first();
            const href = linkElement.attr('href');
            const name = linkElement.text().trim();
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
            console.log("[Flixlatam] Media not found on Flixlatam");
            return [];
        }

        let pageUrl = targetUrl;
        if (pageUrl && !pageUrl.startsWith('http')) {
            pageUrl = MAIN_URL + pageUrl;
        }

        if (mediaType === 'tv') {
            console.log(`[Flixlatam] Fetching TV page: ${pageUrl}`);
            const tvHtml = await fetchText(pageUrl);
            const tv$ = cheerio.load(tvHtml);

            let epUrl = null;
            tv$('ul.episodios li').each((i, el) => {
                const epLink = tv$(el).find('.episodiotitle a');
                const href = epLink.attr('href');
                const numerando = tv$(el).find('.numerando').text() || '1-1';
                const parts = numerando.split('-');
                const s = parseInt(parts[0], 10) || 1;
                const e = parseInt(parts[1], 10) || 1;

                if (s === season && e === episode) {
                    epUrl = href;
                }
            });

            if (!epUrl) {
                console.log(`[Flixlatam] Episode S${season}E${episode} not found`);
                return [];
            }
            pageUrl = epUrl;
            if (pageUrl && !pageUrl.startsWith('http')) {
                pageUrl = MAIN_URL + pageUrl;
            }
        }

        console.log(`[Flixlatam] Fetching player page: ${pageUrl}`);
        const playHtml = await fetchText(pageUrl);
        const play$ = cheerio.load(playHtml);

        let iframeUrl = play$('div.play iframe').attr('src') ||
                        play$('iframe[src*="embed69"]').attr('src') ||
                        play$('iframe[src*="/vidurl/"]').attr('src');

        if (!iframeUrl) {
            console.log("[Flixlatam] Player iframe not found");
            return [];
        }

        if (iframeUrl.startsWith('//')) {
            iframeUrl = 'https:' + iframeUrl;
        } else if (iframeUrl.startsWith('/')) {
            iframeUrl = MAIN_URL + iframeUrl;
        }

        console.log(`[Flixlatam] Fetching embed69 player: ${iframeUrl}`);
        const embedHtml = await fetchText(iframeUrl, {
            headers: { 'Referer': pageUrl }
        });

        const powChallengeMatch = embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/);
        const powDifficultyMatch = embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/);
        const powSaltMatch = embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/);

        if (!powChallengeMatch || !powSaltMatch) {
            console.log("[Flixlatam] Challenge tokens not found");
            return [];
        }

        const challenge = powChallengeMatch[1];
        const difficulty = powDifficultyMatch ? parseInt(powDifficultyMatch[1], 10) : 3;
        const salt = powSaltMatch[1];

        console.log(`[Flixlatam] Solving Proof of Work (Diff: ${difficulty})...`);
        const aesKey = solvePow(challenge, difficulty, salt);

        const dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
        if (!dataLinkMatch) {
            console.log("[Flixlatam] No dataLink found in player HTML");
            return [];
        }

        const dataList = JSON.parse(dataLinkMatch[1]);
        const streams = [];

        for (const entry of dataList) {
            const allEmbeds = entry.sortedEmbeds || [];
            const downloadEmbeds = entry.downloadEmbeds || [];

            for (const item of [...allEmbeds, ...downloadEmbeds]) {
                const encryptedLink = item.link;
                if (!encryptedLink) continue;

                const decryptedLink = decryptAES(encryptedLink, aesKey);
                if (decryptedLink && decryptedLink.startsWith('http')) {
                    const fixedUrl = decryptedLink
                        .replace("dintezuvio.com", "vidhide.com")
                        .replace("hglink.to", "streamwish.to")
                        .replace("minochinos.com", "vidhide.com")
                        .replace("ghbrisk.com", "streamwish.to");

                    // Try to resolve embed player to direct playable stream
                    let directStreamUrl = null;
                    
                    if (fixedUrl.includes('voe.sx')) {
                        console.log(`[Flixlatam] Resolving voe stream: ${fixedUrl}`);
                        directStreamUrl = await resolveVoeStream(fixedUrl);
                    } else if (fixedUrl.includes('byse') || fixedUrl.includes('bysedi') || fixedUrl.includes('streamwish') || fixedUrl.includes('vidhide') || fixedUrl.includes('filelions')) {
                        console.log(`[Flixlatam] Resolving Byse stream: ${fixedUrl}`);
                        directStreamUrl = await resolveByseStream(fixedUrl);
                    }

                    if (directStreamUrl) {
                        streams.push({
                            name: `Flixlatam Direct (${item.name || 'Stream'})`,
                            title: `${title || query} [Latino]`,
                            url: directStreamUrl,
                            quality: "1080p",
                            headers: {
                                'Referer': fixedUrl,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });
                    }
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[Flixlatam] Error in extractor: ${e.message}`);
        return [];
    }
}
