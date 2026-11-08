// Creación y análisis estricto del enlace de cobro.
// Los nombres de los parámetros siguen SEP-7 `pay` (destination, amount, asset_code,
// asset_issuer, memo, memo_type); `created` y `expires` son propios (segundos Unix).
import { fail, ok } from './errors.js';
import { MAX_CHARGE_AMOUNT, validateAddress, validateAmount, validateMemo } from './validation.js';

/** Vigencia del cobro: 30 minutos. */
export const REQUEST_TTL_SECONDS = 30 * 60;

/** Margen tolerado si el reloj del pagador va adelantado respecto al del enlace. */
const CLOCK_SKEW_SECONDS = 60;

/**
 * @typedef {import('./validation.js').AssetsConfig} AssetsCfg
 * @typedef {{
 *   destination: string,
 *   amount: string,
 *   assetCode: string,
 *   assetIssuer: string,
 *   memo: string,
 *   createdAt: number,
 *   expiresAt: number
 * }} PaymentRequest
 */

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Convierte 16 bytes aleatorios en un memo de 22 caracteres (base64url sin relleno).
 * Los bytes deben venir del generador criptográfico del navegador (crypto.getRandomValues).
 * @param {Uint8Array} bytes Exactamente 16 bytes.
 * @returns {string}
 */
export function memoFromRandomBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
    throw new RangeError('Se requieren exactamente 16 bytes aleatorios');
  }
  let out = '';
  for (let i = 0; i < 16; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < 16 ? bytes[i + 1] : 0;
    const b2 = i + 2 < 16 ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
    if (i + 1 < 16) out += B64URL[(n >> 6) & 63];
    if (i + 2 < 16) out += B64URL[n & 63];
  }
  return out;
}

/**
 * Crea un cobro validado en USDDEMO.
 * @param {{ destination: unknown, amount: unknown, memo: unknown }} input
 * @param {AssetsCfg} assets Configuración validada de activos.
 * @param {number} nowMs Hora actual en milisegundos.
 * @returns {import('./errors.js').Result<PaymentRequest>}
 */
export function createPaymentRequest(input, assets, nowMs) {
  const destination = validateAddress(input.destination);
  if (!destination.ok) return destination;
  const amount = validateAmount(input.amount, { max: MAX_CHARGE_AMOUNT });
  if (!amount.ok) return amount;
  const memo = validateMemo(input.memo);
  if (!memo.ok) return memo;
  const createdAt = Math.floor(nowMs / 1000);
  return ok({
    destination: destination.value,
    amount: amount.value,
    assetCode: assets.assets.USDDEMO.code,
    assetIssuer: assets.assets.USDDEMO.issuer,
    memo: memo.value,
    createdAt,
    expiresAt: createdAt + REQUEST_TTL_SECONDS,
  });
}

/**
 * Serializa un cobro como cadena de consulta (sin el "?").
 * @param {PaymentRequest} request
 * @returns {string}
 */
export function buildPaymentQuery(request) {
  /** @type {Array<[string, string]>} */
  const pairs = [
    ['destination', request.destination],
    ['amount', request.amount],
    ['asset_code', request.assetCode],
    ['asset_issuer', request.assetIssuer],
    ['memo', request.memo],
    ['memo_type', 'text'],
    ['created', String(request.createdAt)],
    ['expires', String(request.expiresAt)],
  ];
  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

const KNOWN_KEYS = new Set([
  'destination',
  'amount',
  'asset_code',
  'asset_issuer',
  'memo',
  'memo_type',
  'created',
  'expires',
]);
const REQUIRED_KEYS = [
  'destination',
  'amount',
  'asset_code',
  'asset_issuer',
  'memo',
  'created',
  'expires',
];

/**
 * Analiza de forma estricta una cadena de consulta de cobro.
 * Rechaza: parámetros repetidos o desconocidos, valores inválidos, activo o emisor distinto al
 * de la configuración, cobros vencidos y cobros con vigencia mayor a 30 minutos.
 * @param {string} query Cadena de consulta, con o sin "?" inicial.
 * @param {AssetsCfg} assets Configuración validada de activos.
 * @param {number} nowMs Hora actual en milisegundos.
 * @returns {import('./errors.js').Result<PaymentRequest>}
 */
export function parsePaymentQuery(query, assets, nowMs) {
  if (typeof query !== 'string') return fail('El enlace de cobro no es válido.');
  const raw = query.startsWith('?') ? query.slice(1) : query;
  /** @type {Map<string, string>} */
  const params = new Map();
  for (const part of raw.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? '' : part.slice(eq + 1);
    let key;
    let value;
    try {
      key = decodeURIComponent(rawKey);
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      return fail('El enlace de cobro tiene caracteres inválidos.');
    }
    if (!KNOWN_KEYS.has(key)) return fail(`El enlace tiene un parámetro desconocido (${key}).`);
    if (params.has(key)) return fail(`El enlace repite el parámetro ${key}.`);
    params.set(key, value);
  }
  for (const key of REQUIRED_KEYS) {
    if (!params.has(key)) return fail(`Al enlace le falta el parámetro ${key}.`);
  }
  const memoType = params.get('memo_type');
  if (memoType !== undefined && memoType !== 'text') {
    return fail('El enlace usa un tipo de memo no soportado.');
  }

  const destination = validateAddress(params.get('destination'));
  if (!destination.ok) return destination;
  const amount = validateAmount(params.get('amount'), { max: MAX_CHARGE_AMOUNT });
  if (!amount.ok) return amount;
  const memo = validateMemo(params.get('memo'));
  if (!memo.ok) return memo;

  const usd = assets.assets.USDDEMO;
  if (params.get('asset_code') !== usd.code || params.get('asset_issuer') !== usd.issuer) {
    return fail('El enlace pide un activo distinto de USDDEMO. Solo se acepta el USDDEMO de esta app.');
  }

  const createdRaw = params.get('created') ?? '';
  const expiresRaw = params.get('expires') ?? '';
  if (!/^\d{1,10}$/.test(createdRaw) || !/^\d{1,10}$/.test(expiresRaw)) {
    return fail('Las fechas del enlace no son válidas.');
  }
  const createdAt = Number(createdRaw);
  const expiresAt = Number(expiresRaw);
  const nowSec = Math.floor(nowMs / 1000);
  if (expiresAt <= createdAt || expiresAt - createdAt > REQUEST_TTL_SECONDS) {
    return fail('La vigencia del enlace no es válida.');
  }
  if (createdAt > nowSec + CLOCK_SKEW_SECONDS) return fail('La fecha de creación del enlace es futura.');
  if (nowSec >= expiresAt) return fail('El cobro venció. Pide al comercio uno nuevo.');

  return ok({
    destination: destination.value,
    amount: amount.value,
    assetCode: usd.code,
    assetIssuer: usd.issuer,
    memo: memo.value,
    createdAt,
    expiresAt,
  });
}
