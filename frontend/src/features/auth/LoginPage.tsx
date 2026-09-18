import { useState } from 'react';

import { useAuth } from '@/app/AuthProvider';
import { BrandMark } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';

const PROCESS = [
  'Поиск контактов в вузе',
  'Уточнение программ',
  'Встреча с вузом',
  'Обмен документами',
  'Корректировка',
  'Подписание',
  'Передача лицензии',
  'Сопровождение внедрения',
  'Обучение преподавателей',
  'Актуализация программы',
  'Ведение занятий',
  'Актуализация документации',
  'Повышение квалификации',
  'Контроль исполнения',
];

export function LoginPage() {
  const { signIn, authError } = useAuth();
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh min-w-0 grid-rows-[auto_1fr] bg-frame lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-none">
      <section className="flex min-w-0 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-10 lg:px-12 lg:py-12 xl:px-16">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="leading-tight">
            <span className="block text-h3 font-bold text-fg">CRM IT School</span>
            <span className="block text-body-s text-fg-muted">Rostelecom</span>
          </span>
        </div>
        <h1 className="page-title mt-16 hidden max-w-[16ch] lg:block">
          Университеты, контакты и рабочие маршруты в одном месте
        </h1>
        <p className="mt-4 hidden max-w-[48ch] text-body-l text-fg-muted lg:block">
          Войдите через корпоративный Keycloak, чтобы продолжить работу с CRM.
        </p>
        <div className="mt-12 hidden border-t border-line-soft pt-6 lg:mt-auto lg:block">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="card-title">Базовый процесс</h2>
            <span className="text-body-s text-fg-muted">WF-BASE · 14 шагов</span>
          </div>
          <ol className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {PROCESS.map((step, index) => (
              <li key={step} className="flex min-w-0 items-center gap-3">
                <span className="tnum grid h-6 min-w-8 place-items-center rounded-xs bg-s01-container px-1.5 text-desc font-medium text-s01 dark:text-s01-200">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="truncate text-body-s text-fg-soft">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="flex min-w-0 items-start justify-center px-5 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 lg:items-center lg:border-l lg:border-line-soft lg:bg-card lg:px-12 lg:py-12 xl:px-16">
        <div className="animate-rise w-full max-w-[24rem]">
          <h2 className="text-h1 font-bold text-fg">Вход в систему</h2>
          <p className="mt-2 text-body-m text-fg-muted">
            Авторизация выполняется на защищённой странице Keycloak.
          </p>
          {authError && <p className="mt-6 text-body-s text-error">{authError}</p>}
          <Button
            type="button"
            variant="primary"
            size="xl"
            loading={busy}
            className="mt-8 w-full"
            onClick={() => void onSignIn()}
          >
            Войти через Keycloak
          </Button>
          <p className="mt-6 text-body-s text-fg-muted">
            Доступ и видимые данные определяются ролью вашей учётной записи.
          </p>
        </div>
      </section>
    </main>
  );
}
