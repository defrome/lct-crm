/** Hands a generated or fetched file to the browser's downloads. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveText(text: string, filename: string, type = 'application/json'): void {
  saveBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

/** `отчёт 15.09.2026.xlsx` → a name that is safe on every filesystem. */
export function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

/** A date stamp for generated file names: `2026-09-15`. */
export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
