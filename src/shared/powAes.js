// powAes.js — PoW SHA-256 (hashcash) + AES-256-CBC con crypto-js.
//
// Varios hosts de embeds protegen sus enlaces con el mismo esquema:
//   1. PoW: sha256(challenge + nonce) debe empezar con `difficulty` ceros.
//   2. Llave AES: sha256(challenge + nonce + salt) (32 bytes crudos).
//   3. Cada enlace: base64 -> primeros 16 bytes = IV, resto = texto cifrado,
//      AES-256-CBC con padding PKCS7.
// Misma semántica que src/megadedeoficial/cifrado.js, extraída a shared para
// no duplicarla en cada provider que la necesite (embed69, megadede...).
//
// QuickJS-safe: solo CryptoJS (empaquetado por build.js, el motor inyecta
// require('crypto-js')); sin Buffer, sin TextEncoder, sin crypto.subtle.

import CryptoJS from 'crypto-js';

function sha256Hex(texto) {
  return CryptoJS.SHA256(texto).toString(CryptoJS.enc.Hex);
}

// Fuerza bruta del PoW. Devuelve la llave AES como WordArray de 32 bytes, o
// null si no hay solución dentro del techo. Dificultad 3 ~= 4.000 intentos
// (~30 ms con CryptoJS); el techo de 2M cubre hasta dificultad 5 con margen.
function resolverPoW(challenge, difficulty, salt) {
  var prefijo = '';
  for (var i = 0; i < difficulty; i++) prefijo += '0';
  var techo = 2000000;
  for (var nonce = 0; nonce < techo; nonce++) {
    if (sha256Hex(challenge + nonce).indexOf(prefijo) === 0) {
      return CryptoJS.SHA256(challenge + nonce + salt);
    }
  }
  return null;
}

// AES-256-CBC: los primeros 16 bytes son el IV y el resto el texto cifrado.
function aesCbcDescifrar(base64, llave) {
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

export { sha256Hex, resolverPoW, aesCbcDescifrar };
