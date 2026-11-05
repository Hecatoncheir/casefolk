import { availableColors, color, dimensions, escape, initial, maxFans, normalize, requestText, rows, sanitize } from './config.js';
import { scene } from './preview.js';
import { readState, writeState } from './storage.js';
import { motion, reveal } from './motion.js';

const root = document.getElementById('casefolk-preview');
const find = selector => root.querySelector(selector);
const all = selector => [...root.querySelectorAll(selector)];
let state = readState('draft') || structuredClone(initial);
let saved = readState('saved');
let lastFocus = null;
let closingModal = false;
const routes = {
  '#home': ['home', 'case'],
  '#constructor': ['config', 'case'],
  '#components': ['config', 'parts'],
  '#summary': ['config', 'summary'],
};

function setText(selector, text) {
  find(selector).textContent = text;
}

function clearStatus() {
  setText('[data-save-status]', '');
  setText('[data-summary-status]', '');
}

function persistDraft() {
  writeState('draft', state);
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
  find('.cf-save-chip').hidden = !saved;
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
}

function render() {
  renderNavigation();
  renderControls();
  renderHelper();
  find('[data-summary]').innerHTML = rows(state).map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');
  scene(find('[data-scene=config]'), state, 'config');
}

function navigate(page, stage = state.stage, updateHistory = true) {
  const previousPage = state.page;
  const previousStage = state.stage;
  state.page = page;
  state.stage = stage;
  clearStatus();
  render();
  persistDraft();
  if (updateHistory) {
    const entry = Object.entries(routes).find(([, value]) => value[0] === page && (page === 'home' || value[1] === stage));
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

function saveVariant() {
  const success = writeState('saved', state);
  if (success) saved = structuredClone(state);
  render();
  const message = success
    ? 'Вариант сохранён на этом устройстве. Открыть его можно через «Моя сборка».'
    : 'Браузер не разрешил сохранение. Можно скачать состав в JSON на последнем шаге.';
  setText('[data-save-status]', message);
  setText('[data-summary-status]', message);
}

function showSaved() {
  if (saved) state = sanitize(saved);
  navigate('config', 'summary');
  if (!saved) setText('[data-summary-status]', 'Сохранённых вариантов пока нет. Настройте корпус и нажмите «Сохранить».');
}

function downloadVariant() {
  const file = new Blob([JSON.stringify(sanitize(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'casefolk-build.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const actions = {
  computer: () => navigate('config', 'parts'),
  save: saveVariant,
  saved: showSaved,
  discuss: openRequest,
  close: closeRequest,
  download: downloadVariant,
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
  actions[data.action]?.();
});

root.addEventListener('change', event => {
  const element = event.target;
  if (element.name === 'cf-material') return updateConfig(() => { state.material = element.value; });
  if (element.dataset.setting) return updateConfig(() => { state[element.dataset.setting] = element.value; });
  if (element.dataset.part) updateConfig(() => { state.parts[element.dataset.part] = element.value; });
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
const route = routes[location.hash];
if (route) [state.page, state.stage] = route;
render();
reveal(find(state.page === 'home' ? '.cf-hero' : '.cf-config-head'), 400);
