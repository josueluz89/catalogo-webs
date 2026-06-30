/**
 * flixlatam - Built from src/flixlatam/
 * Generated: 2026-06-30T02:27:02.827Z
 */

// src/shared/http.js
function fetchWithTimeout(url, options, timeout) {
  if (!options)
    options = {};
  var headers = Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  }, options.headers || {});
  return fetch(url, Object.assign({}, options, { headers, redirect: "follow" }));
}
function fetchText(url, options, timeout) {
  return fetchWithTimeout(url, options, timeout).then(function(res) {
    if (!res.ok)
      throw new Error("HTTP " + res.status + " for " + url);
    return res.text();
  });
}
function fetchWithRetry(url, options, retries, timeout) {
  if (!retries)
    retries = 2;
  return fetchText(url, options, timeout).catch(function(e) {
    if (retries <= 0)
      throw e;
    return new Promise(function(r) {
      setTimeout(r, 1e3);
    }).then(function() {
      return fetchWithRetry(url, options, retries - 1, timeout);
    });
  });
}

// src/flixlatam/extractor.js
var TMDB_API_KEY = "1f54bd990f1cdfb230adb312546d765d";
var MAIN_URL = "https://flixlatam.com";
var DOMAIN_MAP = {
  "dintezuvio.com": "vidhide.com",
  "hglink.to": "streamwish.to",
  "minochinos.com": "vidhide.com",
  "ghbrisk.com": "streamwish.to"
};
function mapDomain(url) {
  var result = url;
  for (var from in DOMAIN_MAP) {
    if (result.indexOf(from) !== -1) {
      result = result.replace(from, DOMAIN_MAP[from]);
      break;
    }
  }
  return result;
}
function normalizeText(text) {
  if (!text)
    return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getServerLabel(url) {
  if (url.indexOf("voe.sx") !== -1 || url.indexOf("cloudwindow") !== -1)
    return "VOE";
  if (url.indexOf("streamwish") !== -1 || url.indexOf("hlswish") !== -1 || url.indexOf("vibuxer") !== -1 || url.indexOf("strwish") !== -1 || url.indexOf("premilkyway") !== -1)
    return "StreamWish";
  if (url.indexOf("vidhide") !== -1 || url.indexOf("dintezuvio") !== -1 || url.indexOf("minochinos") !== -1 || url.indexOf("dramiyos") !== -1 || url.indexOf("dhcplay") !== -1 || url.indexOf("smoothpre") !== -1 || url.indexOf("dhtpre") !== -1 || url.indexOf("vidspeeder") !== -1 || url.indexOf("moorearn") !== -1 || url.indexOf("travid") !== -1 || url.indexOf("vidhidehub") !== -1 || url.indexOf("vidhidevip") !== -1 || url.indexOf("vidhidepre") !== -1 || url.indexOf("kinoger") !== -1 || url.indexOf("movearnpre") !== -1 || url.indexOf("peytonepre") !== -1 || url.indexOf("filelions") !== -1)
    return "VidHide";
  if (url.indexOf("bysedikamoum") !== -1 || url.indexOf("bysedi") !== -1 || url.indexOf("filemoon") !== -1 || url.indexOf("rapidvideo") !== -1)
    return "FileMoon";
  if (url.indexOf("luluvid") !== -1 || url.indexOf("lulus") !== -1)
    return "Lulu";
  if (url.indexOf("uqload") !== -1)
    return "Uqload";
  if (url.indexOf("goodstream") !== -1)
    return "GoodStream";
  if (url.indexOf("vimeos") !== -1)
    return "Vimeos";
  return "Online";
}
function sha256(str) {
  function rrot(n, b2) {
    return n >>> b2 | n << 32 - b2;
  }
  var K = [
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
  var h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128)
      bytes.push(c);
    else if (c < 2048) {
      bytes.push(c >> 6 | 192);
      bytes.push(c & 63 | 128);
    } else if (c < 65536) {
      bytes.push(c >> 12 | 224);
      bytes.push(c >> 6 & 63 | 128);
      bytes.push(c & 63 | 128);
    } else {
      bytes.push(c >> 18 | 240);
      bytes.push(c >> 12 & 63 | 128);
      bytes.push(c >> 6 & 63 | 128);
      bytes.push(c & 63 | 128);
    }
  }
  var bitLen = bytes.length * 8;
  bytes.push(128);
  while (bytes.length * 8 % 512 !== 448)
    bytes.push(0);
  for (var i = 7; i >= 0; i--)
    bytes.push(bitLen >>> i * 8 & 255);
  for (var blockStart = 0; blockStart < bytes.length; blockStart += 64) {
    var w = [];
    for (var i = 0; i < 16; i++) {
      w[i] = bytes[blockStart + i * 4] << 24 | bytes[blockStart + i * 4 + 1] << 16 | bytes[blockStart + i * 4 + 2] << 8 | bytes[blockStart + i * 4 + 3];
    }
    for (var i = 16; i < 64; i++) {
      var s0 = rrot(w[i - 15], 7) ^ rrot(w[i - 15], 18) ^ w[i - 15] >>> 3;
      var s1 = rrot(w[i - 2], 17) ^ rrot(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (var i = 0; i < 64; i++) {
      var S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      var ch = e & f ^ ~e & g;
      var temp1 = hh + S1 + ch + K[i] + w[i] >>> 0;
      var S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      var maj = a & b ^ a & c ^ b & c;
      var temp2 = S0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  var hex = "";
  for (var i = 0; i < 8; i++) {
    for (var j = 7; j >= 0; j--) {
      var nibble = h[i] >>> j * 4 & 15;
      hex += nibble.toString(16);
    }
  }
  return hex;
}
var AES_SBOX = [
  99,
  124,
  119,
  123,
  242,
  107,
  111,
  197,
  48,
  1,
  103,
  43,
  254,
  215,
  171,
  118,
  202,
  130,
  201,
  125,
  250,
  89,
  71,
  240,
  173,
  212,
  162,
  175,
  156,
  164,
  114,
  192,
  183,
  253,
  147,
  38,
  54,
  63,
  247,
  204,
  52,
  165,
  229,
  241,
  113,
  216,
  49,
  21,
  4,
  199,
  35,
  195,
  24,
  150,
  5,
  154,
  7,
  18,
  128,
  226,
  235,
  39,
  178,
  117,
  9,
  131,
  44,
  26,
  27,
  110,
  90,
  160,
  82,
  59,
  214,
  179,
  41,
  227,
  47,
  132,
  83,
  209,
  0,
  237,
  32,
  252,
  177,
  91,
  106,
  203,
  190,
  57,
  74,
  76,
  88,
  207,
  208,
  239,
  170,
  251,
  67,
  77,
  51,
  133,
  69,
  249,
  2,
  127,
  80,
  60,
  159,
  168,
  81,
  163,
  64,
  143,
  146,
  157,
  56,
  245,
  188,
  182,
  218,
  33,
  16,
  255,
  243,
  210,
  205,
  12,
  19,
  236,
  95,
  151,
  68,
  23,
  196,
  167,
  126,
  61,
  100,
  93,
  25,
  115,
  96,
  129,
  79,
  220,
  34,
  42,
  144,
  136,
  70,
  238,
  184,
  20,
  222,
  94,
  11,
  219,
  224,
  50,
  58,
  10,
  73,
  6,
  36,
  92,
  194,
  211,
  172,
  98,
  145,
  149,
  228,
  121,
  231,
  200,
  55,
  109,
  141,
  213,
  78,
  169,
  108,
  86,
  244,
  234,
  101,
  122,
  174,
  8,
  186,
  120,
  37,
  46,
  28,
  166,
  180,
  198,
  232,
  221,
  116,
  31,
  75,
  189,
  139,
  138,
  112,
  62,
  181,
  102,
  72,
  3,
  246,
  14,
  97,
  53,
  87,
  185,
  134,
  193,
  29,
  158,
  225,
  248,
  152,
  17,
  105,
  217,
  142,
  148,
  155,
  30,
  135,
  233,
  206,
  85,
  40,
  223,
  140,
  161,
  137,
  13,
  191,
  230,
  66,
  104,
  65,
  153,
  45,
  15,
  176,
  84,
  187,
  22
];
var AES_RSBOX = [
  82,
  9,
  106,
  213,
  48,
  54,
  165,
  56,
  191,
  64,
  163,
  158,
  129,
  243,
  215,
  251,
  124,
  227,
  57,
  130,
  155,
  47,
  255,
  135,
  52,
  142,
  67,
  68,
  196,
  222,
  233,
  203,
  84,
  123,
  148,
  50,
  166,
  194,
  35,
  61,
  238,
  76,
  149,
  11,
  66,
  250,
  195,
  78,
  8,
  46,
  161,
  102,
  40,
  217,
  36,
  178,
  118,
  91,
  162,
  73,
  109,
  139,
  209,
  37,
  114,
  248,
  246,
  100,
  134,
  104,
  152,
  22,
  212,
  164,
  92,
  204,
  93,
  101,
  182,
  146,
  108,
  112,
  72,
  80,
  253,
  237,
  185,
  218,
  94,
  21,
  70,
  87,
  167,
  141,
  157,
  132,
  144,
  216,
  171,
  0,
  140,
  188,
  211,
  10,
  247,
  228,
  88,
  5,
  184,
  179,
  69,
  6,
  208,
  44,
  30,
  143,
  202,
  63,
  15,
  2,
  193,
  175,
  189,
  3,
  1,
  19,
  138,
  107,
  58,
  145,
  17,
  65,
  79,
  103,
  220,
  234,
  151,
  242,
  207,
  206,
  240,
  180,
  230,
  115,
  150,
  172,
  116,
  34,
  231,
  173,
  53,
  133,
  226,
  249,
  55,
  232,
  28,
  117,
  223,
  110,
  71,
  241,
  26,
  113,
  29,
  41,
  197,
  137,
  111,
  183,
  98,
  14,
  170,
  24,
  190,
  27,
  252,
  86,
  62,
  75,
  198,
  210,
  121,
  32,
  154,
  219,
  192,
  254,
  120,
  205,
  90,
  244,
  31,
  221,
  168,
  51,
  136,
  7,
  199,
  49,
  177,
  18,
  16,
  89,
  39,
  128,
  236,
  95,
  96,
  81,
  127,
  169,
  25,
  181,
  74,
  13,
  45,
  229,
  122,
  159,
  147,
  201,
  156,
  239,
  160,
  224,
  59,
  77,
  174,
  42,
  245,
  176,
  200,
  235,
  187,
  60,
  131,
  83,
  153,
  97,
  23,
  43,
  4,
  126,
  186,
  119,
  214,
  38,
  225,
  105,
  20,
  99,
  85,
  33,
  12,
  125
];
var AES_RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77, 154];
function aesKeyExpansion(keyBytes) {
  var Nb = 4, Nk = 8, Nr = 14;
  var w = [];
  for (var i = 0; i < Nk; i++) {
    w[i] = keyBytes[4 * i] << 24 | keyBytes[4 * i + 1] << 16 | keyBytes[4 * i + 2] << 8 | keyBytes[4 * i + 3];
  }
  for (var i = Nk; i < Nb * (Nr + 1); i++) {
    var temp = w[i - 1];
    if (i % Nk === 0) {
      temp = AES_SBOX[temp >>> 16 & 255] << 24 | AES_SBOX[temp >>> 8 & 255] << 16 | AES_SBOX[temp & 255] << 8 | AES_SBOX[temp >>> 24];
      temp ^= AES_RCON[i / Nk - 1] << 24;
    } else if (i % Nk === 4) {
      temp = AES_SBOX[temp >>> 24 & 255] << 24 | AES_SBOX[temp >>> 16 & 255] << 16 | AES_SBOX[temp >>> 8 & 255] << 8 | AES_SBOX[temp & 255];
    }
    w[i] = w[i - Nk] ^ temp;
  }
  return w;
}
function aesAddRoundKey(state, w, round) {
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      state[j][i] ^= w[round * 4 + i] >>> 24 - j * 8 & 255;
    }
  }
}
function aesSubBytes(state) {
  for (var i = 0; i < 4; i++)
    for (var j = 0; j < 4; j++)
      state[i][j] = AES_RSBOX[state[i][j]];
}
function aesShiftRows(state) {
  for (var i = 1; i < 4; i++) {
    var row = [];
    for (var j = 0; j < 4; j++)
      row[j] = state[i][(j + i) % 4];
    for (var j = 0; j < 4; j++)
      state[i][j] = row[j];
  }
}
function gfMult(a, b) {
  var result = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1)
      result ^= a;
    var hi = a & 128;
    a = a << 1 & 255;
    if (hi)
      a ^= 27;
    b >>= 1;
  }
  return result;
}
function aesMixColumns(state) {
  for (var i = 0; i < 4; i++) {
    var a = [state[0][i], state[1][i], state[2][i], state[3][i]];
    state[0][i] = gfMult(14, a[0]) ^ gfMult(11, a[1]) ^ gfMult(13, a[2]) ^ gfMult(9, a[3]);
    state[1][i] = gfMult(9, a[0]) ^ gfMult(14, a[1]) ^ gfMult(11, a[2]) ^ gfMult(13, a[3]);
    state[2][i] = gfMult(13, a[0]) ^ gfMult(9, a[1]) ^ gfMult(14, a[2]) ^ gfMult(11, a[3]);
    state[3][i] = gfMult(11, a[0]) ^ gfMult(13, a[1]) ^ gfMult(9, a[2]) ^ gfMult(14, a[3]);
  }
}
function aesDecryptBlock(ciphertext, w) {
  var state = [];
  for (var i = 0; i < 4; i++) {
    state[i] = [];
    for (var j = 0; j < 4; j++) {
      state[i][j] = ciphertext[i * 4 + j];
    }
  }
  aesAddRoundKey(state, w, 14);
  for (var round = 13; round >= 1; round--) {
    aesShiftRows(state);
    aesSubBytes(state);
    aesAddRoundKey(state, w, round);
    aesMixColumns(state);
  }
  aesShiftRows(state);
  aesSubBytes(state);
  aesAddRoundKey(state, w, 0);
  var result = [];
  for (var i = 0; i < 4; i++)
    for (var j = 0; j < 4; j++)
      result[i * 4 + j] = state[j][i];
  return result;
}
function aesCbcDecrypt(ciphertext, key, iv) {
  var w = aesKeyExpansion(key);
  var blockCount = ciphertext.length / 16;
  var result = [];
  for (var b = 0; b < blockCount; b++) {
    var block = ciphertext.slice(b * 16, (b + 1) * 16);
    var decrypted = aesDecryptBlock(block, w);
    for (var i = 0; i < 16; i++) {
      result.push(decrypted[i] ^ iv[i]);
    }
    iv = block;
  }
  var padLen = result[result.length - 1];
  if (padLen > 0 && padLen <= 16)
    result = result.slice(0, result.length - padLen);
  return result;
}
function base64Decode(str) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  str = str.replace(/=+$/, "");
  var bytes = [];
  for (var i = 0; i < str.length; i += 4) {
    var c1 = chars.indexOf(str[i] || "A");
    var c2 = chars.indexOf(str[i + 1] || "A");
    var c3 = chars.indexOf(str[i + 2] || "A");
    var c4 = chars.indexOf(str[i + 3] || "A");
    bytes.push(c1 << 2 | c2 >> 4);
    if (str[i + 2])
      bytes.push(c2 << 4 & 255 | c3 >> 2);
    if (str[i + 3])
      bytes.push(c3 << 6 & 255 | c4);
  }
  return bytes;
}
function bytesToUtf8(bytes) {
  var result = "", i = 0;
  while (i < bytes.length) {
    var b = bytes[i];
    if (b < 128) {
      result += String.fromCharCode(b);
      i++;
    } else if (b < 224) {
      result += String.fromCharCode((b & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else if (b < 240) {
      result += String.fromCharCode((b & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    } else {
      result += String.fromCharCode((b & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63);
      i += 4;
    }
  }
  return result;
}
function decryptAES(encryptedBase64, aesKeyBytes) {
  try {
    var decoded = base64Decode(encryptedBase64);
    if (decoded.length <= 16)
      return null;
    var iv = decoded.slice(0, 16);
    var ciphertext = decoded.slice(16);
    var key = aesKeyBytes.slice(0, 32);
    var plainBytes = aesCbcDecrypt(ciphertext, key, iv);
    return bytesToUtf8(plainBytes);
  } catch (e) {
    return null;
  }
}
function solvePow(challenge, difficulty, salt, maxAttempts) {
  if (!maxAttempts)
    maxAttempts = 5e5;
  return new Promise(function(resolve, reject) {
    var prefix = "";
    for (var i = 0; i < difficulty; i++)
      prefix += "0";
    var nonce = 0;
    var attempts = 0;
    function chunk() {
      var start = Date.now();
      while (attempts < maxAttempts && Date.now() - start < 100) {
        var hash = sha256(challenge + nonce);
        if (hash.indexOf(prefix) === 0) {
          var keyHash = sha256(challenge + nonce + salt);
          var keyBytes = [];
          for (var i2 = 0; i2 < keyHash.length; i2 += 2)
            keyBytes.push(parseInt(keyHash.substring(i2, i2 + 2), 16));
          resolve(keyBytes);
          return;
        }
        nonce++;
        attempts++;
      }
      if (attempts >= maxAttempts) {
        reject(new Error("PoW max attempts exceeded"));
        return;
      }
      setTimeout(chunk, 0);
    }
    chunk();
  });
}
function getMediaTitle(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + mediaType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-MX";
  return fetchText(url).then(function(raw) {
    var data = JSON.parse(raw);
    var title = mediaType === "movie" ? data.title : data.name;
    var originalTitle = mediaType === "movie" ? data.original_title : data.original_name;
    return { title, originalTitle };
  });
}
function extractSearchResults(html) {
  var candidates = [];
  var articleRegex = /<article[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  var article;
  while ((article = articleRegex.exec(html)) !== null) {
    var content = article[1];
    var posterA = content.match(/<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*>/i);
    var dataA = content.match(/<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    var href = null, name = null;
    if (posterA) {
      href = posterA[1];
      name = posterA[2];
    } else if (dataA) {
      href = dataA[1];
      name = dataA[2].replace(/<[^>]*>/g, "").trim();
    }
    if (!name || !href)
      continue;
    name = name.replace(/^Ver\s+/i, "").replace(/\s+online$/i, "").trim();
    candidates.push({ name, href });
  }
  return candidates;
}
function extractEpisodeUrl(html, season, episode) {
  var ulMatch = html.match(/<ul[^>]*class="[^"]*episodios[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ulMatch)
    return null;
  var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  var li;
  while ((li = liRegex.exec(ulMatch[1])) !== null) {
    var liContent = li[1];
    var epLink = liContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
    var numerando = (liContent.match(/<span[^>]*class="[^"]*numerando[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1];
    if (!epLink || !numerando)
      continue;
    var parts = numerando.split("-");
    var s = parseInt(parts[0], 10) || 1;
    var e = parseInt(parts[1], 10) || 1;
    if (s === season && e === episode)
      return epLink[1];
  }
  return null;
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return getMediaTitle(tmdbId, mediaType).then(function(media) {
    var query = media.title || media.originalTitle;
    if (!query)
      return [];
    var searchUrl = MAIN_URL + "/search?s=" + encodeURIComponent(query);
    return fetchWithRetry(searchUrl).then(function(html) {
      var candidates = extractSearchResults(html);
      if (candidates.length === 0)
        return [];
      var normalizedQuery = normalizeText(query);
      var normalizedOriginal = normalizeText(media.originalTitle);
      var targetUrl = null;
      for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i];
        var normalizedCand = normalizeText(cand.name);
        if (normalizedCand.indexOf(normalizedQuery) !== -1 || normalizedCand.indexOf(normalizedOriginal) !== -1) {
          targetUrl = cand.href;
          break;
        }
      }
      if (!targetUrl && candidates.length > 0)
        targetUrl = candidates[0].href;
      if (!targetUrl)
        return [];
      var pageUrl = targetUrl;
      if (pageUrl.indexOf("http") !== 0)
        pageUrl = MAIN_URL + pageUrl;
      if (mediaType === "tv") {
        return fetchWithRetry(pageUrl).then(function(tvHtml) {
          var epUrl = extractEpisodeUrl(tvHtml, season, episode);
          if (!epUrl)
            return [];
          if (epUrl.indexOf("http") !== 0)
            epUrl = MAIN_URL + epUrl;
          return getPlayPage(epUrl);
        });
      }
      return getPlayPage(pageUrl);
    });
  }).catch(function(err) {
    console.error("[Flixlatam] Error: " + (err.message || err));
    return [];
  });
}
function getPlayPage(pageUrl) {
  return fetchWithRetry(pageUrl).then(function(playHtml) {
    var iframeUrl = null;
    var iframeMatch = playHtml.match(/<iframe[^>]*src="([^"]*embed69[^"]*)"[^>]*>/i) || playHtml.match(/<iframe[^>]*src="([^"]*\/vidurl\/[^"]*)"[^>]*>/i) || playHtml.match(/<iframe[^>]*src="([^"]*)"[^>]*class="[^"]*play[^"]*"[^>]*>/i) || playHtml.match(/<div[^>]*class="[^"]*play[^"]*"[^>]*>[\s\S]*?<iframe[^>]*src="([^"]*)"[^>]*>/i);
    if (iframeMatch)
      iframeUrl = iframeMatch[1] || iframeMatch[2];
    if (!iframeUrl)
      return [];
    if (iframeUrl.indexOf("//") === 0)
      iframeUrl = "https:" + iframeUrl;
    else if (iframeUrl.indexOf("/") === 0)
      iframeUrl = MAIN_URL + iframeUrl;
    return fetchWithRetry(iframeUrl, { headers: { Referer: pageUrl } }).then(function(embedHtml) {
      var powChallenge = (embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/) || [])[1];
      var powDifficulty = parseInt((embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/) || [])[1], 10) || 3;
      var powSalt = (embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/) || [])[1];
      if (!powChallenge || !powSalt)
        return [];
      return solvePow(powChallenge, powDifficulty, powSalt).then(function(aesKey) {
        var dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
        if (!dataLinkMatch)
          return [];
        var dataList;
        try {
          dataList = JSON.parse(dataLinkMatch[1]);
        } catch (e) {
          return [];
        }
        var streams = [];
        for (var d = 0; d < dataList.length; d++) {
          var entry = dataList[d];
          var allEmbeds = entry.sortedEmbeds || [];
          var downloadEmbeds = entry.downloadEmbeds || [];
          var items = allEmbeds.concat(downloadEmbeds);
          for (var k = 0; k < items.length; k++) {
            var item = items[k];
            var encryptedLink = item.link;
            if (!encryptedLink)
              continue;
            var decryptedLink = decryptAES(encryptedLink, aesKey);
            if (decryptedLink && decryptedLink.indexOf("http") === 0) {
              var fixedUrl = mapDomain(decryptedLink);
              var serverLabel = getServerLabel(fixedUrl);
              streams.push({
                name: "Flixlatam (" + serverLabel + ")",
                title: "Embed \xB7 Latino \xB7 " + serverLabel,
                url: fixedUrl,
                quality: "Unknown",
                headers: { Referer: iframeUrl, "User-Agent": "Mozilla/5.0" }
              });
            }
          }
        }
        return streams;
      }).catch(function() {
        return [];
      });
    });
  });
}

// src/flixlatam/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return extractStreams(tmdbId, mediaType, season, episode).catch(function() {
    return [];
  });
}
module.exports = { getStreams };
