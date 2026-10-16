# monoschinos — portado desde latinuvio/providers/monoschinos.js

- Origen: latinuvio (autor original Latinuvio)
- Sitio: vww.monoschinos2.net
- Provider: `src/monoschinos/` -> `providers/monoschinos.js` (generado con `node build.js monoschinos`)
- Cambios vs el original:
  - Helpers hermanos (`./cdn_resolvers.js`, `./embed69.js`) inlineados en `src/monoschinos/resolvers.js` (familia vidhide/streamwish con `links = {hls4...}` + packer de Dean Edwards).
  - `Buffer.from(b64,"base64")` -> decodificador base64 propio; `String.normalize` -> tabla de acentos; sin `matchAll`.
  - Resolucion de embeds: familia local -> src/shared/embedResolvers.js (byse/filemoon, uqload, mp4upload, mixdrop, voe...).
  - Filtro de idioma: ficha castellana -> se descarta la entrada; sin marca DUB -> Subtitulado (el sitio se anuncia "Sub Espanol Latino").
  - Se emiten solo URLs de video reproducibles; los embeds sin resolver se descartan.
- Verificacion QuickJS (arnes real: fetch + atob/btoa + crypto-js, sin Buffer/crypto/https):

```bash
$ node tools/qjs-correr.mjs providers/monoschinos.js 95479 tv 1 1
```
```json
{
 "provider": "monoschinos.js",
 "caso": "tv 95479 S1E1",
 "ok": true,
 "streams": [
  {
   "title": "bysesukior · Subtitulado",
   "quality": "720p",
   "language": "Subtitulado",
   "url": "https://edge1-madrid-sprintcdn.r66nv9ed.com/hls2/04/10616/7sxrlsm3ftld_h/master.m3u8?t=bvTUZ0AxTVh7-pcwnWIlrimqEJU1uCCBAjVLIpOguA8&s=1792108346&e=10800&f=53081262&srv=1055&asn=14754&sp=4000&p=0",
   "headers": {
    "Referer": "https://bysesukior.com/"
   }
  },
  {
   "title": "voe · Subtitulado",
   "quality": "Unknown",
   "language": "Subtitulado",
   "url": "https://ugc-cdn-caching-n3thhhlmzuxvpehc9r.cloudwindow-route.com/engine/hls2-c/01/16247/c940kj3rfddm_,n,.urlset/master.m3u8?t=QM_ohH0-dOCFySEmHEgt75R5EQQqNwqqwmLIwFR3XRY&s=1792108349&e=14400&f=81235750&node=kNbVlc4V4micEdlGsSQy6UKO8Hepz0HhAxcl8eN8K/s=&i=186.151&sp=2500&asn=14754&q=n&rq=3o5FSl9pEEmqdPPNGaQQGKD1ans28dlwBSWzfWFX",
   "headers": {
    "Referer": "https://voe.sx/c940kj3rfddm"
   }
  }
 ],
 "ms": 13634
}
```

```bash
$ node tools/qjs-correr.mjs providers/monoschinos.js 129 movie
```
```json
{
 "provider": "monoschinos.js",
 "caso": "movie 129",
 "ok": true,
 "streams": [],
 "ms": 1048
}
```
> MonosChinos es un sitio de series de anime: la ruta de pelicula no tiene ficha ni reproductor -> 0 streams, correcto.

- Idioma: todos los streams que salen pasaron el filtro obligatorio (nada de Esp/ESP/SPA/Castellano/dual en title ni language) y ademas el validador compartido de enlaces (Range 0-2047 + #EXTM3U donde es HLS), asi que solo quedan enlaces reproducibles.
