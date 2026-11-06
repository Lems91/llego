# Etapa 1 — Plan de arquitectura de Llegó (sin código)

Versión 2 · 6-nov-2026 · **Estado: 🟢 APROBADO por Luis (6-nov-2026, 16:31)**

Depende de `docs/constitution.md`. Este documento no crea código. Define qué se construye, en qué orden y cómo se comprueba. Las estimaciones de tiempo son aproximadas, no mediciones.

---

## 1. Resumen ejecutivo

Una web estática sin servidor. El comercio conecta su wallet de testnet, crea un cobro y recibe un enlace. El pagador abre el enlace, conecta su wallet, ve un resumen y firma un pago con ruta: entrega VESDEMO y el comercio recibe exactamente el monto en USDDEMO. La pantalla del comercio consulta la red y muestra "¿Ya pagaron? Llegó." solo cuando la red confirma un pago que cumple todas las condiciones. Un script local siembra los activos y la liquidez de prueba sin guardar ningún secreto. El cobro en bolívares y el retiro a pesos son maquetas etiquetadas como SIMULADO.

## 2. Arquitectura general

```
                    NAVEGADOR (sitio estático)
 ┌───────────────────────────────────────────────────────────┐
 │  ui/  (React: pantallas y componentes, no calcula nada)    │
 │     │ usa                                                  │
 │     ▼                                                      │
 │  core/ (lógica pura, sin React ni red; se prueba aislada)  │
 │     validation · amounts · paymentRequest · txBuilder ·    │
 │     paymentMatcher · errors                                │
 │                                                            │
 │  adapters/ (únicos módulos que salen del navegador)        │
 │     wallet.js  ──► Freighter vía Stellar Wallets Kit (firma)│
 │     network.js ──► Horizon testnet (rutas, cuentas, pagos,  │
 │                    envío) y Friendbot                       │
 │                                                            │
 │  config/  network.js (constantes testnet)                  │
 │           testnet-assets.json (generado; solo datos públicos)│
 └───────────────────────────────────────────────────────────┘

 PC DE LUIS (Node, local, una vez por reinicio de testnet)
   scripts/seed-testnet.mjs ──► Friendbot + Horizon testnet
       crea emisores, distribuidor, activos, pools; bloquea emisores;
       escribe src/config/testnet-assets.json (solo públicos);
       las claves viven en memoria y se descartan
```

Reglas de capas: `ui` solo habla con `core` y `adapters`. `core` no importa nada de `ui` ni de `adapters`. Solo `adapters/wallet.js` pide firmas. Solo `adapters/network.js` hace peticiones a la red.

## 3. Árbol de carpetas propuesto (`C:\dev\llego`)

```
llego/
├── .gitignore               # primer archivo del repo
├── .npmrc                   # save-exact=true (y el registro de JSR si se usa el kit)
├── CLAUDE.md                # reglas permanentes para Claude Code
├── LICENSE                  # MIT (si se aprueba P8)
├── README.md
├── index.html
├── package.json / package-lock.json
├── vite.config.js
├── vercel.json              # cabeceras de seguridad (CSP, etc.)
├── docs/
│   ├── constitution.md
│   ├── etapa-1-plan.md
│   └── checkpoints/         # un .md por etapa cerrada
├── scripts/
│   ├── seed-testnet.mjs     # siembra de testnet (claves efímeras)
│   ├── check-secrets.mjs    # falla si encuentra claves secretas en src/, scripts/ o dist/
│   └── check-network.mjs    # falla si encuentra URL o frase de red de mainnet en src/ o scripts/
├── src/
│   ├── main.jsx / App.jsx
│   ├── config/
│   │   ├── network.js       # frase de red TESTNET, URL de Horizon y Friendbot
│   │   └── testnet-assets.json
│   ├── core/
│   │   ├── validation.js
│   │   ├── amounts.js
│   │   ├── paymentRequest.js
│   │   ├── txBuilder.js
│   │   ├── paymentMatcher.js
│   │   └── errors.js
│   ├── adapters/
│   │   ├── wallet.js
│   │   └── network.js
│   └── ui/
│       ├── pages/           # Inicio, Comercio, Pagar, SimuladoVes, SimuladoCop
│       └── components/      # TestnetBanner, SimulatedBadge, TxLink, AddressDisplay, PaymentSummary
└── tests/                   # Vitest, una prueba por módulo de core/
```

