# Llegó

> ¿Ya pagaron? Llegó.

Prototipo de hackathon (Código Cordillera, BAF, track Genesis) que corre **solo en Stellar TESTNET**.
Demostración en línea: <https://llego-pied.vercel.app/> (necesita la wallet Varial, antes Freighter, en testnet).

## Límites: léelo antes de usarlo

- **TESTNET: nada de esto tiene valor real.** No mueve bolívares, pesos ni dólares reales.
- **No es una pasarela de pagos operativa.** No demuestra viabilidad comercial, tasas reales, cumplimiento normativo ni seguridad de producción.
- El cobro en bolívares y el retiro a pesos colombianos son maquetas con la etiqueta **"SIMULADO: no hay cobro ni retiro reales"**.
- Los activos de prueba se llaman VESDEMO (hace de bolívar) y USDDEMO (hace de dólar digital); no representan ningún activo real. Las tasas entre ellos (100 VESDEMO por USDDEMO y por XLM) son **ficticias**.
- No hay alianzas con proveedores reales. El comercio y los productos del catálogo son ficticios.
- Todo lo que se hace en testnet es público.
- El sitio está alojado en Vercel, que registra datos técnicos de acceso en sus propios registros. La app no usa cuentas, cookies propias ni analítica.

## El problema (ejemplo hipotético)

Un comercio de repuestos con muchos clientes en Venezuela, que pagan en bolívares, quiere recibir dólares digitales y decidir después si los pasa a pesos colombianos, los mantiene o los cambia. Llegó muestra, en testnet, la parte que Stellar sí resuelve: el cliente paga con un activo, el comercio recibe **exactamente** el monto cobrado en otro activo, en una sola transacción atómica, y el comercio sabe que el pago llegó **consultando la red**, sin confiar en lo que diga el cliente.

## Qué es real y qué es simulado

| Pieza | Estado |
|---|---|
| Conexión de wallet (Varial) y firma | Real en testnet |
| Activos de prueba, trustlines y pools de liquidez | Real en testnet |
| Pago con ruta de recepción exacta (strict-receive) | Real en testnet |
| Detección de "Llegó" por parte del comercio | Real: lectura de la red (Horizon) |
| Hash y enlace al explorador (stellar.expert) | Real en testnet |
| "Obtener VESDEMO de prueba" (cambio de XLM por VESDEMO) | Ayuda de testnet: representa que el cliente ya tiene bolívares |
| Cobro en bolívares reales | **SIMULADO** (maqueta) |
| Retiro a pesos colombianos | **SIMULADO** (maqueta) |

## Cómo funciona

1. **Comercio:** conecta su wallet, activa la recepción de USDDEMO (una firma) y crea un cobro. La app genera un memo aleatorio y un enlace de pago. La pantalla guarda la dirección del comercio al conectar y consulta la red con esa dirección cada 5 segundos.
2. **Pagador:** abre el enlace; la app lo valida y, si algo no cuadra, no deja continuar. Conecta su wallet, prepara su cuenta (XLM de Friendbot, recepción de VESDEMO, VESDEMO de prueba), ve un resumen decodificado de la propia transacción y firma. El pago es de **recepción exacta**: el comercio recibe el monto cobrado y el pagador fija un máximo a pagar (cotización + 1 %). La transacción vence a los 3 minutos.
3. **"Llegó":** solo aparece cuando un pago de la red cumple transacción exitosa, destino, activo (código y emisor), monto exacto, memo exacto y fecha posterior al cobro, y la transacción se vuelve a consultar por su hash antes de mostrarlo.

El estado del cobro vive en el enlace y en la red. No hay backend ni base de datos, y la app nunca pide, recibe ni guarda claves: solo la wallet firma.

## Cómo correrlo desde cero

Requisitos: Node 22.12 o superior y la extensión Varial (antes Freighter) con la red en TESTNET y dos cuentas de prueba (una de comercio y otra de pagador; nunca cuentas personales).

```bash
npm ci
npm run dev
```

Abre `http://localhost:5173/#comercio` para el comercio; el enlace de cobro abre la pantalla del pagador.

