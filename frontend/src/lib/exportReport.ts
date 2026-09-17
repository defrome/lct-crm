import robotoMediumUrl from '@/assets/fonts/Roboto-Medium.ttf?url';
import robotoRegularUrl from '@/assets/fonts/Roboto-Regular.ttf?url';
import { saveBlob, saveText, stamp } from './download';

const MARGIN = 28;
const ACCENT = '#7700ff';
const INK = '#14121c';
const MUTED = '#6b6780';
const LINE = '#e6e3ee';

export interface ReportColumn {
  key: string;
  title: string;
  /** Column width in characters, used by the spreadsheet and PDF layouts. */
  width?: number;
}

export interface ReportPayload {
  title: string;
  /** Human-readable description of the filters this report was built with. */
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string>[];
}

/**
 * Report exports (FR-05, FR-09, SOL-04).
 *
 * The API has no report endpoint yet — BACKLOG track B2 — so the file is built
 * in the browser from the rows the user is looking at. The heavy writers are
 * loaded on demand: a session that never exports never pays for them.
 */

function filename(payload: ReportPayload, extension: string): string {
  return `${payload.title} ${stamp()}.${extension}`;
}

export async function exportXlsx(payload: ReportPayload): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM ИТ Школы';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Отчёт', {
    views: [{ state: 'frozen', ySplit: payload.subtitle ? 3 : 2 }],
  });

  sheet.addRow([payload.title]).font = { bold: true, size: 14 };
  if (payload.subtitle) {
    sheet.addRow([payload.subtitle]).font = { size: 10, color: { argb: 'FF6B6780' } };
  }

  const header = sheet.addRow(payload.columns.map((column) => column.title));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7700FF' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  for (const row of payload.rows) {
    sheet.addRow(payload.columns.map((column) => row[column.key] ?? ''));
  }

  payload.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width ?? 24;
  });
  sheet.autoFilter = {
    from: { row: header.number, column: 1 },
    to: { row: header.number, column: payload.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename(payload, 'xlsx'),
  );
}

/**
 * The PDF's font travels with it.
 *
 * The PDF standard's core fonts (Helvetica, Times, Courier) carry no Cyrillic
 * glyphs, so a report in Russian set in them comes out blank. Roboto covers
 * Cyrillic completely and is embedded here; the files are fetched only when
 * someone actually exports a PDF, so they cost nothing on every other screen.
 */
async function loadFont(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Не удалось загрузить шрифт для PDF');
  const bytes = new Uint8Array(await response.arrayBuffer());

  // btoa needs a binary string, and spreading 150 kB into one call overflows
  // the argument limit — hence the chunking.
  let binary = '';
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

export async function exportPdf(payload: ReportPayload): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, regular, medium] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadFont(robotoRegularUrl),
    loadFont(robotoMediumUrl),
  ]);

  const landscape = payload.columns.length > 4;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  doc.addFileToVFS('Roboto-Regular.ttf', regular);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Medium.ttf', medium);
  doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(INK);
  doc.text(payload.title, MARGIN, 40);

  if (payload.subtitle) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    doc.text(payload.subtitle, MARGIN, 56, {
      maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2,
    });
  }

  autoTable(doc, {
    startY: payload.subtitle ? 76 : 56,
    margin: { left: MARGIN, right: MARGIN, bottom: 34 },
    head: [payload.columns.map((column) => column.title)],
    body: payload.rows.map((row) => payload.columns.map((column) => row[column.key] || '—')),
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 5, textColor: INK, lineColor: LINE },
    headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: ACCENT, textColor: '#ffffff' },
    alternateRowStyles: { fillColor: '#faf9fc' },
    theme: 'grid',
    didDrawPage: () => {
      const { width, height } = doc.internal.pageSize;
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED);
      doc.text('CRM ИТ Школы Ростелекома', MARGIN, height.valueOf() - 16);
      doc.text(
        `${doc.getCurrentPageInfo().pageNumber}`,
        width.valueOf() - MARGIN,
        height.valueOf() - 16,
        { align: 'right' },
      );
    },
  });

  doc.save(filename(payload, 'pdf'));
}

export function exportCsv(payload: ReportPayload): void {
  const escape = (value: string) =>
    /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

  const lines = [
    payload.columns.map((column) => escape(column.title)).join(';'),
    ...payload.rows.map((row) =>
      payload.columns.map((column) => escape(row[column.key] ?? '')).join(';'),
    ),
  ];

  // A BOM plus semicolons is what Excel on a Russian locale opens correctly.
  saveText('﻿' + lines.join('\r\n'), filename(payload, 'csv'), 'text/csv');
}

/** The machine-readable result file required by SOL-04. */
export function exportJson(payload: ReportPayload): void {
  saveText(
    JSON.stringify(
      {
        title: payload.title,
        filters: payload.subtitle,
        generated_at: new Date().toISOString(),
        columns: payload.columns.map((column) => ({ key: column.key, title: column.title })),
        total: payload.rows.length,
        rows: payload.rows,
      },
      null,
      2,
    ),
    filename(payload, 'json'),
  );
}
