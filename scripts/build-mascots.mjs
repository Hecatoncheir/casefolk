import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../assets/svg/', import.meta.url);
const source = await readFile(new URL('mascot.svg', directory), 'utf8');
const paths = [...source.matchAll(/<path\b[^>]*\/>/g)].map(match => match[0]);
if (paths.length !== 5) throw new Error('Изменилась структура исходного персонажа');

const ink = '#20251e';
const paper = '#f7f2e8';
const body = paths[0] + paths[4];
const complete = paths.join('');

// Корпус, ручка, лицо, вентилятор и ноги сохранены из исходного SVG.
// Отдельный контур руки позволяет менять жест, сохраняя самого персонажа.
const arm = `<path d="M301 158C324 157 338 177 353 194L376 201C387 203 394 211 389 220C383 230 367 232 352 226C327 218 315 206 301 203Z"/>`;
const grip = `<path d="M353 224C358 216 369 211 381 211C389 211 394 216 392 222C390 230 376 235 364 233Z"/><path d="M366 222L381 219" stroke="${paper}" stroke-width="3.5" stroke-linecap="round"/>`;

function swatches() {
  const samples = [
    { angle: -28, color: '#7d896a' },
    { angle: 0, color: '#e8dfc8' },
    { angle: 28, color: '#be745b' },
  ];
  return `<g transform="translate(378 236)">${samples.map(sample => `<g transform="rotate(${sample.angle})"><rect x="-25" y="-124" width="50" height="126" rx="10" fill="${paper}" stroke="${ink}" stroke-width="4"/><rect x="-17" y="-116" width="34" height="72" rx="5" fill="${sample.color}"/><path d="M-13 -30H13M-13 -20H5" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="-8" r="3" fill="${ink}"/></g>`).join('')}</g>`;
}

function processor() {
  const pins = [12, 30, 48, 66, 84].map(position => `<path d="M${position} -7V0M${position} 96V103M-7 ${position}H0M96 ${position}H103"/>`).join('');
  return `<g transform="translate(342 146) rotate(8 48 48)"><g fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round">${pins}</g><rect width="96" height="96" rx="12" fill="${paper}" stroke="${ink}" stroke-width="5"/><rect x="17" y="17" width="62" height="62" rx="9" fill="#dce5c9" stroke="${ink}" stroke-width="4"/><path d="M30 32H62M30 43H49" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="68" cy="68" r="4" fill="${ink}"/></g>`;
}

function clipboard() {
  return `<g transform="translate(6 168) rotate(-9 50 65)"><rect width="100" height="130" rx="12" fill="${paper}" stroke="${ink}" stroke-width="5"/><rect x="27" y="-8" width="46" height="18" rx="6" fill="${ink}"/><circle cx="50" cy="-3" r="3" fill="${paper}"/><path d="M20 41L31 52L53 28" fill="none" stroke="#6f8057" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 76H77M20 92H77M20 108H57" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/></g><path d="M100 245C111 240 121 247 119 256C117 266 106 274 97 270C90 267 92 252 100 245Z"/>`;
}

const states = [
  {
    name: 'case', title: 'Casefolk выбирает материал и цвета корпуса',
    clip: 'M0 0H312V300H409V380H0Z',
    body,
    gesture: arm + swatches() + grip,
    transform: '',
  },
  {
    name: 'parts', title: 'Casefolk подбирает комплектующие с процессором в руке',
    clip: 'M0 0H312V300H409V380H0Z',
    body,
    gesture: arm + processor() + grip,
    transform: 'rotate(-3 210 205)',
  },
  {
    name: 'summary', title: 'Casefolk проверяет готовую сборку по списку',
    clip: 'M0 0H409V380H0Z M0 198H52V300H0Z',
    body: complete,
    gesture: clipboard() + `<path d="M220 124Q233 133 246 121" fill="none" stroke="${paper}" stroke-width="5" stroke-linecap="round"/>`,
    transform: '',
  },
];

for (const state of states) {
  const id = `casefolk-${state.name}-body`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 400" fill="currentColor" color="${ink}" role="img" aria-labelledby="title"><title id="title">${state.title}</title><defs><clipPath id="${id}"><path d="${state.clip}" clip-rule="evenodd" fill-rule="evenodd"/></clipPath></defs><g transform="translate(12 10)"><g transform="${state.transform || 'translate(0 0)'}"><g clip-path="url(#${id})">${state.body}</g>${state.gesture}</g></g></svg>\n`;
  await writeFile(new URL(`mascot-${state.name}.svg`, directory), svg);
  console.log(`Создан mascot-${state.name}.svg`);
}
