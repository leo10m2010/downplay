# Downhill Web — versión privada

Versión web basada en Downhill Revived 0.7.9, con interfaz, controles, guardados,
lectura progresiva y servidor de recursos propios. El juego se ejecuta en el
navegador del jugador. El PC Linux sirve archivos; el Worker de Cloudflare conecta
las salas. El código y las evaluaciones antiguas se archivan fuera del proyecto.

## Jugar

Este es el proyecto de trabajo, sin paquetes ZIP ni instalaciones duplicadas.
Los recursos preparados de tu copia USA están en `private/game-data`.
Desde esta carpeta ejecuta `python tools/run_linux_host.py --config host.json`
(en Linux, `python3`). Requiere Python 3.11 o posterior. Abre
`http://127.0.0.1:8095/` en Chrome o Edge actualizado.
No se abre ni se solicita una ISO durante la partida.

La página comprueba WebGPU, JSPI, memoria compartida y aislamiento antes de cargar
el núcleo. Los controles originales están dentro del juego. «Teclado y mando»
permite reasignar teclas; los mandos estándar se conectan por USB/Bluetooth al PC.

## Salas y partidas

El anfitrión elige 2, 3 o 4 jugadores. Comparte la invitación o el código de sala.
El inicio automático espera el número elegido. La lista diferencia preparación,
carga de pista y carrera. El protocolo permite reintentar en la sala; no permite
reincorporarse a una carrera ya empezada. Una desconexión se muestra claramente.

En «Diagnóstico técnico y guardados» puedes descargar una copia, restaurarla y
recuperar la copia anterior. Restaurar detiene las pestañas del juego, valida el
archivo y reemplaza en una transacción las tarjetas incluidas. Las demás tarjetas
se conservan. Los guardados pertenecen al navegador y al dominio que estés usando.

## Linux, dominio y actualizaciones

La dirección preparada es **https://jugar.cobbleverse.space**. Deben configurarse
Cloudflare Tunnel y Access antes de compartirla. No se activan planes de pago.
Las instrucciones completas están en [DEPLOYMENT.md](DEPLOYMENT.md).

Se trabaja directamente sobre estos archivos. Las herramientas de empaquetado
siguen disponibles para un despliegue futuro; no hay paquetes generados en la
carpeta activa. Para actualizar archivos, detén primero el lanzador.

## Estructura activa

- `web-native`: interfaz y adaptadores del navegador.
- `tools`, `tests`, `docs`, `licenses`: preparación, despliegue, pruebas y procedencia.
- `private/game-data`: recursos preparados; `private/runtime`: núcleo de evaluación.
- `vendor/revived`: fuentes de referencia fijadas; `build/network`: cliente de red compilado.
- `relay`: proyecto del Worker de salas.

Para trasladar esta copia personal mediante un repositorio privado, Git incluye
`private/game-data`, `private/runtime`, `build/network/public` y la configuración
`host.json` sin credenciales. Las ISOs, tokens, SDK y dependencias de desarrollo
siguen excluidos. Los archivos `.data` usan Git LFS y los módulos originales
conservan sus bytes y hashes al clonarlos en otro sistema.
Las ISOs originales se conservan fuera de esta carpeta, en
`../downhill-originales`. El SDK de Emscripten compartido está en
`~/.cache/downhill-toolchains/emsdk-6.0.12`; se puede seleccionar mediante
`DHD_EMSDK` o `--sdk`. Los respaldos pequeños de fuentes e investigaciones
conservadas están fuera del proyecto, en `downhill-archive`.

## Desarrollo y límites reales

Para preparar recursos se utiliza Python offline con `tools/requirements.txt`.
La fuente de referencia está fijada a `7cd9543f3144bd03beb27f20bbd4e0739c453128`.
`tools/build_browser_network.py` compila el cliente C original con Emscripten.
La compilación integral del núcleo del juego todavía no está reproducida aquí:
se usan módulos oficiales con manifiesto y comprobación de hashes. No se deben
presentar las mejoras de esta interfaz como una reconstrucción completa del motor.

La caché usa hasta 48 MiB en memoria y 128 MiB de almacenamiento, además de la
memoria del propio motor. Los recursos se descargan por demanda; la primera
carga depende de la conexión de subida del servidor. La resolución se adapta entre
x1 y x4 sin alterar la velocidad del juego. No se promete una tasa fija de FPS.

Consulta [docs/TESTING.md](docs/TESTING.md) y [docs/RELEASE.md](docs/RELEASE.md) para
los resultados, condiciones de prueba y comprobaciones pendientes. El código
conserva GPL-3.0-or-later; esa licencia no concede derechos sobre los recursos
originales. Esta configuración de traslado personal está destinada a un
repositorio privado.

## Trasladar el proyecto mediante GitHub

En este PC ya está inicializado Git LFS. Sube desde Git o GitHub Desktop; el
cargador de archivos de la web no convierte los recursos a LFS. El archivo más
grande supera el límite de 100 MiB de Git normal.

En el servidor instala Git LFS y Python 3.11+, y utiliza:

```sh
git clone https://github.com/leo10m2010/downplay.git downhill
cd downhill
git lfs install --local
git lfs pull
python3 tools/run_linux_host.py --config host.json
```

No necesitas copiar los recursos por otro medio. Git LFS debe descargar los
archivos reales; los punteros pequeños de LFS no sirven para ejecutar el juego.
Los tests de GitHub Actions no descargan el juego para ahorrar esa transferencia.

GitHub Free incluye 10 GiB de almacenamiento y 10 GiB de descargas LFS por periodo
según su [documentación](https://docs.github.com/en/billing/concepts/product-billing/git-lfs).
Los recursos actuales ocupan unos 2,36 GiB. Para evitar cargos, configura un
presupuesto LFS de **0 USD** en tu cuenta antes de subirlos. No se modificó tu
cuenta ni se activó facturación mediante esta configuración local.

El manual de continuidad para instalarlo en el otro equipo está en
[docs/INSTALAR_EN_OTRO_EQUIPO.md](docs/INSTALAR_EN_OTRO_EQUIPO.md).

---

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
