import { sanitize } from './config.js';

const prefix = 'casefolk:v1:';

export function readState(key, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const value = JSON.parse(target.getItem(prefix + key));
    return value?.version === 1 ? sanitize(value) : null;
  } catch {
    return null;
  }
}

export function writeState(key, state, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(prefix + key, JSON.stringify(sanitize(state)));
    return true;
  } catch {
    return false;
  }
}
