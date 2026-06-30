import { fetchText, fetchWithRetry } from './http.js';
import { detectQualityFromM3U8 } from '../shared/quality.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://doramafox.es';

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

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
    const query = title || originalTitle;
    if (!query) return [];

    const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    const candidates = [];
    $('div.result-item article, article.result-item, div.item, article.post, article').each((i, el) => {
      const titleElement = $(el).find('div.details div.title a, h3 a, h2 a, a[href*="doramafox"]').first();
      const href = titleElement.attr('href') || $(el).find('a').first().attr('href');
      const name = titleElement.text().trim() || $(el).find('img').attr('alt') || '';
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
    if (pageUrl && !pageUrl.startsWith('http')) {
      pageUrl = MAIN_URL + pageUrl;
    }

    if (mediaType === 'tv') {
      const tvHtml = await fetchWithRetry(pageUrl);
      const tv$ = cheerio.load(tvHtml);

      let epUrl = null;
      tv$('ul.episodios a, div.episodios a, a[href*="episodio"], a[href*="capitulo"]').each((i, el) => {
        const href = tv$(el).attr('href');
        const numText = tv$(el).find('div.numerando, span.numerando').text() ||
                         tv$(el).text().match(/(\d+)x(\d+)/)?.[0] || '1-1';
        const parts = numText.split('-');
        const s = parseInt(parts[0], 10) || 1;
        const e = parseInt(parts[1], 10) || 1;
        if (s === season && e === episode) {
          epUrl = href;
        }
      });

      if (!epUrl) return [];
      pageUrl = epUrl;
      if (!pageUrl.startsWith('http')) {
        pageUrl = MAIN_URL + pageUrl;
      }
    }

    const playHtml = await fetchWithRetry(pageUrl);
    const play$ = cheerio.load(playHtml);

    const playerOptions = [];
    play$('li.dooplay_player_option, div.dooplay_player_option, a[data-post]').each((i, el) => {
      const post = play$(el).attr('data-post');
      const type = play$(el).attr('data-type');
      const nume = play$(el).attr('data-nume');
      if (post && type && nume) {
        playerOptions.push({ post, type, nume });
      }
    });

    const streams = [];

    // Try multiple IVs for AES decryption
    const knownKeys = [
      { key: 'kiemtienmua911ca', ivs: ['1234567890oiuytr', '0123456789abcdef'] },
    ];

    for (const opt of playerOptions) {
      try {
        const apiUrl = `${MAIN_URL}/wp-json/dooplayer/v2/${opt.post}/${opt.type}/${opt.nume}`;
        const apiRes = await fetch(apiUrl);
        if (!apiRes.ok) continue;
        const apiData = await apiRes.json();
        let embedUrl = apiData.embed_url;
        if (!embedUrl) continue;
        embedUrl = embedUrl.replace(/\\/g, '');

        const embedHtml = await fetchWithRetry(embedUrl, {
          headers: { Referer: pageUrl },
        });
        const embed$ = cheerio.load(embedHtml);
        const iframeSrc = embed$('iframe').attr('src') || embedUrl;

        let resolved = false;
        if (iframeSrc.includes('p2pplay.online') || iframeSrc.includes('doramasfoxito') || iframeSrc.includes('uns.bio')) {
          const hash = iframeSrc.split('#').pop().split('/').pop();
          const u = new URL(iframeSrc);
          const baseurl = `${u.protocol}//${u.host}`;
          const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;

          const encoded = (await fetchWithRetry(videoApiUrl)).trim();

          for (const k of knownKeys) {
            for (const iv of k.ivs) {
              try {
                const decrypted = decryptAES(encoded, k.key, iv);
                if (decrypted && decrypted.includes('"source"')) {
                  const parsed = JSON.parse(decrypted);
                  if (parsed.source) {
                    const quality = await detectQualityFromM3U8(parsed.source);
                    streams.push({
                      name: 'DoramasLatinoX Direct',
                      title: `${quality || 'HD'} · Latino`,
                      url: parsed.source,
                      quality: quality || '1080p',
                      headers: {
                        Referer: iframeSrc,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
                      },
                    });
                    resolved = true;
                    break;
                  }
                }
              } catch (e) {}
            }
            if (resolved) break;
          }
        }

        if (!resolved) {
          streams.push({
            name: 'DoramasLatinoX Embed',
            title: 'Embed · Latino',
            url: iframeSrc,
            quality: 'Unknown',
            headers: { Referer: MAIN_URL },
          });
        }

      } catch (err) {}
    }

    return streams;

  } catch (e) {
    return [];
  }
}
