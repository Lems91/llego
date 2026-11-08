// Único módulo que habla con la red (Horizon testnet y Friendbot). Toda respuesta pasa por
// core/validation antes de usarse. Los errores salen como mensajes en español, nunca como el
// objeto de error completo.
import { Asset, Horizon, TransactionBuilder } from '@stellar/stellar-sdk';
import { FRIENDBOT_URL, HORIZON_URL, NETWORK_PASSPHRASE } from '../config/network.js';
import { describeResultCodes } from '../core/errors.js';
import { fromStroops, isAmountFormat, toStroops } from '../core/amounts.js';
import { validateAddress, validateHash } from '../core/validation.js';

const server = new Horizon.Server(HORIZON_URL);
const REQUEST_TIMEOUT_MS = 10_000;
const RETRIES = 2;

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Convierte un error de Horizon o de red en un mensaje claro en español.
 * @param {any} err
 * @returns {string}
 */
export function networkErrorMessage(err) {
  const codes = err?.response?.data?.extras?.result_codes;
  if (codes) return describeResultCodes(codes);
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return 'La red no encontró lo que se pidió.';
  if (status === 429) return 'La red está recibiendo demasiadas consultas. Espera unos segundos.';
  return 'No se pudo hablar con la red de pruebas. Revisa tu conexión y vuelve a intentarlo.';
}

/**
 * GET JSON con tiempo límite y reintentos limitados.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function getJson(url) {
  let lastStatus = 0;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (res.ok) return await res.json();
      lastStatus = res.status;
      if (res.status < 500 && res.status !== 429) break;
    } catch {
      lastStatus = 0;
    } finally {
      clearTimeout(timer);
    }
    await sleep(500 * (attempt + 1));
  }
  const error = new Error('Falló la consulta a la red');
  /** @type {any} */ (error).status = lastStatus;
  throw error;
}

/**
 * @typedef {{
 *   exists: boolean,
 *   sequence: string,
 *   xlm: string,
 *   ves: { trusted: boolean, balance: string },
 *   usd: { trusted: boolean, balance: string }
 * }} AccountState
 */

/**
 * Lee la cuenta pública: secuencia, saldo de XLM y trustlines hacia los activos de la configuración.
 * @param {string} address
 * @param {import('../core/validation.js').AssetsConfig} assets
 * @returns {Promise<AccountState>}
 */
export async function getAccountState(address, assets) {
  const valid = validateAddress(address);
  if (!valid.ok) throw new Error(valid.error);
  try {
    const acc = await server.loadAccount(valid.value);
    const find = (/** @type {{code:string, issuer:string}} */ a) => {
      const b = acc.balances.find(
        (x) => 'asset_code' in x && x.asset_code === a.code && x.asset_issuer === a.issuer,
      );
      return { trusted: Boolean(b), balance: b && isAmountFormat(b.balance) ? b.balance : '0' };
    };
    const native = acc.balances.find((x) => x.asset_type === 'native');
    return {
      exists: true,
      sequence: acc.sequenceNumber(),
      xlm: native && isAmountFormat(native.balance) ? native.balance : '0',
      ves: find(assets.assets.VESDEMO),
      usd: find(assets.assets.USDDEMO),
    };
  } catch (err) {
    if (/** @type {any} */ (err)?.response?.status === 404) {
      return {
        exists: false,
        sequence: '0',
        xlm: '0',
        ves: { trusted: false, balance: '0' },
        usd: { trusted: false, balance: '0' },
      };
    }
    throw new Error(networkErrorMessage(err));
  }
}

