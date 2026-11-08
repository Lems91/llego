// Carga y valida la configuración pública generada por la siembra (scripts/seed-testnet.mjs).
import raw from './testnet-assets.json';
import { validateAssetsConfig } from '../core/validation.js';

/** Resultado de validar la configuración de activos; la UI debe revisar `ok` antes de usarla. */
export const assetsResult = validateAssetsConfig(raw);
