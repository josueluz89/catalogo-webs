/**
 * masters - Built from src/masters/
 * Generated: 2026-06-30T00:19:50.877Z
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
var FETCH_TIMEOUT = 15e3;
function fetchWithTimeout(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        signal: controller.signal,
        headers: __spreadValues({
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }, options.headers),
        redirect: "follow"
      }));
      return response;
    } finally {
      clearTimeout(timer);
    }
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = FETCH_TIMEOUT) {
    const res = yield fetchWithTimeout(url, options, timeout);
    if (!res.ok)
      throw new Error(`HTTP ${res.status} for ${url}`);
    return yield res.text();
  });
}
function fetchWithRetry(_0) {
  return __async(this, arguments, function* (url, options = {}, retries = 2, timeout = FETCH_TIMEOUT) {
    for (let i = 0; i <= retries; i++) {
      try {
        return yield fetchText(url, options, timeout);
      } catch (e) {
        if (i === retries)
          throw e;
        yield new Promise((r) => setTimeout(r, 1e3 * (i + 1)));
      }
    }
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
function voeDecode(encoded, dictionary) {
  try {
    let s = rot13(encoded);
    if (dictionary) {
      for (const pat of dictionary) {
        s = s.split(pat).join("_");
      }
    }
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
        headers: { Referer: embedUrl }
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
      const jsonMatch = pageText.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
      if (jsonMatch) {
        const encodedStr = jsonMatch[1];
        const loaderUrl = jsonMatch[2].startsWith("http") ? jsonMatch[2] : new URL(jsonMatch[2], embedUrl).href;
        const loaderRes = yield fetchWithTimeout(loaderUrl, {
          headers: { Referer: embedUrl, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        if (loaderRes.ok) {
          const loaderText = yield loaderRes.text();
          const dictMatch = loaderText.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || loaderText.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
          if (dictMatch) {
            const dictionary = dictMatch[1].replace(/^\[|\]$/g, "").split("','").map((s) => s.replace(/^'+|'+$/g, "")).map((s) => s.replace(/^"+|"+$/g, ""));
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
  if (url.includes("premilkyway") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("streamwish"))
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

// src/masters/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-MX`;
    const res = yield fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    const year = (data.release_date || data.first_air_date || "").split("-")[0];
    return { title, originalTitle, year };
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `https://ww3.gnulahd.nu/?s=${encodeURIComponent(query)}`;
      const html = yield fetchWithRetry(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("a").each((i, el) => {
        const href = $(el).attr("href");
        const text = $(el).text().trim() || $(el).find("img").attr("alt") || "";
        if (href && href.includes("/ver/")) {
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
      if (mediaType === "tv") {
        const tvHtml = yield fetchWithRetry(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        const epPattern1 = `-${season}x${episode < 10 ? "0" + episode : episode}`;
        const epPattern2 = `-${season}x${episode}`;
        tv$("a").each((i, el) => {
          const href = tv$(el).attr("href");
          if (href && (href.includes(epPattern1) || href.includes(epPattern2))) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          return [];
        }
        pageUrl = epUrl;
      }
      const playHtml = yield fetchWithRetry(pageUrl);
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
      const langPriority = ["latino", "subtitulado", "castellano", "espanol", "mx"];
      const matchedLangs = [];
      for (const lang of languages) {
        const langLabel = lang.label || "Latino";
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
        const langLabel = lang.label || "Latino";
        let labelShort = "Latino";
        const nl = langLabel.toLowerCase();
        if (nl.includes("subtitulado") || nl.includes("sub"))
          labelShort = "Sub";
        else if (nl.includes("castellano") || nl.includes("espanol"))
          labelShort = "Esp";
        for (const srv of lang.servers || []) {
          let cleanSrc = (srv.src || "").replace(/\\/g, "");
          if (!cleanSrc)
            continue;
          if (cleanSrc.startsWith("//")) {
            cleanSrc = "https:" + cleanSrc;
          }
          if ((cleanSrc.includes("they.tube") || cleanSrc.includes("the.tube")) && resolvePath && authParam) {
            try {
              const codeMatch = cleanSrc.match(/the(?:y)?\.tube\/(?:e\/)?([A-Za-z0-9_-]+?)(?:\.html)?(?:[?#]|$)/i);
              if (codeMatch) {
                const code = codeMatch[1];
                const resolveUrl = `https://ww3.gnulahd.nu${resolvePath}${encodeURIComponent(code)}${authParam}`;
                const resolveRes = yield fetch(resolveUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": pageUrl
                  }
                });
                if (resolveRes.ok) {
                  const resolveData = yield resolveRes.json();
                  if (resolveData && resolveData.master) {
                    const quality = yield detectQualityFromM3U8(resolveData.master);
                    streams.push({
                      name: `GnulaHD Direct (they.tube)`,
                      title: `${quality || "HD"} \xB7 ${labelShort}`,
                      url: resolveData.master,
                      quality: quality || "1080p",
                      headers: {
                        Referer: "https://ww3.gnulahd.nu/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                      }
                    });
                  }
                }
              }
            } catch (e) {
            }
          }
          if (cleanSrc.includes("voe.sx")) {
            const result = yield resolveVoeStream(cleanSrc);
            if (result) {
              const quality = yield detectQualityFromM3U8(result.url);
              streams.push({
                name: `GnulaHD Direct (voe.sx)`,
                title: `${quality || result.quality || "HD"} \xB7 ${labelShort}`,
                url: result.url,
                quality: quality || result.quality || "720p",
                headers: { Referer: cleanSrc, Origin: "https://voe.sx/" }
              });
            }
          }
        }
      }
      if (streams.length === 0) {
        for (const lang of languages) {
          for (const srv of lang.servers || []) {
            let cleanSrc = (srv.src || "").replace(/\\/g, "");
            if (!cleanSrc)
              continue;
            if (cleanSrc.startsWith("//"))
              cleanSrc = "https:" + cleanSrc;
            streams.push({
              name: `GnulaHD Embed (${srv.title || "server"})`,
              title: `Embed \xB7 ${lang.label || "Latino"}`,
              url: cleanSrc,
              quality: "Unknown",
              headers: { Referer: "https://ww3.gnulahd.nu/" }
            });
          }
        }
      }
      return streams;
    } catch (err) {
      return [];
    }
  });
}

// src/masters/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[Masters] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[Masters] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
