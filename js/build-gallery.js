import { color, dimensions, escape } from './config.js';
import { scene } from './preview.js';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

export function renderBuildGallery(host, entries) {
  host.innerHTML = entries.map((entry, index) => {
    const config = entry.config;
    const id = escape(entry.id);
    const name = escape(entry.name);
    return `<article class="cf-build-card">
      <button class="cf-build-open" data-action="open-build" data-id="${id}" aria-label="Открыть сборку «${name}» в конструкторе">
        <span class="cf-build-picture" data-build-preview="${index}"></span>
        <span class="cf-build-details"><strong>${name}</strong><span>${escape(config.material)} · ${escape(dimensions(config))}</span><span class="cf-build-colors"><i style="background:${color(config.frame).hex}"></i>${escape(color(config.frame).name)}<i style="background:${color(config.panel).hex}"></i>${escape(color(config.panel).name)}</span><span class="cf-build-date">Изменено ${escape(dateFormat.format(new Date(entry.updatedAt)))}</span><span class="cf-build-open-label">Открыть в конструкторе ↗</span></span>
      </button>
      <div class="cf-build-card-actions"><button data-action="copy-build" data-id="${id}" aria-label="Скопировать JSON сборки «${name}»">Скопировать JSON</button><button data-action="download-build" data-id="${id}" aria-label="Скачать JSON сборки «${name}»">JSON ↓</button><button data-action="delete-build" data-id="${id}" aria-label="Удалить сборку «${name}»">Удалить</button></div>
      <p class="cf-build-copy-status" data-copy-status role="status"></p>
    </article>`;
  }).join('');
  entries.forEach((entry, index) => scene(host.querySelector(`[data-build-preview="${index}"]`), entry.config, `saved-${index}`));
}
