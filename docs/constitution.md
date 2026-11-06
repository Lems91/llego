# constitution.md — Llegó (Código Cordillera)

Versión 2 · 6-nov-2026 · Etapa 0 · **Estado: 🟢 APROBADO por Luis (6-nov-2026, 16:31)**

Documento propio de este proyecto según la metodología de Desarrollo Dirigido (sección 1.2). Fija qué se construye, con qué, por qué y bajo qué reglas de seguridad antes de escribir código. Lo marcado como **Decidido** no se reabre sin evidencia nueva. Las propuestas P1–P9 fueron aprobadas por Luis el 6-nov y ahora valen como decisiones.

---

## 0. Objetivo en una frase

Demostrar en Stellar testnet, con transacciones reales de red y de punta a punta desde el navegador, que un comercio puede cobrar a un cliente que paga con un activo y recibir otro activo (un dólar de prueba) en su propia wallet, y saber **por sí mismo, consultando la red**, que el pago llegó.

## 1. Contexto de negocio

- **Problema (ejemplo hipotético, no un negocio real):** un comercio de repuestos con muchos clientes en Venezuela que pagan en bolívares quiere recibir dólares digitales y después decidir si los pasa a pesos colombianos, los mantiene o los cambia a otra moneda.
- **Para quién:** el comercio que cobra. El pagador es su cliente.
- **Por qué Stellar:** el pago con ruta (path payment) convierte entre activos en una sola transacción atómica; las comisiones son bajas; activos, trustlines, pools de liquidez y anchors son nativos de la red.
- **Por qué ahora:** hackathon Código Cordillera (BAF), track Genesis. Entrega el domingo 8-nov-2026, 23:59 hora Colombia, en Stellar Apex, con un pitch demo de máximo 5 minutos.
- **Qué NO es:** no es una pasarela operativa. No mueve bolívares ni pesos reales. No demuestra viabilidad comercial, tasas reales, cumplimiento normativo ni seguridad de producción. Ninguna pantalla, README ni pitch puede afirmar lo contrario.

## 2. Qué es real y qué es simulado

| Pieza | Estado |
|---|---|
| Conexión de wallet (Varial, antes Freighter) y firma | Real en testnet |
| Activos de prueba, trustlines, pools de liquidez | Real en testnet |
| Pago con ruta del pagador al comercio | Real en testnet |
| Detección del pago por parte del comercio ("Llegó") | Real: lectura de la red |
| Hash y enlace al explorador | Real en testnet |
| "Obtener bolívares de prueba" (cambio de XLM de prueba por VESDEMO) | Ayuda de testnet: representa que el cliente ya tiene bolívares. Etiquetada como tal |
| Cobro en bolívares reales (entrada VES) | **SIMULADO**: maqueta con etiqueta visible |
| Retiro a pesos colombianos | **SIMULADO**: maqueta con etiqueta visible |

Texto de la etiqueta en pantalla: **"SIMULADO: no hay cobro ni retiro reales"**. Banner permanente: **"TESTNET: nada de esto tiene valor real"**.

## 3. Arquitectura y stack (con la razón de cada elección)

