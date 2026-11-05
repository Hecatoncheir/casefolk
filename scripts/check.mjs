import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const svgRoot = new URL('assets/svg/', root);
const files = (await readdir(svgRoot)).filter(name => name.endsWith('.svg'));
assert.ok(files.length >= 14, 'Не хватает SVG-файлов');
for (const name of files) {
  const source = await readFile(new URL(name, svgRoot), 'utf8');
  assert.match(source, /<svg\b[^>]*viewBox=/, `${name}: нет viewBox`);
  assert.match(source, /<path\b/, `${name}: нет векторных контуров`);
  assert.doesNotMatch(source, /<(?:image|foreignObject|script)\b|data:image|base64|(?:href|src)=["']https?:/i, `${name}: растровый или внешний ресурс`);
}
for (const name of ['index.html', 'brand.html', 'styles.css', 'brand.css', 'js/app.js', 'js/config.js', 'js/preview.js', 'js/storage.js', 'js/motion.js', 'js/build-files.js', 'js/build-library.js', 'js/build-gallery.js']) {
  const source = await readFile(new URL(name, root), 'utf8');
  assert.doesNotMatch(source, /window\.openai|globalThis\.Tweak|__CASEFOLK|data:image/, `${name}: осталась зависимость от макета`);
  if (name.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(name, root))], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
  }
}
for (const font of ['nunito', 'nunito-sans', 'jetbrains-mono']) {
  assert.ok((await stat(new URL(`assets/fonts/${font}.woff2`, root))).size > 1000, `Нет шрифта ${font}`);
}
assert.ok((await stat(new URL('downloads/casefolk-svg.zip', root))).size > 1000, 'Нет архива SVG');
console.log(`Проверено ${files.length} настоящих SVG, синтаксис JavaScript и комплектность сайта.`);
