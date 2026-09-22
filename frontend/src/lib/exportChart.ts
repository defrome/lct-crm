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
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;color:var(--atmr-fg-default)';
  document.body.append(probe);

  try {
    const resolved: Record<string, string> = {};
    for (const name of THEME_VARS) {
      // getPropertyValue preserves aliases such as
      // `--crm-chart-now: var(--atmr-accent-200)`. An SVG opened from a Blob
      // has no page stylesheet, so those aliases must be resolved all the way
      // to a colour before it is painted on the export canvas.
      probe.style.color = `var(${name})`;
      resolved[name] = getComputedStyle(probe).color;
    }
    return resolved;
  } finally {
    probe.remove();
  }
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
  // Category charts keep their export-only SVG outside the visible card. Its
  // positioning is useful in the app, but meaningless (and potentially
  // clipping) inside a standalone SVG image.
  clone.removeAttribute('style');

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