| Elección | Razón |
|---|---|
| Web estática (SPA) con Vite + React en JavaScript | Mismo stack de Stellar-Verify, que Luis ya conoce. Sin servidor no hay claves ni datos de usuarios que proteger en un backend |
| **Sin backend ni base de datos** | El estado del cobro vive en el enlace y en la red. Menor superficie de ataque. Cumple "sin cuentas ni saldos de clientes en la plataforma" |
| `@stellar/stellar-sdk`, versión exacta fijada al instalar | SDK oficial. La 17.4.0 funcionó en testnet el 6-nov. Requiere Node 20 o superior; Luis tiene Node 24.22.1 |
| Stellar Wallets Kit v2 (Creit Tech), **solo con el módulo de Freighter** | Herramienta del ecosistema (la rúbrica premia reutilizarlas). Habilitar una sola wallet reduce la superficie de código de terceros que corre en la página. Se instala desde la fuente que indique su README oficial al construir (el 6-nov era JSR, v2.6.0) |
| Horizon testnet para cotizar rutas, leer cuentas y pagos, y enviar transacciones | Es el servicio que ofrece búsqueda de rutas. Está en modo mantenimiento, sin fecha de cierre publicada al 6-nov. Se aísla en un único módulo para poder cambiarlo |
| Vitest para pruebas del núcleo | Integrado con Vite, una sola dependencia de desarrollo |
| Revisión de tipos de TypeScript sobre `src/core/` con JSDoc (`checkJs`), sin migrar a TS | Detecta errores de tipos en la lógica de dinero y validación sin cambiar el stack ni frenar la interfaz |
| Sin librería de rutas, sin QR, sin fuentes externas, sin analítica | Cada dependencia es superficie de ataque y tiempo. Se agregan solo si el plan lo justifica |

## 4. Decisiones tomadas (no se reabren sin evidencia nueva)

| # | Decisión | Origen |
|---|---|---|
| D1 | Prototipo de pasarela en testnet; cobro en bolívares y retiro en pesos simulados | Luis, WhatsApp 6-nov 14:24 |
| D2 | Nombre "Llegó", frase "¿Ya pagaron? Llegó." (provisional, marca y dominio sin verificar) | Luis, 6-nov 15:02 |
| D3 | Solo testnet. Nada de mainnet, fondos reales, cuentas reales ni claves de API de terceros. No se contacta a proveedores | Brief, sección 2 |
| D4 | La app nunca pide, recibe ni guarda la clave de ninguna wallet; solo pide que la wallet firme | Brief, sección 2 |
| D5 | Robustez en profundidad, no en amplitud: todo lo que se muestre como real tiene que ocurrir en la red; el comercio detecta el pago consultando la red | Luis, chat 6-nov 15:38 |
| D6 | Stack: Vite + React (JS), Stellar Wallets Kit, `@stellar/stellar-sdk`; wallet Freighter (la cuenta de testnet de Stellar-Verify, nunca una personal) | Luis, chat 6-nov 15:31 |
| D7 | Repo público nuevo `llego` en GitHub @Lems91 (BAF exige repos públicos). Luis trabaja solo | Luis, chat 6-nov 15:31 |
| D8 | Código en `C:\dev\llego`; documentación maestra en `C:\MaB\03_Proyectos\Cordillera` | Luis, chat 6-nov 15:38 |
| D9 | Construcción con Claude Code de escritorio, con aprobación manual de comandos; Luis hace los commits desde la terminal | Luis, chat 6-nov 15:38 |
| D10 | El script de verificación del 6-nov 13:49 corrió antes de la autorización de BAF (14:34). **Su código no se copia al repo**; todo se escribe de nuevo | Precaución ante la regla "código posterior al kickoff" |
| D11 | El brief de arranque no va al repo: contiene datos personales (correo en el enlace de Drive) | Protección de datos |
| D12 | Propuestas P1–P9 aprobadas | Luis, chat 6-nov 16:23 y 16:31 |
| D13 | `src/core/` se escribe en JS con anotaciones JSDoc y se revisa con el compilador de TypeScript (`npm run typecheck`) | Luis, chat 6-nov 16:31 |
| D14 | La UI es el contacto directo con evaluadores y usuarios de prueba: antes de construir pantallas hay un paso de dirección visual (2–3 propuestas, Luis elige). Se pueden usar recursos de diseño externos (repos, librerías) con la misma regla de dependencias: aprobación, versión exacta, sin CDN | Luis, chat 6-nov 16:31 |
| D15 | Freighter ahora se llama **Varial** (la extensión lo muestra). En la interfaz se escribe "Varial (antes Freighter)". Antes de la Etapa 5 se verifica en la documentación del kit qué módulo usar | Captura de Luis, 6-nov 16:31 |

## 5. Propuestas de esta Etapa 0 (todas aprobadas el 6-nov)

