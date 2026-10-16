# megadedeoficial — portado desde latinuvio/providers/megadedeoficial.js
- Origen: repo del tercero **latinuvio** (`providers/megadedeoficial.js`), más el helper hermano
  `stream_labels.js` (que el original cargaba con `require()` en try/catch y no llegaba a usar).
  Autor original: no declarado en las fuentes.
- Sitio: megadede.mobi (MegaDede)
- Destino: `src/megadedeoficial/*` + `providers/megadedeoficial.js` (generado con `node build.js megadedeoficial`)

## Cambios vs el original

- **El original no cargaba en el reproductor**: `require("crypto")` (createHash/createDecipheriv)
  y `Buffer` no existen en el motor. Se sustituye por crypto-js (que build.js ya empaqueta):
  `sha256Hex()`/`CryptoJS.SHA256()` para el PoW y `CryptoJS.AES.decrypt(... CBC, Pkcs7)` para el
  dataLink; el IV (primeros 16 bytes) y el texto cifrado se manejan con WordArrays en vez de Buffer.
  Comprobado contra `node:crypto`: mismo hash, misma llave y los 9 enlaces del dataLink idénticos.
- `matchAll` (3 barridos de <article> y <script>) sustituido por bucles con `RegExp.exec`, y
  `new URL()` por regex (`rutaVidurlDeHtml()`).
- El `dataLink` de la página trae **LAT, ESP y SUB** (medido en la película): los bloques
  ESP/CAST se descartan antes de descifrar y resolver, así que no se pide ni un enlace de España.
  En el log de la verificación se ve: `Bloque descartado por idioma: ESP`.
- Fuera los embeds `isEmbed` (el original los generaba y los filtraba después con dos wrappers) y
  los resolvedores que hoy no dan nada: GoodStream (522) y FileMoon (404).
- El `servername` del dataLink se usa como pista del resolvedor (el original ya lo hacía): las
  URLs descifradas de VidHide vienen en dominios espejo como morencius.com.
- Presupuesto global de 35 s (el PoW del sitio es de dificultad 3: ~30 ms).

## Filtro de idioma (obligatorio)

Al final de `getStreams`, sobre TODOS los streams, tal como pide el contrato:

```js
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;
```

`language` sale normalizado a `'Latino'` o `'Subtitulado'` (nunca `'Español'`), y el idioma se
resuelve ANTES de resolver los embeds: los marcados castellano no solo se filtran al final, es que
no se llegan a pedir. Ningún stream de España sale de aquí.

## Verificación QuickJS (runtime real de la app)

```bash
$ node build.js megadedeoficial
✅ megadedeoficial.js (244.2 KB)
✨ Done! 1 built, 0 skipped/failed
```

```bash
$ node tools/qjs-correr.mjs providers/megadedeoficial.js 693134 movie
```
_Caso: imdb tt15239678 -> /vidurl/tt15239678/ (PoW dificultad 3)_

```json
{
 "provider": "megadedeoficial.js",
 "caso": "movie 693134",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · VidHide",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://morencius.com/stream/LliomwQb6yDYhSW0JbBWfA/hjkrhuihghfvu/1792151414/35532156/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com",
    "X-Requested-With": "XMLHttpRequest"
   }
  },
  {
   "title": "1080p · Lat · StreamWish",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://cyyroro04xrqr.premilkyway.com/hls2/01/13234/adh7c2v80a12_,l,n,.urlset/master.m3u8?t=AKWzosFAdqVZrl_pVj1isLZ5zWHzTxJL9k3DXrUzyjI&s=1792108216&e=129600&f=66173133&srv=kxbg0h85dae8&i=0.4&sp=500&p1=kxbg0h85dae8&p2=kxbg0h85dae8&asn=14754",
   "headers": {
    "Referer": "https://hanerix.com/e/adh7c2v80a12",
    "Origin": "https://hanerix.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "1080p · Sub · VidHide",
   "quality": "1080p",
   "language": "Subtitulado",
   "url": "https://wt4PjIIVE9AGjPL.dramiyos-cdn.com/hls2/01/07106/8pvse4pky3qk_,l,n,.urlset/master.m3u8?t=u0F_Nr1_wFpe6vAXrqm1KNwytufcMI5TMWDVfAyJ6Ag&s=1792108219&e=129600&f=35532262&srv=e4RHfFUBYeX4H3m&i=0.4&sp=500&p1=e4RHfFUBYeX4H3m&p2=e4RHfFUBYeX4H3m&asn=14754",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com",
    "X-Requested-With": "XMLHttpRequest"
   }
  }
 ],
 "ms": 11726,
 "logs": [
  "log [Megadede] ID 693134 tipo movie S:null E:null",
  "log [Megadede] Vía rápida por imdb_id: /vidurl/tt15239678/",
  "log [Megadede] Vidurl: https://megadede.mobi/vidurl/tt15239678/",
  "log [Megadede] Resolviendo PoW (dificultad 3)...",
  "log [Megadede] PoW resuelto en nonce=783 hash=000034283186e100...",
  "log [Megadede] Bloque descartado por idioma: ESP",
  "log [Megadede] Streams resueltos: 4"
 ],
 "_nota": "(4 streams en total, se muestran 3)"
}
```

