export const palette = [
  { id: 'sage', name: 'Шалфей', hex: '#7d896a', dark: false },
  { id: 'cream', name: 'Сливочный', hex: '#e8dfc8', dark: false },
  { id: 'graphite', name: 'Графит', hex: '#343936', dark: true },
  { id: 'terracotta', name: 'Терракота', hex: '#be745b', dark: false },
  { id: 'blue', name: 'Серо-голубой', hex: '#829ba6', dark: false },
  { id: 'white', name: 'Меловой', hex: '#f3f1e8', dark: false },
];

export const partOptions = {
  purpose: ['Игры и повседневные задачи', 'Работа и создание контента', 'Тихий домашний компьютер', 'Помогите определиться'],
  cpu: ['Помогите подобрать', 'Платформа AMD', 'Платформа Intel', 'У меня уже есть процессор'],
  ram: ['32 ГБ', '16 ГБ', '64 ГБ', 'Помогите подобрать', 'Используем мою память'],
  motherboard: ['Подобрать под процессор', 'ATX', 'microATX', 'Mini-ITX', 'У меня уже есть плата'],
  gpu: ['Подобрать под задачи и бюджет', 'Используем мою видеокарту', 'Без отдельной видеокарты'],
  storage: ['SSD 1 ТБ', 'SSD 2 ТБ', 'Используем мои накопители', 'Помогите подобрать'],
};

export const initial = {
  version: 1,
  page: 'home', stage: 'case', material: 'PETG', frame: 'sage', panel: 'cream',
  size: 'standard', panelType: 'mesh', fanSize: '120', fans: 3, view: 'outside',
  parts: Object.fromEntries(Object.entries(partOptions).map(([key, options]) => [key, options[0]])),
};

export const color = id => palette.find(item => item.id === id) || palette[0];
export const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function maxFans(state) {
  if (state.size === 'expanded') return 6;
  return state.fanSize === '140' ? 4 : 5;
}

export function availableColors(material) {
  return material === 'PETG-CF' ? palette.filter(item => ['graphite', 'sage'].includes(item.id)) : palette;
}

export function normalize(state) {
  if (state.material === 'PETG-CF') {
    const allowed = availableColors(state.material).map(item => item.id);
    for (const key of ['frame', 'panel']) {
      if (!allowed.includes(state[key])) state[key] = 'graphite';
    }
  }
  state.fans = Math.max(0, Math.min(maxFans(state), state.fans));
  return state;
}

export function sanitize(value) {
  const state = structuredClone(initial);
  if (!value || typeof value !== 'object' || value.version !== 1) return state;
  const choices = {
    page: ['home', 'config'], stage: ['case', 'parts', 'summary'], material: ['PETG', 'PETG-CF'],
    frame: palette.map(item => item.id), panel: palette.map(item => item.id),
    size: ['standard', 'expanded'], panelType: ['mesh', 'clear'],
    fanSize: ['120', '140'], view: ['outside', 'inside'],
  };
  for (const [key, options] of Object.entries(choices)) {
    if (options.includes(value[key])) state[key] = value[key];
  }
  if (Number.isInteger(value.fans)) state.fans = value.fans;
  for (const [key, options] of Object.entries(partOptions)) {
    if (options.includes(value.parts?.[key])) state.parts[key] = value.parts[key];
  }
  return normalize(state);
}

export function dimensions(state) {
  return `${state.size === 'expanded' ? '433' : '353'} × 338 × 202 мм`;
}

export function rows(state) {
  const parts = state.parts;
  return [
    ['Корпус', 'MODCASE HYPER'], ['Материал', state.material],
    ['Рама / панели', `${color(state.frame).name} / ${color(state.panel).name}`],
    ['Габариты', dimensions(state)], ['Панель', state.panelType === 'mesh' ? 'Сетчатая' : 'Прозрачная'],
    ['Вентиляторы', `${state.fans} × ${state.fanSize} мм`], ['Задачи', parts.purpose],
    ['Процессор', parts.cpu], ['Память', parts.ram], ['Плата', parts.motherboard],
    ['Видеокарта', parts.gpu], ['Накопитель', parts.storage],
  ];
}

export function requestText(state) {
  return 'Casefolk · пример индивидуальной сборки\n\n' + rows(state).map(([key, value]) => `${key}: ${value}`).join('\n');
}
