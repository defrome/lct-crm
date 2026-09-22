import { useState, type ReactNode } from 'react';

import { Page } from '@/components/layout/AppShell';
import { Chip } from '@/components/ui/Button';
import { CardHeader, PageHeader } from '@/components/ui/States';

type Section = 'user' | 'interactions' | 'imports' | 'reports';

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
        <Chip selected={section === 'interactions'} icon="cards" onClick={() => setSection('interactions')}>
          Взаимодействия
        </Chip>
        <Chip selected={section === 'imports'} icon="import" onClick={() => setSection('imports')}>
          Импорт
        </Chip>
        <Chip selected={section === 'reports'} icon="report" onClick={() => setSection('reports')}>
          Отчёты
        </Chip>
        {/* <Chip selected={section === 'admin'} icon="settings" onClick={() => setSection('admin')}>
          Администратору
        </Chip>
        <Chip selected={section === 'architecture'} icon="route" onClick={() => setSection('architecture')}>
          Архитектура
        </Chip> */}
      </nav>
      {section === 'user' && <UserGuide />}
      {section === 'interactions' && <InteractionsGuide />}
      {section === 'imports' && <ImportsGuide />}
      {section === 'reports' && <ReportsGuide />}
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
          <li><strong className="text-fg">5. Стройте отчёт.</strong> На вкладке «Отчёты» выберите колонки и формат: XLS, XLSX, PDF, CSV или JSON.</li>
        </ol>
      </section>
      <figure className="card overflow-hidden">
        <img
          src="/interaction-card-help.png"
          alt="Карточка взаимодействия МГТУ им. Н.Э. Баумана"
          className="block h-auto w-full"
        />
        <figcaption className="border-t border-border-soft px-4 py-3 text-desc text-fg-muted">
          Пример карточки взаимодействия с маршрутом, историей, договором и файлами.
        </figcaption>
      </figure>
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

function InteractionsGuide() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
      <section className="card card-pad">
        <CardHeader
          title="Работа с карточкой взаимодействия"
          sub="Карточка объединяет вуз, ИТ-направление, продукт, договор и ход работы по маршруту."
        />
        <ol className="mt-5 grid gap-4 text-body-s text-fg-soft">
          <li><strong className="text-fg">1. Найдите нужную карточку.</strong> В разделе «Взаимодействия» используйте поиск, фильтры и переключатель списка или канбан-доски. Нажмите на строку или карточку, чтобы открыть детали.</li>
          <li><strong className="text-fg">2. Проверьте путь работы.</strong> В блоке «Путь работы с вузом» текущий этап отмечен «сейчас», завершённые этапы — галочкой. Переключайте представление «Линия» и «Канбан» — это только меняет способ просмотра маршрута.</li>
          <li><strong className="text-fg">3. Переведите на доступный этап.</strong> Нажмите кнопку перехода у этапа на линии или целевой колонки канбана. В окне перехода укажите комментарий и подтвердите действие. Если комментарий обязателен, кнопка подтверждения станет доступна только после его ввода.</li>
          <li><strong className="text-fg">4. Вернитесь назад, если это разрешено.</strong> Обратный этап появляется среди доступных переходов, только когда он настроен в маршруте. Нельзя перевести карточку на произвольный этап или обойти правило процесса.</li>
          <li><strong className="text-fg">5. Смотрите историю.</strong> История под маршрутом фиксирует пройденные этапы, даты и комментарии. Она помогает понять, кто и почему изменил состояние карточки.</li>
        </ol>
      </section>

      <GuideCard title="Что доступно по ролям">
        <ul className="space-y-3">
          <li><strong className="text-fg">Пользователь:</strong> видит закреплённые за ним вузы и может переводить доступные ему карточки по настроенному маршруту.</li>
          <li><strong className="text-fg">Менеджер:</strong> работает со всеми карточками, создаёт их, редактирует данные и ставит карточку на маршрут.</li>
          <li><strong className="text-fg">Администратор:</strong> дополнительно может удалить карточку. Удаление мягкое: история остаётся в аудите.</li>
        </ul>
      </GuideCard>

      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Обсуждение и файлы" sub="Контекст работы хранится прямо в карточке, а не в отдельной переписке." />
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="text-body-s text-fg-soft">
            <h3 className="text-body-m font-medium text-fg">Обсуждение карточки</h3>
            <ul className="mt-3 space-y-2">
              <li>Сообщения видят участники, у которых есть доступ к карточке.</li>
              <li>Можно отправить текст, файлы или сообщение только с файлами.</li>
              <li>К сообщению можно приложить до 10 файлов; каждый — до 25 МиБ.</li>
              <li>Нажмите на вложение в сообщении, чтобы скачать его.</li>
            </ul>
          </div>
          <div className="text-body-s text-fg-soft">
            <h3 className="text-body-m font-medium text-fg">Файлы этапа</h3>
            <ul className="mt-3 space-y-2">
              <li>Файл прикрепляется к текущему этапу маршрута, поэтому его происхождение всегда понятно.</li>
              <li>Можно приложить PNG, JPEG, PDF, ZIP, GZIP, RAR, DOC, DOCX, XLS или XLSX — до 25 МиБ.</li>
              <li>При загрузке добавьте пояснение: например, номер договора или назначение документа.</li>
              <li>Скачать файл может пользователь с доступом к карточке; удалить вложение может администратор.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Если действие недоступно" />
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
          <Question question="Нет кнопки перехода" answer="Из текущего этапа нет разрешённого перехода, карточка находится на финальном этапе или у вас нет доступа к ней. Уточните маршрут у менеджера." />
          <Question question="Карточка не стоит на маршруте" answer="Менеджер должен нажать «Поставить на маршрут» и выбрать процесс. До этого нельзя прикладывать файлы к этапам." />
          <Question question="Не вижу карточку или сообщения" answer="Доступ пользователя ограничен закреплёнными вузами. Обратитесь к менеджеру для назначения." />
          <Question question="Не удаётся отправить сообщение" answer="Введите текст или выберите хотя бы один файл; проверьте ограничение: не более 10 вложений по 25 МиБ каждое." />
        </dl>
      </section>
    </div>
  );
}

