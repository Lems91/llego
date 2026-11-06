// Falla si el código propio (src/ y scripts/) contiene la frase de red de mainnet,
// la constante del SDK para esa red o URLs de Horizon/RPC de mainnet. No revisa dist/ porque el SDK
// compilado trae las constantes de todas las redes.
// Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dirs = ['src', 'scripts'];
const textExt = /\.(js|jsx|mjs|cjs|json|html|css|md|txt|svg)$/i;

const forbidden = [
  ['Public Global Stellar', 'Network ; September 2015'].join(' '),
  ['Networks', 'PUBLIC'].join('.'),
  ['horizon', 'stellar', 'org'].join('.'),
  ['horizon', 'stellar', 'lobstr', 'co'].join('.'),
  ['mainnet', 'sorobanrpc', 'com'].join('.'),
  ['soroban-rpc', 'mainnet', 'stellar', 'gateway', 'fm'].join('.'),
];

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (textExt.test(name)) out.push(full);
  }
  return out;
}

let failed = false;
for (const d of dirs) {
  const dir = join(root, d);
  if (!existsSync(dir)) {
    console.error(`check:network: falta la carpeta ${d}/`);
    failed = true;
    continue;
  }
  for (const file of listFiles(dir)) {
    const text = readFileSync(file, 'utf8');
    for (const needle of forbidden) {
      // Evita falsos positivos como "horizon-testnet.stellar.org" (no contiene el patrón exacto).
      if (text.includes(needle)) {
        console.error(`check:network: referencia a mainnet en ${file}`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
console.log('check:network: OK (src/ y scripts/ sin referencias a mainnet)');
