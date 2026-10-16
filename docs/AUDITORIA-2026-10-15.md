# Auditoría de providers de terceros — 2026-10-15

Comparación de los manifiestos de terceros contra lo nuestro, y prueba real de cada provider.
Herramientas: `tools/auditoria/` (corrida en Node con shims de `axios`/`cheerio`/`crypto-js`/hermanos)
y `tools/qjs-correr.mjs` (QuickJS real, el runtime de la app).

| manifiesto externo | versión | entradas |
|---|---|---|
| `adrianjael/pluggin-latino` (AdrianJael) | Nuvio Latino v13.0.1 | 17 |
| `KennethJYS/Nuvio-Providers-Latino` (KennethJYS) | Latino Providers v2.0.0 | 10 |
| `latinokodi/latinuvio-V2` (latino kodi) | Latinuvio V2 v1.0.1 | 25 |

Fuentes descargadas y conservadas en `tools/fuentes-terceros/` para poder re-portar o comparar sin
depender de internet. Regla de descarte: **muerto = DNS NXDOMAIN** (un `403`/`000` de curl no
significa muerto: Cloudflare le contesta eso a la shell y el sitio funciona en la app).

## 1. Sirven (devuelven streams y los enlaces responden)

| provider | streams medidos | idiomas que trae | enlaces responden |
|---|---|---|---|
| `monoschinos` | 8 | anime (DUB/SUB) | sí |
| `pelispanda` | 6 | latino | sí |
| `hackstore` | 6 | latino | sí |
| `areshd` | 6 | latino, spa, sub | sí |
| `animeav1` | 6 | anime (DUB/SUB) | sí |
| `cinemitas` | 4 | latino, castellano | sí |
| `megadedeoficial` | 4 | latino, spa, sub | sí |
| `allpeliculasse` | 4 | latino | sí |
| `entrepeliculasyseries` | 4 | latino, spa, sub | sí |
| `elifilms` | 3 | latino | sí |
| `vimeus` | 2 | latino | sí |
| `henaojara` | 2 | anime (DUB/SUB) | sí |

- Medido con `tools/auditoria/prueba.mjs` (Dune: Part Two 693134 y The Boys 76479 S3E1) y sondeo de
  cada enlace con sus headers (`m3u8` = `application/vnd.apple.mpegurl`).
- `pelis182` no aparece arriba porque dio **0 en película**: sirve **series** (Breaking Bad 1396 →
  1 stream latino). Se porta igual, con esa limitación anotada.
- `cinemitas` trae LATINO y CASTELLANO; `areshd`, `entrepeliculasyseries` y `megadedeoficial` traen
  Lat + Esp + Sub: en el port se filtran y quedan solo latino/sub.
- Los de anime (`animeav1`, `monoschinos`, `henaojara`) marcan el idioma en el título: `DUB` =
  latino, sin marca = subtitulado.

## 2. Muertos (no se portan)

| provider | de | dominio | evidencia |
|---|---|---|---|
| `playhubmax` | adrian | `playhubmax.com` | DNS NXDOMAIN (playhubmax.com y api.playhubmax.com) |
| `brazucaplay` | adrian | `api2.videasy.net` | DNS NXDOMAIN — backend de BrazucaPlay |
| `cuevanaubd` | adrian | `cuevana.unbuendato.com` | DNS NXDOMAIN + su manifest apunta a providers/cuevanaubd.js (404) |
| `zoowomaniacos` | kenneth | `projetox.yoyatengoabuela.com` | DNS NXDOMAIN — único backend de Zoowomaniacos |
| `peliculasflix` | latinuvio | `peliculasflix.co` | DNS NXDOMAIN |

## 3. Ya cubiertos (no se portan: los sirve un provider nuestro)

| provider | de | dominio | lo cubre |
|---|---|---|---|
| `embed69` | adrian | `embed69.org` | es nuestro providers/embed69.js |
| `pelisplus` | adrian | `pelisplushd.la` | misma familia PelisPlusHD que nuestro pelisplus/pelisplusto |
| `cinecalidad` | adrian | `cinecalidad.vg` | es nuestro cinecalidad_kl (apagado 2026-09-23); el sitio volvió a responder 200 hoy → revisar reactivar antes que portar |
| `seriesmetro` | adrian | `seriesmetro.net` | es el sitio de nuestro seriesmetro / seriesmetro_kl |
| `xupalace` | adrian | `xupalace.org` | 301 → embed69.org; providers/embed69.js ya trae el parser legacy de xupalace |
| `fuegocine` | adrian | `fuegocine.com` | providers/fuegocine.js |
| `tioplus` | adrian | `tioplus.app` | providers/tioplus.js |
| `lamovie` | adrian | `lamovie.cc` | providers/lamovie.js (mismo sitio que lamovie.org) |
| `cinecalidad` | kenneth | `cinecalidad.vg` | es nuestro cinecalidad_kl (apagado 2026-09-23); el sitio volvió a responder 200 hoy → revisar reactivar antes que portar |
| `embed69` | kenneth | `embed69.org` | es nuestro providers/embed69.js |
| `xupalace` | kenneth | `xupalace.org` | 301 → embed69.org; providers/embed69.js ya trae el parser legacy de xupalace |
| `seriesmetro` | kenneth | `seriesmetro.net` | es el sitio de nuestro seriesmetro / seriesmetro_kl |
| `peliserieshoy` | kenneth | `player.pelisserieshoy.com` | mismo backend que sololatino.net (bundle Player+); se cubre con el port de sololatino |
| `seriesflix` | kenneth | `seriesflixhd.best` | nuestro seriesflix apunta a seriesflixhd.team (mismo sitio, otro TLD) |
| `detodopeliculas` | kenneth | `detodopeliculas.nu` | ya lo tenemos apagado y el sitio sigue en 503 |
| `lamovie` | kenneth | `lamovie.cc` | providers/lamovie.js (mismo sitio que lamovie.org) |
| `embed69` | latinuvio | `embed69.org` | es nuestro providers/embed69.js |
| `pelisplus` | latinuvio | `pelisplushd.la` | misma familia PelisPlusHD que nuestro pelisplus/pelisplusto |
| `cinecalidad` | latinuvio | `cinecalidad.vg` | es nuestro cinecalidad_kl (apagado 2026-09-23); el sitio volvió a responder 200 hoy → revisar reactivar antes que portar |
| `fuegocine` | latinuvio | `fuegocine.com` | providers/fuegocine.js |
| `tioplus` | latinuvio | `tioplus.app` | providers/tioplus.js |
| `lamovie` | latinuvio | `lamovie.org` | es el sitio de nuestro lamovie |
| `pelisplushdnz` | latinuvio | `pelisplushd.bz` | es el sitio de nuestro pelisplusto |
| `seriesmetro` | latinuvio | `seriesmetro.net` | es el sitio de nuestro seriesmetro / seriesmetro_kl |

