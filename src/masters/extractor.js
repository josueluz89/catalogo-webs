import { fetchText } from './http.js';
import cheerio from 'cheerio-without-node-native';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://ww3.gnulahd.nu';

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
  const year = (data.release_date || data.first_air_date || '').split('-')[0];
  return { title, originalTitle, year };
}

function getServerLabel(url) {
  if (url.includes('voe.sx') || url.includes('tubeless') || url.includes('simpulum') ||
      url.includes('uroch') || url.includes('nathanfromsubject') || url.includes('yip.su') ||
      url.includes('metagnath') || url.includes('donaldlineelse') || url.includes('crystal') ||
      url.includes('cloudwindow')) return 'VOE';
  if (url.includes('they.tube') || url.includes('the.tube')) return 'Tube';
  if (url.includes('filemoon') || url.includes('bysedi')) return 'FileMoon';
  if (url.includes('streamwish') || url.includes('hlswish') || url.includes('vibuxer') || url.includes('strwish')) return 'StreamWish';
  if (url.includes('vidhide') || url.includes('dintezuvio') || url.includes('filelions')) return 'VidHide';
  if (url.includes('uqload')) return 'Uqload';
  if (url.includes('luluvid') || url.includes('lulus')) return 'Lulu';
  if (url.includes('ok.ru') || url.includes('ok video')) return 'OK';
  return 'Online';
}

