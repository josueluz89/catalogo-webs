import { fetchText, fetchWithRetry } from './http.js';
import { detectQualityFromM3U8 } from '../shared/quality.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://animeav1.com';

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getMediaTitle(tmdbId, mediaType) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch from TMDB: ${res.status}`);
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
      { ciphertext },
      key,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return null;
  }
}

function extractEmbedsFromScript(text) {
  const results = [];

  // Try structured embeds:{DUB:[...],SUB:[...]}
  const embedsMatch = text.match(/embeds\s*:\s*\{([\s\S]*?)\}\s*[,;}]/);
  if (embedsMatch) {
    const types = ['DUB', 'SUB', 'LAT', 'ESP'];
    for (const type of types) {
      const listPattern = new RegExp(`${type}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'g');
      let match;
      while ((match = listPattern.exec(embedsMatch[1])) !== null) {
        const items = match[1].match(/\{server:\s*"([^"]*)",\s*url:\s*"([^"]*)"\}/g);
        if (items) {
          for (const item of items) {
            const serverMatch = item.match(/server:\s*"([^"]*)"/);
            const urlMatch = item.match(/url:\s*"([^"]*)"/);
            if (serverMatch && urlMatch) {
              results.push({ server: serverMatch[1], url: urlMatch[1], type });
            }
          }
        }
        // Also try single-quoted version
        const items2 = match[1].match(/\{server:\s*'([^']*)',\s*url:\s*'([^']*)'\}/g);
        if (items2) {
          for (const item of items2) {
            const serverMatch = item.match(/server:\s*'([^']*)'/);
            const urlMatch = item.match(/url:\s*'([^']*)'/);
            if (serverMatch && urlMatch) {
              results.push({ server: serverMatch[1], url: urlMatch[1], type });
            }
          }
        }
      }
    }
  }

  // Try fallback: find any server/url pairs in the whole script
  if (results.length === 0) {
    const pairRegex = /server:\s*["']([^"']*)["']\s*,\s*url:\s*["']([^"']*)["']/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
      results.push({ server: match[1], url: match[2], type: 'Unknown' });
    }
  }

  return results;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
    const query = title || originalTitle;
    if (!query) return [];

    const searchUrl = `${MAIN_URL}/catalogo?search=${encodeURIComponent(query)}`;
    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    const candidates = [];
    $('article.group\\/item, article, div.grid a, a[href*="/anime/"], a[href*="/play/"]').each((i, el) => {
      const anchor = $(el).is('a') ? $(el) : $(el).find('a').first();
      const href = anchor.attr('href');
      const name = $(el).find('h3, h2, span, .title').first().text().trim() || anchor.attr('title') || '';
      if (href && name) {
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

    if (!targetUrl) return [];

    let pageUrl = targetUrl;
    if (!pageUrl.startsWith('http')) {
      pageUrl = MAIN_URL + pageUrl;
    }

    const detailsHtml = await fetchWithRetry(pageUrl, { headers: { Referer: MAIN_URL } });
    const details$ = cheerio.load(detailsHtml);

    // Find sveltekit data
    let svelteScript = '';
    details$('script').each((i, el) => {
      const txt = details$(el).html() || '';
      if (txt.includes('sveltekit') || txt.includes('__sveltekit') || txt.includes('embed') || txt.includes('embeds')) {
        svelteScript = txt;
      }
    });

    let epUrl = null;

    if (mediaType === 'tv') {
      // Try to parse episode
      const epCountMatch = svelteScript.match(/episodesCount[:\s]*([0-9]+)/i);
      const mediaIdMatch = svelteScript.match(/\{media:\{id[:\s]*([0-9]+)/i);

      // Try finding episode links in the page
      details$('article.group\\/item, a[href*="/episodio"], a[href*="/capitulo"], a[href*="/episode"]').each((i, el) => {
        const href = details$(el).attr('href') || details$(el).find('a').attr('href') || '';
        const epNumStr = details$(el).find('span.text-lead, .ep-num, .episode-number').text().trim() ||
                          details$(el).text().match(/\b(\d+)\b/)?.[1] || '';
        const epNum = parseInt(epNumStr, 10) || 0;
        if (epNum === episode) {
          epUrl = href;
        }
      });

      // Dynamic fallback
      if (!epUrl) {
        const totalEp = epCountMatch ? parseInt(epCountMatch[1], 10) : 1;
        if (episode <= totalEp) {
          epUrl = `${pageUrl}/${episode}`;
        }
      }

      if (!epUrl) return [];
      if (!epUrl.startsWith('http')) {
        epUrl = MAIN_URL + epUrl;
      }
    } else {
      epUrl = pageUrl;
    }

    const playHtml = await fetchWithRetry(epUrl, { headers: { Referer: pageUrl } });
    const play$ = cheerio.load(playHtml);

    let playScript = '';
    play$('script').each((i, el) => {
      const txt = play$(el).html() || '';
      if (txt.includes('__sveltekit') || txt.includes('embeds') || txt.includes('embed')) {
        playScript = txt;
      }
    });

    const embeds = extractEmbedsFromScript(playScript);
    const streams = [];

    for (const embed of embeds) {
      let url = embed.url.replace(/\\/g, '');
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }

      const typeLabel = embed.type === 'DUB' ? 'Latino' : embed.type === 'SUB' ? 'Sub' : embed.type;
      const server = embed.server || 'Server';

      // Decrypt Upns (uns.bio / p2pplay)
      if (url.includes('uns.bio') || url.includes('api/v1/video') || url.includes('p2pplay')) {
        try {
          const hash = url.split('#').pop().split('/').pop();
          const u = new URL(url);
          const baseurl = `${u.protocol}//${u.host}`;
          const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;

          const encoded = (await fetchWithRetry(videoApiUrl)).trim();

          const knownKeys = [
            { key: 'kiemtienmua911ca', ivs: ['1234567890oiuytr', '0123456789abcdef'] },
          ];

          let resolved = false;
          for (const k of knownKeys) {
            for (const iv of k.ivs) {
              try {
                const decrypted = decryptAES(encoded, k.key, iv);
                if (decrypted && decrypted.includes('"source"')) {
                  const parsed = JSON.parse(decrypted);
                  if (parsed.source) {
                    const quality = await detectQualityFromM3U8(parsed.source);
                    streams.push({
                      name: `AnimeAV Direct (Upns - ${typeLabel})`,
                      title: `${quality || 'HD'} · ${typeLabel}`,
                      url: parsed.source,
                      quality: quality || '1080p',
                      headers: { Referer: url },
                    });
                    resolved = true;
                    break;
                  }
                }
              } catch (e) {}
            }
            if (resolved) break;
          }
          if (resolved) continue;
        } catch (err) {}
      }

      // PlayerZilla
      if (url.includes('player.zilla-networks.com')) {
        const id = url.split('/').pop();
        const m3u8Url = `https://player.zilla-networks.com/m3u8/${id}`;
        const quality = await detectQualityFromM3U8(m3u8Url);
        streams.push({
          name: `AnimeAV Direct (PlayerZilla - ${typeLabel})`,
          title: `${quality || 'HD'} · ${typeLabel}`,
          url: m3u8Url,
          quality: quality || '1080p',
          headers: { Referer: epUrl },
        });
        continue;
      }

      // Fallback embed
      streams.push({
        name: `AnimeAV Embed (${server} - ${typeLabel})`,
        title: `Embed · ${typeLabel}`,
        url,
        quality: 'Unknown',
        headers: { Referer: epUrl },
      });
    }

    return streams;

  } catch (e) {
    return [];
  }
}
