# Llegó

> ¿Ya pagaron? Llegó.

Prototipo de hackathon (Código Cordillera, BAF, track Genesis) que corre **solo en Stellar TESTNET**.

## Límites: léelo antes de usarlo

- **TESTNET: nada de esto tiene valor real.** No mueve bolívares, pesos ni dólares reales.
- **No es una pasarela de pagos operativa.** No demuestra viabilidad comercial, tasas reales, cumplimiento normativo ni seguridad de producción.
- El cobro en bolívares y el retiro a pesos colombianos serán maquetas etiquetadas **"SIMULADO: no hay cobro ni retiro reales"**.
- Los activos de prueba se llaman VESDEMO y USDDEMO; no representan ningún activo real.
- No hay alianzas con proveedores reales.
- Todo lo que se hace en testnet es público.
- El sitio se alojará en Vercel, que registra datos técnicos de acceso en sus propios registros. La app no usa cuentas, cookies propias ni analítica.

## Estado

Etapa 2 (esqueleto del repositorio). Todavía no hay lógica de pagos, siembra de testnet ni conexión con wallets; eso llega en las etapas siguientes (ver `docs/etapa-1-plan.md`).

## Cómo correrlo

Requiere Node 22.12 o superior.

```bash
npm ci
npm run dev
```

## Comandos de control

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila y luego ejecuta `check:secrets` y `check:network` |
| `npm test` | Pruebas con Vitest |
| `npm run typecheck` | Revisión de tipos de `src/core/` (JSDoc, sin TypeScript) |
| `npm run check:secrets` | Busca claves secretas en `src/`, `scripts/` y `dist/` |
| `npm run check:network` | Busca referencias a mainnet en `src/` y `scripts/` |

## Licencia

MIT (ver `LICENSE`).
