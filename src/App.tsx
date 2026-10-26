import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { CollectionPage } from './features/cards/CollectionPage'
import { EditCardPage } from './features/cards/EditCardPage'
import { NewCardPage } from './features/cards/NewCardPage'
import { PhotoEditorPage } from './features/cards/PhotoEditorPage'
import { MorePage } from './features/more/MorePage'
import { TouchUpPage } from './features/photos/TouchUpPage'
import { CapturePage } from './features/scan/CapturePage'
import { ReviewScanPage } from './features/scan/ReviewScanPage'
import { ScanPage } from './features/scan/ScanPage'
import { SetDetailPage } from './features/sets/SetDetailPage'
import { SetsPage } from './features/sets/SetsPage'

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
                <Route path="/cards/:id/photo/:side" element={<PhotoEditorPage />} />
                <Route path="/scan" element={<ScanPage />} />
                <Route path="/scan/new" element={<CapturePage />} />
                <Route path="/scan/:id" element={<ReviewScanPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/photos/touch-up" element={<TouchUpPage />} />
                <Route path="/sets" element={<SetsPage />} />
                <Route path="/sets/:year/:set" element={<SetDetailPage />} />
                <Route path="/import-export" element={<Navigate to="/more" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </RequireAuth>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
