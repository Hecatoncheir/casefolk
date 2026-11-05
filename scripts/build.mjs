import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
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
console.log('Сайт собран в dist/. SVG-файлов:', (await readdir(path.join(output, 'assets/svg'))).filter(name => name.endsWith('.svg')).length);
