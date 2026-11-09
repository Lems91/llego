// Falla si el código propio (src/ y scripts/) contiene la frase de red de mainnet,
// la constante del SDK para esa red o URLs de Horizon/RPC de mainnet. No revisa dist/ porque
// el SDK compilado trae las constantes de todas las redes.
// Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
// Límite conocido: solo detecta el texto escrito completo, no armado por partes en el código.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

/**
 * @param {string} root
 * @param {string[]} [dirs]
 * @returns {string[]} Mensajes de error (vacío si todo está bien).
 */
export function scanNetwork(root, dirs = ['src', 'scripts']) {
  const errors = [];
  for (const d of dirs) {
    const dir = join(root, d);
    if (!existsSync(dir)) {
      errors.push(`check:network: falta la carpeta ${d}/`);
      continue;
    }
    for (const file of listFiles(dir)) {
      const text = readFileSync(file, 'utf8');
      // "horizon-testnet.stellar.org" no contiene el patrón exacto, así que no da falso positivo.
      if (forbidden.some((needle) => text.includes(needle))) {
        errors.push(`check:network: referencia a mainnet en ${file}`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = scanNetwork(resolve(import.meta.dirname, '..'));
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log('check:network: OK (src/ y scripts/ sin referencias a mainnet)');
}
