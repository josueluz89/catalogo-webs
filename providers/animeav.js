/**
 * animeav - Built from src/animeav/
 * Generated: 2026-06-29T23:59:32.147Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
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

// src/animeav/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }, options));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
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
    if (!res.ok) {
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    }
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
    console.error(`[AnimeAV] AES Decryption error: ${e.message}`);
    return null;
  }
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/catalogo?search=${encodeURIComponent(query)}`;
      console.log(`[AnimeAV] Searching: ${searchUrl}`);
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("div.grid.grid-cols-2 article.group\\/item").each((i, el) => {
        const anchor = $(el).find("a");
        const href = anchor.attr("href");
        const name = $(el).find("h3").text().trim();
        if (href) {
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
      if (!targetUrl) {
        console.log("[AnimeAV] Media not found on AnimeAV");
        return [];
      }
      let pageUrl = targetUrl;
      if (!pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      console.log(`[AnimeAV] Fetching details page: ${pageUrl}`);
      const detailsHtml = yield fetchText(pageUrl, { headers: { "Referer": MAIN_URL } });
      const details$ = import_cheerio_without_node_native.default.load(detailsHtml);
      let svelteScript = "";
      details$("script").each((i, el) => {
        const txt = details$(el).html() || "";
        if (txt.includes("sveltekit")) {
          svelteScript = txt;
        }
      });
      const epCountMatch = svelteScript.match(/episodesCount:([0-9]+)/i);
      const mediaIdMatch = svelteScript.match(/\{media:\{id:([0-9]+)/i);
      const totalEp = epCountMatch ? parseInt(epCountMatch[1], 10) : 1;
      let epUrl = null;
      const episodeElements = details$("article.group\\/item");
      if (episodeElements.length > 0) {
        episodeElements.each((i, el) => {
          const href = details$(el).find("a").attr("href") || "";
          const epNumStr = details$(el).find("span.text-lead").text().trim() || "";
          const epNum = parseInt(epNumStr, 10) || 0;
          if (epNum === episode) {
            epUrl = href;
          }
        });
      } else {
        if (episode <= totalEp) {
          epUrl = `${pageUrl}/${episode}`;
        }
      }
      if (!epUrl) {
        console.log(`[AnimeAV] Episode ${episode} not found`);
        return [];
      }
      if (!epUrl.startsWith("http")) {
        epUrl = MAIN_URL + epUrl;
      }
      console.log(`[AnimeAV] Fetching player page: ${epUrl}`);
      const playHtml = yield fetchText(epUrl, { headers: { "Referer": pageUrl } });
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      let playScript = "";
      play$("script").each((i, el) => {
        const txt = play$(el).html() || "";
        if (txt.includes("__sveltekit")) {
          playScript = txt;
        }
      });
      const embedsData = playScript.substring(playScript.indexOf("embeds:{"));
      const streams = [];
      const types = ["DUB", "SUB"];
      for (const type of types) {
        const listPattern = new RegExp(`${type}:\\[(.*?)\\]`);
        const listMatch = embedsData.match(listPattern);
        if (listMatch) {
          const listStr = listMatch[1];
          const itemPattern = /\{server:"([^"]+)",\s*url:"([^"]+)"\}/g;
          let match;
          while ((match = itemPattern.exec(listStr)) !== null) {
            const server = match[1];
            let url = match[2].replace(/\\/g, "");
            if (url.startsWith("//")) {
              url = "https:" + url;
            }
            if (url.includes("uns.bio") || url.includes("api/v1/video")) {
              try {
                const hash = url.split("#").pop().split("/").pop();
                const u = new URL(url);
                const baseurl = `${u.protocol}//${u.host}`;
                const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;
                console.log(`[AnimeAV] Decrypting Upns player: ${videoApiUrl}`);
                const encoded = (yield fetchText(videoApiUrl)).trim();
                const key = "kiemtienmua911ca";
                const ivList = ["1234567890oiuytr", "0123456789abcdef"];
                let decryptedText = null;
                for (const iv of ivList) {
                  try {
                    const decrypted = decryptAES(encoded, key, iv);
                    if (decrypted && decrypted.includes('"source"')) {
                      decryptedText = decrypted;
                      break;
                    }
                  } catch (e) {
                  }
                }
                if (decryptedText) {
                  const parsed = JSON.parse(decryptedText);
                  if (parsed.source) {
                    streams.push({
                      name: `AnimeAV Direct (Upns - ${type})`,
                      title: `${title || query} [${type}]`,
                      url: parsed.source,
                      quality: "1080p",
                      headers: {
                        "Referer": url,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0"
                      }
                    });
                    continue;
                  }
                }
              } catch (err) {
                console.log(`[AnimeAV] Upns decryption failed: ${err.message}`);
              }
            }
            if (url.includes("player.zilla-networks.com")) {
              const id = url.split("/").pop();
              streams.push({
                name: `AnimeAV Direct (PlayerZilla - ${type})`,
                title: `${title || query} [${type}]`,
                url: `https://player.zilla-networks.com/m3u8/${id}`,
                quality: "1080p",
                headers: {
                  "Referer": epUrl
                }
              });
              continue;
            }
            streams.push({
              name: `AnimeAV Embed (${server} - ${type})`,
              title: `${title || query} [${type}]`,
              url,
              quality: "720p",
              headers: {
                "Referer": epUrl
              }
            });
          }
        }
      }
      return streams;
    } catch (e) {
      console.error(`[AnimeAV] Error in extractor: ${e.message}`);
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
