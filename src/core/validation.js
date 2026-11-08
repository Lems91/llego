// Validación estricta de todo dato externo (usuario, enlace, red, configuración).
import { StrKey } from '@stellar/stellar-sdk';
import { fail, ok } from './errors.js';
import { isAmountFormat, toStroops } from './amounts.js';

/** Tope por cobro, en USDDEMO. */
export const MAX_CHARGE_AMOUNT = '10000';

/** Aviso que se muestra cuando un campo recibe algo con forma de clave secreta. */
export const SECRET_KEY_WARNING = 'Nunca pegues tu clave secreta aquí.';

const SECRET_RE = /\bS[A-Z2-7]{55}\b/;
const MEMO_RE = /^[A-Za-z0-9_-]{1,28}$/; // solo ASCII: 1 carácter = 1 byte (máximo 28 bytes)
const HASH_RE = /^[0-9a-fA-F]{64}$/;

/**
 * ¿El texto contiene algo con forma de clave secreta de Stellar (S + 55 caracteres base32)?
 * @param {unknown} text
 * @returns {boolean}
 */
export function looksLikeSecretKey(text) {
  return typeof text === 'string' && SECRET_RE.test(text);
}

/**
 * Valida una dirección pública G. Rechaza claves secretas (con aviso) y direcciones M.
 * @param {unknown} text
 * @returns {import('./errors.js').Result<string>}
 */
export function validateAddress(text) {
  if (typeof text !== 'string') return fail('La dirección debe ser texto.');
  if (looksLikeSecretKey(text)) return fail(SECRET_KEY_WARNING);
  if (StrKey.isValidMed25519PublicKey(text)) {
    return fail('Las direcciones M no se aceptan en este prototipo. Usa una dirección G.');
  }
  if (!StrKey.isValidEd25519PublicKey(text)) {
    return fail('La dirección no es válida. Debe empezar por G y tener 56 caracteres.');
  }
  return ok(text);
}

/**
 * Valida un monto: texto, positivo, hasta 7 decimales y, si se indica, bajo el tope.
 * @param {unknown} text
 * @param {{ max?: string }} [opts] Tope inclusivo, en texto.
 * @returns {import('./errors.js').Result<string>}
 */
export function validateAmount(text, opts = {}) {
  if (typeof text === 'string' && looksLikeSecretKey(text)) return fail(SECRET_KEY_WARNING);
  if (!isAmountFormat(text)) {
    return fail('El monto debe ser un número positivo con hasta 7 decimales (por ejemplo 10.50).');
  }
  const stroops = toStroops(text);
  if (stroops <= 0n) return fail('El monto debe ser mayor que cero.');
  if (opts.max !== undefined && stroops > toStroops(opts.max)) {
    return fail(`El monto supera el máximo permitido (${opts.max}).`);
  }
  return ok(text);
}

/**
 * Valida un memo de texto: 1 a 28 bytes, solo letras, números, guion y guion bajo.
 * @param {unknown} text
 * @returns {import('./errors.js').Result<string>}
 */
export function validateMemo(text) {
  if (typeof text !== 'string') return fail('El memo debe ser texto.');
  if (looksLikeSecretKey(text)) return fail(SECRET_KEY_WARNING);
  if (!MEMO_RE.test(text)) {
    return fail('El memo debe tener de 1 a 28 caracteres: letras, números, guion o guion bajo.');
  }
  return ok(text);
}

/**
 * Valida un hash de transacción (64 hexadecimales) y lo devuelve en minúsculas.
 * @param {unknown} text
 * @returns {import('./errors.js').Result<string>}
 */
export function validateHash(text) {
  if (typeof text !== 'string' || !HASH_RE.test(text)) {
    return fail('El hash debe tener exactamente 64 caracteres hexadecimales.');
  }
  return ok(text.toLowerCase());
}

/**
 * @typedef {{ code: string, issuer: string }} AssetRef
 * @typedef {{
 *   network: string,
 *   assets: { VESDEMO: AssetRef, USDDEMO: AssetRef },
 *   pools: { vesUsd: { id: string }, xlmVes: { id: string } }
 * }} AssetsConfig
 */

/**
 * Valida el contenido de testnet-assets.json antes de usarlo.
 * @param {any} config
 * @returns {import('./errors.js').Result<AssetsConfig>}
 */
export function validateAssetsConfig(config) {
  if (!config || typeof config !== 'object') return fail('Configuración de activos ausente.');
  if (config.network !== 'TESTNET') return fail('La configuración no es de TESTNET.');
  const ves = config.assets?.VESDEMO;
  const usd = config.assets?.USDDEMO;
  if (ves?.code !== 'VESDEMO' || usd?.code !== 'USDDEMO') {
    return fail('Los códigos de activo de la configuración no son VESDEMO y USDDEMO.');
  }
  if (!validateAddress(ves.issuer).ok || !validateAddress(usd.issuer).ok) {
    return fail('El emisor de un activo de la configuración no es una dirección válida.');
  }
  if (ves.issuer === usd.issuer) return fail('Los emisores de VESDEMO y USDDEMO deben ser distintos.');
  if (!validateHash(config.pools?.vesUsd?.id).ok || !validateHash(config.pools?.xlmVes?.id).ok) {
    return fail('El identificador de un pool de la configuración no es válido.');
  }
  return ok(config);
}
