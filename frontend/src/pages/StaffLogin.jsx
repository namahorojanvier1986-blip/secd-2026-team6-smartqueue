import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';
import { useApp } from '../i18n.jsx';

export default function StaffLogin() {
  const { t, info, error: errText } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api('/auth/login', { method: 'POST', body: { username, password } });
      setSession(session);
      navigate(session.user.role === 'admin' ? '/staff/admin' : '/staff/teller');
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card card-pad login-card">
        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: '1.4rem', marginBottom: 16 }}>
          Q
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('login.title')}</h1>
        <p className="muted" style={{ margin: '6px 0 22px' }}>
          {info?.institutionName} · {t('login.sub')}
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="u">{t('login.username')}</label>
            <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="p">{t('login.password')}</label>
            <input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
