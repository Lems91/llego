// Decide si un registro de pago de la red cumple un cobro. Es la ÚNICA puerta hacia "Llegó".
import { toStroops, isAmountFormat } from './amounts.js';
import { validateAddress, validateHash } from './validation.js';

/**
 * Registro de pago ya normalizado por adapters/network.js a partir de Horizon.
 * @typedef {{
 *   hash: string,
 *   successful: boolean,
 *   type: string,
 *   to: string,
 *   assetType: string,
 *   assetCode: string | null,
 *   assetIssuer: string | null,
 *   amount: string,
 *   memo: string | null,
 *   memoType: string | null,
 *   createdAt: string
 * }} NetworkPayment
 */

/**
 * @typedef {{ status: 'llegó', hash: string }
 *   | { status: 'no-coincide', reason: string }
 *   | { status: 'repetido', hash: string, firstHash: string }} MatchResult
 */

/** Tipos de operación aceptados: pago directo o pago con ruta de recepción exacta. */
const ACCEPTED_TYPES = new Set(['payment', 'path_payment_strict_receive']);

/**
 * @param {string} reason
 * @returns {MatchResult}
 */
function noMatch(reason) {
  return { status: 'no-coincide', reason };
}

/**
 * Evalúa un registro contra el cobro.
 * @param {NetworkPayment} record
 * @param {import('./paymentRequest.js').PaymentRequest} request
 * @param {string | null} [firstMatchedHash] Hash de un pago anterior que ya cumplió este cobro.
 * @returns {MatchResult}
 */
export function matchPayment(record, request, firstMatchedHash = null) {
  const hash = validateHash(record?.hash);
  if (!hash.ok) return noMatch('El registro no trae un hash válido.');
  if (record.successful !== true) return noMatch('La transacción no fue exitosa.');
  if (!ACCEPTED_TYPES.has(record.type)) return noMatch('El tipo de operación no es un pago.');
  if (!validateAddress(record.to).ok || record.to !== request.destination) {
    return noMatch('El destino no es el comercio.');
  }
  if (
    record.assetType === 'native' ||
    record.assetCode !== request.assetCode ||
    record.assetIssuer !== request.assetIssuer
  ) {
    return noMatch('El activo no es el USDDEMO de esta app (código y emisor).');
  }
  if (!isAmountFormat(record.amount) || toStroops(record.amount) !== toStroops(request.amount)) {
    return noMatch('El monto recibido no es exactamente el cobrado.');
  }
  if (record.memoType !== 'text' || record.memo !== request.memo) {
    return noMatch('El memo no coincide con el del cobro.');
  }
  const createdMs = Date.parse(record.createdAt);
  if (Number.isNaN(createdMs) || createdMs < request.createdAt * 1000) {
    return noMatch('El pago es anterior a la creación del cobro.');
  }
  if (firstMatchedHash !== null && firstMatchedHash !== hash.value) {
    return { status: 'repetido', hash: hash.value, firstHash: firstMatchedHash };
  }
  return { status: 'llegó', hash: hash.value };
}

/**
 * Recorre pagos (en cualquier orden) y busca el primero que cumple el cobro; los demás pagos que
 * también lo cumplirían se informan como repetidos.
 * @param {NetworkPayment[]} records
 * @param {import('./paymentRequest.js').PaymentRequest} request
 * @returns {{ arrived: NetworkPayment | null, duplicates: string[], rejected: Array<{ hash: string, reason: string }> }}
 */
export function findArrival(records, request) {
  const ordered = [...records].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  /** @type {NetworkPayment | null} */
  let arrived = null;
  /** @type {string[]} */
  const duplicates = [];
  /** @type {Array<{ hash: string, reason: string }>} */
  const rejected = [];
  for (const record of ordered) {
    const result = matchPayment(record, request, arrived ? arrived.hash : null);
    if (result.status === 'llegó') arrived = record;
    else if (result.status === 'repetido') duplicates.push(result.hash);
    else rejected.push({ hash: String(record?.hash), reason: result.reason });
  }
  return { arrived, duplicates, rejected };
}
