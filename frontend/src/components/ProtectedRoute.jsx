import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthPage from '../pages/AuthPage';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // optional spinner
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return children;
}