## 4. Descartados con medición (vivos o no, no dan nada útil)

| provider | medido |
|---|---|
| `sololatino` (Adrian) | 0 streams en película y en serie (bundle Player+) |
| `pelisgo` (Adrian) | 0 streams en película y en serie |
| `cinemacity` (Adrian) | el sitio responde 403 (Cloudflare) a todo |
| `videasy` (Adrian) | su API no responde: timeout 75 s y 118 s; la otra mitad de sus fuentes usa `api2.videasy.net`, que ya no existe |
| `verpelis` (latinuvio) | busca bien pero no matchea títulos (ni película ni serie) |
| `pelisyseries` (latinuvio) | su buscador devuelve "Duna: Parte dos" y no lo reconoce |
| `doramasflix` (latinuvio) | 0 streams; su API `user-api.seriesapi.co` responde 503 |

## 5. Faltantes que sí valen (referencia)

| provider | de | dominio |
|---|---|---|
| `SoloLatino` | adrian | `sololatino.net` |
| `PelisGo` | adrian | `pelisgo.online` |
| `HackStore` | adrian | `hackstore2.com` |
| `PelisPanda` | adrian | `pelispanda.org` |
| `CinemaCity` | adrian | `cinemacity.cc` |
| `VidEasy Latino` | adrian | `api.videasy.net` |
| `HackStore` | kenneth | `hackstore2.com` |
| `HackStore` | latinuvio | `hackstore2.com` |
| `PelisPanda` | latinuvio | `pelispanda.org` |
| `Vimeus` | latinuvio | `vimeus.com` |
| `AresHD` | latinuvio | `areshd.com` |
| `Cinemitas` | latinuvio | `cinemitas.org` |
| `DoramasFlix` | latinuvio | `doramasflix.in` |
| `VerPelis` | latinuvio | `verpelis.gratis` |
| `AllpeliculasSE` | latinuvio | `allpeliculas.la` |
| `EliFilms` | latinuvio | `allcalidad.re` |
| `EntrePeliculasySeries` | latinuvio | `entrepeliculasyseries.nz` |
| `MegaDedeOficial` | latinuvio | `megadede.mobi` |
| `Pelis182` | latinuvio | `pelis182.net` |
| `AnimeAV1` | latinuvio | `animeav1.com` |
| `Henaojara` | latinuvio | `ww1.henaojara.net` |
| `PelisySeries` | latinuvio | `www2.pelisyseries.net` |
| `MonosChinos` | latinuvio | `vww.monoschinos2.net` |

## Cómo se reprodujo

```bash
cd "/c/Users/josue/OneDrive/Documentos/scraperstv-providers"
node tools/auditoria/prueba.mjs                      # corre los terceros y mide idiomas + sondea enlaces
node tools/auditoria/prueba.mjs --casos=todos <ids>  # con series y doramas
node tools/qjs-correr.mjs providers/<id>.js 693134 movie   # un provider ya portado, en QuickJS real
```

## 6. Portados y verificados (12)

| provider | Película (Dune 2) | Serie (The Boys S3E1) | Anime | Español de España |
|---|---|---|---|---|
| `allpeliculasse` | 1 | 3 | — | 0 |
| `elifilms` | 1 | 3 | — | 0 |
| `megadedeoficial` | 4 | 2 | — | 0 |
| `entrepeliculasyseries` | 4 | 2 | — | 0 |
| `vimeus` | 1 | 1 | — | 0 |
| `cinemitas` | 1 | 1 | — | 0 |
| `pelispanda` | 2 | 4 | — | 0 |
| `hackstore2` | 2 | 4 | — | 0 |
| `pelis182` | 0 | 1 (en Breaking Bad) | — | 0 |
| `animeav1` | 0 | 0 | 8 (tv) / 5 (película) | 0 |
| `monoschinos` | 0 | 0 | 2 (tv) | 0 |
| `henaojara` | 0 | 1 | 4 (tv) | 0 |

Medido con `node tools/qjs-correr.mjs` (QuickJS real) y `tools/verificar-lote.mjs`; el JSON de la
última corrida queda en `tools/auditoria/verificacion-*.json`.

**Descartado en el port:** `areshd` (latinuvio). Resolvía 4 streams y luego la promesa no volvía
nunca en QuickJS (>70 s): sin poder verificarlo, no entra. Sus fuentes siguen en
`tools/fuentes-terceros/latinuvio/areshd.js` por si se retoma.
