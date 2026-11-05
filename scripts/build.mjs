import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
if (path.relative(root, output) !== 'dist') throw new Error('Неверный каталог сборки');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'brand.html', 'styles.css', 'brand.css', 'js', 'assets', 'downloads']) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
await writeFile(path.join(output, '.nojekyll'), '');

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  }));
  return groups.flat().sort();
}

// Одна версия для всей статики исключает смешивание старых модулей с новым HTML.
const files = await filesIn(output);
const hash = createHash('sha256');
for (const file of files) hash.update(path.relative(output, file)).update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);
for (const file of files.filter(file => /\.(html|css|js)$/.test(file))) {
  const content = await readFile(file, 'utf8');
  const updated = content.replace(/(["'])(\.\/[^"'?#\s]+\.(?:js|css|svg|woff2|ttf|zip))\1/g, (_, quote, url) => `${quote}${url}?v=${version}${quote}`);
  await writeFile(file, updated);
}
console.log('Сайт собран в dist/. SVG-файлов:', (await readdir(path.join(output, 'assets/svg'))).filter(name => name.endsWith('.svg')).length);
