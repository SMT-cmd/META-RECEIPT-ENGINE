const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const indexHtmlPath = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

function collectHtmlFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const htmlFiles = [];

  for (const entry of entries) {
    if (entry.name === '.trae-html-share-packages') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      htmlFiles.push(...collectHtmlFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(fullPath);
    }
  }

  return htmlFiles;
}

function extractHrefTargets(html) {
  return Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);
}

function extractIds(html) {
  return new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]));
}

function parseLocalHref(htmlFilePath, href) {
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  ) {
    return null;
  }

  const [relativePath, fragment] = href.split('#');
  const resolvedPath = relativePath
    ? relativePath.startsWith('/')
      ? path.join(rootDir, relativePath)
      : path.resolve(path.dirname(htmlFilePath), relativePath)
    : htmlFilePath;

  return {
    href,
    resolvedPath,
    fragment,
  };
}

test('firebase functions directory includes a deployable package manifest', () => {
  const manifestPath = path.join(rootDir, 'functions', 'package.json');
  assert.equal(fs.existsSync(manifestPath), true, 'Expected functions/package.json to exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(typeof manifest.name, 'string');
  assert.equal(typeof manifest.dependencies?.['firebase-admin'], 'string');
  assert.equal(typeof manifest.dependencies?.['firebase-functions'], 'string');
});

test('site navigation links resolve to existing files and fragment targets', () => {
  const htmlFiles = collectHtmlFiles(rootDir);
  const failures = [];

  for (const htmlFilePath of htmlFiles) {
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    for (const href of extractHrefTargets(html)) {
      const localHref = parseLocalHref(htmlFilePath, href);
      if (!localHref) {
        continue;
      }

      if (!fs.existsSync(localHref.resolvedPath)) {
        failures.push(`${path.relative(rootDir, htmlFilePath)} -> ${href}`);
        continue;
      }

      if (!localHref.fragment) {
        continue;
      }

      const targetHtml = fs.readFileSync(localHref.resolvedPath, 'utf8');
      const ids = extractIds(targetHtml);
      if (!ids.has(localHref.fragment)) {
        failures.push(`${path.relative(rootDir, htmlFilePath)} -> ${href}`);
      }
    }
  }

  assert.deepEqual(failures, [], `Broken navigation targets: ${failures.join(', ')}`);
});

test('homepage hero image uses the approved generated image endpoint', () => {
  const match = indexHtml.match(/<img[^>]+src="([^"]+)"/);
  assert.ok(match, 'Expected homepage hero image to be present');
  assert.match(
    match[1],
    /^https:\/\/coresg-normal\.trae\.ai\/api\/ide\/v1\/text_to_image\?/,
    'Expected homepage hero image to use the approved image endpoint',
  );
});
