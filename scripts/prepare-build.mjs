import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist', { recursive: true, withFileTypes: true }))
  .filter((file) => file.isFile() && file.name !== 'sw.js')
  .map((file) => `${file.parentPath}/${file.name}`.replace(/^dist\//, ''))
  .sort();
const hash = createHash('sha256');
for (const asset of assets) hash.update(await readFile(`dist/${asset}`));
const version = hash.digest('hex').slice(0, 16);
const source = await readFile('public/sw.js', 'utf8');
await writeFile(
  'dist/sw.js',
  source
    .replace("const BUILD = 'development'; // __BUILD_ID__", `const BUILD = '${version}';`)
    .replace('const ASSETS = []; // __PRECACHE__', `const ASSETS = ${JSON.stringify(assets)};`),
);
console.log(`Offline build ${version}: ${assets.length} assets prepared.`);