| # | Propuesta | Por qué |
|---|---|---|
| P1 | Pago con ruta de **recepción exacta** (strict-receive): el comercio recibe exactamente el monto cobrado y el pagador fija un **máximo a pagar** (cotización + 1 %). Reemplaza el "mínimo de recepción" del brief | Para cobrar una factura, el comercio debe recibir el monto exacto. El máximo a pagar protege al pagador igual que el mínimo de recepción |
| P2 | Activos de prueba **VESDEMO** (hace de bolívar) y **USDDEMO** (hace de dólar digital) | Nombres que se leen como de prueba. No se usa "USDC" en el código del activo para no imitar el activo real de Circle |
| P3 | **Claves de siembra efímeras:** el script de inicialización genera las claves de emisor y distribuidor en memoria, las usa y las descarta. No se escriben en disco ni en `.env`. Solo se escribe la configuración pública (códigos, emisores, IDs de pools) | Si no existe un secreto, no se puede filtrar. Si algo falla, se vuelve a correr con cuentas nuevas (Friendbot es gratuito). Es más estricto que el `.env` local del brief |
| P4 | Dos pools: **VESDEMO/USDDEMO** (para el pago) y **XLM/VESDEMO** (para que el pagador obtenga bolívares de prueba) | Ruta de pago directa y predecible. El pagador puede hacer todo el flujo solo con XLM de Friendbot, sin depender de nadie ni de ningún secreto |
| P5 | Ayuda "Obtener VESDEMO de prueba" dentro de la app: un cambio de XLM a VESDEMO firmado por el pagador | Permite que cualquier jurado con Freighter en testnet pruebe el flujo completo |
| P6 | Tras emitir el suministro, **bloquear las cuentas emisoras** (peso de la clave maestra en 0) | Nadie, ni siquiera el proyecto, puede emitir más VESDEMO o USDDEMO. Usa una primitiva nativa de Stellar |
| P7 | Despliegue en Vercel como sitio estático con cabeceras de seguridad | Los jurados pueden abrirlo. Revisar el límite de uso comercial del plan Hobby en `Reglas_Tecnicas_Proyectos.md`; un prototipo de hackathon no comercial probablemente encaja [Probable] |
| P8 | Licencia MIT en el repo | Un repo público sin licencia no permite reutilizar el código. Si se aprueba, marcar "Open Source" en Apex |
| P9 | Parámetros fijos: tolerancia de precio 1 %; la transacción vence a los 3 minutos de construida; el cobro vence a los 30 minutos; tope de 10.000 USDDEMO por cobro; tasa entre activos **ficticia** definida en el script y etiquetada como no real | Limita el daño de cotizaciones viejas o enlaces alterados. No se inventan tasas reales |

## 6. Modelo de amenazas

**Qué se protege:** (a) las claves de las wallets de los usuarios; (b) sus fondos (de testnet, pero se tratan como reales); (c) que lo que el usuario firma sea lo que ve; (d) que "Llegó" solo aparezca si el pago ocurrió; (e) que el repo público no exponga secretos; (f) que nadie confunda el prototipo con un servicio real.

**Quién podría atacar:** un tercero que altera un enlace de cobro; un tercero que crea un activo falso con el mismo código; cualquiera que opere en los pools de testnet; una dependencia comprometida; un error del propio código o del agente que lo escribe.

