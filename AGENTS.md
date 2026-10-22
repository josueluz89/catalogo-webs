# AGENTS.md — catalogo-webs: forma de trabajar

Este repo es de providers tipo Nuvio/ScraperTV: cada provider exporta
`getStreams(tmdbId, mediaType, season, episode)` y corre en QuickJS.
La app solo usa los `enabled: true` del `manifest.json`.
Estas reglas salieron del trabajo real del 2026-10-22 y son obligatorias
para los próximos trabajos. No se improvisan atajos fuera de ellas.

## 0. Regla madre

- Todo el trabajo se hace en la máquina de Muse, 100 % local.
  NUNCA en el VPS del usuario y NUNCA en su PC.
- GitHub es respaldo pasivo. Antes de cada push, preguntar
  «¿lo subo?» y esperar el sí explícito. Sin sí, no hay push.
- El provider `masters` queda APAGADO siempre (el usuario ya lo tiene).
  No se repara, no se enciende, no se recrea si se borra algo.
- No se borra ningún provider, link ni archivo sin orden explícita
  del usuario. Si la orden de borrar es ambigua, confirmar el alcance
  exacto antes de actuar (qué provider, dónde, hasta dónde).
- No se inventa ningún dominio, endpoint, slug ni parser sin
  verificarlo primero con el arnés contra el sitio real.

## 1. Seguridad: estos sitios traen riesgo

- El usuario advirtió que estas páginas traen un troyano de alguna
  página. NUNCA abrir ninguna de estas páginas en un navegador.
- La prueba solo baja TEXTO con `curl` (HTML/JSON) y el código del
  provider corre en QuickJS, sin archivos ni otros programas.
- Antes de correr nada: escaneo estático de `providers/*.js` y
  `src/<id>/`. No debe haber URLs de descarga de
  `.exe/.apk/.msi/.dmg/.zip/.rar`. Los `eval` deben ser comentarios
  o `.exec` de regex, y un dominio tipo `vimeos.zip` no es un archivo.
- Nunca descargar ni ejecutar binarios ni drivers de sitios raros.
  Dependencias solo de npm oficial. Nunca meter secretos, tokens ni
  claves en la máquina de prueba ni en archivos ni en memoria.

## 2. Procedimiento de prueba: carpeta desechable bajo llave

Docker NO está en la máquina de Muse. La forma aprobada es:

1. Copiar el repo en una carpeta desechable (no se trabaja sobre el
   clon principal para probar).
2. La prueba corre bajo llave: usuario `nobody`, `HOME`/`TMPDIR`
   dentro de la carpeta, `PATH` limitado a `node` + `curl`, mount
   namespace que oculta `/home` y `/root`, sin secretos adentro.
   En la práctica: `unshare -m` + `setpriv --reuid=nobody
   --regid=nogroup --clear-groups` + `env -i` con las variables de
   proxy/SSL del host (sin ellas, `curl` falla con error SSL y la
   prueba entera da cero falso).
3. Verificar la caja antes de usarla: uid 65534, `/home` y `/root`
   vacíos adentro, archivos del usuario inaccesibles.
4. Al terminar TODO el trabajo (y solo entonces, porque el trabajo
   en curso necesita la carpeta): borrar la carpeta desechable, el
   clon, los logs y los scripts, y confirmarle al usuario que no
   queda nada. La limpieza no se hace antes de entregar resultados.

## 3. Regla de búsqueda: como busca la app Nuvio

- `getStreams` solo recibe `tmdbId`, `mediaType`, `season` y
  `episode`. NADA más: sin título, sin año, sin ningún argumento
  extra desde fuera.
- El provider resuelve el título por su cuenta vía TMDB (sección 4).
- La herramienta vieja `tools/auditoria/prueba.mjs` reintenta con
  título/año: ESO NO ES comportamiento Nuvio. No se usa ni se
  propone usarlo. El arnés válido es `tools/qjs-correr.mjs` con los
  4 argumentos, y `tools/verificar-lote.mjs` para lotes.

