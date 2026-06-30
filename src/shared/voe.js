import { fetchText, fetchWithTimeout } from './http.js';

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

function rot13(str) {
  return str.replace(/[A-Za-z]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13))
  );
}

function charShift(str, shift) {
  return str.split('').map(c => String.fromCharCode(c.charCodeAt(0) - shift)).join('');
}

function voeDecode(encoded, dictionary) {
  try {
    let s = rot13(encoded);
    if (dictionary) {
      for (const pat of dictionary) {
        s = s.split(pat).join('_');
      }
    }
    s = s.split('_').join('');
    let decoded = base64Decode(s);
    if (!decoded) return null;
    decoded = charShift(decoded, 3);
    decoded = decoded.split('').reverse().join('');
    decoded = base64Decode(decoded);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

function extractQuality(url) {
  if (!url) return 'Unknown';
  const m = url.match(/[_-](\d{3,4})p/);
  return m ? m[1] + 'p' : 'Unknown';
}

export async function resolveVoeStream(embedUrl) {
  try {
    const html = await fetchText(embedUrl, {
      headers: { Referer: embedUrl },
    });

    let pageText = html;

    // Handle permanentToken redirect
    if (/permanentToken/i.test(pageText)) {
      const redirectMatch = pageText.match(/window\.location\.href\s*=\s*'([^']+)'/i);
      if (redirectMatch) {
        const redirectRes = await fetchWithTimeout(redirectMatch[1], {
          headers: { Referer: embedUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (redirectRes.ok) {
          pageText = await redirectRes.text();
        }
      }
    }

    // Find json script + loader
    const jsonMatch = pageText.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
    if (jsonMatch) {
      const encodedStr = jsonMatch[1];
      const loaderUrl = jsonMatch[2].startsWith('http') ? jsonMatch[2] : new URL(jsonMatch[2], embedUrl).href;

      const loaderRes = await fetchWithTimeout(loaderUrl, {
        headers: { Referer: embedUrl, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (loaderRes.ok) {
        const loaderText = await loaderRes.text();
        const dictMatch = loaderText.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) ||
                          loaderText.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
        if (dictMatch) {
          const dictionary = dictMatch[1].replace(/^\[|\]$/g, '').split("','")
            .map(s => s.replace(/^'+|'+$/g, ''))
            .map(s => s.replace(/^"+|"+$/g, ''));
          const decrypted = voeDecode(encodedStr, dictionary);
          if (decrypted) {
            const directUrl = decrypted.source || decrypted.direct_access_url;
            if (directUrl) {
              return { url: directUrl, quality: extractQuality(directUrl), headers: { Referer: embedUrl } };
            }
          }
        }
      }
    }

    // Fallback: find mp4/hls URLs in the page
    const urlPatterns = [
      ...pageText.matchAll(/(?:mp4|hls)'\s*:\s*'([^']+)'/gi),
      ...pageText.matchAll(/(?:mp4|hls)"\s*:\s*"([^"]+)"/gi),
    ];
    for (const m of urlPatterns) {
      let u = m[1];
      if (u.startsWith('aHR0')) {
        try { u = base64Decode(u) || u; } catch (e) {}
      }
      return { url: u, quality: extractQuality(u), headers: { Referer: embedUrl } };
    }

    return null;
  } catch (e) {
    return null;
  }
}
