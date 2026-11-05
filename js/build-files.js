import { isConfiguration, sanitize } from './config.js';

export const maxImportBytes = 256 * 1024;

export function checkImportSize(text) {
  if (new TextEncoder().encode(text).byteLength > maxImportBytes) throw new Error('JSON слишком большой. Максимальный размер — 256 КБ.');
}

export function cleanName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) : '';
}

export function parseBuildJSON(text) {
  checkImportSize(text);
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('Не удалось прочитать JSON. Проверьте содержимое файла.'); }
  const config = value?.config ?? value;
  if (!isConfiguration(config)) throw new Error('Это не поддерживаемая сборка Casefolk. Выберите JSON, скачанный из конструктора.');
  return { config: sanitize(config), name: cleanName(value.name) };
}

export function buildJSON(config, name = '') {
  const value = sanitize(config);
  if (cleanName(name)) value.name = cleanName(name);
  return JSON.stringify(value, null, 2);
}
