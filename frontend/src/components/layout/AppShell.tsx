// oxlint-disable react/set-state-in-effect
import clsx from 'clsx';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom';

import type { UserRole } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useTheme } from '@/app/ThemeProvider';
import rostelecomMark from '@/assets/brand/rostelecom-mark.png';
import { Avatar } from '@/components/ui/Badge';
import { IconButton, chipClass } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useDismiss, useMediaQuery } from '@/hooks';
import { ROLE_LABELS } from '@/lib/format';
import { NotificationCenter } from './NotificationCenter';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  role?: UserRole;
  end?: boolean;
}

/*
 * Навигация делится так же, как на дашборде системы: чипы в верхней строке —
 * рабочие разделы, между которыми переключаются весь день; рейка слева —
 * инструменты и администрирование, куда заходят по делу.
 */
const WORK_NAV: NavItem[] = [
  { to: '/', label: 'Обзор', icon: 'overview', end: true },
  { to: '/interactions', label: 'Взаимодействия', icon: 'cards' },
  { to: '/universities', label: 'Вузы', icon: 'university' },
  { to: '/reports', label: 'Отчёты', icon: 'report' },
];

const TOOL_NAV: NavItem[] = [
  { to: '/catalogs', label: 'Справочники', icon: 'catalog' },
  { to: '/workflows', label: 'Процессы', icon: 'route' },
  { to: '/imports', label: 'Импорт', icon: 'import', role: 'manager' },
  { to: '/users', label: 'Сотрудники', icon: 'users', role: 'manager' },
  { to: '/audit', label: 'Журнал аудита', icon: 'audit', role: 'admin' },
  { to: '/help', label: 'Помощь', icon: 'info' },
];

