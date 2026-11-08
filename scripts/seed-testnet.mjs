// Siembra de testnet para Llegó. Uso: npm run seed
//
// Crea en memoria tres claves (emisor VESDEMO, emisor USDDEMO, distribuidor), las fondea con
// Friendbot, emite el suministro fijo, abre dos pools de liquidez, bloquea a los emisores y escribe
// src/config/testnet-assets.json con datos PÚBLICOS únicamente.
// Las claves secretas nunca se escriben en disco ni se imprimen: viven en variables locales de
// main() y desaparecen cuando termina el proceso.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  LiquidityPoolAsset,
  LiquidityPoolFeeV18,
  Operation,
  TransactionBuilder,
  getLiquidityPoolId,
} from '@stellar/stellar-sdk';
import {
  EXPLORER_URL,
  FRIENDBOT_URL,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
} from '../src/config/network.js';

// ---------------------------------------------------------------------------
// Parámetros de la demo.
// TASAS FICTICIAS, NO REALES: 100 VESDEMO por 1 USDDEMO y 100 VESDEMO por 1 XLM. Se fijan solo
// con las proporciones de liquidez de abajo; no reflejan ningún tipo de cambio real.
// ---------------------------------------------------------------------------
const VES_SUPPLY = '20000000';
const USD_SUPPLY = '200000';
const POOL_VES_USD = { ves: '10000000', usd: '100000' }; // 100 VESDEMO por USDDEMO (ficticia)
const POOL_XLM_VES = { xlm: '5000', ves: '500000' }; // 100 VESDEMO por XLM (ficticia)
const PRICE_TOLERANCE_PERCENT = 1n; // minPrice y maxPrice a ±1 % de la proporción depositada
const QUOTE_USD_AMOUNT = '10'; // cotización VESDEMO -> USDDEMO: el comercio recibe 10 USDDEMO
const QUOTE_VES_AMOUNT = '100'; // cotización XLM -> VESDEMO: la ayuda "Obtener VESDEMO"
const ASSETS_FILE = resolve(import.meta.dirname, '..', 'src', 'config', 'testnet-assets.json');
const INT32_MAX = 2147483647n;

/** Error de paso: solo lleva el nombre del paso y el código de resultado, nunca el objeto original. */
class SeedError extends Error {
  /** @param {string} step @param {string} code */
  constructor(step, code) {
    super(`${step}: ${code}`);
    this.name = 'SeedError';
  }
}

/** Extrae solo el código de resultado de un error de Horizon o de red. */
function errorCode(err) {
  const codes = err?.response?.data?.extras?.result_codes;
  if (codes) {
    const ops = Array.isArray(codes.operations) ? codes.operations.join(',') : '-';
    return `transacción=${codes.transaction ?? '-'} operaciones=${ops}`;
  }
  if (err?.response?.status) return `HTTP ${err.response.status}`;
  return `error de red o de ejecución (${err?.name ?? 'desconocido'})`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Convierte un monto en texto ("10.5") a stroops (BigInt) sin usar números decimales. */
function toStroops(text) {
  const [whole, frac = ''] = text.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(frac.padEnd(7, '0'));
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Límites de precio depositA/depositB a ±1 % de la proporción real, como fracciones enteras. */
function priceBounds(amountA, amountB) {
  const a = toStroops(amountA);
  const b = toStroops(amountB);
  const g = gcd(a, b);
  const n = a / g;
  const d = b / g;
  const lo = { n: n * (100n - PRICE_TOLERANCE_PERCENT), d: d * 100n };
  const hi = { n: n * (100n + PRICE_TOLERANCE_PERCENT), d: d * 100n };
  for (const v of [lo.n, lo.d, hi.n, hi.d]) {
    if (v > INT32_MAX) throw new SeedError('precio del pool', 'fracción fuera de rango int32');
  }
  return {
    minPrice: { n: Number(lo.n), d: Number(lo.d) },
    maxPrice: { n: Number(hi.n), d: Number(hi.d) },
  };
}

/** Ordena dos activos como exige un pool (assetA < assetB) y empareja sus montos. */
function orderPool(x, amountX, y, amountY) {
  return Asset.compare(x, y) < 0
    ? { assetA: x, assetB: y, amountA: amountX, amountB: amountY }
    : { assetA: y, assetB: x, amountA: amountY, amountB: amountX };
}

/** Fondea una cuenta con Friendbot (reintentos limitados). */
async function fund(label, publicKey) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
      if (res.ok) {
        console.log(`  ✔ ${label} fondeada: ${EXPLORER_URL}/account/${publicKey}`);
        return;
      }
      if (attempt === 3) throw new SeedError(`Friendbot (${label})`, `HTTP ${res.status}`);
    } catch (err) {
      if (err instanceof SeedError) throw err;
      if (attempt === 3) throw new SeedError(`Friendbot (${label})`, errorCode(err));
    }
    await sleep(2000);
  }
}

