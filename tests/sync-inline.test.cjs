const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'sync-inline.mjs');
const start = '/* DEFAULT_CATALOG_START */';
const end = '/* DEFAULT_CATALOG_END */';
const service = 'export async function createFirebaseService() {}\n';
const catalog = [{id: 'example'}];
const app = "console.log('before');\n" + start + JSON.stringify(catalog) + end + "\nconsole.log('after');\n";
const head = '<!DOCTYPE html>\n<html><body><main>Preserve me</main>\n';
const tail = '</body></html>\n';
const generated = head + '<script>\n' + service.replace('export ', '') + app + '</script>' + tail;

function withWorkspace(overrides, fn) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rapidfire-sync-inline-'));
  try {
    fs.mkdirSync(path.join(cwd, 'js'), {recursive: true});
    fs.mkdirSync(path.join(cwd, 'projects/defaults'), {recursive: true});
    const files = {
      'index.html': generated,
      'js/app.js': app,
      'js/firebase-service.js': service,
      'projects/defaults/catalog.json': JSON.stringify(catalog),
      ...overrides,
    };
    for (const [name, value] of Object.entries(files))
      fs.writeFileSync(path.join(cwd, name), value);
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {cwd, encoding: 'utf8'});
    const read = name => fs.readFileSync(path.join(cwd, name), 'utf8');
    fn({run, read, files});
  } finally {
    fs.rmSync(cwd, {recursive: true, force: true});
  }
}

test('an already synchronized page passes check without edits', () => {
  withWorkspace({}, ({run, read, files}) => {
    assert.equal(run('--check').status, 0);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('sync regenerates the catalog while preserving surrounding HTML', () => {
  withWorkspace({
    'js/app.js': start + '[]' + end + '\n',
    'index.html': head + '<script>\nold script</script>' + tail,
  }, ({run, read}) => {
    assert.equal(run().status, 0);
    assert.match(read('index.html'), /<main>Preserve me<\/main>/);
    assert.equal(run('--check').status, 0);
  });
});

test('check mode detects mismatches without changing either file', () => {
  withWorkspace({'index.html': head + '<script>\nold script</script>' + tail}, ({run, read, files}) => {
    const result = run('--check');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Embedded JavaScript differs/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('missing script opening marker is rejected without writes', () => {
  withWorkspace({'index.html': head + '<div>no inline script</div>' + tail}, ({run, read, files}) => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected one complete inline/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('missing script closing marker is rejected without writes', () => {
  withWorkspace({'index.html': head + '<script>\nconst x = 1;' + tail}, ({run, read, files}) => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected one complete inline/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('multiple script blocks are rejected instead of discarding HTML', () => {
  const extra = head + '<script>\nfirst()</script><p>Keep this</p><script>\nsecond()</script>' + tail;
  withWorkspace({'index.html': extra}, ({run, read, files}) => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected one complete inline/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('missing catalog markers are rejected before any writes', () => {
  withWorkspace({'js/app.js': 'console.log("no catalog");\n'}, ({run, read, files}) => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /starter catalog markers/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});

test('missing service export is rejected before any writes', () => {
  withWorkspace({'js/firebase-service.js': 'async function renamedFirebaseService() {}\n'}, ({run, read, files}) => {
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Firebase service export marker/);
    assert.equal(read('index.html'), files['index.html']);
    assert.equal(read('js/app.js'), files['js/app.js']);
  });
});
