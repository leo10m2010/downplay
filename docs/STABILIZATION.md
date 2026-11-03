# Estabilización de la versión final

Objetivos: una versión activa, restauración segura, salas de 2/3/4, lectura
progresiva y caché limitada, audio medido, dominio fijo y actualizaciones pequeñas.

La copia inicial de fuentes y el inventario de archivos retirados se conservan
fuera del árbol activo en `downhill-archive`. Los recursos privados, las ISOs,
las credenciales y el historial Git se protegen expresamente.

El producto sirve recursos desde Linux y ejecuta la simulación en cada navegador.
Cloudflare Tunnel publica el hostname y Access controla la entrada; el Worker
existente mantiene las salas. No se utiliza un servidor de vídeo del juego.

La restauración valida la copia y guarda una versión anterior; cualquier fallo
aborta la transacción. Los lectores del motor se coordinan entre pestañas mediante
Web Locks y BroadcastChannel. La caché de recursos puede fallar sin impedir jugar.

La descarga distingue bytes, compilación, memoria y primer menú/pista. Conserva
48 MiB de bloques en RAM y 128 MiB en IndexedDB. La cola de escritura está limitada
a dos bloques y las peticiones de demanda tienen prioridad sobre la precarga.

Las entregas identifican aplicación, núcleo y recursos. Los diferenciales excluyen
datos del juego y configuración mutable; verifican hashes antes de activarse y
guardan un diario para recuperar interrupciones.

RELEASE.md contiene los resultados efectivamente medidos y los pasos externos que
todavía necesitan el equipo Linux, permisos de Cloudflare o jugadores remotos.