export function AppShell() {
  const { can, signOut } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const location = useLocation();

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const allowed = (items: NavItem[]) => items.filter((item) => !item.role || can(item.role));

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-page lg:p-4">
      {/* Рамка приложения: page-filled, скругление 44px — расширение CRM. */}
      <div className="flex min-h-dvh min-w-0 bg-frame lg:min-h-[calc(100dvh-2rem)] lg:rounded-frame lg:shadow-bottom-xl">
        {isDesktop && (
          <aside
            aria-label="Инструменты"
            onMouseEnter={() => setRailExpanded(true)}
            onMouseLeave={() => setRailExpanded(false)}
            onFocusCapture={() => setRailExpanded(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setRailExpanded(false);
              }
            }}
            className={clsx(
              'sticky top-4 z-[1100] box-content flex h-[calc(100dvh-6rem)] shrink-0 flex-col items-center gap-3 overflow-visible py-8 pl-8 transition-[width] duration-300 ease-productive-entrance',
              railExpanded ? 'w-64' : 'w-12',
            )}
          >
            <BrandMark />
            <nav className="mt-10 flex w-full flex-col gap-3">
              {allowed(TOOL_NAV).map((item) => (
                <RailLink key={item.to} item={item} expanded={railExpanded} onNavigate={() => setRailExpanded(false)} />
              ))}
            </nav>
            <div className="mt-auto">
              <Tooltip label="Выйти" side="right">
                <IconButton
                  icon="logout"
                  label="Выйти"
                  variant="ghost"
                  onClick={() => void signOut()}
                />
              </Tooltip>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
          <div className="flex min-h-12 flex-wrap items-center gap-2 lg:flex-nowrap">
            {!isDesktop && (
              <>
                <IconButton
                  icon="menu"
                  label="Открыть меню"
                  variant="onCard"
                  onClick={() => setDrawerOpen(true)}
                />
                <BrandMark size={32} />
              </>
            )}
            <nav
              aria-label="Разделы"
              className="order-last -mx-4 -my-1 flex w-[calc(100%+2rem)] min-w-0 gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:order-none lg:mx-0 lg:w-auto lg:px-0"
            >
              {WORK_NAV.map((item) => (
                <ChipLink key={item.to} item={item} />
              ))}
            </nav>
            <span className="flex-1" />
            <ThemeToggle />
            <NotificationCenter />
            <UserMenu />
          </div>

          <main className="min-w-0">
            {/* Экраны грузятся по требованию — рамка и навигация остаются на месте. */}
            <Suspense fallback={<ScreenFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {!isDesktop && drawerOpen && (
        <Drawer
          onClose={() => setDrawerOpen(false)}
          sections={[
            { title: 'Работа', items: WORK_NAV },
            { title: 'Инструменты', items: allowed(TOOL_NAV) },
          ]}
          onSignOut={() => void signOut()}
        />
      )}
    </div>
  );
}

/** Знак «Ростелеком ИТ Школы» — вырезан из фирменного логотипа, без словесной части. */
export function BrandMark({ size = 48 }: { size?: 32 | 48 }) {
  return (
    <img
      src={rostelecomMark}
      alt=""
      aria-hidden="true"
      className={clsx('block shrink-0 object-contain', size === 48 ? 'size-12' : 'size-8')}
    />
  );
}

function RailLink({
  item,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  onNavigate: () => void;
}) {
  const exact = useMatch({ path: item.to, end: true });
  const nested = useMatch({ path: `${item.to}/*` });
  const current = Boolean(exact || nested);

  return (
      <NavLink
        to={item.to}
        aria-label={item.label}
        onClick={onNavigate}
        className={clsx(
          'flex h-12 w-full items-center gap-3 overflow-hidden rounded-m px-3 transition-[background-color,transform,justify-content] duration-150 ease-productive active:scale-[.94]',
          expanded ? 'justify-start' : 'justify-center',
          current ? 'bg-accent text-white hover:bg-accent-hover' : 'text-fg hover:bg-neutral-container',
        )}
      >
        <Icon name={item.icon} className="size-6 shrink-0" />
        <span
          className={clsx(
            'overflow-hidden whitespace-nowrap text-body-m transition-[max-width,opacity] duration-200 ease-productive-exit',
            expanded ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0',
          )}
        >
          {item.label}
        </span>
      </NavLink>
  );
}

function ChipLink({ item }: { item: NavItem }) {
  const exact = useMatch({ path: item.to, end: true });
  const nested = useMatch({ path: `${item.to}/*` });
  const selected = item.end ? Boolean(exact) : Boolean(exact || nested);

  return (
    <NavLink to={item.to} end={item.end} className={chipClass({ size: 'l', selected })}>
      <Icon name={item.icon} className="size-5" />
      {item.label}
    </NavLink>
  );
}

function ThemeToggle() {
  const { resolved, setChoice } = useTheme();
  const dark = resolved === 'dark';
  return (
    <IconButton
      icon={dark ? 'sun' : 'moon'}
      label={dark ? 'Светлая тема' : 'Тёмная тема'}
      variant="onCard"
      onClick={() => setChoice(dark ? 'light' : 'dark')}
    />
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.full_name}, меню профиля`}
        className="block cursor-pointer rounded-full border-0 bg-transparent p-0 transition-transform duration-100 active:scale-[.96]"
      >
        <Avatar name={user.full_name} size={48} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-menu absolute top-[calc(100%+8px)] right-0 z-[1000] min-w-64 origin-top-right rounded-l bg-elevated py-2 shadow-bottom-l"
        >
          <div className="flex items-center gap-3 px-4 pt-2 pb-3">
            <Avatar name={user.full_name} size={40} online />
            <div className="min-w-0">
              <p className="truncate text-body-m font-medium text-fg">{user.full_name}</p>
              <p className="text-body-s text-fg-muted">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex h-10 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 text-left text-body-m text-fg transition-colors hover:bg-neutral-container"
          >
            Выйти
            <Icon name="logout" className="size-5 text-fg-muted" />
          </button>
        </div>
      )}
    </div>
  );
}

function Drawer({
  onClose,
  sections,
  onSignOut,
}: {
  onClose: () => void;
  sections: { title: string; items: NavItem[] }[];
  onSignOut: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1400] overflow-hidden">
      <div className="animate-fade absolute inset-0 bg-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="animate-rise absolute top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 flex w-[min(300px,calc(100vw-1rem))] flex-col rounded-card bg-frame p-4 shadow-bottom-xl">
        <div className="flex items-center justify-between gap-3 pb-4">
          <span className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="text-h3 font-bold text-fg">CRM ИТ Школы</span>
          </span>
          <IconButton icon="close" label="Закрыть меню" size="m" variant="ghost" onClick={onClose} />
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="label px-3 pb-1">{section.title}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex h-12 items-center gap-3 rounded-m px-3 text-body-m transition-colors duration-150',
                      isActive ? 'bg-accent text-white' : 'text-fg hover:bg-neutral-container',
                    )
                  }
                >
                  <Icon name={item.icon} className="size-6" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-12 cursor-pointer items-center gap-3 rounded-m border-0 bg-transparent px-3 text-body-m text-fg transition-colors hover:bg-neutral-container"
        >
          <Icon name="logout" className="size-6" />
          Выйти
        </button>
      </aside>
    </div>
  );
}

/*
 * Tooltip — по «Атомаро»: плашка neutral-990 (в тёмной теме — neutral-50),
 * body-s, скругление m; появление за duration-xs.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  side?: 'top' | 'right';
  children: ReactNode;
}) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute z-[1000] rounded-m bg-inverse px-2.5 py-1.5 text-body-s whitespace-nowrap text-on-inverse opacity-0',
          // Исчезает сразу и плавно (exit), появляется с задержкой 300 мс, чтобы не
          // мигать при проходе курсора. По фокусу — только при навигации с клавиатуры:
          // после клика ссылка остаётся в фокусе, и подсказка иначе «висела» бы.
          'transition-[opacity,transform] duration-200 ease-productive-out',
          'group-hover/tip:opacity-100 group-hover/tip:delay-300 group-hover/tip:ease-productive-in',
          'group-has-[:focus-visible]/tip:opacity-100 group-has-[:focus-visible]/tip:delay-0',
          side === 'top' &&
            'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 translate-y-1 group-hover/tip:translate-y-0 group-has-[:focus-visible]/tip:translate-y-0',
          side === 'right' &&
            'top-1/2 left-[calc(100%+12px)] -translate-x-1 -translate-y-1/2 group-hover/tip:translate-x-0 group-has-[:focus-visible]/tip:translate-x-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}

function ScreenFallback() {
  return (
    <Page>
      <div className="mt-14 flex flex-col gap-6">
        <div className="skeleton h-14 w-96 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="skeleton h-64 rounded-card" />
          <div className="skeleton h-64 rounded-card lg:col-span-2" />
        </div>
      </div>
    </Page>
  );
}

/** Контейнер экрана внутри рамки — отступы задаёт сама рамка. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('min-w-0 w-full pb-4', className)}>{children}</div>;
}
