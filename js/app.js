import { availableColors, color, dimensions, escape, initial, maxFans, normalize, requestText, rows, sanitize } from './config.js';
import { scene } from './preview.js';
import { readState, writeState } from './storage.js';
import { motion, reveal } from './motion.js';
import { buildJSON, checkImportSize, cleanName, maxImportBytes, parseBuildJSON } from './build-files.js';
import { readBuilds, readEditor, removeBuild, restoreBuild, saveBuild, writeEditor } from './build-library.js';
import { renderBuildGallery } from './build-gallery.js';
import { buildShareURL, readSharedBuild } from './share-links.js';

const root = document.getElementById('casefolk-preview');
const find = selector => root.querySelector(selector);
const all = selector => [...root.querySelectorAll(selector)];
let state = readState('draft') || structuredClone(initial);
let library = [];
let libraryError = '';
let libraryNotice = '';
let deletedBuild = null;
let editor = readEditor();
let lastFocus = null;
let closingModal = false;
let dialogMode = 'request';
let importRevision = 0;
const routes = {
  '#home': ['home', 'case'],
  '#constructor': ['config', 'case'],
  '#components': ['config', 'parts'],
  '#summary': ['config', 'summary'],
  '#builds': ['builds', 'case'],
};

function setText(selector, text) {
  find(selector).textContent = text;
}

function clearStatus() {
  setText('[data-save-status]', '');
  setText('[data-summary-status]', '');
  setText('[data-import-status]', '');
  setText('[data-editor-copy-status]', '');
}

function persistDraft() {
  writeState('draft', state);
  writeEditor(editor.id, editor.name);
}

function refreshLibrary() {
  try { library = readBuilds(); libraryError = ''; }
  catch (error) { libraryError = error.message; }
}

function renderLibrary() {
  const count = find('.cf-save-chip');
  count.hidden = library.length === 0;
  count.textContent = library.length;
  const editing = library.some(entry => entry.id === editor.id);
  all('[data-action=save]').forEach(button => {
    button.textContent = editing ? 'Сохранить изменения' : button.closest('#cf-stage-case') ? 'Сохранить вариант' : 'Сохранить';
  });
  find('[data-action=save-copy]').hidden = !editing;
  find('[data-build-name]').value = editor.name;
  if (state.page !== 'builds') return;
  setText('[data-builds-status]', libraryError || libraryNotice);
  find('[data-builds-status]').setAttribute('role', libraryError ? 'alert' : 'status');
  find('[data-action=undo-delete]').hidden = !deletedBuild;
  find('[data-builds-empty]').hidden = library.length > 0 || Boolean(libraryError);
  renderBuildGallery(find('[data-builds-grid]'), library);
}

function renderNavigation() {
  all('[data-screen]').forEach(element => { element.hidden = element.dataset.screen !== state.page; });
  all('.cf-nav[data-go]').forEach(element => {
    if (element.dataset.go === state.page) element.setAttribute('aria-current', 'page');
    else element.removeAttribute('aria-current');
  });
  all('[role=tab][data-stage]').forEach(element => {
    const selected = element.dataset.stage === state.stage;
    element.setAttribute('aria-selected', String(selected));
    element.tabIndex = selected ? 0 : -1;
  });
  for (const stage of ['case', 'parts', 'summary']) find(`#cf-stage-${stage}`).hidden = stage !== state.stage;
}

function renderSwatches() {
  const items = availableColors(state.material);
  all('[data-swatches]').forEach(group => {
    const key = group.dataset.swatches;
    if (group.dataset.material !== state.material) {
      group.innerHTML = items.map(item => `<button class="cf-swatch" data-color-group="${key}" data-color="${item.id}" aria-label="${item.name}" title="${item.name}" style="--swatch:${item.hex};--tick:${item.dark ? '#fffdf8' : '#20251e'}"></button>`).join('');
      group.dataset.material = state.material;
    }
    group.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(state[key] === button.dataset.color)));
  });
}

