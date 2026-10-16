# animeav1 — portado desde latinuvio/providers/animeav1.js

- Origen: latinuvio (autor original Latinuvio)
- Sitio: animeav1.com
- Provider: `src/animeav1/` -> `providers/animeav1.js` (generado con `node build.js animeav1`)
- Cambios vs el original:
  - `cheerio` -> parseo por regex de las tarjetas `<article>` de /catalogo.
  - `String.normalize("NFD")` -> tabla de acentos propia; sin `matchAll` ni `URL`.
  - Embed HLS propio (zilla-networks): `/play/<id>` -> `/m3u8/<id>` sin peticion extra.
  - Mp4Upload/voe/byse/streamwish via src/shared/embedResolvers.js; headers saneados (mp4upload exige Referer de su propia URL, vimeos da 403 con Referer).
  - Idioma por marca: `DUB` -> Latino; sin marca -> Subtitulado (nunca castellano; los hosts de Espana no existen en la fuente).
  - Match de fichas: si el buscador del sitio devuelve la ficha con el tipo pedido (el sitio traduce los titulos), vale aunque el titulo no coincida palabra por palabra.
- Verificacion QuickJS (arnes real: fetch + atob/btoa + crypto-js, sin Buffer/crypto/https):

```bash
$ node tools/qjs-correr.mjs providers/animeav1.js 95479 tv 1 1
```
```json
{
 "provider": "animeav1.js",
 "caso": "tv 95479 S1E1",
 "ok": true,
 "streams": [
  {
   "title": "Byse · Subtitulado",
   "quality": "1080p",
   "language": "Subtitulado",
   "url": "https://edge1-madrid-sprintcdn.r66nv9ed.com/hls2/08/12136/i8fv8qtbwc0o_x/master.m3u8?t=qTM2NoRkUjbnIDUJaQYMxqIfrUEenIsJx6qsEzTsupI&s=1792108306&e=10800&f=60680176&srv=1060&asn=14754&sp=5500&p=0",
   "headers": {
    "Referer": "https://byselapuix.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "Byse · Latino",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://edge1-vienna-sprintcdn.owphbf24.com/hls2/09/11876/on89yxdv0okl_x/master.m3u8?t=tYd9hWxxPTCOrNoTWNEncqPprytc-ZW3GqnT3cqxh58&s=1792108307&e=10800&f=59381919&srv=1050&asn=14754&sp=5500&p=0",
   "headers": {
    "Referer": "https://byselapuix.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "HLS · Subtitulado",
   "quality": "720p",
   "language": "Subtitulado",
   "url": "https://player.zilla-networks.com/m3u8/4a870ee9bd16efa522eaf330f84da5c1",
   "headers": {
    "Referer": "https://animeav1.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  }
 ],
 "ms": 19079,
 "truncado": "hay 5 streams mas (recortado a 3)"
}
```

```bash
$ node tools/qjs-correr.mjs providers/animeav1.js 129 movie
```
```json
{
 "provider": "animeav1.js",
 "caso": "movie 129",
 "ok": true,
 "streams": [
  {
   "title": "HLS · Subtitulado",
   "quality": "720p",
   "language": "Subtitulado",
   "url": "https://player.zilla-networks.com/m3u8/3b18fc0290aeaf8c0258e333fad53573",
   "headers": {
    "Referer": "https://animeav1.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "HLS · Latino",
   "quality": "720p",
   "language": "Latino",
   "url": "https://player.zilla-networks.com/m3u8/5f22cac5fbe9793776dc7f380daf6f6a",
   "headers": {
    "Referer": "https://animeav1.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "Byse · Subtitulado",
   "quality": "480p",
   "language": "Subtitulado",
   "url": "https://edge1-vienna-sprintcdn.owphbf24.com/hls2/04/11852/kepqbue2enws_x/master.m3u8?t=E6rQ5Cm3lWJifKbumxnlvL5x6PVnAEd9UOJz4D04XHQ&s=1792108328&e=10800&f=59262066&srv=1055&asn=14754&sp=5500&p=0",
   "headers": {
    "Referer": "https://byselapuix.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
   }
  }
 ],
 "ms": 16012,
 "truncado": "hay 2 streams mas (recortado a 3)"
}
```

```bash
$ node tools/qjs-correr.mjs providers/animeav1.js 693134 movie
```
```json
{
 "provider": "animeav1.js",
 "caso": "movie 693134",
 "ok": true,
 "streams": [],
 "ms": 1046
}
```
> Dune: Part Two no esta en el catalogo de animeav1 (el buscador no devuelve ficha de pelicula): 0 streams, correcto.

- Idioma: todos los streams que salen pasaron el filtro obligatorio (nada de Esp/ESP/SPA/Castellano/dual en title ni language) y ademas el validador compartido de enlaces (Range 0-2047 + #EXTM3U donde es HLS), asi que solo quedan enlaces reproducibles.
