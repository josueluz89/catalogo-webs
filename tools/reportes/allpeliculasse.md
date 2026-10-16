# allpeliculasse — portado desde latinuvio/providers/allpeliculasse.js
- Origen: repo del tercero **latinuvio** (`providers/allpeliculasse.js`), más el helper hermano
  `stream_labels.js` (que el original cargaba con `require()` en try/catch y no llegaba a usar).
  Autor original: no declarado en las fuentes.
- Sitio: allpeliculas.la (AllPeliculas)
- Destino: `src/allpeliculasse/*` + `providers/allpeliculasse.js` (generado con `node build.js allpeliculasse`)

## Cambios vs el original

- `require("./stream_labels.js")` fuera: la librería hermana ya no existe como tal dentro del
  provider; lo aprovechable (calidad y nombre de servidor) queda en `src/allpeliculasse/labels.js`.
  Ojo: buildStreamLabel() **no se llamaba nunca** en el original (era código muerto) y su
  `parseLanguage()` mapeaba "Esp" a "Latino", así que no se porta tal cual.
- `new URL(...)` (5 sitios) sustituido por `partesDeUrl()` con regex: el runtime no tiene `URL`.
- El barrido de espejos de StreamWish usaba `forEach(async)` + `Promise` + un `setTimeout` de 5 s
  del que dependía la correctitud; ahora es secuencial, con tope de espejos y sin timers.
- Presupuesto global de 35 s: el original tardaba **65 s** en la película (los reintentos de
  goodstream.one, que responde 522 tras 20 s, se comían el límite de 60 s de Nuvio).
- Retirados GoodStream (522), FileMoon (API en 404), DoodStream, StreamTape, Waaw y OkRu: medido
  que hoy no devuelven nada para los embeds de este sitio. Se conservan StreamWish, VidHide, VOE
  y Vimeos, que son los que sí dan m3u8.
