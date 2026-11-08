// Aritmética de dinero exacta: montos como texto y enteros en stroops (BigInt).
// Nunca se usan números decimales de JavaScript para dinero.

/** Stroops por unidad de un activo (7 decimales). */
export const STROOPS_PER_UNIT = 10_000_000n;

/** Tolerancia de precio por defecto: 1 %. */
export const DEFAULT_TOLERANCE_PERCENT = 1n;

// Hasta 11 dígitos enteros (cabe en int64 de stroops) y hasta 7 decimales.
const AMOUNT_RE = /^\d{1,11}(\.\d{1,7})?$/;

/**
 * ¿El texto es un monto bien formado? (sin signo, sin notación científica, sin espacios)
 * @param {unknown} text
 * @returns {text is string}
 */
export function isAmountFormat(text) {
  return typeof text === 'string' && AMOUNT_RE.test(text);
}

/**
 * Convierte un monto en texto a stroops.
 * @param {string} text Por ejemplo "10" o "10.1234567".
 * @returns {bigint}
 * @throws {RangeError} si el formato no es válido.
 */
export function toStroops(text) {
  if (!isAmountFormat(text)) throw new RangeError('Monto con formato inválido');
  const [whole, frac = ''] = text.split('.');
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(frac.padEnd(7, '0'));
}

/**
 * Convierte stroops a texto sin ceros sobrantes ("10", "10.5").
 * @param {bigint} stroops
 * @returns {string}
 * @throws {RangeError} si es negativo.
 */
export function fromStroops(stroops) {
  if (typeof stroops !== 'bigint' || stroops < 0n) throw new RangeError('Stroops inválidos');
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = (stroops % STROOPS_PER_UNIT).toString().padStart(7, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Máximo a pagar = cotización + tolerancia, con redondeo hacia arriba al stroop.
 * @param {string} quote Cotización (monto de origen que devolvió la red).
 * @param {bigint} [percent] Tolerancia en porcentaje entero (por defecto 1).
 * @returns {string}
 */
export function maxToPay(quote, percent = DEFAULT_TOLERANCE_PERCENT) {
  const q = toStroops(quote);
  const extra = (q * percent + 99n) / 100n; // ceil(q * percent / 100)
  return fromStroops(q + extra);
}
