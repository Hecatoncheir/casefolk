import { availableColors, color, dimensions, escape, initial, maxFans, normalize, requestText, rows, sanitize } from './config.js';
import { scene } from './preview.js';
import { readState, writeState } from './storage.js';
import { motion, reveal } from './motion.js';
import { buildJSON, cleanName, maxImportBytes, parseBuildJSON } from './build-files.js';
import { readBuilds, readEditor, removeBuild, restoreBuild, saveBuild, writeEditor } from './build-library.js';
import { renderBuildGallery } from './build-gallery.js';

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
  const target = routes[location.hash];
  if (target) navigate(target[0], target[1], false);
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

function openRequest() {
  lastFocus = document.activeElement;
  setText('#cf-modal-title', 'Ваш вариант сборки');
  setText('.cf-modal p', 'Это демонстрация состава. Заявка никуда не отправляется; текст и JSON можно сохранить себе.');
  find('[data-request]').value = requestText(state);
  setModalOpen(true);
  motion(find('[data-modal]'), [{ opacity: 0 }, { opacity: 1 }], 180);
  reveal(find('.cf-modal'), 240, 8);
  find('[data-action=close]').focus();
}

async function closeRequest() {
  if (closingModal || find('[data-modal]').hidden) return;
  closingModal = true;
  await motion(find('[data-modal]'), [{ opacity: 1 }, { opacity: 0 }], 140);
  setModalOpen(false);
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

async function importBuild(file) {
  if (!file) return;
  try {
    if (file.size > maxImportBytes) throw new Error('Файл слишком большой. Выберите JSON одной сборки размером до 256 КБ.');
    const imported = parseBuildJSON(await file.text());
    state = imported.config;
    editor = { id: null, name: imported.name || cleanName(file.name.replace(/\.json$/i, '')) };
    navigate('config', 'case');
    setText('[data-import-status]', 'JSON импортирован. Сохраните вариант, чтобы добавить его в «Мои сборки».');
    find('[data-import-status]').setAttribute('role', 'status');
  } catch (error) {
    if (state.page !== 'config') navigate('config', 'case');
    setText('[data-import-status]', error.message);
    find('[data-import-status]').setAttribute('role', 'alert');
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
  import: () => find('[data-import-file]').click(),
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
  actions[data.action]?.(data);
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
  const items = all('[data-modal] button, [data-modal] textarea');
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
const route = routes[location.hash];
if (route) [state.page, state.stage] = route;
render();
reveal(find({ home: '.cf-hero', config: '.cf-config-head', builds: '.cf-builds-head' }[state.page]), 400);
