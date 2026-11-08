// Resultados tipados y traducción de errores de la red a mensajes claros en español.

/**
 * @template T
 * @typedef {{ ok: true, value: T } | { ok: false, error: string }} Result
 */

/**
 * @template T
 * @param {T} value
 * @returns {{ ok: true, value: T }}
 */
export function ok(value) {
  return { ok: true, value };
}

/**
 * @param {string} error Mensaje en español, apto para mostrar al usuario.
 * @returns {{ ok: false, error: string }}
 */
export function fail(error) {
  return { ok: false, error };
}

/** @type {Record<string, string>} */
const TX_MESSAGES = {
  tx_too_late: 'La transacción venció. Vuelve a cotizar y firma de nuevo.',
  tx_too_early: 'La transacción todavía no es válida. Vuelve a intentarlo.',
  tx_bad_seq: 'Tu cuenta cambió mientras firmabas. Vuelve a intentarlo.',
  tx_insufficient_balance: 'No tienes saldo suficiente de XLM para cubrir la comisión y la reserva.',
  tx_insufficient_fee: 'La comisión de red es insuficiente. Vuelve a intentarlo.',
  tx_bad_auth: 'La firma no es válida para esta cuenta.',
  tx_bad_auth_extra: 'La transacción trae firmas de más.',
  tx_no_source_account: 'La cuenta de origen no existe en testnet. Fóndala con Friendbot.',
  tx_internal_error: 'La red tuvo un error interno. Vuelve a intentarlo en unos segundos.',
};

/** @type {Record<string, string>} */
const OP_MESSAGES = {
  op_underfunded: 'Saldo insuficiente para este pago.',
  op_over_sendmax: 'El precio cambió y ya no alcanza con el máximo a pagar. Vuelve a cotizar.',
  op_too_few_offers: 'No hay liquidez suficiente para esta ruta. Vuelve a cotizar más tarde.',
  op_no_destination: 'La cuenta del comercio no existe en testnet.',
  op_no_trust: 'El comercio no activó la recepción de USDDEMO.',
  op_not_authorized: 'El comercio no está autorizado para recibir este activo.',
  op_line_full: 'La cuenta del comercio llegó a su límite de este activo.',
  op_src_no_trust: 'Tu cuenta no tiene activada la recepción de VESDEMO.',
  op_src_not_authorized: 'Tu cuenta no está autorizada para enviar este activo.',
  op_no_issuer: 'El emisor del activo no existe.',
  op_low_reserve: 'No tienes XLM suficiente para la reserva mínima de la cuenta.',
  op_malformed: 'La operación está mal formada.',
  op_cross_self: 'La operación se cruzaría con una oferta propia.',
  op_invalid_limit: 'El límite de la línea de confianza no es válido.',
  op_self_not_allowed: 'La operación no se puede hacer contra la propia cuenta.',
};

/**
 * Traduce los códigos de resultado de Horizon a un mensaje en español.
 * @param {{ transaction?: string, operations?: string[] } | null | undefined} codes
 * @returns {string}
 */
export function describeResultCodes(codes) {
  if (!codes) return 'No se pudo completar la operación en la red.';
  const opCode = (codes.operations ?? []).find((c) => c && c !== 'op_success');
  if (opCode) return OP_MESSAGES[opCode] ?? `La red rechazó la operación (${opCode}).`;
  if (codes.transaction && codes.transaction !== 'tx_failed') {
    return TX_MESSAGES[codes.transaction] ?? `La red rechazó la transacción (${codes.transaction}).`;
  }
  return 'La red rechazó la transacción.';
}
