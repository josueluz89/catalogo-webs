/**
 * animeytx - Built from src/animeytx/
 * Generated: 2026-06-29T23:38:26.230Z
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

// src/animeytx/http.js
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

// src/animeytx/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://wwv.animeytx.net";
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
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
      console.log(`[AnimeYTX] Searching: ${searchUrl}`);
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("article.bs").each((i, el) => {
        const a = $(el).find("a");
        const href = a.attr("href");
        const name = $(el).find(".tt").text().trim() || a.attr("title") || "";
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
        console.log("[AnimeYTX] Media not found on AnimeYTX");
        return [];
      }
      let pageUrl = targetUrl;
      if (mediaType === "tv") {
        console.log(`[AnimeYTX] Fetching TV page: ${pageUrl}`);
        const tvHtml = yield fetchText(pageUrl);
        const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
        let epUrl = null;
        tv$(".eplister ul li").each((i, el) => {
          const a = tv$(el).find("a");
          const href = a.attr("href");
          const epNum = parseInt(tv$(el).find(".epl-num").text().trim(), 10);
          if (epNum === episode) {
            epUrl = href;
          }
        });
        if (!epUrl) {
          console.log(`[AnimeYTX] Episode ${episode} not found`);
          return [];
        }
        pageUrl = epUrl;
      }
      console.log(`[AnimeYTX] Fetching player page: ${pageUrl}`);
      const playHtml = yield fetchText(pageUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      const options = [];
      play$("select.mirror option").each((i, el) => {
        const val = play$(el).attr("value");
        const serverName = play$(el).text().trim();
        if (val) {
          options.push({ val, serverName });
        }
      });
      const streams = [];
      for (const opt of options) {
        try {
          const decodedHtml = atob(opt.val);
          const iframeMatch = decodedHtml.match(/src="([^"]+)"/);
          if (!iframeMatch)
            continue;
          let iframeUrl = iframeMatch[1].replace(/\\/g, "");
          if (iframeUrl.startsWith("//")) {
            iframeUrl = "https:" + iframeUrl;
          }
          if (iframeUrl.includes("vipbanner") || opt.serverName.toLowerCase().includes("vip")) {
            continue;
          }
          if (iframeUrl.includes("mytsumi.com")) {
            console.log(`[AnimeYTX] Loading mytsumi player page: ${iframeUrl}`);
            const initialRes = yield fetchText(iframeUrl, { headers: { "Referer": pageUrl } });
            const init$ = import_cheerio_without_node_native.default.load(initialRes);
            const playLink = init$("div.play a").attr("href") || "";
            const targetUrl2 = playLink ? playLink : iframeUrl;
            console.log(`[AnimeYTX] Fetching target player page: ${targetUrl2}`);
            const pageText = yield fetchText(targetUrl2, { headers: { "Referer": iframeUrl } });
            const qualityRegex = /const\s+qualities\s*=\s*(\{.*?\});/;
            const qualMatch = pageText.match(qualityRegex);
            if (qualMatch) {
              const qualJson = JSON.parse(qualMatch[1]);
              for (const label of Object.keys(qualJson)) {
                const videoUrl = qualJson[label].replace(/\\/g, "");
                streams.push({
                  name: `AnimeYTX Direct (${opt.serverName} - ${label})`,
                  title: `${title || query} [Subbed]`,
                  url: videoUrl,
                  quality: label,
                  headers: {
                    "Referer": "https://mytsumi.com/"
                  }
                });
              }
            }
            const tabsRegex = /const\s+videoTabs\s*=\s*(\[.*?\]);/;
            const tabsMatch = pageText.match(tabsRegex);
            if (tabsMatch) {
              const tabsJson = JSON.parse(tabsMatch[1]);
              for (const tab of tabsJson) {
                let tabUrl = (tab.url || "").replace(/\\/g, "");
                if (tabUrl && tabUrl !== "about:blank") {
                  streams.push({
                    name: `AnimeYTX Tab (${opt.serverName})`,
                    title: `${title || query} [Subbed]`,
                    url: tabUrl,
                    quality: "720p",
                    headers: {
                      "Referer": targetUrl2
                    }
                  });
                }
              }
            }
            const dlRegex = /const\s+downloadsByQuality\s*=\s*(\{.*?\});/;
            const dlMatch = pageText.match(dlRegex);
            if (dlMatch) {
              const dlJson = JSON.parse(dlMatch[1]);
              for (const quality of Object.keys(dlJson)) {
                const items = dlJson[quality] || [];
                for (const item of items) {
                  let dlUrl = (item.download_url || "").replace(/\\/g, "");
                  if (dlUrl) {
                    streams.push({
                      name: `AnimeYTX Direct (${opt.serverName} - Download ${quality})`,
                      title: `${title || query} [Subbed]`,
                      url: dlUrl,
                      quality,
                      headers: {
                        "Referer": targetUrl2
                      }
                    });
                  }
                }
              }
            }
            continue;
          }
          streams.push({
            name: `AnimeYTX Embed (${opt.serverName})`,
            title: `${title || query} [Subbed]`,
            url: iframeUrl,
            quality: "720p",
            headers: {
              "Referer": MAIN_URL
            }
          });
        } catch (err) {
          console.log(`[AnimeYTX] Failed resolving option: ${err.message}`);
        }
      }
      return streams;
    } catch (e) {
      console.error(`[AnimeYTX] Error in extractor: ${e.message}`);
      return [];
    }
  });
}

// src/animeytx/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[AnimeYTX] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[AnimeYTX] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
