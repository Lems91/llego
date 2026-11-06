// Falla si encuentra algo con forma de clave secreta de Stellar (S + 55 caracteres base32)
// en src/, scripts/ o dist/. Uso: node scripts/check-secrets.mjs
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dirs = ['src', 'scripts', 'dist'];
const pattern = /\bS[A-Z2-7]{55}\b/g;
const textExt = /\.(js|jsx|mjs|cjs|json|html|css|md|txt|map|svg)$/i;

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
    console.error(`check:secrets: falta la carpeta ${d}/ (¿ejecutaste la compilación?)`);
    failed = true;
    continue;
  }
  for (const file of listFiles(dir)) {
    const text = readFileSync(file, 'utf8');
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      // No se imprime el valor encontrado, solo dónde está.
      console.error(`check:secrets: posible clave secreta en ${file}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('check:secrets: OK (src/, scripts/ y dist/ sin claves secretas)');
