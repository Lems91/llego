// ConstrucciÃ³n de lo que se firma, a partir de datos ya validados, y decodificaciÃ³n de lo
// construido para el resumen previo a la firma. FunciÃ³n pura: no firma ni habla con la red.
import {
  Account,
  Asset,
  BASE_FEE,
  Memo,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '../config/network.js';
import { fail, ok } from './errors.js';
import { validateAddress, validateAmount, validateMemo, MAX_CHARGE_AMOUNT } from './validation.js';

/** La transacciÃ³n vence a los 3 minutos de construida. */
export const TX_TIMEOUT_SECONDS = 180;

/** Tope de VESDEMO que se puede pedir con la ayuda de testnet. */
export const MAX_HELP_VES = '100000';

/**
 * @typedef {import('./validation.js').AssetsConfig} TxAssetsCfg
 * @typedef {import('./paymentRequest.js').PaymentRequest} PayRequest
 * @typedef {{ accountId: string, sequence: string }} SourceAccount Cuenta y nÃºmero de secuencia actual.
 * @typedef {{ type: 'native' } | { code: string, issuer: string }} PathAsset
 * @typedef {{ tx: import('@stellar/stellar-sdk').Transaction, xdr: string, hash: string }} BuiltTx
 */

/**
 * @param {ArrayLike<number>} bytes
 * @returns {string}
 */
function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {import('@stellar/stellar-sdk').Asset} asset
 * @returns {string}
 */
function assetLabel(asset) {
  return asset.isNative() ? 'XLM' : `${asset.getCode()}:${asset.getIssuer()}`;
}

/**
 * @param {SourceAccount} source
 * @returns {import('./errors.js').Result<SourceAccount>}
 */
function validateSource(source) {
  const address = validateAddress(source?.accountId);
  if (!address.ok) return address;
  if (typeof source.sequence !== 'string' || !/^\d{1,20}$/.test(source.sequence)) {
    return fail('El nÃºmero de secuencia de la cuenta no es vÃ¡lido.');
  }
  return ok(source);
}

/**
 * @param {SourceAccount} source
 * @param {number} nowMs
 * @param {Memo | undefined} memo
 * @returns {TransactionBuilder}
 */
function newBuilder(source, nowMs, memo) {
  const nowSec = Math.floor(nowMs / 1000);
  return new TransactionBuilder(new Account(source.accountId, source.sequence), {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    timebounds: { minTime: 0, maxTime: nowSec + TX_TIMEOUT_SECONDS },
    ...(memo ? { memo } : {}),
  });
}

/**
 * @param {TransactionBuilder} builder
 * @returns {BuiltTx}
 */
function finish(builder) {
  const tx = builder.build();
  return { tx, xdr: tx.toXDR(), hash: toHex(tx.hash()) };
}

/**
 * Convierte un activo de ruta a objeto del SDK, solo si es XLM o uno de la configuraciÃ³n.
 * @param {PathAsset} item
 * @param {TxAssetsCfg} assets
 * @returns {import('./errors.js').Result<import('@stellar/stellar-sdk').Asset>}
 */
function pathAsset(item, assets) {
  if ('type' in item && item.type === 'native') return ok(Asset.native());
  if ('code' in item) {
    for (const known of [assets.assets.VESDEMO, assets.assets.USDDEMO]) {
      if (item.code === known.code && item.issuer === known.issuer) {
        return ok(new Asset(known.code, known.issuer));
      }
    }
  }
  return fail('La ruta incluye un activo que no estÃ¡ en la configuraciÃ³n.');
}

/**
 * Pago con recepciÃ³n exacta (strict-receive): el comercio recibe exactamente request.amount de
 * USDDEMO y el pagador entrega VESDEMO hasta sendMax. Una sola operaciÃ³n, con memo y vencimiento.
 * @param {{
 *   source: SourceAccount,
 *   request: PayRequest,
 *   assets: TxAssetsCfg,
 *   sendMax: string,
 *   path: PathAsset[],
 *   nowMs: number
 * }} input
 * @returns {import('./errors.js').Result<BuiltTx>}
 */
export function buildPaymentTx({ source, request, assets, sendMax, path, nowMs }) {
  const src = validateSource(source);
  if (!src.ok) return src;
  const destination = validateAddress(request.destination);
  if (!destination.ok) return destination;
  const amount = validateAmount(request.amount, { max: MAX_CHARGE_AMOUNT });
  if (!amount.ok) return amount;
  const max = validateAmount(sendMax);
  if (!max.ok) return max;
  const memoText = validateMemo(request.memo);
  if (!memoText.ok) return memoText;
  const usd = assets.assets.USDDEMO;
  if (request.assetCode !== usd.code || request.assetIssuer !== usd.issuer) {
    return fail('El cobro no es en el USDDEMO de esta app.');
  }
  if (Math.floor(nowMs / 1000) >= request.expiresAt) return fail('El cobro venciÃ³.');
  if (!Array.isArray(path) || path.length > 5) return fail('La ruta de pago no es vÃ¡lida.');

  /** @type {import('@stellar/stellar-sdk').Asset[]} */
  const hops = [];
  for (const item of path) {
    const asset = pathAsset(item, assets);
    if (!asset.ok) return asset;
    hops.push(asset.value);
  }
  const ves = assets.assets.VESDEMO;
  const builder = newBuilder(src.value, nowMs, Memo.text(memoText.value));
  builder.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset: new Asset(ves.code, ves.issuer),
      sendMax: max.value,
      destination: destination.value,
      destAsset: new Asset(usd.code, usd.issuer),
      destAmount: amount.value,
      path: hops,
    }),
  );
  return ok(finish(builder));
}

