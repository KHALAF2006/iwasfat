import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Public pages
import Landing from './pages/Landing';
import Register from './pages/Register';

// App pages
import AppLayout from './components/app/AppLayout';
import Dashboard from './pages/Dashboard';
import Meals from './pages/Meals';
import ShoppingList from './pages/ShoppingList';
import Scanner from './pages/Scanner';
import Progress from './pages/Progress';
import Content from './pages/Content';
import Group from './pages/Group';
import Profile from './pages/Profile';

// Admin pages
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSubscribers from './pages/admin/AdminSubscribers';
import AdminGroups from './pages/admin/AdminGroups';
import AdminMeals from './pages/admin/AdminMeals';
import AdminContent from './pages/admin/AdminContent';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />

      {/* Subscriber app */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meals" element={<Meals />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/content" element={<Content />} />
        <Route path="/group" element={<Group />} />
      </Route>
      <Route path="/profile" element={<Profile />} />

      {/* Admin */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/subscribers" element={<AdminSubscribers />} />
        <Route path="/admin/groups" element={<AdminGroups />} />
        <Route path="/admin/meals" element={<AdminMeals />} />
        <Route path="/admin/content" element={<AdminContent />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App