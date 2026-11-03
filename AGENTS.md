# Downplay: instrucciones para continuar en el otro equipo

Lee primero `docs/INSTALAR_EN_OTRO_EQUIPO.md`, `DEPLOYMENT.md` y
`docs/RELEASE.md`. El usuario ha pedido instalar esta misma versión en su PC Linux,
sin volver a empaquetar el proyecto ni sustituir el motor.

- Repositorio de traslado: `https://github.com/leo10m2010/downplay.git`, privado.
- Recursos preparados: `private/game-data`; núcleo: `private/runtime`;
  auxiliar de red: `build/network/public`. Los `.data` usan Git LFS.
- No solicitar una ISO para instalar: los recursos ya viajan en este repositorio.
  Las ISOs originales y el SDK están fuera de la carpeta de trabajo de Windows.
- Para ejecutar en Linux se necesita Python 3.11+, Git y Git LFS. No hacen falta
  Node, Emscripten, una GPU en el servidor, emuladores ni un servicio de vídeo.
- El motor se ejecuta en el navegador del jugador. El servidor sirve archivos.
  El cliente requiere WebGPU, JSPI y aislamiento. Chrome/Brave Android tienen
  adaptación táctil experimental (x1 inicial, automático hasta x2); la verificación
  con pantalla/toques móviles en Chrome de escritorio no prueba hardware Android.
- Arranque: `python3 tools/run_linux_host.py --config host.json`.
- Dominio previsto: `jugar.cobbleverse.space`. Worker existente:
  `wss://downhill-web-relay.dowh.workers.dev`. No desplegar otro Worker por defecto.
- DNS/Access/túnel y reinicio del Linux físico siguen pendientes de comprobación.
  No declarar que el dominio funciona solo por tener archivos de configuración.
- Mantener el repositorio privado y los secretos fuera de Git. No escribir tokens
  en comandos, documentación, salida de herramientas o mensajes de chat.
- El usuario confirmó presupuesto Git LFS de 0 USD el 3 de noviembre de 2026.
  Las ejecuciones automáticas de Actions se desactivaron en este repositorio para
  evitar gasto de cómputo. No activar presupuestos ni servicios de pago.
- Evitar descargas LFS repetidas: el juego requiere aproximadamente 2,36 GiB por
  instalación nueva. Comprobar los archivos existentes antes de volver a bajarlos.
- No borrar recursos, guardados, configuración ni historia Git para limpiar.
  No generar paquetes ZIP/tar grandes salvo petición expresa del usuario.
- La compilación integral del núcleo sigue pendiente: usa la revisión conservada
  y no presentes el despliegue como una compilación completa desde fuentes.
- Antes de sustituir una instalación existente, inspeccionar cambios y respaldar
  configuración y guardados. No usar `git reset --hard` ni limpieza indiscriminada.
- Verificar con hechos: identidad de recursos, HTTP, HTTPS/aislamiento, arranque
  del motor y pruebas desde otro equipo. Registrar lo pendiente sin inventar éxito.

Al finalizar, explicar al usuario el resultado en español y de forma breve.
