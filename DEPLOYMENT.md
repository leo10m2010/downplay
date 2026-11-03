# Linux y jugar.cobbleverse.space

## 1. Instalación local

Usa una distribución con systemd, Python 3.11+ y cloudflared actualizado desde
https://developers.cloudflare.com/tunnel/downloads/ . No se necesita Node ni
Emscripten para ejecutar el paquete preparado.

Copia la carpeta del proyecto actual a Linux como tu usuario normal, incluyendo
`private/game-data`, `private/runtime`, `build/network/public` y `host.json`.
También puedes clonar el repositorio privado desde GitHub y ejecutar
`git lfs install --local` y `git lfs pull` para recibir esos mismos archivos.
Las ISOs originales y el SDK compartido no hacen falta para ejecutar el juego.
Desde esa carpeta ejecuta:

```sh
python3 tools/run_linux_host.py --config host.json
```

La dirección local es http://127.0.0.1:8095/ . Detén el lanzador con Ctrl+C antes
de instalar servicios. El proyecto se mantiene como archivos de trabajo;
no necesitas un paquete ZIP para usarlo ni para continuar desarrollándolo.

## 2. Configuración de Cloudflare

`jugar.cobbleverse.space` se conecta al PC Linux mediante Cloudflare Tunnel.
El Worker `downhill-web-relay.dowh.workers.dev` permanece separado y ya está
configurado en `host.json` para las salas. El dominio del juego no tiene que
apuntar a ese Worker. El manual `docs/INSTALAR_EN_OTRO_EQUIPO.md`, sección 4,
muestra ambas rutas y explica qué falta activar.

La sesión de Wrangler disponible durante la preparación permitió consultar la
zona, pero rechazó DNS con HTTP 403. Por ello, DNS/Access no deben considerarse
activados por haber generado estos archivos.

Crea un token de API limitado a la cuenta y a cobbleverse.space con permisos de
edición de Cloudflare Tunnel, DNS y Access (aplicaciones, políticas y proveedores
de identidad). No pegues el token en un chat, archivo del repositorio o comando.
El configurador puede pedirlo de forma oculta:

```sh
python3 tools/configure_cloudflare.py --prompt-token --email TU_CORREO
python3 tools/configure_cloudflare.py --prompt-token --apply --email TU_CORREO
```

El primer comando inspecciona sin modificar. El segundo instala primero Access
con PIN por correo, prepara el túnel administrado y después crea el DNS de
jugar.cobbleverse.space. Añade otros jugadores repitiendo `--email`.
No reemplaza un DNS o una aplicación Access ajenos a su estado de configuración.
La credencial del túnel queda en `private/cloudflared.token`, excluida de Git y
los paquetes. El estado no secreto se guarda en `private/cloudflare-state.json`.

Alternativa manual en el panel: crear un túnel administrado, configurar la ruta
jugar.cobbleverse.space hacia http://localhost:8095, y proteger todo ese hostname
con una aplicación Access de tipo self-hosted y correos permitidos. Conservar el
Worker `downhill-web-relay.dowh.workers.dev` como servicio separado.

## 3. Servicios de Linux

Desde la carpeta del juego, como tu usuario habitual:

```sh
sudo python3 tools/install_linux_host.py --token-file private/cloudflared.token --enable
```

El instalador detecta el usuario que ejecutó sudo, conserva la configuración
existente, guarda la credencial con acceso restringido y prepara dos servicios:
`downhill-web.service` y `downhill-tunnel.service`. El token se entrega al túnel
mediante credenciales de systemd, sin incluirlo en la línea del proceso.

```sh
systemctl status downhill-web downhill-tunnel
journalctl --namespace=downhill-web -u downhill-web -u downhill-tunnel --since today
```

Los registros de estos servicios tienen un espacio separado, limitado a 64 MiB
en disco y 16 MiB en memoria, con retención de siete días. Los servicios reinician
ante fallos y arrancan con Linux. El servidor solo escucha
en 127.0.0.1. El PC, la conexión y el dominio deben permanecer disponibles.
Verifica desde otro equipo el inicio por correo, la carga del juego, una sala y
que el mismo enlace funcione después de reiniciar. Hasta realizar esa prueba,
el despliegue físico y el acceso exterior continúan pendientes.

## 4. Actualizar y recuperar

Esta sección aplica a una futura entrega empaquetada. En la carpeta actual se
trabaja directamente con el código; no hay un `actualizar.sh` generado.
Antes de cambiar archivos, detén el servidor y conserva `private` y `host.json`.

```sh
sh actualizar.sh actualizacion.zip
```

Si el servicio está activo, el script lo detiene y lo vuelve a iniciar. En uso
manual, detén antes `iniciar.sh`. La actualización comprueba hashes y versión de
recursos; no reemplaza host.json, credenciales ni recursos del juego. Guarda una
copia anterior y un diario en `.updates`.

Para recuperar después de una interrupción, con el servicio detenido:

```sh
python3 tools/apply_update.py --recover
```

Para volver a la versión anterior instalada:

```sh
python3 tools/apply_update.py --rollback
```

No borres `.updates` si quieres conservar la recuperación. Las actualizaciones de
código no requieren transferir de nuevo todos los recursos. Se conserva el paquete
completo para instalaciones nuevas y una entrega anterior de recuperación.

## 5. Datos, costes y origen

Las ISOs y los recursos originales no se suben a GitHub. La web privada exige
Access; robots.txt no sustituye esa protección. No se envía una ISO desde el
navegador a ningún servidor. Los jugadores descargan los datos necesarios desde
tu PC. La velocidad depende de su ancho de banda y del número de jugadores.
No se contrata un plan de pago mediante estos scripts; se deben respetar las
cuotas de los servicios de Cloudflare ya utilizados.

La URL fija conserva el origen del almacenamiento. Para trasladar partidas desde
localhost o un enlace temporal anterior, descarga la copia y restáurala en el
nuevo dominio. Conceder almacenamiento persistente no sustituye un respaldo.