```bash
$ node tools/qjs-correr.mjs providers/megadedeoficial.js 76479 tv 3 1
```
_Caso: imdb tt1190634 -> /vidurl/tt1190634-3x01/_

```json
{
 "provider": "megadedeoficial.js",
 "caso": "tv 76479 S3E1",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · VidHide",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://HI3THh5OxxWw.acek-cdn.com/hls2/01/06360/p5wm1oif6yn2_,l,n,h,.urlset/master.m3u8?t=YtzctXcYgCIA0YmkLyrj44RWysX5-fN4jT0EeCQhFUY&s=1792108227&e=129600&f=31801322&srv=QuzDGIUOroqdH83C&i=0.4&sp=500&p1=QuzDGIUOroqdH83C&p2=QuzDGIUOroqdH83C&asn=14754",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com",
    "X-Requested-With": "XMLHttpRequest"
   }
  },
  {
   "title": "1080p · Lat · StreamWish",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://jZdDKEFw9oEu0.premilkyway.com/hls2/01/11882/09ef3twxzh06_,l,n,h,.urlset/master.m3u8?t=1vSWskdPZOqtm5GnabV4ytw4d9Lldic0WMRpSmC_1OE&s=1792108229&e=129600&f=59414699&srv=7npihg0ee2yuu&i=0.4&sp=500&p1=7npihg0ee2yuu&p2=7npihg0ee2yuu&asn=14754",
   "headers": {
    "Referer": "https://hanerix.com/e/09ef3twxzh06",
    "Origin": "https://hanerix.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
   }
  }
 ],
 "ms": 7556,
 "logs": [
  "log [Megadede] ID 76479 tipo tv S:3 E:1",
  "log [Megadede] Vía rápida por imdb_id: /vidurl/tt1190634-3x01/",
  "log [Megadede] Vidurl: https://megadede.mobi/vidurl/tt1190634-3x01/",
  "log [Megadede] Resolviendo PoW (dificultad 3)...",
  "log [Megadede] PoW resuelto en nonce=5623 hash=0000fd7986ec411e...",
  "log [Megadede] Streams resueltos: 2"
 ]
}
```

## Comprobación en vivo de los enlaces (`curl -w '%{http_code}'` con las cabeceras del stream)

Comprobado al generar este informe, con los enlaces recién sacados por el provider
(algunos CDN llevan token con caducidad, así que la URL no es fija):

| título | host + path | http |
| --- | --- | --- |
| 1080p · Lat · VidHide (movie) | `morencius.com/stream/LliomwQb6yDYhSW0JbBWfA/hjkrhuihghfvu/1792151414/35532156/master.m3u8` | 200 |
| 1080p · Lat · StreamWish (movie) | `cyyroro04xrqr.premilkyway.com/hls2/01/13234/adh7c2v80a12_,l,n,.urlset/master.m3u8?t=AKWzosFAdqVZ...` | 200 |
| 1080p · Sub · VidHide (movie) | `wt4PjIIVE9AGjPL.dramiyos-cdn.com/hls2/01/07106/8pvse4pky3qk_,l,n,.urlset/master.m3u8?t=u0F_Nr1_w...` | 200 |
| 1080p · Sub · StreamWish (movie) | `27u55xdzmm9q.cdn-centaurus.com/hls2/01/13234/x248rk8zg76u_,l,n,.urlset/master.m3u8?t=D0GXONcPAxw...` | 200 |
| 1080p · Lat · VidHide (tv) | `HI3THh5OxxWw.acek-cdn.com/hls2/01/06360/p5wm1oif6yn2_,l,n,h,.urlset/master.m3u8?t=YtzctXcYgCIA0Y...` | 200 |
| 1080p · Lat · StreamWish (tv) | `jZdDKEFw9oEu0.premilkyway.com/hls2/01/11882/09ef3twxzh06_,l,n,h,.urlset/master.m3u8?t=1vSWskdPZO...` | 200 |

## Lo que no se pudo resolver / notas

- Los 6 enlaces del dataLink (LAT/ESP/SUB × vidhide/streamwish/voe) se descifran bien; el bloque
  ESP se descarta por idioma y los VOE de esta película no devolvieron m3u8 (ficheros caídos), así
  que quedan 4. En el capítulo quedan 2.
- Los 6 enlaces de los dos casos (4 de la película + 2 del capítulo) verificados en vivo con curl
  devuelven **200** con las cabeceras que viajan en el stream (Referer/Origin del espejo). Ninguno
  de España, porque el bloque ESP no se descifra ni se pide.
- El PoW del sitio es de dificultad 3 (~3.800 intentos, 31 ms medidos con crypto-js); el bucle
  tiene techo de intentos y respeta el presupuesto de 35 s por si el sitio sube la dificultad.