/** Construye, firma con una sola clave y envía una transacción. Devuelve la respuesta de Horizon. */
async function send(server, label, signer, operations) {
  try {
    const account = await server.loadAccount(signer.publicKey());
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    for (const op of operations) builder.addOperation(op);
    const tx = builder.setTimeout(60).build();
    tx.sign(signer);
    const res = await server.submitTransaction(tx);
    console.log(`  ✔ ${label}: ${EXPLORER_URL}/tx/${res.hash}`);
    return res;
  } catch (err) {
    throw new SeedError(label, errorCode(err));
  }
}

/** Cotiza una ruta de recepción exacta y devuelve la mejor (menor monto de origen). */
async function quote(server, label, sources, destAsset, destAmount) {
  let records = [];
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      records = (await server.strictReceivePaths(sources, destAsset, destAmount).call()).records;
    } catch (err) {
      throw new SeedError(`Cotización ${label}`, errorCode(err));
    }
    if (records.length > 0) break;
    await sleep(2000); // Horizon puede tardar unos segundos en indexar los pools nuevos
  }
  if (records.length === 0) throw new SeedError(`Cotización ${label}`, 'sin ruta disponible');
  const best = records.reduce((m, r) =>
    toStroops(r.source_amount) < toStroops(m.source_amount) ? r : m,
  );
  console.log(
    `  ✔ ${label}: recibir ${destAmount} cuesta ${best.source_amount} ` +
      `(saltos intermedios: ${best.path.length})`,
  );
  return best;
}

/** Comprueba en Horizon que el pool tiene las reservas depositadas. */
async function checkPool(server, label, poolId, expectedA, expectedB) {
  try {
    const pool = await server.liquidityPools().liquidityPoolId(poolId).call();
    const [ra, rb] = pool.reserves.map((r) => toStroops(r.amount));
    if (ra !== toStroops(expectedA) || rb !== toStroops(expectedB)) {
      throw new SeedError(`Pool ${label}`, 'las reservas no coinciden con lo depositado');
    }
    console.log(`  ✔ Pool ${label}: ${EXPLORER_URL}/liquidity-pool/${poolId}`);
  } catch (err) {
    if (err instanceof SeedError) throw err;
    throw new SeedError(`Pool ${label}`, errorCode(err));
  }
}

/** Comprueba que la clave maestra de un emisor quedó con peso 0. */
async function checkLocked(server, label, publicKey) {
  try {
    const acc = await server.loadAccount(publicKey);
    const master = acc.signers.find((s) => s.key === publicKey);
    if (!master || master.weight !== 0) {
      throw new SeedError(`Bloqueo ${label}`, 'la clave maestra no quedó en peso 0');
    }
    console.log(`  ✔ Emisor ${label} bloqueado (peso de clave maestra = 0)`);
  } catch (err) {
    if (err instanceof SeedError) throw err;
    throw new SeedError(`Bloqueo ${label}`, errorCode(err));
  }
}