## 4. Referencias TMDB: usar muchas, no una sola

Un solo título de un solo idioma es la causa más común de fallos
falsos (ejemplo real: TMDB es-ES da «Dune» pero el sitio usa el slug
«duna»; otro: buscar «parte» entierra el post entre 16 resultados).
Por eso el provider debe apoyarse en TODAS estas referencias de TMDB,
en este orden de preferencia, y no depender de una sola:

1. **Ficha por ID** (siempre el punto de partida, nunca una búsqueda
   por texto como primer intento):
   `GET /3/movie/{tmdbId}` y `GET /3/tv/{tmdbId}`, con
   `language=es-MX`, `es-ES` y `en-US` en paralelo (las 3 llamadas
   con `Promise.all`, cada una tolerando fallo sin tumbar el resto).
2. **Títulos candidatos, en este orden**: título `es-MX` primero
   (los sitios latinos usan ese slug), luego `es-ES`, luego
   `en-US`, luego `original_title` / `original_name`.
3. **Títulos alternativos**: `GET /3/movie/{id}/alternative_titles`
   y `GET /3/tv/{id}/alternative_titles` (campo `titles[]` con
   `iso_3166_1` y `title`). Sirven cuando el título principal no
   casa con el catálogo del sitio.
4. **Traducciones**: `GET /3/movie/{id}/translations` y
   `GET /3/tv/{id}/translations` (campo `data.title`) como respaldo
   si los títulos anteriores no dan coincidencia.
5. **IDs externos**: `GET /3/movie/{id}/external_ids` y
   `GET /3/tv/{id}/external_ids` para sacar `imdb_id` (los sitios
   tipo vidurl indexan por `tt...`, no por título).
6. **Búsqueda en la API del sitio**: cuando la API del sitio lo
   permite, buscar y filtrar por `tmdb_id` exacto, no quedarse con
   el primer resultado del tipo (eso devuelve títulos ajenos).
   Si la API trae N resultados por página, probar las palabras del
   título localizado en orden y parar solo con coincidencia exacta;
   las palabras genéricas («parte», «dune» sin más) entierran el post.
7. **Slugs**: construir los candidatos prefiriendo el título es-MX
   (ejemplo: «Duna: Parte dos» → `duna-parte-dos`) antes que el
   es-ES. Si el slug falla, rescatar con la búsqueda del sitio,
   no con otro slug inventado.
8. **Series**: título de la serie por TMDB + episodio por la API del
   sitio (temporada/episodio vienen en los 4 argumentos, no se
   inventan). Para anime, usar también los títulos alternativos de
   TMDB (romaji/inglés) porque los sitios de anime indexan distinto.

Regla de oro: si un título no casa, se agregan más referencias TMDB
de la lista de arriba; nunca se pide título o año desde fuera ni se
fija un slug a mano sin verificarlo.

## 5. Reglas de arreglo: reescribir, no parchar

- **Lo que está mal se escribe de nuevo, limpio, desde cero.** No
  se parcha encima de código roto ni se le amontona código encima
  (ni condicionales, ni atajos, ni validaciones para tapar el fallo).
- Los ajustes de velocidad NO son parches y van aparte: paralelizar
  con `Promise.all` y concurrencia acotada (3–4), recortar espejos
  (StreamWish de 9 a 2–3 + original), parada temprana por idioma
  (1 Latino + 1 Subtitulado y se corta), y descartar de entrada
  hosts muertos conocidos (voe con gate ALTCHA, filemoon sin datos,
  goodstream 522, cáscaras SPA de 452 bytes tipo `Loading...`).
- **Validación**: la validación estricta (`withWorkingStreams`) borra
  streams buenos cuando el CDN da 403 a la sonda pero el reproductor
  sí abre el enlace. En ese caso, validación fail-open: si la sonda
  mata todo lo resuelto, se devuelve lo resuelto sin filtrar.
  No se re-baja un m3u8 solo para verificarlo si la resolución ya
  es la prueba (página del reproductor viva con token vigente).
