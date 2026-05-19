import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./app/layout/AppLayout";
import ProtectedRoute from "./app/routes/ProtectedRoute";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./features/auth/context/AuthContext";
import LoginPage from "./features/auth/pages/LoginPage";
import CreateLeadPage from "./pages/app/CreateLeadPage";
import DashboardPage from "./pages/app/DashboardPage";
import EditLeadPage from "./pages/app/EditLeadPage";
import LeadDetailPage from "./pages/app/LeadDetailPage";
import LeadsPage from "./pages/app/LeadsPage";
import ReportsPage from "./pages/app/ReportsPage";
import UsersPage from "./pages/app/UsersPage";
import SettingsPage from "./pages/app/SettingsPage";
import LandingPage from "./pages/marketing/LandingPage";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="leads"
              element={<LeadsPage />}
            />
            <Route path="leads/new" element={<CreateLeadPage />} />
            <Route path="leads/:id/edit" element={<EditLeadPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route path="pipeline" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="reportes" element={<ReportsPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
