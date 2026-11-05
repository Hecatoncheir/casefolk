import test from 'node:test';
import assert from 'node:assert/strict';
import { initial } from '../js/config.js';
import { readBuilds, removeBuild, restoreBuild, saveBuild } from '../js/build-library.js';

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('несколько сборок независимы, а сохранение открытой обновляет только её', () => {
  const storage = memory();
  const first = saveBuild(initial, { name: 'Первая' }, storage);
  const second = saveBuild({ ...initial, frame: 'blue' }, { name: 'Вторая' }, storage);
  const changed = saveBuild({ ...initial, frame: 'terracotta' }, { id: first.id, name: 'Первая изменённая' }, storage);
  const entries = readBuilds(storage);
  assert.equal(entries.length, 2);
  assert.equal(changed.id, first.id);
  assert.equal(changed.createdAt, first.createdAt);
  assert.equal(entries.find(entry => entry.id === second.id).config.frame, 'blue');
  assert.equal(entries.find(entry => entry.id === first.id).config.frame, 'terracotta');
});

test('старое единственное сохранение переносится один раз и остаётся в исходном ключе', () => {
  const storage = memory();
  storage.setItem('casefolk:v1:saved', JSON.stringify({ ...initial, frame: 'blue' }));
  const firstRead = readBuilds(storage);
  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].config.frame, 'blue');
  assert.deepEqual(readBuilds(storage), firstRead);
  assert.ok(storage.getItem('casefolk:v1:saved'));
  removeBuild(firstRead[0].id, storage);
  assert.deepEqual(readBuilds(storage), []);
});

test('удаление и отмена не затрагивают соседние сборки', () => {
  const storage = memory();
  const first = saveBuild(initial, { name: 'Первая' }, storage);
  saveBuild(initial, { name: 'Вторая' }, storage);
  const removed = removeBuild(first.id, storage);
  assert.equal(readBuilds(storage).length, 1);
  restoreBuild(removed, storage);
  assert.equal(readBuilds(storage).length, 2);
  restoreBuild(removed, storage);
  assert.equal(readBuilds(storage).length, 2);
});

test('повреждённый список не перезаписывается при попытке сохранить', () => {
  const storage = memory();
  storage.setItem('casefolk:v1:builds', '{broken');
  assert.throws(() => saveBuild(initial, {}, storage), /не изменены/);
  assert.equal(storage.getItem('casefolk:v1:builds'), '{broken');
});

test('отказ записи не выдаётся за успешное сохранение', () => {
  const denied = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } };
  assert.throws(() => saveBuild(initial, {}, denied), /Не удалось сохранить/);
});
