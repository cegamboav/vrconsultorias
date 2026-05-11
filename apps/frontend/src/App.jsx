import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./app/layout/AppLayout";
import ProtectedRoute from "./app/routes/ProtectedRoute";
import { AuthProvider } from "./features/auth/context/AuthContext";
import LoginPage from "./features/auth/pages/LoginPage";
import CreateLeadPage from "./pages/app/CreateLeadPage";
import LeadDetailPage from "./pages/app/LeadDetailPage";
import LeadsPage from "./pages/app/LeadsPage";
import PlaceholderPage from "./pages/app/PlaceholderPage";

export default function App() {
  return (
    <AuthProvider>
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
            <Route
              path="dashboard"
              element={
                <PlaceholderPage
                  title="Dashboard"
                  description="Resumen operativo y métricas clave. Contenido próximo."
                />
              }
            />
            <Route
              path="leads"
              element={<LeadsPage />}
            />
            <Route path="leads/new" element={<CreateLeadPage />} />
            <Route path="leads/:id" element={<LeadDetailPage />} />
            <Route
              path="pipeline"
              element={
                <PlaceholderPage
                  title="Pipeline"
                  description="Vista del flujo comercial guiado. Contenido próximo."
                />
              }
            />
            <Route
              path="reportes"
              element={
                <PlaceholderPage
                  title="Reportes"
                  description="Indicadores de conversión y seguimiento. Contenido próximo."
                />
              }
            />
          </Route>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
