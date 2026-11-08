import { describe, expect, it } from 'vitest';
import {
  buildPaymentQuery,
  createPaymentRequest,
  memoFromRandomBytes,
  parsePaymentQuery,
} from '../src/core/paymentRequest.js';
import { validateMemo } from '../src/core/validation.js';
import { NOW, addr, makeAssets } from './helpers.js';

const assets = makeAssets();

function freshQuery(overrides = {}) {
  const created = createPaymentRequest(
    { destination: addr(), amount: '25.5', memo: 'memoDePrueba_01' },
    assets,
    NOW,
  );
  if (!created.ok) throw new Error(created.error);
  return { request: created.value, query: buildPaymentQuery({ ...created.value, ...overrides }) };
}

describe('memoFromRandomBytes', () => {
  it('produce un memo válido de 22 caracteres', () => {
    const memo = memoFromRandomBytes(Uint8Array.from({ length: 16 }, (_, i) => i * 17));
    expect(memo).toHaveLength(22);
    expect(validateMemo(memo).ok).toBe(true);
  });
  it('bytes distintos dan memos distintos y exige 16 bytes', () => {
    const a = memoFromRandomBytes(new Uint8Array(16));
    const b = memoFromRandomBytes(new Uint8Array(16).fill(255));
    expect(a).not.toBe(b);
    expect(() => memoFromRandomBytes(new Uint8Array(8))).toThrow();
  });
});

describe('createPaymentRequest y parsePaymentQuery', () => {
  it('crear y luego analizar devuelve lo mismo', () => {
    const { request, query } = freshQuery();
    const parsed = parsePaymentQuery(query, assets, NOW + 1000);
    expect(parsed).toEqual({ ok: true, value: request });
  });
  it('acepta "?" inicial', () => {
    const { query } = freshQuery();
    expect(parsePaymentQuery(`?${query}`, assets, NOW).ok).toBe(true);
  });
  it('rechaza un cobro sobre el tope o con destino inválido al crear', () => {
    expect(createPaymentRequest({ destination: addr(), amount: '10000.01', memo: 'm1' }, assets, NOW).ok).toBe(false);
    expect(createPaymentRequest({ destination: 'GXXX', amount: '5', memo: 'm1' }, assets, NOW).ok).toBe(false);
  });
  it('rechaza activo distinto, emisor distinto y monto alterado', () => {
    expect(parsePaymentQuery(freshQuery({ assetCode: 'USDC' }).query, assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(freshQuery({ assetIssuer: addr() }).query, assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(freshQuery({ amount: '1e3' }).query, assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(freshQuery({ destination: 'G123' }).query, assets, NOW).ok).toBe(false);
  });
  it('rechaza parámetro repetido, desconocido o faltante', () => {
    const { query } = freshQuery();
    expect(parsePaymentQuery(`${query}&amount=1`, assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(`${query}&extra=1`, assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(query.replace(/memo=[^&]*&/, ''), assets, NOW).ok).toBe(false);
  });
  it('rechaza un cobro vencido', () => {
    const { query } = freshQuery();
    const r = parsePaymentQuery(query, assets, NOW + 1801 * 1000);
    expect(r.ok).toBe(false);
  });
  it('rechaza vigencia mayor a 30 minutos y fecha futura', () => {
    const { request } = freshQuery();
    expect(parsePaymentQuery(buildPaymentQuery({ ...request, expiresAt: request.createdAt + 3600 }), assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(buildPaymentQuery({ ...request, createdAt: request.createdAt + 600, expiresAt: request.createdAt + 900 }), assets, NOW).ok).toBe(false);
  });
  it('rechaza memo_type distinto de text y una clave secreta como memo', () => {
    const { query } = freshQuery();
    expect(parsePaymentQuery(query.replace('memo_type=text', 'memo_type=hash'), assets, NOW).ok).toBe(false);
    expect(parsePaymentQuery(freshQuery({ memo: `S${'A'.repeat(55)}` }).query, assets, NOW).ok).toBe(false);
  });
  it('rechaza percent-encoding roto', () => {
    expect(parsePaymentQuery('destination=%E0%A4%A', assets, NOW).ok).toBe(false);
  });
});