## 4. Responsabilidad de cada componente

- **config/network.js:** constantes de red (frase de testnet, URL de Horizon testnet y Friendbot, URL base de stellar.expert testnet). Ningún otro archivo escribe esas cadenas.
- **config/testnet-assets.json:** lo escribe solo el script de siembra: códigos y emisores de VESDEMO y USDDEMO, IDs de los dos pools, ledger y fecha de la siembra. Solo datos públicos.
- **core/validation.js:** valida direcciones (solo G válidas por checksum), montos (texto, positivo, hasta 7 decimales, bajo el tope), memos (texto, hasta 28 bytes, juego de caracteres permitido), hashes (64 hexadecimales). Detecta texto con forma de clave secreta y lo rechaza con un aviso.
- **core/amounts.js:** convierte entre texto y stroops (BigInt); calcula el máximo a pagar (cotización + 1 %, redondeo hacia arriba). Nunca usa números decimales.
- **core/paymentRequest.js:** crea el enlace de cobro (destino, monto, código y emisor del activo, memo, fecha de creación y vencimiento) con los mismos nombres de campos que SEP-7 `pay`; lo analiza de forma estricta: rechaza activo o emisor distinto al de la configuración, parámetros repetidos, valores inválidos o vencidos.
- **core/txBuilder.js:** construye, a partir de datos validados: (a) la transacción de pago con recepción exacta (una operación, memo, vencimiento de 3 minutos, frase de testnet); (b) trustline hacia un activo de la configuración; (c) el cambio XLM→VESDEMO para la ayuda de testnet. También decodifica una transacción para generar el resumen previo a la firma.
- **core/paymentMatcher.js:** decide si un registro de pago de la red cumple un cobro: transacción exitosa, tipo de operación aceptado (pago o pago con ruta), destino, código y emisor, monto exacto en stroops, memo exacto y fecha posterior a la creación. Devuelve "llegó", "no coincide (motivo)" o "repetido".
- **core/errors.js:** traduce códigos de resultado de la red a mensajes claros en español (por ejemplo, precio cambió, el comercio no activó la recepción, transacción vencida, saldo insuficiente).
- **adapters/wallet.js:** inicia el kit solo con el módulo de Varial (antes Freighter; el nombre del módulo se confirma en la documentación del kit); conecta, obtiene la dirección, comprueba la red cuando el kit lo permita, firma y verifica que el hash firmado sea igual al construido.
- **adapters/network.js:** consulta cuentas y trustlines, cotiza rutas de recepción exacta, consulta pagos de una cuenta (con la transacción unida para leer el memo), consulta una transacción por hash, envía transacciones firmadas, llama a Friendbot. Reintentos limitados.
- **ui/pages:** Inicio (elige rol); Comercio (conectar, activar recepción, crear cobro, esperar, "Llegó"); Pagar (validar enlace, conectar, preparar cuenta, resumen, firma, resultado); SimuladoVes y SimuladoCop (maquetas con etiqueta).
- **ui/components:** banner TESTNET permanente, insignia SIMULADO, enlace al explorador desde hash validado, dirección mostrada completa, resumen de pago.
- **scripts/seed-testnet.mjs:** ver sección 5.A.
- **scripts/check-secrets.mjs y check-network.mjs:** se ejecutan después de cada compilación y antes de cerrar cada etapa.

## 5. Flujo de punta a punta

**A. Siembra (Luis, local, una vez y después de cada reinicio de testnet).** `npm run seed`:
1. Genera en memoria claves para el emisor de VESDEMO, el emisor de USDDEMO y un distribuidor; las fondea con Friendbot.
2. El distribuidor crea trustlines; los emisores emiten un suministro fijo.
3. El distribuidor deposita liquidez en los pools VESDEMO/USDDEMO y XLM/VESDEMO con una tasa ficticia de demo.
4. Bloquea las cuentas emisoras (peso de la clave maestra en 0).
5. Escribe `src/config/testnet-assets.json` solo con datos públicos e imprime en consola direcciones públicas y enlaces del explorador. No imprime ni escribe ninguna clave secreta.
6. Al terminar, las claves dejan de existir. Para recrear, se vuelve a correr y se hace commit de la nueva configuración.

