import { describe, expect, it } from 'vitest';
import {
  SECRET_KEY_WARNING,
  looksLikeSecretKey,
  validateAddress,
  validateAmount,
  validateAssetsConfig,
  validateHash,
  validateMemo,
} from '../src/core/validation.js';
import { addr, makeAssets } from './helpers.js';

const fakeSecret = `S${'A'.repeat(55)}`; // forma de clave secreta, inventada

describe('validateAddress', () => {
  it('acepta una dirección G válida', () => {
    const a = addr();
    expect(validateAddress(a)).toEqual({ ok: true, value: a });
  });
  it('rechaza checksum roto', () => {
    const a = addr();
    const broken = a.slice(0, -1) + (a.endsWith('A') ? 'B' : 'A');
    expect(validateAddress(broken).ok).toBe(false);
  });
  it('rechaza direcciones M, texto vacío y no texto', () => {
    expect(validateAddress(`M${'A'.repeat(68)}`).ok).toBe(false);
    expect(validateAddress('').ok).toBe(false);
    expect(validateAddress(42).ok).toBe(false);
  });
  it('rechaza algo con forma de clave secreta y avisa', () => {
    const r = validateAddress(fakeSecret);
    expect(r).toEqual({ ok: false, error: SECRET_KEY_WARNING });
  });
});

describe('looksLikeSecretKey', () => {
  it('detecta la forma S + 55 base32, incluso dentro de otro texto', () => {
    expect(looksLikeSecretKey(fakeSecret)).toBe(true);
    expect(looksLikeSecretKey(`mi clave: ${fakeSecret}`)).toBe(true);
    expect(looksLikeSecretKey(addr())).toBe(false);
  });
});

describe('validateAmount', () => {
  it.each(['10', '10.1234567', '0.0000001'])('acepta %s', (v) => {
    expect(validateAmount(v).ok).toBe(true);
  });
  it.each(['10.12345678', '0', '0.0', '-1', '1e3', 'abc', '', ' 10', '10 ', '1,5', '.5'])(
    'rechaza %j',
    (v) => {
      expect(validateAmount(v).ok).toBe(false);
    },
  );
  it('rechaza lo que supera el tope y acepta el tope exacto', () => {
    expect(validateAmount('10000.0000001', { max: '10000' }).ok).toBe(false);
    expect(validateAmount('10000', { max: '10000' }).ok).toBe(true);
  });
  it('rechaza una clave secreta con aviso', () => {
    expect(validateAmount(fakeSecret)).toEqual({ ok: false, error: SECRET_KEY_WARNING });
  });
});

describe('validateMemo', () => {
  it('acepta 1 a 28 caracteres permitidos', () => {
    expect(validateMemo('a').ok).toBe(true);
    expect(validateMemo('a'.repeat(28)).ok).toBe(true);
  });
  it('rechaza 29 caracteres, vacío, caracteres no permitidos y no texto', () => {
    expect(validateMemo('a'.repeat(29)).ok).toBe(false);
    expect(validateMemo('').ok).toBe(false);
    expect(validateMemo('hola mundo').ok).toBe(false);
    expect(validateMemo('ñandú').ok).toBe(false);
    expect(validateMemo(5).ok).toBe(false);
  });
});

describe('validateHash', () => {
  it('acepta 64 hexadecimales y devuelve minúsculas', () => {
    expect(validateHash('A'.repeat(64))).toEqual({ ok: true, value: 'a'.repeat(64) });
  });
  it('rechaza largo o caracteres inválidos', () => {
    expect(validateHash('a'.repeat(63)).ok).toBe(false);
    expect(validateHash('a'.repeat(65)).ok).toBe(false);
    expect(validateHash(`${'a'.repeat(63)}g`).ok).toBe(false);
  });
});

describe('validateAssetsConfig', () => {
  it('acepta una configuración correcta', () => {
    expect(validateAssetsConfig(makeAssets()).ok).toBe(true);
  });
  it('rechaza emisores iguales, red distinta, código cambiado o pool inválido', () => {
    const same = makeAssets();
    same.assets.USDDEMO.issuer = same.assets.VESDEMO.issuer;
    expect(validateAssetsConfig(same).ok).toBe(false);
    expect(validateAssetsConfig({ ...makeAssets(), network: 'PUBLIC' }).ok).toBe(false);
    const code = makeAssets();
    code.assets.USDDEMO.code = 'USDC';
    expect(validateAssetsConfig(code).ok).toBe(false);
    const pool = makeAssets();
    pool.pools.vesUsd.id = 'xyz';
    expect(validateAssetsConfig(pool).ok).toBe(false);
    expect(validateAssetsConfig(null).ok).toBe(false);
  });
});
