// Pruebas negativas permanentes de los tres scripts de control (check:secrets, check:network,
// check:code). Se crean carpetas temporales DENTRO del proyecto (tests/.tmp, ignorada por git)
// y se borran al terminar. Las claves y frases "malas" se arman por partes y son inventadas.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanCode } from '../scripts/check-code.mjs';
import { scanNetwork } from '../scripts/check-network.mjs';
import { scanSecrets } from '../scripts/check-secrets.mjs';

const base = resolve(import.meta.dirname, '.tmp');
let root = '';

function put(rel, content) {
  const file = join(root, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

beforeEach(() => {
  mkdirSync(base, { recursive: true });
  root = mkdtempSync(join(base, 'case-'));
  for (const d of ['src', 'scripts', 'dist']) mkdirSync(join(root, d));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('check:secrets', () => {
  const fake = `S${'ABCDEFGH'.repeat(7).slice(0, 55)}`; // S + 55 caracteres base32, inventada

  it('pasa con código limpio', () => {
    put('src/a.js', 'export const x = 1;');
    expect(scanSecrets(root)).toEqual([]);
  });
  it.each(['src/a.js', 'scripts/b.mjs', 'dist/c.js'])('falla con una clave en %s', (file) => {
    put(file, `export const k = '${fake}';`);
    const errors = scanSecrets(root);
    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toContain(fake); // nunca imprime el valor
  });
  it('falla si falta una carpeta revisada', () => {
    rmSync(join(root, 'dist'), { recursive: true });
    expect(scanSecrets(root)).toHaveLength(1);
  });
});

describe('check:network', () => {
  const phrase = ['Public Global Stellar', 'Network ; September 2015'].join(' ');
  const constant = ['Networks', 'PUBLIC'].join('.');
  const url = `https://${['horizon', 'stellar', 'org'].join('.')}`;

  it('pasa con la red de pruebas', () => {
    put('src/a.js', "export const u = 'https://horizon-testnet.stellar.org';");
    expect(scanNetwork(root)).toEqual([]);
  });
  it.each([
    ['frase de mainnet', phrase],
    ['constante del SDK', constant],
    ['URL de Horizon de mainnet', url],
  ])('falla con %s', (_, text) => {
    put('src/a.js', `export const v = '${text}';`);
    expect(scanNetwork(root)).toHaveLength(1);
  });
  it('límite documentado: no detecta la frase armada por partes en el código', () => {
    put('src/a.js', "export const v = ['Public Global Stellar', 'Network ; September 2015'].join(' ');");
    expect(scanNetwork(root)).toEqual([]);
  });
});

describe('check:code', () => {
  const html = ['dangerously', 'SetInnerHTML'].join('');
  const inner = ['el.inner', 'HTML = x'].join('');
  const dyn = ['ev', 'al("1")'].join('');
  const fn = ['new ', 'Function("return 1")'].join('');
  const cdn = `https://${['fonts', 'googleapis', 'com'].join('.')}/css`;

  it('pasa con código limpio y no da falso positivo con "retrieval("', () => {
    put('src/a.js', 'export const x = retrieval(1);');
    put('index.html', '<html></html>');
    expect(scanCode(root)).toEqual([]);
  });
  it.each([
    ['dangerouslySetInnerHTML', `<div ${html}={{ __html: x }} />`],
    ['asignación a innerHTML', inner],
    ['ejecución dinámica', dyn],
    ['constructor de funciones', fn],
    ['fuente externa', `@import url('${cdn}');`],
  ])('falla con %s', (_, text) => {
    put('src/a.jsx', text);
    expect(scanCode(root)).toHaveLength(1);
  });
  it('falla con un recurso externo en index.html', () => {
    put('index.html', `<link href="${cdn}" rel="stylesheet" />`);
    expect(scanCode(root)).toHaveLength(1);
  });
});