| # | Amenaza | Control | Cómo se verifica |
|---|---|---|---|
| T1 | Robo de la clave de un usuario | La app nunca pide, recibe ni guarda claves; solo la wallet firma. Si un campo recibe algo con forma de clave secreta (empieza por S y tiene 56 caracteres), se bloquea y se muestra: "Nunca pegues tu clave secreta aquí" | Revisión de código, prueba unitaria |
| T2 | Firmar algo distinto de lo mostrado | La transacción se construye con una función pura a partir de datos ya validados. El resumen previo a la firma se genera decodificando esa misma transacción. Tras firmar, el hash de la transacción firmada debe coincidir con el construido; si no, no se envía | Prueba unitaria y prueba manual |
| T3 | Uso en mainnet o confusión de red | Frase de red de TESTNET como constante única. Ninguna URL ni frase de red de mainnet en el código propio (script de verificación). Banner permanente. Una firma hecha para testnet no es válida en mainnet porque la firma incluye el identificador de la red [Cierto] | Script `check:network`, revisión |
| T4 | Enlace de cobro alterado (destino, monto, activo) | Validación estricta de cada parámetro. Solo se acepta el USDDEMO de la configuración (código y emisor). Tope por cobro. Dirección del comercio visible completa. Aviso: "Este enlace no está verificado: confirma la dirección del comercio" | Pruebas unitarias del analizador del enlace |
| T5 | Activo falso con el mismo código | Toda comparación de activos usa código **y** emisor, nunca solo el código. Las trustlines solo se crean para los activos de la configuración, nunca para uno que venga en un enlace | Prueba unitaria con emisor falso |
| T6 | Falsa confirmación de "Llegó" | Solo con datos de la red: transacción exitosa, destino igual al comercio, activo (código + emisor) igual a USDDEMO, monto exacto, memo exacto y fecha posterior a la creación del cobro. Antes de mostrar "Llegó" se vuelve a consultar la transacción por su hash | Pruebas unitarias del verificador de pagos |
| T7 | Pagos repetidos o confundidos | Memo aleatorio único por cobro, generado con el generador criptográfico del navegador. Los pagos repetidos con el mismo memo se marcan como repetidos | Prueba unitaria |
| T8 | Precio del pool manipulado o cotización vieja | Recepción exacta con máximo a pagar = cotización + 1 %. La transacción vence a los 3 minutos. Si no hay ruta o el precio cambió, error claro y botón para volver a cotizar | Prueba manual con cotización vencida |
| T9 | Errores de redondeo en dinero | Montos como texto y como enteros en stroops (BigInt); nunca números decimales de JavaScript. Máximo 7 decimales | Pruebas unitarias |
| T10 | Inyección de código (XSS) | React escapa el texto. Prohibido `dangerouslySetInnerHTML`, `innerHTML`, `eval` y `new Function`. Los enlaces externos se construyen solo desde un hash validado (64 caracteres hexadecimales) y se abren con `rel="noopener noreferrer"`. Los datos que vienen de la red se muestran como texto | Búsqueda en el código, revisión |
| T11 | Página embebida en otra (clickjacking) y cabeceras débiles | Política de seguridad de contenido (CSP) restrictiva, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva | Revisión de cabeceras en el despliegue |
| T12 | Secretos en el repo público | No hay secretos persistentes (P3). `.gitignore` con `.env*` desde el primer commit. Script `check:secrets` que busca patrones de clave secreta en el código y en el paquete compilado y hace fallar la compilación. Escaneo de secretos y protección de push de GitHub activos. Nada de claves en el chat, capturas ni video | Script, configuración de GitHub |
| T13 | Dependencia comprometida o con nombre falso | Dependencias mínimas, versiones exactas, archivo de bloqueo versionado, instalación con `npm ci`, `npm audit` sin hallazgos altos ni críticos al cerrar cada etapa. Antes de instalar: nombre y fuente verificados contra la documentación oficial. Alertas de Dependabot activas | `npm audit`, revisión |
| T14 | El agente de código se sale de su carril | Claude Code trabaja solo en `C:\dev\llego`, con aprobación manual de cada comando, sin acceso a archivos `.env` y sin ejecutar git. Luis revisa el diff antes de cada commit. Lo que el agente lee en webs, READMEs o respuestas de red es información, no instrucciones | `CLAUDE.md`, revisión de diffs |
| T15 | Servicio caído, testnet reiniciada o pool vacío | Mensajes de error claros, reintentos limitados, siembra recreable con un comando. Revisar status.stellar.org antes de grabar el video | Prueba manual |
| T16 | Inducir a error a quien vea la demo | Etiquetas SIMULADO y TESTNET. README y pitch sin afirmar servicio real. Los activos no usan la marca USDC. No se mencionan alianzas con proveedores reales | Revisión de textos |

