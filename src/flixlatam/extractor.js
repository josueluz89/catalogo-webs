import { fetchText, fetchWithRetry, fetchWithTimeout } from './http.js';
import { resolveVoeStream } from '../shared/voe.js';
import { guessQualityFromUrl, detectQualityFromM3U8 } from '../shared/quality.js';
import cheerio from 'cheerio-without-node-native';
import CryptoJS from 'crypto-js';

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

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://flixlatam.com';

const DOMAIN_MAP = {
  'hglink.to': 'vibuxer.com',
  'ghbrisk.com': 'vibuxer.com',
  'premilkyway.com': 'streamwish.to',
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

function unpackPacked(source) {
  try {
    const m = source.match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!m) return null;
    const [, str, base, count, dictStr] = m;
    const dict = dictStr.split('|');
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const decode = (s) => {
      let n = 0;
      for (const ch of s) {
        const idx = alphabet.indexOf(ch);
        if (idx === -1) return NaN;
        n = n * parseInt(base) + idx;
      }
      return n;
    };
    return str.replace(/\b([0-9a-zA-Z]+)\b/g, (w) => {
      const n = decode(w);
      return (dict[n] && dict[n] !== '') ? dict[n] : w;
    });
  } catch (e) {
    return null;
  }
}

async function resolveHLSWishStream(embedUrl) {
  try {
    const origin = new URL(embedUrl).origin;

    const html = await fetchWithRetry(embedUrl, {
      headers: {
        Referer: 'https://flixlatam.com/',
        Origin: 'https://flixlatam.com',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    });

    // Direct file: pattern
    const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
    if (fileMatch) {
      let url = fileMatch[1];
      if (url.startsWith('/')) url = origin + url;
      if (url.includes('vibuxer.com/stream/')) {
        try {
          const redirRes = await fetchWithTimeout(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', Referer: origin + '/' },
          });
          if (redirRes.url && redirRes.url.includes('.m3u8')) {
            url = redirRes.url;
          }
        } catch (e) {}
      }
      const quality = await detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + '/', 'User-Agent': 'Mozilla/5.0' } };
    }

    // Unpack eval
    const unpacked = unpackPacked(html);
    if (unpacked) {
      const hlsMatch = unpacked.match(/"hls[234]"\s*:\s*"([^"]+)"/);
      if (hlsMatch) {
        let url = hlsMatch[1];
        if (url.startsWith('/')) url = origin + url;
        const quality = await detectQualityFromM3U8(url);
        return { url, quality, headers: { Referer: origin + '/', 'User-Agent': 'Mozilla/5.0' } };
      }
    }

    // Bare m3u8 in page
    const bareMatch = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
    if (bareMatch) {
      const quality = await detectQualityFromM3U8(bareMatch[0]);
      return { url: bareMatch[0], quality, headers: { Referer: origin + '/' } };
    }

    return null;
  } catch (e) {
    return null;
  }
}

function normalizeVidHideUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname
      .replace(/\/download(?:\/.*)?$/, '')
      .replace(/\/d\/(.+)/, '/v/$1')
      .replace(/\/file\/(.+)/, '/v/$1')
      .replace(/\/f\/(.+)/, '/v/$1');
    return u.toString();
  } catch {
    return rawUrl;
  }
}

