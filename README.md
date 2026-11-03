# Downhill Web — versión privada

Versión web basada en Downhill Revived 0.7.2, con interfaz, controles, guardados,
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
La fuente de referencia está fijada a `244cf4cef10da5492ca878e3b97ec74656dbc5e5`.
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
