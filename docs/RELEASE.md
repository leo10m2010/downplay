# Entrega privada 1.0.0-rc.1 — verificación del 3 de noviembre de 2026

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