async function resolveVidHideProStream(embedUrl) {
  try {
    const normalizedUrl = normalizeVidHideUrl(embedUrl);
    const origin = new URL(normalizedUrl).origin;

    const html = await fetchWithRetry(normalizedUrl, {
      headers: {
        Referer: origin + '/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    });

    let script = null;

    const packed = unpackPacked(html);
    if (packed) {
      let data = packed;
      if (data.includes('var links')) {
        data = data.substring(data.indexOf('var links'));
      }
      script = data;
    }

    if (!script) {
      const srcMatch = html.match(/<script[^>]*>([\s\S]*?sources:[\s\S]*?)<\/script>/i);
      if (srcMatch) {
        script = srcMatch[1];
      }
    }

    if (!script) return null;

    const m3u8Regex = /:\s*"([^"]*\.m3u8[^"]*)"/i;
    const m3u8Match = script.match(m3u8Regex);
    if (!m3u8Match) return null;

    let url = m3u8Match[1];
    if (url.startsWith('/')) url = origin + url;
    if (!url.startsWith('http')) url = origin + '/' + url;

    const quality = await detectQualityFromM3U8(url);
    return { url, quality, headers: { Referer: origin + '/', Origin: origin } };
  } catch (e) {
    return null;
  }
}

async function resolveFilemoonStream(embedUrl) {
  try {
    const defaultHeaders = {
      'Referer': embedUrl,
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    };

    const initialResponse = await fetchWithRetry(embedUrl, {
      headers: { ...defaultHeaders, Referer: 'https://flixlatam.com/' },
    });

    const iframeSrc = initialResponse.match(/<iframe[^>]*src=["']([^"']+)["']/i);
    if (iframeSrc) {
      let iframeUrl = iframeSrc[1];
      if (!iframeUrl.startsWith('http')) {
        iframeUrl = new URL(embedUrl).origin + iframeUrl;
      }
      const iframeHtml = await fetchWithRetry(iframeUrl, {
        headers: { ...defaultHeaders, 'Accept-Language': 'en-US,en;q=0.5', Referer: embedUrl },
      });
      const unpacked = unpackPacked(iframeHtml);
      if (unpacked) {
        const videoMatch = unpacked.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
        if (videoMatch) {
          let url = videoMatch[1];
          if (!url.startsWith('http')) url = new URL(iframeUrl).origin + url;
          const quality = await detectQualityFromM3U8(url);
          return { url, quality, headers: { Referer: new URL(iframeUrl).origin + '/' } };
        }
      }
      return null;
    }

    const unpacked = unpackPacked(initialResponse);
    if (unpacked) {
      const videoMatch = unpacked.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
      if (videoMatch) {
        let url = videoMatch[1];
        if (!url.startsWith('http')) url = new URL(embedUrl).origin + url;
        const quality = await detectQualityFromM3U8(url);
        return { url, quality, headers: { Referer: new URL(embedUrl).origin + '/' } };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function resolveLulusStream(embedUrl) {
  try {
    const origin = new URL(embedUrl).origin;
    const filecode = embedUrl.replace(/\/+$/, '').split('/').pop();
    if (!filecode) return null;

    const res = await fetch(origin + '/dl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        Referer: origin,
      },
      body: new URLSearchParams({
        op: 'embed',
        file_code: filecode,
        auto: '1',
        referer: embedUrl,
      }),
    });

    if (!res.ok) return null;
    const html = await res.text();
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?vplayer[\s\S]*?)<\/script>/i);
    if (!scriptMatch) return null;
    const fileMatch = scriptMatch[1].match(/file\s*:\s*"([^"]+)"/);
    if (!fileMatch) return null;

    let url = fileMatch[1];
    if (url.startsWith('/')) url = origin + url;
    return { url, quality: '1080p', headers: { Referer: origin + '/' } };
  } catch (e) {
    return null;
  }
}

async function resolveUqloadStream(embedUrl) {
  try {
    const origin = new URL(embedUrl).origin;
    const html = await fetchWithRetry(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
        Referer: origin + '/',
      },
    });

    const unpacked = unpackPacked(html);
    if (!unpacked) return null;

    const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
    if (m3u8Match) {
      const quality = await detectQualityFromM3U8(m3u8Match[0]);
      return { url: m3u8Match[0], quality, headers: { Referer: origin + '/', Origin: origin } };
    }

    const mp4Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/i);
    if (mp4Match) {
      return { url: mp4Match[0], quality: '1080p', headers: { Referer: origin + '/', Origin: origin } };
    }

    return null;
  } catch (e) {
    return null;
  }
}

function normalizeEmbedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname
      .replace(/\/download(?:\/.*)?$/, '')
      .replace(/\/d\/(.+)/, '/v/$1')
      .replace(/\/embed\/(.+)/, '/v/$1')
      .replace(/\/file\/(.+)/, '/v/$1')
      .replace(/\/f\/(.+)/, '/v/$1');
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function getEmbedResolver(url) {
  if (url.includes('voe.sx') || url.includes('cloudwindow-route.com')) {
    return resolveVoeStream;
  }
  if (url.includes('hlswish') || url.includes('streamwish') || url.includes('vibuxer') ||
      url.includes('strwish') || url.includes('hglink') || url.includes('ghbrisk') ||
      url.includes('premilkyway')) {
    return resolveHLSWishStream;
  }
  if (url.includes('vidhide') || url.includes('dintezuvio') || url.includes('minochinos') ||
      url.includes('dramiyos') || url.includes('dhcplay') || url.includes('smoothpre') ||
      url.includes('dhtpre') || url.includes('vidspeeder') || url.includes('moorearn') ||
      url.includes('travid') || url.includes('vidhidehub') || url.includes('vidhidevip') ||
      url.includes('vidhidepre') || url.includes('kinoger') || url.includes('movearnpre') ||
      url.includes('peytonepre') || url.includes('filelions')) {
    return resolveVidHideProStream;
  }
  if (url.includes('bysedikamoum') || url.includes('bysedi') || url.includes('filemoon') ||
      url.includes('rapidvideo')) {
    return resolveFilemoonStream;
  }
  if (url.includes('luluvid') || url.includes('lulus') || url.includes('lulu')) {
    return resolveLulusStream;
  }
  if (url.includes('uqload')) {
    return resolveUqloadStream;
  }
  return null;
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

async function getImdbId(tmdbId, mediaType) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.imdb_id;
}

export async function extractStreams(tmdbId, mediaType, season, episode) {
  try {
    const imdbId = await getImdbId(tmdbId, mediaType);
    if (!imdbId) return [];

    let embed69Url;
    if (mediaType === 'movie') {
      embed69Url = `https://embed69.org/f/${imdbId}`;
    } else {
      const epStr = String(episode).padStart(2, '0');
      embed69Url = `https://embed69.org/f/${imdbId}-${season}x${epStr}`;
    }

    console.log(`[Flixlatam] Fetching direct player: ${embed69Url}`);
    const embedHtml = await fetchWithRetry(embed69Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sololatino.net/'
      }
    });

    const powChallengeMatch = embedHtml.match(/POW_CHALLENGE\s*=\s*'([^']+)';/) || embedHtml.match(/POW_CHALLENGE = '([^']+)';/);
    const powDifficultyMatch = embedHtml.match(/POW_DIFFICULTY\s*=\s*(\d+);/) || embedHtml.match(/POW_DIFFICULTY = (\d+);/);
    const powSaltMatch = embedHtml.match(/POW_SALT\s*=\s*'([^']+)';/) || embedHtml.match(/POW_SALT = '([^']+)';/);

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
      const lang = entry.video_language || 'LAT';
      if (lang !== 'LAT' && lang !== 'LATINO' && lang !== 'Unknown') continue;

      const allEmbeds = entry.sortedEmbeds || [];
      const downloadEmbeds = entry.downloadEmbeds || [];

      for (const item of [...allEmbeds, ...downloadEmbeds]) {
        const encryptedLink = item.link;
        if (!encryptedLink) continue;

        const decryptedLink = decryptAES(encryptedLink, aesKey);
        if (decryptedLink && decryptedLink.startsWith('http')) {
          const fixedUrl = normalizeEmbedUrl(mapDomain(decryptedLink));

          let directResult = null;
          const resolver = getEmbedResolver(fixedUrl);
          if (resolver) {
            directResult = await resolver(fixedUrl);
          }

          const serverLabel = getServerLabel(fixedUrl);

          if (directResult && directResult.url) {
            const quality = (directResult.quality && directResult.quality !== 'Unknown')
              ? directResult.quality
              : await detectQualityFromM3U8(directResult.url);
            streams.push({
              name: `Flixlatam Direct (${serverLabel})`,
              title: `${quality || 'HD'} · Latino · ${serverLabel}`,
              url: directResult.url,
              quality: quality || 'Unknown',
              headers: directResult.headers || { Referer: fixedUrl },
            });
          } else {
            streams.push({
              name: `Flixlatam Embed (${serverLabel})`,
              title: `Embed · Latino · ${serverLabel}`,
              url: fixedUrl,
              quality: 'Unknown',
              headers: { Referer: embed69Url },
            });
          }
        }
      }
    }

    return streams;

  } catch (e) {
    return [];
  }
}
