import { MantineProvider } from '@mantine/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SubgraphsPage } from './pages/SubgraphsPage';
import { StatusPage } from './pages/StatusPage';
import { UserPage } from './pages/UserPage';
import { RolesPage } from './pages/RolesPage';
import '@mantine/core/styles.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
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
        path="/subgraphs"
        element={
          <ProtectedRoute>
            <Layout>
              <SubgraphsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/status"
        element={
          <ProtectedRoute>
            <Layout>
              <StatusPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/user"
        element={
          <ProtectedRoute>
            <Layout>
              <UserPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute>
            <Layout>
              <RolesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppContent() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  const { theme, colorScheme } = useTheme();

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <AuthProvider>
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </MantineProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

