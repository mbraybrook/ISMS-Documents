import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { DocumentsPage } from './pages/DocumentsPage'
import { AcknowledgmentPage } from './pages/AcknowledgmentPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { RisksPage } from './pages/RisksPage'
import { ControlsPage } from './pages/ControlsPage'
import { SoAPage } from './pages/SoAPage'
import { MassImportPage } from './pages/MassImportPage'
import { AssetsPage } from './pages/AssetsPage'
import { AssetCategoriesPage } from './pages/AssetCategoriesPage'
import { InterestedPartiesPage } from './pages/InterestedPartiesPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/documents"
            element={
              <ProtectedRoute>
                <Layout>
                  <DocumentsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/documents/import"
            element={
              <ProtectedRoute requiredRole="EDITOR">
                <Layout>
                  <MassImportPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/acknowledgments"
            element={
              <ProtectedRoute>
                <Layout>
                  <AcknowledgmentPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/reviews"
            element={
              <ProtectedRoute>
                <Layout>
                  <ReviewsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/risks/risks"
            element={
              <ProtectedRoute>
                <Layout>
                  <RisksPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/risks/controls"
            element={
              <ProtectedRoute>
                <Layout>
                  <ControlsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/soa"
            element={
              <ProtectedRoute>
                <Layout>
                  <SoAPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets/assets"
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets/asset-categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetCategoriesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/risks/interested-parties"
            element={
              <ProtectedRoute>
                <Layout>
                  <InterestedPartiesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

