# SPEC — Portar providers de terceros a MasterScrap (independientes, solo latino/sub)

## Objetivo

Convertir cada provider de `C:\Users\josue\AppData\Local\hermes\cache\scratch\faltantes\<origen>\<archivo>.js`
en un provider **propio, independiente y verificado en QuickJS**, dentro del repo
`C:\Users\josue\OneDrive\Documentos\scraperstv-providers`.

## Reglas duras del usuario (no negociables)

1. **Solo español latino y subtitulado.** Se descarta TODO stream de **español de España**
   (etiquetas `Esp`, `ESP`, `SPA`, `Castellano`, `Español (España)`, `Spanish`, `dual`).
   Se conserva lo que diga `Lat`, `Latino`, `LAT`, `Sub`, `Subs`, `Subtitulado`, `VOSE`.
   La app debe recibir **cero** streams castellanos.
2. **Cada provider es independiente**: `providers/<id>.js` tiene que funcionar solo, sin
   archivos hermanos en `providers/`. Los helpers van en `src/<id>/…` y los empaqueta `build.js`.
3. **Verificado en QuickJS antes de dar nada por bueno** (comando exacto más abajo).
4. Español en comentarios, descripciones y reportes (el repo está en español).
5. **NO** tocar `manifest.json`, `README.md`, `docs/`, ni otros providers. **NO** hacer `git add/commit/push`.

## Estructura de origen (leer de aquí, no de internet)

```
C:\Users\josue\AppData\Local\hermes\cache\scratch\faltantes\adrian\<archivo>.js        (18 archivos + helpers)
C:\Users\josue\AppData\Local\hermes\cache\scratch\faltantes\latinuvio\<archivo>.js     (34 archivos + helpers)
```

Los de latinuvio **requieren archivos hermanos** (`./stream_labels.js`, `./cdn_resolvers.js`,
`./title_match.js`, `./embed69.js`): el provider no es independiente hasta que ese código quede
dentro de `src/<id>/` y `build.js` lo empaquete.

Los de Adrian son bundles de esbuild que usan **axios** (`require('axios')`), que **no existe** en
nuestro motor: hay que reemplazar cada llamada por `fetch` (con los mismos headers).

## Destino

```
src/<id>/index.js          ← punto de entrada (puede importar otros archivos de src/<id>/ y src/shared/)
src/<id>/…                 ← helpers propios si hacen falta
providers/<id>.js          ← GENERADO: node build.js <id>   (no se edita a mano)
tools/fragmentos/<id>.json ← entrada de manifest lista para fusionar
tools/reportes/<id>.md     ← reporte con la salida real del arnés
```

`build.js` ya está configurado: empaqueta `src/<id>/` en un solo archivo CommonJS y **bundlea
crypto-js dentro** (no lo deja como `require` externo). Uso: `node build.js <id>`.

## Contrato del provider (docs/CONTRATO.md del repo)

```js
module.exports = { getStreams };
// getStreams(tmdbId, mediaType, season, episode) -> Promise<stream[]>
// mediaType: 'movie' | 'series' | 'tv' | 'anime'  → normalizar 'series'/'anime' a 'tv'
// stream = { title, quality, language, url, headers: { Referer, 'User-Agent', ... } }
```

- **Nunca lanza**: toda ruta de error devuelve `[]`.
- `language` en español: `'Latino'` o `'Subtitulado'` (nunca `'Español'` de España).
- Los `headers` viajan con el stream (hay CDNs que dan 403 sin Referer).

## Límites del runtime QuickJS (si se usa algo de esto, el provider no carga en la app)

Prohibido: `Buffer`, `require('crypto')`, `require('https')`, `require('axios')`, `require('zlib')`,
`TextEncoder`, `TextDecoder`, `Blob`, `URL`/`URLSearchParams` (usar regex o parsing propio),
`String.prototype.matchAll`, `String.prototype.normalize`, `Array.prototype.at`, `structuredClone`,
`process`, `fs`.

