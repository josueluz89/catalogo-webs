import { fetchText, fetchWithRetry, fetchWithTimeout, PROTECTION_HEADERS } from './http.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://flixlatam.com';

const DOMAIN_MAP = {
  'dintezuvio.com': 'vidhide.com',
  'hglink.to': 'streamwish.to',
  'minochinos.com': 'vidhide.com',
  'ghbrisk.com': 'streamwish.to',
};

function mapDomain(url) {
  let result = url;
  for (const [from, to] of Object.entries(DOMAIN_MAP)) {
    if (result.includes(from)) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}

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

function solvePowAsync(challenge, difficulty, salt, maxAttempts = 500000) {
  return new Promise((resolve, reject) => {
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    let attempts = 0;

    function chunk() {
      const start = Date.now();
      while (attempts < maxAttempts && Date.now() - start < 100) {
        const hash = CryptoJS.SHA256(challenge + nonce).toString(CryptoJS.enc.Hex);
        if (hash.startsWith(prefix)) {
          resolve(CryptoJS.SHA256(challenge + nonce + salt));
          return;
        }
        nonce++;
        attempts++;
      }
      if (attempts >= maxAttempts) {
        reject(new Error('PoW max attempts exceeded'));
        return;
      }
      setTimeout(chunk, 0);
    }
    chunk();
  });
}

function decryptAES(encryptedBase64, powKey) {
  try {
    const decoded = CryptoJS.enc.Base64.parse(encryptedBase64);
    const iv = CryptoJS.lib.WordArray.create(decoded.words.slice(0, 4), 16);
    const ciphertext = CryptoJS.lib.WordArray.create(decoded.words.slice(4), decoded.sigBytes - 16);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      powKey,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return null;
  }
}

function getServerLabel(url) {
  if (url.includes('voe.sx') || url.includes('cloudwindow')) return 'VOE';
  if (url.includes('streamwish') || url.includes('hlswish') || url.includes('vibuxer') ||
      url.includes('strwish') || url.includes('premilkyway')) return 'StreamWish';
  if (url.includes('vidhide') || url.includes('dintezuvio') || url.includes('minochinos') ||
      url.includes('dramiyos') || url.includes('dhcplay') || url.includes('smoothpre') ||
      url.includes('dhtpre') || url.includes('vidspeeder') || url.includes('moorearn') ||
      url.includes('travid') || url.includes('vidhidehub') || url.includes('vidhidevip') ||
      url.includes('vidhidepre') || url.includes('kinoger') || url.includes('movearnpre') ||
      url.includes('peytonepre') || url.includes('filelions')) return 'VidHide';
  if (url.includes('bysedikamoum') || url.includes('bysedi') || url.includes('filemoon') ||
      url.includes('rapidvideo')) return 'FileMoon';
  if (url.includes('luluvid') || url.includes('lulus')) return 'Lulu';
  if (url.includes('uqload')) return 'Uqload';
  if (url.includes('goodstream')) return 'GoodStream';
  if (url.includes('vimeos')) return 'Vimeos';
  return 'Online';
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const { title, originalTitle } = await getMediaTitle(tmdbId, mediaType);
    const query = title || originalTitle;
    if (!query) return [];

    const searchUrl = `${MAIN_URL}/search?s=${encodeURIComponent(query)}`;
    const html = await fetchWithRetry(searchUrl, {
      headers: { ...PROTECTION_HEADERS, Referer: `${MAIN_URL}/` },
    });
    const $ = cheerio.load(html);

    const candidates = [];
    $('article.item').each((i, el) => {
      const linkElement = $(el).find('.data h3 a, .poster a').first();
      const href = linkElement.attr('href');
      let name = linkElement.text().trim();
      if (!name) name = $(el).find('.poster img').attr('alt') || '';
      name = name.replace(/^Ver\s+/i, '').replace(/\s+online$/i, '').trim();
      if (href && name) candidates.push({ name, href });
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
      const tvHtml = await fetchWithRetry(pageUrl, {
        headers: { ...PROTECTION_HEADERS, Referer: `${MAIN_URL}/` },
      });
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

      if (!epUrl) return [];
      pageUrl = epUrl;
      if (pageUrl && !pageUrl.startsWith('http')) {
        pageUrl = MAIN_URL + pageUrl;
      }
    }

    const playHtml = await fetchWithRetry(pageUrl, {
      headers: { ...PROTECTION_HEADERS, Referer: `${MAIN_URL}/` },
    });
    const play$ = cheerio.load(playHtml);

    let iframeUrl = play$('div.play iframe').attr('src') ||
                    play$('iframe[src*="embed69"]').attr('src') ||
                    play$('iframe[src*="/vidurl/"]').attr('src');

    if (!iframeUrl) return [];

    if (iframeUrl.startsWith('//')) {
      iframeUrl = 'https:' + iframeUrl;
    } else if (iframeUrl.startsWith('/')) {
      iframeUrl = MAIN_URL + iframeUrl;
    }

    const embedHtml = await fetchWithRetry(iframeUrl, {
      headers: { Referer: pageUrl },
    });

    const powChallengeMatch = embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/);
    const powDifficultyMatch = embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/);
    const powSaltMatch = embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/);

    if (!powChallengeMatch || !powSaltMatch) {
      return [];
    }

    const challenge = powChallengeMatch[1];
    const difficulty = powDifficultyMatch ? parseInt(powDifficultyMatch[1], 10) : 3;
    const salt = powSaltMatch[1];

    let aesKey;
    try {
      aesKey = await solvePowAsync(challenge, difficulty, salt);
    } catch (e) {
      return [];
    }

    const dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
    if (!dataLinkMatch) return [];

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
          const fixedUrl = mapDomain(decryptedLink);
          const serverLabel = getServerLabel(fixedUrl);

          streams.push({
            name: `Flixlatam (${serverLabel})`,
            title: `Embed · Latino · ${serverLabel}`,
            url: fixedUrl,
            quality: 'Unknown',
            headers: { Referer: iframeUrl, 'User-Agent': 'Mozilla/5.0' },
          });
        }
      }
    }

    return streams;

  } catch (e) {
    return [];
  }
}
