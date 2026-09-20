import { useState, type ReactNode } from 'react';

import { Page } from '@/components/layout/AppShell';
import { Chip } from '@/components/ui/Button';
import { CardHeader, PageHeader } from '@/components/ui/States';

type Section = 'user' | 'admin' | 'architecture';

export function HelpPage() {
  const [section, setSection] = useState<Section>('user');

  return (
    <Page>
      <PageHeader
        eyebrow="Офлайн-справка"
        title="Руководства и архитектура"
        meta="Материалы поставляются вместе с приложением и не требуют доступа к внешним сайтам."
      />
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Разделы справки">
        <Chip selected={section === 'user'} icon="users" onClick={() => setSection('user')}>
          Пользователю
        </Chip>
        <Chip selected={section === 'admin'} icon="settings" onClick={() => setSection('admin')}>
          Администратору
        </Chip>
        <Chip selected={section === 'architecture'} icon="route" onClick={() => setSection('architecture')}>
          Архитектура
        </Chip>
      </nav>
      {section === 'user' && <UserGuide />}
      {section === 'admin' && <AdminGuide />}
      {section === 'architecture' && <ArchitectureGuide />}
    </Page>
  );
}

function UserGuide() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
      <section className="card card-pad">
        <CardHeader title="Работа с карточкой" sub="Вуз + ИТ-направление + продукт — одна карточка взаимодействия." />
        <ol className="mt-5 grid gap-4 text-body-s text-fg-soft">
          <li><strong className="text-fg">1. Найдите или создайте карточку.</strong> В разделе «Взаимодействия» используйте поиск и фильтры; новая карточка создаётся кнопкой с плюсом.</li>
          <li><strong className="text-fg">2. Ведите маршрут.</strong> На карточке выбирайте доступный следующий этап, добавляйте обязательный комментарий и подтверждайте переход.</li>
          <li><strong className="text-fg">3. Храните документы у этапа.</strong> В блоке «Файлы» приложите договор, акт или письмо. Формат проверяется по содержимому, не только по расширению.</li>
          <li><strong className="text-fg">4. Обсуждайте работу.</strong> В «Обсуждении карточки» можно отправить текст, до 10 вложений или сообщение только с файлами. Нажмите на файл в сообщении, чтобы скачать его.</li>
          <li><strong className="text-fg">5. Стройте отчёт.</strong> На вкладке «Отчёты» выберите колонки и формат: XLS, XLSX, PDF или JSON.</li>
        </ol>
      </section>
      <ScreenPreview title="Карточка взаимодействия" />
      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Быстрые ответы" />
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
          <Question question="Почему я не вижу вуз?" answer="Роль user видит только закреплённые за ней вузы. Обратитесь к менеджеру или администратору для назначения." />
          <Question question="Какие файлы допускаются?" answer="PNG, JPEG, PDF, ZIP, GZIP, RAR, DOC, DOCX, XLS и XLSX; размер каждого файла — до 25 МиБ." />
          <Question question="Можно ли стереть историю?" answer="Нет. Удаление бизнес-записей мягкое; история и аудит сохраняются." />
          <Question question="Что означает ошибка перехода?" answer="В маршрут не добавлен такой переход или для него обязателен комментарий. Выберите доступный этап." />
        </dl>
      </section>
    </div>
  );
}

function AdminGuide() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GuideCard title="Перед запуском в закрытом контуре">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Создайте отдельный production realm и клиентов Keycloak; секреты и пароли разместите вне Git.</li>
          <li>Ограничьте сетевой доступ: публичным остаётся только веб-вход, PostgreSQL, MinIO, Redis и мониторинг — во внутреннем сегменте.</li>
          <li>Согласуйте allowlist адресов LMS/CMS, proxy, VPN и при необходимости mTLS до включения внешних интеграций.</li>
          <li>Проверьте резервное копирование PostgreSQL и MinIO, затем выполните сценарий входа под каждой ролью.</li>
        </ol>
      </GuideCard>
      <GuideCard title="Роли и доступ">
        <ul className="space-y-2">
          <li><strong className="text-fg">user:</strong> только назначенные вузы и их карточки.</li>
          <li><strong className="text-fg">manager:</strong> работа со всеми карточками, импорт, каталоги и правила уведомлений.</li>
          <li><strong className="text-fg">admin:</strong> дополнительно пользователи, журнал аудита и опасные операции.</li>
        </ul>
      </GuideCard>
      <GuideCard title="Флаги и кэш">
        <ul className="space-y-2 font-mono text-desc text-fg-soft">
          <li>CACHE_ENABLED + FEATURE_CACHE_ENABLED — Redis-кэш каталогов.</li>
          <li>FEATURE_CHAT_ENABLED — чат карточки и вложения сообщений.</li>
          <li>FEATURE_NOTIFICATIONS_ENABLED — worker уведомлений.</li>
          <li>FEATURE_EXTERNAL_CHANNELS_ENABLED — email / Telegram / MAX.</li>
        </ul>
        <p className="mt-3 text-desc text-fg-muted">Все необязательные возможности выключены по умолчанию; изменение флага не меняет уже сохранённые данные.</p>
      </GuideCard>
      <ScreenPreview title="Проверка роли и контура" />
    </div>
  );
}

