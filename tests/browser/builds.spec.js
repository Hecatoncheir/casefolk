import { test, expect } from '@playwright/test';
import { initial } from '../../js/config.js';

const fixture = (name = 'Из файла') => ({ ...structuredClone(initial), name, frame: 'blue', size: 'expanded', fans: 6, parts: { ...initial.parts, ram: '64 ГБ' } });
const upload = (page, value) => page.locator('[data-import-file]').setInputFiles({ name: 'build.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });

test('несколько сборок показывают превью, открываются и сохраняют изменения и копии', async ({ page }) => {
  await page.goto('./#builds');
  await expect(page.getByText('Здесь будут ваши сборки.')).toBeVisible();
  await page.getByRole('button', { name: 'Новая сборка ↗' }).click();
  await page.locator('[data-build-name]').fill('Первый ПК');
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await page.getByRole('button', { name: 'Новая сборка ↗' }).click();
  await page.locator('[data-build-name]').fill('Второй ПК');
  await page.locator('[data-color-group=frame][data-color=blue]').click();
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await expect(page.locator('.cf-build-card')).toHaveCount(2);
  await expect(page.locator('[data-build-preview] svg')).toHaveCount(2);
  await page.screenshot({ path: '.artifacts/my-builds-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Открыть сборку «Второй ПК» в конструкторе', exact: true }).click();
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await page.locator('[data-build-name]').fill('Второй обновлённый');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).first().click();
  await page.getByRole('button', { name: 'Сохранить копию', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await expect(page.locator('.cf-build-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Удалить сборку «Первый ПК»', exact: true }).click();
  await expect(page.locator('.cf-build-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Отменить удаление' }).click();
  await page.reload();
  await expect(page.locator('.cf-build-card')).toHaveCount(3);
  await page.setViewportSize({ width: 320, height: 850 });
  await expect(page.getByRole('button', { name: 'Мои сборки', exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/my-builds-mobile.png', fullPage: true });
});

test('JSON загружается в конструктор, сохраняется в списке и скачивается без потери параметров', async ({ page }) => {
  await page.goto('./#constructor');
  await upload(page, fixture());
  await expect(page.locator('[data-import-status]')).toContainText('JSON импортирован');
  await expect(page.locator('[data-build-name]')).toHaveValue('Из файла');
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await expect(page.locator('[data-dimensions]')).toHaveText('433 × 338 × 202 мм');
  await expect(page.locator('[data-part=ram]')).toHaveValue('64 ГБ');
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  const json = await page.evaluate(() => JSON.parse(localStorage.getItem('casefolk:v1:builds')));
  expect(json[0].config.fans).toBe(6);
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать JSON сборки «Из файла»', exact: true }).click();
  const file = await promise;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.name).toBe('Из файла');
  expect(exported.parts.ram).toBe('64 ГБ');
  expect(exported.frame).toBe('blue');
  await upload(page, exported);
  await expect(page.locator('[data-import-status]')).toContainText('JSON импортирован');
  await expect(page).toHaveURL(/#constructor$/);
});

test('ошибочный импорт не изменяет открытый вариант, а имя не исполняется как HTML', async ({ page }) => {
  await page.goto('./#constructor');
  await upload(page, fixture('<img src=x onerror="alert(1)">'));
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await upload(page, '{broken');
  await expect(page.locator('[data-import-status]')).toContainText('Не удалось прочитать JSON');
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await upload(page, {});
  await expect(page.locator('[data-import-status]')).toContainText('не поддерживаемая');
  await page.locator('[data-import-file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(256 * 1024 + 1, 32) });
  await expect(page.locator('[data-import-status]')).toContainText('слишком большой');
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await expect(page.locator('.cf-build-details strong')).toHaveText('<img src=x onerror="alert(1)">');
  await expect(page.locator('.cf-builds-grid img')).toHaveCount(0);
});

test('прежнее сохранение появляется в новом списке один раз и открывает нужный JSON', async ({ page }) => {
  await page.addInitScript(value => {
    if (localStorage.getItem('casefolk:v1:saved') === null) localStorage.setItem('casefolk:v1:saved', JSON.stringify(value));
  }, fixture());
  await page.goto('./#builds');
  await expect(page.locator('.cf-build-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.cf-build-card')).toHaveCount(1);
  await page.locator('.cf-build-open').click();
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await expect(page.locator('[data-part=ram]')).toHaveValue('64 ГБ');
});
