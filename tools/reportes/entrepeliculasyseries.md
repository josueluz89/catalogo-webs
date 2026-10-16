# entrepeliculasyseries — portado desde latinuvio/providers/entrepeliculasyseries.js

- Origen: latinuvio (autor original Latinuvio)
- Sitio: entrepeliculasyseries.nz
- Provider: `src/entrepeliculasyseries/` -> `providers/entrepeliculasyseries.js` (generado con `node build.js entrepeliculasyseries`)
- Cambios vs el original:
  - `require("crypto")` -> SHA-256 y AES-256-CBC propios (sin Buffer, verificados byte a byte contra node:crypto).
  - `require("https")` + agent TLS laxo -> `fetch` (src/shared/http.js) con los mismos headers.
  - Sin `matchAll` / `normalize` / `URL` (bucles con RegExp.exec y parseo propio).
  - Resolucion de embeds: resolver local de familia vidhide/streamwish (paginas `links = {hls4...}`) + src/shared/embedResolvers.js (voe, vimeos, goodstream, mp4upload...).
  - Filtro de idioma: los bloques `video_language` ESP/CAST del dataLink se descartan; solo Lat (-> Latino) y Sub/VOSE (-> Subtitulado).
  - Se emiten unicamente URLs de video reproducibles (nada de embeds sin resolver).
- Verificacion QuickJS (arnes real: fetch + atob/btoa + crypto-js, sin Buffer/crypto/https):

```bash
$ node tools/qjs-correr.mjs providers/entrepeliculasyseries.js 693134 movie
```
```json
{
 "provider": "entrepeliculasyseries.js",
 "caso": "movie 693134",
 "ok": true,
 "streams": [
  {
   "title": "HD · Latino · Vidhide",
   "quality": "HD",
   "language": "Latino",
   "url": "https://morencius.com/stream/0ysfgm2N1-o_e_EozLMUOg/hjkrhuihghfvu/1792151751/35532156/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com"
   }
  },
  {
   "title": "HD · Latino · Streamwish",
   "quality": "HD",
   "language": "Latino",
   "url": "https://vibuxer.com/stream/f5S5tLOZty35uOe7q2-2Ng/kjhhiuahiuhgihdf/1792151753/66173133/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://vibuxer.com/",
    "Origin": "https://vibuxer.com"
   }
  },
  {
   "title": "HD · Subtitulado · Vidhide",
   "quality": "HD",
   "language": "Subtitulado",
   "url": "https://morencius.com/stream/gyuQxyiTglvrJQqW26Zoew/hjkrhuihghfvu/1792151755/35532262/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com"
   }
  }
 ],
 "ms": 13165,
 "truncado": "... y 1 stream(s) mas"
}
```

```bash
$ node tools/qjs-correr.mjs providers/entrepeliculasyseries.js 76479 tv 3 1
```
```json
{
 "provider": "entrepeliculasyseries.js",
 "caso": "tv 76479 S3E1",
 "ok": true,
 "streams": [
  {
   "title": "HD · Latino · Vidhide",
   "quality": "HD",
   "language": "Latino",
   "url": "https://morencius.com/stream/cq9M9lqKlXWz9Yq9Jc8J7Q/hjkrhuihghfvu/1792151764/31801322/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com"
   }
  },
  {
   "title": "HD · Latino · Streamwish",
   "quality": "HD",
   "language": "Latino",
   "url": "https://vibuxer.com/stream/zQsjymvtsqGaSigtSIfdzg/kjhhiuahiuhgihdf/1792151766/59414699/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://vibuxer.com/",
    "Origin": "https://vibuxer.com"
   }
  }
 ],
 "ms": 7111
}
```

```bash
$ node tools/qjs-correr.mjs providers/entrepeliculasyseries.js 129 movie
```
```json
{
 "provider": "entrepeliculasyseries.js",
 "caso": "movie 129",
 "ok": true,
 "streams": [
  {
   "title": "HD · Latino · Vidhide",
   "quality": "HD",
   "language": "Latino",
   "url": "https://morencius.com/stream/KjphorFVE_0ruh1DJ_PBCQ/hjkrhuihghfvu/1792151772/22123072/master.m3u8",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://morencius.com/",
    "Origin": "https://morencius.com"
   }
  }
 ],
 "ms": 7120
}
```

- Idioma: todos los streams que salen pasaron el filtro obligatorio (nada de Esp/ESP/SPA/Castellano/dual en title ni language) y ademas el validador compartido de enlaces (Range 0-2047 + #EXTM3U donde es HLS), asi que solo quedan enlaces reproducibles.