- Titulo del stream con el mismo formato que el original (`calidad · idioma · servidor`).

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
$ node build.js allpeliculasse
✅ allpeliculasse.js (26.0 KB)
✨ Done! 1 built, 0 skipped/failed
```

```bash
$ node tools/qjs-correr.mjs providers/allpeliculasse.js 693134 movie
```
_Caso: Duna: Parte dos (2024) -> post 28209_

```json
{
 "provider": "allpeliculasse.js",
 "caso": "movie 693134",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · Vimeos",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://p2.vimeos.zip/hls2/02/00000/4rixak5egg9k_,n,h,.urlset/master.m3u8?t=WF6XPTOLiAv2gZErt9UYWhUeaOpTM5DO7a74ay_1wKo&s=1792108182&e=43200&v=397063555&srv=s13&i=0.3&sp=0&r=e",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "es-MX,es;q=0.9"
   }
  }
 ],
 "ms": 9390,
 "logs": [
  "log [AllpeliculasSE] ID 693134 tipo movie S:null E:null",
  "log [AllpeliculasSE] Buscando: https://allpeliculas.la/wp-api/v1/search?filter=[]&q=Duna&orderBy=latest&order=desc&postType=movies&postsPerPage=20&page=1",
  "log [AllpeliculasSE] Coincidencia: \"Duna: Parte dos (2024)\" (ID 28209)",
  "log [AllpeliculasSE] Players de: https://allpeliculas.la/wp-api/v1/player?postId=28209&demo=0",
  "log [AllpeliculasSE] Streams resueltos: 1"
 ]
}
```

```bash
$ node tools/qjs-correr.mjs providers/allpeliculasse.js 76479 tv 3 1
```
_Caso: The Boys (2019) S3E1 -> post 2358_

```json
{
 "provider": "allpeliculasse.js",
 "caso": "tv 76479 S3E1",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · Vimeos",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://p5.vimeos.zip/hls2/03/00009/s29zf1351c5k_h/master.m3u8?t=MTZUoSwO03tsrRk_JRPMKxLgCrFRYz-AM_p0NEsdmiI&s=1792108186&e=43200&v=397063564&srv=s11&i=0.0&sp=0&fr=s29zf1351c5k&r=e",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "es-MX,es;q=0.9"
   }
  },
  {
   "title": "1080p · Lat · StreamWish",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://jZdDKEFw9oEu0.premilkyway.com/hls2/01/11495/9d7murcedi1d_,l,n,.urlset/master.m3u8?t=1X3v2z_PKpbKmDsiWZagxKH0hELrBKTasDIfKxeEsX0&s=1792108188&e=129600&f=57478215&srv=WjMh3v4cXgcz&i=0.4&sp=500&p1=WjMh3v4cXgcz&p2=WjMh3v4cXgcz&asn=14754",
   "headers": {
    "Referer": "https://hanerix.com/e/9d7murcedi1d",
    "Origin": "https://hanerix.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
   }
  },
  {
   "title": "1080p · Lat · VOE",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://ugc-cdn-caching-n3onxj7ixldkjwtbh5.cloudwindow-route.com/engine/hls2-c/01/15132/ir8cjsyrdbmz_,n,.urlset/master.m3u8?t=UpSoa4wx26ggfwoiqEVvFlAxuRD5cO0q0Qom5n0ZcGE&s=1792108190&e=14400&f=75662956&node=/tPFhwS3ty/ft7gIXFciqVzL8G45bg9r/TKehVOKTuc=&i=186.151&sp=2500&asn=14754&q=n&rq=KkqipJTzHm2q7esAnwhdARoTtiIN1OmdTrBpQQa2",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://voe.sx/e/ir8cjsyrdbmz"
   }
  }
 ],
 "ms": 9905,
 "logs": [
  "log [AllpeliculasSE] ID 76479 tipo tv S:3 E:1",
  "log [AllpeliculasSE] Buscando: https://allpeliculas.la/wp-api/v1/search?filter=[]&q=The%20Boys&orderBy=latest&order=desc&postType=tvshows&postsPerPage=20&page=1",
  "log [AllpeliculasSE] Coincidencia: \"The Boys (2019)\" (ID 2312)",
  "log [AllpeliculasSE] Lista de episodios: https://allpeliculas.la/wp-api/v1/single/episodes/list?_id=2312&season=3&postsPerPage=100&page=1",
  "log [AllpeliculasSE] Episodio S3E1 -> post 2358",
  "log [AllpeliculasSE] Players de: https://allpeliculas.la/wp-api/v1/player?postId=2358&demo=0",
  "log [AllpeliculasSE] Streams resueltos: 3"
 ]
}
```

## Comprobación en vivo de los enlaces (`curl -w '%{http_code}'` con las cabeceras del stream)

Comprobado al generar este informe, con los enlaces recién sacados por el provider
(algunos CDN llevan token con caducidad, así que la URL no es fija):

| título | host + path | http |
| --- | --- | --- |
| 1080p · Lat · Vimeos (movie) | `p2.vimeos.zip/hls2/02/00000/4rixak5egg9k_,n,h,.urlset/master.m3u8?t=WF6XPTOLiAv2gZErt9UYWhUeaOpT...` | **403** |
| 1080p · Lat · Vimeos (tv) | `p5.vimeos.zip/hls2/03/00009/s29zf1351c5k_h/master.m3u8?t=MTZUoSwO03tsrRk_JRPMKxLgCrFRYz-AM_p0NEs...` | 200 |
| 1080p · Lat · StreamWish (tv) | `jZdDKEFw9oEu0.premilkyway.com/hls2/01/11495/9d7murcedi1d_,l,n,.urlset/master.m3u8?t=1X3v2z_PKpbK...` | 200 |
| 1080p · Lat · VOE (tv) | `ugc-cdn-caching-n3onxj7ixldkjwtbh5.cloudwindow-route.com/engine/hls2-c/01/15132/ir8cjsyrdbmz_,n,...` | 200 |

## Lo que no se pudo resolver / notas

- **Vimeos responde distinto según el nodo del CDN**: `p5.vimeos.zip` devuelve 200 de forma
  consistente con las mismas cabeceras del stream, mientras que `p2.vimeos.zip` devuelve 403
  también de forma consistente. No es el token ni las cabeceras: se probó sin cabeceras, con UA,
  con Referer de vimeos.net, con Referer de player.vimeo.com, con Origin y con la cookie de sesión
  del embed, y el nodo que rechaza rechaza siempre (nginx 403, cuerpo de 146 bytes). Se deja el
  resolvedor igual que en el original (que de hecho borra el Referer para la familia vimeos).
- El embed `videoapp.zip/e/movie/693134` no lo resolvía el original (no está en su router) y
  tampoco este port: la página carga el vídeo dentro de un iframe, no expone m3u8 en el HTML.
  Queda reportado, no inventado.
- Sin isEmbed ni magnet: solo m3u8/mp4 directos.
