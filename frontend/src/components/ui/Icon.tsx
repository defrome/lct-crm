import type { ReactNode } from 'react';

/**
 * Иконки в стиле «Атомаро»: сетка 24×24, обводка 1.6, скруглённые концы и углы.
 * Символы, которые есть в дизайн-системе (grid, report, cal, plus, bell, search,
 * sliders, go, chev, panel, clock, bars, users, gear, edit, out, more, check,
 * sun, moon, copy, phone, list, kanban, layers), перенесены без изменений;
 * остальные нарисованы в той же манере.
 */
const ICONS = {
  // --- из системы ---
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  report: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 9h6M9 12.5h6M9 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  filter: <path d="M6 4v5M6 13v7M12 4v9M12 17v3M18 4v3M18 11v9M4 11h4M10 15h4M16 9h4" />,
  go: <path d="M7 17L17 7M9 7h8v8" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  panel: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9.5 3.5v17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  reports: (
    <>
      <rect x="4" y="10" width="4" height="10" rx="1.2" />
      <rect x="10" y="4" width="4" height="16" rx="1.2" />
      <rect x="16" y="13" width="4" height="7" rx="1.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 19.5a6 6 0 0 1 12 0M16 5a3.5 3.5 0 0 1 0 7M18 14.5a5 5 0 0 1 3 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r=".9" />
      <circle cx="12" cy="12" r=".9" />
      <circle cx="18" cy="12" r=".9" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V7a2.5 2.5 0 0 0-2.5-2.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" />
    </>
  ),
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  kanban: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="10.5" y="4" width="5" height="10" rx="1.5" />
      <rect x="17.5" y="4" width="3" height="13" rx="1.5" />
    </>
  ),
  catalog: (
    <>
      <path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="M3.5 12.5l8.5 4.5 8.5-4.5" />
    </>
  ),

  // --- в той же манере ---
  cards: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M7.5 10h9M7.5 14h5" />
    </>
  ),
  university: (
    <>
      <path d="M3.5 9.5L12 5l8.5 4.5" />
      <path d="M5.5 10v8M18.5 10v8M3.5 19.5h17M9.5 19.5v-5h5v5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 15.5V17a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-1.5" />
    </>
  ),
  audit: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 8h6M9 11.5h6M9 15l1.5 1.5L14 13" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  alert: (
    <>
      <path d="M10.3 4.3L3 17a2 2 0 0 0 1.7 3h14.6A2 2 0 0 0 21 17L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 16.5h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6M14 11v6" />
      <path d="M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7M9.5 7V5.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2V7" />
    </>
  ),
  download: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />,
  upload: <path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M5 4h14" />,
  file: (
    <>
      <path d="M13.5 3.5H8A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h8a2.5 2.5 0 0 0 2.5-2.5V8.5z" />
      <path d="M13.5 3.5v5h5" />
    </>
  ),
  paperclip: (
    <path d="M19.5 11.5l-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l7.8-7.8a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.5 1.5 0 0 1-2.1-2.1l7-7" />
  ),
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2.5" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  sortAsc: <path d="M8 18.5V5.5M4.5 9L8 5.5 11.5 9M14 7h6M14 12h4.5M14 17h3" />,
  sortDesc: <path d="M8 5.5v13M4.5 15L8 18.5l3.5-3.5M14 7h6M14 12h4.5M14 17h3" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r=".9" />
    </>
  ),
  flag: <path d="M5.5 20.5V4.5M5.5 5h11l-2 4 2 4h-11" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  comment: (
    <path d="M20.5 14a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 4v-13A2.5 2.5 0 0 1 7 5h11a2.5 2.5 0 0 1 2.5 2.5z" />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = 'size-6',
  strokeWidth = 1.6,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
