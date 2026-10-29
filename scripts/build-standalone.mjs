#!/usr/bin/env node
/**
 * Builds the fully self-contained browser version of Anbar.
 * Usage: node scripts/build-standalone.mjs
 * Uses only Node.js built-ins, so no package installation is required.
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT_HTML = resolve(ROOT, 'index.html');
const INPUT_CSS = resolve(ROOT, 'index.css');
const INPUT_JS = resolve(ROOT, 'index.js');
const INPUT_XLSX = resolve(ROOT, 'vendor/xlsx.full.min.js');
const OUTPUT_HTML = resolve(ROOT, 'anbar-standalone.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readRequiredFile(path, label) {
  try {
    const fileStat = await stat(path);
    assert(fileStat.isFile(), label + ' is not a file: ' + path);
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error('Cannot read required ' + label + ' at ' + path + ': ' + error.message);
  }
}

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern) || [];
  assert(matches.length === 1, 'Expected exactly one ' + label + ' reference, found ' + matches.length + '.');
  return source.replace(pattern, replacement);
}

function safeInlineScript(source) {
  // Prevent an embedded closing-script sequence from terminating the HTML element.
  return source.replace(/<\/script/gi, '<\\/script');
}

function safeInlineStyle(source) {
  return source.replace(/<\/style/gi, '<\\/style');
}

function assertNoRequiredLocalReferencesRemain(html) {
  // Scan HTML markup only; embedded JavaScript libraries can contain strings
  // such as "src=\"...\"" that are not actual HTML dependencies.
  const markupOnly = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const refs = [];
  for (const match of markupOnly.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const value = match[1].trim();
    if (value.startsWith('#') || /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value)) continue;
    refs.push(value);
  }
  assert(refs.length === 0, 'Standalone output still contains local file references: ' + refs.join(', '));
}

async function main() {
  const [htmlFile, cssFile, jsFile, xlsxFile] = await Promise.all([
    readRequiredFile(INPUT_HTML, 'source HTML'),
    readRequiredFile(INPUT_CSS, 'stylesheet'),
    readRequiredFile(INPUT_JS, 'application JavaScript'),
    readRequiredFile(INPUT_XLSX, 'local SheetJS library')
  ]);
  let html = htmlFile;
  const css = cssFile;
  const appJs = jsFile;
  const xlsxJs = xlsxFile;

  assert(html.includes('<!DOCTYPE html>'), 'index.html does not appear to be a complete HTML document.');
  assert(html.includes('id="app-layout"'), 'Expected main application layout was not found in index.html.');
  assert(appJs.trim().length > 0, 'index.js is empty.');
  assert(css.trim().length > 0, 'index.css is empty.');
  assert(xlsxJs.trim().length > 0, 'The local SheetJS library is empty.');

  html = replaceExactlyOnce(
    html,
    /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']index\.css["'])[^>]*>\s*/i,
    '<style>\n' + safeInlineStyle(css) + '\n</style>\n',
    'index.css stylesheet'
  );

  html = replaceExactlyOnce(
    html,
    /<script\b(?=[^>]*\bsrc=["']vendor\/xlsx\.full\.min\.js["'])[^>]*>\s*<\/script>\s*/i,
    '<script>\n' + safeInlineScript(xlsxJs) + '\n</script>\n',
    'local SheetJS script'
  );

  html = replaceExactlyOnce(
    html,
    /<script\b(?=[^>]*\bsrc=["']index\.js["'])[^>]*>\s*<\/script>\s*/i,
    '<script>\n' + safeInlineScript(appJs) + '\n</script>\n',
    'index.js application script'
  );

  assertNoRequiredLocalReferencesRemain(html);

  const banner = [
    '<!--',
    '  نسخه مستقل تولیدشده به‌صورت خودکار؛ این فایل را دستی ویرایش نکنید.',
    '  منبع اصلی: index.html + index.css + index.js + vendor/xlsx.full.min.js',
    '  برای ساخت مجدد اجرا کنید: node scripts/build-standalone.mjs',
    '-->',
    ''
  ].join('\n');

  html = banner + html.replace(/^\uFEFF/, '');

  assert(html.includes('<style>'), 'Embedded CSS was not found in generated output.');
  assert((html.match(/<script(?:\s[^>]*)?>/gi) || []).length >= 3, 'Expected embedded JavaScript blocks were not found.');
  // Local dependency references are checked against HTML markup above, not JS strings.

  await writeFile(OUTPUT_HTML, html, 'utf8');
  console.log('Standalone build successful: anbar-standalone.html');
  console.log('Output size: ' + Buffer.byteLength(html, 'utf8') + ' bytes');
}

main().catch(error => {
  console.error('Standalone build failed: ' + error.message);
  process.exitCode = 1;
});
