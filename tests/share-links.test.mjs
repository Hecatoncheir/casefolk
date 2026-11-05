import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, sanitize } from '../js/config.js';
import { buildShareURL, readSharedBuild } from '../js/share-links.js';

const base = 'https://example.com/casefolk/?utm_source=test#builds';
const token = value => `#constructor?build=v1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`;

test('ссылка восстанавливает название с кириллицей и все параметры на вложенном пути', () => {
  const config = { ...structuredClone(initial), material: 'PETG-CF', frame: 'graphite', panel: 'sage', size: 'expanded', panelType: 'clear', fanSize: '140', fans: 6, view: 'inside', parts: { ...initial.parts, ram: '64 ГБ', motherboard: 'Mini-ITX' } };
  const url = new URL(buildShareURL(config, 'ПК для Алёны 🖥️ & друзей / #1', base));
  assert.equal(url.origin, 'https://example.com');
  assert.equal(url.pathname, '/casefolk/');
  assert.equal(url.search, '');
  assert.match(url.hash, /^#constructor\?build=v1\.[A-Za-z0-9_-]+$/);
  assert.ok(url.href.length < 3000);
  const shared = readSharedBuild(url.hash);
  assert.equal(shared.name, 'ПК для Алёны 🖥️ & друзей / #1');
  assert.deepEqual(shared.config, { ...sanitize(config), page: 'config', stage: 'case' });
});

test('ссылка содержит независимый снимок без идентификатора сохранения и не меняет источник', () => {
  const config = structuredClone(initial);
  const before = structuredClone(config);
  const url = buildShareURL(config, '', base);
  assert.deepEqual(config, before);
  config.frame = 'blue';
  const shared = readSharedBuild(new URL(url).hash);
  assert.equal(shared.config.frame, 'sage');
  assert.equal(shared.name, '');
  assert.equal(shared.id, undefined);
});

test('обычные маршруты не считаются ссылками на сборку', () => {
  for (const hash of ['', '#home', '#constructor', '#constructor?utm=test', '#builds?build=test']) assert.equal(readSharedBuild(hash), null);
});

test('повреждённые, слишком длинные и неподдерживаемые ссылки отклоняются', () => {
  const invalid = ['v2.abc', '', 'v1.@@@', 'v1.a', 'v1._w', 'v1.e30', 'v1.' + 'A'.repeat(9000)];
  for (const value of invalid) assert.throws(() => readSharedBuild(`#constructor?build=${value}`), /Не удалось открыть сборку/);
  assert.throws(() => readSharedBuild(token({ ...initial, frame: 'unknown' })), /Не удалось открыть сборку/);
  assert.throws(() => readSharedBuild(token({ ...initial, version: 2 })), /Не удалось открыть сборку/);
  assert.throws(() => readSharedBuild(token(initial) + '&build=v1.abc'), /Не удалось открыть сборку/);
});
