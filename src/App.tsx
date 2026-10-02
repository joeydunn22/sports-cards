import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { CollectionPage } from './features/cards/CollectionPage'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <RequireAuth>
          <Routes>
            <Route path="/" element={<CollectionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RequireAuth>
      </HashRouter>
    </AuthProvider>
  )
}
