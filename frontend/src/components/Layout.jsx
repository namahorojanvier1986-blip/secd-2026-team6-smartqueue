import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getSession, setSession } from '../api.js';
import { LanguageSwitcher, useApp } from '../i18n.jsx';

/** Header brand: the institution's own name, with "SmartQueue" as the product line. */
export function Brand({ subtitle, to = '/' }) {
  const { info, t } = useApp();
  const name = info?.institutionName || t('brand.product');
  const sub = subtitle ?? (info?.branchName ? `${info.branchName} · SmartQueue` : 'SmartQueue');
  return (
    <Link to={to} className="brand" aria-label={name}>
      <span className="brand-mark">Q</span>
      <span>
        {name}
        <small>{sub}</small>
      </span>
    </Link>
  );
}

/** "Back to home" button shown on every page except the home page. */
export function BackHome({ light = false }) {
  const { t } = useApp();
  return (
    <Link to="/" className={`back-home${light ? ' back-home-light' : ''}`}>
      <span aria-hidden="true">←</span> {t('nav.backHome')}
    </Link>
  );
}

export default function Layout() {
  const session = getSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useApp();

  const logout = () => {
    setSession(null);
    navigate('/staff/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand subtitle={session ? `${session.user.fullName} · ${t(`role.${session.user.role}`)}` : undefined} />
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/kiosk">{t('nav.kiosk')}</NavLink>
            <NavLink to="/track">{t('nav.track')}</NavLink>
            <NavLink to="/display">{t('nav.display')}</NavLink>
            {session ? (
              <>
                <NavLink to="/staff/teller">{t('nav.counter')}</NavLink>
                {session.user.role === 'admin' && <NavLink to="/staff/admin">{t('nav.admin')}</NavLink>}
                <a href="#logout" onClick={(e) => (e.preventDefault(), logout())}>
                  {t('nav.signOut')}
                </a>
              </>
            ) : (
              <NavLink to="/staff/login">{t('nav.staff')}</NavLink>
            )}
          </nav>
          <LanguageSwitcher />
        </div>
        <div className="flag-stripe" />
      </header>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {pathname !== '/' && (
          <div className="back-bar">
            <BackHome />
          </div>
        )}
        <Outlet />
      </main>
      <footer className="footer">SmartQueue · {t('footer')}</footer>
    </div>
  );
}

export function Loading({ label }) {
  const app = useApp();
  return (
    <div className="center-box" role="status">
      <div className="spinner" />
      <span>{label || app?.t('loading') || 'Loading…'}</span>
    </div>
  );
}

export function StatusBadge({ status }) {
  const { t } = useApp();
  return <span className={`badge badge-${status}`}>{t(`status.${status}`)}</span>;
}

export function PriorityBadge({ reason }) {
  const { t } = useApp();
  return <span className="badge badge-priority">★ {reason ? `${t('priority')} · ${t(`reason.${reason}`)}` : t('priority')}</span>;
}
