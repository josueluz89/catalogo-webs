# hackstore2 — portado desde adrianjael/pluggin-latino (providers/hackstore2.js) + latinuvio (mismo sitio)

- Sitio: hackstore2.com
- Cambios vs el original: adaptado a QuickJS (sin Buffer, sin require('crypto'/'https'), sin
  matchAll ni String.normalize; helpers hermanos inlineados), `axios` → `fetch`, cripto con
  crypto-js empaquetado, y **filtro final a español latino y subtitulado** (se descartan
  `Esp`/`Castellano`/`SPA`/`dual`). Bundle de esbuild: se cambió require('axios') por fetch y se portó el descifrado a crypto-js empaquetado. Streams Latino (Vimeos, StreamWish, VOE).

## Verificación (QuickJS real)

```bash
$ node build.js hackstore2
$ node tools/qjs-correr.mjs providers/hackstore2.js 693134 movie
$ node tools/qjs-correr.mjs providers/hackstore2.js 76479 tv 3 1
```

Streams medidos: **693134 movie → 2 · 76479 tv 3 1 → 4**, todos con `language` `Latino` o `Subtitulado`, cero castellano.
