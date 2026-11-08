import { describe, expect, it } from 'vitest';
import { fromStroops, maxToPay, toStroops } from '../src/core/amounts.js';

describe('toStroops / fromStroops', () => {
  it.each([
    ['10', 100000000n],
    ['10.5', 105000000n],
    ['10.1234567', 101234567n],
    ['0.0000001', 1n],
    ['99999999999', 999999999990000000n],
  ])('ida y vuelta de %s', (text, stroops) => {
    expect(toStroops(text)).toBe(stroops);
    expect(fromStroops(stroops)).toBe(text);
  });
  it('quita ceros sobrantes al volver a texto', () => {
    expect(fromStroops(105000000n)).toBe('10.5');
    expect(fromStroops(0n)).toBe('0');
  });
  it('lanza con formato inválido o stroops negativos', () => {
    expect(() => toStroops('1e3')).toThrow();
    expect(() => toStroops('10.12345678')).toThrow();
    expect(() => fromStroops(-1n)).toThrow();
  });
});

describe('maxToPay', () => {
  it('suma 1 % exacto', () => {
    expect(maxToPay('100')).toBe('101');
    expect(maxToPay('1003.1093381')).toBe('1013.1404315');
  });
  it('redondea hacia arriba al stroop', () => {
    // 0.0000001 + ceil(0.01 stroop) = 2 stroops
    expect(maxToPay('0.0000001')).toBe('0.0000002');
    // 1.0000001 -> 10000001 stroops; 1 % = 100000.01 -> sube a 100001
    expect(maxToPay('1.0000001')).toBe('1.0100002');
  });
  it('acepta otra tolerancia', () => {
    expect(maxToPay('200', 5n)).toBe('210');
  });
});
