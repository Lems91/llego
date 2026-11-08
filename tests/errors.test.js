import { describe, expect, it } from 'vitest';
import { describeResultCodes } from '../src/core/errors.js';

describe('describeResultCodes', () => {
  it('traduce códigos de operación conocidos', () => {
    expect(describeResultCodes({ transaction: 'tx_failed', operations: ['op_over_sendmax'] })).toMatch(/precio cambió/);
    expect(describeResultCodes({ transaction: 'tx_failed', operations: ['op_no_trust'] })).toMatch(/comercio no activó/);
    expect(describeResultCodes({ transaction: 'tx_failed', operations: ['op_underfunded'] })).toMatch(/Saldo insuficiente/);
  });
  it('traduce códigos de transacción', () => {
    expect(describeResultCodes({ transaction: 'tx_too_late' })).toMatch(/venció/);
  });
  it('maneja códigos desconocidos y entradas vacías sin lanzar', () => {
    expect(describeResultCodes({ operations: ['op_rara'] })).toContain('op_rara');
    expect(describeResultCodes(null)).toMatch(/No se pudo/);
    expect(describeResultCodes({ transaction: 'tx_failed' })).toMatch(/rechazó/);
  });
});
