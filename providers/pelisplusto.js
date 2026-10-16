/**
 * pelisplusto - Built from src/pelisplusto/
 * Generated: 2026-10-16T21:46:01.333Z
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
var FETCH_TIMEOUT = 2e4;
function fetchWithTimeout(url, options, timeout) {
  if (!options)
    options = {};
  var ms = timeout || FETCH_TIMEOUT;
  var controller = null;
  var signal = null;
  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      signal = controller.signal;
      if (typeof setTimeout !== "undefined") {
        (function(c) {
          setTimeout(function() {
            try {
              c.abort();
            } catch (e) {
            }
          }, ms);
        })(controller);
      }
    }
  } catch (e) {
    controller = null;
  }
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8"
  }, options.headers || {});
  var req = { headers, redirect: "follow" };
  if (signal)
    req.signal = signal;
  if (options.method)
    req.method = options.method;
  if (options.body)
    req.body = options.body;
  return fetch(url, Object.assign({}, options, req));
}
function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  });
}
function fetchJson(url, options, timeout) {
  return fetchText(url, options, timeout).then(function(raw) {
    return JSON.parse(raw);
  });
}
function fetchWithRetry(url, options, retries, timeout) {
  if (retries === void 0 || retries === null)
    retries = 2;
  return fetchText(url, options, timeout).catch(function(e) {
    if (retries <= 0)
      throw e;
    if (typeof setTimeout === "undefined") {
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
    return new Promise(function(r) {
      setTimeout(r, 1e3);
    }).then(function() {
      return fetchWithRetry(url, options, retries - 1, timeout);
    });
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
    if (typeof setTimeout === "undefined") {
      return guessQualityFromUrl(url);
    }
    var guessed = guessQualityFromUrl(url);
    if (guessed !== "Unknown")
      return guessed;
    try {
      const res = yield fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      }, 5e3);
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
        var re1 = /(?:mp4|hls)'\s*:\s*'([^']+)'/gi;
        var re2 = /(?:mp4|hls)"\s*:\s*"([^"]+)"/gi;
        var m;
        while ((m = re1.exec(pageText)) !== null) {
          var u1 = m[1];
          if (u1.indexOf("aHR0") === 0) {
            try {
              u1 = base64Decode(u1) || u1;
            } catch (e) {
            }
          }
          return { url: u1, quality: extractQuality(u1), headers: { Referer: embedUrl } };
        }
        while ((m = re2.exec(pageText)) !== null) {
          var u2 = m[1];
          if (u2.indexOf("aHR0") === 0) {
            try {
              u2 = base64Decode(u2) || u2;
            } catch (e) {
            }
          }
          return { url: u2, quality: extractQuality(u2), headers: { Referer: embedUrl } };
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

// src/shared/embedResolvers.js
function getUrlOrigin(url) {
  if (!url)
    return "";
  const match = url.match(/^(https?:\/\/[^\/]+)/);
  return match ? match[1] : "";
}
function unpackPacked(html) {
  try {
    const pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch)
      return null;
    let [, p, a, c, k] = pMatch;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split("|");
    const decodeBase36 = (num, rad) => {
      const symbols = "0123456789abcdefghijklmnopqrstuvwxyz";
      let res = "";
      while (num > 0) {
        res = symbols[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res || "0";
    };
    return p.replace(/\b\w+\b/g, (w) => {
      const idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}
function normalizeVidHideUrl(url) {
  try {
    if (!url)
      return "";
    let res = url;
    if (!res.includes("/embed/")) {
      const match = res.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
      if (match) {
        res = `${match[1]}/embed/${match[2]}`;
      }
    }
    return res;
  } catch (e) {
    return url;
  }
}
var DOMAIN_MAP = {
  "hglink.to": "vibuxer.com",
  "ghbrisk.com": "vibuxer.com",
  "premilkyway.com": "streamwish.to"
};
function mapDomain(url) {
  let result = url;
  var keys = Object.keys(DOMAIN_MAP);
  for (var i = 0; i < keys.length; i++) {
    var from = keys[i];
    var to = DOMAIN_MAP[from];
    if (result.indexOf(from) !== -1) {
      result = result.replace(from, to);
      break;
    }
  }
  return result;
}
function resolveHLSWishStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const base = mapDomain(embedUrl);
      const origin0 = getUrlOrigin(base);
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://embed69.org/",
        Origin: "https://embed69.org",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9"
      };
      const candidates = [base];
      const vVariant = base.replace("/e/", "/v/");
      if (vVariant !== base)
        candidates.push(vVariant);
      let html = null;
      let origin = origin0;
      for (const u of candidates) {
        try {
          html = yield fetchWithRetry(u, { headers }, 1);
          origin = getUrlOrigin(u);
          break;
        } catch (e) {
          html = null;
        }
      }
      if (!html)
        return null;
      const fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fileMatch) {
        let fileUrl = fileMatch[1];
        if (fileUrl.startsWith("/"))
          fileUrl = origin + fileUrl;
        const quality = yield detectQualityFromM3U8(fileUrl);
        return { url: fileUrl, quality, headers: { Referer: origin + "/" } };
      }
      const unpacked = unpackPacked(html);
      if (unpacked) {
        const srcMatch = unpacked.match(/["']([^"']{30,}\.m3u8[^"']*)['"]/i);
        if (srcMatch) {
          let fileUrl = srcMatch[1];
          if (fileUrl.startsWith("/"))
            fileUrl = origin + fileUrl;
          const quality = yield detectQualityFromM3U8(fileUrl);
          return { url: fileUrl, quality, headers: { Referer: origin + "/" } };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVidHideProStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const normalizedUrl = normalizeVidHideUrl(embedUrl);
      const origin = getUrlOrigin(normalizedUrl);
      const html = yield fetchWithRetry(normalizedUrl, {
        headers: {
          Referer: "https://embed69.org/",
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
        if (srcMatch)
          script = srcMatch[1];
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
        headers: __spreadProps(__spreadValues({}, defaultHeaders), { Referer: "https://embed69.org/" })
      });
      const iframeSrc = initialResponse.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (iframeSrc) {
        let iframeUrl = iframeSrc[1];
        if (!iframeUrl.startsWith("http")) {
          iframeUrl = getUrlOrigin(embedUrl) + iframeUrl;
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
              url = getUrlOrigin(iframeUrl) + url;
            const quality = yield detectQualityFromM3U8(url);
            return { url, quality, headers: { Referer: getUrlOrigin(iframeUrl) + "/" } };
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
            url = getUrlOrigin(embedUrl) + url;
          const quality = yield detectQualityFromM3U8(url);
          return { url, quality, headers: { Referer: getUrlOrigin(embedUrl) + "/" } };
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
      const origin = getUrlOrigin(embedUrl);
      const filecode = embedUrl.replace(/\/+$/, "").split("/").pop();
      if (!filecode)
        return null;
      var bodyStr = "op=embed&file_code=" + encodeURIComponent(filecode) + "&auto=1&referer=" + encodeURIComponent(embedUrl);
      const res = yield fetch(origin + "/dl", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
          Referer: origin
        },
        body: bodyStr
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
function resolveMp4uploadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.mp4upload.com/"
        }
      });
      if (!html)
        return null;
      const m = html.match(/player\.src\(\{\s*type:\s*"video\/mp4",\s*src:\s*"([^"]+)"/) || html.match(/type:\s*"video\/mp4",\s*src:\s*"([^"]+)"/) || html.match(/"src"\s*:\s*"(https?:[^"]+\.mp4[^"]*)"/);
      if (!m)
        return null;
      return {
        url: m[1],
        quality: "HD",
        headers: { Referer: "https://www.mp4upload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveUqloadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          "Upgrade-Insecure-Requests": "1"
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
function resolveYourUploadStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://www.yourupload.com/"
        }
      });
      const m = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i) || html.match(/(https?:[^"'<>\s]+\.mp4[^"'<>\s]*)/i);
      if (!m)
        return null;
      const url = m[1] || m[0];
      if (url.indexOf("http") !== 0)
        return null;
      return {
        url,
        quality: "720p",
        headers: { Referer: "https://www.yourupload.com/" }
      };
    } catch (e) {
      return null;
    }
  });
}
function extractUrlsetM3U8(html) {
  try {
    if (!html)
      return null;
    html = html.replace(/\\"/g, '"').replace(/\\\//g, "/");
    var m = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*"([^"]+?\.m3u8[^"]*?)"/i);
    var u = m && m[1];
    if (u && u.indexOf("//") === 0)
      u = "https:" + u;
    if (u && u.indexOf("http") === 0)
      return u;
    var unpacked = unpackPacked(html);
    if (unpacked) {
      unpacked = unpacked.replace(/\\"/g, '"').replace(/\\\//g, "/");
      var m2 = unpacked.match(/file\s*:\s*"([^"]+?\.m3u8[^"]*?)"/i) || unpacked.match(/((?:https?:)?\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (m2) {
        var u2 = m2[1] || m2[0];
        if (u2 && u2.indexOf("//") === 0)
          u2 = "https:" + u2;
        if (u2 && u2.indexOf("http") === 0)
          return u2;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
function resolveGoodstreamStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: origin + "/"
        }
      }, 1, 12e3);
      const url = extractUrlsetM3U8(html);
      if (!url)
        return null;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveVimeosStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: origin + "/"
        }
      }, 1, 12e3);
      const url = extractUrlsetM3U8(html);
      if (!url)
        return null;
      const quality = yield detectQualityFromM3U8(url);
      return { url, quality, headers: { Referer: origin + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveDoodStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: embedUrl
        }
      }, 1, 1e4);
      const host = getUrlOrigin(embedUrl);
      const m = html.match(/\/pass_md5\/([\w\-\/.]+)/);
      if (!m)
        return null;
      const res = yield fetchWithTimeout(host + "/pass_md5/" + m[1], {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: embedUrl
        }
      }, 1e4);
      if (!res.ok)
        return null;
      const url = (yield res.text()).trim();
      if (!url || url.indexOf("http") !== 0)
        return null;
      return { url, quality: "720p", headers: { Referer: host + "/" } };
    } catch (e) {
      return null;
    }
  });
}
function resolveVidaraStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const origin = getUrlOrigin(embedUrl);
      const code = embedUrl.replace(/\/+$/, "").split("/").pop().split("?")[0];
      if (!code)
        return null;
      const res = yield fetchWithTimeout(origin + "/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: embedUrl,
          Origin: origin,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({ filecode: code })
      });
      if (!res.ok)
        return null;
      let data;
      try {
        data = JSON.parse(yield res.text());
      } catch (e) {
        return null;
      }
      if (!data || !data.streaming_url)
        return null;
      return {
        url: data.streaming_url,
        quality: "1080p",
        headers: { Referer: origin + "/", Origin: origin }
      };
    } catch (e) {
      return null;
    }
  });
}
function resolveOkRuStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
          Referer: "https://ok.ru/"
        }
      });
      let m = html.match(/hlsManifestUrl(?:&quot;|"):(?:&quot;|")([^"&]+?)(?:&quot;|")/);
      if (!m)
        return null;
      const url = m[1].replace(/\\u0026/gi, "&").replace(/\\/g, "");
      if (url.indexOf("http") !== 0)
        return null;
      return {
        url,
        quality: "720p",
        headers: {
          Referer: "https://ok.ru/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        }
      };
    } catch (e) {
      return null;
    }
  });
}
function getEmbedResolver(url) {
  if (url.includes("ok.ru")) {
    return resolveOkRuStream;
  }
  if (url.includes("voe.sx") || url.includes("cloudwindow-route.com")) {
    return resolveVoeStream;
  }
  if (url.includes("hlswish") || url.includes("streamwish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("hglink") || url.includes("ghbrisk") || url.includes("premilkyway") || url.includes("hgplaycdn") || url.includes("waaw")) {
    return resolveHLSWishStream;
  }
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions") || url.includes("morencius")) {
    return resolveVidHideProStream;
  }
  if (url.includes("byse") || url.includes("filemoon") || url.includes("rapidvideo")) {
    return resolveFilemoonStream;
  }
  if (url.includes("luluvid") || url.includes("lulus") || url.includes("lulu")) {
    return resolveLulusStream;
  }
  if (url.includes("yourupload")) {
    return resolveYourUploadStream;
  }
  if (url.includes("vidara") || url.includes("vidwara")) {
    return resolveVidaraStream;
  }
  if (url.includes("uqload")) {
    return resolveUqloadStream;
  }
  if (url.includes("goodstream")) {
    return resolveGoodstreamStream;
  }
  if (url.includes("vimeos")) {
    return resolveVimeosStream;
  }
  if (url.includes("doodstream") || url.includes("dsvplay") || url.includes("dood.to") || url.includes("dood.watch") || url.includes("dood.so")) {
    return resolveDoodStream;
  }
  if (url.includes("mp4upload")) {
    return resolveMp4uploadStream;
  }
  return null;
}

// src/shared/powAes.js
var import_crypto_js = __toESM(require("crypto-js"));
function sha256Hex(texto) {
  return import_crypto_js.default.SHA256(texto).toString(import_crypto_js.default.enc.Hex);
}
function resolverPoW(challenge, difficulty, salt) {
  var prefijo = "";
  for (var i = 0; i < difficulty; i++)
    prefijo += "0";
  var techo = 2e6;
  for (var nonce = 0; nonce < techo; nonce++) {
    if (sha256Hex(challenge + nonce).indexOf(prefijo) === 0) {
      return import_crypto_js.default.SHA256(challenge + nonce + salt);
    }
  }
  return null;
}
function aesCbcDescifrar(base64, llave) {
  try {
    var normal = String(base64 || "").replace(/-/g, "+").replace(/_/g, "/");
    var crudo = import_crypto_js.default.enc.Base64.parse(normal);
    if (!crudo || crudo.sigBytes <= 16)
      return null;
    var iv = import_crypto_js.default.lib.WordArray.create(crudo.words.slice(0, 4), 16);
    var cifrado = import_crypto_js.default.lib.WordArray.create(crudo.words.slice(4), crudo.sigBytes - 16);
    var claro = import_crypto_js.default.AES.decrypt(
      { ciphertext: cifrado },
      llave,
      { iv, mode: import_crypto_js.default.mode.CBC, padding: import_crypto_js.default.pad.Pkcs7 }
    );
    var texto = claro.toString(import_crypto_js.default.enc.Utf8);
    return texto || null;
  } catch (e) {
    return null;
  }
}

// src/pelisplusto/embed69.js
var MAIN_URL = "https://pelisplushd.bz";
function clasificarIdioma(etiqueta) {
  var t = String(etiqueta || "").toLowerCase();
  if (t.indexOf("lat") !== -1)
    return "LAT";
  if (t.indexOf("sub") !== -1 || t.indexOf("vose") !== -1)
    return "SUB";
  return "";
}
function etiquetaServidor(nombre) {
  var n = String(nombre || "Server").trim();
  if (!n)
    return "Server";
  return n.charAt(0).toUpperCase() + n.slice(1);
}
function dedupe(entradas) {
  var vistos = {};
  var salida = [];
  var i;
  for (i = 0; i < entradas.length; i++) {
    var e = entradas[i];
    if (!e || !e.url || vistos[e.url])
      continue;
    vistos[e.url] = 1;
    salida.push(e);
  }
  return salida;
}
function preferirLatino(entradas) {
  var lat = [];
  var sub = [];
  var i;
  for (i = 0; i < entradas.length; i++) {
    if (entradas[i].lang === "LAT")
      lat.push(entradas[i]);
    else if (entradas[i].lang === "SUB")
      sub.push(entradas[i]);
  }
  return lat.length > 0 ? lat : sub;
}
function resolverPaginaF(html) {
  var mChallenge = html.match(/POW_CHALLENGE\s*=\s*'([^']+)'/);
  var mDifficulty = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);
  var mSalt = html.match(/POW_SALT\s*=\s*'([^']+)'/);
  var mData = html.match(/let dataLink\s*=\s*(\[[\s\S]*?\]);/);
  if (!mChallenge || !mDifficulty || !mSalt || !mData)
    return [];
  var llave = resolverPoW(mChallenge[1], parseInt(mDifficulty[1], 10), mSalt[1]);
  if (!llave)
    return [];
  var data;
  try {
    data = JSON.parse(mData[1]);
  } catch (e) {
    return [];
  }
  if (!Array.isArray(data))
    return [];
  var entradas = [];
  var i, j;
  for (i = 0; i < data.length; i++) {
    var file = data[i];
    var lang = clasificarIdioma(file && file.video_language);
    if (!lang)
      continue;
    var embeds = file && file.sortedEmbeds || [];
    for (j = 0; j < embeds.length; j++) {
      var emb = embeds[j];
      if (!emb || !emb.link)
        continue;
      var url = aesCbcDescifrar(emb.link, llave);
      if (url && url.indexOf("http") === 0) {
        entradas.push({ url, label: etiquetaServidor(emb.servername), lang });
      }
    }
  }
  return preferirLatino(dedupe(entradas));
}
function resolverPaginaVideo(html) {
  var langs = {};
  var reTab = /<li[^>]*data-lang="(\d+)"[^>]*>\s*<img[^>]*alt="([^"]*)"/gi;
  var mt;
  while ((mt = reTab.exec(html)) !== null) {
    var langTab = clasificarIdioma(mt[2]);
    if (langTab)
      langs[mt[1]] = langTab;
  }
  var entradas = [];
  var reSrv = /<li[^>]*onclick="playServerVast\('([^']+)'\)[^>]*data-lang="(\d+)"[^>]*>\s*<img[^>]*>\s*<span>([^<]*)<\/span>/gi;
  var ms;
  while ((ms = reSrv.exec(html)) !== null) {
    var lang = langs[ms[2]];
    if (!lang)
      continue;
    var url = ms[1];
    if (url.indexOf("http") !== 0)
      continue;
    entradas.push({ url, label: etiquetaServidor(ms[3]), lang });
  }
  return preferirLatino(dedupe(entradas));
}
function resolveEmbed69Servers(embedUrl) {
  return fetchText(embedUrl, { headers: { Referer: MAIN_URL + "/" } }).then(function(html) {
    if (!html)
      return [];
    if (html.indexOf("let dataLink") !== -1)
      return resolverPaginaF(html);
    if (html.indexOf("playServerVast(") !== -1)
      return resolverPaginaVideo(html);
    return [];
  }).catch(function() {
    return [];
  });
}

// src/pelisplusto/extractor.js
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL2 = "https://pelisplushd.bz";
var ACCENT_MAP = { "\xE1": "a", "\xE9": "e", "\xED": "i", "\xF3": "o", "\xFA": "u", "\xFC": "u", "\xF1": "n", "\xC1": "a", "\xC9": "e", "\xCD": "i", "\xD3": "o", "\xDA": "u", "\xDC": "u", "\xD1": "n", "\xE0": "a", "\xE8": "e", "\xEC": "i", "\xF2": "o", "\xF9": "u", "\xE2": "a", "\xEA": "e", "\xEE": "i", "\xF4": "o", "\xFB": "u", "\xE4": "a", "\xEB": "e", "\xEF": "i", "\xF6": "o", "\xE7": "c", "\xE3": "a", "\xF5": "o" };
function stripAccents(s) {
  return (s || "").replace(/[^\x00-\x7F]/g, function(c) {
    return ACCENT_MAP[c] || "";
  });
}
function normalizeText(text) {
  if (!text)
    return "";
  return stripAccents(text.toLowerCase()).replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function cleanTitle(raw) {
  if (!raw)
    return "";
  return raw.replace(/^ver\s+/i, "").replace(/\s*\(\d{4}\)\s*/g, " ").split(" Online")[0].split(" online")[0].split(" (")[0].replace(/\s+/g, " ").trim();
}
function getMediaTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
  return fetchJson(url).then(function(data) {
    var title = mediaType === "movie" ? data.title : data.name;
    var originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    var year = null;
    var date = mediaType === "movie" ? data.release_date : data.first_air_date;
    if (date && date.length >= 4)
      year = date.slice(0, 4);
    return { title, originalTitle, year };
  });
}
function extractSearchCandidates(html) {
  var candidates = [];
  var anchorRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = anchorRegex.exec(html)) !== null) {
    var href = m[1];
    var inner = m[2];
    if (!href)
      continue;
    var kind = null;
    if (href.indexOf("/pelicula/") !== -1)
      kind = "movie";
    else if (href.indexOf("/serie/") !== -1)
      kind = "tv";
    else if (href.indexOf("/anime/") !== -1)
      kind = "tv";
    if (!kind)
      continue;
    if (href.indexOf("/temporada/") !== -1)
      continue;
    var title = "";
    var dataTitle = m[0].match(/data-title="([^"]*)"/i);
    if (dataTitle)
      title = dataTitle[1];
    if (!title) {
      var alt = inner.match(/<img\b[^>]*alt="([^"]*)"/i);
      if (alt)
        title = alt[1];
    }
    if (!title) {
      var h = inner.match(/<(h2|p|span)\b[^>]*>([^<]*)<\/(h2|p|span)>/i);
      if (h)
        title = h[2];
    }
    title = cleanTitle(title.replace(/<[^>]*>/g, "").trim());
    if (!title)
      continue;
    var slug = href.split("/pelicula/").pop().split("/serie/").pop().split("/anime/").pop().split("/")[0].split("?")[0];
    if (!slug)
      continue;
    var prefix = href.indexOf("/anime/") !== -1 ? "anime/" : "";
    candidates.push({ title, slug: prefix + slug, kind });
  }
  var seen = {};
  return candidates.filter(function(c) {
    var k = c.kind + "|" + c.slug;
    if (seen[k])
      return false;
    seen[k] = true;
    return true;
  });
}
function searchSite(query) {
  var url = MAIN_URL2 + "/search?s=" + encodeURIComponent(query);
  return fetchText(url).then(function(html) {
    return extractSearchCandidates(html);
  }).catch(function() {
    return [];
  });
}
function scoreCandidates(candidates, media, expectedKind) {
  var no = normalizeText(media.originalTitle || "");
  var nt = normalizeText(media.title || "");
  var words = (no + " " + nt).split(" ").filter(Boolean);
  var unique = {};
  words = words.filter(function(w2) {
    if (unique[w2])
      return false;
    unique[w2] = true;
    return true;
  });
  var best = null, bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var nc = normalizeText(c.title);
    var score = 0;
    if (nc === no || nc === nt)
      score = 100;
    else if (no && (nc.indexOf(no) !== -1 || no.indexOf(nc) !== -1) || nt && (nc.indexOf(nt) !== -1 || nt.indexOf(nc) !== -1))
      score = 80;
    if (score === 0) {
      var qMatch = 0, cMatch = 0, w;
      var cWords = nc.split(" ").filter(Boolean);
      for (var a = 0; a < words.length; a++) {
        if (nc.indexOf(words[a]) !== -1)
          qMatch++;
      }
      for (var b = 0; b < cWords.length; b++) {
        for (var q = 0; q < words.length; q++) {
          if (words[q] === cWords[b]) {
            cMatch++;
            break;
          }
        }
      }
      score = qMatch * 8 + cMatch * 5;
    }
    if (media.year && c.title.indexOf(media.year) !== -1)
      score += 5;
    if (c.kind === expectedKind)
      score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore < 15)
    return null;
  return best;
}
function getServersFromDetail(html) {
  var videoMap = {};
  var vRegex = /video\[(\d+)\]\s*=\s*['"]([^'"]+)['"]/g;
  var vm;
  while ((vm = vRegex.exec(html)) !== null) {
    videoMap[parseInt(vm[1], 10)] = vm[2];
  }
  var labels = {};
  var liRegex = /<li[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/gi;
  var lm;
  while ((lm = liRegex.exec(html)) !== null) {
    var label = lm[2].replace(/<[^>]*>/g, "").trim() || "Server";
    labels[parseInt(lm[1], 10)] = label;
  }
  var servers = [];
  for (var idx in videoMap) {
    if (!Object.prototype.hasOwnProperty.call(videoMap, idx))
      continue;
    var src = videoMap[idx];
    if (!src || src.indexOf("http") !== 0)
      continue;
    servers.push({ src, label: labels[idx] || "Server " + idx });
  }
  if (servers.length === 0) {
    var ifRegex = /<iframe\b[^>]*src="([^"]+)"[^>]*>/gi;
    var im, n = 0;
    while ((im = ifRegex.exec(html)) !== null) {
      var isrc = im[1];
      if (isrc.indexOf("//") === 0)
        isrc = "https:" + isrc;
      if (isrc.indexOf("http") !== 0)
        continue;
      n++;
      servers.push({ src: isrc, label: "Embed " + n });
    }
  }
  var seen = {};
  return servers.filter(function(s) {
    if (seen[s.src])
      return false;
    seen[s.src] = true;
    return true;
  });
}
function resolverUnEmbed(embedUrl, label, lang) {
  var fixedUrl = mapDomain(embedUrl);
  var resolver = getEmbedResolver(fixedUrl);
  if (!resolver)
    return Promise.resolve(null);
  return resolver(fixedUrl).then(function(result) {
    if (result && result.url) {
      return {
        name: "Pelisplusto (" + label + ")",
        title: (result.quality || "HD") + " \xB7 " + lang + " \xB7 " + label,
        url: result.url,
        quality: result.quality || "HD",
        headers: result.headers
      };
    }
    return null;
  }).catch(function() {
    return null;
  });
}
function resolveServers(servers) {
  var streams = [];
  var promises = servers.map(function(s) {
    if (s.src.indexOf("embed69.org/") !== -1) {
      return resolveEmbed69Servers(s.src).then(function(targets) {
        var inner = targets.map(function(t) {
          return resolverUnEmbed(t.url, t.label, t.lang);
        });
        return Promise.all(inner).then(function(resolved) {
          resolved.forEach(function(r) {
            if (r)
              streams.push(r);
          });
        });
      }).catch(function() {
      });
    }
    return resolverUnEmbed(s.src, s.label, "LAT").then(function(r) {
      if (r)
        streams.push(r);
    });
  });
  return Promise.all(promises).then(function() {
    return streams;
  });
}
function getMovieStreams(slug) {
  return fetchText(MAIN_URL2 + "/pelicula/" + slug).then(function(html) {
    return resolveServers(getServersFromDetail(html));
  }).catch(function() {
    return [];
  });
}
function getEpisodeStreams(slug, season, episode) {
  var basePath = slug.indexOf("anime/") === 0 ? MAIN_URL2 + "/" + slug : MAIN_URL2 + "/serie/" + slug;
  return fetchText(basePath).then(function(html) {
    var epRegex = new RegExp('<a\\b[^>]*href="([^"]*\\/temporada\\/' + season + "\\/capitulo\\/" + episode + '(?=[\\/"?])[^"]*)"[^>]*>', "i");
    var m = epRegex.exec(html);
    var epUrl = m ? m[1] : basePath + "/temporada/" + season + "/capitulo/" + episode;
    if (epUrl.indexOf("http") !== 0)
      epUrl = MAIN_URL2 + (epUrl.charAt(0) === "/" ? "" : "/") + epUrl;
    return fetchText(epUrl);
  }).then(function(html) {
    return resolveServers(getServersFromDetail(html));
  }).catch(function() {
    return [];
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  var tmdbType = mediaType === "tv" || mediaType === "series" || mediaType === "anime" ? "tv" : "movie";
  var expectedKind = tmdbType;
  return getMediaTitle(tmdbId, tmdbType).then(function(media) {
    var queries = [];
    if (media.originalTitle)
      queries.push(media.originalTitle);
    if (media.title && media.title !== media.originalTitle)
      queries.push(media.title);
    if (queries.length === 0)
      return [];
    var all = [];
    var chain = Promise.resolve();
    queries.forEach(function(q) {
      chain = chain.then(function() {
        return searchSite(q).then(function(c) {
          all = all.concat(c);
        });
      });
    });
    return chain.then(function() {
      var best = scoreCandidates(all, media, expectedKind);
      if (!best)
        return [];
      if (expectedKind === "movie")
        return getMovieStreams(best.slug);
      return getEpisodeStreams(best.slug, season || 1, episode || 1);
    });
  }).catch(function(err) {
    console.error("[Pelisplusto] Error: " + (err && err.message ? err.message : err));
    return [];
  });
}

// src/shared/validate.js
var VALIDATE_TIMEOUT_MS = 7e3;
var VALIDATE_CONCURRENCY = 4;
function qualityRank(q) {
  if (!q)
    return 0;
  var s = String(q).toLowerCase();
  if (s.indexOf("4k") !== -1 || s.indexOf("2160") !== -1)
    return 2160;
  var m = s.match(/(\d{3,4})\s*p/);
  if (m)
    return parseInt(m[1], 10);
  return 0;
}
function isM3u8(url) {
  return /\.m3u8(\?|#|$)/i.test(url || "");
}
function checkUrl(url, headers, timeoutMs) {
  return new Promise(function(resolve) {
    var done = false;
    var timer = null;
    var controller = null;
    function finish(ok) {
      if (done)
        return;
      done = true;
      if (timer) {
        try {
          clearTimeout(timer);
        } catch (e) {
        }
        timer = null;
      }
      if (controller) {
        try {
          controller.abort();
        } catch (e) {
        }
      }
      resolve(!!ok);
    }
    if (!url || typeof url !== "string" || url.indexOf("http") !== 0) {
      resolve(false);
      return;
    }
    if (typeof setTimeout !== "undefined") {
      timer = setTimeout(function() {
        timer = null;
        finish(false);
      }, timeoutMs || VALIDATE_TIMEOUT_MS);
    }
    var reqHeaders = {
      "Range": "bytes=0-2047",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (headers) {
      for (var k in headers) {
        if (Object.prototype.hasOwnProperty.call(headers, k) && headers[k]) {
          reqHeaders[k] = headers[k];
        }
      }
    }
    var reqInit = { headers: reqHeaders, redirect: "follow" };
    try {
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        reqInit.signal = controller.signal;
      }
    } catch (e) {
      controller = null;
    }
    fetch(url, reqInit).then(function(res) {
      var status = res.status;
      if (status === 200 || status === 206 || status === 416) {
        if (isM3u8(url)) {
          res.text().then(function(t) {
            finish(t && t.indexOf("#EXTM3U") !== -1);
          }).catch(function() {
            finish(true);
          });
        } else {
          finish(true);
        }
      } else {
        finish(false);
      }
    }).catch(function() {
      finish(false);
    });
  });
}
function filterWorkingStreams(streams, opts) {
  opts = opts || {};
  var timeout = opts.timeoutMs || VALIDATE_TIMEOUT_MS;
  var concurrency = opts.concurrency || VALIDATE_CONCURRENCY;
  var seen = {};
  var uniq = [];
  (streams || []).forEach(function(s) {
    if (!s || !s.url || seen[s.url])
      return;
    seen[s.url] = 1;
    uniq.push(s);
  });
  if (uniq.length === 0)
    return Promise.resolve([]);
  var results = new Array(uniq.length);
  var cursor = 0;
  function worker() {
    if (cursor >= uniq.length)
      return Promise.resolve();
    var i = cursor++;
    var st = uniq[i];
    return checkUrl(st.url, st.headers, timeout).then(function(ok) {
      results[i] = ok ? st : null;
    }).catch(function() {
      results[i] = null;
    }).then(worker);
  }
  var workers = [];
  var n = Math.min(concurrency, uniq.length);
  for (var w = 0; w < n; w++)
    workers.push(worker());
  return Promise.all(workers).then(function() {
    var alive = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i])
        alive.push(results[i]);
    }
    alive.sort(function(a, b) {
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
    return alive;
  }).catch(function() {
    return uniq;
  });
}
function withWorkingStreams(extractPromise) {
  return Promise.resolve(extractPromise).then(function(streams) {
    return filterWorkingStreams(streams);
  }).catch(function() {
    return [];
  });
}

// src/pelisplusto/index.js
function withTimeout(promise, ms) {
  if (typeof setTimeout === "undefined")
    return promise;
  return Promise.race([
    promise,
    new Promise(function(res) {
      setTimeout(function() {
        res([]);
      }, ms);
    })
  ]);
}
function getStreams(tmdbId, mediaType, season, episode) {
  return withTimeout(
    withWorkingStreams(extractStreams(tmdbId, mediaType, season, episode)),
    4e4
  );
}
module.exports = { getStreams };
