import { fetchWithRetry } from '../shared/http.js';
import { detectQualityFromM3U8 } from '../shared/quality.js';
import CryptoJS from 'crypto-js';
import {
  normalizeEmbedUrl,
  mapDomain,
  getEmbedResolver,
  getServerLabel
} from '../shared/embedResolvers.js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';

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
    return decrypted.toString(CryptoJS.enc.Utf8) || null;
  } catch (e) {
    return null;
  }
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
