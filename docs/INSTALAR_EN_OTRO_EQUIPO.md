# Instalación de Downplay en el PC Linux del usuario

Manual de continuidad para el asistente que hará la instalación. Se trabaja
directamente con la carpeta del proyecto; no hay que preparar paquetes grandes.
Repositorio privado: https://github.com/leo10m2010/downplay.

## Estado y decisiones que deben conservarse

- El usuario autorizó trasladar código, recursos preparados, módulos del motor y
  `host.json` mediante este repositorio privado. No necesita otro canal de copia.
- Git LFS almacena los archivos `.data`. Hay un archivo de 109,7 MB que no admite
  Git normal; no quitar las reglas de `.gitattributes` ni subirlo por la web.
- El presupuesto LFS de 0 USD fue confirmado por el usuario el 3/11/2026.
  Las ejecuciones automáticas de GitHub Actions están desactivadas en el destino.
  No se contrató alojamiento ni se habilitaron pagos.
- GitHub documenta 10 GiB de almacenamiento y 10 GiB de descargas LFS en Free.
  Esta instalación usa aproximadamente 2,36 GiB de recursos. Otras descargas y
  versiones también consumen cuota; el presupuesto cero bloquea sobrecostes.
  Referencia: https://docs.github.com/en/billing/concepts/product-billing/git-lfs.
- El núcleo utilizado es Downhill Revived 0.7.2, protocolo 1, revisión
  `244cf4cef10da5492ca878e3b97ec74656dbc5e5`. Su compilación integral no está
  reproducida aquí. Los módulos conservados permiten instalar sin compilarlo.
- Hubo una sesión individual de 60 minutos y otra de tres clientes durante 30
  minutos, en un PC. No equivalen a pruebas entre equipos/redes diferentes.
  El audio puede cortarse con mucha carga y no hay reconexión a una carrera activa.

## 1. Inspeccionar el destino

Comprobar distribución, usuario, espacio disponible y versiones. Instalar como
usuario normal en una carpeta suya. No borrar una instalación previa sin revisar
sus cambios, configuración y guardados. No instalar un VPS ni servicios de pago.

En Debian/Ubuntu, si faltan estas herramientas:

```sh
sudo apt-get update
sudo apt-get install git git-lfs python3 ca-certificates
python3 --version
git lfs version
```

Python debe ser 3.11 o posterior. Si es anterior, revisar la distribución y elegir
una instalación compatible sin sustituir a ciegas el Python del sistema. Node,
Emscripten y las herramientas Python de extracción no son necesarios para jugar.

El árbol de trabajo contiene unos 2,9 GB. Git LFS mantiene además una caché de los
objetos descargados: reservar espacio para ambas cosas y margen de funcionamiento.

## 2. Autenticarse y clonar una sola vez

El repositorio es privado. Usar la cuenta del usuario mediante GitHub CLI o su
configuración de claves/credenciales existente. No pedir un token por chat ni
incluir credenciales en la URL. Si hace falta GitHub CLI, instalar `gh` desde la
distribución y completar `gh auth login` de forma interactiva con el usuario.

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/leo10m2010/downplay.git downplay
cd downplay
git lfs install --local
git lfs pull
```

No repetir clones para comprobar lo mismo. Si ya existe una copia, revisar primero
`git status`, la rama y la identidad de los recursos. No usar `reset --hard`.
Si LFS indica cuota agotada, detenerse y explicar el bloqueo; no habilitar pagos.

Archivos imprescindibles:

- `private/game-data/index.json` y sus carpetas `files` y `layout`.
- `private/runtime`, incluido `download-manifest.json` y los módulos de `build`.
- `build/network/public/network-core.js`, `network-core.wasm` y `package.json`.
- `web-native`, `tools`, `host.json`, `release.json` y las licencias.

Un archivo `.data` de unos 130 bytes con texto `git-lfs` es un puntero, no el
recurso. Eso se corrige con Git LFS, sin pedir una ISO ni volver a extraer el juego.

## 3. Validar antes del arranque

```sh
python3 tools/prepared_disc.py --verify --output private/game-data
python3 tools/run_linux_host.py --config host.json
```

La identidad completa de recursos esperada es:
`0fe2b77713d3440cc3030741ea0b18f49e3feaa09671a30a421e0d4888a7eb86`.
La identidad de archivos para las salas es:
`c8c17bcae383daf9f2feadc7f6d7476c43d659ab8d66127a299b01311f2a3476`.

El arranque verifica también los hashes del núcleo. Si falla un hash, revisar
que LFS haya descargado los datos y que Git no haya cambiado finales de línea;
`.gitattributes` preserva los bytes de los módulos. No debilitar las verificaciones.

En otra terminal:

```sh
curl --fail http://127.0.0.1:8095/release.json
curl --fail http://127.0.0.1:8095/game-identity.json
curl --fail http://127.0.0.1:8095/network-config.json
curl --head http://127.0.0.1:8095/
```

Comprobar COOP `same-origin`, COEP `require-corp` y el Worker existente. Abrir el
juego en Chrome/Edge actualizado. El servidor Linux no necesita GPU; el navegador
del jugador sí requiere WebGPU. Una IP de red por HTTP no sustituye HTTPS para
las funciones de memoria compartida del navegador.

## 4. Publicar en el dominio existente

### Qué se conecta a cada servicio

Son dos conexiones distintas y ya están previstas en `host.json`:

| Uso | Dirección | Destino |
|---|---|---|
| Página y recursos del juego | `https://jugar.cobbleverse.space` | Cloudflare Tunnel → PC Linux, `http://localhost:8095` |
| Salas y estados multijugador | `wss://downhill-web-relay.dowh.workers.dev` | Worker de salas existente |

