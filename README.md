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
El stick izquierdo navega por los menús y conserva dirección e inclinación
analógicas durante la carrera. Si el navegador no reconoce la asignación del
mando, la página lo indica en lugar de ignorarlo silenciosamente.

### Teléfonos (compatibilidad experimental)

En Android, abre la dirección **HTTPS** en Chrome o Brave actualizado. El juego
comprueba las funciones reales del navegador (WebGPU, JSPI, memoria compartida),
sin habilitarlo solo por el nombre del navegador. Si falta alguna, indica la
causa antes de descargar el núcleo. No todos los teléfonos son compatibles.

Los botones táctiles aparecen automáticamente; permiten combinar dirección,
pedaleo, salto y los demás botones del mando original. «Pantalla completa» incluye
los controles; gira el teléfono para jugar en horizontal. «Salir» permite volver
a las salas y «Controles táctiles» oculta o muestra el mando. También puedes usar
un mando estándar conectado al teléfono por Bluetooth/USB.

En dispositivos táctiles la resolución inicial es x1 y el ajuste automático
puede subir hasta x2. La simulación conserva su velocidad original. El núcleo
puede consumir alrededor de 2 GB de memoria, además del navegador: la adaptación
no garantiza fluidez ni compatibilidad con teléfonos de poca memoria.
La interfaz y las entradas se comprobaron en Chrome con pantalla y toques móviles
emulados; quedan pendientes las pruebas en teléfonos Android físicos y Brave
Android. En iPhone también se requieren todas las funciones comprobadas al entrar;
no se garantiza compatibilidad por instalar Chrome o Brave.

El iPhone 15 Pro Max del usuario presentó un error de compilación Metal en
`atomicCompareExchangeWeak` (campo con un espacio de direcciones). WebKit tiene
una [corrección en sus fuentes](https://github.com/WebKit/WebKit/commit/4f56cc248e8a2e447f77d54d7612d2a6128daccb);
no se ha identificado qué versión instalada de iOS la incorpora. La página prueba
ahora esa operación antes de cargar el núcleo y recomienda actualizar iOS cuando
detecta el fallo. Esto **no acredita que el juego funcione en ese iPhone**.

Referencias del navegador: [WebGPU](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips)
y [WebAssembly JSPI](https://v8.dev/blog/jspi).

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
carga depende de la conexión de subida del servidor. El modo automático empieza
en x2 en PC (x1 en dispositivos táctiles) y se ajusta entre x1 y x2. Conserva
durante la sesión el límite de resolución que ha funcionado, para evitar subidas
y bajadas repetidas. La versión web limita por defecto el objetivo a 60 Hz, incluso
si los ajustes guardados pedían 120/144 Hz. No se promete una tasa fija de FPS.
Los ajustes explícitos de desarrollo `env.DHD_SCALE`, `env.DHD_AUTO_MAX_SCALE=4`
y `env.DHD_FPS_MAX` permiten comparar otros valores.

Las lecturas de recursos ya verificados en RAM y de guardados se entregan al
núcleo sin esperar una promesa; las descargas y la caché en disco mantienen la
lectura asíncrona y su validación. El contador principal muestra cuadros
presentados por el renderizador; el diagnóstico conserva por separado los
pasos de simulación y el número de lecturas directas/con espera.

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
