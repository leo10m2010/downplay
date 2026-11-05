# Comprobaciones de la versión web

Las pruebas de archivos y almacenamiento usan datos sintéticos en contextos
aislados; no reemplazan guardados del usuario. Las pruebas de conducción y red
ejecutan el núcleo real con los recursos privados preparados.

## Comprobaciones automáticas

Instalar `tools/requirements.txt` para las pruebas de extracción. El servidor
preparado utiliza únicamente la biblioteca estándar de Python.

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/keyboard_bindings_test.mjs
node tests/text_input_test.mjs
node tests/mobile_input_test.mjs
node tests/gpu_probe_test.mjs
node tests/gamepads_test.mjs
node tests/audio_ring_test.mjs
node tests/quality_test.mjs
node tests/load_progress_test.mjs
node tests/cache_queue_test.mjs
node tests/cached_reads_test.mjs
node tests/release_modules_test.mjs
```

`tests/browser_network_test.mjs` necesita primero compilar el cliente con
`python3 tools/build_browser_network.py`. La prueba utiliza el cliente C original,
incluidos mensajes, selección, puestos y tramas binarias.

Con el Worker local en 8788 y el servidor de recursos candidato en 8096:

```sh
node tests/relay_legacy_test.mjs
DHD_TEST_RELAY=ws://127.0.0.1:8788/v2 node tests/relay_integration_test.mjs
```

El segundo usa el cliente C real de protocolo 2. Para probar el Worker publicado,
cambia la variable por `wss://downhill-web-relay.dowh.workers.dev/v2`; el test
antiguo usa la misma variable sin `/v2` y no toca salas ajenas.

## Navegador y pruebas prolongadas

Los escenarios `web_*.js` se ejecutan mediante Playwright CLI (`run-code --filename`).
Los puertos indicados dentro de cada escenario identifican el servidor candidato
y la instalación anterior de referencia. No deben apuntar a un servidor público
ajeno ni a partidas de otros usuarios.

`web_online_matrix_check.js` comprueba 2/3/4 núcleos reales, puestos distintos,
estados intercambiados y salida del anfitrión. Utiliza 8096 y el Worker local en
8788, sustituyendo solo la configuración de salas en su contexto aislado.

`web_ingame_online_check.js` abre ONLINE desde el menú original con el servidor
candidato en 8096. Reproduce el camino que fallaba, edita y confirma el nombre,
escribe un código, cancela y comprueba que el motor sigue avanzando. Instrumenta
solo lecturas de estado para observar los menús; no reemplaza el núcleo ni envía
el código de prueba a una sala ajena.

