import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { LanguageProvider } from '@/i18n';
import ProtectedRoute from '@/components/ProtectedRoute';
import EntitlementGate from '@/components/subscription/EntitlementGate';
import { useAuth } from '@/lib/AuthContext';

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
import AdminTestimonials from './pages/admin/AdminTestimonials';
import AdminMealItems from './pages/admin/AdminMealItems';
import AdminKitchens from './pages/admin/AdminKitchens';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminDailyPlans from './pages/admin/AdminDailyPlans';
import AdminPipeline from './pages/admin/AdminPipeline';
import AdminFoodDatabase from './pages/admin/AdminFoodDatabase';
import Exercise from './pages/Exercise';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

const AppRoutes = () => {
  const { subscriber } = useAuth();
  return (
    <Routes>
      {/* Public — reachable for anonymous visitors */}
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />

      {/* Subscriber app — requires authentication (+ onboarding gate inside AppLayout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<EntitlementGate subscriber={subscriber}><AppLayout /></EntitlementGate>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/meals" element={<Meals />} />
          <Route path="/shopping" element={<ShoppingList />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/content" element={<Content />} />
          <Route path="/group" element={<Group />} />
          <Route path="/exercise" element={<Exercise />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Admin — requires authentication + admin role (role gate inside AdminLayout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/subscribers" element={<AdminSubscribers />} />
          <Route path="/admin/groups" element={<AdminGroups />} />
          <Route path="/admin/meals" element={<AdminMeals />} />
          <Route path="/admin/content" element={<AdminContent />} />
          <Route path="/admin/testimonials" element={<AdminTestimonials />} />
          <Route path="/admin/meal-items" element={<AdminMealItems />} />
          <Route path="/admin/daily-plans" element={<AdminDailyPlans />} />
          <Route path="/admin/pipeline" element={<AdminPipeline />} />
          <Route path="/admin/food-database" element={<AdminFoodDatabase />} />
          <Route path="/admin/kitchens" element={<AdminKitchens />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
