import { fetchText, fetchJson, fetchWithRetry } from './http.js';
import { resolveVoeStream } from '../shared/voe.js';
import { guessQualityFromUrl, detectQualityFromM3U8 } from '../shared/quality.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';

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
    const html = await fetchWithRetry(searchUrl);
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
      return [];
    }

    let pageUrl = targetUrl;
    if (mediaType === 'tv') {
      const tvHtml = await fetchWithRetry(pageUrl);
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
        return [];
      }
      pageUrl = epUrl;
    }

    const playHtml = await fetchWithRetry(pageUrl);

    let dataStr = null;
    const gdMatch = playHtml.match(/var\s+_gd\s*=\s*(\[[\s\S]*?\])\s*;/);
    const epLangsMatch = playHtml.match(/var\s+_gnpv_ep_langs\s*=\s*(\[[\s\S]*?\])\s*;/);

    if (gdMatch) {
      dataStr = gdMatch[1];
    } else if (epLangsMatch) {
      dataStr = epLangsMatch[1];
    }

    if (!dataStr) {
      return [];
    }

    let resolvePath = null;
    let authParam = null;
    const resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
    if (resolveMatch) {
      resolvePath = resolveMatch[1];
      authParam = resolveMatch[2];
    }

    const languages = JSON.parse(dataStr);
    const streams = [];

    const langPriority = ['latino', 'subtitulado', 'castellano', 'espanol', 'mx'];
    const matchedLangs = [];

    for (const lang of languages) {
      const langLabel = lang.label || 'Latino';
      const normalizedLabel = langLabel.toLowerCase();
      for (const prefix of langPriority) {
        if (normalizedLabel.includes(prefix)) {
          matchedLangs.push(lang);
          break;
        }
      }
    }

    const usedLangs = matchedLangs.length > 0 ? matchedLangs : languages;

    for (const lang of usedLangs) {
      const langLabel = lang.label || 'Latino';
      let labelShort = 'Latino';
      const nl = langLabel.toLowerCase();
      if (nl.includes('subtitulado') || nl.includes('sub')) labelShort = 'Sub';
      else if (nl.includes('castellano') || nl.includes('espanol')) labelShort = 'Esp';

      for (const srv of lang.servers || []) {
        let cleanSrc = (srv.src || '').replace(/\\/g, '');
        if (!cleanSrc) continue;
        if (cleanSrc.startsWith('//')) {
          cleanSrc = 'https:' + cleanSrc;
        }

        if ((cleanSrc.includes('they.tube') || cleanSrc.includes('the.tube')) && resolvePath && authParam) {
          try {
            const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
            if (codeMatch) {
              const code = codeMatch[1];
              const resolveUrl = `https://ww3.gnulahd.nu${resolvePath}${encodeURIComponent(code)}${authParam}`;
              const resolveRes = await fetch(resolveUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                  'Referer': pageUrl,
                },
              });
              if (resolveRes.ok) {
                const resolveData = await resolveRes.json();
                if (resolveData && resolveData.master) {
                  const quality = await detectQualityFromM3U8(resolveData.master);
                  streams.push({
                    name: `GnulaHD Direct (they.tube)`,
                    title: `${quality || 'HD'} · ${labelShort}`,
                    url: resolveData.master,
                    quality: quality || '1080p',
                    headers: {
                      Referer: 'https://ww3.gnulahd.nu/',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                    },
                  });
                }
              }
            }
          } catch (e) {}
        }

        if (cleanSrc.includes('voe.sx')) {
          const result = await resolveVoeStream(cleanSrc);
          if (result) {
            const quality = await detectQualityFromM3U8(result.url);
            streams.push({
              name: `GnulaHD Direct (voe.sx)`,
              title: `${quality || result.quality || 'HD'} · ${labelShort}`,
              url: result.url,
              quality: quality || result.quality || '720p',
              headers: { Referer: cleanSrc, Origin: 'https://voe.sx/' },
            });
          }
        }
      }
    }

    if (streams.length === 0) {
      for (const lang of languages) {
        for (const srv of lang.servers || []) {
          let cleanSrc = (srv.src || '').replace(/\\/g, '');
          if (!cleanSrc) continue;
          if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;
          streams.push({
            name: `GnulaHD Embed (${srv.title || 'server'})`,
            title: `Embed · ${lang.label || 'Latino'}`,
            url: cleanSrc,
            quality: 'Unknown',
            headers: { Referer: 'https://ww3.gnulahd.nu/' },
          });
        }
      }
    }

    return streams;

  } catch (err) {
    return [];
  }
}
