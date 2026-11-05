import test from 'node:test';
import assert from 'node:assert/strict';
import { initial } from '../js/config.js';
import { readState, writeState } from '../js/storage.js';

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('черновик не перезаписывает явно сохранённый вариант', () => {
  const storage = memory();
  writeState('saved', initial, storage);
  writeState('draft', { ...initial, frame: 'terracotta' }, storage);
  assert.equal(readState('saved', storage).frame, 'sage');
  assert.equal(readState('draft', storage).frame, 'terracotta');
});

test('повреждённое сохранение и отказ хранилища не ломают сайт', () => {
  const corrupt = { getItem: () => '{invalid' };
  const denied = { getItem() { throw new Error('Отказ'); }, setItem() { throw new Error('Отказ'); } };
  assert.equal(readState('draft', corrupt), null);
  assert.equal(readState('draft', denied), null);
  assert.equal(writeState('draft', initial, denied), false);
});
