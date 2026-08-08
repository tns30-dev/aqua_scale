import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { DigitalTwinPage } from "./pages/DigitalTwinPage";
import { ForecastPage } from "./pages/ForecastPage";
import { HistoricalDataPage } from "./pages/HistoricalDataPage";
import { EnergyConsumptionPage } from "./pages/EnergyConsumptionPage";
import { EnergyHubPage } from "./pages/EnergyHubPage";
import { FeedingGrowthPage } from "./pages/FeedingGrowthPage";
import { TreatmentsPage } from "./pages/TreatmentsPage";
import { PondComparisonPage } from "./pages/PondComparisonPage";
import { useGlobalWebSocket } from "./hooks/useGlobalWebSocket";
import { ProfileProvider } from "./context/ProfileContext";
import { AlertsProvider } from "./context/AlertsContext";
import { SessionProvider, useSession } from "./context/SessionContext";
import { UsersPage } from "./pages/UsersPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  // Wait for /api/auth/me to resolve before redirecting — otherwise a logged-in
  // user briefly flashes to /login on hard refresh.
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isPlatformAdmin, loading } = useSession();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isPlatformAdmin) return <Navigate to="/overview" />;
  return <>{children}</>;
}

function AppContent() {
  // Initialize global WebSocket connections
  useGlobalWebSocket();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/overview"
        element={
          <ProtectedRoute>
            <OverviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/digital-twin"
        element={
          <ProtectedRoute>
            <DigitalTwinPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/real-time"
        element={
          <ProtectedRoute>
            <ForecastPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/historical"
        element={
          <ProtectedRoute>
            <HistoricalDataPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/energy"
        element={
          <ProtectedRoute>
            <EnergyHubPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/energy/electricity"
        element={
          <ProtectedRoute>
            <EnergyConsumptionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treatments"
        element={
          <ProtectedRoute>
            <TreatmentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/feeding-growth"
        element={
          <ProtectedRoute>
            <FeedingGrowthPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pond-comparison"
        element={
          <ProtectedRoute>
            <PondComparisonPage />
          </ProtectedRoute>
        }
      />

      {/* User Management sub-pages (admin only) */}
      <Route
        path="/user-management"
        element={
          <AdminRoute>
            <Navigate to="/user-management/users" replace />
          </AdminRoute>
        }
      />
      <Route
        path="/user-management/users"
        element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        }
      />

      <Route path="/" element={<Navigate to="/overview" />} />
      <Route path="*" element={<Navigate to="/overview" />} />
    </Routes>
  );
}

function App() {
  return (
    <SessionProvider>
      <ProfileProvider>
        <AlertsProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AlertsProvider>
      </ProfileProvider>
    </SessionProvider>
  );
}

export default App;