/** Fondea una cuenta de testnet con XLM de prueba (Friendbot). */
export async function fundWithFriendbot(/** @type {string} */ address) {
  const valid = validateAddress(address);
  if (!valid.ok) throw new Error(valid.error);
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(valid.value)}`).catch(() => null);
  if (!res || !res.ok) throw new Error('Friendbot no pudo fondear la cuenta. Inténtalo de nuevo en unos segundos.');
}

/**
 * Cotiza una ruta de recepción exacta y devuelve la más barata.
 * @param {{ from: 'VESDEMO' | 'XLM', to: 'USDDEMO' | 'VESDEMO', amount: string }} req
 * @param {import('../core/validation.js').AssetsConfig} assets
 * @returns {Promise<{ sourceAmount: string, path: import('../core/txBuilder.js').PathAsset[] } | null>}
 */
export async function quoteReceive({ from, to, amount }, assets) {
  const make = (/** @type {string} */ key) =>
    key === 'XLM'
      ? Asset.native()
      : new Asset(
          assets.assets[/** @type {'VESDEMO'|'USDDEMO'} */ (key)].code,
          assets.assets[/** @type {'VESDEMO'|'USDDEMO'} */ (key)].issuer,
        );
  let records;
  try {
    records = (await server.strictReceivePaths([make(from)], make(to), amount).call()).records;
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
  const usable = records.filter((r) => isAmountFormat(r.source_amount));
  if (usable.length === 0) return null;
  const best = usable.reduce((m, r) => (toStroops(r.source_amount) < toStroops(m.source_amount) ? r : m));
  return {
    sourceAmount: fromStroops(toStroops(best.source_amount)),
    path: best.path.map((p) =>
      p.asset_type === 'native'
        ? { type: /** @type {'native'} */ ('native') }
        : { code: String(p.asset_code), issuer: String(p.asset_issuer) },
    ),
  };
}

/**
 * Normaliza un registro de pago de Horizon (con la transacción unida) al formato de core.
 * @param {any} rec
 * @returns {import('../core/paymentMatcher.js').NetworkPayment | null}
 */
function normalizePayment(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const hash = validateHash(rec.transaction_hash);
  if (!hash.ok || typeof rec.to !== 'string') return null;
  const tx = rec.transaction && typeof rec.transaction === 'object' ? rec.transaction : {};
  return {
    hash: hash.value,
    successful: rec.transaction_successful === true,
    type: String(rec.type),
    to: rec.to,
    assetType: String(rec.asset_type),
    assetCode: typeof rec.asset_code === 'string' ? rec.asset_code : null,
    assetIssuer: typeof rec.asset_issuer === 'string' ? rec.asset_issuer : null,
    amount: String(rec.amount),
    memo: typeof tx.memo === 'string' ? tx.memo : null,
    memoType: typeof tx.memo_type === 'string' ? tx.memo_type : null,
    createdAt: String(rec.created_at),
  };
}

/**
 * Últimos pagos de una cuenta (más recientes primero), con memo.
 * @param {string} address
 * @returns {Promise<import('../core/paymentMatcher.js').NetworkPayment[]>}
 */
export async function listPaymentsFor(address) {
  const valid = validateAddress(address);
  if (!valid.ok) throw new Error(valid.error);
  try {
    const url = `${HORIZON_URL}/accounts/${valid.value}/payments?order=desc&limit=50&join=transactions`;
    const json = await getJson(url);
    const records = Array.isArray(json?._embedded?.records) ? json._embedded.records : [];
    return /** @type {any[]} */ (records.map(normalizePayment).filter(Boolean));
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

/**
 * Vuelve a consultar una transacción por su hash y devuelve sus pagos normalizados.
 * @param {string} hash
 * @returns {Promise<import('../core/paymentMatcher.js').NetworkPayment[]>}
 */
export async function getPaymentsByHash(hash) {
  const valid = validateHash(hash);
  if (!valid.ok) throw new Error(valid.error);
  try {
    const json = await getJson(`${HORIZON_URL}/transactions/${valid.value}/payments?join=transactions`);
    const records = Array.isArray(json?._embedded?.records) ? json._embedded.records : [];
    return /** @type {any[]} */ (records.map(normalizePayment).filter(Boolean));
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

/**
 * Envía una transacción ya firmada y verificada.
 * @param {string} signedXdr
 * @returns {Promise<{ ok: true, hash: string } | { ok: false, error: string }>}
 */
export async function submitSigned(signedXdr) {
  try {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const res = await server.submitTransaction(tx);
    const hash = validateHash(res.hash);
    return hash.ok ? { ok: true, hash: hash.value } : { ok: false, error: 'La red devolvió un hash inválido.' };
  } catch (err) {
    return { ok: false, error: networkErrorMessage(err) };
  }
}