function ImportsGuide() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
      <section className="card card-pad">
        <CardHeader
          title="Импорт из Excel"
          sub="Раздел доступен менеджерам и администраторам. Рабочие данные не меняются, пока вы не подтвердите запись."
        />
        <ol className="mt-5 grid gap-4 text-body-s text-fg-soft">
          <li><strong className="text-fg">1. Выберите тип данных и файл.</strong> Нажмите «Новый импорт», выберите взаимодействия, вузы, ИТ-продукты или контакты вузов, затем загрузите файл .xlsx или .xls размером до 20 МБ.</li>
          <li><strong className="text-fg">2. Сопоставьте колонки.</strong> Проверьте предложенное соответствие заголовков файла полям системы. Обязательные поля отмечены звёздочкой; пока они не сопоставлены, к предпросмотру перейти нельзя.</li>
          <li><strong className="text-fg">3. Используйте шаблон при повторной загрузке.</strong> Примените ранее сохранённый шаблон маппинга или сохраните текущий под понятным именем — это ускорит импорт файлов с теми же колонками.</li>
          <li><strong className="text-fg">4. Проверьте предпросмотр.</strong> Система покажет количество строк, которые будут созданы или обновлены, а также предупреждения и ошибки. Раскройте строку, чтобы увидеть исходные значения и причину замечания.</li>
          <li><strong className="text-fg">5. Запишите и скачайте результат.</strong> Нажмите «Записать в базу» только после проверки. На последнем шаге можно скачать XLSX-отчёт с итогом и перейти к взаимодействиям.</li>
        </ol>
      </section>

      <GuideCard title="Что загружается">
        <ul className="space-y-3">
          <li><strong className="text-fg">Взаимодействия:</strong> вуз, направление, продукт, договор, статус и ответственный — одной строкой.</li>
          <li><strong className="text-fg">Вузы:</strong> название, регион, ИНН, внешний идентификатор и комментарий.</li>
          <li><strong className="text-fg">ИТ-продукты:</strong> продукт, вендор, ИТ-направление и описание.</li>
          <li><strong className="text-fg">Контакты:</strong> вуз, ФИО, должность, email и телефон сотрудника вуза.</li>
        </ul>
      </GuideCard>

      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Как читать результаты проверки" />
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div>
            <h3 className="text-body-m font-medium text-success">Без замечаний</h3>
            <p className="mt-2 text-body-s text-fg-soft">Строка корректна и будет создана либо обновит найденную запись.</p>
          </div>
          <div>
            <h3 className="text-body-m font-medium text-warning">Предупреждение</h3>
            <p className="mt-2 text-body-s text-fg-soft">Строка будет записана, но её стоит проверить: например, значение распознано неоднозначно.</p>
          </div>
          <div>
            <h3 className="text-body-m font-medium text-error">Ошибка</h3>
            <p className="mt-2 text-body-s text-fg-soft">Такая строка будет пропущена; остальные корректные строки можно записать. Исправьте файл и загрузите его снова, если эти данные нужны.</p>
          </div>
        </div>
        <p className="mt-5 rounded-m bg-surface-3 px-3 py-3 text-body-s text-fg-soft"><strong className="text-fg">Важно:</strong> повторно загруженный файл не создаёт дубликаты найденных записей, а обновляет их. Пустые ячейки не стирают уже заполненные значения.</p>
      </section>
    </div>
  );
}

