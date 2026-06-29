/**
 * masters - Built from src/masters/
 * Generated: 2026-06-29T22:26:48.278Z
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

// src/masters/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    console.log(`[Masters] Fetching: ${url}`);
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    }, options));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
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
    console.log(`[Masters] Fetching title from TMDB: ${url}`);
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
      const html = yield fetchText(searchUrl);
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
        console.log("[Masters] No media page found on GnulaHD");
        return [];
      }
      let pageUrl = targetUrl;
      if (mediaType === "tv") {
        console.log(`[Masters] Fetching TV series page to find episode S${season}E${episode}: ${pageUrl}`);
        const tvHtml = yield fetchText(pageUrl);
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
          console.log(`[Masters] Could not find episode link for S${season}E${episode}`);
          return [];
        }
        pageUrl = epUrl;
      }
      console.log(`[Masters] Fetching player page: ${pageUrl}`);
      const playHtml = yield fetchText(pageUrl);
      let dataStr = null;
      const gdMatch = playHtml.match(/var\s+_gd\s*=\s*(\[[\s\S]*?\])\s*;/);
      const epLangsMatch = playHtml.match(/var\s+_gnpv_ep_langs\s*=\s*(\[[\s\S]*?\])\s*;/);
      if (gdMatch) {
        dataStr = gdMatch[1];
      } else if (epLangsMatch) {
        dataStr = epLangsMatch[1];
      }
      if (!dataStr) {
        console.log("[Masters] No video servers found in script tags");
        return [];
      }
      const languages = JSON.parse(dataStr);
      const streams = [];
      for (const lang of languages) {
        const langLabel = lang.label || "Latino";
        for (const srv of lang.servers || []) {
          if (srv.src) {
            streams.push({
              name: `GnulaHD (${srv.title || "Servidor"})`,
              title: `${title || query} [${langLabel}]`,
              url: srv.src,
              quality: "720p",
              headers: {
                "Referer": "https://ww3.gnulahd.nu/"
              }
            });
          }
        }
      }
      return streams;
    } catch (err) {
      console.error(`[Masters] Error in extractor: ${err.message}`);
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
