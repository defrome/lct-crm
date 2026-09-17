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
    <div className="min-h-dvh bg-page p-2 sm:p-4 lg:p-6">
      {/*
       * Сцена: мягкое свечение glow-a / glow-b вокруг рамки. Вход — момент бренда,
       * а не рабочий экран, поэтому свечение живёт только здесь.
       */}
      <div
        className="flex min-h-[calc(100dvh-1rem)] rounded-[calc(var(--crm-radius-frame)+16px)] p-2 sm:min-h-[calc(100dvh-2rem)] sm:p-[clamp(10px,3vw,48px)] lg:min-h-[calc(100dvh-3rem)]"
        style={{
          background:
            'radial-gradient(60% 80% at 0% 0%, var(--crm-glow-a), transparent 70%), radial-gradient(60% 90% at 100% 100%, var(--crm-glow-b), transparent 70%), color-mix(in srgb, var(--crm-glow-a) 50%, var(--crm-glow-b))',
        }}
      >
        <div className="grid w-full gap-4 rounded-frame bg-frame p-4 shadow-bottom-xl sm:p-[clamp(16px,2.2vw,32px)] lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <section className="flex flex-col">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="leading-tight">
                <span className="block text-h3 font-bold text-fg">CRM ИТ Школы</span>
                <span className="block text-body-s text-fg-muted">Ростелеком</span>
              </span>
            </div>

            <h1 className="page-title mt-10 max-w-[16ch] lg:mt-16">
              Путь вуза от первого контакта до занятий
            </h1>
            <p className="mt-4 max-w-[48ch] text-body-l text-fg-muted">
              Вузы, ИТ-продукты, договоры и лицензии — в одном месте. Каждая карточка идёт по
              маршруту из 14 шагов, с историей и файлами на каждом.
            </p>

            <div className="card card-pad mt-8 hidden lg:mt-auto lg:block">
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

          <section className="card flex items-center justify-center p-6 sm:p-10">
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
        </div>
      </div>
    </div>
  );
}