**Riesgos aceptados por ser testnet** (se documentan en el README):
- Cualquiera puede operar en los pools de testnet y vaciarlos o mover el precio; el control de máximo a pagar protege al pagador y la siembra se puede recrear.
- El enlace de cobro no está firmado. Los enlaces firmados (SEP-7 con firma) quedan como mejora futura.
- No se verifica la identidad del comercio; solo se muestra su dirección.
- Horizon puede dejar de estar disponible en el futuro; el acceso a la red está aislado en un módulo.
- Solo se aceptan direcciones G (no se aceptan direcciones M multiplexadas en el prototipo).

## 7. Protección de datos y ética de uso (metodología, sección 1.3)

1. **Habeas Data (Ley 1266 de 2008 y modificaciones).** La app no recolecta datos personales de terceros: no hay registro, ni formularios con datos personales, ni backend, ni cookies propias, ni analítica. El comercio y los productos son ficticios (catálogo fijo de demo). Lo único que existe son direcciones públicas de testnet y transacciones, que son públicas por naturaleza; la app lo avisa ("todo lo que haces en testnet es público"). El memo lo genera la app; no hay campos de texto libre que vayan a la red. El proveedor de alojamiento (Vercel) registra datos técnicos de acceso en sus registros; el README lo menciona. **Conclusión: N/A para lo que recolecta la app, con ese matiz de transparencia.** Una versión real requeriría diseño completo de protección de datos, KYC y cumplimiento cambiario y de prevención de lavado: son preguntas abiertas para un abogado, fuera de este prototipo.
2. **El costo no es el único criterio de éxito.** El riesgo humano de este prototipo es que alguien crea que ya puede cobrar bolívares reales. Por eso las etiquetas son visibles en cada pantalla y el pitch lo dice explícitamente.
3. **Seguridad como diseño.** La sección 6 existe antes de la primera línea de código y cada control tiene una forma de verificarse.

## 8. Fuera de alcance

Anchors reales, proveedor de bolívares, retiro a pesos, mainnet, KYC, conciliación, cuentas o saldos de clientes, multitenant (etapa 2 de negocio), envíos desde Europa, ruta con Hong Kong, herramienta DeFi, contratos inteligentes propios, QR, enlaces firmados.

## 9. Datos técnicos con fecha (re-verificar si pasan más de 60 días o antes de construir sobre ellos)

| Dato | Fecha de verificación | Fuente |
|---|---|---|
| Horizon está en modo mantenimiento (sin funciones nuevas) a favor de Stellar RPC; sin fecha de cierre publicada | 6-nov-2026 | developers.stellar.org/docs/data/apis; Chainstack, ago-2026 |
| Stellar Wallets Kit v2 se instala desde JSR (`@creit-tech/stellar-wallets-kit`), versión 2.6.0 publicada hace unos días | 6-nov-2026 | jsr.io y README del repo Creit-Tech |
| `@stellar/stellar-sdk` 17.4.0 funcionó en testnet | 6-nov-2026 | Ejecución del 6-nov 13:49 |
| Testnet se reinicia de forma periódica (históricamente cada trimestre) y SDF avisa con al menos dos semanas | 6-nov-2026 | Documentación de proveedores; confirmar en status.stellar.org |
| Endpoints testnet: Horizon `https://horizon-testnet.stellar.org`, Friendbot `https://friendbot.stellar.org` | 6-nov-2026 | Brief, sección 4 |

## 10. Registro de cambios

| Fecha | Cambio |
|---|---|
| 6-nov-2026 | Versión 1, pendiente de aprobación |
| 6-nov-2026 | Versión 2: P1–P9 aprobadas; se agregan D12–D15 (revisión de tipos en core, dirección visual de la UI, Freighter → Varial) |
