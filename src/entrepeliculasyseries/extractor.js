// entrepeliculasyseries — EntrePeliculasySeries (entrepeliculasyseries.nz).
// Portado a MasterScrap desde latinuvio (providers/entrepeliculasyseries.js), autor original Latinuvio.
// Adaptado a QuickJS (sin Buffer/require('crypto')/require('https')/matchAll/normalize: el
// SHA-256 y el AES-256-CBC van a mano, y el fetch reemplaza al modulo https con TLS laxo) y
// filtrado a espanol latino y subtitulado: se descartan los streams de espanol de Espana.
//
// Cadena verificada 2026-10-15:
//   TMDB(external_ids) -> imdb id
//   /vidurl/<imdb>/  (pelicula)   /vidurl/<imdb>-<S>x<EE>/  (serie)
//   la pagina trae POW_CHALLENGE/POW_DIFFICULTY/POW_SALT + dataLink (embeds cifrados en AES-256-CBC)
//   PoW: sha256(challenge + nonce) debe empezar por "0"*difficulty; clave = sha256(challenge+nonce+salt)
//   cada sortedEmbeds[].link se descifra (IV = primeros 16 bytes) y sale la URL del host
//   los hosts se resuelven con el stack de src/shared/embedResolvers.js y con el resolver
//   local de familia vidhide/streamwish (pages con `links = {hls4...}` empaquetadas).
//   2026-10-16: los embeds VOE se descartan antes de resolver (gate ALTCHA, ver abajo).

import { fetchText } from '../shared/http.js';
import { getEmbedResolver, getServerLabel } from '../shared/embedResolvers.js';

const HOST = 'https://entrepeliculasyseries.nz';
const TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// tope de trabajo: el presupuesto de la app es 60 s
const MAX_EMBEDS = 10;
const MAX_STREAMS = 8;

// ---------------------------------------------------------------------------
// utilidades de bajo nivel (sin Buffer / sin TextEncoder / sin atob)
// ---------------------------------------------------------------------------

function utf8Encode(str) {
  var out = [];
  var s = String(str);
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      var nx = s.charCodeAt(i + 1);
      if (nx >= 0xdc00 && nx <= 0xdfff) {
        var cp = 0x10000 + ((c - 0xd800) << 10) + (nx - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        i++;
      } else {
        out.push(0xef, 0xbf, 0xbd);
      }
    } else if (c >= 0xd800 && c <= 0xdfff) {
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return out;
}

function utf8DecodeBytes(bytes) {
  var out = '';
  var i = 0;
  while (i < bytes.length) {
    var c = bytes[i++];
    if (c < 128) {
      out += String.fromCharCode(c);
      continue;
    }
    if ((c & 224) === 192 && i < bytes.length) {
      out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
      continue;
    }
    if ((c & 240) === 224 && i + 1 < bytes.length) {
      var c2 = bytes[i++];
      var c3 = bytes[i++];
      out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      continue;
    }
    if ((c & 248) === 240 && i + 2 < bytes.length) {
      var b2 = bytes[i++];
      var b3 = bytes[i++];
      var b4 = bytes[i++];
      var cp2 = ((c & 7) << 18) | ((b2 & 63) << 12) | ((b3 & 63) << 6) | (b4 & 63);
      cp2 -= 65536;
      out += String.fromCharCode(55296 + (cp2 >> 10), 56320 + (cp2 & 1023));
      continue;
    }
    out += '\uFFFD';
  }
  return out;
}

var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function base64ToBytes(input) {
  var str = String(input || '').replace(/=+$/, '');
  var out = [];
  var bs = 0;
  var bc = 0;
  for (var i = 0; i < str.length; i++) {
    var idx = B64_CHARS.indexOf(str.charAt(i));
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) out.push(255 & (bs >> ((-2 * bc) & 6)));
  }
  return out;
}

