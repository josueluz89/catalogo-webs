# elifilms — portado desde latinuvio/providers/elifilms.js
- Origen: repo del tercero **latinuvio** (`providers/elifilms.js`), más el helper hermano
  `stream_labels.js` (que el original cargaba con `require()` en try/catch y no llegaba a usar).
  Autor original: no declarado en las fuentes.
- Sitio: allcalidad.re (EliFilms)
- Destino: `src/elifilms/*` + `providers/elifilms.js` (generado con `node build.js elifilms`)

## Cambios vs el original

- `require("./stream_labels.js")` fuera (igual que en allpeliculasse: no se usaba); lo
  aprovechable queda en `src/elifilms/labels.js`.
- El original **se colgaba** en la película (>70 s, el arnés lo cortaba) por el barrido de espejos
  de StreamWish con `forEach(async)` + `setTimeout`: reescrito secuencial, con presupuesto.
- `new URL(...)` sustituido por regex (`partesDeUrl()`), y los espejos de StreamWish acotados a
  los que responden hoy.
- Se mantienen las particularidades del original: consulta de solo 2 palabras (su buscador se
  rompe con consultas largas) y la guarda de "resultados irrelevantes" (si la búsqueda no
  encuentra nada, el sitio devuelve los últimos posts publicados).
- Retirados GoodStream (522 tras 20 s), FileMoon (API en 404) y los hosts que el original ya
  saltaba a mano (sbcom/lvturbo/vanfem/fembed/1fichier/fireload).
