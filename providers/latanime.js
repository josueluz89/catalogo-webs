/**
 * latanime - Built from src/latanime/
 * Generated: 2026-06-29T23:38:26.252Z
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

// src/latanime/http.js
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

// src/latanime/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://latanime.org";
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
      const searchUrl = `${MAIN_URL}/buscar?q=${encodeURIComponent(query)}`;
      console.log(`[Latanime] Searching: ${searchUrl}`);
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("div.col-6, div.col-md-6, div.col-md-4, div.item").each((i, el) => {
        const anchor = $(el).find("a");
        const href = anchor.attr("href");
        const name = $(el).find("h2, h3, span.title, div.text-2xs").text().trim();
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
        console.log("[Latanime] Media not found on Latanime");
        return [];
      }
      let pageUrl = targetUrl;
      if (pageUrl.includes("/ver/")) {
        pageUrl = pageUrl.replace("/ver/", "/anime/").split("-episodio")[0];
      } else if (pageUrl.includes("/media/")) {
        const slug = pageUrl.split("/")[2];
        pageUrl = `${MAIN_URL}/anime/${slug}`;
      }
      if (!pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      console.log(`[Latanime] Fetching details page: ${pageUrl}`);
      const tvHtml = yield fetchText(pageUrl);
      const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
      let epUrl = null;
      tv$("div[style*='overflow-y: auto'] > a").each((i, el) => {
        const href = tv$(el).attr("href") || "";
        const name = tv$(el).text().trim();
        const epMatch = name.match(/Capitulo\s+(\d+)/i);
        const epNum = epMatch ? parseInt(epMatch[1], 10) : null;
        if (epNum === episode) {
          epUrl = href;
        }
      });
      if (!epUrl && mediaType === "movie") {
        epUrl = tv$("div[style*='overflow-y: auto'] > a").first().attr("href") || targetUrl;
      }
      if (!epUrl) {
        console.log(`[Latanime] Episode ${episode} not found`);
        return [];
      }
      if (!epUrl.startsWith("http")) {
        epUrl = MAIN_URL + epUrl;
      }
      console.log(`[Latanime] Fetching player page: ${epUrl}`);
      const playHtml = yield fetchText(epUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      const playerList = [];
      play$("ul.cap_repro li a").each((i, el) => {
        const player = play$(el).attr("data-player");
        if (player) {
          playerList.push(player);
        }
      });
      const downloadList = [];
      play$("div.descarga2 div a").each((i, el) => {
        const href = play$(el).attr("href");
        if (href) {
          downloadList.push(href);
        }
      });
      const streams = [];
      const addStream = (url, name) => {
        let cleanUrl = url.replace(/\\/g, "");
        if (cleanUrl.startsWith("//")) {
          cleanUrl = "https:" + cleanUrl;
        }
        if (cleanUrl.includes("pixeldrain.com")) {
          const id = cleanUrl.trim().split("/").pop();
          streams.push({
            name: `Latanime Direct (Pixeldrain)`,
            title: `${title || query} [Latino]`,
            url: `https://pixeldrain.com/api/file/${id}?download`,
            quality: "720p",
            headers: {
              "Referer": epUrl
            }
          });
        } else {
          streams.push({
            name: `Latanime Embed (${name})`,
            title: `${title || query} [Latino]`,
            url: cleanUrl,
            quality: "720p",
            headers: {
              "Referer": MAIN_URL
            }
          });
        }
      };
      for (const playerVal of playerList) {
        try {
          const decoded = atob(playerVal);
          const repUrl = `${MAIN_URL}/reproductor?url=${playerVal}`;
          console.log(`[Latanime] Fetching player: ${repUrl}`);
          const repHtml = yield fetchText(repUrl);
          const rep$ = import_cheerio_without_node_native.default.load(repHtml);
          const iframeSrc = rep$("iframe, embed").attr("src") || decoded;
          if (iframeSrc) {
            addStream(iframeSrc, "Player");
          }
        } catch (err) {
          console.log(`[Latanime] Error resolving player: ${err.message}`);
        }
      }
      for (const dlUrl of downloadList) {
        addStream(dlUrl, "Download");
      }
      return streams;
    } catch (e) {
      console.error(`[Latanime] Error in extractor: ${e.message}`);
      return [];
    }
  });
}

// src/latanime/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[Latanime] Request: ${mediaType} ${tmdbId} (S${season}E${episode})`);
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[Latanime] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
