/**
 * latanime - Built from src/latanime/
 * Generated: 2026-06-30T00:19:50.867Z
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
    if (!res.ok)
      throw new Error(`Failed to fetch from TMDB: ${res.status}`);
    const data = yield res.json();
    const title = mediaType === "movie" ? data.title : data.name;
    const originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    return { title, originalTitle };
  });
}
function base64Decode2(input) {
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
function getEmbedResolver(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow-route.com")) {
    return resolveVoeStream;
  }
  return null;
}
function getServerLabel(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow"))
    return "VOE";
  if (url.includes("streamwish") || url.includes("hlswish") || url.includes("vibuxer"))
    return "StreamWish";
  if (url.includes("vidhide") || url.includes("dintezuvio"))
    return "VidHide";
  if (url.includes("pixeldrain"))
    return "Pixeldrain";
  return "Online";
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { title, originalTitle } = yield getMediaTitle(tmdbId, mediaType);
      const query = title || originalTitle;
      if (!query)
        return [];
      const searchUrl = `${MAIN_URL}/buscar?q=${encodeURIComponent(query)}`;
      const html = yield fetchWithRetry(searchUrl);
      const $ = import_cheerio_without_node_native.default.load(html);
      const candidates = [];
      $("div.col-6, div.col-md-6, div.col-md-4, div.item, article, div.post, div.entry").each((i, el) => {
        const anchor = $(el).find("a").first();
        const href = anchor.attr("href");
        const name = $(el).find("h2, h3, span.title, div.text-2xs, img[alt]").first().text().trim() || anchor.attr("title") || "";
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
      if (pageUrl.includes("/ver/")) {
        pageUrl = pageUrl.replace("/ver/", "/anime/").split("-episodio")[0];
      } else if (pageUrl.includes("/media/")) {
        const slug = pageUrl.split("/")[2];
        pageUrl = `${MAIN_URL}/anime/${slug}`;
      }
      if (!pageUrl.startsWith("http")) {
        pageUrl = MAIN_URL + pageUrl;
      }
      const tvHtml = yield fetchWithRetry(pageUrl);
      const tv$ = import_cheerio_without_node_native.default.load(tvHtml);
      let epUrl = null;
      tv$("div[style*='overflow-y: auto'] > a, a[href*='capitulo'], a[href*='episodio'], a[href*='episode']").each((i, el) => {
        const href = tv$(el).attr("href") || "";
        const name = tv$(el).text().trim();
        const epMatch = name.match(/Capitulo\s+(\d+)/i) || name.match(/Episodio\s+(\d+)/i) || name.match(/-(\d+)$/);
        const epNum = epMatch ? parseInt(epMatch[1], 10) : null;
        if (epNum === episode) {
          epUrl = href;
        }
      });
      if (!epUrl && mediaType === "movie") {
        epUrl = tv$("div[style*='overflow-y: auto'] > a").first().attr("href") || targetUrl;
      }
      if (!epUrl)
        return [];
      if (!epUrl.startsWith("http")) {
        epUrl = MAIN_URL + epUrl;
      }
      const playHtml = yield fetchWithRetry(epUrl);
      const play$ = import_cheerio_without_node_native.default.load(playHtml);
      const playerList = [];
      play$("ul.cap_repro li a, div.player-option a, a[data-player]").each((i, el) => {
        const player = play$(el).attr("data-player");
        if (player) {
          playerList.push(player);
        }
      });
      const downloadList = [];
      play$('div.descarga2 div a, div.download a, a[href*="pixeldrain"], a[href*="mega"]').each((i, el) => {
        const href = play$(el).attr("href");
        if (href)
          downloadList.push(href);
      });
      const streams = [];
      const addStream = (url, name) => __async(this, null, function* () {
        let cleanUrl = url.replace(/\\/g, "");
        if (cleanUrl.startsWith("//")) {
          cleanUrl = "https:" + cleanUrl;
        }
        const resolver = getEmbedResolver(cleanUrl);
        if (resolver) {
          const result = yield resolver(cleanUrl);
          if (result && result.url) {
            const quality = result.quality || (yield detectQualityFromM3U8(result.url));
            const serverLabel = getServerLabel(cleanUrl);
            streams.push({
              name: `Latanime Direct (${serverLabel})`,
              title: `${quality || "HD"} \xB7 Latino`,
              url: result.url,
              quality: quality || "Unknown",
              headers: result.headers || { Referer: MAIN_URL }
            });
            return;
          }
        }
        if (cleanUrl.includes("pixeldrain.com")) {
          const id = cleanUrl.trim().split("/").pop();
          streams.push({
            name: "Latanime Direct (Pixeldrain)",
            title: `HD \xB7 Latino`,
            url: `https://pixeldrain.com/api/file/${id}?download`,
            quality: "Unknown",
            headers: { Referer: epUrl }
          });
          return;
        }
        streams.push({
          name: `Latanime Embed (${name})`,
          title: `Embed \xB7 Latino`,
          url: cleanUrl,
          quality: "Unknown",
          headers: { Referer: MAIN_URL }
        });
      });
      for (const playerVal of playerList) {
        try {
          const decoded = base64Decode2(playerVal);
          const repUrl = `${MAIN_URL}/reproductor?url=${playerVal}`;
          const repHtml = yield fetchWithRetry(repUrl);
          const rep$ = import_cheerio_without_node_native.default.load(repHtml);
          const iframeSrc = rep$("iframe, embed").attr("src") || decoded;
          if (iframeSrc) {
            yield addStream(iframeSrc, "Player");
          }
        } catch (err) {
        }
      }
      for (const dlUrl of downloadList) {
        yield addStream(dlUrl, "Download");
      }
      return streams;
    } catch (e) {
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