- Presupuesto global de 35 s (antes: cuelgue; ahora ~9 s).

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
$ node build.js elifilms
✅ elifilms.js (27.3 KB)
✨ Done! 1 built, 0 skipped/failed
```

```bash
$ node tools/qjs-correr.mjs providers/elifilms.js 693134 movie
```
_Caso: Duna: Parte dos (2024) -> post 15963_

```json
{
 "provider": "elifilms.js",
 "caso": "movie 693134",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · Vimeos",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://s13.vimeos.net/hls2/02/00000/4rixak5egg9k_,n,h,.urlset/master.m3u8?t=R22uD7y_Oy-SgtF3YFADfS8UWGABA4oGcjMj41gVL8k&s=1792108195&e=43200&v=397063555&i=0.3&sp=0&r=e",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "es-MX,es;q=0.9"
   }
  }
 ],
 "ms": 8510,
 "logs": [
  "log [EliFilms] ID 693134 tipo movie S:null E:null",
  "log [EliFilms] Buscando: https://allcalidad.re/api/rest/search?post_type=movies&query=Duna&posts_per_page=20",
  "log [EliFilms] Coincidencia: \"Duna: Parte dos (2024)\" (ID 15963)",
  "log [EliFilms] Player de: https://allcalidad.re/api/rest/player?post_id=15963&_any=1",
  "log [EliFilms] Streams resueltos: 1"
 ]
}
```

```bash
$ node tools/qjs-correr.mjs providers/elifilms.js 76479 tv 3 1
```
_Caso: The Boys (2019) S3E1 -> post 30834_

```json
{
 "provider": "elifilms.js",
 "caso": "tv 76479 S3E1",
 "ok": true,
 "streams": [
  {
   "title": "1080p · Lat · Vimeos",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://p3.vimeos.zip/hls2/03/00009/s29zf1351c5k_h/master.m3u8?t=_KLY28L1laXGGiJBi2K4d01DCpnDvCMpzC97g7_3xJ0&s=1792108205&e=43200&v=397063564&srv=s11&i=0.3&sp=0&fr=s29zf1351c5k&r=e",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "es-MX,es;q=0.9"
   }
  },
  {
   "title": "1080p · Lat · StreamWish",
   "quality": "1080p",
   "language": "Latino",
   "url": "https://jZdDKEFw9oEu0.premilkyway.com/hls2/01/11495/9d7murcedi1d_,l,n,.urlset/master.m3u8?t=olsiP4431_cY3ES3AUoVlaZoDGlUtEfWlQdV1_79hq0&s=1792108206&e=129600&f=57478215&srv=WjMh3v4cXgcz&i=0.4&sp=500&p1=WjMh3v4cXgcz&p2=WjMh3v4cXgcz&asn=14754",
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
   "url": "https://ugc-cdn-caching-n3onxj7ixldkjwtbh5.cloudwindow-route.com/engine/hls2-c/01/15132/ir8cjsyrdbmz_,n,.urlset/master.m3u8?t=xOo90AnA5S9G14vlQWdb4q6HkK6QJaqF8jAt7mklgh0&s=1792108209&e=14400&f=75662956&node=/tPFhwS3ty/ft7gIXFciqVzL8G45bg9r/TKehVOKTuc=&i=186.151&sp=2500&asn=14754&q=n&rq=DfmmnnI8Cnm11STH1xPj7bQ7EwTMf489qffU6dk3",
   "headers": {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://voe.sx/e/ir8cjsyrdbmz"
   }
  }
 ],
 "ms": 9164,
 "logs": [
  "log [EliFilms] ID 76479 tipo tv S:3 E:1",
  "log [EliFilms] Buscando: https://allcalidad.re/api/rest/search?post_type=tvshows&query=The%20Boys&posts_per_page=20",
  "log [EliFilms] Coincidencia: \"The Boys (2019)\" (ID 5935)",
  "log [EliFilms] Episodios de: https://allcalidad.re/api/rest/episodes?post_id=5935",
  "log [EliFilms] Episodio S3E1 -> post 30834",
  "log [EliFilms] Player de: https://allcalidad.re/api/rest/player?post_id=30834&_any=1",
  "log [EliFilms] Streams resueltos: 3"
 ]
}
```

## Comprobación en vivo de los enlaces (`curl -w '%{http_code}'` con las cabeceras del stream)

Comprobado al generar este informe, con los enlaces recién sacados por el provider
(algunos CDN llevan token con caducidad, así que la URL no es fija):

| título | host + path | http |
| --- | --- | --- |
| 1080p · Lat · Vimeos (movie) | `s13.vimeos.net/hls2/02/00000/4rixak5egg9k_,n,h,.urlset/master.m3u8?t=R22uD7y_Oy-SgtF3YFADfS8UWGA...` | **403** |
| 1080p · Lat · Vimeos (tv) | `p3.vimeos.zip/hls2/03/00009/s29zf1351c5k_h/master.m3u8?t=_KLY28L1laXGGiJBi2K4d01DCpnDvCMpzC97g7_...` | **000** |
| 1080p · Lat · StreamWish (tv) | `jZdDKEFw9oEu0.premilkyway.com/hls2/01/11495/9d7murcedi1d_,l,n,.urlset/master.m3u8?t=olsiP4431_cY...` | 200 |
| 1080p · Lat · VOE (tv) | `ugc-cdn-caching-n3onxj7ixldkjwtbh5.cloudwindow-route.com/engine/hls2-c/01/15132/ir8cjsyrdbmz_,n,...` | 200 |

## Lo que no se pudo resolver / notas

- **Vimeos responde distinto según el nodo del CDN** (mismo caso que en allpeliculasse): nodos
  como `s13.vimeos.net` o `p3.vimeos.zip` devuelven 403 estable a curl, y otros (`p5.vimeos.zip`)
  devuelven 200 con las mismas cabeceras. Los de StreamWish y VOE responden 200 en todos los casos.
- En la película solo sobrevive 1 stream: los enlaces `hlswish.com/e/xu3wrox96ud2`,
  `voe.sx/e/baxhph1qvg9x` y `filemoon.sx/e/bj3b1m8r5413` que lista la API del sitio están
  caducados (el espejo de StreamWish contesta literalmente *"File is no longer available as it
  expired or has been deleted"*), y `videoapp.zip` no expone m3u8. En el capítulo de The Boys sí
  sobreviven 3 (Vimeos + StreamWish + VOE) porque esos ficheros están vivos.
- El resolvedor de FileMoon se retiró (su endpoint `/api/videos/<id>/embed/details` responde 404):
  se probó antes de quitarlo.
