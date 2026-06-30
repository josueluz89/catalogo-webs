import { fetchText, fetchWithRetry } from './http.js';
import { resolveVoeStream } from '../shared/voe.js';
import { detectQualityFromM3U8, guessQualityFromUrl } from '../shared/quality.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://latanime.org';

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

function getEmbedResolver(url) {
  if (url.includes('voe.sx') || url.includes('cloudwindow-route.com')) {
    return resolveVoeStream;
  }
  return null;
}

function getServerLabel(url) {
  if (url.includes('voe.sx') || url.includes('cloudwindow')) return 'VOE';
  if (url.includes('streamwish') || url.includes('hlswish') || url.includes('vibuxer')) return 'StreamWish';
  if (url.includes('vidhide') || url.includes('dintezuvio')) return 'VidHide';
  if (url.includes('pixeldrain')) return 'Pixeldrain';
  return 'Online';
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
    const query = title || originalTitle;
    if (!query) return [];

    const searchUrl = `${MAIN_URL}/buscar?q=${encodeURIComponent(query)}`;
    const html = await fetchWithRetry(searchUrl);
    const $ = cheerio.load(html);

    const candidates = [];
    $('div.col-6, div.col-md-6, div.col-md-4, div.item, article, div.post, div.entry').each((i, el) => {
      const anchor = $(el).find('a').first();
      const href = anchor.attr('href');
      const name = $(el).find('h2, h3, span.title, div.text-2xs, img[alt]').first().text().trim() || anchor.attr('title') || '';
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
    if (pageUrl.includes('/ver/')) {
      pageUrl = pageUrl.replace('/ver/', '/anime/').split('-episodio')[0];
    } else if (pageUrl.includes('/media/')) {
      const slug = pageUrl.split('/')[2];
      pageUrl = `${MAIN_URL}/anime/${slug}`;
    }

    if (!pageUrl.startsWith('http')) {
      pageUrl = MAIN_URL + pageUrl;
    }

    const tvHtml = await fetchWithRetry(pageUrl);
    const tv$ = cheerio.load(tvHtml);

    let epUrl = null;
    tv$("div[style*='overflow-y: auto'] > a, a[href*='capitulo'], a[href*='episodio'], a[href*='episode']").each((i, el) => {
      const href = tv$(el).attr('href') || '';
      const name = tv$(el).text().trim();
      const epMatch = name.match(/Capitulo\s+(\d+)/i) || name.match(/Episodio\s+(\d+)/i) || name.match(/-(\d+)$/);
      const epNum = epMatch ? parseInt(epMatch[1], 10) : null;
      if (epNum === episode) {
        epUrl = href;
      }
    });

    if (!epUrl && mediaType === 'movie') {
      epUrl = tv$("div[style*='overflow-y: auto'] > a").first().attr('href') || targetUrl;
    }

    if (!epUrl) return [];

    if (!epUrl.startsWith('http')) {
      epUrl = MAIN_URL + epUrl;
    }

    const playHtml = await fetchWithRetry(epUrl);
    const play$ = cheerio.load(playHtml);

    const playerList = [];
    play$('ul.cap_repro li a, div.player-option a, a[data-player]').each((i, el) => {
      const player = play$(el).attr('data-player');
      if (player) {
        playerList.push(player);
      }
    });

    const downloadList = [];
    play$('div.descarga2 div a, div.download a, a[href*="pixeldrain"], a[href*="mega"]').each((i, el) => {
      const href = play$(el).attr('href');
      if (href) downloadList.push(href);
    });

    const streams = [];

    const addStream = async (url, name) => {
      let cleanUrl = url.replace(/\\/g, '');
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      }

      // Resolve embed URLs to direct streams
      const resolver = getEmbedResolver(cleanUrl);
      if (resolver) {
        const result = await resolver(cleanUrl);
        if (result && result.url) {
          const quality = result.quality || await detectQualityFromM3U8(result.url);
          const serverLabel = getServerLabel(cleanUrl);
          streams.push({
            name: `Latanime Direct (${serverLabel})`,
            title: `${quality || 'HD'} · Latino`,
            url: result.url,
            quality: quality || 'Unknown',
            headers: result.headers || { Referer: MAIN_URL },
          });
          return;
        }
      }

      // Pixeldrain direct
      if (cleanUrl.includes('pixeldrain.com')) {
        const id = cleanUrl.trim().split('/').pop();
        streams.push({
          name: 'Latanime Direct (Pixeldrain)',
          title: `HD · Latino`,
          url: `https://pixeldrain.com/api/file/${id}?download`,
          quality: 'Unknown',
          headers: { Referer: epUrl },
        });
        return;
      }

      // Fallback embed
      streams.push({
        name: `Latanime Embed (${name})`,
        title: `Embed · Latino`,
        url: cleanUrl,
        quality: 'Unknown',
        headers: { Referer: MAIN_URL },
      });
    };

    for (const playerVal of playerList) {
      try {
        const decoded = base64Decode(playerVal);
        const repUrl = `${MAIN_URL}/reproductor?url=${playerVal}`;
        const repHtml = await fetchWithRetry(repUrl);
        const rep$ = cheerio.load(repHtml);
        const iframeSrc = rep$('iframe, embed').attr('src') || decoded;
        if (iframeSrc) {
          await addStream(iframeSrc, 'Player');
        }
      } catch (err) {}
    }

    for (const dlUrl of downloadList) {
      await addStream(dlUrl, 'Download');
    }

    return streams;

  } catch (e) {
    return [];
  }
}
