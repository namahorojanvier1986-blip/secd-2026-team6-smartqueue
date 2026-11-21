import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout, { Loading } from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Kiosk from './pages/Kiosk.jsx';
import Track from './pages/Track.jsx';
import TicketStatus from './pages/TicketStatus.jsx';
import Display from './pages/Display.jsx';
import StaffLogin from './pages/StaffLogin.jsx';
import Teller from './pages/Teller.jsx';
import Admin from './pages/Admin.jsx';
import Setup from './pages/Setup.jsx';
import { getSession } from './api.js';
import { useApp } from './i18n.jsx';

function RequireStaff({ role, children }) {
  const session = getSession();
  if (!session?.token) return <Navigate to="/staff/login" replace />;
  if (role && session.user.role !== role) return <Navigate to="/staff/teller" replace />;
  return children;
}

export default function App() {
  const { info, infoError, t } = useApp();
  const location = useLocation();

  if (!info && !infoError) return <Loading />;
  if (!info && infoError) {
    return (
      <div className="center-box" style={{ minHeight: '100vh' }}>
        <div className="alert alert-error">{t('err.NETWORK')}</div>
        <button className="btn" onClick={() => window.location.reload()}>
          ↻
        </button>
      </div>
    );
  }

  // First run: the institution must be set up before anything else
  if (info.setupRequired && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
  if (!info.setupRequired && location.pathname === '/setup') return <Navigate to="/staff/login" replace />;

  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      {/* Full-screen views for devices in the banking hall */}
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/display" element={<Display />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:code" element={<TicketStatus />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route
          path="/staff/teller"
          element={
            <RequireStaff>
              <Teller />
            </RequireStaff>
          }
        />
        <Route
          path="/staff/admin"
          element={
            <RequireStaff role="admin">
              <Admin />
            </RequireStaff>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  const { t } = useApp();
  return (
    <div className="center-box">
      <h2>{t('notFound.title')}</h2>
      <a className="btn btn-primary" href="/">
        {t('notFound.home')}
      </a>
    </div>
  );
}