async function resolveTheyTube(code, resolvePath, authParam, pageUrl) {
  try {
    const resolveUrl = `${MAIN_URL}${resolvePath}${encodeURIComponent(code)}${authParam}`;
    const res = await fetch(resolveUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36', Referer: pageUrl }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.master) {
      return { url: data.master, quality: '1080p', headers: { Referer: MAIN_URL + '/', 'User-Agent': 'Mozilla/5.0' } };
    }
    return null;
  } catch { return null; }
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
    const query = title || originalTitle;
    if (!query) return [];

    const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
    const html = await fetchText(searchUrl);
    const $ = cheerio.load(html);

    const candidates = [];
    $('div.listupd article.bs').each((i, el) => {
      const $el = $(el);
      if ($el.hasClass('styleegg')) return;

      const aTag = $el.find('div.bsx > a');
      const itemTitle = aTag.attr('title') || $el.find('div.tt h2').text().trim();
      const href = aTag.attr('href');
      const typeText = $el.find('div.typez').text().trim();

      if (!href || !itemTitle || href.includes('/blog/')) return;
      if (itemTitle.includes('Mejores') || itemTitle.includes('Cronología')) return;

      const type = typeText.includes('Serie') ? 'tv' :
                   typeText.includes('Anime') ? 'tv' : 'movie';

      candidates.push({ title: itemTitle, href, type, typeText });
    });

    let targetUrl = null;
    let targetType = 'movie';
    const normalizedQuery = normalizeText(query);
    const normalizedOriginal = normalizeText(originalTitle);
    const expectedType = mediaType === 'tv' ? 'tv' : 'movie';

    let bestTvScore = -1;
    let bestTvUrl = null;
    let bestMovieScore = -1;
    let bestMovieUrl = null;

    for (const cand of candidates) {
      const normalizedCand = normalizeText(cand.title);
      let score = 0;

      if (normalizedCand === normalizedQuery || normalizedCand === normalizedOriginal) {
        score = 100;
      } else if (normalizedCand.includes(normalizedQuery) || normalizedCand.includes(normalizedOriginal)) {
        score = 60;
      } else {
        const qWords = normalizedQuery.split(' ').filter(Boolean);
        const oWords = normalizedOriginal.split(' ').filter(Boolean);
        const cWords = normalizedCand.split(' ').filter(Boolean);

        const qMatch = qWords.filter(w => normalizedCand.includes(w)).length;
        const oMatch = oWords.filter(w => normalizedCand.includes(w)).length;
        const cMatch = cWords.filter(w => normalizedQuery.includes(w) || normalizedOriginal.includes(w)).length;

        score = qMatch * 8 + oMatch * 8 + cMatch * 5;
      }

      if (cand.type === 'tv' && score > bestTvScore) {
        bestTvScore = score;
        bestTvUrl = cand.href;
      }
      if (cand.type === 'movie' && score > bestMovieScore) {
        bestMovieScore = score;
        bestMovieUrl = cand.href;
      }
    }

    if (expectedType === 'tv' && bestTvUrl) {
      targetUrl = bestTvUrl;
    } else if (expectedType === 'movie' && bestMovieUrl) {
      targetUrl = bestMovieUrl;
    } else {
      targetUrl = bestTvUrl || bestMovieUrl || (candidates.length > 0 ? candidates[0].href : null);
    }

    if (targetUrl) {
      const matched = candidates.find(c => c.href === targetUrl);
      if (matched) targetType = matched.type;
    }

    if (!targetUrl) return [];

    let pageUrl = targetUrl;
    if (!pageUrl.startsWith('http')) pageUrl = MAIN_URL + pageUrl;

    if (mediaType === 'tv' || targetType === 'tv') {
      const tvHtml = await fetchText(pageUrl);
      const tv$ = cheerio.load(tvHtml);

      let epUrl = null;
      tv$('div.eplister ul li').each((i, el) => {
        const a = tv$(el).find('a');
        const href = a.attr('href');
        const epnumtext = a.find('div.epl-num').text().trim();
        const regex = /(\d+)x(\d+)/;
        const match = regex.exec(epnumtext);
        if (match) {
          const s = parseInt(match[1], 10);
          const e = parseInt(match[2], 10);
          if (s === season && e === episode) {
            epUrl = href;
          }
        }
      });

      if (!epUrl) return [];
      pageUrl = epUrl;
      if (!pageUrl.startsWith('http')) pageUrl = MAIN_URL + pageUrl;
    }

    const playHtml = await fetchText(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });

    const regex = /var\s+(_gnpv_ep_langs|_gd)\s*=\s*(\[.*\]);/;
    const match = regex.exec(playHtml);
    if (!match) return [];

    let resolvePath = null;
    let authParam = null;
    const resolveMatch = playHtml.match(/var\s+RESOLVE\s*=\s*'([^']*)'\s*,\s*AUTH\s*=\s*'([^']*)'/);
    if (resolveMatch) {
      resolvePath = resolveMatch[1];
      authParam = resolveMatch[2];
    }

    const langs = JSON.parse(match[2]);
    const streams = [];

    for (const langobj of langs) {
      const label = langobj.label || '';
      const normalizedLabel = label.toLowerCase();

      if (!normalizedLabel.includes('latino') && !normalizedLabel.includes('mx')) continue;

      for (const srv of (langobj.servers || [])) {
        let cleanSrc = (srv.src || '').replace(/\\\//g, '/');
        if (!cleanSrc) continue;
        if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;

        if ((cleanSrc.includes('they.tube') || cleanSrc.includes('the.tube')) && resolvePath && authParam) {
          const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
          if (codeMatch) {
            const result = await resolveTheyTube(codeMatch[1], resolvePath, authParam, pageUrl);
            if (result) {
              streams.push({
                name: `GnulaHD (${srv.title || 'Tube'})`,
                title: `${result.quality || 'HD'} · Latino · ${srv.title || 'Tube'}`,
                url: result.url,
                quality: result.quality || 'HD',
                headers: result.headers,
              });
            } else {
              streams.push({
                name: `GnulaHD (${srv.title || 'Tube'})`,
                title: `Embed · Latino · ${srv.title || 'Tube'}`,
                url: cleanSrc,
                quality: 'Unknown',
                headers: { Referer: pageUrl, 'User-Agent': 'Mozilla/5.0' },
              });
            }
          }
          continue;
        }

        const serverLabel = getServerLabel(cleanSrc);
        streams.push({
          name: `GnulaHD (${srv.title || serverLabel})`,
          title: `Embed · Latino · ${srv.title || serverLabel}`,
          url: cleanSrc,
          quality: 'Unknown',
          headers: { Referer: pageUrl, 'User-Agent': 'Mozilla/5.0' },
        });
      }
    }

    return streams;
  } catch (err) {
    console.error(`[Masters] Error: ${err.message}`);
    return [];
  }
}