Disponible: `fetch`, `console`, `Promise`, `async/await`, `setTimeout`/`clearTimeout` (no fiarse de
ellos para la correctitud), `AbortController` **opcional** (`typeof AbortController !== 'undefined'`),
`atob`/`btoa`, `crypto-js` empaquetado, `JSON`, `RegExp`, `Date`.

Para quitar acentos: tabla propia (`áàäâã→a`), nunca `.normalize('NFD')`.
Para base64: `atob`/`btoa`, nunca `Buffer.from(...).toString('base64')`.

## Filtro de idioma (obligatorio, al final, sobre TODOS los streams)

```js
var RE_LATINO = /latino|\blat\b|\blat\.|\[lat\]/i;
var RE_SUB = /\bsub\b|\bsubs\b|subtitulad|\bvose\b|\bvosi\b|\[sub\]/i;
var RE_ESPANA = /castellano|espa(ñ|n)ol de espa(ñ|n)a|\besp\b|\bespana\b|\bspa\b|spanish|\bdual\b/i;

function idiomaPermitido(titulo) {
  var t = String(titulo || '');
  if (RE_ESPANA.test(t)) return false;   // primero descartar España
  return RE_LATINO.test(t) || RE_SUB.test(t);
}
// al armar la lista: streams.filter(s => idiomaPermitido(s.title + ' ' + s.language))
// y normalizar: language = RE_SUB.test(t) && !RE_LATINO.test(t) ? 'Subtitulado' : 'Latino'
```

Si un título solo está en castellano, el provider devuelve `[]`. Eso es correcto.

## Verificación obligatoria (el arnés es el del runtime real)

```bash
cd "/c/Users/josue/OneDrive/Documentos/scraperstv-providers"
node build.js <id>
node tools/qjs-correr.mjs providers/<id>.js 693134 movie          # película
node tools/qjs-correr.mjs providers/<id>.js 76479 tv 3 1          # serie
# anime:   node tools/qjs-correr.mjs providers/<id>.js 95479 tv 1 1   y   129 movie
```

Criterio de **listo**: al menos un caso devuelve ≥1 stream, salida con `"ok": true`, y **ningún**
stream con `Esp`/`Castellano`/`SPA` en `title` o `language`. Pegar la salida real en
`tools/reportes/<id>.md` (recortada a 3 streams por caso).

Si la salida sale vacía (0 streams), primero revisar los `logs` del arnés (los imprime al final):
casi siempre dice qué URL falló o qué API cambió. Si el sitio ya no da nada, reportarlo así
(no inventar ni dejar código muerto).

Verificación extra recomendada (los enlaces son reproducibles de verdad):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Referer: <el del stream>" "<url del m3u8>"
```

## Formato de `tools/fragmentos/<id>.json`

```json
[
  {
    "id": "<id>",
    "name": "<Nombre del sitio>",
    "description": "Películas y series en latino desde <sitio>.",
    "version": "1.0.0",
    "author": "Masters",
    "supportedTypes": ["movie", "tv"],
    "filename": "providers/<id>.js",
    "enabled": true,
    "formats": ["m3u8", "mp4"],
    "logo": "https://www.google.com/s2/favicons?domain=<dominio-del-sitio>&sz=128",
    "contentLanguage": ["es"]
  }
]
```

## Formato de `tools/reportes/<id>.md`

```markdown
# <id> — portado desde <repo>/providers/<archivo>.js

- Origen: <repo del tercero> (autor <autor>)
- Sitio: <dominio>
- Cambios vs el original: <axios→fetch, helpers inlineados, filtro latino/sub, …>
- Verificación QuickJS:

\`\`\`bash
$ node tools/qjs-correr.mjs providers/<id>.js 693134 movie
\`\`\`
\`\`\`json
<salida real recortada>
\`\`\`
```

## Cabecera obligatoria en `src/<id>/index.js`

```js
// <id> — <Nombre> (<dominio>).
// Portado a MasterScrap desde <repo del tercero> (providers/<archivo>.js), autor original <autor>.
// Adaptado a QuickJS (sin Buffer/require('crypto')/matchAll/normalize) y filtrado a
// español latino y subtitulado: se descartan los streams de español de España.
```
