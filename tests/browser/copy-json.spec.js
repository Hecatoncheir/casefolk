import { test, expect } from '@playwright/test';
import { parseBuildJSON } from '../../js/build-files.js';

test('копирование передаёт текущий вариант и каждую сохранённую сборку без смешивания параметров', async ({ page }) => {
  await page.addInitScript(() => {
    window.copiedJSON = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.copiedJSON.push(text); },
    } });
  });
  const downloads = [];
  page.on('download', file => downloads.push(file));
  await page.goto('./#constructor');
  await page.locator('[data-build-name]').fill('Первый ПК');
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.locator('[data-build-name]').fill('Второй ПК');
  await page.locator('[data-color-group=frame][data-color=blue]').click();
  await page.getByRole('button', { name: 'Сохранить копию', exact: true }).click();
  await page.locator('[data-build-name]').fill('Несохранённые изменения');
  await page.locator('[data-color-group=frame][data-color=terracotta]').click();
  await page.getByRole('button', { name: 'К комплектующим →', exact: true }).click();
  await page.locator('[data-part=ram]').selectOption('64 ГБ');
  await page.getByRole('button', { name: 'Скопировать JSON', exact: true }).click();
  await expect(page.locator('[data-editor-copy-status]')).toContainText('JSON скопирован');
  const current = parseBuildJSON(await page.evaluate(() => window.copiedJSON[0]));
  expect(current.name).toBe('Несохранённые изменения');
  expect(current.config.frame).toBe('terracotta');
  expect(current.config.parts.ram).toBe('64 ГБ');
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await expect(page.locator('.cf-build-card')).toHaveCount(2);
  const stored = await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'));
  for (const [index, name, frame] of [[1, 'Первый ПК', 'sage'], [2, 'Второй ПК — копия', 'blue']]) {
    const button = page.getByRole('button', { name: `Скопировать JSON сборки «${name}»`, exact: true });
    await button.click();
    await expect(button.locator('xpath=ancestor::article').locator('[data-copy-status]')).toContainText('JSON скопирован');
    const copied = parseBuildJSON(await page.evaluate(i => window.copiedJSON[i], index));
    expect(copied.name).toBe(name);
    expect(copied.config.frame).toBe(frame);
    expect(copied.config.parts.ram).toBe('32 ГБ');
  }
  expect(await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'))).toBe(stored);
  expect(downloads).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/copy-json-gallery-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
  await page.locator('[data-paste-json]').fill(await page.evaluate(() => window.copiedJSON[0]));
  await page.getByRole('button', { name: 'Загрузить в конструктор' }).click();
  await expect(page.locator('[data-build-name]')).toHaveValue('Несохранённые изменения');
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Терракота');
});

for (const unavailable of [false, true]) {
  test(`ручное копирование доступно при ${unavailable ? 'отсутствии API буфера' : 'отказе доступа к буферу'}`, async ({ page }) => {
    await page.addInitScript(missing => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: missing ? undefined : {
        writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
      } });
    }, unavailable);
    await page.goto('./#constructor');
    await page.locator('[data-build-name]').fill('Для друга');
    await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
    await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
    const copy = page.getByRole('button', { name: 'Скопировать JSON сборки «Для друга»', exact: true });
    await copy.click();
    await expect(page.getByRole('dialog', { name: 'JSON сборки', exact: true })).toBeVisible();
    const field = page.getByRole('textbox', { name: 'JSON для копирования', exact: true });
    expect(parseBuildJSON(await field.inputValue()).name).toBe('Для друга');
    await expect(field).toBeFocused();
    expect(await field.evaluate(element => element.selectionEnd - element.selectionStart)).toBe((await field.inputValue()).length);
    await page.getByRole('button', { name: 'Выделить JSON', exact: true }).click();
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(copy).toBeFocused();
    await expect(page.locator('[data-copy-status]')).not.toContainText('JSON скопирован');
    await page.locator('.cf-build-open').click();
    await page.getByRole('button', { name: 'Скопировать JSON', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'JSON сборки', exact: true })).toBeVisible();
    expect(parseBuildJSON(await field.inputValue()).name).toBe('Для друга');
    await page.getByRole('button', { name: 'Вернуться', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Импорт JSON ↑', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'JSON для копирования', exact: true })).toBeHidden();
    await expect(page.locator('[data-paste-json]')).toBeVisible();
  });
}
