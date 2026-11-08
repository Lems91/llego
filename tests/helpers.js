// Datos de prueba compartidos. Las direcciones salen de claves aleatorias descartadas al acabar.
import { Keypair } from '@stellar/stellar-sdk';

export const addr = () => Keypair.random().publicKey();

export function makeAssets() {
  return {
    network: 'TESTNET',
    assets: {
      VESDEMO: { code: 'VESDEMO', issuer: addr() },
      USDDEMO: { code: 'USDDEMO', issuer: addr() },
    },
    pools: { vesUsd: { id: 'a'.repeat(64) }, xlmVes: { id: 'b'.repeat(64) } },
  };
}

export const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);

export function makeRequest(assets, overrides = {}) {
  const createdAt = Math.floor(NOW / 1000);
  return {
    destination: addr(),
    amount: '10',
    assetCode: assets.assets.USDDEMO.code,
    assetIssuer: assets.assets.USDDEMO.issuer,
    memo: 'abcDEF123_-xyz',
    createdAt,
    expiresAt: createdAt + 1800,
    ...overrides,
  };
}
