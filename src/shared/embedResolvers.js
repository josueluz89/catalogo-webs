import { fetchText, fetchWithRetry } from './http.js';
import { detectQualityFromM3U8 } from './quality.js';
import { resolveVoeStream } from './voe.js';

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

export function unpackPacked(html) {
  try {
    const pMatch = html.match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch) return null;
    let [, p, a, c, k] = pMatch;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split('|');
    const decodeBase36 = (num, rad) => {
      const symbols = '0123456789abcdefghijklmnopqrstuvwxyz';
      let res = '';
      while (num > 0) {
        res = symbols[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res || '0';
    };
    return p.replace(/\b\w+\b/g, (w) => {
      const idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}

export function normalizeVidHideUrl(url) {
  try {
    const u = new URL(url);
    if (!u.pathname.includes('/embed/')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const code = parts.pop();
      if (code) u.pathname = `/embed/${code}`;
    }
    return u.toString();
  } catch (e) {
    return url;
  }
}

export function normalizeEmbedUrl(rawUrl) {
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

const DOMAIN_MAP = {
  'hglink.to': 'vibuxer.com',
  'ghbrisk.com': 'vibuxer.com',
  'premilkyway.com': 'streamwish.to',
};

export function mapDomain(url) {
  let result = url;
  for (const [from, to] of Object.entries(DOMAIN_MAP)) {
    if (result.includes(from)) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}

export async function resolveHLSWishStream(embedUrl) {
  try {
    const targetUrl = mapDomain(embedUrl).replace('/e/', '/v/');
    const origin = new URL(targetUrl).origin;
    const html = await fetchWithRetry(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://embed69.org/',
        Origin: 'https://embed69.org',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    });

    const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
    if (fileMatch) {
      let fileUrl = fileMatch[1];
      if (fileUrl.startsWith('/')) fileUrl = origin + fileUrl;
      const quality = await detectQualityFromM3U8(fileUrl);
      return { url: fileUrl, quality, headers: { Referer: origin + '/' } };
    }

    const unpacked = unpackPacked(html);
    if (unpacked) {
      const srcMatch = unpacked.match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
      if (srcMatch) {
        let fileUrl = srcMatch[1];
        if (fileUrl.startsWith('/')) fileUrl = origin + fileUrl;
        const quality = await detectQualityFromM3U8(fileUrl);
        return { url: fileUrl, quality, headers: { Referer: origin + '/' } };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

export async function resolveVidHideProStream(embedUrl) {
  try {
    const normalizedUrl = normalizeVidHideUrl(embedUrl);
    const origin = new URL(normalizedUrl).origin;

    const html = await fetchWithRetry(normalizedUrl, {
      headers: {
        Referer: 'https://embed69.org/',
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
      if (srcMatch) script = srcMatch[1];
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

export async function resolveFilemoonStream(embedUrl) {
  try {
    const defaultHeaders = {
      'Referer': embedUrl,
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0',
    };

    const initialResponse = await fetchWithRetry(embedUrl, {
      headers: { ...defaultHeaders, Referer: 'https://embed69.org/' },
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

export async function resolveLulusStream(embedUrl) {
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

export async function resolveUqloadStream(embedUrl) {
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

export function getEmbedResolver(url) {
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

export function getServerLabel(url) {
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
