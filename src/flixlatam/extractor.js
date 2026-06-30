import { fetchText, fetchWithRetry } from '../shared/http.js';

const TMDB_API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const MAIN_URL = 'https://flixlatam.com';

var DOMAIN_MAP = {
  'dintezuvio.com': 'vidhide.com',
  'hglink.to': 'streamwish.to',
  'minochinos.com': 'vidhide.com',
  'ghbrisk.com': 'streamwish.to',
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
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getServerLabel(url) {
  if (url.indexOf('voe.sx') !== -1 || url.indexOf('cloudwindow') !== -1) return 'VOE';
  if (url.indexOf('streamwish') !== -1 || url.indexOf('hlswish') !== -1 || url.indexOf('vibuxer') !== -1 ||
      url.indexOf('strwish') !== -1 || url.indexOf('premilkyway') !== -1) return 'StreamWish';
  if (url.indexOf('vidhide') !== -1 || url.indexOf('dintezuvio') !== -1 || url.indexOf('minochinos') !== -1 ||
      url.indexOf('dramiyos') !== -1 || url.indexOf('dhcplay') !== -1 || url.indexOf('smoothpre') !== -1 ||
      url.indexOf('dhtpre') !== -1 || url.indexOf('vidspeeder') !== -1 || url.indexOf('moorearn') !== -1 ||
      url.indexOf('travid') !== -1 || url.indexOf('vidhidehub') !== -1 || url.indexOf('vidhidevip') !== -1 ||
      url.indexOf('vidhidepre') !== -1 || url.indexOf('kinoger') !== -1 || url.indexOf('movearnpre') !== -1 ||
      url.indexOf('peytonepre') !== -1 || url.indexOf('filelions') !== -1) return 'VidHide';
  if (url.indexOf('bysedikamoum') !== -1 || url.indexOf('bysedi') !== -1 || url.indexOf('filemoon') !== -1 ||
      url.indexOf('rapidvideo') !== -1) return 'FileMoon';
  if (url.indexOf('luluvid') !== -1 || url.indexOf('lulus') !== -1) return 'Lulu';
  if (url.indexOf('uqload') !== -1) return 'Uqload';
  if (url.indexOf('goodstream') !== -1) return 'GoodStream';
  if (url.indexOf('vimeos') !== -1) return 'Vimeos';
  return 'Online';
}

// --- SHA256 Implementation ---
function sha256(str) {
  function rrot(n, b) { return (n >>> b) | (n << (32 - b)); }
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push((c >> 6) | 192); bytes.push((c & 63) | 128); }
    else if (c < 65536) { bytes.push((c >> 12) | 224); bytes.push(((c >> 6) & 63) | 128); bytes.push((c & 63) | 128); }
    else { bytes.push((c >> 18) | 240); bytes.push(((c >> 12) & 63) | 128); bytes.push(((c >> 6) & 63) | 128); bytes.push((c & 63) | 128); }
  }
  var bitLen = bytes.length * 8;
  bytes.push(128);
  while ((bytes.length * 8) % 512 !== 448) bytes.push(0);
  for (var i = 7; i >= 0; i--) bytes.push((bitLen >>> (i * 8)) & 255);
  for (var blockStart = 0; blockStart < bytes.length; blockStart += 64) {
    var w = [];
    for (var i = 0; i < 16; i++) {
      w[i] = (bytes[blockStart + i * 4] << 24) | (bytes[blockStart + i * 4 + 1] << 16) |
             (bytes[blockStart + i * 4 + 2] << 8) | bytes[blockStart + i * 4 + 3];
    }
    for (var i = 16; i < 64; i++) {
      var s0 = rrot(w[i - 15], 7) ^ rrot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = rrot(w[i - 2], 17) ^ rrot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (var i = 0; i < 64; i++) {
      var S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      var S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  var hex = '';
  for (var i = 0; i < 8; i++) {
    for (var j = 7; j >= 0; j--) {
      var nibble = (h[i] >>> (j * 4)) & 15;
      hex += nibble.toString(16);
    }
  }
  return hex;
}

// --- AES-256-CBC Decryption ---
var AES_SBOX = [
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
];

var AES_RSBOX = [
  0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
  0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
  0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
  0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
  0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
  0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
  0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
  0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
  0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
  0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
  0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
  0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
  0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
  0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
  0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
  0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
];

var AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a];

function aesKeyExpansion(keyBytes) {
  var Nb = 4, Nk = 8, Nr = 14;
  var w = [];
  for (var i = 0; i < Nk; i++) {
    w[i] = (keyBytes[4*i] << 24) | (keyBytes[4*i+1] << 16) | (keyBytes[4*i+2] << 8) | keyBytes[4*i+3];
  }
  for (var i = Nk; i < Nb * (Nr + 1); i++) {
    var temp = w[i-1];
    if (i % Nk === 0) {
      temp = ((AES_SBOX[(temp >>> 16) & 255] << 24) | (AES_SBOX[(temp >>> 8) & 255] << 16) | (AES_SBOX[temp & 255] << 8) | AES_SBOX[temp >>> 24]);
      temp ^= (AES_RCON[i/Nk - 1] << 24);
    } else if (i % Nk === 4) {
      temp = (AES_SBOX[(temp >>> 24) & 255] << 24) | (AES_SBOX[(temp >>> 16) & 255] << 16) | (AES_SBOX[(temp >>> 8) & 255] << 8) | AES_SBOX[temp & 255];
    }
    w[i] = w[i-Nk] ^ temp;
  }
  return w;
}

function aesAddRoundKey(state, w, round) {
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      state[j][i] ^= (w[round * 4 + i] >>> (24 - j * 8)) & 255;
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
    for (var j = 0; j < 4; j++) row[j] = state[i][(j + i) % 4];
    for (var j = 0; j < 4; j++) state[i][j] = row[j];
  }
}

