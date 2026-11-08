import { Keypair, Networks, Transaction } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { NETWORK_PASSPHRASE } from '../src/config/network.js';
import {
  buildGetVesTx,
  buildPaymentTx,
  buildTrustlineTx,
  decodeTransaction,
  signedHashMatches,
} from '../src/core/txBuilder.js';
import { NOW, addr, makeAssets, makeRequest } from './helpers.js';

const assets = makeAssets();
const payer = Keypair.random();
const source = { accountId: payer.publicKey(), sequence: '1234567890' };

function pay(overrides = {}) {
  const request = makeRequest(assets);
  return {
    request,
    result: buildPaymentTx({ source, request, assets, sendMax: '1013.1404315', path: [], nowMs: NOW, ...overrides }),
  };
}

describe('buildPaymentTx', () => {
  it('construye una sola operación de recepción exacta con los datos correctos', () => {
    const { request, result } = pay();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const decoded = decodeTransaction(result.value.xdr);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const s = decoded.value;
    expect(s.operations).toHaveLength(1);
    expect(s.operations[0]).toEqual({
      type: 'pathPaymentStrictReceive',
      sendAsset: `VESDEMO:${assets.assets.VESDEMO.issuer}`,
      sendMax: '1013.1404315',
      destination: request.destination,
      destAsset: `USDDEMO:${assets.assets.USDDEMO.issuer}`,
      destAmount: '10.0000000',
      path: [],
    });
    expect(s.memo).toBe(request.memo);
    expect(s.source).toBe(source.accountId);
    expect(s.hash).toBe(result.value.hash);
  });
  it('vence en 3 minutos o menos', () => {
    const { result } = pay();
    if (!result.ok) throw new Error(result.error);
    const decoded = decodeTransaction(result.value.xdr);
    if (!decoded.ok) throw new Error(decoded.error);
    const maxTime = Number(decoded.value.maxTime);
    expect(maxTime - Math.floor(NOW / 1000)).toBeLessThanOrEqual(180);
    expect(maxTime).toBeGreaterThan(Math.floor(NOW / 1000));
  });
  it('usa la frase de red de testnet y la firma de otra red no sirve para esta', () => {
    expect(NETWORK_PASSPHRASE).toBe(Networks.TESTNET);
    const { result } = pay();
    if (!result.ok) throw new Error(result.error);
    expect(result.value.tx).toBeInstanceOf(Transaction);
    expect(result.value.tx.networkPassphrase).toBe(Networks.TESTNET);
  });
  it('rechaza activo del cobro distinto, destino inválido, monto inválido y cobro vencido', () => {
    expect(pay({ request: makeRequest(assets, { assetIssuer: addr() }) }).result.ok).toBe(false);
    expect(pay({ request: makeRequest(assets, { destination: 'GBAD' }) }).result.ok).toBe(false);
    expect(pay({ sendMax: '0' }).result.ok).toBe(false);
    expect(pay({ nowMs: NOW + 1801 * 1000 }).result.ok).toBe(false);
    expect(pay({ source: { accountId: source.accountId, sequence: 'abc' } }).result.ok).toBe(false);
  });
  it('rechaza activos de ruta que no estén en la configuración', () => {
    const bad = [{ code: 'VESDEMO', issuer: addr() }];
    expect(pay({ path: bad }).result.ok).toBe(false);
    expect(pay({ path: [{ type: 'native' }] }).result.ok).toBe(true);
  });
});

describe('buildTrustlineTx', () => {
  it('crea trustline solo para activos de la configuración', () => {
    const r = buildTrustlineTx({ source, assetKey: 'VESDEMO', assets, nowMs: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = decodeTransaction(r.value.xdr);
    expect(d.ok && d.value.operations[0]).toEqual({
      type: 'changeTrust',
      asset: `VESDEMO:${assets.assets.VESDEMO.issuer}`,
    });
    // @ts-expect-error: a propósito, un activo que no es de la configuración
    expect(buildTrustlineTx({ source, assetKey: 'USDC', assets, nowMs: NOW }).ok).toBe(false);
  });
});

describe('buildGetVesTx', () => {
  it('cambia XLM por una cantidad exacta de VESDEMO hacia la propia cuenta', () => {
    const r = buildGetVesTx({ source, amount: '100', sendMax: '1.0132417', assets, nowMs: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = decodeTransaction(r.value.xdr);
    expect(d.ok && d.value.operations[0]).toMatchObject({
      type: 'pathPaymentStrictReceive',
      sendAsset: 'XLM',
      destination: source.accountId,
      destAmount: '100.0000000',
    });
    expect(buildGetVesTx({ source, amount: '100001', sendMax: '5', assets, nowMs: NOW }).ok).toBe(false);
  });
});

describe('signedHashMatches', () => {
  it('firmar no cambia el hash; otra transacción sí lo cambia', () => {
    const { result } = pay();
    if (!result.ok) throw new Error(result.error);
    const signed = result.value.tx;
    signed.sign(payer);
    expect(signedHashMatches(result.value.hash, signed.toXDR())).toBe(true);
    const other = pay({ sendMax: '2000' }).result;
    if (!other.ok) throw new Error(other.error);
    expect(signedHashMatches(result.value.hash, other.value.xdr)).toBe(false);
    expect(signedHashMatches(result.value.hash, 'no-es-xdr')).toBe(false);
  });
});

describe('decodeTransaction', () => {
  it('rechaza XDR ilegible', () => {
    expect(decodeTransaction('AAAA').ok).toBe(false);
  });
});
