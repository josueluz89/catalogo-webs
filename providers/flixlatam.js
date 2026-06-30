/**
 * flixlatam - Built from src/flixlatam/
 * Generated: 2026-06-30T02:35:46.592Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/shared/http.js
function fetchWithTimeout(url, options, timeout) {
  if (!options)
    options = {};
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers, redirect: "follow" }));
}
function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  });
}
function fetchWithRetry(url, options, retries, timeout) {
  if (!retries)
    retries = 2;
  return fetchText(url, options, timeout).catch(function(e) {
    if (retries <= 0)
      throw e;
    return new Promise(function(r) {
      setTimeout(r, 1e3);
    }).then(function() {
      return fetchWithRetry(url, options, retries - 1, timeout);
    });
  });
}

// src/shared/voe.js
function base64Decode(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = input.replace(/=+$/, "");
  let output = "";
  if (str.length % 4 === 1)
    return "";
  for (let i = 0, bc = 0, bs = 0; i < str.length; i++) {
    const char = str.charAt(i);
    const idx = chars.indexOf(char);
    if (idx === -1)
      continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
    }
  }
  return output;
}
function rot13(str) {
  return str.replace(
    /[A-Za-z]/g,
    (c) => String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= "M" ? 13 : -13))
  );
}
function charShift(str, shift) {
  return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}
function replacePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let res = str;
  for (const p of patterns) {
    res = res.split(p).join("_");
  }
  return res;
}
function decryptVoe(encoded) {
  try {
    let s = rot13(encoded);
    s = replacePatterns(s);
    s = s.split("_").join("");
    let decoded = base64Decode(s);
    if (!decoded)
      return null;
    decoded = charShift(decoded, 3);
    decoded = decoded.split("").reverse().join("");
    decoded = base64Decode(decoded);
    if (!decoded)
      return null;
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}
function extractQuality(url) {
  if (!url)
    return "Unknown";
  const m = url.match(/[_-](\d{3,4})p/);
  return m ? m[1] + "p" : "Unknown";
}
function resolveVoeStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(embedUrl, {
        headers: {
          Referer: embedUrl,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      let pageText = html;
      if (/permanentToken/i.test(pageText)) {
        const redirectMatch = pageText.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (redirectMatch) {
          const redirectRes = yield fetchWithTimeout(redirectMatch[1], {
            headers: { Referer: embedUrl, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
          });
          if (redirectRes.ok) {
            pageText = yield redirectRes.text();
          }
        }
      }
      const jsonMatch = pageText.match(/<script[^>]*type=['"]application\/json['"][^>]*>\s*\[\s*"([^"]+)"\s*\]\s*<\/script>/i);
      if (!jsonMatch) {
        const urlPatterns = [
          ...pageText.matchAll(/(?:mp4|hls)'\s*:\s*'([^']+)'/gi),
          ...pageText.matchAll(/(?:mp4|hls)"\s*:\s*"([^"]+)"/gi)
        ];
        for (const m of urlPatterns) {
          let u = m[1];
          if (u.startsWith("aHR0")) {
            try {
              u = base64Decode(u) || u;
            } catch (e) {
            }
          }
          return { url: u, quality: extractQuality(u), headers: { Referer: embedUrl } };
        }
        return null;
      }
      const encodedStr = jsonMatch[1];
      const decrypted = decryptVoe(encodedStr);
      if (!decrypted)
        return null;
      const directUrl = decrypted.source || decrypted.direct_access_url;
      if (!directUrl)
        return null;
      return { url: directUrl, quality: extractQuality(directUrl), headers: { Referer: embedUrl } };
    } catch (e) {
      return null;
    }
  });
}

// src/shared/quality.js
var KNOWN_QUALITY = {
  vimeos: { h: "720p", n: "480p" },
  goodstream: { x: "1080p", h: "720p", n: "480p", l: "360p" },
  vidhide: { n: "720p", l: "480p" },
  streamwish: { x: "1080p", h: "1080p", n: "720p", l: "480p" },
  voe: { n: "720p", l: "360p" }
};
function getQualityMap(url) {
  if (url.includes("vimeos"))
    return KNOWN_QUALITY.vimeos;
  if (url.includes("goodstream"))
    return KNOWN_QUALITY.goodstream;
  if (url.includes("cloudwindow-route"))
    return KNOWN_QUALITY.voe;
  if (url.includes("minochinos") || url.includes("vidhide") || url.includes("dintezuvio") || url.includes("dramiyos"))
    return KNOWN_QUALITY.vidhide;
  if (url.includes("premilkyway") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("streamwish") || url.includes("harborviewlearninghub") || url.includes("aurorionagency") || url.includes("centaurus") || url.includes("bysedikamoum") || url.includes("filelions") || url.includes("rapidvideo"))
    return KNOWN_QUALITY.streamwish;
  return null;
}
function guessQualityFromUrl(url) {
  if (!url)
    return "Unknown";
  const qmap = getQualityMap(url);
  if (qmap) {
    const m = url.match(/_,([a-z,]+),\.urlset/);
    if (m) {
      const labels = m[1].split(",").filter(Boolean);
      const order = ["x", "o", "h", "n", "l"];
      for (const key of order) {
        if (labels.includes(key) && qmap[key])
          return qmap[key];
      }
    }
  }
  const numMatch = url.match(/[_-](\d{3,4})p/);
  return numMatch ? numMatch[1] + "p" : "Unknown";
}
function detectQualityFromM3U8(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (!res.ok)
        return guessQualityFromUrl(url);
      const text = yield res.text();
      if (!text.includes("#EXT-X-STREAM-INF")) {
        return guessQualityFromUrl(url);
      }
      let maxH = 0, maxW = 0;
      for (const line of text.split("\n")) {
        const m = line.match(/RESOLUTION=(\d+)x(\d+)/);
        if (m) {
          const h = parseInt(m[2]);
          if (h > maxH) {
            maxH = h;
            maxW = parseInt(m[1]);
          }
        }
      }
      if (maxH >= 2160)
        return "4K";
      if (maxH >= 1080)
        return "1080p";
      if (maxH >= 720)
        return "720p";
      if (maxH >= 480)
        return "480p";
      return maxH > 0 ? `${maxH}p` : guessQualityFromUrl(url);
    } catch (e) {
      return guessQualityFromUrl(url);
    }
  });
}

// src/flixlatam/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://flixlatam.com";
var DOMAIN_MAP = {
  "hglink.to": "vibuxer.com",
  "ghbrisk.com": "vibuxer.com",
  "premilkyway.com": "streamwish.to"
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
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const res = yield fetch(url);
    if (!res.ok)
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    return { title, originalTitle };
  });
}
function solvePowAsync(challenge, difficulty, salt, maxAttempts = 5e5) {
  return new Promise((resolve, reject) => {
    const prefix = "0".repeat(difficulty);
    let nonce = 0;
    let attempts = 0;
    function chunk() {
      const start = Date.now();
      while (attempts < maxAttempts && Date.now() - start < 100) {
        const hash = import_crypto_js.default.SHA256(challenge + nonce).toString(import_crypto_js.default.enc.Hex);
        if (hash.startsWith(prefix)) {
          resolve(import_crypto_js.default.SHA256(challenge + nonce + salt));
          return;
        }
        nonce++;
        attempts++;
      }
      if (attempts >= maxAttempts) {
        reject(new Error("PoW max attempts exceeded"));
        return;
      }
      setTimeout(chunk, 0);
    }
    chunk();
  });
}
function decryptAES(encryptedBase64, powKey) {
  try {
    const decoded = import_crypto_js.default.enc.Base64.parse(encryptedBase64);
    const iv = import_crypto_js.default.lib.WordArray.create(decoded.words.slice(0, 4), 16);
    const ciphertext = import_crypto_js.default.lib.WordArray.create(decoded.words.slice(4), decoded.sigBytes - 16);
    const decrypted = import_crypto_js.default.AES.decrypt(
      { ciphertext },
      powKey,
      { iv, mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
    );
    return decrypted.toString(import_crypto_js.default.enc.Utf8);
  } catch (e) {
    return null;
  }
}
function unpackPacked(source) {
  try {
    const m = source.match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!m)
      return null;
    const [, str, base, count, dictStr] = m;
    const dict = dictStr.split("|");
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decode = (s) => {
      let n = 0;
      for (const ch of s) {
        const idx = alphabet.indexOf(ch);
        if (idx === -1)
          return NaN;
        n = n * parseInt(base) + idx;
      }
      return n;
    };
    return str.replace(/\b([0-9a-zA-Z]+)\b/g, (w) => {
      const n = decode(w);
      return dict[n] && dict[n] !== "" ? dict[n] : w;
    });
  } catch (e) {
    return null;
  }
}
function resolveHLSWishStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = new URL(embedUrl).origin;
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          Referer: "https://flixlatam.com/",
          Origin: "https://flixlatam.com",
          "Accept-Language": "es-MX,es;q=0.9"
        }
      });
      const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        let url = fileMatch[1];
        if (url.startsWith("/"))
          url = origin + url;
        if (url.includes("vibuxer.com/stream/")) {
          try {
            const redirRes = yield fetchWithTimeout(url, {
              headers: { "User-Agent": "Mozilla/5.0", Referer: origin + "/" }
            });
            if (redirRes.url && redirRes.url.includes(".m3u8")) {
              url = redirRes.url;
            }
          } catch (e) {
          }
        }
        const quality = yield detectQualityFromM3U8(url);
        return { url, quality, headers: { Referer: origin + "/", "User-Agent": "Mozilla/5.0" } };
      }
      const unpacked = unpackPacked(html);
      if (unpacked) {
        const hlsMatch = unpacked.match(/"hls[234]"\s*:\s*"([^"]+)"/);
        if (hlsMatch) {
          let url = hlsMatch[1];
          if (url.startsWith("/"))
            url = origin + url;
          const quality = yield detectQualityFromM3U8(url);
          return { url, quality, headers: { Referer: origin + "/", "User-Agent": "Mozilla/5.0" } };
        }
      }
      const bareMatch = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (bareMatch) {
        const quality = yield detectQualityFromM3U8(bareMatch[0]);
        return { url: bareMatch[0], quality, headers: { Referer: origin + "/" } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function normalizeVidHideUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname.replace(/\/download(?:\/.*)?$/, "").replace(/\/d\/(.+)/, "/v/$1").replace(/\/file\/(.+)/, "/v/$1").replace(/\/f\/(.+)/, "/v/$1");
    return u.toString();
  } catch (e) {
    return rawUrl;
  }
}
function resolveVidHideProStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const normalizedUrl = normalizeVidHideUrl(embedUrl);
      const origin = new URL(normalizedUrl).origin;
      const html = yield fetchWithRetry(normalizedUrl, {
        headers: {
          Referer: origin + "/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "cross-site"
        }
      });
      let script = null;
      const packed = unpackPacked(html);
      if (packed) {
        let data = packed;
        if (data.includes("var links")) {
          data = data.substring(data.indexOf("var links"));
        }
        script = data;
      }
      if (!script) {
        const srcMatch = html.match(/<script[^>]*>([\s\S]*?sources:[\s\S]*?)<\/script>/i);
        if (srcMatch) {
          script = srcMatch[1];
        }
      }
      if (!script)
        return null;
      const m3u8Regex = /:\s*"([^"]*\.m3u8[^"]*)"/i;
      const m3u8Match = script.match(m3u8Regex);
      if (!m3u8Match)
        return null;
      let url = m3u8Match[1];
      if (url.startsWith("/"))
        url = origin + url;
      if (!url.startsWith("http"))
        url = origin + "/" + url;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/", Origin: origin } };
    } catch (e) {
      return null;
    }
  });
}
function resolveFilemoonStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const defaultHeaders = {
        "Referer": embedUrl,
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0"
      };
      const initialResponse = yield fetchWithRetry(embedUrl, {
        headers: __spreadProps(__spreadValues({}, defaultHeaders), { Referer: "https://flixlatam.com/" })
      });
      const iframeSrc = initialResponse.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (iframeSrc) {
        let iframeUrl = iframeSrc[1];
        if (!iframeUrl.startsWith("http")) {
          iframeUrl = new URL(embedUrl).origin + iframeUrl;
        }
        const iframeHtml = yield fetchWithRetry(iframeUrl, {
          headers: __spreadProps(__spreadValues({}, defaultHeaders), { "Accept-Language": "en-US,en;q=0.5", Referer: embedUrl })
        });
        const unpacked2 = unpackPacked(iframeHtml);
        if (unpacked2) {
          const videoMatch = unpacked2.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
          if (videoMatch) {
            let url = videoMatch[1];
            if (!url.startsWith("http"))
              url = new URL(iframeUrl).origin + url;
            const quality = yield detectQualityFromM3U8(url);
            return { url, quality, headers: { Referer: new URL(iframeUrl).origin + "/" } };
          }
        }
        return null;
      }
      const unpacked = unpackPacked(initialResponse);
      if (unpacked) {
        const videoMatch = unpacked.match(/sources:\s*\[\s*\{\s*file\s*:\s*"([^"]+)"/i);
        if (videoMatch) {
          let url = videoMatch[1];
          if (!url.startsWith("http"))
            url = new URL(embedUrl).origin + url;
          const quality = yield detectQualityFromM3U8(url);
          return { url, quality, headers: { Referer: new URL(embedUrl).origin + "/" } };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveLulusStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = new URL(embedUrl).origin;
      const filecode = embedUrl.replace(/\/+$/, "").split("/").pop();
      if (!filecode)
        return null;
      const res = yield fetch(origin + "/dl", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
          Referer: origin
        },
        body: new URLSearchParams({
          op: "embed",
          file_code: filecode,
          auto: "1",
          referer: embedUrl
        })
      });
      if (!res.ok)
        return null;
      const html = yield res.text();
      const scriptMatch = html.match(/<script[^>]*>([\s\S]*?vplayer[\s\S]*?)<\/script>/i);
      if (!scriptMatch)
        return null;
      const fileMatch = scriptMatch[1].match(/file\s*:\s*"([^"]+)"/);
      if (!fileMatch)
        return null;
      let url = fileMatch[1];
      if (url.startsWith("/"))
        url = origin + url;
      return { url, quality: "1080p", headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveUqloadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = new URL(embedUrl).origin;
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Upgrade-Insecure-Requests": "1",
          Referer: origin + "/"
        }
      });
      const unpacked = unpackPacked(html);
      if (!unpacked)
        return null;
      const m3u8Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/i);
      if (m3u8Match) {
        const quality = yield detectQualityFromM3U8(m3u8Match[0]);
        return { url: m3u8Match[0], quality, headers: { Referer: origin + "/", Origin: origin } };
      }
      const mp4Match = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/i);
      if (mp4Match) {
        return { url: mp4Match[0], quality: "1080p", headers: { Referer: origin + "/", Origin: origin } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function normalizeEmbedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.pathname = u.pathname.replace(/\/download(?:\/.*)?$/, "").replace(/\/d\/(.+)/, "/v/$1").replace(/\/embed\/(.+)/, "/v/$1").replace(/\/file\/(.+)/, "/v/$1").replace(/\/f\/(.+)/, "/v/$1");
    return u.toString();
  } catch (e) {
    return rawUrl;
  }
}
function getEmbedResolver(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow-route.com")) {
    return resolveVoeStream;
  }
  if (url.includes("hlswish") || url.includes("streamwish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("hglink") || url.includes("ghbrisk") || url.includes("premilkyway")) {
    return resolveHLSWishStream;
  }
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions")) {
    return resolveVidHideProStream;
  }
  if (url.includes("bysedikamoum") || url.includes("bysedi") || url.includes("filemoon") || url.includes("rapidvideo")) {
    return resolveFilemoonStream;
  }
  if (url.includes("luluvid") || url.includes("lulus") || url.includes("lulu")) {
    return resolveLulusStream;
  }
  if (url.includes("uqload")) {
    return resolveUqloadStream;
  }
  return null;
}
function getServerLabel(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow"))
    return "VOE";
  if (url.includes("streamwish") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("premilkyway"))
    return "StreamWish";
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions"))
    return "VidHide";
  if (url.includes("bysedikamoum") || url.includes("bysedi") || url.includes("filemoon") || url.includes("rapidvideo"))
    return "FileMoon";
  if (url.includes("luluvid") || url.includes("lulus"))
    return "Lulu";
  if (url.includes("uqload"))
    return "Uqload";
  if (url.includes("goodstream"))
    return "GoodStream";
  if (url.includes("vimeos"))
    return "Vimeos";
  return "Online";
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/search?s=${encodeURIComponent(query)}`;
      const html = yield fetchWithRetry(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("article.item").each((i, el) => {
        const linkElement = $(el).find(".data h3 a").first();
        const href = linkElement.attr("href");
        const name = linkElement.text().trim();
        if (href)
          candidates.push({ name, href });
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
      if (!targetUrl)
        return [];
      let pageUrl = targetUrl;
      if (pageUrl && !pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      if (mediaType === "tv") {
        const tvHtml = yield fetchWithRetry(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        tv$("ul.episodios li").each((i, el) => {
          const epLink = tv$(el).find(".episodiotitle a");
          const href = epLink.attr("href");
          const numerando = tv$(el).find(".numerando").text() || "1-1";
          const parts = numerando.split("-");
          const s = parseInt(parts[0], 10) || 1;
          const e = parseInt(parts[1], 10) || 1;
          if (s === season && e === episode) {
            epUrl = href;
          }
        });
        if (!epUrl)
          return [];
        pageUrl = epUrl;
        if (pageUrl && !pageUrl.startsWith("http")) {
          pageUrl = MAIN_URL + pageUrl;
        }
      }
      const playHtml = yield fetchWithRetry(pageUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      let iframeUrl = play$("div.play iframe").attr("src") || play$('iframe[src*="embed69"]').attr("src") || play$('iframe[src*="/vidurl/"]').attr("src");
      if (!iframeUrl)
        return [];
      if (iframeUrl.startsWith("//")) {
        iframeUrl = "https:" + iframeUrl;
      } else if (iframeUrl.startsWith("/")) {
        iframeUrl = MAIN_URL + iframeUrl;
      }
      const embedHtml = yield fetchWithRetry(iframeUrl, {
        headers: { Referer: pageUrl }
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
        aesKey = yield solvePowAsync(challenge, difficulty, salt);
      } catch (e) {
        return [];
      }
      const dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
      if (!dataLinkMatch)
        return [];
      const dataList = JSON.parse(dataLinkMatch[1]);
      const streams = [];
      for (const entry of dataList) {
        const allEmbeds = entry.sortedEmbeds || [];
        const downloadEmbeds = entry.downloadEmbeds || [];
        for (const item of [...allEmbeds, ...downloadEmbeds]) {
          const encryptedLink = item.link;
          if (!encryptedLink)
            continue;
          const decryptedLink = decryptAES(encryptedLink, aesKey);
          if (decryptedLink && decryptedLink.startsWith("http")) {
            const fixedUrl = normalizeEmbedUrl(mapDomain(decryptedLink));
            let directResult = null;
            const resolver = getEmbedResolver(fixedUrl);
            if (resolver) {
              directResult = yield resolver(fixedUrl);
            }
            const serverLabel = getServerLabel(fixedUrl);
            if (directResult && directResult.url) {
              const quality = directResult.quality && directResult.quality !== "Unknown" ? directResult.quality : yield detectQualityFromM3U8(directResult.url);
              streams.push({
                name: `Flixlatam Direct (${serverLabel})`,
                title: `${quality || "HD"} \u252C\xC0 Latino \u252C\xC0 ${serverLabel}`,
                url: directResult.url,
                quality: quality || "Unknown",
                headers: directResult.headers || { Referer: fixedUrl }
              });
            } else {
              streams.push({
                name: `Flixlatam Embed (${serverLabel})`,
                title: `Embed \u252C\xC0 Latino \u252C\xC0 ${serverLabel}`,
                url: fixedUrl,
                quality: "Unknown",
                headers: { Referer: iframeUrl }
              });
            }
          }
        }
      }
      return streams;
    } catch (e) {
      return [];
    }
  });
}

// src/flixlatam/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return extractStreams(tmdbId, mediaType, season, episode).catch(function() {
    return [];
  });
}
module.exports = { getStreams };
