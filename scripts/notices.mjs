// Writes THIRD_PARTY_NOTICES.txt into the extension's public folder, so
// every build carries the licence and copyright notices of the libraries it
// bundles. MIT, BSD and Apache all ask for that when the code is shared.
//
// Usage: node scripts/notices.mjs <workspace package name> <output file>

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [pkg = '@askwell/preflight', out = 'apps/preflight/public/THIRD_PARTY_NOTICES.txt'] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');

const json = execFileSync('pnpm', ['--filter', pkg, 'licenses', 'list', '--prod', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

const entries = Object.entries(JSON.parse(json))
  .flatMap(([license, packages]) => packages.map((p) => ({ ...p, license })))
  .filter((p) => !p.name.startsWith('@askwell/'))
  .sort((a, b) => a.name.localeCompare(b.name));

const sections = entries.map((p) => {
  const dir = p.paths?.[0];
  const files = dir && existsSync(dir) ? readdirSync(dir).filter((f) => LICENCE_FILE.test(f)).sort() : [];
  const texts = files.map((f) => readFileSync(path.join(dir, f), 'utf8').trim());
  const head = `${p.name} ${p.versions.join(', ')} (${p.license})${p.homepage ? `\n${p.homepage}` : ''}`;
  return `${head}\n\n${texts.length ? texts.join('\n\n') : `Licensed under ${p.license}.`}`;
});

const rule = `\n\n${'-'.repeat(72)}\n\n`;
const text =
  `Preflight bundles the following open-source software. Each is used under its own licence, reproduced below.\n` +
  `${entries.length} packages.${rule}${sections.join(rule)}\n`;

mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
writeFileSync(path.resolve(root, out), text);
console.log(`Wrote ${out}: ${entries.length} packages.`);