**Siembra de testnet (solo si hace falta recrear los activos, por ejemplo tras un reinicio de testnet):**

```bash
npm run seed
```

Crea con claves efímeras los emisores y el distribuidor, emite el suministro fijo, abre dos pools y bloquea a los emisores. Las claves viven solo en memoria durante el proceso: nunca se escriben en disco ni se imprimen. Escribe `src/config/testnet-assets.json` con datos públicos; hay que commitear el archivo nuevo.

### Comandos de control

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila y ejecuta `check:secrets`, `check:network` y `check:code` |
| `npm test` | Pruebas con Vitest (lógica de `core/` y de los scripts de control) |
| `npm run typecheck` | Revisión de tipos de `src/core/` (JSDoc, sin TypeScript) |
| `npm run check:secrets` | Busca claves secretas en `src/`, `scripts/` y `dist/` |
| `npm run check:network` | Busca referencias a mainnet en `src/` y `scripts/` |
| `npm run check:code` | Busca inyección de HTML, ejecución dinámica y recursos externos |
| `npm audit --audit-level=high` | Auditoría de dependencias |

## Activos y pools desplegados en testnet

- VESDEMO, emisor `GCJBP7A5SXWESI3YWBJYL75Y7K5RYWPPAD3II64GAMYA7OJLOWPYWTQO` (bloqueado, no puede emitir más).
- USDDEMO, emisor `GDULOXFRR6R2ULYLIGLT2X4A4COVZHHUVBYQM6TDZTWDELMHPJQIP4GK` (bloqueado).
- Pool USDDEMO/VESDEMO: [`f3515652…6acb`](https://stellar.expert/explorer/testnet/liquidity-pool/f351565203939b9bb20b0f2a67be039c3f4466daf0e0afc6bcc5a9d17f3c6acb)
- Pool XLM/VESDEMO: [`ae02ddd2…5985`](https://stellar.expert/explorer/testnet/liquidity-pool/ae02ddd2ac953bb78ad72ed0dec4e76c66a743c9a1e199f54c58ea8fca975985)

## Seguridad y riesgos aceptados

Diseño y modelo de amenazas en [`docs/constitution.md`](docs/constitution.md); evidencia por control en [`docs/checkpoints/etapa-7.md`](docs/checkpoints/etapa-7.md).

- Montos como texto y enteros en stroops (BigInt); comparación de activos por código y emisor; trustlines solo para los activos de la configuración.
- Solo testnet: la frase de red y las URL viven en un único archivo y un script falla la compilación si aparece algo de mainnet.
- CSP restrictiva y cabeceras de seguridad en [`vercel.json`](vercel.json); sin CDN, fuentes externas ni analítica.

Riesgos aceptados por ser un prototipo de testnet:

- **El enlace de cobro no está firmado.** Quien cambie el destino de un enlace válido obtiene otro enlace que la app acepta. La app muestra la dirección del comercio completa y avisa "Este enlace no está verificado: confirma la dirección del comercio". Mejora futura: enlaces firmados (que además no probarían por sí solos la identidad del comercio).
- Cualquiera puede operar en los pools de testnet y mover el precio; el máximo a pagar protege al pagador y la siembra se puede recrear.
- No se verifica la identidad del comercio; solo se muestra su dirección. Solo se aceptan direcciones G (no M).
- Horizon está en modo mantenimiento a favor de Stellar RPC; el acceso a la red está aislado en `src/adapters/network.js`.
- La wallet se conecta con `@stellar/freighter-api`, no con Stellar Wallets Kit: el kit no se pudo instalar a tiempo y arrastraba un árbol enorme de dependencias. Solo funciona con Varial (antes Freighter).
- El control `check:network` solo detecta la frase de mainnet escrita completa, no armada por partes.

## Cómo se construyó

Proyecto dirigido y aprobado por Luis; el código fue escrito con Claude Code (IA) en etapas con revisión humana de cada cambio. Los checkpoints de cada etapa están en [`docs/checkpoints/`](docs/checkpoints/).

## Autor

Luis Sánchez ([@Lems91](https://github.com/Lems91)): dirección y producto del proyecto.

## Licencia

MIT (ver `LICENSE`).
