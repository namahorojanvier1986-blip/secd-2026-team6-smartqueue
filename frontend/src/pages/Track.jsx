import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, myTicket } from '../api.js';
import { useApp } from '../i18n.jsx';

export default function Track() {
  const { t, error: errText } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('code');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const saved = myTicket.get();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tk =
        mode === 'code'
          ? await api(`/tickets/${encodeURIComponent(code.trim().toUpperCase())}`)
          : await api(`/tickets/lookup?phone=${encodeURIComponent(phone)}&number=${encodeURIComponent(number)}`);
      navigate(`/track/${tk.code}`);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{t('track.title')}</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        {t('track.lead')}
      </p>

      {saved && (
        <Link to={`/track/${saved}`} className="card card-pad row" style={{ marginTop: 20, color: 'inherit' }}>
          <span style={{ fontSize: '1.5rem' }}>🎫</span>
          <div>
            <b>{t('track.continue')}</b>
            <div className="subtle">{t('track.code', { code: saved })}</div>
          </div>
          <span className="spacer" />
          <span className="btn btn-primary btn-sm">{t('track.open')}</span>
        </Link>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="tabs" role="tablist" style={{ marginBottom: 20 }}>
          <button role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => setMode('code')}>
            {t('track.byCode')}
          </button>
          <button role="tab" aria-selected={mode === 'phone'} className={mode === 'phone' ? 'on' : ''} onClick={() => setMode('phone')}>
            {t('track.byPhone')}
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'code' ? (
            <div className="field">
              <label htmlFor="code">{t('track.codeLabel')}</label>
              <input
                id="code"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('track.codePlaceholder')}
                autoComplete="off"
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
                required
              />
            </div>
          ) : (
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="phone">{t('track.phoneLabel')}</label>
                <input id="phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="078 123 4567" required />
              </div>
              <div className="field">
                <label htmlFor="num">{t('track.numberLabel')}</label>
                <input id="num" className="input" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="006" required />
              </div>
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? t('track.searching') : t('track.find')}
          </button>
        </form>
      </div>

      <p className="subtle" style={{ marginTop: 16, textAlign: 'center' }}>
        {t('track.noTicket')} <Link to="/kiosk">{t('track.getOne')}</Link>
      </p>
    </div>
  );
}
