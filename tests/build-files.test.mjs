import test from 'node:test';
import assert from 'node:assert/strict';
import { initial } from '../js/config.js';
import { buildJSON, parseBuildJSON } from '../js/build-files.js';

test('JSON новой сборки сохраняет имя и все параметры при импорте', () => {
  const config = { ...structuredClone(initial), frame: 'terracotta', size: 'expanded', fans: 6 };
  config.parts.ram = '64 ГБ';
  const restored = parseBuildJSON(buildJSON(config, 'Рабочий ПК'));
  assert.equal(restored.name, 'Рабочий ПК');
  assert.deepEqual(restored.config, config);
});

test('принимаются прежний JSON без имени и запись из списка сохранений', () => {
  assert.deepEqual(parseBuildJSON(JSON.stringify(initial)).config, initial);
  assert.equal(parseBuildJSON(JSON.stringify({ name: 'Мой ПК', config: initial })).name, 'Мой ПК');
});

test('некорректный файл не превращается в конфигурацию по умолчанию', () => {
  for (const value of [null, [], {}, { version: 2 }, { ...initial, frame: '<script>' }, { ...initial, fans: 900 }]) {
    assert.throws(() => parseBuildJSON(JSON.stringify(value)), /не поддерживаемая/);
  }
  assert.throws(() => parseBuildJSON('{invalid'), /прочитать JSON/);
});

test('ограничение размера JSON учитывает байты кириллицы, включая вставленный текст', () => {
  const text = JSON.stringify({ ...initial, name: 'Я'.repeat(140000) });
  assert.throws(() => parseBuildJSON(text), /слишком большой/);
});
