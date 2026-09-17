import { useState, type FormEvent } from 'react';

import { AuthError } from '@/api/auth';
import { useAuth } from '@/app/AuthProvider';
import { BrandMark } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';

/** 14 шагов WF-BASE, как в ТЗ, — процесс, ради которого существует CRM. */
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
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (caught) {
      setError(
        caught instanceof AuthError ? caught.message : 'Не удалось войти. Попробуйте ещё раз.',
      );
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh min-w-0 grid-rows-[auto_1fr] bg-frame lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:grid-rows-none">
          <section className="flex min-w-0 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] sm:px-10 lg:px-12 lg:py-12 xl:px-16">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="leading-tight">
                <span className="block text-h3 font-bold text-fg">CRM ИТ Школы</span>
                <span className="block text-body-s text-fg-muted">Ростелеком</span>
              </span>
            </div>

            <h1 className="page-title mt-16 hidden max-w-[16ch] lg:block">
              Путь вуза от первого контакта до занятий
            </h1>
            <p className="mt-4 hidden max-w-[48ch] text-body-l text-fg-muted lg:block">
              Вузы, ИТ-продукты, договоры и лицензии — в одном месте. Каждая карточка идёт по
              маршруту из 14 шагов, с историей и файлами на каждом.
            </p>

            <div className="mt-12 hidden border-t border-line-soft pt-6 lg:mt-auto lg:block">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="card-title">Базовый процесс</h2>
                <span className="text-body-s text-fg-muted">WF-BASE · 14 шагов</span>
              </div>
              <ol className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5">
                {PROCESS.map((step, index) => (
                  <li
                    key={step}
                    className="animate-rise flex min-w-0 items-center gap-3"
                    style={{ animationDelay: `${120 + index * 40}ms` }}
                  >
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
                Учётная запись Keycloak ИТ Школы. Данные, которые вы увидите, зависят от роли.
              </p>

              <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
                <TextInput
                  label="Логин"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  icon="users"
                  placeholder="например, kc-manager"
                />
                <TextInput
                  label="Пароль"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  error={error}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  loading={busy}
                  disabled={!username || !password}
                  className="mt-2 w-full"
                >
                  Войти
                </Button>
              </form>

              <p className="mt-6 text-body-s text-fg-muted">
                Забыли пароль или нет учётной записи — обратитесь к администратору ИТ Школы.
              </p>
            </div>
          </section>
    </main>
  );
}