function gfMult(a, b) {
  var result = 0;
  for (var i = 0; i < 8; i++) {
    if (b & 1) result ^= a;
    var hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
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
  if (padLen > 0 && padLen <= 16) result = result.slice(0, result.length - padLen);
  return result;
}

function base64Decode(str) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  str = str.replace(/=+$/, '');
  var bytes = [];
  for (var i = 0; i < str.length; i += 4) {
    var c1 = chars.indexOf(str[i] || 'A');
    var c2 = chars.indexOf(str[i + 1] || 'A');
    var c3 = chars.indexOf(str[i + 2] || 'A');
    var c4 = chars.indexOf(str[i + 3] || 'A');
    bytes.push((c1 << 2) | (c2 >> 4));
    if (str[i + 2]) bytes.push(((c2 << 4) & 255) | (c3 >> 2));
    if (str[i + 3]) bytes.push(((c3 << 6) & 255) | c4);
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  var result = '', i = 0;
  while (i < bytes.length) {
    var b = bytes[i];
    if (b < 128) { result += String.fromCharCode(b); i++; }
    else if (b < 224) { result += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else if (b < 240) { result += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
    else { result += String.fromCharCode(((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63)); i += 4; }
  }
  return result;
}

function decryptAES(encryptedBase64, aesKeyBytes) {
  try {
    var decoded = base64Decode(encryptedBase64);
    if (decoded.length <= 16) return null;
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
  if (!maxAttempts) maxAttempts = 500000;
  return new Promise(function(resolve, reject) {
    var prefix = '';
    for (var i = 0; i < difficulty; i++) prefix += '0';
    var nonce = 0;
    var attempts = 0;

    function chunk() {
      var start = Date.now();
      while (attempts < maxAttempts && Date.now() - start < 100) {
        var hash = sha256(challenge + nonce);
        if (hash.indexOf(prefix) === 0) {
          var keyHash = sha256(challenge + nonce + salt);
          var keyBytes = [];
          for (var i = 0; i < keyHash.length; i += 2)
            keyBytes.push(parseInt(keyHash.substring(i, i + 2), 16));
          resolve(keyBytes);
          return;
        }
        nonce++;
        attempts++;
      }
      if (attempts >= maxAttempts) {
        reject(new Error('PoW max attempts exceeded'));
        return;
      }
      setTimeout(chunk, 0);
    }
    chunk();
  });
}

function getMediaTitle(tmdbId, mediaType) {
  var url = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=es-MX';
  return fetchText(url)
    .then(function(raw) {
      var data = JSON.parse(raw);
      var title = mediaType === 'movie' ? data.title : data.name;
      var originalTitle = mediaType === 'movie' ? data.original_title : data.original_name;
      return { title: title, originalTitle: originalTitle };
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
      name = dataA[2].replace(/<[^>]*>/g, '').trim();
    }
    if (!name || !href) continue;
    name = name.replace(/^Ver\s+/i, '').replace(/\s+online$/i, '').trim();
    candidates.push({ name: name, href: href });
  }
  return candidates;
}

function extractEpisodeUrl(html, season, episode) {
  var ulMatch = html.match(/<ul[^>]*class="[^"]*episodios[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ulMatch) return null;

  var liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  var li;
  while ((li = liRegex.exec(ulMatch[1])) !== null) {
    var liContent = li[1];
    var epLink = liContent.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
    var numerando = (liContent.match(/<span[^>]*class="[^"]*numerando[^"]*"[^>]*>([\s\S]*?)<\/span>/i) || [])[1];
    if (!epLink || !numerando) continue;
    var parts = numerando.split('-');
    var s = parseInt(parts[0], 10) || 1;
    var e = parseInt(parts[1], 10) || 1;
    if (s === season && e === episode) return epLink[1];
  }
  return null;
}

export function extractStreams(tmdbId, mediaType, season, episode) {
  return getMediaTitle(tmdbId, mediaType)
    .then(function(media) {
      var query = media.title || media.originalTitle;
      if (!query) return [];

      var searchUrl = MAIN_URL + '/search?s=' + encodeURIComponent(query);
      return fetchWithRetry(searchUrl)
        .then(function(html) {
          var candidates = extractSearchResults(html);
          if (candidates.length === 0) return [];

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

          if (!targetUrl && candidates.length > 0) targetUrl = candidates[0].href;
          if (!targetUrl) return [];

          var pageUrl = targetUrl;
          if (pageUrl.indexOf('http') !== 0) pageUrl = MAIN_URL + pageUrl;

          if (mediaType === 'tv') {
            return fetchWithRetry(pageUrl)
              .then(function(tvHtml) {
                var epUrl = extractEpisodeUrl(tvHtml, season, episode);
                if (!epUrl) return [];
                if (epUrl.indexOf('http') !== 0) epUrl = MAIN_URL + epUrl;
                return getPlayPage(epUrl);
              });
          }

          return getPlayPage(pageUrl);
        });
    })
    .catch(function(err) {
      console.error('[Flixlatam] Error: ' + (err.message || err));
      return [];
    });
}

function getPlayPage(pageUrl) {
  return fetchWithRetry(pageUrl)
    .then(function(playHtml) {
      var iframeUrl = null;
      var iframeMatch = playHtml.match(/<iframe[^>]*src="([^"]*embed69[^"]*)"[^>]*>/i)
        || playHtml.match(/<iframe[^>]*src="([^"]*\/vidurl\/[^"]*)"[^>]*>/i)
        || playHtml.match(/<iframe[^>]*src="([^"]*)"[^>]*class="[^"]*play[^"]*"[^>]*>/i)
        || playHtml.match(/<div[^>]*class="[^"]*play[^"]*"[^>]*>[\s\S]*?<iframe[^>]*src="([^"]*)"[^>]*>/i);

      if (iframeMatch) iframeUrl = iframeMatch[1] || iframeMatch[2];
      if (!iframeUrl) return [];

      if (iframeUrl.indexOf('//') === 0) iframeUrl = 'https:' + iframeUrl;
      else if (iframeUrl.indexOf('/') === 0) iframeUrl = MAIN_URL + iframeUrl;

      return fetchWithRetry(iframeUrl, { headers: { Referer: pageUrl } })
        .then(function(embedHtml) {
          var powChallenge = (embedHtml.match(/const\s+POW_CHALLENGE\s*=\s*'([^']+)';/) || [])[1];
          var powDifficulty = parseInt((embedHtml.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+);/) || [])[1], 10) || 3;
          var powSalt = (embedHtml.match(/const\s+POW_SALT\s*=\s*'([^']+)';/) || [])[1];

          if (!powChallenge || !powSalt) return [];

          return solvePow(powChallenge, powDifficulty, powSalt)
            .then(function(aesKey) {
              var dataLinkMatch = embedHtml.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\]);/);
              if (!dataLinkMatch) return [];

              var dataList;
              try { dataList = JSON.parse(dataLinkMatch[1]); } catch (e) { return []; }
              var streams = [];

              for (var d = 0; d < dataList.length; d++) {
                var entry = dataList[d];
                var allEmbeds = entry.sortedEmbeds || [];
                var downloadEmbeds = entry.downloadEmbeds || [];
                var items = allEmbeds.concat(downloadEmbeds);

                for (var k = 0; k < items.length; k++) {
                  var item = items[k];
                  var encryptedLink = item.link;
                  if (!encryptedLink) continue;

                  var decryptedLink = decryptAES(encryptedLink, aesKey);
                  if (decryptedLink && decryptedLink.indexOf('http') === 0) {
                    var fixedUrl = mapDomain(decryptedLink);
                    var serverLabel = getServerLabel(fixedUrl);

                    streams.push({
                      name: 'Flixlatam (' + serverLabel + ')',
                      title: 'Embed · Latino · ' + serverLabel,
                      url: fixedUrl,
                      quality: 'Unknown',
                      headers: { Referer: iframeUrl, 'User-Agent': 'Mozilla/5.0' },
                    });
                  }
                }
              }

              return streams;
            })
            .catch(function() { return []; });
        });
    });
}