function ReportsGuide() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
      <section className="card card-pad">
        <CardHeader title="Как сформировать отчёт" sub="Отчёт всегда учитывает только карточки, доступные вашей роли." />
        <ol className="mt-5 grid gap-4 text-body-s text-fg-soft">
          <li><strong className="text-fg">1. Настройте отбор.</strong> Выберите период подписания лицензии, вуз, ИТ-направление, продукт и/или ответственного. Условия применяются сразу; кнопка «Сбросить отбор» возвращает полный список доступных данных.</li>
          <li><strong className="text-fg">2. Выберите колонки.</strong> По умолчанию включены вуз, направление, продукт, статус работы и ответственный. При необходимости добавьте номер договора, даты лицензии, срок или комментарий. В отчёте должна остаться хотя бы одна колонка.</li>
          <li><strong className="text-fg">3. Проверьте результат.</strong> В сводке видны число строк и вузов, карточки на маршруте, финальные этапы и лицензии с истекающим сроком. Таблица показывает первые 50 строк выбранного набора.</li>
          <li><strong className="text-fg">4. Посмотрите разрезы.</strong> Диаграммы отображают распределение по этапам, ИТ-направлениям и ответственным — по тому же отбору, что и таблица.</li>
          <li><strong className="text-fg">5. Скачайте файл.</strong> Выберите формат в блоке «Выгрузка» или используйте кнопку XLSX в шапке. В файл попадут все строки под отбором, а не только 50 строк предпросмотра.</li>
        </ol>
      </section>

      <GuideCard title="Форматы выгрузки">
        <ul className="space-y-3">
          <li><strong className="text-fg">XLS:</strong> для совместимости со старыми версиями Excel.</li>
          <li><strong className="text-fg">XLSX:</strong> таблица Excel с фильтрами — основной формат для дальнейшей работы.</li>
          <li><strong className="text-fg">PDF:</strong> для печати и согласования неизменяемого представления.</li>
          <li><strong className="text-fg">CSV:</strong> для Excel с русской локалью и 1С.</li>
          <li><strong className="text-fg">JSON:</strong> для загрузки в другую систему или интеграции.</li>
        </ul>
      </GuideCard>

      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Что означают показатели" />
        <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <Question question="Строк в отчёте" answer="Количество карточек, которые соответствуют текущему отбору." />
          <Question question="Вузов" answer="Число уникальных вузов в отобранных карточках; рядом указано число ответственных." />
          <Question question="На маршруте" answer="Карточки с запущенным процессом. Подпись показывает, сколько из них находится на финальном этапе." />
          <Question question="Лицензии истекают" answer="Карточки с близкой датой окончания лицензии; при наличии отдельно указывается число уже истёкших." />
        </dl>
      </section>

      <section className="card card-pad xl:col-span-2">
        <CardHeader title="Частые ситуации" />
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
          <Question question="Под отбор ничего не попало" answer="Расширьте период, снимите часть фильтров или сбросьте отбор. Пока строк нет, выгрузка недоступна." />
          <Question question="Нужной карточки нет в отчёте" answer="Проверьте фильтры и права доступа: пользователь видит только закреплённые за ним вузы." />
          <Question question="Статус работы и статус передачи различаются" answer="В отчёте «Статус работы с вузом» — текущий этап маршрута. «Статус передачи» — свободный текст, пришедший из каталога." />
          <Question question="Скачивание не началось" answer="Дождитесь уведомления «Файл сформирован» и проверьте папку загрузок браузера или его настройки скачивания." />
        </dl>
      </section>
    </div>
  );
}

export function AdminGuide() {
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

export function ArchitectureGuide() {
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
