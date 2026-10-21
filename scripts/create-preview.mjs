import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicAssets = path.join(root, 'public/assets');
const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
};
const imageExtensions = new Set(
  Object.entries(mimeTypes)
    .filter(
      ([, mime]) =>
        mime.startsWith('image/') || mime.startsWith('audio/') || mime === 'application/json',
    )
    .map(([extension]) => extension),
);
const dataCache = new Map();

async function dataUrl(filePath) {
  const resolved = path.resolve(filePath);
  if (dataCache.has(resolved)) return dataCache.get(resolved);
  const mime = mimeTypes[path.extname(resolved).toLowerCase()];
  if (!mime) throw new Error('Unsupported preview asset: ' + path.basename(resolved));
  const data = 'data:' + mime + ';base64,' + (await readFile(resolved)).toString('base64');
  dataCache.set(resolved, data);
  return data;
}

function builtPath(url, fromFile) {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  let resolved;
  if (clean.startsWith('/')) {
    // Vite can emit a repository prefix when a custom Pages base is configured.
    const assetsIndex = clean.lastIndexOf('/assets/');
    resolved = path.join(dist, assetsIndex >= 0 ? clean.slice(assetsIndex + 1) : clean);
  } else {
    resolved = path.resolve(path.dirname(fromFile), clean);
  }
  if (resolved !== dist && !resolved.startsWith(dist + path.sep)) {
    throw new Error('Preview asset resolves outside the production build: ' + url);
  }
  return resolved;
}

async function inlineCss(css, fromFile) {
  const matches = [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/g)];
  for (const match of matches) {
    const url = match[1] ?? match[2] ?? match[3];
    if (!url || url.startsWith('data:') || url.startsWith('#')) continue;
    if (/^(?:https?:)?\/\//i.test(url)) {
      throw new Error('The offline preview needs a local copy of this CSS asset: ' + url);
    }
    const fragment = url.includes('#') ? '#' + url.split('#').slice(1).join('#') : '';
    const embedded = await dataUrl(builtPath(url, fromFile));
    css = css.replaceAll(match[0], 'url("' + embedded + fragment + '")');
  }
  return css;
}

async function collectImages(directory, map) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectImages(file, map);
    } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      const key = path.relative(publicAssets, file).split(path.sep).join('/');
      map[key] = await dataUrl(file);
    }
  }
}

const htmlPath = path.join(dist, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const jsUrl = html.match(/src="([^"]+\.js(?:\?[^"]*)?)"/)?.[1];
const stylesheetUrls = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(
  (match) => match[1],
);
if (!jsUrl || !stylesheetUrls.length) throw new Error('Run npm run build first.');

let js = await readFile(builtPath(jsUrl, htmlPath), 'utf8');
js = js.replace(/\/\/# sourceMappingURL=.*$/gm, '').replaceAll('</script', '<\\/script');
const styles = [];
for (const url of stylesheetUrls) {
  const cssPath = builtPath(url, htmlPath);
  styles.push(await inlineCss(await readFile(cssPath, 'utf8'), cssPath));
}

// All rendered image families share the same runtime asset() lookup:
// drawings, pixel sprites, animated sheets, trainer variants, items, branding
// and the lazily loaded battle frame manifests.
// Font files are already embedded in CSS and are not duplicated in this map.
const map = {};
await collectImages(publicAssets, map);
const favicon = await dataUrl(path.join(publicAssets, 'brand/kanto-emblem.png'));
const output =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="theme-color" content="#f6f4ee">' +
  '<title>Kanto · Frontend preview</title><link rel="icon" type="image/png" href="' +
  favicon +
  '"><style>' +
  styles.join('\n') +
  '</style></head><body><div id="root"></div>' +
  '<script>globalThis.__POKEPAD_ASSETS__=' +
  JSON.stringify(map) +
  ';</script><script>' +
  js +
  '</script></body></html>';

await mkdir(path.join(root, 'artifacts'), { recursive: true });
await writeFile(path.join(root, 'artifacts/Kanto-Preview.html'), output);
console.log(
  'Created artifacts/Kanto-Preview.html (' +
    (Buffer.byteLength(output) / 1024 / 1024).toFixed(1) +
    ' MiB), with ' +
    Object.keys(map).length +
    ' embedded media files and all stylesheet assets.',
);
