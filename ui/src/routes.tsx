import { createMemoryRouter, Navigate } from 'react-router-dom';
import App from './App';
import { Login } from '@/components/Login';
import { LogsPage } from '@/pages/LogsPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';

export const router = createMemoryRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <PublicRoute><Login /></PublicRoute>,
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><App /></ProtectedRoute>,
  },
  {
    path: '/logs',
    element: <ProtectedRoute><LogsPage /></ProtectedRoute>,
  },
], {
  initialEntries: ['/dashboard']
});