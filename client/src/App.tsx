import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from '@celebraitions/shared';
import { api, type User } from './api.js';
import { AuthPage, OnboardingPage } from './pages/AuthPages.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { PartyDetailPage } from './pages/PartyDetailPage.js';
import { ReportPage } from './pages/ReportPage.js';
import { WizardPage } from './pages/WizardPage.js';
import { CheckinPage, RsvpPage } from './pages/InvitePages.js';

export interface AuthContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading-screen"><span className="spinner" />Preparing your party hall…</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage setUser={setUser} />} />
        <Route path="/rsvp/:token" element={<RsvpPage />} />
        <Route element={<ProtectedLayout user={user} setUser={setUser} />}>
          <Route path="/" element={<HomeRedirect user={user} />} />
          <Route path="/onboarding" element={<OnboardingPage setUser={setUser} />} />
          <Route path="/dashboard" element={<DashboardPage user={user!} setUser={setUser} />} />
          <Route path="/party/new" element={<WizardPage />} />
          <Route path="/party/:id/edit" element={<WizardPage />} />
          <Route path="/party/:id" element={<PartyDetailPage />} />
          <Route path="/party/:id/report" element={<ReportPage />} />
          <Route path="/party/:id/checkin" element={<CheckinPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedLayout({ user, setUser }: AuthContextValue) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/dashboard')} aria-label={`${APP_NAME} home`}>
          <span className="brand-mark">✦</span>
          <span>{APP_NAME}</span>
        </button>
        <nav className="topnav" aria-label="Primary navigation">
          <button className="nav-link" onClick={() => navigate('/dashboard')}>Party hall</button>
          <button className="nav-link" onClick={() => navigate('/party/new')}>Plan a party</button>
          <span className="user-pill">{user.name.split(' ')[0]}</span>
          <button className="icon-button" onClick={logout} aria-label="Log out">↗</button>
        </nav>
      </header>
      <main id="main-content"><Outlet /></main>
    </div>
  );
}

function HomeRedirect({ user }: { user: User | null }) {
  return <Navigate to={user?.onboarded ? '/dashboard' : '/onboarding'} replace />;
}
