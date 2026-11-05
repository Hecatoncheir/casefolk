import { test, expect } from '@playwright/test';
import { initial } from '../../js/config.js';
import { buildShareURL } from '../../js/share-links.js';

async function mockClipboard(page) {
  await page.addInitScript(() => {
    window.sharedLinks = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.sharedLinks.push(text); },
    } });
  });
}

test('ссылка текущего варианта открывает конструктор в другом браузере и сохраняет правки после перезагрузки', async ({ page, browser }) => {
  await mockClipboard(page);
  await page.goto('./#constructor');
  await page.locator('[data-build-name]').fill('ПК для Алёны 🖥️');
  await page.locator('[data-color-group=frame][data-color=blue]').click();
  await page.locator('[data-size=expanded]').click();
  await page.getByRole('button', { name: 'К комплектующим →', exact: true }).click();
  await page.locator('[data-part=ram]').selectOption('64 ГБ');
  await page.getByRole('button', { name: 'Поделиться ссылкой', exact: true }).click();
  await expect(page.locator('[data-editor-copy-status]')).toContainText('Ссылка скопирована');
  const link = await page.evaluate(() => window.sharedLinks[0]);
  const context = await browser.newContext();
  try {
    const recipient = await context.newPage();
    await recipient.goto(link);
    await expect(recipient).toHaveURL(/#constructor$/);
    await expect(recipient.locator('[data-build-name]')).toHaveValue('ПК для Алёны 🖥️');
    await expect(recipient.locator('[data-part=ram]')).toHaveValue('64 ГБ');
    await expect(recipient.locator('[data-dimensions]')).toHaveText('433 × 338 × 202 мм');
    await expect(recipient.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
    await expect(recipient.locator('[data-import-status]')).toContainText('Сборка открыта по ссылке');
    expect(await recipient.evaluate(() => localStorage.getItem('casefolk:v1:builds'))).toBeNull();
    await recipient.locator('[data-build-name]').fill('Моя правка');
    await recipient.locator('[data-color-group=frame][data-color=terracotta]').click();
    await recipient.reload();
    await expect(recipient.locator('[data-build-name]')).toHaveValue('Моя правка');
    await expect(recipient.locator('[data-color-name=frame]')).toHaveText('Терракота');
  } finally { await context.close(); }
});

test('у сохранённой сборки своя ссылка, открытие и сохранение не перезаписывают сборки получателя', async ({ page }) => {
  await mockClipboard(page);
  await page.goto('./#constructor');
  await page.locator('[data-build-name]').fill('Собственный ПК');
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  const stored = await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'));
  const incoming = { ...initial, frame: 'blue', parts: { ...initial.parts, ram: '64 ГБ' } };
  const link = buildShareURL(incoming, 'ПК друга', page.url());
  await page.evaluate(hash => { location.hash = hash; }, new URL(link).hash);
  await expect(page.locator('[data-build-name]')).toHaveValue('ПК друга');
  await expect(page.locator('[data-import-status]')).toContainText('Сборка открыта по ссылке');
  expect(await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'))).toBe(stored);
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
  await expect(page.locator('.cf-build-card')).toHaveCount(2);
  for (const [name, frame] of [['Собственный ПК', 'sage'], ['ПК друга', 'blue']]) {
    await page.getByRole('button', { name: `Поделиться ссылкой на сборку «${name}»`, exact: true }).click();
    const shared = await page.evaluate(() => window.sharedLinks.at(-1));
    await page.goto(shared);
    await expect(page.locator('[data-build-name]')).toHaveValue(name);
    await expect(page.locator(`[data-color-group=frame][data-color=${frame}]`)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Мои сборки', exact: false }).click();
    await expect(page.locator('.cf-build-card')).toHaveCount(2);
  }
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/share-links-mobile.png', fullPage: true });
});

test('повреждённая ссылка не заменяет текущий вариант и не меняет сохранённые сборки', async ({ page }) => {
  await page.goto('./#constructor');
  await page.locator('[data-build-name]').fill('Мой вариант');
  await page.locator('[data-color-group=frame][data-color=terracotta]').click();
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  const stored = await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'));
  await page.goto('./#constructor?build=v1.a');
  await expect(page.locator('[data-import-status]')).toContainText('Ссылка повреждена');
  await expect(page.locator('[data-build-name]')).toHaveValue('Мой вариант');
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Терракота');
  expect(await page.evaluate(() => localStorage.getItem('casefolk:v1:builds'))).toBe(stored);
});

test('при запрете копирования ссылка доступна вручную, а JSON остаётся отдельным действием', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    } });
  });
  await page.goto('./#constructor');
  await page.locator('[data-build-name]').fill('Ссылка вручную');
  await page.getByRole('button', { name: 'Поделиться ссылкой', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Ссылка на сборку', exact: true })).toBeVisible();
  const field = page.getByRole('textbox', { name: 'Ссылка для копирования', exact: true });
  const link = await field.inputValue();
  expect(link).toContain('#constructor?build=v1.');
  await expect(field).toBeFocused();
  await page.getByRole('button', { name: 'Выделить ссылку', exact: true }).click();
  expect(await field.evaluate(element => element.selectionEnd - element.selectionStart)).toBe(link.length);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Скопировать JSON', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'JSON сборки', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'JSON для копирования', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(link);
  await expect(page.locator('[data-build-name]')).toHaveValue('Ссылка вручную');
});
