import { test, expect } from '@playwright/test';

test('главная и конструктор работают по пути GitHub Pages без ошибок ресурсов', async ({ page }) => {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  const appearance = await page.locator('#casefolk-preview').evaluate(element => ({
    font: getComputedStyle(element).fontFamily,
    color: getComputedStyle(element).color,
    button: getComputedStyle(element.querySelector('.cf-button:not(.cf-light)')).backgroundColor,
  }));
  expect(appearance.font).toContain('Manrope');
  expect(appearance.color).toBe('rgb(32, 37, 30)');
  expect(appearance.button).toBe('rgb(32, 37, 30)');
  await expect(page.getByRole('heading', { name: 'Ваш характер. Наша сборка.' })).toBeVisible();
  await page.getByRole('button', { name: 'Собрать свой корпус', exact: false }).click();
  await expect(page.locator('[data-screen=config]')).toBeVisible();
  await expect(page).toHaveURL(/#constructor$/);
  await expect.poll(() => page.locator('.cf-wordmark').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: '.artifacts/constructor-desktop.png', fullPage: true });
  expect(failures).toEqual([]);
});

test('материал, цвет и габариты отражаются в итоговом составе', async ({ page }) => {
  await page.goto('./#constructor');
  await page.locator('[data-color-group=frame][data-color=terracotta]').click();
  await page.locator('[name=cf-material][value=PETG-CF]').check();
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Графит');
  await expect(page.locator('[data-swatches=frame] button')).toHaveCount(2);
  await page.locator('[data-size=expanded]').click();
  await expect(page.locator('[data-dimensions]')).toHaveText('433 × 338 × 202 мм');
  await page.getByRole('button', { name: 'К комплектующим →' }).click();
  await page.locator('[data-part=ram]').selectOption('64 ГБ');
  await page.getByRole('button', { name: 'Посмотреть состав →' }).click();
  await expect(page.locator('[data-summary]')).toContainText('64 ГБ');
  await expect(page.locator('[data-summary]')).toContainText('PETG-CF');
});

test('сохранённый вариант переживает перезагрузку и последующее редактирование черновика', async ({ page }) => {
  await page.goto('./#constructor');
  await page.locator('[data-color-group=frame][data-color=terracotta]').click();
  await page.getByRole('button', { name: 'Сохранить вариант', exact: true }).click();
  await page.locator('[data-color-group=frame][data-color=blue]').click();
  await page.reload();
  await expect(page.locator('[data-color-name=frame]')).toHaveText('Серо-голубой');
  await page.getByRole('button', { name: 'Моя сборка', exact: false }).click();
  await expect(page.locator('[data-summary]')).toContainText('Терракота / Сливочный');
  await expect(page.locator('[data-summary]')).not.toContainText('Серо-голубой');
});

test('состав можно скачать в JSON, окно закрывается клавишей Escape', async ({ page }) => {
  await page.goto('./#summary');
  await page.getByRole('button', { name: 'Посмотреть состав ↗', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-request]')).toHaveValue(/MODCASE HYPER/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('casefolk-build.json');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Посмотреть состав ↗', exact: true })).toBeFocused();
});

test('страницы помещаются на мобильном экране, при увеличении и без горизонтальной прокрутки', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ['./', './#constructor', './brand.html']) {
      await page.goto(route);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('./#constructor');
  await page.screenshot({ path: '.artifacts/constructor-mobile.png', fullPage: true });
});

test('на странице айдентики загружаются SVG и доступен архив', async ({ page, request }) => {
  await page.goto('./brand.html');
  const images = page.locator('.brand-art img');
  expect(await images.count()).toBeGreaterThanOrEqual(11);
  for (const image of await images.all()) {
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const link = page.getByRole('link', { name: 'Скачать все SVG' });
  const response = await request.get(await link.getAttribute('href'));
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/zip');
});