// SHA-256 puro (FIPS 180-4). Devuelve 32 bytes en un Array de numeros.
var SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr32(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Bytes(data) {
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var len = data.length;
  var msg = data.slice(0);
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  var bitHi = Math.floor(len / 536870912);
  var bitLo = ((len % 536870912) * 8) >>> 0;
  msg.push((bitHi >>> 24) & 255, (bitHi >>> 16) & 255, (bitHi >>> 8) & 255, bitHi & 255);
  msg.push((bitLo >>> 24) & 255, (bitLo >>> 16) & 255, (bitLo >>> 8) & 255, bitLo & 255);

  var w = new Array(64);
  var i, off;
  for (off = 0; off < msg.length; off += 64) {
    for (i = 0; i < 16; i++) {
      w[i] = ((msg[off + i * 4] << 24) | (msg[off + i * 4 + 1] << 16) | (msg[off + i * 4 + 2] << 8) | msg[off + i * 4 + 3]) >>> 0;
    }
    for (i = 16; i < 64; i++) {
      var x = w[i - 15];
      var y = w[i - 2];
      var s0 = (rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3)) >>> 0;
      var s1 = (rotr32(y, 17) ^ rotr32(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (i = 0; i < 64; i++) {
      var S1 = (rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)) >>> 0;
      var ch = ((e & f) ^ (~e & g)) >>> 0;
      var t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
      var S0 = (rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)) >>> 0;
      var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      var t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var out = [];
  for (i = 0; i < 8; i++) {
    out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
  }
  return out;
}

function sha256Hex(str) {
  var b = sha256Bytes(utf8Encode(str));
  var out = '';
  for (var i = 0; i < b.length; i++) {
    out += (b[i] < 16 ? '0' : '') + b[i].toString(16);
  }
  return out;
}

// ---- AES-256-CBC (solo descifrado) -----------------------------------------

var AES_SBOX = (function () {
  var box = new Array(256);
  var p = 1, q = 1;
  function rotl8(x, n) {
    return ((x << n) | (x >> (8 - n))) & 0xff;
  }
  do {
    p = (p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0)) & 0xff;
    q = (q ^ ((q << 1) & 0xff)) & 0xff;
    q = (q ^ ((q << 2) & 0xff)) & 0xff;
    q = (q ^ ((q << 4) & 0xff)) & 0xff;
    if (q & 0x80) q = (q ^ 0x09) & 0xff;
    box[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 0xff;
  } while (p !== 1);
  box[0] = 0x63;
  return box;
})();

var AES_INV_SBOX = (function () {
  var inv = new Array(256);
  for (var i = 0; i < 256; i++) inv[AES_SBOX[i]] = i;
  return inv;
})();

var AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

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
  for (i = 0; i < 4 * (Nr + 1); i++) rk.push(w[i][0], w[i][1], w[i][2], w[i][3]);
  return { rk: rk, Nr: Nr };
}

function gmul(a, b) {
  var p = 0;
  var aa = a & 255;
  var bb = b & 255;
  for (var i = 0; i < 8; i++) {
    if (bb & 1) p ^= aa;
    var hi = aa & 0x80;
    aa = (aa << 1) & 0xff;
    if (hi) aa ^= 0x1b;
    bb >>= 1;
  }
  return p & 255;
}

function aesAddRoundKey(s, rk, round) {
  var o = round * 16;
  for (var i = 0; i < 16; i++) s[i] = s[i] ^ rk[o + i];
}

function aesInvShiftRows(s) {
  var r, c, row, shifted;
  for (r = 1; r <= 3; r++) {
    row = [s[r], s[r + 4], s[r + 8], s[r + 12]];
    shifted = [];
    for (c = 0; c < 4; c++) shifted[c] = row[(c - r + 8) % 4];
    s[r] = shifted[0]; s[r + 4] = shifted[1]; s[r + 8] = shifted[2]; s[r + 12] = shifted[3];
  }
}

function aesInvSubBytes(s) {
  for (var i = 0; i < 16; i++) s[i] = AES_INV_SBOX[s[i] & 255];
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
  if (!cipherBytes || cipherBytes.length === 0 || cipherBytes.length % 16 !== 0) return null;
  var ks = aes256ExpandKey(key);
  var out = [];
  var prev = iv;
  for (var off = 0; off < cipherBytes.length; off += 16) {
    var block = cipherBytes.slice(off, off + 16);
    var dec = aesDecryptBlock(block, ks);
    for (var i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
    prev = block;
  }
  var pad = out[out.length - 1];
  if (pad < 1 || pad > 16 || pad > out.length) return null;
  for (var j = out.length - pad; j < out.length; j++) {
    if (out[j] !== pad) return null;
  }
  return out.slice(0, out.length - pad);
}

// ---------------------------------------------------------------------------
// PoW + descifrado del dataLink
// ---------------------------------------------------------------------------

function extractPowConstants(html) {
  var out = { difficulty: 3, challenge: null, salt: null };
  var m = html.match(/POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/);
  if (m) out.challenge = m[1];
  m = html.match(/POW_DIFFICULTY\s*=\s*(\d+)/);
  if (m) out.difficulty = parseInt(m[1], 10) || 3;
  m = html.match(/POW_SALT\s*=\s*['"]([^'"]+)['"]/);
  if (m) out.salt = m[1];
  return out;
}

function solvePow(challenge, difficulty, maxIter) {
  var prefix = '';
  for (var k = 0; k < difficulty; k++) prefix += '0';
  var max = maxIter || 4000000;
  for (var nonce = 0; nonce < max; nonce++) {
    if (sha256Hex(challenge + nonce).indexOf(prefix) === 0) return nonce;
  }
  return null;
}

function aesKeyBytes(challenge, nonce, salt) {
  return sha256Bytes(utf8Encode(challenge + nonce + (salt || '')));
}

function extractDataLink(html) {
  var patterns = [
    /(?:const|let|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]);/,
    /dataLink\s*=\s*(\[[\s\S]*?\]);/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (!m) continue;
    var js = m[1].replace(/\\"/g, '"').replace(/\\\//g, '/');
    try {
      var arr = JSON.parse(js);
      if (arr && typeof arr.length === 'number') return arr;
    } catch (e) {}
  }
  return null;
}

function decryptAesLink(encryptedBase64, key) {
  try {
    var raw = base64ToBytes(encryptedBase64);
    if (raw.length <= 16) return null;
    var iv = raw.slice(0, 16);
    var ct = raw.slice(16);
    var plain = aes256CbcDecrypt(ct, key, iv);
    if (!plain) return null;
    var text = utf8DecodeBytes(plain);
    if (text.indexOf('http') === -1) return null;
    return text;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Resolver local de familia vidhide/streamwish (paginas con links = {hls4:...})
// ---------------------------------------------------------------------------

function originOf(url) {
  var m = String(url || '').match(/^(https?:\/\/[^\/]+)/i);
  return m ? m[1] : '';
}

function unpackPacked(html) {
  try {
    var pMatch = html.match(/eval\(function\(p,a,c,k,e,[premd]\)\{[\s\S]*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!pMatch) return null;
    var p = pMatch[1];
    var a = parseInt(pMatch[2], 10);
    var k = pMatch[4].split('|');
    var symbols = '0123456789abcdefghijklmnopqrstuvwxyz';
    function decodeBase36(num, rad) {
      var res = '';
      while (num > 0) { res = symbols[num % rad] + res; num = Math.floor(num / rad); }
      return res || '0';
    }
    return p.replace(/\b\w+\b/g, function (w) {
      var idx = parseInt(w, 36);
      return idx < k.length && k[idx] ? k[idx] : decodeBase36(idx, a);
    });
  } catch (e) {
    return null;
  }
}

function extractCandidates(html) {
  var text = html;
  var up = unpackPacked(html);
  if (up) text = up;

  var candidates = [];
  var seen = {};
  function push(u) {
    if (!u || typeof u !== 'string') return;
    var v = u.replace(/\\\//g, '/').replace(/\\"/g, '"').trim();
    if (v && seen[v] !== true) {
      seen[v] = true;
      candidates.push(v);
    }
  }

  var m = text.match(/links\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) {
    var obj = null;
    try { obj = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\'/g, "'")); } catch (e) { obj = null; }
    if (obj) {
      var keys = Object.keys(obj);
      var order = [];
      var prefer = ['hls4', 'hls3', 'hls2', 'hls1', 'hls'];
      for (var i = 0; i < prefer.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (keys[j].toLowerCase().indexOf(prefer[i]) !== -1) order.push(keys[j]);
        }
      }
      for (var q = 0; q < keys.length; q++) {
        if (order.indexOf(keys[q]) === -1) order.push(keys[q]);
      }
      var used = {};
      for (var o = 0; o < order.length; o++) {
        var k2 = order[o];
        if (used[k2]) continue;
        used[k2] = true;
        var val = obj[k2];
        if (typeof val === 'string' && /\.m3u8|master\.txt|urlset/.test(val)) push(val);
      }
    }
  }

  var re = /(?:file|src)\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/gi;
  var mm;
  while ((mm = re.exec(text)) !== null) push(mm[1]);

  var reAbs = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|txt)[^\s"'<>\\]*/gi;
  while ((mm = reAbs.exec(text)) !== null) push(mm[0]);

  return candidates;
}

var VIDHIDE_HOSTS = ['vidhide', 'dintezuvio', 'minochinos', 'dramiyos', 'dhcplay', 'smoothpre', 'dhtpre',
  'vidspeeder', 'moorearn', 'travid', 'vidhidehub', 'vidhidevip', 'vidhidepre', 'kinoger', 'movearnpre',
  'peytonepre', 'filelions', 'callistanise', 'morencius', 'acek-cdn', 'streamtape'];
var STREAMWISH_HOSTS = ['hlswish', 'streamwish', 'vibuxer', 'strwish', 'hglink', 'ghbrisk', 'premilkyway', 'hgplaycdn'];

function esFamilia(url) {
  var u = String(url || '').toLowerCase();
  for (var i = 0; i < VIDHIDE_HOSTS.length; i++) if (u.indexOf(VIDHIDE_HOSTS[i]) !== -1) return 'vidhide';
  for (var j = 0; j < STREAMWISH_HOSTS.length; j++) if (u.indexOf(STREAMWISH_HOSTS[j]) !== -1) return 'streamwish';
  return null;
}

function rewriteHost(url) {
  return String(url || '')
    .replace(/`/g, '')
    .replace(/^(https?:\/\/)(?:www\.)?hglink\.to(\/|$)/i, '$1vibuxer.com$2')
    .replace(/^(https?:\/\/)(?:www\.)?filelions\.to(\/|$)/i, '$1callistanise.com$2');
}

function normalizeVidhideUrl(url) {
  var u = String(url || '');
  if (u.indexOf('/embed/') !== -1) return u;
  var m = u.match(/^(https?:\/\/[^\/]+)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1] + '/embed/' + m[2];
  return u;
}

function resolverFamilia(embedUrl, familia) {
  var target = rewriteHost(embedUrl);
  if (familia === 'vidhide') target = normalizeVidhideUrl(target);
  var origin = originOf(target);
  return fetchText(target, { headers: { Referer: 'https://embed69.org/', Origin: 'https://embed69.org', 'User-Agent': UA } }, 12000)
    .then(function (html) {
      var candidates = extractCandidates(html);
      if (!candidates.length) {
        var iframe = html.match(/<iframe[^>]*src=["']([^"']+)["']/i);
        if (!iframe) return null;
        var iu = iframe[1];
        if (iu.indexOf('//') === 0) iu = 'https:' + iu;
        else if (iu.indexOf('/') === 0) iu = origin + iu;
        return fetchText(iu, { headers: { Referer: target, 'User-Agent': UA } }, 12000)
          .then(function (h2) { return extractCandidates(h2); })
          .catch(function () { return []; });
      }
      return candidates;
    })
    .then(function (candidates) {
      if (!candidates || !candidates.length) return null;
      var url = candidates[0];
      if (url.indexOf('//') === 0) url = 'https:' + url;
      else if (url.indexOf('/') === 0) url = origin + url;
      else if (url.indexOf('http') !== 0) url = origin + '/' + url;
      var qm = url.match(/[_-](\d{3,4})p/i);
      var labels = url.match(/_,([a-z,]+),\.urlset/);
      var quality = qm ? qm[1] + 'p' : 'HD';
      if (!qm && labels && labels[1].indexOf('x') !== -1) quality = '1080p';
      return { url: url, quality: quality, headers: { 'User-Agent': UA, Referer: origin + '/', Origin: origin } };
    })
    .catch(function () { return null; });
}

// stack final: familia local -> resolvers compartidos (voe, vimeos, goodstream, mp4upload...)
function resolverEmbed(embedUrl) {
  var familia = esFamilia(embedUrl);
  var promesa = familia
    ? resolverFamilia(embedUrl, familia)
    : Promise.resolve(null);
  return promesa
    .then(function (r) {
      if (r && r.url) return r;
      var fn = null;
      try { fn = getEmbedResolver(embedUrl); } catch (e) { fn = null; }
      if (typeof fn !== 'function') return null;
      return Promise.resolve()
        .then(function () { return fn(embedUrl); })
        .then(function (r2) { return r2 && r2.url ? r2 : null; })
        .catch(function () { return null; });
    })
    .catch(function () { return null; });
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

function tmdbJson(path) {
  var url = 'https://api.themoviedb.org/3/' + path + (path.indexOf('?') === -1 ? '?' : '&') + 'api_key=' + TMDB_KEY;
  return fetchText(url, { headers: { 'User-Agent': UA } }, 10000)
    .then(function (raw) { return JSON.parse(raw); })
    .catch(function () { return null; });
}

function getTMDBInfo(id, tipo) {
  var titulos = [];
  var year = '';
  var imdb = '';
  // es-MX basta para el fallback de busqueda; en-US solo si hace falta mas adelante
  return tmdbJson(tipo + '/' + id + '?language=es-MX')
    .then(function (res) {
      if (res) {
        var t = tipo === 'movie' ? res.title : res.name;
        var o = tipo === 'movie' ? res.original_title : res.original_name;
        if (t && titulos.indexOf(t) < 0) titulos.push(t);
        if (o && titulos.indexOf(o) < 0) titulos.push(o);
        var fecha = res.release_date || res.first_air_date || '';
        year = String(fecha).substring(0, 4);
      }
      return tmdbJson(tipo + '/' + id + '/external_ids');
    })
    .then(function (ext) {
      if (ext && ext.imdb_id) imdb = ext.imdb_id;
      if (!imdb && !titulos.length) return null;
      return { titles: titulos, year: year, imdbId: imdb };
    })
    .catch(function () { return null; });
}

// ---------------------------------------------------------------------------
// Pagina /vidurl/: PoW + dataLink
// ---------------------------------------------------------------------------

function getVidurlData(vidurlPath) {
  return fetchText(HOST + vidurlPath, {
    headers: { Referer: HOST + '/', 'User-Agent': UA, 'Accept-Language': 'es-MX,es;q=0.9' },
  }, 15000)
    .then(function (html) {
      if (!html || html.length < 500) return null;
      var pow = extractPowConstants(html);
      if (!pow.challenge) return null;
      var dataLink = extractDataLink(html);
      if (!dataLink || !dataLink.length) return null;
      var nonce = solvePow(pow.challenge, pow.difficulty);
      if (nonce === null) return null;
      return { dataLink: dataLink, key: aesKeyBytes(pow.challenge, nonce, pow.salt) };
    })
    .catch(function () { return null; });
}

function buildVidurlPath(imdbId, tipo, season, episode) {
  if (!imdbId) return null;
  if (tipo === 'movie') return '/vidurl/' + imdbId + '/';
  var ep = parseInt(episode, 10);
  if (isNaN(ep) || ep < 1) ep = 1;
  var epNum = ep < 10 ? '0' + ep : String(ep);
  return '/vidurl/' + imdbId + '-' + season + 'x' + epNum + '/';
}

// ---------------------------------------------------------------------------
// idioma: solo latino y subtitulado (nunca espanol de Espana)
// ---------------------------------------------------------------------------

var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

// etiqueta LAT/ESP/CAST/SUB/VOSE del dataLink -> idioma final (null = descartar)
function idiomaDeEtiqueta(raw) {
  var up = String(raw || '').toUpperCase().trim();
  if (up === 'LAT' || up === 'LATINO' || up === '' || up === 'MX') return 'Latino';
  if (up === 'SUB' || up === 'SUBS' || up === 'VOSE' || up === 'VOSI') return 'Subtitulado';
  return null; // ESP/CAST/ESPAÑOL: espanol de Espana, fuera
}

function filtrarIdioma(streams) {
  var out = [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i];
    if (!s || !s.url) continue;
    var t = String(s.title || '') + ' ' + String(s.language || '');
    if (RE_ESPANA.test(t)) continue;
    if (!RE_LATINO.test(t) && !RE_SUB.test(t)) continue;
    s.language = RE_SUB.test(t) && !RE_LATINO.test(t) ? 'Subtitulado' : 'Latino';
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// flujo principal
// ---------------------------------------------------------------------------

var SERVIDORES_DESCARTADOS = ['filemoon', 'bysesukior', '1fichier', 'fireload', 'terabox', 'voe'];
// 2026-10-16: 'voe' se descarta — VOE redirige a un gate ALTCHA ("Confirm you're human",
// dominio megankiddifference.com) que no se puede pasar del lado del servidor: sus embeds
// nunca resuelven y cada uno quemaba ~2 fetches del presupuesto. Quedan vidhide + streamwish
// en LAT y SUB, que sí resuelven.

// el resolver compartido de voe devuelve 'Unknown' cuando la URL no dice la calidad:
// en la app queda mejor 'HD' que un literal raro
function calidadDe(q) {
  var s = String(q || '');
  if (!s || s === 'Unknown') return 'HD';
  return s;
}

function streamsDeDataLink(dataLink, key) {
  var tareas = [];
  for (var i = 0; i < dataLink.length; i++) {
    var bloque = dataLink[i] || {};
    var idioma = idiomaDeEtiqueta(bloque.video_language);
    if (!idioma) continue;
    var embeds = bloque.sortedEmbeds || [];
    for (var j = 0; j < embeds.length; j++) {
      var embed = embeds[j] || {};
      if (String(embed.type || 'video') !== 'video') continue;
      var sn = String(embed.servername || '').toLowerCase();
      var descartado = false;
      for (var k = 0; k < SERVIDORES_DESCARTADOS.length; k++) {
        if (sn.indexOf(SERVIDORES_DESCARTADOS[k]) !== -1) descartado = true;
      }
      if (descartado) continue;
      if (tareas.length >= MAX_EMBEDS) break;
      tareas.push({ link: String(embed.link || ''), servername: embed.servername || '', idioma: idioma });
    }
  }

  return Promise.all(tareas.map(function (t) {
    var url = decryptAesLink(t.link, key);
    if (!url || url.indexOf('http') !== 0) return Promise.resolve(null);
    return resolverEmbed(url).then(function (r) {
      if (!r || !r.url) return null;
      // referer/UA del host resuelto; el resto de hosts exige su propio Referer
      var headers = r.headers || {};
      var label = t.servername ? String(t.servername) : '';
      var nombre = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      if (!nombre) {
        try { nombre = getServerLabel(url); } catch (e) { nombre = 'Online'; }
      }
      var calidad = calidadDe(r.quality);
      return {
        title: calidad + ' · ' + t.idioma + ' · ' + nombre,
        quality: calidad,
        language: t.idioma,
        url: r.url,
        headers: headers,
        __ref: url,
      };
    });
  })).then(function (lista) {
    var out = [];
    var vistos = {};
    for (var i2 = 0; i2 < lista.length; i2++) {
      var s = lista[i2];
      if (!s) continue;
      if (vistos[s.url]) continue;
      vistos[s.url] = true;
      delete s.__ref;
      out.push(s);
      if (out.length >= MAX_STREAMS) break;
    }
    return out;
  });
}

async function extraer(tmdbId, mediaType, season, episode) {
  var tipo = mediaType === 'movie' ? 'movie' : 'tv';
  var info = await getTMDBInfo(tmdbId, tipo);
  if (!info) return [];

  var vidurlPath = buildVidurlPath(info.imdbId, tipo, season, episode);
  var data = vidurlPath ? await getVidurlData(vidurlPath) : null;
  if (!data) return [];

  var streams = await streamsDeDataLink(data.dataLink, data.key);
  return filtrarIdioma(streams);
}

export { extraer };
