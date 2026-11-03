# Procedencia del núcleo y del código

- Núcleo de referencia: https://github.com/skuza-oss/downhill-revived
- Revisión fijada: `244cf4cef10da5492ca878e3b97ec74656dbc5e5`.
- Versión del núcleo/protocolo: 0.7.2 / 1.
- Los módulos oficiales de evaluación conservan su `download-manifest.json` y se
  verifican contra él antes de servirlos o empaquetarlos.
- La compilación integral de esos módulos desde las fuentes aún no está reproducida
  en este proyecto. No se declara resuelta mediante un empaquetado.
- El módulo auxiliar de red sí se compila con el cliente C original y el adaptador
  `web-native/network.c`. El exportador incluye sus fuentes correspondientes y la
  licencia upstream en `third_party/revived-net` dentro del ZIP de fuentes.
- El prototipo anterior DownHill-Port-PC y los experimentos de emulación se retiran
  del árbol activo conservando copia verificada e historial. No forman parte del
  camino de ejecución de la entrega actual.

Los recursos de juego proceden de la copia USA local del usuario. Su identidad y
los hashes se registran durante la preparación offline. No se incluyen en el ZIP
de fuentes ni se publican como parte de la licencia del código.

## Reproducir el módulo auxiliar de red

La compilación comprobada utilizó Emscripten **6.0.12** en Windows. En una copia
nueva, clona las fuentes de referencia y activa el SDK de tu propio sistema:

```sh
git clone https://github.com/skuza-oss/downhill-revived vendor/revived
git -C vendor/revived checkout 244cf4cef10da5492ca878e3b97ec74656dbc5e5
git clone https://github.com/emscripten-core/emsdk "$HOME/.cache/downhill-toolchains/emsdk-6.0.12"
cd "$HOME/.cache/downhill-toolchains/emsdk-6.0.12"
./emsdk install 6.0.12
./emsdk activate 6.0.12
. ./emsdk_env.sh
cd /ruta/al/proyecto/downhill
python3 tools/build_browser_network.py
node tests/browser_network_test.mjs
```

En Windows se usan `emsdk.bat` y `emsdk_env.bat` desde la terminal adecuada.
No reutilices el SDK binario de Windows para compilar en Linux. Esta operación
genera `build/network/public/network-core.js` y `network-core.wasm`; no requiere
una ISO y **no compila el núcleo completo del juego**. El ZIP público conserva
las fuentes C correspondientes, pero no los módulos oficiales ni los recursos.
