// cifrado.js — PoW (SHA-256 hashcash) y AES-256-CBC del sitio, con crypto-js empaquetado.
//
// El original usaba require('crypto') de Node (createHash / createDecipheriv), que no existe en
// el runtime del reproductor. CryptoJS viene empaquetado por build.js, así que se sustituye:
//   nodeCrypto.createHash('sha256').update(x).digest('hex')  ->  CryptoJS.SHA256(x).toString(CryptoJS.enc.Hex)
//   nodeCrypto.createHash('sha256').update(x).digest()       ->  CryptoJS.SHA256(x)   (WordArray de 32 bytes)
//   createDecipheriv('aes-256-cbc', llave, iv)               ->  CryptoJS.AES.decrypt(..., {mode: CBC, padding: Pkcs7})
// Comprobado contra node:crypto con el dataLink real: mismo hash, misma llave y mismos 9 enlaces.

import CryptoJS from 'crypto-js';

export function sha256Hex(texto) {
  return CryptoJS.SHA256(texto).toString(CryptoJS.enc.Hex);
}

// Fuerza bruta del PoW del sitio: sha256(challenge + nonce) debe empezar con `difficulty` ceros.
// Devuelve la llave AES (sha256 crudo de challenge+nonce+salt) o null si no la encuentra o se
// agota el presupuesto. En el sitio medido la dificultad es 3 (~3.800 intentos, ~30 ms con CryptoJS).
export function resolverPoW(challenge, difficulty, salt, vencido) {
  var prefijo = '';
  for (var i = 0; i < difficulty; i++) prefijo += '0';
  console.log('[Megadede] Resolviendo PoW (dificultad ' + difficulty + ')...');
  var techo = difficulty > 6 ? 200000 : 5000000; // el original cortaba en 10M nonces
  for (var nonce = 0; nonce < techo; nonce++) {
    if ((nonce & 1023) === 0 && vencido()) {
      console.log('[Megadede] PoW abandonado por presupuesto en el nonce ' + nonce);
      return null;
    }
    var hash = sha256Hex(challenge + nonce);
    if (hash.indexOf(prefijo) === 0) {
      console.log('[Megadede] PoW resuelto en nonce=' + nonce + ' hash=' + hash.substring(0, 16) + '...');
      return CryptoJS.SHA256(challenge + nonce + salt);
    }
  }
  console.log('[Megadede] PoW sin solución dentro del techo de intentos');
  return null;
}

// AES-256-CBC del sitio: los primeros 16 bytes son el IV y el resto el texto cifrado.
export function aesCbcDescifrar(base64, llave) {
  try {
    var normal = String(base64 || '').replace(/-/g, '+').replace(/_/g, '/');
    var crudo = CryptoJS.enc.Base64.parse(normal);
    if (!crudo || crudo.sigBytes <= 16) return null;
    var iv = CryptoJS.lib.WordArray.create(crudo.words.slice(0, 4), 16);
    var cifrado = CryptoJS.lib.WordArray.create(crudo.words.slice(4), crudo.sigBytes - 16);
    var claro = CryptoJS.AES.decrypt(
      { ciphertext: cifrado },
      llave,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    var texto = claro.toString(CryptoJS.enc.Utf8);
    return texto || null;
  } catch (e) {
    return null;
  }
}
