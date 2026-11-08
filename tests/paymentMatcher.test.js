import { describe, expect, it } from 'vitest';
import { findArrival, matchPayment } from '../src/core/paymentMatcher.js';
import { NOW, addr, makeAssets, makeRequest } from './helpers.js';

const assets = makeAssets();
const request = makeRequest(assets);
const afterIso = new Date(NOW + 60_000).toISOString();

function record(overrides = {}) {
  return {
    hash: 'c'.repeat(64),
    successful: true,
    type: 'path_payment_strict_receive',
    to: request.destination,
    assetType: 'credit_alphanum12',
    assetCode: request.assetCode,
    assetIssuer: request.assetIssuer,
    amount: '10.0000000',
    memo: request.memo,
    memoType: 'text',
    createdAt: afterIso,
    ...overrides,
  };
}

describe('matchPayment', () => {
  it('coincide: pago con ruta y pago directo', () => {
    expect(matchPayment(record(), request)).toEqual({ status: 'llegó', hash: 'c'.repeat(64) });
    expect(matchPayment(record({ type: 'payment' }), request).status).toBe('llegó');
  });
  it.each([
    ['transacción fallida', { successful: false }],
    ['emisor falso con el mismo código', { assetIssuer: addr() }],
    ['código distinto', { assetCode: 'USDC' }],
    ['activo nativo', { assetType: 'native', assetCode: null, assetIssuer: null }],
    ['monto menor', { amount: '9.9999999' }],
    ['monto mayor', { amount: '10.0000001' }],
    ['memo distinto', { memo: 'otroMemo' }],
    ['tipo de memo distinto', { memoType: 'id' }],
    ['destino distinto', { to: addr() }],
    ['fecha anterior al cobro', { createdAt: new Date(NOW - 60_000).toISOString() }],
    ['fecha ilegible', { createdAt: 'ayer' }],
    ['tipo de operación no aceptado', { type: 'create_account' }],
    ['hash inválido', { hash: 'zzz' }],
    ['monto con formato inválido', { amount: '1e1' }],
  ])('no coincide: %s', (_, overrides) => {
    const r = matchPayment(record(overrides), request);
    expect(r.status).toBe('no-coincide');
    expect(r.status === 'no-coincide' && r.reason.length).toBeGreaterThan(0);
  });
  it('segundo pago con el mismo memo y otro hash: repetido', () => {
    const first = 'c'.repeat(64);
    const r = matchPayment(record({ hash: 'd'.repeat(64) }), request, first);
    expect(r).toEqual({ status: 'repetido', hash: 'd'.repeat(64), firstHash: first });
  });
});

describe('findArrival', () => {
  it('encuentra el primero que cumple y marca los repetidos y rechazados', () => {
    const early = record({ hash: '1'.repeat(64), createdAt: new Date(NOW + 10_000).toISOString() });
    const dup = record({ hash: '2'.repeat(64), createdAt: new Date(NOW + 20_000).toISOString() });
    const wrong = record({ hash: '3'.repeat(64), amount: '5' });
    const out = findArrival([dup, wrong, early], request);
    expect(out.arrived?.hash).toBe('1'.repeat(64));
    expect(out.duplicates).toEqual(['2'.repeat(64)]);
    expect(out.rejected).toHaveLength(1);
  });
  it('sin pagos válidos no hay llegada', () => {
    expect(findArrival([], request).arrived).toBeNull();
    expect(findArrival([record({ amount: '1' })], request).arrived).toBeNull();
  });
});
