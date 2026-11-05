import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, normalize, sanitize, requestText } from '../js/config.js';

test('неизвестные значения из сохранения не попадают в интерфейс', () => {
  const result = sanitize({ version: 1, frame: '<script>', page: 'unknown', fans: '100', parts: { cpu: '<img src=x>' } });
  assert.deepEqual(result, initial);
});

test('при смене PETG на PETG-CF недоступные цвета заменяются допустимыми', () => {
  const state = { ...structuredClone(initial), material: 'PETG-CF', frame: 'terracotta', panel: 'cream' };
  normalize(state);
  assert.equal(state.frame, 'graphite');
  assert.equal(state.panel, 'graphite');
});

test('уменьшение корпуса и увеличение вентиляторов ограничивает количество', () => {
  const result = sanitize({ ...initial, size: 'standard', fanSize: '140', fans: 6 });
  assert.equal(result.fans, 4);
  assert.equal(sanitize({ ...initial, fans: -2 }).fans, 0);
});

test('состав заявки содержит выбранные параметры и объём памяти', () => {
  const state = sanitize({ ...initial, size: 'expanded', parts: { ...initial.parts, ram: '64 ГБ' } });
  const result = requestText(state);
  assert.match(result, /433 × 338 × 202 мм/);
  assert.match(result, /Память: 64 ГБ/);
  assert.match(result, /MODCASE HYPER/);
});
