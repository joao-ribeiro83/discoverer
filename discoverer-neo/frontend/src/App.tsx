import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'

// Admin/maps/schedules pages are code-split — they pull in heavy per-page
// deps (TanStack Table, dnd-kit, Monaco for the map builder) that dashboard
// and login visitors shouldn't have to download up front.
const BusinessAreasPage = lazy(() =>
  import('@/pages/BusinessAreasPage').then((m) => ({ default: m.BusinessAreasPage })),
)
const FoldersPage = lazy(() => import('@/pages/FoldersPage').then((m) => ({ default: m.FoldersPage })))
const ItemsPage = lazy(() => import('@/pages/ItemsPage').then((m) => ({ default: m.ItemsPage })))
const JoinsPage = lazy(() => import('@/pages/JoinsPage').then((m) => ({ default: m.JoinsPage })))
const HierarchiesPage = lazy(() =>
  import('@/pages/HierarchiesPage').then((m) => ({ default: m.HierarchiesPage })),
)
const CustomFunctionsPage = lazy(() =>
  import('@/pages/CustomFunctionsPage').then((m) => ({ default: m.CustomFunctionsPage })),
)
const DataSourcesPage = lazy(() =>
  import('@/pages/DataSourcesPage').then((m) => ({ default: m.DataSourcesPage })),
)
const UsersPage = lazy(() => import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const MapsListPage = lazy(() => import('@/pages/MapsListPage').then((m) => ({ default: m.MapsListPage })))
const MapBuilderPage = lazy(() =>
  import('@/pages/MapBuilderPage').then((m) => ({ default: m.MapBuilderPage })),
)
const MapViewerPage = lazy(() =>
  import('@/pages/MapViewerPage').then((m) => ({ default: m.MapViewerPage })),
)
const SchedulesPage = lazy(() => import('@/pages/SchedulesPage').then((m) => ({ default: m.SchedulesPage })))
const MigrationPage = lazy(() =>
  import('@/pages/MigrationPage').then((m) => ({ default: m.MigrationPage })),
)

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="admin">
          <Route path="business-areas" element={<BusinessAreasPage />} />
          <Route path="folders" element={<FoldersPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="joins" element={<JoinsPage />} />
          <Route path="hierarchies" element={<HierarchiesPage />} />
          <Route path="custom-functions" element={<CustomFunctionsPage />} />
          <Route path="data-sources" element={<DataSourcesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="migration" element={<MigrationPage />} />
        </Route>
        <Route path="maps">
          <Route index element={<MapsListPage />} />
          <Route path=":id" element={<MapBuilderPage />} />
          <Route path=":id/view" element={<MapViewerPage />} />
        </Route>
        <Route path="schedules" element={<SchedulesPage />} />
      </Route>
    </Routes>
  )
}