- **Salida**: solo medio directo (URL con `.m3u8` o `.mp4`). Nunca
  devolver como stream una página de embed (videoapp y similares).
- **Idioma (portero compartido al final)**: el filtro se fija en
  la etiqueta de idioma que trae cada enlace. Pasan: Latino
  (incluye es_MX, lat, México), Subtitulado, Inglés y Japonés.
  Se botan: castellano, es_ES y «Español» a secas (en estas
  páginas es el de España), y cualquier otro idioma. Sin
  etiqueta, pasa: mejor no botar un enlace bueno por falta de
  papel. Algunos providers descartan el castellano desde la
  página antes de resolver; la garantía final es el portero.
  El orden importa: no probar primero los de España ni rendirse
  antes de llegar a los subtitulados buenos.
- **Presupuesto**: subir `PRESUPUESTO_MS` a 55000 donde haga falta
  y darle presupuesto propio al PoW después de la página vidurl
  (el presupuesto global lo mataba en el nonce 0). Ojo: en el arnés
  los timeouts del código NO existen (el fetch es `curl -m 45` y el
  `AbortController` se ignora); la garantía real es menos trabajo,
  no un tope más corto.
- Después de cada arreglo: `node build.js <id>` y verificar (sección 6).
  Los `providers/<id>.js` son salida del build, no se editan a mano.
- Si un sitio está muerto de verdad (dominio mudado sin catálogo
  buscable, player 500 persistente), se dice así, sin arreglo falso
  y sin inventar endpoints. El provider queda apagado.

## 6. Verificación: solo primero, lote chico después

1. **Solo primero**, con `tools/qjs-correr.mjs` y los 4 argumentos
   Nuvio, en la caja bajo llave. Casos: ver
   `docs/REFERENCIAS-PRUEBA.md` (las cuatro fijas de siempre, las
   extendidas para variar y para terrenos concretos, y siempre un
   título del terreno del sitio).
2. **Después, lote chico** (≤4 en paralelo, `LIMITE_MS=180000`).
   Un «sin JSON» en un lote grande (14–17 en paralelo) es sospecha
   de timeout/contención, NO diagnóstico de muerte: los providers
   verificados en solitario pueden dar 0 en lote grande por
   contención de CPU/red y presupuestos agotados.
3. **Criterio de «funciona»**: `ok: true`, ≥1 stream real
   (m3u8/mp4, no páginas de embed), sin etiquetas de España, y
   tiempo en solitario claramente por debajo de 60 s (el tope de
   la app). Si un caso sigue en 0 en solitario, se dice tal cual
   con el motivo; no se declara arreglado lo que no está verificado.
4. La prueba final siempre es la del usuario en su red: la caja de
   prueba está en un datacenter de EEUU y algunos 403/timeouts (y
   los CDN que no responden desde la caja) pueden funcionar desde
   Costa Rica.

## 7. Repo y entregables

- `manifest.json` manda: la app solo usa los `enabled: true`.
  Cambiar `enabled` solo con orden del usuario o tras verificar
  ≥1 stream real (y aun así, avisarle antes).
- No se toca `masters` (sección 0) ni se recrean providers borrados
  por orden del usuario.
- Los informes de diagnóstico/arreglo van en un archivo por grupo
  (qué se tocó, streams y tiempos antes/después, veredicto honesto),
  y el resumen final para el usuario lleva números, no adjetivos:
  streams por caso, tiempos, y qué quedó sin arreglo y por qué.
- `package.json`/`package-lock.json` no se tocan para el arnés: las
  dependencias de prueba (`quickjs-emscripten`) se instalan aparte
  y se restauran antes de cualquier push. El push lleva solo código
  de providers, `src/`, `manifest.json` y documentación.
