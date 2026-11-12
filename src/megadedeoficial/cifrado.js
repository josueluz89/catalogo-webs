// cifrado.js — Clave de enlace y AES-256-CBC del reproductor vidurl de
// megadede.mobi (ahora servido como EMBED69).
//
// Esquema vigente (2026-11-12, verificado contra el HTML real de
// /vidurl/tt15239678/ y /vidurl/tt1190634-1x01/):
//   const LINK_CHALLENGE = '<hex>'; const LINK_SALT = '<hex>';
//   llave AES = SHA-256(LINK_CHALLENGE + LINK_SALT) — directa, SIN PoW.
//   Cada enlace: base64( IV(16 bytes) + AES-256-CBC(plaintext) ).
// El PoW hashcash (POW_CHALLENGE / POW_DIFFICULTY / POW_SALT) ya no lo sirve
// el sitio: la página no trae esos nombres y el provider moría en
// "Sin parámetros de PoW." con 0 streams. Se elimina el PoW entero.
//
// El original usaba require('crypto') de Node (createHash / createDecipheriv), que no existe en
// el runtime del reproductor. CryptoJS viene empaquetado por build.js, así que se sustituye:
//   nodeCrypto.createHash('sha256').update(x).digest()       ->  CryptoJS.SHA256(x)   (WordArray de 32 bytes)
//   createDecipheriv('aes-256-cbc', llave, iv)               ->  CryptoJS.AES.decrypt(..., {mode: CBC, padding: Pkcs7})
// Comprobado contra node:crypto con el dataLink real: misma llave y mismos 9 enlaces.

import CryptoJS from 'crypto-js';

// Llave AES del enlace: SHA-256 crudo de challenge+salt (32 bytes, sin PoW).
export function llaveEnlace(challenge, salt) {
  return CryptoJS.SHA256(String(challenge || '') + String(salt || ''));
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
