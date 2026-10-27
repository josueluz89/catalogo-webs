/**
 * animeav1 - Built from src/animeav1/
 * Generated: 2026-10-27T18:11:13.754Z
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
    const payload = pMatch[1];
    const radix = parseInt(pMatch[2], 10);
    const symtab = pMatch[4].split("|");
    const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const decodeIndex = (word) => {
      let value = 0;
      for (let i = 0; i < word.length; i++) {
        const digit = ALPHABET.indexOf(word[i]);
        if (digit === -1 || digit >= radix)
          return -1;
        value = value * radix + digit;
      }
      return value;
    };
    return payload.replace(/\b\w+\b/g, (word) => {
      const idx = decodeIndex(word);
      return idx >= 0 && idx < symtab.length && symtab[idx] ? symtab[idx] : word;
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
    const UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    try {
      const origin = getUrlOrigin(embedUrl);
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": UA2,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: origin + "/"
        }
      }, 1, 12e3);
      if (!html)
        return null;
      const headers = { "User-Agent": UA2 };
      const fromSources = extractUrlsetM3U8(html);
      if (fromSources) {
        return { url: fromSources, quality: yield detectQualityFromM3U8(fromSources), headers };
      }
      const vimeoId = (html.match(/vimeo\.com\/video\/(\d+)/i) || embedUrl.match(/\/(\d{7,10})/) || [])[1];
      if (vimeoId) {
        try {
          const cfg = yield fetchJson("https://player.vimeo.com/video/" + vimeoId + "/config", {
            headers: { "User-Agent": UA2, Referer: embedUrl }
          });
          const files = cfg && cfg.request && cfg.request.files;
          const hlsUrl = files && files.hls && files.hls.cdns && files.hls.cdns.default && files.hls.cdns.default.url;
          if (hlsUrl)
            return { url: hlsUrl, quality: "1080p", headers };
          const prog = files && files.progressive;
          if (prog && prog.length > 0) {
            const best = prog.slice().sort(function(a, b) {
              return (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0);
            })[0];
            if (best && best.url)
              return { url: best.url, quality: best.quality ? best.quality + "p" : "1080p", headers };
          }
        } catch (e) {
        }
      }
      const direct = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
      if (direct) {
        return { url: direct[0], quality: yield detectQualityFromM3U8(direct[0]), headers };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveVideoappStream(embedUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchWithRetry(embedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: embedUrl
        }
      }, 1, 12e3);
      if (!html)
        return null;
      const iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
      if (!iframe)
        return null;
      let iframeUrl = iframe[1];
      if (iframeUrl.indexOf("//") === 0)
        iframeUrl = "https:" + iframeUrl;
      else if (iframeUrl.indexOf("http") !== 0)
        return null;
      if (!/vimeos|vms\.sh/i.test(iframeUrl))
        return null;
      return resolveVimeosStream(iframeUrl);
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
  if (url.includes("videoapp")) {
    return resolveVideoappStream;
  }
  return null;
}

// src/animeav1/extractor.js
var BASE_URL = "https://animeav1.com";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Referer": BASE_URL + "/"
};
var SKIP_HOSTS = [
  "embedsb.com",
  "streamsb.net",
  "sbplay.org",
  "hqq.tv",
  "my.mail.ru",
  "animeav1.uns.bio",
  "terabox.com",
  "1fichier.com",
  "luluvdo.com",
  "lulustream.com",
  "mega.nz",
  "mega.co"
];
function calidadDe(q) {
  var s = String(q || "");
  if (!s || s === "Unknown")
    return "720p";
  return s;
}
var ACCENTS = {
  "\xE1": "a",
  "\xE0": "a",
  "\xE4": "a",
  "\xE2": "a",
  "\xE3": "a",
  "\xE5": "a",
  "\xE9": "e",
  "\xE8": "e",
  "\xEB": "e",
  "\xEA": "e",
  "\xED": "i",
  "\xEC": "i",
  "\xEF": "i",
  "\xEE": "i",
  "\xF3": "o",
  "\xF2": "o",
  "\xF6": "o",
  "\xF4": "o",
  "\xF5": "o",
  "\xFA": "u",
  "\xF9": "u",
  "\xFC": "u",
  "\xFB": "u",
  "\xF1": "n",
  "\xE7": "c",
  "\xDF": "ss"
};
function sinAcentos(s) {
  var out = "";
  var str = String(s == null ? "" : s).toLowerCase();
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    out += ACCENTS[c] != null ? ACCENTS[c] : c;
  }
  return out;
}
function cleanTitle(title) {
  return sinAcentos(title).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}
function tmdbFichaEsMX(id, tipo) {
  var url = "https://api.themoviedb.org/3/" + tipo + "/" + id + "?api_key=" + TMDB_KEY + "&language=es-MX";
  return fetchText(url, { headers: { "User-Agent": UA } }, 1e4).then(function(raw) {
    var res = JSON.parse(raw);
    return {
      titleEsMX: tipo === "movie" ? res.title : res.name,
      titleOriginal: tipo === "movie" ? res.original_title : res.original_name
    };
  }).catch(function() {
    return {};
  });
}
function tmdbAltLatinos(id, tipo) {
  var url = "https://api.themoviedb.org/3/" + tipo + "/" + id + "/alternative_titles?api_key=" + TMDB_KEY;
  return fetchText(url, { headers: { "User-Agent": UA } }, 1e4).then(function(raw) {
    var res = JSON.parse(raw);
    var list = res.results || res.titles || [];
    var romaji = [];
    var otros = [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i] && list[i].title;
      if (!t || /[a-zA-Z]/.test(t) === false)
        continue;
      var esRomaji = list[i].type && String(list[i].type).toLowerCase().indexOf("romaji") !== -1;
      if (esRomaji && romaji.indexOf(t) === -1)
        romaji.push(t);
      else if (!esRomaji && otros.indexOf(t) === -1)
        otros.push(t);
    }
    return romaji.concat(otros).slice(0, 5);
  }).catch(function() {
    return [];
  });
}
function getTmdbTitles(tmdbId, tipo) {
  return Promise.all([
    tmdbFichaEsMX(tmdbId, tipo),
    tmdbAltLatinos(tmdbId, tipo)
  ]).then(function(r) {
    return { titleEsMX: r[0].titleEsMX, titleOriginal: r[0].titleOriginal, altTitles: r[1] };
  }).catch(function() {
    return {};
  });
}
function generateQueries(info) {
  var queries = [];
  function addQuery(q) {
    if (!q || /[a-zA-Z]/.test(q) === false)
      return;
    var cleanQ = String(q).replace(/[,;.:!?]/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!cleanQ)
      return;
    if (queries.indexOf(cleanQ) < 0)
      queries.push(cleanQ);
    var stripped = cleanQ.replace(/^(the|los|las|el|la|lo|un|una|unos|unas)\s+/i, "");
    if (stripped !== cleanQ && queries.indexOf(stripped) < 0)
      queries.push(stripped);
  }
  addQuery(info.titleEsMX);
  (info.altTitles || []).forEach(addQuery);
  addQuery(info.titleOriginal);
  return queries.slice(0, 5);
}
function searchOnSite(query) {
  var url = BASE_URL + "/catalogo?search=" + encodeURIComponent(query);
  return fetchText(url, { headers: HEADERS }, 15e3).then(function(html) {
    var results = [];
    var re = /<article[\s\S]*?<\/article>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var art = m[0];
      var hrefM = art.match(/href="(\/media\/[^"]+)"/i);
      if (!hrefM)
        continue;
      var slug = hrefM[1].replace("/media/", "").replace(/\/+$/, "");
      if (!slug)
        continue;
      var titleM = art.match(/<h3[^>]*>([^<]*)<\/h3>/i) || art.match(/alt="(?:Portada de )?([^"]*)"/i);
      var typeM = art.match(/text-xs font-bold[^>]*>([^<]*)</i);
      results.push({
        slug,
        title: titleM ? titleM[1] : "",
        type: typeM ? typeM[1] : ""
      });
    }
    return results;
  }).catch(function() {
    return [];
  });
}
function parseDevalueData(dataArray) {
  var servers = [];
  if (!dataArray || dataArray.length < 2)
    return servers;
  var schema = dataArray[0];
  if (!schema || typeof schema !== "object")
    return servers;
  function resolve(idx) {
    if (typeof idx !== "number" || idx >= dataArray.length)
      return null;
    return dataArray[idx];
  }
  function extractLang(langKey) {
    var langIdx = schema[langKey];
    if (typeof langIdx !== "number")
      return;
    var langObj = resolve(langIdx);
    if (!langObj || typeof langObj !== "object")
      return;
    var langs = Object.keys(langObj);
    for (var li = 0; li < langs.length; li++) {
      var lang = langs[li];
      var arrIdx = langObj[lang];
      if (typeof arrIdx !== "number")
        continue;
      var arr = resolve(arrIdx);
      if (!Array.isArray(arr))
        continue;
      var isDub = String(lang).toUpperCase() === "DUB";
      for (var ai = 0; ai < arr.length; ai++) {
        var serverObj = resolve(arr[ai]);
        if (!serverObj || typeof serverObj !== "object")
          continue;
        var name = String(resolve(serverObj.server) || "");
        var url = String(resolve(serverObj.url) || "");
        if (url && url.indexOf("http") === 0) {
          servers.push({ title: name, url, dub: isDub });
        }
      }
    }
  }
  extractLang("embeds");
  return servers;
}
function sanitizePlaybackHeaders(url, headers) {
  var h = {};
  var src = headers || {};
  for (var k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k))
      h[k] = src[k];
  }
  var u = String(url || "").toLowerCase();
  if (/vimeos\.|vms\.sh/.test(u)) {
    delete h.Referer;
    delete h.referer;
    delete h.Origin;
    delete h.origin;
  } else if (/mp4upload\.com/.test(u)) {
    h.Referer = String(url || "");
  }
  return h;
}
function resolverEmbed(serverName, embedUrl) {
  var u = String(embedUrl || "").toLowerCase();
  var name = String(serverName || "").toLowerCase();
  if ((name === "hls" || u.indexOf("zilla-networks") !== -1) && u.indexOf("/play/") !== -1) {
    return Promise.resolve({
      url: embedUrl.replace("/play/", "/m3u8/"),
      quality: "720p",
      headers: { "Referer": BASE_URL + "/", "User-Agent": UA }
    });
  }
  var fn = null;
  try {
    fn = getEmbedResolver(embedUrl);
  } catch (e) {
    fn = null;
  }
  var promesa = typeof fn === "function" ? Promise.resolve().then(function() {
    return fn(embedUrl);
  }) : Promise.resolve(null);
  return promesa.then(function(r) {
    if (r && r.url)
      return r;
    if (name.indexOf("byse") !== -1 || name.indexOf("filemoon") !== -1 || u.indexOf("byse") !== -1) {
      return resolveFilemoonStream(embedUrl);
    }
    if (name.indexOf("mp4upload") !== -1 || u.indexOf("mp4upload") !== -1) {
      return resolveMp4uploadStream(embedUrl);
    }
    if (name.indexOf("okru") !== -1 || name.indexOf("ok.ru") !== -1 || u.indexOf("ok.ru") !== -1) {
      return resolveOkRuStream(embedUrl);
    }
    if (name.indexOf("streamwish") !== -1 || u.indexOf("streamwish") !== -1 || u.indexOf("hlswish") !== -1) {
      return resolveHLSWishStream(embedUrl);
    }
    return null;
  }).then(function(r) {
    if (!r || !r.url)
      return null;
    return {
      url: r.url,
      quality: r.quality || "720p",
      headers: sanitizePlaybackHeaders(r.url, Object.assign({ "Referer": BASE_URL + "/", "User-Agent": UA }, r.headers || {}))
    };
  }).catch(function() {
    return null;
  });
}
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
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
var MAX_STREAMS = 8;
function extraer(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var tipo = mediaType === "movie" ? "movie" : "tv";
    var info = yield getTmdbTitles(tmdbId, tipo);
    if (!info.titleEsMX && !info.titleOriginal && !info.titleEn)
      return [];
    var queries = generateQueries(info);
    var matchTitles = [info.titleEsMX].concat(info.altTitles || []).concat([info.titleOriginal]);
    var best = null;
    var bestScore = -1;
    var bestAny = null;
    var bestAnyScore = 4;
    var vistos = {};
    for (var qi = 0; qi < queries.length; qi++) {
      var results = yield searchOnSite(queries[qi]);
      for (var ri = 0; ri < results.length; ri++) {
        var res = results[ri];
        if (vistos[res.slug])
          continue;
        vistos[res.slug] = true;
        var score = 0;
        var cleanedResult = cleanTitle(res.title);
        var slugResult = cleanedResult.replace(/\s+/g, "-");
        for (var ti = 0; ti < matchTitles.length; ti++) {
          if (!matchTitles[ti])
            continue;
          var cleanedT = cleanTitle(matchTitles[ti]);
          if (!cleanedT)
            continue;
          if (cleanedResult === cleanedT || slugResult === cleanedT.replace(/\s+/g, "-"))
            score = Math.max(score, 1e3 - ti * 20);
          else if (cleanedResult.indexOf(cleanedT) !== -1 || cleanedT.indexOf(cleanedResult) !== -1)
            score = Math.max(score, 500 - ti * 20);
        }
        var normType = sinAcentos(res.type);
        var isPelicula = normType.indexOf("pelicula") !== -1;
        var isEspecial = normType.indexOf("especial") !== -1;
        var isMovieType = isPelicula || isEspecial;
        if (tipo === "movie" && isPelicula)
          score += 15;
        else if (tipo === "movie" && isEspecial)
          score += 5;
        else if (tipo === "movie" && !isMovieType)
          score = Math.max(score - 20, 0);
        else if (tipo === "tv" && !isMovieType)
          score += 10;
        if (score > bestScore && score >= 40) {
          bestScore = score;
          best = res;
        }
        if (score > bestAnyScore) {
          bestAnyScore = score;
          bestAny = res;
        }
      }
      if (bestScore >= 700)
        break;
    }
    var matched = best || (bestAnyScore >= 5 ? bestAny : null);
    if (!matched)
      return [];
    var epNum = tipo === "movie" ? 1 : parseInt(episode, 10) || 1;
    var dataUrl = BASE_URL + "/media/" + matched.slug + "/" + epNum + "/__data.json";
    var servers = [];
    try {
      var raw = yield fetchText(dataUrl, {
        headers: Object.assign({}, HEADERS, { "Accept": "application/json" })
      }, 15e3);
      var json = JSON.parse(raw);
      var nodes = json && json.nodes || [];
      var dataNode = null;
      for (var ni = 0; ni < nodes.length; ni++) {
        var n = nodes[ni];
        if (n && n.data && n.data[0] && (n.data[0].embeds !== void 0 || n.data[0].downloads !== void 0)) {
          dataNode = n;
        }
      }
      if (dataNode)
        servers = parseDevalueData(dataNode.data);
    } catch (e) {
      servers = [];
    }
    if (!servers.length)
      return [];
    var candidatos = [];
    for (var si = 0; si < servers.length; si++) {
      var s = servers[si];
      if (!s.url)
        continue;
      var host = "";
      try {
        host = (s.url.match(/^https?:\/\/([^\/]+)/i) || [])[1] || "";
      } catch (e) {
        host = "";
      }
      var skip = false;
      for (var hi = 0; hi < SKIP_HOSTS.length; hi++) {
        if (host.indexOf(SKIP_HOSTS[hi]) !== -1)
          skip = true;
      }
      if (skip)
        continue;
      candidatos.push(s);
    }
    function rangoServidor(s2) {
      var n2 = String(s2.title || "").toLowerCase();
      var u = String(s2.url || "").toLowerCase();
      if (n2 === "hls" || u.indexOf("zilla-networks") !== -1)
        return 0;
      if (n2.indexOf("yourupload") !== -1 || n2.indexOf("mp4upload") !== -1)
        return 1;
      if (n2.indexOf("voe") !== -1)
        return 2;
      if (n2.indexOf("byse") !== -1 || n2.indexOf("filemoon") !== -1)
        return 4;
      return 3;
    }
    var ordenados = candidatos.map(function(s2, idx) {
      return { s: s2, idx };
    });
    ordenados.sort(function(a, b) {
      var d = rangoServidor(a.s) - rangoServidor(b.s);
      return d !== 0 ? d : a.idx - b.idx;
    });
    var haySub = false;
    var totalSub = 0;
    var totalLat = 0;
    for (var ci = 0; ci < candidatos.length; ci++) {
      if (candidatos[ci].dub)
        totalLat++;
      else {
        haySub = true;
        totalSub++;
      }
    }
    var streams = [];
    var vistosUrl = {};
    var tieneLat = false;
    var tieneSub = false;
    var probadosLat = 0;
    var probadosSub = 0;
    for (var oi = 0; oi < ordenados.length; oi++) {
      if (tieneLat && tieneSub)
        break;
      if (!haySub && tieneLat && streams.length >= 2)
        break;
      if (streams.length >= MAX_STREAMS)
        break;
      var t = ordenados[oi].s;
      if (t.dub && tieneLat && haySub && !tieneSub && probadosSub < totalSub)
        continue;
      if (!t.dub && tieneSub && !tieneLat && probadosLat < totalLat)
        continue;
      if (t.dub)
        probadosLat++;
      else
        probadosSub++;
      var r = yield resolverEmbed(t.title, t.url);
      if (!r || !r.url)
        continue;
      var esHLSPropio = String(t.title || "").toLowerCase() === "hls" || String(t.url || "").indexOf("zilla-networks") !== -1;
      if (esHLSPropio) {
        var vivo = yield fetchText(r.url, { headers: { "Referer": BASE_URL + "/", "User-Agent": UA } }, 1e4).then(function(body) {
          return !!body && body.indexOf("#EXTM3U") !== -1;
        }).catch(function() {
          return false;
        });
        if (!vivo)
          continue;
      }
      if (vistosUrl[r.url])
        continue;
      vistosUrl[r.url] = true;
      var idioma = t.dub ? "Latino" : "Subtitulado";
      if (idioma === "Latino")
        tieneLat = true;
      else
        tieneSub = true;
      streams.push({
        title: String(t.title || "Server") + " \xB7 " + idioma,
        quality: calidadDe(r.quality),
        language: idioma,
        url: r.url,
        headers: r.headers
      });
    }
    return filtrarIdioma(streams);
  });
}

// src/animeav1/index.js
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
  var tipo = String(mediaType || "tv").toLowerCase();
  return withTimeout(
    extraer(tmdbId, tipo === "movie" ? "movie" : "tv", season, episode).catch(function() {
      return [];
    }),
    55e3
  );
}
module.exports = { getStreams };
