/**
 * entrepeliculasyseries - Built from src/entrepeliculasyseries/
 * Generated: 2026-10-16T21:55:28.483Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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
function getServerLabel(url) {
  if (url.includes("voe.sx") || url.includes("cloudwindow"))
    return "VOE";
  if (url.includes("streamwish") || url.includes("hlswish") || url.includes("vibuxer") || url.includes("strwish") || url.includes("premilkyway"))
    return "StreamWish";
  if (url.includes("waaw"))
    return "Waaw";
  if (url.includes("vidhide") || url.includes("dintezuvio") || url.includes("minochinos") || url.includes("dramiyos") || url.includes("dhcplay") || url.includes("smoothpre") || url.includes("dhtpre") || url.includes("vidspeeder") || url.includes("moorearn") || url.includes("travid") || url.includes("vidhidehub") || url.includes("vidhidevip") || url.includes("vidhidepre") || url.includes("kinoger") || url.includes("movearnpre") || url.includes("peytonepre") || url.includes("filelions") || url.includes("morencius"))
    return "VidHide";
  if (url.includes("byse") || url.includes("filemoon") || url.includes("rapidvideo"))
    return "FileMoon";
  if (url.includes("luluvid") || url.includes("lulus"))
    return "Lulu";
  if (url.includes("uqload"))
    return "Uqload";
  if (url.includes("goodstream"))
    return "GoodStream";
  if (url.includes("vimeos"))
    return "Vimeos";
  if (url.includes("doodstream") || url.includes("dsvplay") || url.includes("dood."))
    return "Dood";
  return "Online";
}

// src/entrepeliculasyseries/extractor.js
var HOST = "https://entrepeliculasyseries.nz";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var MAX_EMBEDS = 10;
var MAX_STREAMS = 8;
function utf8Encode(str) {
  var out = [];
  var s = String(str);
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 128) {
      out.push(c);
    } else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else if (c >= 55296 && c <= 56319 && i + 1 < s.length) {
      var nx = s.charCodeAt(i + 1);
      if (nx >= 56320 && nx <= 57343) {
        var cp = 65536 + (c - 55296 << 10) + (nx - 56320);
        out.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63);
        i++;
      } else {
        out.push(239, 191, 189);
      }
    } else if (c >= 55296 && c <= 57343) {
      out.push(239, 191, 189);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return out;
}
function utf8DecodeBytes(bytes) {
  var out = "";
  var i = 0;
  while (i < bytes.length) {
    var c = bytes[i++];
    if (c < 128) {
      out += String.fromCharCode(c);
      continue;
    }
    if ((c & 224) === 192 && i < bytes.length) {
      out += String.fromCharCode((c & 31) << 6 | bytes[i++] & 63);
      continue;
    }
    if ((c & 240) === 224 && i + 1 < bytes.length) {
      var c2 = bytes[i++];
      var c3 = bytes[i++];
      out += String.fromCharCode((c & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
      continue;
    }
    if ((c & 248) === 240 && i + 2 < bytes.length) {
      var b2 = bytes[i++];
      var b3 = bytes[i++];
      var b4 = bytes[i++];
      var cp2 = (c & 7) << 18 | (b2 & 63) << 12 | (b3 & 63) << 6 | b4 & 63;
      cp2 -= 65536;
      out += String.fromCharCode(55296 + (cp2 >> 10), 56320 + (cp2 & 1023));
      continue;
    }
    out += "\uFFFD";
  }
  return out;
}
var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function base64ToBytes(input) {
  var str = String(input || "").replace(/=+$/, "");
  var out = [];
  var bs = 0;
  var bc = 0;
  for (var i = 0; i < str.length; i++) {
    var idx = B64_CHARS.indexOf(str.charAt(i));
    if (idx === -1)
      continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4)
      out.push(255 & bs >> (-2 * bc & 6));
  }
  return out;
}
var SHA_K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
function rotr32(x, n) {
  return (x >>> n | x << 32 - n) >>> 0;
}
function sha256Bytes(data) {
  var H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  var len = data.length;
  var msg = data.slice(0);
  msg.push(128);
  while (msg.length % 64 !== 56)
    msg.push(0);
  var bitHi = Math.floor(len / 536870912);
  var bitLo = len % 536870912 * 8 >>> 0;
  msg.push(bitHi >>> 24 & 255, bitHi >>> 16 & 255, bitHi >>> 8 & 255, bitHi & 255);
  msg.push(bitLo >>> 24 & 255, bitLo >>> 16 & 255, bitLo >>> 8 & 255, bitLo & 255);
  var w = new Array(64);
  var i, off;
  for (off = 0; off < msg.length; off += 64) {
    for (i = 0; i < 16; i++) {
      w[i] = (msg[off + i * 4] << 24 | msg[off + i * 4 + 1] << 16 | msg[off + i * 4 + 2] << 8 | msg[off + i * 4 + 3]) >>> 0;
    }
    for (i = 16; i < 64; i++) {
      var x = w[i - 15];
      var y = w[i - 2];
      var s0 = (rotr32(x, 7) ^ rotr32(x, 18) ^ x >>> 3) >>> 0;
      var s1 = (rotr32(y, 17) ^ rotr32(y, 19) ^ y >>> 10) >>> 0;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (i = 0; i < 64; i++) {
      var S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      var ch = (e & f ^ ~e & g) >>> 0;
      var t1 = h + S1 + ch + SHA_K[i] + w[i] >>> 0;
      var S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      var maj = (a & b ^ a & c ^ b & c) >>> 0;
      var t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
    H[5] = H[5] + f >>> 0;
    H[6] = H[6] + g >>> 0;
    H[7] = H[7] + h >>> 0;
  }
  var out = [];
  for (i = 0; i < 8; i++) {
    out.push(H[i] >>> 24 & 255, H[i] >>> 16 & 255, H[i] >>> 8 & 255, H[i] & 255);
  }
  return out;
}
function sha256Hex(str) {
  var b = sha256Bytes(utf8Encode(str));
  var out = "";
  for (var i = 0; i < b.length; i++) {
    out += (b[i] < 16 ? "0" : "") + b[i].toString(16);
  }
  return out;
}
var AES_SBOX = function() {
  var box = new Array(256);
  var p = 1, q = 1;
  function rotl8(x, n) {
    return (x << n | x >> 8 - n) & 255;
  }
  do {
    p = (p ^ p << 1 & 255 ^ (p & 128 ? 27 : 0)) & 255;
    q = (q ^ q << 1 & 255) & 255;
    q = (q ^ q << 2 & 255) & 255;
    q = (q ^ q << 4 & 255) & 255;
    if (q & 128)
      q = (q ^ 9) & 255;
    box[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 99) & 255;
  } while (p !== 1);
  box[0] = 99;
  return box;
}();
var AES_INV_SBOX = function() {
  var inv = new Array(256);
  for (var i = 0; i < 256; i++)
    inv[AES_SBOX[i]] = i;
  return inv;
}();
var AES_RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
function aes256ExpandKey(key) {
  var Nk = 8, Nr = 14;
  var w = [];
  var i;
  for (i = 0; i < Nk; i++) {
    w.push([key[4 * i] & 255, key[4 * i + 1] & 255, key[4 * i + 2] & 255, key[4 * i + 3] & 255]);
  }
  for (i = Nk; i < 4 * (Nr + 1); i++) {
    var t = w[i - 1].slice(0);
    if (i % Nk === 0) {
      t = [t[1], t[2], t[3], t[0]];
      t = [AES_SBOX[t[0]], AES_SBOX[t[1]], AES_SBOX[t[2]], AES_SBOX[t[3]]];
      t[0] = (t[0] ^ AES_RCON[i / Nk - 1]) & 255;
    } else if (i % Nk === 4) {
      t = [AES_SBOX[t[0]], AES_SBOX[t[1]], AES_SBOX[t[2]], AES_SBOX[t[3]]];
    }
    var pv = w[i - Nk];
    w.push([(pv[0] ^ t[0]) & 255, (pv[1] ^ t[1]) & 255, (pv[2] ^ t[2]) & 255, (pv[3] ^ t[3]) & 255]);
  }
  var rk = [];
  for (i = 0; i < 4 * (Nr + 1); i++)
    rk.push(w[i][0], w[i][1], w[i][2], w[i][3]);
  return { rk, Nr };
}
function gmul(a, b) {
  var p = 0;
  var aa = a & 255;
  var bb = b & 255;
  for (var i = 0; i < 8; i++) {
    if (bb & 1)
      p ^= aa;
    var hi = aa & 128;
    aa = aa << 1 & 255;
    if (hi)
      aa ^= 27;
    bb >>= 1;
  }
  return p & 255;
}
function aesAddRoundKey(s, rk, round) {
  var o = round * 16;
  for (var i = 0; i < 16; i++)
    s[i] = s[i] ^ rk[o + i];
}
function aesInvShiftRows(s) {
  var r, c, row, shifted;
  for (r = 1; r <= 3; r++) {
    row = [s[r], s[r + 4], s[r + 8], s[r + 12]];
    shifted = [];
    for (c = 0; c < 4; c++)
      shifted[c] = row[(c - r + 8) % 4];
    s[r] = shifted[0];
    s[r + 4] = shifted[1];
    s[r + 8] = shifted[2];
    s[r + 12] = shifted[3];
  }
}
function aesInvSubBytes(s) {
  for (var i = 0; i < 16; i++)
    s[i] = AES_INV_SBOX[s[i] & 255];
}
function aesInvMixColumns(s) {
  for (var c = 0; c < 4; c++) {
    var o = 4 * c;
    var a0 = s[o], a1 = s[o + 1], a2 = s[o + 2], a3 = s[o + 3];
    s[o] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
    s[o + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
    s[o + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11);
    s[o + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14);
  }
}
function aesDecryptBlock(input, ks) {
  var s = input.slice(0);
  var Nr = ks.Nr;
  var r;
  aesAddRoundKey(s, ks.rk, Nr);
  for (r = Nr - 1; r >= 1; r--) {
    aesInvShiftRows(s);
    aesInvSubBytes(s);
    aesAddRoundKey(s, ks.rk, r);
    aesInvMixColumns(s);
  }
  aesInvShiftRows(s);
  aesInvSubBytes(s);
  aesAddRoundKey(s, ks.rk, 0);
  return s;
}
function aes256CbcDecrypt(cipherBytes, key, iv) {
  if (!cipherBytes || cipherBytes.length === 0 || cipherBytes.length % 16 !== 0)
    return null;
  var ks = aes256ExpandKey(key);
  var out = [];
  var prev = iv;
  for (var off = 0; off < cipherBytes.length; off += 16) {
    var block = cipherBytes.slice(off, off + 16);
    var dec = aesDecryptBlock(block, ks);
    for (var i = 0; i < 16; i++)
      out.push(dec[i] ^ prev[i]);
    prev = block;
  }
  var pad = out[out.length - 1];
  if (pad < 1 || pad > 16 || pad > out.length)
    return null;
  for (var j = out.length - pad; j < out.length; j++) {
    if (out[j] !== pad)
      return null;
  }
  return out.slice(0, out.length - pad);
}
function extractPowConstants(html) {
  var out = { difficulty: 3, challenge: null, salt: null };
  var m = html.match(/POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/);
  if (m)
    out.challenge = m[1];
  m = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);
  if (m)
    out.difficulty = parseInt(m[1], 10) || 3;
  m = html.match(/POW_SALT\s*=\s*['"]([^'"]+)['"]/);
  if (m)
    out.salt = m[1];
  return out;
}
function solvePow(challenge, difficulty, maxIter) {
  var prefix = "";
  for (var k = 0; k < difficulty; k++)
    prefix += "0";
  var max = maxIter || 4e6;
  for (var nonce = 0; nonce < max; nonce++) {
    if (sha256Hex(challenge + nonce).indexOf(prefix) === 0)
      return nonce;
  }
  return null;
}
function aesKeyBytes(challenge, nonce, salt) {
  return sha256Bytes(utf8Encode(challenge + nonce + (salt || "")));
}
function extractDataLink(html) {
  var patterns = [
    /(?:const|let|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]);/,
    /dataLink\s*=\s*(\[[\s\S]*?\]);/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (!m)
      continue;
    var js = m[1].replace(/\\"/g, '"').replace(/\\\//g, "/");
    try {
      var arr = JSON.parse(js);
      if (arr && typeof arr.length === "number")
        return arr;
    } catch (e) {
    }
  }
  return null;
}
function decryptAesLink(encryptedBase64, key) {
  try {
    var raw = base64ToBytes(encryptedBase64);
    if (raw.length <= 16)
      return null;
    var iv = raw.slice(0, 16);
    var ct = raw.slice(16);
    var plain = aes256CbcDecrypt(ct, key, iv);
    if (!plain)
      return null;
    var text = utf8DecodeBytes(plain);
    if (text.indexOf("http") === -1)
      return null;
    return text;
  } catch (e) {
    return null;
  }
}
function originOf(url) {
  var m = String(url || "").match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : "";
}
function unpackPacked2(html) {
  try {
    let decodeBase36 = function(num, rad) {
      var res = "";
      while (num > 0) {
        res = symbols[num % rad] + res;
        num = Math.floor(num / rad);
      }
      return res || "0";
    };
    var pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch)
      return null;
    var p = pMatch[1];
    var a = parseInt(pMatch[2], 10);
    var k = pMatch[4].split("|");
    var symbols = "0123456789abcdefghijklmnopqrstuvwxyz";
    return p.replace(/\b\w+\b/g, function(w) {
      var idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}
function extractCandidates(html) {
  var text = html;
  var up = unpackPacked2(html);
  if (up)
    text = up;
  var candidates = [];
  var seen = {};
  function push(u) {
    if (!u || typeof u !== "string")
      return;
    var v = u.replace(/\\\//g, "/").replace(/\\"/g, '"').trim();
    if (v && seen[v] !== true) {
      seen[v] = true;
      candidates.push(v);
    }
  }
  var m = text.match(/links\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) {
    var obj = null;
    try {
      obj = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\'/g, "'"));
    } catch (e) {
      obj = null;
    }
    if (obj) {
      var keys = Object.keys(obj);
      var order = [];
      var prefer = ["hls4", "hls3", "hls2", "hls1", "hls"];
      for (var i = 0; i < prefer.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].toLowerCase().indexOf(prefer[i]) !== -1)
            order.push(keys[j]);
        }
      }
      for (var q = 0; q < keys.length; q++) {
        if (order.indexOf(keys[q]) === -1)
          order.push(keys[q]);
      }
      var used = {};
      for (var o = 0; o < order.length; o++) {
        var k2 = order[o];
        if (used[k2])
          continue;
        used[k2] = true;
        var val = obj[k2];
        if (typeof val === "string" && /\.m3u8|master\.txt|urlset/.test(val))
          push(val);
      }
    }
  }
  var re = /(?:file|src)\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/gi;
  var mm;
  while ((mm = re.exec(text)) !== null)
    push(mm[1]);
  var reAbs = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|txt)[^\s"'<>\\]*/gi;
  while ((mm = reAbs.exec(text)) !== null)
    push(mm[0]);
  return candidates;
}
var VIDHIDE_HOSTS = [
  "vidhide",
  "dintezuvio",
  "minochinos",
  "dramiyos",
  "dhcplay",
  "smoothpre",
  "dhtpre",
  "vidspeeder",
  "moorearn",
  "travid",
  "vidhidehub",
  "vidhidevip",
  "vidhidepre",
  "kinoger",
  "movearnpre",
  "peytonepre",
  "filelions",
  "callistanise",
  "morencius",
  "acek-cdn",
  "streamtape"
];
var STREAMWISH_HOSTS = ["hlswish", "streamwish", "vibuxer", "strwish", "hglink", "ghbrisk", "premilkyway", "hgplaycdn"];
function esFamilia(url) {
  var u = String(url || "").toLowerCase();
  for (var i = 0; i < VIDHIDE_HOSTS.length; i++)
    if (u.indexOf(VIDHIDE_HOSTS[i]) !== -1)
      return "vidhide";
  for (var j = 0; j < STREAMWISH_HOSTS.length; j++)
    if (u.indexOf(STREAMWISH_HOSTS[j]) !== -1)
      return "streamwish";
  return null;
}
function rewriteHost(url) {
  return String(url || "").replace(/`/g, "").replace(/^(https?:\/\/)(?:www\.)?hglink\.to(\/|$)/i, "$1vibuxer.com$2").replace(/^(https?:\/\/)(?:www\.)?filelions\.to(\/|$)/i, "$1callistanise.com$2");
}
function normalizeVidhideUrl(url) {
  var u = String(url || "");
  if (u.indexOf("/embed/") !== -1)
    return u;
  var m = u.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
  if (m)
    return m[1] + "/embed/" + m[2];
  return u;
}
function resolverFamilia(embedUrl, familia) {
  var target = rewriteHost(embedUrl);
  if (familia === "vidhide")
    target = normalizeVidhideUrl(target);
  var origin = originOf(target);
  return fetchText(target, { headers: { Referer: "https://embed69.org/", Origin: "https://embed69.org", "User-Agent": UA } }, 12e3).then(function(html) {
    var candidates = extractCandidates(html);
    if (!candidates.length) {
      var iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (!iframe)
        return null;
      var iu = iframe[1];
      if (iu.indexOf("//") === 0)
        iu = "https:" + iu;
      else if (iu.indexOf("/") === 0)
        iu = origin + iu;
      return fetchText(iu, { headers: { Referer: target, "User-Agent": UA } }, 12e3).then(function(h2) {
        return extractCandidates(h2);
      }).catch(function() {
        return [];
      });
    }
    return candidates;
  }).then(function(candidates) {
    if (!candidates || !candidates.length)
      return null;
    var url = candidates[0];
    if (url.indexOf("//") === 0)
      url = "https:" + url;
    else if (url.indexOf("/") === 0)
      url = origin + url;
    else if (url.indexOf("http") !== 0)
      url = origin + "/" + url;
    var qm = url.match(/[_-](\d{3,4})p/i);
    var labels = url.match(/_,([a-z,]+),\.urlset/);
    var quality = qm ? qm[1] + "p" : "HD";
    if (!qm && labels && labels[1].indexOf("x") !== -1)
      quality = "1080p";
    return { url, quality, headers: { "User-Agent": UA, Referer: origin + "/", Origin: origin } };
  }).catch(function() {
    return null;
  });
}
function resolverEmbed(embedUrl) {
  var familia = esFamilia(embedUrl);
  var promesa = familia ? resolverFamilia(embedUrl, familia) : Promise.resolve(null);
  return promesa.then(function(r) {
    if (r && r.url)
      return r;
    var fn = null;
    try {
      fn = getEmbedResolver(embedUrl);
    } catch (e) {
      fn = null;
    }
    if (typeof fn !== "function")
      return null;
    return Promise.resolve().then(function() {
      return fn(embedUrl);
    }).then(function(r2) {
      return r2 && r2.url ? r2 : null;
    }).catch(function() {
      return null;
    });
  }).catch(function() {
    return null;
  });
}
function tmdbJson(path) {
  var url = "https://api.themoviedb.org/3/" + path + (path.indexOf("?") === -1 ? "?" : "&") + "api_key=" + TMDB_KEY;
  return fetchText(url, { headers: { "User-Agent": UA } }, 1e4).then(function(raw) {
    return JSON.parse(raw);
  }).catch(function() {
    return null;
  });
}
function getTMDBInfo(id, tipo) {
  var titulos = [];
  var year = "";
  var imdb = "";
  return tmdbJson(tipo + "/" + id + "?language=es-MX").then(function(res) {
    if (res) {
      var t = tipo === "movie" ? res.title : res.name;
      var o = tipo === "movie" ? res.original_title : res.original_name;
      if (t && titulos.indexOf(t) < 0)
        titulos.push(t);
      if (o && titulos.indexOf(o) < 0)
        titulos.push(o);
      var fecha = res.release_date || res.first_air_date || "";
      year = String(fecha).substring(0, 4);
    }
    return tmdbJson(tipo + "/" + id + "/external_ids");
  }).then(function(ext) {
    if (ext && ext.imdb_id)
      imdb = ext.imdb_id;
    if (!imdb && !titulos.length)
      return null;
    return { titles: titulos, year, imdbId: imdb };
  }).catch(function() {
    return null;
  });
}
function getVidurlData(vidurlPath) {
  return fetchText(HOST + vidurlPath, {
    headers: { Referer: HOST + "/", "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9" }
  }, 15e3).then(function(html) {
    if (!html || html.length < 500)
      return null;
    var pow = extractPowConstants(html);
    if (!pow.challenge)
      return null;
    var dataLink = extractDataLink(html);
    if (!dataLink || !dataLink.length)
      return null;
    var nonce = solvePow(pow.challenge, pow.difficulty);
    if (nonce === null)
      return null;
    return { dataLink, key: aesKeyBytes(pow.challenge, nonce, pow.salt) };
  }).catch(function() {
    return null;
  });
}
function buildVidurlPath(imdbId, tipo, season, episode) {
  if (!imdbId)
    return null;
  if (tipo === "movie")
    return "/vidurl/" + imdbId + "/";
  var ep = parseInt(episode, 10);
  if (isNaN(ep) || ep < 1)
    ep = 1;
  var epNum = ep < 10 ? "0" + ep : String(ep);
  return "/vidurl/" + imdbId + "-" + season + "x" + epNum + "/";
}
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
function idiomaDeEtiqueta(raw) {
  var up = String(raw || "").toUpperCase().trim();
  if (up === "LAT" || up === "LATINO" || up === "" || up === "MX")
    return "Latino";
  if (up === "SUB" || up === "SUBS" || up === "VOSE" || up === "VOSI")
    return "Subtitulado";
  return null;
}
function filtrarIdioma(streams) {
  var out = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url)
      continue;
    var t = String(s.title || "") + " " + String(s.language || "");
    if (RE_ESPANA.test(t))
      continue;
    if (!RE_LATINO.test(t) && !RE_SUB.test(t))
      continue;
    s.language = RE_SUB.test(t) && !RE_LATINO.test(t) ? "Subtitulado" : "Latino";
    out.push(s);
  }
  return out;
}
var SERVIDORES_DESCARTADOS = ["filemoon", "bysesukior", "1fichier", "fireload", "terabox", "voe"];
function calidadDe(q) {
  var s = String(q || "");
  if (!s || s === "Unknown")
    return "HD";
  return s;
}
function streamsDeDataLink(dataLink, key) {
  var tareas = [];
  for (var i = 0; i < dataLink.length; i++) {
    var bloque = dataLink[i] || {};
    var idioma = idiomaDeEtiqueta(bloque.video_language);
    if (!idioma)
      continue;
    var embeds = bloque.sortedEmbeds || [];
    for (var j = 0; j < embeds.length; j++) {
      var embed = embeds[j] || {};
      if (String(embed.type || "video") !== "video")
        continue;
      var sn = String(embed.servername || "").toLowerCase();
      var descartado = false;
      for (var k = 0; k < SERVIDORES_DESCARTADOS.length; k++) {
        if (sn.indexOf(SERVIDORES_DESCARTADOS[k]) !== -1)
          descartado = true;
      }
      if (descartado)
        continue;
      if (tareas.length >= MAX_EMBEDS)
        break;
      tareas.push({ link: String(embed.link || ""), servername: embed.servername || "", idioma });
    }
  }
  return Promise.all(tareas.map(function(t) {
    var url = decryptAesLink(t.link, key);
    if (!url || url.indexOf("http") !== 0)
      return Promise.resolve(null);
    return resolverEmbed(url).then(function(r) {
      if (!r || !r.url)
        return null;
      var headers = r.headers || {};
      var label = t.servername ? String(t.servername) : "";
      var nombre = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      if (!nombre) {
        try {
          nombre = getServerLabel(url);
        } catch (e) {
          nombre = "Online";
        }
      }
      var calidad = calidadDe(r.quality);
      return {
        title: calidad + " \xB7 " + t.idioma + " \xB7 " + nombre,
        quality: calidad,
        language: t.idioma,
        url: r.url,
        headers,
        __ref: url
      };
    });
  })).then(function(lista) {
    var out = [];
    var vistos = {};
    for (var i2 = 0; i2 < lista.length; i2++) {
      var s = lista[i2];
      if (!s)
        continue;
      if (vistos[s.url])
        continue;
      vistos[s.url] = true;
      delete s.__ref;
      out.push(s);
      if (out.length >= MAX_STREAMS)
        break;
    }
    return out;
  });
}
function extraer(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var tipo = mediaType === "movie" ? "movie" : "tv";
    var info = yield getTMDBInfo(tmdbId, tipo);
    if (!info)
      return [];
    var vidurlPath = buildVidurlPath(info.imdbId, tipo, season, episode);
    var data = vidurlPath ? yield getVidurlData(vidurlPath) : null;
    if (!data)
      return [];
    var streams = yield streamsDeDataLink(data.dataLink, data.key);
    return filtrarIdioma(streams);
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

// src/entrepeliculasyseries/index.js
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
function validarConFailOpen(promesaStreams) {
  return Promise.resolve(promesaStreams).then(function(streams) {
    return filterWorkingStreams(streams).then(function(vivos) {
      if (vivos.length)
        return vivos;
      if (streams && streams.length)
        return streams;
      return [];
    }).catch(function() {
      return streams || [];
    });
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  var tipo = String(mediaType || "movie").toLowerCase();
  return validarConFailOpen(withTimeout(
    extraer(tmdbId, tipo === "movie" ? "movie" : "tv", season, episode).catch(function() {
      return [];
    }),
    4e4
  ));
}
module.exports = { getStreams };
