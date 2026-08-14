import { AdminAuthProvider, useAdminAuth } from './lib/AdminAuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import './App.css';

function AppContent() {
  const { session, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return <div className="login-screen">Loading...</div>;
  }

  if (!session || !isAdmin) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <AppContent />
    </AdminAuthProvider>
  );
}
