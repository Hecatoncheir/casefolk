import { isConfiguration, sanitize } from './config.js';
import { cleanName } from './build-files.js';

const key = 'casefolk:v1:builds';
const editorKey = 'casefolk:v1:editor';
const legacyKey = 'casefolk:v1:saved';
const target = storage => storage ?? globalThis.localStorage;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function validEntry(entry) {
  return entry && typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length <= 120
    && typeof entry.name === 'string' && entry.name === cleanName(entry.name) && entry.name.length > 0
    && validDate(entry.createdAt) && validDate(entry.updatedAt) && isConfiguration(entry.config);
}

function store(entries, storage) {
  try { target(storage).setItem(key, JSON.stringify(entries)); }
  catch { throw new Error('Не удалось сохранить сборки в браузере. Скачайте JSON, чтобы не потерять вариант.'); }
  return entries;
}

function migrate(storage) {
  const raw = target(storage).getItem(legacyKey);
  if (raw === null) return [];
  const config = JSON.parse(raw);
  if (!isConfiguration(config)) throw new Error('Неверный формат старой сборки');
  const now = new Date().toISOString();
  return store([{ id: 'legacy-saved', name: 'Сохранённая сборка', createdAt: now, updatedAt: now, config: sanitize(config) }], storage);
}

export function readBuilds(storage) {
  try {
    const raw = target(storage).getItem(key);
    if (raw === null) return migrate(storage);
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || !entries.every(validEntry)) throw new Error('Неверный формат списка');
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Повторяющиеся идентификаторы');
    return entries;
  } catch {
    throw new Error('Не удалось прочитать сохранённые сборки. Данные в браузере не изменены.');
  }
}

export function saveBuild(config, { id = null, name = '' } = {}, storage) {
  if (!isConfiguration(config)) throw new Error('Не удалось сохранить конфигурацию. Проверьте её параметры.');
  const entries = readBuilds(storage);
  const existing = entries.find(entry => entry.id === id);
  const now = new Date().toISOString();
  const build = {
    id: existing?.id ?? crypto.randomUUID(),
    name: cleanName(name) || existing?.name || `Сборка ${entries.length + 1}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    config: sanitize(config),
  };
  store([build, ...entries.filter(entry => entry.id !== build.id)], storage);
  return build;
}

export function removeBuild(id, storage) {
  const entries = readBuilds(storage);
  const removed = entries.find(entry => entry.id === id) ?? null;
  store(entries.filter(entry => entry.id !== id), storage);
  return removed;
}

export function restoreBuild(build, storage) {
  if (!validEntry(build)) throw new Error('Не удалось восстановить сборку');
  const entries = readBuilds(storage);
  if (entries.some(entry => entry.id === build.id)) return entries;
  return store([build, ...entries], storage);
}

export function readEditor(storage) {
  try {
    const value = JSON.parse(target(storage).getItem(editorKey));
    return { id: typeof value?.id === 'string' ? value.id : null, name: cleanName(value?.name) };
  } catch { return { id: null, name: '' }; }
}

export function writeEditor(id, name, storage) {
  try { target(storage).setItem(editorKey, JSON.stringify({ id, name: cleanName(name) })); }
  catch { /* Сохранение сборки и скачивание JSON остаются доступны отдельно. */ }
}
