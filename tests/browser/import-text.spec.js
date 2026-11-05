import { test, expect } from '@playwright/test';
import { initial } from '../../js/config.js';

const config = name => ({ ...structuredClone(initial), name, frame: 'blue', parts: { ...initial.parts, ram: '64 ГБ' } });
const text = name => JSON.stringify(config(name), null, 2);

test('ручная вставка JSON и выбор файла доступны в одном окне импорта', async ({ page }) => {
  await page.goto('./#builds');
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Импорт сборки' })).toBeVisible();
  await page.locator('[data-paste-json]').fill(text('Из текста'));
  await page.screenshot({ path: '.artifacts/import-json-dialog.png', fullPage: true });
  await page.getByRole('button', { name: 'Загрузить в конструктор' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/#constructor$/);
  await expect(page.locator('[data-build-name]')).toHaveValue('Из текста');
  await expect(page.locator('[data-part=ram]')).toHaveValue('64 ГБ');
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  const selection = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Выбрать JSON-файл' }).click();
  await (await selection).setFiles({ name: 'file.json', mimeType: 'application/json', buffer: Buffer.from(text('Из файла')) });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[data-build-name]')).toHaveValue('Из файла');
});

test('буфер читается только по кнопке, затем JSON можно загрузить в конструктор', async ({ page }) => {
  await page.addInitScript(json => {
    window.clipboardReads = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: async () => { window.clipboardReads += 1; return json; },
    } });
  }, text('Из буфера'));
  await page.goto('./#constructor');
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  expect(await page.evaluate(() => window.clipboardReads)).toBe(0);
  await page.getByRole('button', { name: 'Вставить из буфера' }).click();
  await expect(page.locator('[data-paste-json]')).toHaveValue(text('Из буфера'));
  expect(await page.evaluate(() => window.clipboardReads)).toBe(1);
  await page.getByRole('button', { name: 'Загрузить в конструктор' }).click();
  await expect(page.locator('[data-build-name]')).toHaveValue('Из буфера');
  await expect(page.locator('[data-part=ram]')).toHaveValue('64 ГБ');
});

test('отказ доступа к буферу и неверный JSON оставляют ручной ввод и текущую сборку', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('./#constructor');
  await page.locator('[data-color-group=frame][data-color=terracotta]').click();
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить из буфера' }).click();
  await expect(page.locator('[data-paste-error]')).toContainText('Вставьте JSON в поле');
  await page.locator('[data-paste-json]').fill('{broken');
  await page.getByRole('button', { name: 'Загрузить в конструктор' }).click();
  await expect(page.locator('[data-paste-error]')).toContainText('Не удалось прочитать JSON');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Терракота');
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  await page.locator('[data-paste-json]').fill(text('Вручную'));
  await page.getByRole('button', { name: 'Загрузить в конструктор' }).click();
  await expect(page.locator('[data-build-name]')).toHaveValue('Вручную');
});

test('результат запоздавшего чтения не заменяет введённый текст и не применяется после отмены', async ({ page }) => {
  await page.addInitScript(json => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      readText: () => new Promise(resolve => { window.finishClipboardRead = () => resolve(json); }),
    } });
  }, text('Запоздавший буфер'));
  await page.goto('./#constructor');
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить из буфера' }).click();
  await page.locator('[data-paste-json]').fill(text('Ручной ввод'));
  await page.evaluate(() => window.finishClipboardRead());
  await expect(page.locator('[data-paste-json]')).toHaveValue(text('Ручной ввод'));
  await page.getByRole('button', { name: 'Вставить из буфера' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => window.finishClipboardRead());
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[data-paste-json]')).toHaveValue('');
  await expect(page.locator('[data-build-name]')).toHaveValue('');
});