function renderControls() {
  all('[name=cf-material]').forEach(element => { element.checked = element.value === state.material; });
  all('[data-color-name]').forEach(element => { element.textContent = color(state[element.dataset.colorName]).name; });
  all('[data-size]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.size === state.size)));
  all('[data-view]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.view === state.view)));
  all('[data-setting]').forEach(element => { element.value = state[element.dataset.setting]; });
  all('[data-part]').forEach(element => { element.value = state.parts[element.dataset.part]; });
  setText('[data-fan-count]', state.fans);
  find('[data-fan-delta="-1"]').disabled = state.fans === 0;
  find('[data-fan-delta="1"]').disabled = state.fans === maxFans(state);
  setText('[data-dimensions]', dimensions(state));
  setText('[data-material-label]', state.material);
  setText('[data-palette-hint]', state.material === 'PETG-CF'
    ? 'Для демонстрации показаны два оттенка PETG-CF. Реальные цвета зависят от филамента.'
    : 'Цвет на экране приблизительный; оттенок зависит от выбранного филамента.');
  renderSwatches();
}

function renderHelper() {
  const hints = {
    case: state.panelType === 'clear'
      ? 'Прозрачная панель покажет начинку. Для такой компоновки нужно проверить приток воздуха.'
      : 'Цвет рамы и панелей можно сочетать по-разному. Выбранные оттенки сразу видны на корпусе.',
    parts: 'Можно собрать всё с нуля или использовать ваши детали. Размеры и совместимость требуют отдельной проверки.',
    summary: 'Характер уже есть! Это эскиз конфигурации — точные модели, совместимость и стоимость ещё предстоит определить.',
  };
  setText('[data-helper]', hints[state.stage]);
  const portraits = find('.cf-helper-portraits');
  const previous = portraits.dataset.stage;
  all('[data-mascot-stage]').forEach(image => { image.hidden = image.dataset.mascotStage !== state.stage; });
  portraits.dataset.stage = state.stage;
  if (previous && previous !== state.stage) reveal(find(`[data-mascot-stage="${state.stage}"]`), 220, 3);
}

function render() {
  renderNavigation();
  renderControls();
  renderHelper();
  find('[data-summary]').innerHTML = rows(state).map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');
  scene(find('[data-scene=config]'), state, 'config');
  renderLibrary();
}

function navigate(page, stage = state.stage, updateHistory = true) {
  const previousPage = state.page;
  const previousStage = state.stage;
  state.page = page;
  state.stage = stage;
  if (page === 'builds') refreshLibrary();
  clearStatus();
  render();
  persistDraft();
  if (updateHistory) {
    const entry = Object.entries(routes).find(([, value]) => value[0] === page && (page !== 'config' || value[1] === stage));
    if (entry && location.hash !== entry[0]) history.pushState(null, '', entry[0]);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (previousPage !== page) reveal(find(`[data-screen="${page}"]`), 320);
  else if (previousStage !== stage) reveal(find(`#cf-stage-${stage}`), 240);
}

function applyRoute() {
  if (openSharedBuild()) return;
  const target = routes[location.hash.split('?')[0]];
  if (target && (state.page !== target[0] || state.stage !== target[1])) navigate(target[0], target[1], false);
}

function openSharedBuild() {
  let message;
  let failed = false;
  try {
    const shared = readSharedBuild(location.hash);
    if (!shared) return false;
    state = shared.config;
    editor = { id: null, name: shared.name };
    message = 'Сборка открыта по ссылке. Сохраните вариант, чтобы добавить его в «Мои сборки».';
  } catch (error) {
    message = error.message;
    failed = true;
  }
  navigate('config', 'case', false);
  history.replaceState(null, '', '#constructor');
  setText('[data-import-status]', message);
  find('[data-import-status]').setAttribute('role', failed ? 'alert' : 'status');
  return true;
}

function updateConfig(mutate) {
  mutate();
  normalize(state);
  clearStatus();
  render();
  persistDraft();
}

function setModalOpen(open) {
  find('[data-modal]').hidden = !open;
  all('header, main, footer, .cf-prototype-note').forEach(element => { element.inert = open; });
  document.body.style.overflow = open ? 'hidden' : '';
}

function openDialog(mode, title, description) {
  dialogMode = mode;
  lastFocus = document.activeElement;
  find('[data-request-panel]').hidden = mode !== 'request';
  find('[data-json-import-panel]').hidden = mode !== 'import';
  find('[data-json-copy-panel]').hidden = mode !== 'copy';
  setText('#cf-modal-title', title);
  setText('[data-modal-description]', description);
  setModalOpen(true);
  motion(find('[data-modal]'), [{ opacity: 0 }, { opacity: 1 }], 180);
  reveal(find('.cf-modal'), 240, 8);
}

function openRequest() {
  find('[data-request]').value = requestText(state);
  openDialog('request', 'Ваш вариант сборки', 'Это демонстрация состава. Заявка никуда не отправляется; текст и JSON можно сохранить себе.');
  find('[data-action=close]').focus();
}

function resetClipboardRead() {
  importRevision += 1;
  find('[data-action=clipboard-read]').disabled = false;
  return importRevision;
}

function openImport() {
  resetClipboardRead();
  find('[data-paste-json]').value = '';
  setText('[data-paste-error]', '');
  openDialog('import', 'Импорт сборки', 'Выберите JSON-файл или вставьте JSON из буфера обмена. Текущий вариант заменится только после успешной проверки.');
  find('[data-paste-json]').focus();
}

async function closeRequest() {
  if (closingModal || find('[data-modal]').hidden) return;
  closingModal = true;
  resetClipboardRead();
  await motion(find('[data-modal]'), [{ opacity: 1 }, { opacity: 0 }], 140);
  setModalOpen(false);
  if (dialogMode === 'import') find('[data-paste-json]').value = '';
  if (dialogMode === 'copy') find('[data-copy-json]').value = '';
  closingModal = false;
  lastFocus?.focus();
}

function saveVariant(copy = false) {
  let message;
  try {
    const name = copy && editor.name ? `${editor.name} — копия` : editor.name;
    const build = saveBuild(state, { id: copy ? null : editor.id, name });
    editor = { id: build.id, name: build.name };
    persistDraft();
    refreshLibrary();
    render();
    message = `Сборка «${build.name}» сохранена на этом устройстве в «Моих сборках».`;
  } catch (error) { message = error.message; }
  setText('[data-save-status]', message);
  setText('[data-summary-status]', message);
}

function newBuild() {
  state = structuredClone(initial);
  editor = { id: null, name: '' };
  navigate('config', 'case');
}

function openBuild(id) {
  refreshLibrary();
  const build = library.find(entry => entry.id === id);
  if (!build) return;
  state = sanitize(build.config);
  editor = { id: build.id, name: build.name };
  navigate('config', 'case');
}

function deleteBuild(id) {
  try {
    deletedBuild = removeBuild(id);
    libraryNotice = deletedBuild ? `Сборка «${deletedBuild.name}» удалена.` : '';
    refreshLibrary();
  } catch (error) { libraryError = error.message; }
  render();
}

function undoDelete() {
  if (!deletedBuild) return;
  try {
    restoreBuild(deletedBuild);
    deletedBuild = null;
    libraryNotice = 'Сборка восстановлена.';
    refreshLibrary();
  } catch (error) { libraryError = error.message; }
  render();
}

async function applyImport(imported, fallbackName = '') {
  await closeRequest();
  state = imported.config;
  editor = { id: null, name: imported.name || fallbackName };
  navigate('config', 'case');
  setText('[data-import-status]', 'JSON импортирован. Сохраните вариант, чтобы добавить его в «Мои сборки».');
  find('[data-import-status]').setAttribute('role', 'status');
}

function showImportError(error) {
  if (dialogMode === 'import' && !find('[data-modal]').hidden) {
    setText('[data-paste-error]', error.message);
    return;
  }
  if (state.page !== 'config') navigate('config', 'case');
  setText('[data-import-status]', error.message);
  find('[data-import-status]').setAttribute('role', 'alert');
}

async function importBuild(file) {
  if (!file || closingModal) return;
  const revision = resetClipboardRead();
  try {
    if (file.size > maxImportBytes) throw new Error('Файл слишком большой. Выберите JSON одной сборки размером до 256 КБ.');
    const text = await file.text();
    if (revision !== importRevision) return;
    await applyImport(parseBuildJSON(text), cleanName(file.name.replace(/\.json$/i, '')));
  } catch (error) { showImportError(error); }
}

async function importPastedJSON() {
  if (closingModal) return;
  resetClipboardRead();
  try {
    const text = find('[data-paste-json]').value;
    if (!text.trim()) throw new Error('Вставьте JSON сборки в поле или выберите файл.');
    await applyImport(parseBuildJSON(text));
  } catch (error) { showImportError(error); }
}

async function clipboardText() {
  try {
    if (!navigator.clipboard?.readText) throw new Error();
    return await navigator.clipboard.readText();
  } catch { throw new Error('Не удалось прочитать буфер. Вставьте JSON в поле обычной командой вставки.'); }
}

async function pasteClipboard() {
  const revision = resetClipboardRead();
  const button = find('[data-action=clipboard-read]');
  button.disabled = true;
  find('[data-paste-json]').focus();
  setText('[data-paste-error]', '');
  try {
    const text = await clipboardText();
    if (revision !== importRevision) return;
    checkImportSize(text);
    if (!text.trim()) throw new Error('Буфер обмена пуст. Скопируйте JSON или вставьте текст вручную.');
    find('[data-paste-json]').value = text;
    find('[data-paste-json]').focus();
  } catch (error) {
    if (revision === importRevision) showImportError(error);
  } finally {
    if (revision === importRevision) button.disabled = false;
  }
}

function downloadVariant(config = state, name = editor.name) {
  const file = new Blob([buildJSON(config, name)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'casefolk-build.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function selectCopyText() {
  const field = find('[data-copy-json]');
  field.focus();
  field.select();
}

const copyMessages = {
  json: {
    pending: 'Копируем JSON…',
    success: 'JSON скопирован. Можно отправить его получателю для импорта.',
    fallback: 'Автоматическое копирование недоступно. JSON можно скопировать вручную.',
    title: 'JSON сборки',
    description: 'Браузер не разрешил автоматическое копирование. Скопируйте выделенный JSON обычной командой копирования и отправьте его получателю.',
    label: 'JSON для копирования',
    select: 'Выделить JSON',
  },
  link: {
    pending: 'Копируем ссылку…',
    success: 'Ссылка скопирована. По ней сразу откроется эта сборка в конструкторе.',
    fallback: 'Автоматическое копирование недоступно. Ссылку можно скопировать вручную.',
    title: 'Ссылка на сборку',
    description: 'Скопируйте выделенную ссылку и отправьте её получателю. По ней откроется конструктор с названием и параметрами этой сборки.',
    label: 'Ссылка для копирования',
    select: 'Выделить ссылку',
  },
};

function openCopyFallback(text, messages) {
  find('[data-copy-json]').value = text;
  find('[data-copy-json]').setAttribute('aria-label', messages.label);
  setText('[data-action=select-copy]', messages.select);
  openDialog('copy', messages.title, messages.description);
  selectCopyText();
}

async function copyText(text, type, button, status) {
  if (button.getAttribute('aria-busy') === 'true') return;
  const messages = copyMessages[type];
  button.setAttribute('aria-busy', 'true');
  status.textContent = messages.pending;
  try {
    if (!navigator.clipboard?.writeText) throw new Error();
    await navigator.clipboard.writeText(text);
    status.textContent = messages.success;
  } catch {
    status.textContent = messages.fallback;
    if (button.getClientRects().length > 0) openCopyFallback(text, messages);
  } finally {
    button.removeAttribute('aria-busy');
  }
}

function copyVariant(config, name, button, status) {
  return copyText(buildJSON(config, name), 'json', button, status);
}

function shareVariant(config, name, button, status) {
  try { return copyText(buildShareURL(config, name, location.href), 'link', button, status); }
  catch (error) { status.textContent = error.message; }
}

const actions = {
  computer: () => navigate('config', 'parts'),
  save: () => saveVariant(),
  'save-copy': () => saveVariant(true),
  'new-build': newBuild,
  'open-build': data => openBuild(data.id),
  'delete-build': data => deleteBuild(data.id),
  'undo-delete': undoDelete,
  'download-build': data => {
    const build = library.find(entry => entry.id === data.id);
    if (build) downloadVariant(build.config, build.name);
  },
  copy: (_, button) => copyVariant(state, editor.name, button, find('[data-editor-copy-status]')),
  'copy-build': (data, button) => {
    const build = library.find(entry => entry.id === data.id);
    if (build) return copyVariant(build.config, build.name, button, button.closest('.cf-build-card').querySelector('[data-copy-status]'));
  },
  share: (_, button) => shareVariant(state, editor.name, button, find('[data-editor-copy-status]')),
  'share-build': (data, button) => {
    const build = library.find(entry => entry.id === data.id);
    if (build) return shareVariant(build.config, build.name, button, button.closest('.cf-build-card').querySelector('[data-copy-status]'));
  },
  'select-copy': selectCopyText,
  import: openImport,
  'import-file': () => find('[data-import-file]').click(),
  'clipboard-read': pasteClipboard,
  'paste-import': importPastedJSON,
  discuss: openRequest,
  close: closeRequest,
  download: () => downloadVariant(),
  'select-request': () => { const field = find('[data-request]'); field.focus(); field.select(); },
};

const mutations = {
  color: data => { state[data.colorGroup] = data.color; },
  size: data => { state.size = data.size; },
  view: data => { state.view = data.view; },
  fanDelta: data => { state.fans += Number(data.fanDelta); },
};

root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !root.contains(button)) return;
  const data = button.dataset;
  if (data.go) return navigate(data.go);
  if (data.stage) return navigate('config', data.stage);
  const key = Object.keys(mutations).find(name => name in data);
  if (key) return updateConfig(() => mutations[key](data));
  actions[data.action]?.(data, button);
});

root.addEventListener('change', event => {
  const element = event.target;
  if (element.matches('[data-import-file]')) {
    importBuild(element.files[0]);
    element.value = '';
    return;
  }
  if (element.name === 'cf-material') return updateConfig(() => { state.material = element.value; });
  if (element.dataset.setting) return updateConfig(() => { state[element.dataset.setting] = element.value; });
  if (element.dataset.part) updateConfig(() => { state.parts[element.dataset.part] = element.value; });
});

find('[data-build-name]').addEventListener('input', event => {
  editor.name = event.target.value;
  writeEditor(editor.id, editor.name);
});

find('[data-paste-json]').addEventListener('input', () => {
  resetClipboardRead();
  setText('[data-paste-error]', '');
});

window.addEventListener('storage', event => {
  if (event.key !== 'casefolk:v1:builds' && event.key !== null) return;
  refreshLibrary();
  renderLibrary();
});

function handleModalKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeRequest();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = all('[data-modal] button, [data-modal] textarea').filter(element => !element.disabled && element.getClientRects().length > 0);
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

root.addEventListener('keydown', event => {
  if (!find('[data-modal]').hidden) return handleModalKey(event);
  const tab = event.target.closest('[role=tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = all('[role=tab]');
  const offset = event.key === 'ArrowLeft' ? -1 : 1;
  let index = (tabs.indexOf(tab) + offset + tabs.length) % tabs.length;
  if (event.key === 'Home') index = 0;
  if (event.key === 'End') index = tabs.length - 1;
  navigate('config', tabs[index].dataset.stage);
  tabs[index].focus();
});

find('[data-modal]').addEventListener('click', event => {
  if (event.target === find('[data-modal]')) closeRequest();
});

window.addEventListener('popstate', applyRoute);
window.addEventListener('hashchange', applyRoute);
scene(find('[data-scene=hero]'), { ...initial, fans: 3 }, 'hero');
refreshLibrary();
if (!openSharedBuild()) {
  const route = routes[location.hash.split('?')[0]];
  if (route) [state.page, state.stage] = route;
  render();
  reveal(find({ home: '.cf-hero', config: '.cf-config-head', builds: '.cf-builds-head' }[state.page]), 400);
}
