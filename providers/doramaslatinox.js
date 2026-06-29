/**
 * doramaslatinox - Built from src/doramaslatinox/
 * Generated: 2026-06-29T23:59:32.184Z
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

// src/doramaslatinox/http.js
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

// src/doramaslatinox/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_crypto_js = __toESM(require("crypto-js"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://doramafox.es";
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
    console.error(`[DoramasLatinoX] AES Decryption error: ${e.message}`);
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
      const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
      console.log(`[DoramasLatinoX] Searching: ${searchUrl}`);
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("div.result-item article").each((i, el) => {
        const titleElement = $(el).find("div.details div.title a");
        const href = titleElement.attr("href");
        const name = titleElement.text().trim();
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
        console.log("[DoramasLatinoX] Media not found on DoramasLatinoX");
        return [];
      }
      let pageUrl = targetUrl;
      if (mediaType === "tv") {
        console.log(`[DoramasLatinoX] Fetching TV series page: ${pageUrl}`);
        const tvHtml = yield fetchText(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        tv$("ul.episodios a").each((i, el) => {
          const href = tv$(el).attr("href");
          const numText = tv$(el).find("div.numerando").text() || "";
          const parts = numText.split("-");
          const s = parseInt(parts[0], 10) || 1;
          const e = parseInt(parts[1], 10) || 1;
          if (s === season && e === episode) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          console.log(`[DoramasLatinoX] Episode S${season}E${episode} not found`);
          return [];
        }
        pageUrl = epUrl;
      }
      console.log(`[DoramasLatinoX] Fetching player page: ${pageUrl}`);
      const playHtml = yield fetchText(pageUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      const playerOptions = [];
      play$("li.dooplay_player_option").each((i, el) => {
        const post = play$(el).attr("data-post");
        const type = play$(el).attr("data-type");
        const nume = play$(el).attr("data-nume");
        if (post && type && nume) {
          playerOptions.push({ post, type, nume });
        }
      });
      console.log(`[DoramasLatinoX] Found ${playerOptions.length} player options`);
      const streams = [];
      for (const opt of playerOptions) {
        try {
          const apiUrl = `${MAIN_URL}/wp-json/dooplayer/v2/${opt.post}/${opt.type}/${opt.nume}`;
          console.log(`[DoramasLatinoX] Fetching player API: ${apiUrl}`);
          const apiRes = yield fetch(apiUrl);
          if (!apiRes.ok)
            continue;
          const apiData = yield apiRes.json();
          let embedUrl = apiData.embed_url;
          if (!embedUrl)
            continue;
          embedUrl = embedUrl.replace(/\\/g, "");
          console.log(`[DoramasLatinoX] Fetching embed page: ${embedUrl}`);
          const embedHtml = yield fetchText(embedUrl, {
            headers: { "Referer": pageUrl }
          });
          const embed$ = import_cheerio_without_node_native.default.load(embedHtml);
          const iframeSrc = embed$("iframe").attr("src") || embedUrl;
          if (iframeSrc.includes("p2pplay.online") || iframeSrc.includes("doramasfoxito")) {
            const hash = iframeSrc.split("#").pop().split("/").pop();
            const u = new URL(iframeSrc);
            const baseurl = `${u.protocol}//${u.host}`;
            const videoApiUrl = `${baseurl}/api/v1/video?id=${hash}`;
            console.log(`[DoramasLatinoX] Resolving secure player API: ${videoApiUrl}`);
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
                  name: `DoramasLatinoX Direct`,
                  title: `${title || query} [Latino]`,
                  url: parsed.source,
                  quality: "1080p",
                  headers: {
                    "Referer": iframeSrc,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0"
                  }
                });
                continue;
              }
            }
          }
          streams.push({
            name: `DoramasLatinoX Embed`,
            title: `${title || query} [Latino]`,
            url: iframeSrc,
            quality: "720p",
            headers: {
              "Referer": MAIN_URL
            }
          });
        } catch (err) {
          console.log(`[DoramasLatinoX] Failed resolving option: ${err.message}`);
        }
      }
      return streams;
    } catch (e) {
      console.error(`[DoramasLatinoX] Error in extractor: ${e.message}`);
      return [];
    }
  });
}

// src/doramaslatinox/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[DoramasLatinoX] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[DoramasLatinoX] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