`web_gamepad_check.js` utiliza el candidato en 8096 y entradas sintéticas de la
Gamepad API. Instrumenta únicamente las lecturas del mando en un contexto de
prueba: verifica los bytes que recibe el núcleo, las direcciones de menú y la
conservación de los cuatro ejes analógicos en carrera. No equivale a probar un
DualSense, DualShock, Xbox o mando genérico físico. La asignación estándar sigue
el [orden de ejes y botones de W3C](https://www.w3.org/TR/gamepad/#remapping);
no se adivina la distribución de un dispositivo sin asignación reconocida.

`web_audio_clock_check.js` compara 0.7.2 en 8097 y 0.7.9 en 8096 con una pausa
inyectada de 24 ms por fotograma. Verifica la cantidad de audio producido por
segundo real y mide cortes después de 10 segundos de calentamiento. La copia
anterior debe estar íntegra, con sus adaptadores y módulo de red correspondientes;
no mezclar módulos de versiones distintas para preparar la referencia.

- Guardados: importación real al IndexedDB, compatibilidad VFS, otra tarjeta,
  detención entre pestañas y error de cuota provocado durante una escritura.
- Caché: persistencia, límite, expulsión y detección de un bloque alterado.
- Compatibilidad: ausencia de GPU, aislamiento y JSPI antes de descargar el núcleo.
- Carga: cinco pares de primera visita/repetición por versión, alternando el orden.
- Recuperación: `web_resource_recovery_check.js`, cinco inicios reales por
  condición (retraso de bloques, corte y corrupción), en contextos aislados.
- Red: 2, 3 y 4 clientes reales; no empezar con menos jugadores de los elegidos.
- Sesiones: 60 minutos individual y 30 minutos online, con muestras limitadas y
  medición de avance de campos, memoria, cola de audio y registros.

`web_quality_pressure_check.js` ejecuta los menús reales en dos contextos
aislados, usando el servidor candidato en 8096. En uno usa los FPS reales; en
otro inyecta 12 FPS únicamente en el dato de presentación, manteniendo el avance
real de la simulación. Comprueba que la resolución del renderizador
real baja de x4 a x1 y que la simulación continúa. No es una medición de un equipo
que realmente funcione a 12 FPS ni demuestra corregido el rendimiento de Brave.
El controlador reduce también en menús, responde en pocos segundos a una carga
grave sostenida y solo recupera resolución tras rendimiento estable en carrera.
El modo automático queda limitado a x2 y recuerda en la sesión qué resolución
falló, para evitar volver repetidamente a ese nivel.

`web_performance_check.js` compara una copia previa en 8097 con el candidato en
8096. Usa la misma carrera, pide 144 Hz y recoge diez muestras por versión después
de doce segundos de calentamiento. Comprueba que el candidato aplica el límite
de 60 Hz, mantiene presentación y usa tanto lecturas directas como asíncronas.
En la comprobación local se midieron 59,95 Hz de mediana y 416 lecturas de RAM sin
suspensión frente a 48 lecturas asíncronas. La versión previa ya alcanzaba 144 Hz
en ese PC: esto acredita reducción de trabajo y ausencia de fallos observados,
no una mejora de FPS en el PC lento del usuario ni una medición prolongada.

`web_mobile_check.js` usa el servidor candidato en 8096 y Chrome con pantalla
390×844 / 844×390 y entrada táctil mediante CDP. Ejecuta el núcleo real, verifica
los 16 botones, tres dedos simultáneos, cancelación, mezcla con teclado, dirección
al deslizar, pantalla completa y entrada a carrera. No mide una GPU móvil ni
acredita compatibilidad con Android/Brave físicos. Para repetirlo, inicia
`python3 tools/run_linux_host.py --config host.json --port 8096` y ejecútalo con
Playwright CLI mediante `run-code --filename tests/web_mobile_check.js`.

`web_gpu_probe_check.js` comprueba en Chrome la compilación de una operación CAS
y el arranque real. En otro contexto inyecta el error Metal comunicado por el
iPhone: la página debe explicarlo antes de descargar `dhd_core.wasm` o crear el
trabajador del juego. La prueba no acredita una corrección del compilador de iOS.

Investigación del fallo Metal (4/11/2026): usuario con iPhone 15 Pro Max,
iOS 27.0.1, mismo resultado en Safari y Chrome. El diagnóstico coincide con
el helper de WebKit anterior a `4f56cc248e8a2e447f77d54d7612d2a6128daccb`:
su retorno deducía el tipo con `decltype(compare)`, incluyendo un calificador
de espacio de direcciones inválido para un campo. El cambio del 13/9/2026 usa
el parámetro de tipo `S`. Comparación comprobada con los archivos de esa revisión
y su padre mediante la API oficial; no prueba qué compilación trae un iPhone.
[Cambio original](https://github.com/WebKit/WebKit/commit/4f56cc248e8a2e447f77d54d7612d2a6128daccb).

Apple lista iOS 27.2, publicado el 26/10/2026 y compatible con iPhone 11 y
posteriores. Probar la actualización estable desde Ajustes → General →
Actualización de software y repetir la comprobación. No está verificada aquí
la inclusión del parche en esa distribución ni el juego en un iPhone físico.
[Versiones oficiales](https://support.apple.com/en-us/100100).

Otros motores, como Three.js, mantienen una ruta WebGL 2 de respaldo. El
renderizador de este juego solicita explícitamente WebGPU y sus pipelines de
rasterizado usan compute y CAS sobre píxeles empaquetados. WebGL 2 no ofrece
compute; cambiar una opción no crea ese respaldo. Reemplazar CAS por una escritura
simple perdería la protección de palabras compartidas. Se conserva el algoritmo
correcto y el bloqueo previo al arranque cuando falla la operación requerida.
[Three.js](https://threejs.org/docs/pages/WebGPURenderer.html),
[límites de wgpu](https://docs.rs/wgpu/latest/wgpu/struct.DownlevelFlags.html#associatedconstant.COMPUTE_SHADERS).

El registro se puede abrir aunque falle el preflight, y conserva el principio y
el final del mensaje del compilador dentro de 32 KiB. La prueba inyectada verificó
que se ve el error y no se descarga el núcleo. Esto mejora el diagnóstico;
no corrige el compilador Metal del dispositivo.

Varias instancias en un mismo PC sirven para comprobar integración y carga, pero
no acreditan una partida entre equipos y conexiones diferentes. El rendimiento
medido con varias instancias simultáneas no representa el rendimiento de un
jugador en su propio equipo.

`tools/run_browser_soak.py` mantiene la sesión y guarda un informe cada veinte
segundos. Si desaparece un cliente, se detienen los campos del motor o se excede
el límite del registro, deja un error verificable en el informe. No basta dejar
abierta una pestaña y suponer que una hora transcurrida acredita estabilidad.

## Validación física antes de abrir la web

1. Probar Chrome y Edge con el hostname final y un mando físico.
2. Completar carreras entre 2, 3 y 4 equipos en redes distintas.
3. Desconectar anfitrión e invitado en sala, carga y carrera; comprobar los mensajes.
4. Probar audio después de cambiar de pestaña y de dispositivo de salida.
5. Reiniciar Linux y comprobar los dos servicios y la misma dirección HTTPS.
6. Exportar una partida desde la dirección anterior y restaurarla en el dominio.
7. Confirmar Access desde una sesión sin autenticar: no deben entregarse recursos.

Los resultados y límites de la entrega están en RELEASE.md. No se marcan pruebas
físicas como realizadas mediante una simulación de API o varias pestañas locales.