**B. Comercio.** Conecta Freighter (cuenta "Comercio" de testnet). Si no tiene trustline de USDDEMO, botón "Activar recepción" (firma). Elige un producto del catálogo ficticio o escribe un monto. "Crear cobro" genera un memo aleatorio y el enlace de pago. Pantalla "Esperando pago" que consulta la red cada 5 segundos hasta el vencimiento del cobro.

**C. [SIMULADO] Cobro en bolívares.** Maqueta de cómo el cliente pagaría en bolívares reales. Etiqueta visible.

**D. Pagador.** Abre el enlace; la app lo valida (si falla, explica por qué y no deja seguir). Conecta Freighter (cuenta "Pagador"). Si no tiene XLM: botón Friendbot. Si no tiene trustline de VESDEMO: "Agregar VESDEMO" (firma). Si no tiene saldo: "Obtener VESDEMO de prueba" (cambio desde XLM, firma). Cotiza la ruta. Resumen: el comercio recibe exactamente X USDDEMO; pagas como máximo Y VESDEMO (incluye 1 %); dirección completa del comercio; vence en 3 minutos; aviso de enlace no verificado. Firma en Freighter. La app comprueba el hash, envía y muestra el resultado con el hash y el enlace a stellar.expert.

**E. Comercio.** La consulta encuentra un pago candidato; la app vuelve a consultar la transacción por hash y la pasa por el verificador. Si cumple: "¿Ya pagaron? Llegó." con monto, hash y enlace al explorador.

**F. [SIMULADO] Retiro en pesos.** Maqueta posterior a "Llegó". Etiqueta visible.

## 6. Matriz de responsabilidades

| Componente | Responsabilidad | Entradas | Salidas | Dependencias | Criticidad |
|---|---|---|---|---|---|
| validation | Rechazar todo dato inválido | Texto del usuario, del enlace, de la red | Valor válido o error | stellar-sdk (StrKey) | Alta |
| amounts | Aritmética de dinero exacta | Montos en texto | Stroops, máximo a pagar | Ninguna | Alta |
| paymentRequest | Crear y analizar el enlace | Datos del cobro / URL | Enlace / cobro validado | validation, config | Alta |
| txBuilder | Construir lo que se firma | Datos validados, cuenta, cotización | Transacción, resumen | stellar-sdk, config | Alta |
| paymentMatcher | Decidir "Llegó" | Registro de la red, cobro | Llegó / no / repetido | amounts, config | Alta |
| wallet | Conectar y firmar | Transacción | Transacción firmada verificada | Wallets Kit | Alta |
| network | Hablar con la red | Consultas | Datos de la red | stellar-sdk | Media |
| ui | Mostrar y guiar | Datos de core y adapters | Pantallas | React | Media |
| seed-testnet | Preparar activos y liquidez | Ninguna | Configuración pública | stellar-sdk | Media |
| check-secrets / check-network | Bloquear fugas y mainnet | Código y compilado | OK o fallo | Node | Alta |

## 7. Matriz de riesgos del proyecto (los de seguridad están en la constitution)

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| La API del kit v2 no es la que se recuerda | Media | Medio | Leer su documentación oficial al construir la Etapa 5; aislar en `wallet.js` |
| La CSP bloquea al kit (estilos o íconos) | Media | Medio | Probar en despliegue de vista previa; abrir solo la excepción mínima y documentarla |
| Horizon no encuentra la ruta a través del pool | Baja | Alto | Probar en la Etapa 3 con una cotización desde el script antes de construir la interfaz |
| Testnet se reinicia antes de la entrega | Baja | Alto | Revisar status.stellar.org; la siembra se recrea con un comando |
| Terceros vacían los pools | Baja | Medio | Volver a sembrar; mensaje claro de "sin ruta" |
| No alcanza el tiempo | Media | Alto | Orden de recorte de la sección 10, decidido de antemano |
| Afirmar de más en el pitch | Media | Alto | Revisión de textos en la Etapa 8 contra la sección 2 de la constitution |

