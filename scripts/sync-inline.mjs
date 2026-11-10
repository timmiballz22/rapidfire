import {readFile, writeFile} from 'node:fs/promises';

const check = process.argv.includes('--check');
const path = 'index.html';
const html = (await readFile(path, 'utf8')).replace(/\r\n/g, '\n');
const originalService = (await readFile('js/firebase-service.js', 'utf8')).replace(/\r\n/g, '\n');
const serviceExport = 'export async function createFirebaseService';
if (!originalService.includes(serviceExport))
  throw new Error('Firebase service export marker is missing; refusing to modify inline scripts.');
const service = originalService.replace(serviceExport, 'async function createFirebaseService');
const originalApp = (await readFile('js/app.js', 'utf8')).replace(/\r\n/g, '\n');
const catalog = JSON.parse(await readFile('projects/defaults/catalog.json', 'utf8'));

const catalogStart = '/* DEFAULT_CATALOG_START */';
const catalogEnd = '/* DEFAULT_CATALOG_END */';
const start = originalApp.indexOf(catalogStart);
const end = originalApp.indexOf(catalogEnd);
if (start < 0 || end <= start || originalApp.indexOf(catalogStart, start + catalogStart.length) !== -1 ||
    originalApp.indexOf(catalogEnd, end + catalogEnd.length) !== -1)
  throw new Error('Expected exactly one ordered pair of starter catalog markers in js/app.js.');
const app = originalApp.slice(0, start) + catalogStart + JSON.stringify(catalog) + catalogEnd +
  originalApp.slice(end + catalogEnd.length);

if (check && app !== originalApp)
  throw new Error('Embedded starter catalog differs. Run node scripts/sync-inline.mjs.');

const scriptOpen = '<script>\n';
const open = html.indexOf(scriptOpen);
const close = html.lastIndexOf('</script>');
if (open < 0 || close < open + scriptOpen.length ||
    html.indexOf('</script>', open + scriptOpen.length) !== close)
  throw new Error('Expected one complete inline <script> block in index.html; refusing to overwrite it.');

const result = html.slice(0, open) + scriptOpen + service + app + '</script>' + html.slice(close + 9);
if (check) {
  if (result !== html)
    throw new Error('Embedded JavaScript differs from js/. Run node scripts/sync-inline.mjs.');
} else {
  await writeFile('js/app.js', app);
  await writeFile(path, result);
}
