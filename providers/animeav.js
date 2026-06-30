/**
 * animeav - Built from src/animeav/
 * Generated: 2026-06-30T00:19:50.809Z
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

// src/animeav/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://animeav1.com";
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
function decryptAES(hexStr, keyStr, ivStr) {
  try {
    const key = import_crypto_js.default.enc.Utf8.parse(keyStr);
    const iv = import_crypto_js.default.enc.Utf8.parse(ivStr);
    const ciphertext = import_crypto_js.default.enc.Hex.parse(hexStr);
    const decrypted = import_crypto_js.default.AES.decrypt(
      { ciphertext },
      key,
      { iv, mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
    );
    return decrypted.toString(import_crypto_js.default.enc.Utf8);
  } catch (e) {
    return null;
  }
}
function extractEmbedsFromScript(text) {
  const results = [];
  const embedsMatch = text.match(/embeds\s*:\s*\{([\s\S]*?)\}\s*[,;}]/);
  if (embedsMatch) {
    const types = ["DUB", "SUB", "LAT", "ESP"];
    for (const type of types) {
      const listPattern = new RegExp(`${type}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "g");
      let match;
      while ((match = listPattern.exec(embedsMatch[1])) !== null) {
        const items = match[1].match(/\{server:\s*"([^"]*)",\s*url:\s*"([^"]*)"\}/g);
        if (items) {
          for (const item of items) {
            const serverMatch = item.match(/server:\s*"([^"]*)"/);
            const urlMatch = item.match(/url:\s*"([^"]*)"/);
            if (serverMatch && urlMatch) {
              results.push({ server: serverMatch[1], url: urlMatch[1], type });
            }
          }
        }
        const items2 = match[1].match(/\{server:\s*'([^']*)',\s*url:\s*'([^']*)'\}/g);
        if (items2) {
          for (const item of items2) {
            const serverMatch = item.match(/server:\s*'([^']*)'/);
            const urlMatch = item.match(/url:\s*'([^']*)'/);
            if (serverMatch && urlMatch) {
              results.push({ server: serverMatch[1], url: urlMatch[1], type });
            }
          }
        }
      }
    }
  }
  if (results.length === 0) {
    const pairRegex = /server:\s*["']([^"']*)["']\s*,\s*url:\s*["']([^"']*)["']/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
      results.push({ server: match[1], url: match[2], type: "Unknown" });
    }
  }
  return results;
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/catalogo?search=${encodeURIComponent(query)}`;
      const html = yield fetchWithRetry(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $('article.group\\/item, article, div.grid a, a[href*="/anime/"], a[href*="/play/"]').each((i, el) => {
        const anchor = $(el).is("a") ? $(el) : $(el).find("a").first();
        const href = anchor.attr("href");
        const name = $(el).find("h3, h2, span, .title").first().text().trim() || anchor.attr("title") || "";
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
      if (!targetUrl)
        return [];
      let pageUrl = targetUrl;
      if (!pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      const detailsHtml = yield fetchWithRetry(pageUrl, { headers: { Referer: MAIN_URL } });
      const details$ = import_cheerio_without_node_native.default.load(detailsHtml);
      let svelteScript = "";
      details$("script").each((i, el) => {
        const txt = details$(el).html() || "";
        if (txt.includes("sveltekit") || txt.includes("__sveltekit") || txt.includes("embed") || txt.includes("embeds")) {
          svelteScript = txt;
        }
      });
      let epUrl = null;
      if (mediaType === "tv") {
        const epCountMatch = svelteScript.match(/episodesCount[:\s]*([0-9]+)/i);
        const mediaIdMatch = svelteScript.match(/\{media:\{id[:\s]*([0-9]+)/i);
        details$('article.group\\/item, a[href*="/episodio"], a[href*="/capitulo"], a[href*="/episode"]').each((i, el) => {
          var _a;
          const href = details$(el).attr("href") || details$(el).find("a").attr("href") || "";
          const epNumStr = details$(el).find("span.text-lead, .ep-num, .episode-number").text().trim() || ((_a = details$(el).text().match(/\b(\d+)\b/)) == null ? void 0 : _a[1]) || "";
          const epNum = parseInt(epNumStr, 10) || 0;
          if (epNum === episode) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          const totalEp = epCountMatch ? parseInt(epCountMatch[1], 10) : 1;
          if (episode <= totalEp) {
            epUrl = `${pageUrl}/${episode}`;
          }
        }
        if (!epUrl)
          return [];
        if (!epUrl.startsWith("http")) {
          epUrl = MAIN_URL + epUrl;
        }
      } else {
        epUrl = pageUrl;
      }
      const playHtml = yield fetchWithRetry(epUrl, { headers: { Referer: pageUrl } });
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      let playScript = "";
      play$("script").each((i, el) => {
        const txt = play$(el).html() || "";
        if (txt.includes("__sveltekit") || txt.includes("embeds") || txt.includes("embed")) {
          playScript = txt;
        }
      });
      const embeds = extractEmbedsFromScript(playScript);
      const streams = [];
      for (const embed of embeds) {
        let url = embed.url.replace(/\\/g, "");
        if (url.startsWith("//")) {
          url = "https:" + url;
        }
        const typeLabel = embed.type === "DUB" ? "Latino" : embed.type === "SUB" ? "Sub" : embed.type;
        const server = embed.server || "Server";
        if (url.includes("uns.bio") || url.includes("api/v1/video") || url.includes("p2pplay")) {
          try {
            const hash = url.split("#").pop().split("/").pop();
            const u = new URL(url);
            const baseurl = `${u.protocol}//${u.host}`;
            const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;
            const encoded = (yield fetchWithRetry(videoApiUrl)).trim();
            const knownKeys = [
              { key: "kiemtienmua911ca", ivs: ["1234567890oiuytr", "0123456789abcdef"] }
            ];
            let resolved = false;
            for (const k of knownKeys) {
              for (const iv of k.ivs) {
                try {
                  const decrypted = decryptAES(encoded, k.key, iv);
                  if (decrypted && decrypted.includes('"source"')) {
                    const parsed = JSON.parse(decrypted);
                    if (parsed.source) {
                      const quality = yield detectQualityFromM3U8(parsed.source);
                      streams.push({
                        name: `AnimeAV Direct (Upns - ${typeLabel})`,
                        title: `${quality || "HD"} \xB7 ${typeLabel}`,
                        url: parsed.source,
                        quality: quality || "1080p",
                        headers: { Referer: url }
                      });
                      resolved = true;
                      break;
                    }
                  }
                } catch (e) {
                }
              }
              if (resolved)
                break;
            }
            if (resolved)
              continue;
          } catch (err) {
          }
        }
        if (url.includes("player.zilla-networks.com")) {
          const id = url.split("/").pop();
          const m3u8Url = `https://player.zilla-networks.com/m3u8/${id}`;
          const quality = yield detectQualityFromM3U8(m3u8Url);
          streams.push({
            name: `AnimeAV Direct (PlayerZilla - ${typeLabel})`,
            title: `${quality || "HD"} \xB7 ${typeLabel}`,
            url: m3u8Url,
            quality: quality || "1080p",
            headers: { Referer: epUrl }
          });
          continue;
        }
        streams.push({
          name: `AnimeAV Embed (${server} - ${typeLabel})`,
          title: `Embed \xB7 ${typeLabel}`,
          url,
          quality: "Unknown",
          headers: { Referer: epUrl }
        });
      }
      return streams;
    } catch (e) {
      return [];
    }
  });
}

// src/animeav/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[AnimeAV] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[AnimeAV] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
