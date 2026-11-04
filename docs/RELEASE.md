# Entrega privada 1.0.0-rc.2 — actualización del 4 de noviembre de 2026

Núcleo oficial Revived 0.7.9, revisión
`7cd9543f3144bd03beb27f20bbd4e0739c453128`, protocolo 2.
Se verifican los módulos descargados mediante SHA-256; se recompiló el auxiliar
C de red con Emscripten 6.0.12. La compilación integral del núcleo sigue pendiente.

La actualización incorpora la corrección upstream 0.7.8 de tiempo de simulación
y producción de sonido entre 30 y 240 FPS. Por debajo de 30 FPS el núcleo todavía
puede ralentizarse. No aumenta por sí sola la capacidad de la CPU/GPU del jugador.
[Notas upstream](https://github.com/skuza-oss/downhill-revived/releases/tag/v0.7.8).

Comparación con carrera real y el mismo retraso artificial de 24 ms por fotograma:

| Núcleo | FPS finales | Segundos de audio producidos por segundo real | Cortes durante 12 s |
|---|---:|---:|---:|
| 0.7.2 | 31,86 | 0,558 | 56 |
| 0.7.9 | 31,89 | 1,007 | 0 |

Cada medición se tomó después de 10 segundos de calentamiento con audio activo.
Es una prueba controlada en el PC de desarrollo, no una medición en el i5 de
tercera generación/GT 1030 del usuario ni una prueba prolongada sin cortes.

El Worker conserva el protocolo 1 y sus objetos; el protocolo 2 utiliza nuevas
clases y el prefijo `/v2`. El cliente mantiene el inicio elegido de 2/3/4 jugadores
mediante una barrera explícita del anfitrión. Los recursos preparados no cambian,
ni se borran las tarjetas. Los replays anteriores a 0.7.8 pueden ser incompatibles
con el nuevo núcleo; se conservan sus archivos. No se acredita una solución al
fallo del compilador Metal de iPhone mediante esta actualización.

Verificación de esta actualización: 39 pruebas Python (una omitida en Windows),
11 suites Node de módulos, cliente C de protocolo 2 y arranque de dos clientes
de protocolo 1. Carreras reales de 2, 3 y 4 instancias en Chrome, todas en el mismo
PC y con el Worker local: puestos distintos, intercambio de estados, espera de
siete segundos antes del último jugador y notificación de salida del anfitrión.
Estas pruebas cortas no sustituyen carreras completas desde conexiones distintas.

Worker existente actualizado: despliegue `76a79db9-22fe-4d4f-8be3-8d4914758670`.
Comprobación pública posterior: ambos health endpoints, creación/unión/inicio
con protocolo 1; cliente C de protocolo 2 con espera de tres, abandono en sala,
inicio con tres puestos, rechazo por sala llena y salida del anfitrión.
El cambio en Linux requiere `git pull --ff-only`, reiniciar `downhill-web` y
recargar el navegador. No requiere transferir otra vez los recursos del juego.

Corrección posterior de mando: stick izquierdo como cruceta únicamente cuando
el núcleo está en modo menú, con umbrales separados de pulsación/liberación.
En carrera se conservan los cuatro ejes y su recorrido completo 0–255.
Comprobado en Chrome con entradas Gamepad API controladas y el núcleo real:
navegación hasta carrera sin autopad, pausa, lectura de ejes, cierre del panel de
controles y desconexión. No se probaron mandos físicos; los dispositivos sin
asignación estándar muestran un aviso en lugar de asumir botones o ejes.

Diagnóstico móvil: el registro funciona también cuando falla la comprobación
WebGPU antes de importar el juego. Los errores largos conservan su causa al
final del texto. Confirmado con error Metal inyectado y cero descargas del núcleo;
el arranque normal sigue funcionando en Chrome. iOS 27.0.1 en hardware físico
sigue pendiente; investigación y fuentes en `docs/TESTING.md`.

## Registro de la entrega anterior (rc.1, 3 de noviembre)

Aplicación 1.0.0-rc.1; núcleo Revived 0.7.2, protocolo 1, revisión
`244cf4cef10da5492ca878e3b97ec74656dbc5e5`. Se mantiene el núcleo existente:
su compilación integral desde fuentes **no está reproducida**.

## Implementado y comprobado

- Guardados v1/v2, revisión de tarjetas antes de restaurar, SHA-256, nombres,
  carpetas vacías y bytes originales. Prueba de 8 MiB y restauración real en
  IndexedDB. Un error de cuota provocado durante la escritura conservó los
  datos anteriores; la otra tarjeta quedó intacta cuando no estaba incluida.
  Las otras pestañas se detuvieron antes de reemplazar datos.
- Salas de 2, 3 y 4 clientes reales con puestos distintos e intercambio de
  estados mediante el Worker público. Las salas de tres/cuatro esperaron al
  número elegido más de siete segundos: se retiró la capacidad de cuenta atrás
  anticipada de ese flujo, conservando el protocolo original.
- Cliente C original: abandono en sala, inicio con tres, rechazo de entrada
  tardía y notificación de salida del anfitrión. No se simula el juego en JS.
- Caché de 48 MiB en RAM y 128 MiB en IndexedDB; corrupción, persistencia,
  expulsión y fallo de escritura; colas limitadas y prioridad de demanda.
- Cinco repeticiones por condición: retraso artificial de 250 ms por bloque,
  dos cortes de conexión y respuesta alterada. Las 15 entradas reales a carrera
  se recuperaron, con dos reintentos para los cortes y uno para la corrupción.
- Rechazo previo al arranque si falta GPU, JSPI o aislamiento; ningún núcleo
  descargado en esas tres pruebas.
- Instalación Linux WSL actualizada: servidor, recursos, compresión WASM,
  cabeceras de aislamiento y entrada real a carrera desde Chrome.
- Diferencial desde la entrega anterior de cuatro jugadores, vuelta atrás y
  reinstalación, conservando configuración. Fallos provocados, cambios locales,
  recursos incompatibles y exclusión mutua cubiertos por pruebas automáticas.
- Plantillas de ambos servicios verificadas con `systemd-analyze verify`.
  cloudflared Linux 2026.10.7 se comprobó contra el SHA-256 de su publicación
  oficial; no se instaló ni activó un túnel durante esta comprobación.

## Medidas de carga

Cinco pares de visita inicial/repetida por versión, en el mismo PC y con otras
pruebas de juego simultáneas. Los tiempos incluyen la navegación automática por
los menús originales; no equivalen únicamente a descarga.

| Versión / visita | Datos de juego por red | Mediana hasta carrera |
|---|---:|---:|
| Anterior, inicial | 53 MiB | 18,19 s |
| Anterior, repetida | 53 MiB | 18,00 s |
| Candidata, inicial | 53 MiB | 18,31 s |
| Candidata, repetida | 0–1 MiB | 18,36 s |

La mejora comprobada es el ahorro de transferencia repetida. No se observó una
reducción de tiempo de entrada en esta conexión local. Con el retraso artificial
por bloque, la mediana fue 30,78 s; con cortes, 19,11 s; con corrupción, 18,52 s.
No se descargaron los 2,53 GB de recursos completos para iniciar esa pista.

## Sesiones prolongadas

Registros persistidos cada veinte segundos; todas las muestras conservaron el
avance del motor. Son pruebas en **un solo PC**, no en redes físicas distintas.

| Sesión | Duración real | Resultado |
|---|---:|---|
| Individual con audio | 3619 s, 173 muestras | Sin parada; mediana 59,96 FPS |
| Tres clientes online | 1816 s, 86 muestras por cliente | Tres conexiones activas; medianas 58,11 / 55,87 / 56,89 FPS |

La memoria WASM quedó en 1814,5 MiB individual y 1811,75 MiB por cliente online,
sin aumento en la segunda mitad. Es memoria del núcleo, además de las cachés;
esta entrega no reduce esa reserva. Las colas de escritura observadas fueron
de 0–1 bloques y el registro se mantuvo limitado a 64 KiB.

El audio individual registró 30 vaciados en total, 21 después de entrar a carrera.
No aumentaron durante los últimos 45 minutos. Otras pruebas llegaron a ejecutar
ocho instancias simultáneas y produjeron pausas; **no se acredita audio sin cortes
bajo esa carga**, ni una mejora A/B de audio con condiciones aisladas. Los clientes
online prolongados no tenían audio activado. Se comprobaron recuperación y cola
acotada mediante pruebas del consumidor PCM, no cambios físicos de dispositivo.

Las sesiones mantienen la simulación real en pista; no acreditan que varios
jugadores humanos hayan completado una carrera de principio a fin.
La corrección posterior de copias con tarjetas vacías afecta solo al
almacenamiento y se verificó por separado en navegador; no cambia el motor,
el renderizador, el audio ni el transporte usados en estas sesiones.

## Entrega, limpieza y límites de publicación

La versión vigente es esta carpeta de trabajo. Por petición del usuario se
retiraron los paquetes generados, las capturas temporales y los duplicados de
desarrollo. Las ISOs se conservan en `../downhill-originales` y el SDK compartido
fuera del proyecto. Se conserva el historial Git y el respaldo pequeño de fuentes.
Los resultados de las pruebas anteriores se resumen en este documento; no se
presenta el empaquetado como sustituto del proyecto actual.

Pendiente de comprobación externa:

- DNS, Access y túnel activo de `jugar.cobbleverse.space`: la sesión disponible
  de Wrangler rechaza DNS con HTTP 403. El configurador preparado permite
  introducir localmente un token limitado, de forma oculta; no se empaqueta.
- Instalación, reinicio y recuperación del PC Linux físico; Chrome y Edge con
  el dominio final; mando y cambio/suspensión de dispositivo de audio físicos.
- Carreras completas entre 2, 3 y 4 equipos en conexiones distintas, incluidos
  abandonos durante sala, carga y carrera.
- Reincorporación a una carrera iniciada: el protocolo actual no la soporta.
- Compilación integral del núcleo y revisión de la distribución correspondiente
  antes de ofrecer binarios públicamente. Los recursos originales quedan privados.

El funcionamiento local no garantiza 60 FPS universales ni disponibilidad cuando
el PC servidor o su conexión estén apagados. No se contrató ningún plan de pago.