/**
 * Trustline hacia VESDEMO o USDDEMO. Solo acepta el nombre de un activo de la configuraciÃ³n,
 * nunca un activo que llegue de otro lado.
 * @param {{ source: SourceAccount, assetKey: 'VESDEMO' | 'USDDEMO', assets: TxAssetsCfg, nowMs: number }} input
 * @returns {import('./errors.js').Result<BuiltTx>}
 */
export function buildTrustlineTx({ source, assetKey, assets, nowMs }) {
  const src = validateSource(source);
  if (!src.ok) return src;
  if (assetKey !== 'VESDEMO' && assetKey !== 'USDDEMO') {
    return fail('Solo se puede activar VESDEMO o USDDEMO.');
  }
  const known = assets.assets[assetKey];
  const builder = newBuilder(src.value, nowMs, undefined);
  builder.addOperation(Operation.changeTrust({ asset: new Asset(known.code, known.issuer) }));
  return ok(finish(builder));
}

/**
 * Ayuda de testnet "Obtener VESDEMO": el pagador cambia XLM por exactamente `amount` de VESDEMO,
 * pagando como mÃ¡ximo `sendMax` XLM, a su propia cuenta.
 * @param {{ source: SourceAccount, amount: string, sendMax: string, assets: TxAssetsCfg, nowMs: number }} input
 * @returns {import('./errors.js').Result<BuiltTx>}
 */
export function buildGetVesTx({ source, amount, sendMax, assets, nowMs }) {
  const src = validateSource(source);
  if (!src.ok) return src;
  const received = validateAmount(amount, { max: MAX_HELP_VES });
  if (!received.ok) return received;
  const max = validateAmount(sendMax);
  if (!max.ok) return max;
  const ves = assets.assets.VESDEMO;
  const builder = newBuilder(src.value, nowMs, undefined);
  builder.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: max.value,
      destination: src.value.accountId,
      destAsset: new Asset(ves.code, ves.issuer),
      destAmount: received.value,
      path: [],
    }),
  );
  return ok(finish(builder));
}

/**
 * @typedef {{
 *   type: 'pathPaymentStrictReceive',
 *   sendAsset: string, sendMax: string, destination: string,
 *   destAsset: string, destAmount: string, path: string[]
 * } | { type: 'changeTrust', asset: string } | { type: 'other', name: string }} OperationSummary
 * @typedef {{
 *   hash: string, source: string, fee: string, memo: string | null,
 *   maxTime: string | null, operations: OperationSummary[]
 * }} TxSummary
 */

/**
 * Decodifica una transacciÃ³n en XDR para el resumen previo a la firma. El resumen sale de la
 * MISMA transacciÃ³n que se firmarÃ¡, no de los datos de entrada.
 * @param {string} xdr
 * @returns {import('./errors.js').Result<TxSummary>}
 */
export function decodeTransaction(xdr) {
  let parsed;
  try {
    parsed = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  } catch {
    return fail('La transacciÃ³n no se pudo leer.');
  }
  if (!('operations' in parsed) || !('memo' in parsed)) {
    return fail('No se aceptan transacciones de comisiÃ³n delegada.');
  }
  /** @type {OperationSummary[]} */
  const operations = parsed.operations.map((op) => {
    if (op.type === 'pathPaymentStrictReceive') {
      return {
        type: 'pathPaymentStrictReceive',
        sendAsset: assetLabel(op.sendAsset),
        sendMax: op.sendMax,
        destination: op.destination,
        destAsset: assetLabel(op.destAsset),
        destAmount: op.destAmount,
        path: op.path.map(assetLabel),
      };
    }
    if (op.type === 'changeTrust' && op.line instanceof Asset) {
      return { type: 'changeTrust', asset: assetLabel(op.line) };
    }
    return { type: 'other', name: op.type };
  });
  const memoValue = parsed.memo.value;
  /** @type {string | null} */
  let memo = null;
  if (parsed.memo.type === 'text') {
    if (typeof memoValue === 'string') memo = memoValue;
    else if (memoValue instanceof Uint8Array) {
      // El SDK entrega el memo de texto como bytes; los memos válidos son solo ASCII.
      memo = Array.from(memoValue, (b) => String.fromCharCode(b)).join('');
    }
  }
  return ok({
    hash: toHex(parsed.hash()),
    source: parsed.source,
    fee: parsed.fee,
    memo,
    maxTime: parsed.timeBounds ? parsed.timeBounds.maxTime : null,
    operations,
  });
}

/**
 * Â¿El hash de la transacciÃ³n firmada es igual al de la construida? Si no, no se envÃ­a.
 * @param {string} builtHash Hash de la transacciÃ³n construida (hexadecimal).
 * @param {string} signedXdr XDR que devolviÃ³ la wallet.
 * @returns {boolean}
 */
export function signedHashMatches(builtHash, signedXdr) {
  const decoded = decodeTransaction(signedXdr);
  return decoded.ok && decoded.value.hash === builtHash;
}