## 8. Plan de validación y pruebas

**Pruebas unitarias (Vitest), Etapa 4:**
- validation: dirección válida, inválida, con checksum roto, dirección M (rechazo), texto con forma de clave secreta (rechazo con aviso); montos "10" y "10.1234567" válidos; "10.12345678", "0", "-1", "1e3", "abc", "", " 10" y montos sobre el tope rechazados; memo de más de 28 bytes rechazado; hash con largo o caracteres inválidos rechazado.
- amounts: ida y vuelta texto↔stroops; máximo a pagar con redondeo hacia arriba.
- paymentRequest: crear y luego analizar devuelve lo mismo; activo distinto, emisor distinto, parámetro repetido, cobro vencido: rechazo.
- txBuilder: una sola operación de recepción exacta con destino, activo, monto, máximo a pagar y memo correctos; vencimiento de 3 minutos o menos; frase de red de testnet. El resumen decodificado coincide con los datos de entrada.
- paymentMatcher: coincide → "llegó"; transacción fallida, emisor falso con el mismo código, monto menor o mayor, memo distinto, destino distinto, fecha anterior al cobro → "no coincide" con motivo; segundo pago con el mismo memo → "repetido".
- wallet (con firma simulada): si el hash firmado no coincide, se rechaza.

**Prueba de punta a punta manual (Etapas 5 y 6), con dos cuentas de testnet de Freighter:** activar recepción; crear cobro; abrir enlace en otra pestaña; Friendbot; agregar VESDEMO; obtener VESDEMO; pagar; ver "Llegó" en la pantalla del comercio; abrir los dos enlaces del explorador. Casos de error: enlace alterado a mano (monto, destino, emisor), firma rechazada en Freighter, cotización vencida, comercio sin trustline.

**Controles de seguridad (Etapa 7):** `check:secrets` y `check:network` en verde; `npm audit` sin altas ni críticas; búsqueda de `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` sin resultados; cabeceras revisadas en el despliegue; repaso de la tabla T1–T16 de la constitution, uno por uno.

**Criterios de aceptación (brief, sección 8, más los de este plan):**
1. Con una wallet de prueba se conecta, firma y la transacción aparece exitosa en el explorador, con el enlace visible.
2. El comercio recibe un activo distinto del enviado y el monto exacto que la red reporta; la plataforma no tiene cuentas ni saldos de clientes.
3. La pantalla del comercio muestra "Llegó" solo a partir de datos de la red.
4. Todo lo que no es real está etiquetado en pantalla y en el pitch.
5. El README explica cómo correr el proyecto desde cero (incluida la siembra) y qué es de prueba.
6. No hay claves secretas en el repo, el compilado ni el video.
7. El pitch explica en 5 minutos qué problema resuelve, para quién y por qué Stellar, sin presentarlo como pasarela operativa.

## 9. Secuencia de construcción

Cada etapa cierra con el checkpoint de la metodología y los comandos git que ejecuta Luis. No se avanza sin su aprobación.

