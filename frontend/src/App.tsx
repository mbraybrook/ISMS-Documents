import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StaffOnlyRoute } from './components/StaffOnlyRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { DocumentsPage } from './pages/DocumentsPage'
import { AcknowledgmentPage } from './pages/AcknowledgmentPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { RisksPage } from './pages/RisksPage'
import { DepartmentRiskTable } from './components/DepartmentRiskTable'
import { RiskReviewQueue } from './components/RiskReviewQueue'
import { ControlsPage } from './pages/ControlsPage'
import { SoAPage } from './pages/SoAPage'
import { MassImportPage } from './pages/MassImportPage'
import { AssetsPage } from './pages/AssetsPage'
import { AssetCategoriesPage } from './pages/AssetCategoriesPage'
import { InterestedPartiesPage } from './pages/InterestedPartiesPage'
import { LegislationPage } from './pages/LegislationPage'
import { StaffHomePage } from './pages/StaffHomePage'
import { StaffAcknowledgmentPage } from './pages/StaffAcknowledgmentPage'
import { StaffDocumentsPage } from './pages/StaffDocumentsPage'
import { UnauthorizedPage } from './pages/UnauthorizedPage'
import { UsersPage } from './pages/UsersPage'
import { TrustAuthProvider } from './contexts/TrustAuthContext'
import { TrustCenterPage } from './pages/TrustCenterPage'
import { TrustCenterLoginPage } from './pages/TrustCenterLoginPage'
import { TrustCenterAdminPage } from './pages/TrustCenterAdminPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Trust Center routes - public-facing, separate auth context */}
          <Route
            path="/"
            element={
              <TrustAuthProvider>
                <TrustCenterPage />
              </TrustAuthProvider>
            }
          />
          <Route
            path="/login"
            element={
              <TrustAuthProvider>
                <TrustCenterLoginPage />
              </TrustAuthProvider>
            }
          />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          
          {/* ISMS Admin routes - all under /admin prefix */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents/documents"
            element={
              <ProtectedRoute>
                <Layout>
                  <DocumentsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents/documents/import"
            element={
              <ProtectedRoute requiredRole="EDITOR">
                <Layout>
                  <MassImportPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents/acknowledgments"
            element={
              <ProtectedRoute>
                <Layout>
                  <AcknowledgmentPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/documents/reviews"
            element={
              <ProtectedRoute>
                <Layout>
                  <ReviewsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/risks"
            element={
              <ProtectedRoute>
                <Layout>
                  <RisksPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/department"
            element={
              <ProtectedRoute requiredRole="CONTRIBUTOR">
                <Layout>
                  <DepartmentRiskTable />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/review"
            element={
              <ProtectedRoute>
                <Layout>
                  <RiskReviewQueue />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/controls"
            element={
              <ProtectedRoute>
                <Layout>
                  <ControlsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/soa"
            element={
              <ProtectedRoute>
                <Layout>
                  <SoAPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assets/assets"
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assets/asset-categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <AssetCategoriesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/interested-parties"
            element={
              <ProtectedRoute>
                <Layout>
                  <InterestedPartiesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/risks/legislation"
            element={
              <ProtectedRoute>
                <Layout>
                  <LegislationPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/trust"
            element={
              <ProtectedRoute requiredRole="EDITOR">
                <Layout>
                  <TrustCenterAdminPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* Staff-only routes */}
          <Route
            path="/admin/staff"
            element={
              <StaffOnlyRoute>
                <Layout>
                  <StaffHomePage />
                </Layout>
              </StaffOnlyRoute>
            }
          />
          <Route
            path="/admin/staff/acknowledgments"
            element={
              <StaffOnlyRoute>
                <Layout>
                  <StaffAcknowledgmentPage />
                </Layout>
              </StaffOnlyRoute>
            }
          />
          <Route
            path="/admin/staff/documents"
            element={
              <StaffOnlyRoute>
                <Layout>
                  <StaffDocumentsPage />
                </Layout>
              </StaffOnlyRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