async function main() {
  const server = new Horizon.Server(HORIZON_URL);

  // Claves efímeras: solo en memoria, nunca se imprimen ni se escriben.
  const issuerVes = Keypair.random();
  const issuerUsd = Keypair.random();
  const distributor = Keypair.random();

  const ves = new Asset('VESDEMO', issuerVes.publicKey());
  const usd = new Asset('USDDEMO', issuerUsd.publicKey());
  const xlm = Asset.native();

  console.log('1. Creando y fondeando cuentas (Friendbot)');
  await fund('Emisor VESDEMO', issuerVes.publicKey());
  await fund('Emisor USDDEMO', issuerUsd.publicKey());
  await fund('Distribuidor', distributor.publicKey());

  console.log('2. Trustlines del distribuidor hacia VESDEMO y USDDEMO');
  await send(server, 'Trustlines VESDEMO y USDDEMO', distributor, [
    Operation.changeTrust({ asset: ves }),
    Operation.changeTrust({ asset: usd }),
  ]);

  console.log('3. Emisión del suministro fijo al distribuidor');
  await send(server, `Emisión ${VES_SUPPLY} VESDEMO`, issuerVes, [
    Operation.payment({ destination: distributor.publicKey(), asset: ves, amount: VES_SUPPLY }),
  ]);
  await send(server, `Emisión ${USD_SUPPLY} USDDEMO`, issuerUsd, [
    Operation.payment({ destination: distributor.publicKey(), asset: usd, amount: USD_SUPPLY }),
  ]);

  const poolVesUsd = orderPool(ves, POOL_VES_USD.ves, usd, POOL_VES_USD.usd);
  const poolXlmVes = orderPool(xlm, POOL_XLM_VES.xlm, ves, POOL_XLM_VES.ves);
  const pools = [poolVesUsd, poolXlmVes].map((p) => {
    const lpAsset = new LiquidityPoolAsset(p.assetA, p.assetB, LiquidityPoolFeeV18);
    const poolId = Buffer.from(
      getLiquidityPoolId('constant_product', lpAsset.getLiquidityPoolParameters()),
    ).toString('hex');
    return { ...p, lpAsset, poolId };
  });

  console.log('4. Trustlines de participación en los dos pools');
  await send(
    server,
    'Trustlines de los pools',
    distributor,
    pools.map((p) => Operation.changeTrust({ asset: p.lpAsset })),
  );

  console.log('5. Depósitos de liquidez (precio acotado a ±1 %)');
  const labels = ['VESDEMO/USDDEMO', 'XLM/VESDEMO'];
  for (const [i, p] of pools.entries()) {
    const { minPrice, maxPrice } = priceBounds(p.amountA, p.amountB);
    await send(server, `Depósito en pool ${labels[i]}`, distributor, [
      Operation.liquidityPoolDeposit({
        liquidityPoolId: p.poolId,
        maxAmountA: p.amountA,
        maxAmountB: p.amountB,
        minPrice,
        maxPrice,
      }),
    ]);
  }
  for (const [i, p] of pools.entries()) {
    await checkPool(server, labels[i], p.poolId, p.amountA, p.amountB);
  }

  console.log('6. Bloqueo de los emisores (peso de clave maestra = 0)');
  const lockResults = [];
  for (const [label, kp] of [
    ['VESDEMO', issuerVes],
    ['USDDEMO', issuerUsd],
  ]) {
    lockResults.push(
      await send(server, `Bloqueo emisor ${label}`, kp, [Operation.setOptions({ masterWeight: 0 })]),
    );
  }
  await checkLocked(server, 'VESDEMO', issuerVes.publicKey());
  await checkLocked(server, 'USDDEMO', issuerUsd.publicKey());

  console.log('7. Escribiendo configuración pública');
  const config = {
    network: 'TESTNET',
    seededAt: new Date().toISOString(),
    ledger: lockResults[lockResults.length - 1].ledger,
    assets: {
      VESDEMO: { code: 'VESDEMO', issuer: issuerVes.publicKey() },
      USDDEMO: { code: 'USDDEMO', issuer: issuerUsd.publicKey() },
    },
    distributor: distributor.publicKey(),
    pools: {
      vesUsd: {
        id: pools[0].poolId,
        assetA: pools[0].assetA.toString(),
        assetB: pools[0].assetB.toString(),
        fee: LiquidityPoolFeeV18,
      },
      xlmVes: {
        id: pools[1].poolId,
        assetA: pools[1].assetA.toString(),
        assetB: pools[1].assetB.toString(),
        fee: LiquidityPoolFeeV18,
      },
    },
    issuersLocked: true,
    fictionalRates: {
      vesPerUsd: '100',
      vesPerXlm: '100',
      note: 'Tasas ficticias de demostración: no son tasas reales de ningún mercado.',
    },
  };
  const text = `${JSON.stringify(config, null, 2)}\n`;
  // Defensa extra: nunca escribir algo con forma de clave secreta.
  if (/\bS[A-Z2-7]{55}\b/.test(text)) {
    throw new SeedError('Escritura de configuración', 'el contenido tiene forma de clave secreta');
  }
  writeFileSync(ASSETS_FILE, text, 'utf8');
  console.log('  ✔ src/config/testnet-assets.json escrito (solo datos públicos)');

  console.log('8. Cotizaciones de prueba (recepción exacta)');
  await quote(server, 'VESDEMO -> USDDEMO', [ves], usd, QUOTE_USD_AMOUNT);
  await quote(server, 'XLM -> VESDEMO', [xlm], ves, QUOTE_VES_AMOUNT);

  console.log('\nSiembra terminada. Las claves secretas se descartan al salir del proceso.');
}

main().catch((err) => {
  // Solo el paso y el código de resultado; nunca el objeto de error completo.
  const detail = err instanceof SeedError ? err.message : errorCode(err);
  console.error(`\nLa siembra falló. ${detail}`);
  process.exitCode = 1;
});
