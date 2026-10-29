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

/**
 * Store JavaScript as Base64 in a non-executable script element.
 * The HTML parser therefore never treats text within minified dependencies
 * as HTML markup or an accidental closing script tag.
 */
function encodeScriptPayload(source, id) {
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return '<script type="application/x-anbar-base64" id="' + id + '">' +
    encoded +
    '</script>\n';
}

/**
 * Decode each payload and insert it as a real script through the DOM.
 * Using textContent avoids reparsing script source as HTML. Each inline
 * classic script executes synchronously when inserted, preserving order.
 */
function createScriptLoader() {
  return [
    '<script>',
    '(function () {',
    "  'use strict';",
    '',
    '  function runEmbeddedScript(payloadId) {',
    '    var payload = document.getElementById(payloadId);',
    '    if (!payload) {',
    "      throw new Error('Embedded script payload not found: ' + payloadId);",
    '    }',
    '',
    '    var binary = atob(payload.textContent.trim());',
    '    var bytes = new Uint8Array(binary.length);',
    '    for (var index = 0; index < binary.length; index += 1) {',
    '      bytes[index] = binary.charCodeAt(index);',
    '    }',
    '',
    "    var source = new TextDecoder('utf-8').decode(bytes);",
    "    var executable = document.createElement('script');",
    '    executable.textContent = source;',
    '    payload.replaceWith(executable);',
    '  }',
    '',
    "  runEmbeddedScript('anbar-xlsx-script');",
    "  runEmbeddedScript('anbar-app-script');",
    '})();',
    '</script>',
    ''
  ].join('\n');
}

function assertNoRequiredLocalReferencesRemain(html) {
  // Scan HTML markup only; JavaScript payloads are Base64 data, not dependencies.
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

function assertPayloadMatches(html, id, expectedSource) {
  const markerIndex = html.indexOf('id="' + id + '"');
  assert(markerIndex >= 0, 'Embedded script payload is missing: ' + id);

  const openingTagEnd = html.indexOf('>', markerIndex);
  assert(openingTagEnd >= 0, 'Opening tag is malformed for payload: ' + id);

  const closingTagStart = html.indexOf('</script>', openingTagEnd + 1);
  assert(closingTagStart >= 0, 'Closing tag is missing for payload: ' + id);

  const encoded = html.slice(openingTagEnd + 1, closingTagStart).trim();
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assert(decoded === expectedSource, 'Embedded script payload differs from source: ' + id);
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
    '<style>\n' + css.replace(/<\/style/gi, '<\\/style') + '\n</style>\n',
    'index.css stylesheet'
  );

  html = replaceExactlyOnce(
    html,
    /<script\b(?=[^>]*\bsrc=["']vendor\/xlsx\.full\.min\.js["'])[^>]*>\s*<\/script>\s*/i,
    encodeScriptPayload(xlsxJs, 'anbar-xlsx-script'),
    'local SheetJS script'
  );

  html = replaceExactlyOnce(
    html,
    /<script\b(?=[^>]*\bsrc=["']index\.js["'])[^>]*>\s*<\/script>\s*/i,
    encodeScriptPayload(appJs, 'anbar-app-script') + createScriptLoader(),
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
  assert(html.includes('id="anbar-xlsx-script"'), 'Embedded SheetJS payload was not found.');
  assert(html.includes('id="anbar-app-script"'), 'Embedded application payload was not found.');
  assert((html.match(/<script(?:\s[^>]*)?>/gi) || []).length >= 1, 'Expected script loader was not found.');

  // Confirm the embedded payloads decode to the exact source files.
  assertPayloadMatches(html, 'anbar-xlsx-script', xlsxJs);
  assertPayloadMatches(html, 'anbar-app-script', appJs);

  await writeFile(OUTPUT_HTML, html, 'utf8');
  console.log('Standalone build successful: anbar-standalone.html');
  console.log('Embedded JavaScript payloads match their source files exactly.');
  console.log('Output size: ' + Buffer.byteLength(html, 'utf8') + ' bytes');
}

main().catch(error => {
  console.error('Standalone build failed: ' + error.message);
  process.exitCode = 1;
});
