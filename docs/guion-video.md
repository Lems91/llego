# Guion del video — Llegó (máximo 5 minutos)

Tono: claro, sin exagerar. Todo lo que se muestre como real ocurre en Stellar testnet; lo demás se dice que es simulado.

## 0:00–0:35 · Problema y usuario

Pantalla: inicio de Llegó con el banner TESTNET.

> "Imagina un comercio de repuestos con muchos clientes en Venezuela que pagan en bolívares. Quiere recibir dólares digitales y decidir después qué hacer con ellos. Llegó es un prototipo que muestra, en la red de pruebas de Stellar, la parte que la red resuelve: el cliente paga con un activo, el comercio recibe otro, el monto exacto, y sabe que el pago llegó consultando la red."

## 0:35–1:00 · Por qué Stellar

> "Stellar permite un pago con ruta: convierte entre activos en una sola transacción atómica, con comisiones muy bajas, usando activos, líneas de confianza y pools de liquidez nativos de la red."

## 1:00–2:00 · Comercio crea el cobro

Pantalla: `/#comercio`, conectar wallet, cuenta fija, catálogo, crear cobro, enlace.

> "El comercio conecta su wallet Varial, antes Freighter. Esta pantalla guarda su dirección y no la cambia aunque cambie la cuenta de la wallet. Crea un cobro de 4.75 USDDEMO. Esto es un activo de prueba, no un dólar real. La app genera un memo único y un enlace. Esta maqueta de cobro en bolívares está marcada como simulada."

## 2:00–3:20 · Cliente paga

Pantalla: enlace en otra pestaña, preparación, resumen, firma.

> "El cliente abre el enlace. La app lo valida: si alguien altera el monto o el activo, no deja continuar. Conecta su wallet, y la app prepara su cuenta. Este botón de obtener VESDEMO es una ayuda de testnet que representa que ya tiene bolívares. El resumen sale de la misma transacción que se va a firmar: el comercio recibe exactamente 4.75 USDDEMO, el cliente paga como máximo este monto, que es la cotización más 1 %, y la transacción vence en tres minutos. La clave nunca pasa por la app: firma la wallet."

## 3:20–4:00 · "Llegó"

Pantalla: pestaña del comercio, "¿Ya pagaron? Llegó.", enlace a stellar.expert.

> "El comercio no confía en el cliente: consulta la red cada cinco segundos y solo muestra Llegó si hay una transacción exitosa con su dirección, el activo correcto con su emisor, el monto exacto y el memo, y la vuelve a consultar por su hash antes de mostrarlo. Aquí está en stellar.expert: el cliente envió VESDEMO y el comercio recibió USDDEMO."

## 4:00–4:30 · Qué es simulado y seguridad

Pantalla: maqueta de retiro con la etiqueta; un enlace alterado rechazado.

> "El retiro a pesos es una maqueta: no hay ningún proveedor conectado ni dinero real. En seguridad: montos exactos como enteros, el activo se verifica por código y emisor, solo testnet, y un enlace alterado se rechaza. El riesgo que aceptamos es que el enlace de cobro no está firmado; por eso mostramos la dirección completa y un aviso."

## 4:30–5:00 · Cierre

Pantalla: README del repositorio.

> "Llegó está en un repositorio público con licencia MIT y una demo en línea. Es un prototipo en testnet, no una pasarela operativa, construido con Claude Code bajo mi dirección. Gracias."

## Notas de producción

- Grabar en una toma continua por escena; mantener la pantalla limpia (sin marcadores, correos ni DevTools).
- Si algún paso tarda, cortar el tiempo de espera en la edición, no el paso.
- No mostrar las claves ni la frase semilla de ninguna wallet; el popup de Varial solo muestra direcciones públicas.
- Revisar status.stellar.org antes de grabar.
