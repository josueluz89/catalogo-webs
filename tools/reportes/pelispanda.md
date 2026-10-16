# pelispanda — portado desde adrianjael/pluggin-latino (providers/pelispanda.js) + latinuvio

- Sitio: pelispanda.org
- Cambios vs el original: adaptado a QuickJS (sin Buffer, sin require('crypto'/'https'), sin
  matchAll ni String.normalize; helpers hermanos inlineados), `axios` → `fetch`, cripto con
  crypto-js empaquetado, y **filtro final a español latino y subtitulado** (se descartan
  `Esp`/`Castellano`/`SPA`/`dual`). Mismo motor Player+ que hackstore (axios→fetch). API wpreact del sitio para buscar. Streams Latino (Vimeos, VOE, StreamWish, Videoapp).

## Verificación (QuickJS real)

```bash
$ node build.js pelispanda
$ node tools/qjs-correr.mjs providers/pelispanda.js 693134 movie
$ node tools/qjs-correr.mjs providers/pelispanda.js 76479 tv 3 1
```

Streams medidos: **693134 movie → 2 · 76479 tv 3 1 → 4**, todos con `language` `Latino` o `Subtitulado`, cero castellano.
