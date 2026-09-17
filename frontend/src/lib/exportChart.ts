import { saveBlob, stamp } from './download';

/** Theme variables that appear inside chart markup and must be frozen on export. */
const THEME_VARS = [
  '--crm-chart-now',
  '--crm-chart-past',
  '--crm-chart-line',
  '--crm-card',
  '--atmr-fg-default',
  '--atmr-fg-muted',
  '--atmr-neutral-container-default',
  '--atmr-accent-default',
  '--atmr-base-status-01',
];

function resolveTheme(): Record<string, string> {
  const computed = getComputedStyle(document.documentElement);
  const resolved: Record<string, string> = {};
  for (const name of THEME_VARS) resolved[name] = computed.getPropertyValue(name).trim();
  return resolved;
}

/**
 * Saves a chart as PNG (FR-02).
 *
 * The chart's colours are `var(--c-…)` so themes work, but a serialised SVG has
 * no stylesheet to resolve them against — they are substituted for the values
 * the page is painting right now, which also means the exported file matches
 * the theme the user is looking at.
 */
export async function exportChartPng(
  container: HTMLElement,
  filename: string,
  scale = 2,
): Promise<void> {
  const source = container.querySelector('svg');
  if (!source) throw new Error('В этом блоке нет диаграммы для выгрузки');

  const theme = resolveTheme();
  const clone = source.cloneNode(true) as SVGSVGElement;

  const rect = source.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  let markup = new XMLSerializer().serializeToString(clone);
  for (const [name, value] of Object.entries(theme)) {
    markup = markup.replaceAll(`var(${name})`, value);
  }
  // Шрифты в PNG не встраиваются — называем семейство и запасные варианты.
  markup = markup.replaceAll('var(--atmr-font-family-base)', "'Onest', Arial, sans-serif");

  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не поддерживает выгрузку изображений');
    // The chart is drawn on a transparent surface; PNG viewers need a real one.
    context.fillStyle = theme['--crm-card'] || '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Не удалось собрать PNG');
    saveBlob(blob, `${filename} ${stamp()}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Не удалось отрисовать диаграмму')));
    image.src = url;
  });
}
