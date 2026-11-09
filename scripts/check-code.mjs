// Falla si src/ o index.html contienen patrones prohibidos de interfaz (inyección de HTML,
// ejecución dinámica de código) o cargan recursos externos (CDN, fuentes, analítica).
// Los patrones se arman por partes para que este archivo no se detecte a sí mismo.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const textExt = /\.(js|jsx|mjs|cjs|html|css)$/i;

const dangerous = [
  ['dangerously', 'SetInnerHTML'].join(''),
  ['.inner', 'HTML'].join(''),
  ['.outer', 'HTML'].join(''),
  ['insertAdjacent', 'HTML'].join(''),
  ['document', '.write('].join(''),
  ['ev', 'al('].join(''),
  ['new ', 'Function'].join(''),
];
// Evita falsos positivos como "retrieval(": si el patrón empieza por una letra, no puede ir
// pegado a otra letra. Los que empiezan por "." (como .innerHTML) se buscan siempre.
const dangerousRegexes = dangerous.map((d) => {
  const escaped = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(/^[A-Za-z_]/.test(d) ? `(?<![A-Za-z0-9_])${escaped}` : escaped);
});

const externalHosts = [
  ['fonts', 'googleapis', 'com'].join('.'),
  ['fonts', 'gstatic', 'com'].join('.'),
  ['cdn', 'jsdelivr', 'net'].join('.'),
  ['unpkg', 'com'].join('.'),
  ['cdnjs', 'cloudflare', 'com'].join('.'),
  ['google-analytics', 'com'].join('.'),
  ['googletagmanager', 'com'].join('.'),
  ['plausible', 'io'].join('.'),
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
 * @returns {string[]} Mensajes de error (vacío si todo está bien).
 */
export function scanCode(root) {
  const errors = [];
  const files = [];
  const src = join(root, 'src');
  if (existsSync(src)) files.push(...listFiles(src));
  else errors.push('check:code: falta la carpeta src/');
  const index = join(root, 'index.html');
  if (existsSync(index)) files.push(index);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (dangerousRegexes.some((re) => re.test(text))) {
      errors.push(`check:code: patrón prohibido de inyección o ejecución dinámica en ${file}`);
    }
    if (externalHosts.some((h) => text.includes(h))) {
      errors.push(`check:code: recurso externo (CDN, fuente o analítica) en ${file}`);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = scanCode(resolve(import.meta.dirname, '..'));
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log('check:code: OK (sin patrones prohibidos ni recursos externos en src/ e index.html)');
}
