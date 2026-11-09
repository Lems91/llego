// Falla si encuentra algo con forma de clave secreta de Stellar (S + 55 caracteres base32)
// en src/, scripts/ o dist/. Uso: node scripts/check-secrets.mjs
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

/**
 * Revisa las carpetas indicadas bajo `root`.
 * @param {string} root
 * @param {string[]} [dirs]
 * @returns {string[]} Mensajes de error (vacío si todo está bien). Nunca incluyen el valor hallado.
 */
export function scanSecrets(root, dirs = ['src', 'scripts', 'dist']) {
  const pattern = /\bS[A-Z2-7]{55}\b/;
  const errors = [];
  for (const d of dirs) {
    const dir = join(root, d);
    if (!existsSync(dir)) {
      errors.push(`check:secrets: falta la carpeta ${d}/ (¿ejecutaste la compilación?)`);
      continue;
    }
    for (const file of listFiles(dir)) {
      if (pattern.test(readFileSync(file, 'utf8'))) {
        errors.push(`check:secrets: posible clave secreta en ${file}`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = scanSecrets(resolve(import.meta.dirname, '..'));
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log('check:secrets: OK (src/, scripts/ y dist/ sin claves secretas)');
}