El subdominio `jugar` se publica como ruta del túnel hacia el PC; no se usa como
dominio personalizado del Worker de salas. Ese Worker no aloja la página ni los
recursos del juego. La aplicación ya conoce su dirección mediante el campo
`relay` de `host.json` y la comunica al navegador con `network-config.json`.
No hace falta vincularle un dominio adicional para usarlo.

Tener `cobbleverse.space` registrado en Cloudflare no crea la ruta del juego.
El campo `publicHostname` indica la dirección prevista, pero todavía hay que
configurar DNS, conectar `cloudflared` en Linux y establecer Access. Seguir a
continuación el configurador o la alternativa manual de `DEPLOYMENT.md`.

El endpoint del Worker `/v1/health` respondió correctamente el 3/11/2026 con
protocolo 1 y versión mínima 0.7.2. Esto acredita el servicio de salas, no el
dominio del juego ni una instalación Linux ya terminada. Algunos clientes HTTP
sin agente de navegador recibieron 403; comprobar también con navegador antes
de concluir que el Worker está caído.

La documentación oficial del recorrido dominio → túnel → servicio local está en
https://developers.cloudflare.com/tunnel/get-started/.

No crear otro servicio de salas. Conservar
`wss://downhill-web-relay.dowh.workers.dev` en la configuración.

Destino de Cloudflare: `jugar.cobbleverse.space` hacia `http://localhost:8095`.
Primero inspeccionar DNS, aplicaciones Access y túneles ya existentes. La sesión
de Wrangler disponible en Windows no tenía permisos DNS: respondió HTTP 403.
Eso no prueba que haya un túnel administrado listo en el nuevo equipo.

Instalar `cloudflared` según la distribución siguiendo la fuente oficial:
https://developers.cloudflare.com/tunnel/downloads/.
Usar la cuenta existente y el plan gratuito; no introducir tarjeta ni habilitar
productos de pago. Mantener el mismo origen para conservar guardados y cachés.

El configurador pide un token API de forma oculta. Elegir los correos permitidos
con el usuario, sin inventar direcciones:

```sh
python3 tools/configure_cloudflare.py --prompt-token --email CORREO_PERMITIDO
python3 tools/configure_cloudflare.py --prompt-token --apply --email CORREO_PERMITIDO
```

El primer comando inspecciona sin cambios. El segundo configura Access antes de
crear el DNS. Consultar `DEPLOYMENT.md` para permisos mínimos y alternativa manual.
Si existe una ruta previa, no borrarla para forzar el configurador: identificar
su propietario y conservar su estado. Las credenciales se obtienen localmente;
`private/cloudflared.token` y `private/cloudflare-state.json` no viajan en Git.

Detener el lanzador manual antes de instalar los servicios:

```sh
sudo python3 tools/install_linux_host.py --token-file private/cloudflared.token --enable
systemctl status downhill-web downhill-tunnel
journalctl --namespace=downhill-web -u downhill-web -u downhill-tunnel --since today
```

El instalador comprueba lectura como el usuario del servicio y protección Access.
No eliminar esa comprobación para abrir el juego sin protección. Las instrucciones
exactas de credenciales, registros y recuperación están en `DEPLOYMENT.md`.

## 5. Condiciones para dar la instalación por terminada

1. Clonación y recursos íntegros, sin ISO y sin compilación requerida en destino.
2. Entrada real al juego y conducción, no solo HTTP 200 o una captura del menú.
3. HTTPS con aislamiento y acceso por los correos permitidos; sesión anónima
   rechazada antes de entregar recursos.
4. Sala con dos, tres y cuatro equipos, puestos distintos y mensajes comprensibles
   si un participante se desconecta. No prometer reconexión durante una carrera.
5. Guardado, exportación y restauración probados sin sobrescribir partidas ajenas.
   Los guardados pertenecen al navegador/origen y no están dentro de Git.
6. Recuperación tras reiniciar el Linux físico y conservación del mismo dominio.
7. Límites gratuitos respetados, sin secretos en Git ni servicios de pago nuevos.

Informar al usuario brevemente de lo comprobado y de lo pendiente. No inventar
resultados de juegos remotos, hardware, audio ni reinicio del equipo.
