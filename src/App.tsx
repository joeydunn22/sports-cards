import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { CollectionPage } from './features/cards/CollectionPage'
import { EditCardPage } from './features/cards/EditCardPage'
import { NewCardPage } from './features/cards/NewCardPage'
import { ImportExportPage } from './features/import-export/ImportExportPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <RequireAuth>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<CollectionPage />} />
                <Route path="/cards/new" element={<NewCardPage />} />
                <Route path="/cards/:id" element={<EditCardPage />} />
                <Route path="/import-export" element={<ImportExportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </RequireAuth>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
