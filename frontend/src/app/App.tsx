import { QueryClientProvider } from '@tanstack/react-query';
import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/app/AuthProvider';
import { ThemeProvider } from '@/app/ThemeProvider';
import { ToastProvider } from '@/app/ToastProvider';
import { queryClient } from '@/app/queryClient';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { LoginPage } from '@/features/auth/LoginPage';
import type { UserRole } from '@/api/types';

// Screens are split per route: the dashboard's charting library and the report
// builder's spreadsheet writer should not be in the bundle that paints the
// sign-in form.
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const InteractionsPage = lazy(() =>
  import('@/features/interactions/InteractionsPage').then((m) => ({ default: m.InteractionsPage })),
);
const InteractionDetailPage = lazy(() =>
  import('@/features/interactions/InteractionDetailPage').then((m) => ({
    default: m.InteractionDetailPage,
  })),
);
const UniversitiesPage = lazy(() =>
  import('@/features/universities/UniversitiesPage').then((m) => ({ default: m.UniversitiesPage })),
);
const UniversityDetailPage = lazy(() =>
  import('@/features/universities/UniversityDetailPage').then((m) => ({
    default: m.UniversityDetailPage,
  })),
);
const CatalogsPage = lazy(() =>
  import('@/features/catalogs/CatalogsPage').then((m) => ({ default: m.CatalogsPage })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const WorkflowsPage = lazy(() =>
  import('@/features/workflows/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })),
);
const WorkflowDetailPage = lazy(() =>
  import('@/features/workflows/WorkflowDetailPage').then((m) => ({
    default: m.WorkflowDetailPage,
  })),
);
const ImportsPage = lazy(() =>
  import('@/features/imports/ImportsPage').then((m) => ({ default: m.ImportsPage })),
);
const ImportWizardPage = lazy(() =>
  import('@/features/imports/ImportWizardPage').then((m) => ({ default: m.ImportWizardPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/AuditPage').then((m) => ({ default: m.AuditPage })),
);

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <Gate />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-page">
        <Spinner className="size-6 text-fg-muted" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />

        <Route path="interactions" element={<InteractionsPage />} />
        <Route path="interactions/:id" element={<InteractionDetailPage />} />

        <Route path="universities" element={<UniversitiesPage />} />
        <Route path="universities/:id" element={<UniversityDetailPage />} />

        <Route path="catalogs" element={<CatalogsPage />} />
        <Route path="catalogs/:tab" element={<CatalogsPage />} />

        <Route path="reports" element={<ReportsPage />} />

        <Route path="workflows" element={<WorkflowsPage />} />
        <Route path="workflows/:id" element={<WorkflowDetailPage />} />

        {/*
         * Импорт целиком закрыт для КАМа: все мутирующие ручки бэкенда
         * защищены require_manager, и без этой преграды пользователь проходил
         * весь визард с разметкой колонок, чтобы получить 403 на последнем шаге.
         */}
        <Route
          path="imports"
          element={
            <RequireRole role="manager">
              <ImportsPage />
            </RequireRole>
          }
        />
        <Route
          path="imports/new"
          element={
            <RequireRole role="manager">
              <ImportWizardPage />
            </RequireRole>
          }
        />
        <Route
          path="imports/:jobId"
          element={
            <RequireRole role="manager">
              <ImportWizardPage />
            </RequireRole>
          }
        />

        <Route
          path="users"
          element={
            <RequireRole role="manager">
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole role="admin">
              <AuditPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** Keeps a screen out of reach of a role that the API would refuse anyway. */
function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(role)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <EmptyState
          icon="alert"
          title="Раздел закрыт для вашей роли"
          message="Доступ выдаёт администратор ИТ Школы."
        />
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <EmptyState
        icon="search"
        title="Страница не найдена"
        message="Проверьте адрес или вернитесь к обзору."
      />
    </div>
  );
}
