import { sanitize } from './config.js';
import { cleanName, parseBuildJSON } from './build-files.js';

const route = '#constructor?';
const maxTokenLength = 8192;
const invalidLink = 'Не удалось открыть сборку по ссылке. Ссылка повреждена или имеет неподдерживаемый формат.';

export function buildShareURL(config, name, baseURL) {
  const value = { ...sanitize(config), page: 'config', stage: 'case', name: cleanName(name) };
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const token = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (token.length > maxTokenLength) throw new Error('Не удалось создать ссылку: сборка слишком большая.');
  const url = new URL(baseURL);
  url.search = '';
  url.hash = `${route}build=v1.${token}`;
  return url.href;
}

export function readSharedBuild(hash) {
  if (!hash.startsWith(route)) return null;
  if (hash.length > maxTokenLength + 64) throw new Error(invalidLink);
  const params = new URLSearchParams(hash.slice(route.length));
  if (!params.has('build')) return null;
  try {
    const token = params.get('build');
    if (params.getAll('build').length !== 1 || !/^v1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const binary = atob(token.slice(3).replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return parseBuildJSON(text);
  } catch { throw new Error(invalidLink); }
}
