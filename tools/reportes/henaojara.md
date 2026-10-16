# henaojara — portado desde latinuvio/providers/henaojara.js

- Origen: latinuvio (autor original Latinuvio)
- Sitio: ww1.henaojara.net
- Provider: `src/henaojara/` -> `providers/henaojara.js` (generado con `node build.js henaojara`)
- Cambios vs el original:
  - `cheerio` -> parseo por regex (`<article>`, `div.dwn` con data-dwn, `.opt` con data-encrypt, `<li encrypt=hex>`).
  - `String.normalize` -> tabla de acentos propia; `replaceAll` -> `split/join`; sin `matchAll`.
  - Helpers de resolucion (`./cdn_resolvers.js`, `./embed69.js` de la fuente) inlineados en `src/henaojara/resolvers.js`.
  - Embeds: byse/filemoon, uqload, mp4upload, mixdrop, voe, streamwish/vidhide via src/shared/embedResolvers.js + familia local; headers saneados (mp4upload).
  - Filtro de idioma: ficha con "castellano" -> se descarta; titulo que menciona latino/doblaje -> Latino; solo sub -> Subtitulado.
  - Match de fichas: si el buscador del sitio devuelve la ficha con el tipo pedido (el sitio traduce los titulos), vale aunque el titulo no coincida palabra por palabra.
- Verificacion QuickJS (arnes real: fetch + atob/btoa + crypto-js, sin Buffer/crypto/https):

```bash
$ node tools/qjs-correr.mjs providers/henaojara.js 95479 tv 1 1
```
```json
{
 "provider": "henaojara.js",
 "caso": "tv 95479 S1E1",
 "ok": true,
 "streams": [
  {
   "title": "Filemoon · Latino",
   "quality": "720p",
   "language": "Latino",
   "url": "https://edge1-waw-sprintcdn.r66nv9ed.com/hls2/06/03703/jyym6gfh2j21_x/master.m3u8?t=rgP1PbO6Q75YlXi954rsR79MtAsm0X5oprnwFz2xHr0&s=1792108361&e=10800&f=38522825&srv=1050&asn=14754&sp=5500&p=0",
   "headers": {
    "Referer": "https://bysesukior.com/"
   }
  },
  {
   "title": "Filemoon · Latino",
   "quality": "720p",
   "language": "Latino",
   "url": "https://edge1-waw-sprintcdn.r66nv9ed.com/hls2/06/03703/jyym6gfh2j21_x/master.m3u8?t=B_VPxyfj09RSDNRXyf6V2L0qWC40B0DlSlm-uZyDPW0&s=1792108362&e=10800&f=38522825&srv=1050&asn=14754&sp=5500&p=0",
   "headers": {
    "Referer": "https://bysesukior.com/"
   }
  },
  {
   "title": "Uqload.is · Latino",
   "quality": "720p",
   "language": "Latino",
   "url": "https://strm1.uqload.vc/hls2/02/02504/w5njws4olcsk_n/master.m3u8?t=jFwBMbnJQnWV7hhWruhU16owt5kN1A0syjG20HXHRsE&s=1792108363&e=14400&v=162789&i=0.0&sp=0",
   "headers": {
    "Referer": "https://uqload.is/",
    "Origin": "https://uqload.is"
   }
  }
 ],
 "ms": 13424,
 "truncado": "hay 1 streams mas (recortado a 3)"
}
```

```bash
$ node tools/qjs-correr.mjs providers/henaojara.js 129 movie
```
```json
{
 "provider": "henaojara.js",
 "caso": "movie 129",
 "ok": true,
 "streams": [],
 "ms": 3625
}
```
> La ficha de la pelicula resuelve, pero sus servidores actuales (mega.nz y streamtape) estan muertos: mega se descarta por diseno y streamtape devuelve "file was deleted" -> 0 streams.

- Idioma: todos los streams que salen pasaron el filtro obligatorio (nada de Esp/ESP/SPA/Castellano/dual en title ni language) y ademas el validador compartido de enlaces (Range 0-2047 + #EXTM3U donde es HLS), asi que solo quedan enlaces reproducibles.