| Etapa | Entregable cerrado | Qué NO se toca | Cierre | Estimación | Modelo sugerido en Code |
|---|---|---|---|---|---|
| 2. Repo seguro y esqueleto | `.gitignore` (primer commit), proyecto Vite + React con versiones exactas, Vitest, TypeScript solo como verificador (`jsconfig` con `checkJs` limitado a `src/core/`, script `typecheck`), scripts `check:secrets` y `check:network`, `vercel.json` con cabeceras, banner TESTNET, README inicial con aviso de límites, LICENSE si se aprueba | Lógica de pagos, script de siembra, kit de wallets | `npm run build`, `npm test` (vacío), `npm run typecheck` y los dos checks en verde; primer push | 40 min | Sonnet |
| 3. Siembra de testnet | `seed-testnet.mjs`, `config/network.js`, `testnet-assets.json` generado, una cotización de prueba desde el script | Interfaz, kit de wallets | Siembra exitosa, emisores bloqueados, enlaces del explorador revisados por Luis, cotización devuelve ruta | 45 min | Sonnet |
| 4. Núcleo lógico y pruebas | `core/` completo con JSDoc y pruebas de la sección 8 | Interfaz, kit, red real | Todas las pruebas y `typecheck` en verde | 60 min | Sonnet |
| 5. Flujo del pagador | `adapters/`, pantalla Pagar completa con wallet, preparación de cuenta, resumen, firma y resultado | Pantalla del comercio, maquetas | Pago real en testnet desde el navegador con hash y enlace | 90 min | Sonnet |
| 6. Flujo del comercio, maquetas y diseño final | Pantalla Comercio (activar recepción, crear cobro, esperar, "Llegó"), maquetas SIMULADO y aplicación de la dirección visual elegida a todas las pantallas | Funciones fuera del plan | Prueba de punta a punta manual completa, incluidos los casos de error | 75 min | Sonnet |
| 7. Endurecimiento y revisión de seguridad | Controles de la sección 8, ajustes, despliegue en Vercel | Funciones nuevas | Todos los controles en verde y repaso T1–T16 firmado | 60 min | **Opus, esfuerzo alto** |
| 8. Release y documentación | README final, guía de demo, guion del video (con Cowork), checklist de entrega en Apex | Código salvo correcciones de texto | Autoevaluación ≥ 95/100 de la metodología; enlaces cargados en Apex | 60 min + video | Sonnet |

**Dirección visual (antes de la primera pantalla, al inicio de la Etapa 5).** Code presenta 2–3 direcciones de estilo como una página estática de muestra (paleta, tipografía, una tarjeta de cobro y el estado "Llegó"). Luis elige una. Criterios: que no se vea genérica, que transmita confianza de pago, que funcione en móvil, contraste accesible, etiquetas TESTNET y SIMULADO integradas al diseño y no escondidas. Fuentes y recursos instalados como dependencias locales (nada de CDN, por la CSP). Si se usa un repo o skill de diseño (por ejemplo el `ui-ux-pro-max` que Luis ya usa), se trata como dependencia: aprobación y versión fijada. En la Etapa 5 se aplica a la pantalla Pagar; en la 6, al resto.

**Calendario orientativo [Suposición, depende de la disponibilidad real]:** viernes 6-nov, Etapas 2 a 4 y, si alcanza, inicio de la 5. Sábado 7-nov (después de la reunión de BAF de las 9 a. m. y en el aeropuerto), Etapas 5 y 6. Domingo 8-nov, Etapas 7 y 8, grabación y entrega con margen antes de las 23:59; sin funciones nuevas.

## 10. Orden de recorte si falta tiempo (decidido de antemano)

Se recorta en este orden, y solo lo necesario:
1. Exportar el enlace también como URI `web+stellar:pay` (ya es opcional).
2. Despliegue en Vercel: la demo se graba en local.
3. Ayuda "Obtener VESDEMO" en la app: se reemplaza por una opción del script de siembra que recibe la dirección pública del pagador (que ya agregó la trustline) y le envía VESDEMO durante la misma siembra. Sigue sin guardar secretos, pero solo sirve para las cuentas de Luis.
4. Catálogo de productos: queda solo el campo de monto.

**Nunca se recorta:** firma con wallet, pago con ruta real, detección de "Llegó" desde la red, enlace al explorador, etiquetas SIMULADO y TESTNET, controles de secretos.

## 11. Cómo responde el plan a la rúbrica Genesis

| Criterio | Peso | Qué lo cubre |
|---|---|---|
| Uso real de Stellar | 30 % | Activos emitidos, trustlines, pools de liquidez, pago con ruta de recepción exacta, memo, bloqueo de emisores, wallet vía Stellar Wallets Kit, transacciones visibles en stellar.expert |
| Demo de punta a punta en testnet desde el front | 30 % | Flujos D y E: wallet conectada, firma, resultado en stellar.expert y confirmación del comercio |
| Construido en 48 horas | 20 % | Commits de Luis desde el 6-nov después de la autorización; README con instrucciones |
| Problema y usuario concreto | 10 % | Comercio con clientes que pagan en bolívares |
| Claridad del pitch | 10 % | Guion en la Etapa 8: qué hace, para quién, por qué Stellar y qué es simulado |