function ArchitectureGuide() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
      <section className="card card-pad">
        <CardHeader title="Компонентная схема" sub="Модель Archi находится в docs/architecture/CRM-IT-School.archimate." />
        <div className="mt-5 grid gap-2 text-center text-body-s font-medium">
          <div className="rounded-m bg-accent-container px-3 py-3 text-fg">Пользователь · Браузер</div>
          <div className="text-fg-muted">↓ HTTPS / same origin</div>
          <div className="rounded-m bg-surface-3 px-3 py-3 text-fg">React SPA · Nginx</div>
          <div className="text-fg-muted">↓ REST / JWT</div>
          <div className="rounded-m bg-surface-3 px-3 py-3 text-fg">FastAPI · сервисы · аудит</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-m bg-surface-3 px-3 py-3 text-fg">PostgreSQL</div>
            <div className="rounded-m bg-surface-3 px-3 py-3 text-fg">MinIO</div>
            <div className="rounded-m bg-surface-3 px-3 py-3 text-fg">Redis</div>
          </div>
          <div className="rounded-m bg-neutral-container px-3 py-3 text-fg">Keycloak · интеграции · уведомления</div>
        </div>
      </section>
      <GuideCard title="Границы ответственности">
        <ul className="space-y-3">
          <li><strong className="text-fg">SPA</strong> показывает данные и не принимает решения о доступе.</li>
          <li><strong className="text-fg">API</strong> применяет правила, проверяет JWT и область видимости на уровне репозиториев.</li>
          <li><strong className="text-fg">PostgreSQL</strong> хранит предметные данные и аудит; файлы в ней не дублируются.</li>
          <li><strong className="text-fg">MinIO</strong> хранит файлы, доступ к ним идёт только через API.</li>
        </ul>
      </GuideCard>
    </div>
  );
}

function GuideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card card-pad">
      <CardHeader title={title} />
      <div className="mt-4 text-body-s text-fg-soft">{children}</div>
    </section>
  );
}

function Question({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <dt className="text-body-s font-medium text-fg">{question}</dt>
      <dd className="mt-1 text-body-s text-fg-soft">{answer}</dd>
    </div>
  );
}

/** Offline, compact screen capture illustrating the actual page structure. */
function ScreenPreview({ title }: { title: string }) {
  return (
    <figure className="card overflow-hidden">
      <figcaption className="sr-only">Снимок интерфейса: {title}</figcaption>
      <div className="flex h-9 items-center gap-1 border-b border-border-soft bg-surface-3 px-3">
        <i className="size-2 rounded-full bg-error/70" /><i className="size-2 rounded-full bg-warning/70" /><i className="size-2 rounded-full bg-success/70" />
        <span className="ml-2 text-desc text-fg-muted">{title}</span>
      </div>
      <div className="grid min-h-60 grid-cols-[4.5rem_1fr] bg-surface-1">
        <div className="flex flex-col gap-2 border-r border-border-soft p-3"><i className="h-7 rounded-m bg-surface-3" /><i className="h-7 rounded-m bg-accent-container" /><i className="h-7 rounded-m bg-surface-3" /></div>
        <div className="p-4"><i className="mb-4 block h-5 w-3/5 rounded bg-surface-3" /><i className="mb-3 block h-16 rounded-m bg-surface-3" /><div className="ml-auto w-4/5 rounded-m bg-accent-container p-3"><i className="mb-2 block h-3 w-3/4 rounded bg-accent/30" /><i className="block h-7 rounded-m bg-surface-1" /></div></div>
      </div>
      <p className="border-t border-border-soft px-4 py-3 text-desc text-fg-muted">Снимок встроенного интерфейса: разделы, карточка и вложение в обсуждении.</p>
    </figure>
  );
}
