import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';
import { formatTime, useClock, usePolling } from '../hooks.js';
import { BackHome, Loading, PriorityBadge } from '../components/Layout.jsx';
import { LanguageSwitcher, useApp } from '../i18n.jsx';

const REASONS = [
  { id: 'pregnant', icon: '🤰' },
  { id: 'elderly', icon: '🧓' },
  { id: 'disability', icon: '♿' },
];

const RESET_AFTER_SECONDS = 45;

const formatPhone = (d) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');

export default function Kiosk() {
  const { t, svc, svcDesc, wait, date, notif, error: errText, lang, info } = useApp();
  const now = useClock();
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [digits, setDigits] = useState('');
  const [priority, setPriority] = useState(false);
  const [reason, setReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [existing, setExisting] = useState(null);
  const [countdown, setCountdown] = useState(RESET_AFTER_SECONDS);

  const services = usePolling(() => api('/services'), 10000);

  const reset = () => {
    setStep(1);
    setService(null);
    setDigits('');
    setPriority(false);
    setReason(null);
    setError(null);
    setTicket(null);
    setExisting(null);
  };

  // Return to the start screen automatically after a ticket is shown
  useEffect(() => {
    if (step !== 3) return;
    setCountdown(RESET_AFTER_SECONDS);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          reset();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  // Physical keyboard support on the phone step
  useEffect(() => {
    if (step !== 2) return;
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const press = (k) => {
    setError(null);
    if (k === 'back') setDigits((d) => d.slice(0, -1));
    else if (k === 'clear') setDigits('');
    else setDigits((d) => (d.length >= 10 ? d : d + k));
  };

  const phoneValid = /^07[2389]\d{7}$/.test(digits);

  async function submit() {
    if (submitting) return;
    if (!phoneValid) return setError(t('kiosk.phoneInvalid'));
    if (priority && !reason) return setError(t('err.PRIORITY_REASON'));
    setSubmitting(true);
    setError(null);
    try {
      const tk = await api('/tickets', {
        method: 'POST',
        body: { phone: digits, serviceId: service.id, isPriority: priority, priorityReason: priority ? reason : null, language: lang },
      });
      setTicket(tk);
      setStep(3);
      services.refresh();
    } catch (e) {
      if (e.status === 409 && e.data?.code) setExisting(e.data);
      setError(errText(e));
    } finally {
      setSubmitting(false);
    }
  }

  const trackUrl = (code) => `${window.location.origin}/track/${code}`;
  const firstMessage = ticket?.notifications?.[0] ? notif(ticket.notifications[0]).message : '';

  return (
    <div className="kiosk">
      <header className="kiosk-header">
        <Link to="/" className="brand" style={{ color: '#fff' }}>
          <span className="brand-mark">Q</span>
          <span>
            {info?.institutionName}
            <small>{info?.branchName ? `${info.branchName} · ${t('kiosk.sub')}` : t('kiosk.sub')}</small>
          </span>
        </Link>
        <BackHome light />
        <div className="clock tabular">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          <small>{date(now)}</small>
        </div>
      </header>

      <div className="kiosk-title">
        <div className="steps" aria-hidden="true">
          {[1, 2, 3].map((s) => (
            <span key={s} className={step >= s ? 'on' : ''} />
          ))}
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            {step === 1 && (
              <>
                <h1>{t('kiosk.welcome')}</h1>
                <p>{t('kiosk.pickService')}</p>
              </>
            )}
            {step === 2 && (
              <>
                <h1>{t('kiosk.enterPhone')}</h1>
                <p>
                  {t('kiosk.phoneWhy')} · {svc(service)}
                </p>
              </>
            )}
            {step === 3 && (
              <>
                <h1>{t('kiosk.ready')}</h1>
                <p>{t('kiosk.scan')}</p>
              </>
            )}
          </div>
          <span className="spacer" />
          {step !== 3 && <LanguageSwitcher size="lg" />}
        </div>
      </div>

      <div className="kiosk-body">
        {step === 1 &&
          (services.loading && !services.data ? (
            <div className="kiosk-panel">
              <Loading label={t('kiosk.loadingServices')} />
            </div>
          ) : services.error && !services.data ? (
            <div className="kiosk-panel">
              <div className="alert alert-error">{errText(services.error)}</div>
            </div>
          ) : services.data.length === 0 ? (
            <div className="kiosk-panel">
              <div className="alert alert-info">{t('kiosk.noServices')}</div>
            </div>
          ) : (
            <div className="service-grid">
              {services.data.map((s) => (
                <button
                  key={s.id}
                  className="service-btn"
                  onClick={() => {
                    setService(s);
                    setStep(2);
                  }}
                >
                  <div className="service-code">{s.code}</div>
                  <h3>{svc(s)}</h3>
                  <p className="muted" style={{ fontSize: '0.9rem' }}>
                    {svcDesc(s)}
                  </p>
                  <div className="service-meta">
                    <span>
                      {t('kiosk.waiting')} <b>{s.waiting}</b>
                    </span>
                    <span>
                      {t('kiosk.estWait')} <b>{wait(s.estimatedWaitMinutes)}</b>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ))}

        {step === 2 && (
          <div className="kiosk-panel">
            <div className="grid grid-2" style={{ alignItems: 'start', gap: 34 }}>
              <div>
                <div className={`phone-display ${digits ? '' : 'placeholder'}`} aria-live="polite" aria-label={t('kiosk.phone')}>
                  {digits ? formatPhone(digits) : '07X XXX XXXX'}
                </div>
                <div className="keypad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                    <button key={k} onClick={() => press(k)}>
                      {k}
                    </button>
                  ))}
                  <button className="fn" onClick={() => press('clear')}>
                    {t('kiosk.clear')}
                  </button>
                  <button onClick={() => press('0')}>0</button>
                  <button className="fn" onClick={() => press('back')} aria-label={t('kiosk.deleteDigit')}>
                    ⌫
                  </button>
                </div>
              </div>

              <div className="stack">
                <div className={`priority-box ${priority ? 'on' : ''}`}>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={priority}
                      onChange={(e) => {
                        setPriority(e.target.checked);
                        if (!e.target.checked) setReason(null);
                        setError(null);
                      }}
                    />
                    {t('kiosk.needPriority')}
                  </label>
                  <p className="muted" style={{ fontSize: '0.88rem', marginTop: 8 }}>
                    {t('kiosk.priorityHint')}
                  </p>
                  {priority && (
                    <div className="chips" role="radiogroup">
                      {REASONS.map((r) => (
                        <button
                          key={r.id}
                          role="radio"
                          aria-checked={reason === r.id}
                          className={`chip ${reason === r.id ? 'on' : ''}`}
                          onClick={() => {
                            setReason(r.id);
                            setError(null);
                          }}
                        >
                          <span aria-hidden="true">{r.icon}</span> {t(`reason.${r.id}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
                  <div className="subtle">{t('kiosk.selectedService')}</div>
                  <div className="row" style={{ marginTop: 4 }}>
                    <b style={{ fontSize: '1.15rem' }}>{svc(service)}</b>
                    <span className="spacer" />
                    <span className="muted">{t('kiosk.nWaiting', { n: service?.waiting })}</span>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error" role="alert">
                    <div>
                      {error}
                      {existing && (
                        <div style={{ marginTop: 6 }}>
                          {t('kiosk.yourTicket')} <b>{existing.displayNumber}</b> · <Link to={`/track/${existing.code}`}>{t('kiosk.openIt')}</Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button className="btn btn-primary btn-xl btn-block" onClick={submit} disabled={submitting || !digits}>
                  {submitting ? t('kiosk.issuing') : t('kiosk.getNumber')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={reset}>
                  {t('kiosk.back')}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && ticket && (
          <div className="grid grid-2" style={{ alignItems: 'center', gap: 34 }}>
            <div className="ticket" role="region" aria-label={t('kiosk.queueNumber')}>
              <div className={`ticket-top ${ticket.isPriority ? 'priority' : ''}`}>
                <div style={{ opacity: 0.8, fontWeight: 600 }}>{t('kiosk.queueNumber')}</div>
                <div className="ticket-number">{ticket.displayNumber}</div>
                <div style={{ fontWeight: 700 }}>{svc(ticket.service)}</div>
                {ticket.isPriority && (
                  <div style={{ marginTop: 10 }}>
                    <PriorityBadge reason={ticket.priorityReason} />
                  </div>
                )}
              </div>
              <div className="ticket-body">
                <dl className="kv" style={{ margin: 0 }}>
                  <div>
                    <dt>{t('kiosk.aheadOfYou')}</dt>
                    <dd>{ticket.customersAhead}</dd>
                  </div>
                  <div>
                    <dt>{t('kiosk.estWait')}</dt>
                    <dd>{wait(ticket.estimatedWaitMinutes)}</dd>
                  </div>
                  <div>
                    <dt>{t('kiosk.expected')}</dt>
                    <dd>{formatTime(ticket.estimatedServiceTime)}</dd>
                  </div>
                  <div>
                    <dt>{t('kiosk.phone')}</dt>
                    <dd style={{ fontSize: '1rem' }}>{ticket.phone}</dd>
                  </div>
                </dl>
              </div>
              <div className="ticket-perf" />
              <div className="qr-row">
                <QRCodeSVG value={trackUrl(ticket.code)} size={112} level="M" />
                <div>
                  <b>{t('kiosk.trackOnPhone')}</b>
                  <p className="muted" style={{ fontSize: '0.88rem', marginTop: 4 }}>
                    {t('kiosk.scanOr')}
                  </p>
                  <div style={{ marginTop: 8 }}>
                    <span className="code-pill">{ticket.code}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="kiosk-panel stack">
              <div className="alert alert-success">✓ {ticket.customersAhead === 0 ? t('kiosk.okNext') : t('kiosk.okLeave')}</div>
              <p style={{ fontSize: '1.05rem' }}>{ticket.customersAhead > 0 ? t('kiosk.leaveText') : t('kiosk.watchBoard')}</p>
              <p className="muted">{firstMessage}</p>
              <button className="btn btn-primary btn-xl btn-block" onClick={reset}>
                {t('kiosk.done')}
              </button>
              <p className="subtle" style={{ textAlign: 'center' }}>
                {t('kiosk.resetIn', { n: countdown })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
