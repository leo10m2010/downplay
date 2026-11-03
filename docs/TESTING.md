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
node tests/mobile_input_test.mjs
node tests/gamepads_test.mjs
node tests/audio_ring_test.mjs
node tests/quality_test.mjs
node tests/load_progress_test.mjs
node tests/cache_queue_test.mjs
node tests/release_modules_test.mjs
```

`tests/browser_network_test.mjs` necesita primero compilar el cliente con
`python3 tools/build_browser_network.py`. La prueba utiliza el cliente C original,
incluidos mensajes, selección, puestos y tramas binarias.

## Navegador y pruebas prolongadas

Los escenarios `web_*.js` se ejecutan mediante Playwright CLI (`run-code --filename`).
Los puertos indicados dentro de cada escenario identifican el servidor candidato
y la instalación anterior de referencia. No deben apuntar a un servidor público
ajeno ni a partidas de otros usuarios.

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
aislados. En uno usa los FPS reales; en otro inyecta 12 FPS únicamente como
entrada al controlador de calidad. Comprueba que la resolución del renderizador
real baja de x4 a x1 y que la simulación continúa. No es una medición de un equipo
que realmente funcione a 12 FPS ni demuestra corregido el rendimiento de Brave.
El controlador reduce también en menús, responde en pocos segundos a una carga
grave sostenida y solo recupera resolución tras rendimiento estable en carrera.

`web_mobile_check.js` usa el servidor candidato en 8096 y Chrome con pantalla
390×844 / 844×390 y entrada táctil mediante CDP. Ejecuta el núcleo real, verifica
los 16 botones, tres dedos simultáneos, cancelación, mezcla con teclado, dirección
al deslizar, pantalla completa y entrada a carrera. No mide una GPU móvil ni
acredita compatibilidad con Android/Brave físicos. Para repetirlo, inicia
`python3 tools/run_linux_host.py --config host.json --port 8096` y ejecútalo con
Playwright CLI mediante `run-code --filename tests/web_mobile_check.js`.

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
