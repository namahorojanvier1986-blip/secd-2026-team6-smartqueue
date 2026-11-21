import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, myTicket } from '../api.js';
import { formatTime, playChime, usePolling } from '../hooks.js';
import { Loading, PriorityBadge, StatusBadge } from '../components/Layout.jsx';
import { useApp } from '../i18n.jsx';

const ICONS = {
  ticket_issued: '🎫',
  turn_approaching: '⏰',
  called: '📣',
  recalled: '🔔',
  completed: '✓',
  no_show: '✕',
  cancelled: '✕',
};

const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

export default function TicketStatus() {
  const { t, svc, wait, notif, error: errText } = useApp();
  const { code } = useParams();
  const { data: tk, error, loading, refresh, setData } = usePolling(() => api(`/tickets/${code}`), 5000, [code]);
  const [permission, setPermission] = useState(notificationsSupported ? Notification.permission : 'unsupported');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionError, setActionError] = useState(null);
  const lastSeen = useRef(null);
  const firstPeak = useRef(null);

  // Remember this ticket on the device
  useEffect(() => {
    if (tk?.code) myTicket.set(tk.code);
  }, [tk?.code]);

  // Track starting queue size so the progress ring shows how far the customer has moved
  useEffect(() => {
    if (tk && tk.status === 'waiting' && tk.customersAhead !== null) {
      const key = `sq_peak_${tk.code}`;
      const peak = Math.max(Number(localStorage.getItem(key)) || 0, tk.customersAhead);
      localStorage.setItem(key, String(peak));
      firstPeak.current = peak;
    }
  }, [tk]);

  // Alert for new notifications (API-driven, replaces SMS)
  useEffect(() => {
    if (!tk?.notifications?.length) return;
    const newest = tk.notifications[0];
    if (lastSeen.current === null) {
      lastSeen.current = newest.id;
      return;
    }
    if (newest.id > lastSeen.current) {
      const fresh = tk.notifications.filter((n) => n.id > lastSeen.current);
      lastSeen.current = newest.id;
      if (fresh.some((n) => ['called', 'recalled', 'turn_approaching'].includes(n.type))) {
        playChime();
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      }
      if (permission === 'granted') {
        fresh.forEach((n) => {
          const m = notif(n);
          try {
            new Notification(m.title, { body: m.message, tag: `sq-${n.id}` });
          } catch {
            /* some mobile browsers only allow service-worker notifications */
          }
        });
      }
      document.title = `(${fresh.length}) ${notif(newest).title}`;
    }
  }, [tk, permission, notif]);

  useEffect(() => () => (document.title = 'SmartQueue'), []);

  async function enableAlerts() {
    if (!notificationsSupported) return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted') new Notification(t('ts.alertsOnTitle'), { body: t('ts.alertsOnBody') });
  }

  async function markRead() {
    await api(`/tickets/${code}/notifications/read`, { method: 'POST' }).catch(() => {});
    document.title = 'SmartQueue';
    refresh();
  }

  async function cancel() {
    setActionError(null);
    try {
      const updated = await api(`/tickets/${code}/cancel`, { method: 'POST' });
      setData(updated);
      setConfirmCancel(false);
      myTicket.clear();
    } catch (e) {
      setActionError(errText(e));
    }
  }

  if (loading && !tk) return <Loading label={t('ts.loading')} />;
  if (error && !tk) {
    return (
      <div className="page page-narrow">
        <div className="alert alert-error">{errText(error)}</div>
        <Link to="/track" className="btn" style={{ marginTop: 16 }}>
          {t('ts.tryAnother')}
        </Link>
      </div>
    );
  }

  const peak = Math.max(firstPeak.current || 0, tk.customersAhead || 0, 1);
  const progress = tk.status === 'waiting' ? 1 - (tk.customersAhead || 0) / (peak + 1) : 1;

  return (
    <div className="page page-narrow">
      {error && (
        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
          {t('ts.connProblem')}
        </div>
      )}

      <section className={`status-hero ${tk.status}`} aria-live="polite">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="label">
              {t('ts.ticket')} · {svc(tk.service)}
            </div>
            <div className="big">{tk.displayNumber}</div>
            {tk.isPriority && (
              <div style={{ marginTop: 8 }}>
                <PriorityBadge reason={tk.priorityReason} />
              </div>
            )}
          </div>
          {tk.status === 'waiting' && <ProgressRing value={progress} ahead={tk.customersAhead} label={t('ts.aheadSmall')} />}
        </div>

        {tk.status === 'waiting' && (
          <>
            <h2>{tk.customersAhead === 0 ? t('ts.next') : tk.customersAhead < 3 ? t('ts.approaching') : t('ts.relax')}</h2>
            <div className="metrics">
              <div className="metric">
                <span>{t('ts.ahead')}</span>
                <b>{tk.customersAhead}</b>
              </div>
              <div className="metric">
                <span>{t('ts.estWait')}</span>
                <b>{wait(tk.estimatedWaitMinutes)}</b>
              </div>
              <div className="metric">
                <span>{t('ts.around')}</span>
                <b>{formatTime(tk.estimatedServiceTime)}</b>
              </div>
            </div>
            {tk.openCounters === 0 && <p style={{ marginTop: 14, opacity: 0.85, fontSize: '0.9rem' }}>{t('ts.noCounter')}</p>}
          </>
        )}
        {tk.status === 'called' && <h2 style={{ fontSize: '2rem' }}>{t('ts.called', { counter: tk.counter })}</h2>}
        {tk.status === 'serving' && <h2>{t('ts.serving', { counter: tk.counter })}</h2>}
        {['served', 'no_show', 'cancelled'].includes(tk.status) && <h2>{t(`ts.${tk.status}`)}</h2>}
      </section>

      {tk.status === 'waiting' && permission !== 'granted' && permission !== 'unsupported' && (
        <div className="card card-pad row" style={{ marginTop: 16 }}>
          <span style={{ fontSize: '1.5rem' }}>🔔</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <b>{t('ts.alertsTitle')}</b>
            <div className="subtle">{permission === 'denied' ? t('ts.alertsBlocked') : t('ts.alertsText')}</div>
          </div>
          {permission !== 'denied' && (
            <button className="btn btn-primary" onClick={enableAlerts}>
              {t('ts.enable')}
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>
            {t('ts.notifications')}{' '}
            {tk.unreadCount > 0 && (
              <span className="badge badge-called" style={{ marginLeft: 6 }}>
                {t('ts.new', { n: tk.unreadCount })}
              </span>
            )}
          </h3>
          {tk.unreadCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={markRead}>
              {t('ts.markRead')}
            </button>
          )}
        </div>
        <ul className="feed">
          {tk.notifications.map((n) => {
            const m = notif(n);
            return (
              <li key={n.id} className={n.read_at ? '' : 'unread'}>
                <div className={`feed-dot ${n.type}`} aria-hidden="true">
                  {ICONS[n.type] || '•'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h4>{m.title}</h4>
                    <time>{formatTime(n.created_at)}</time>
                  </div>
                  <p>{m.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="subtle">{t('ts.status')}</div>
            <StatusBadge status={tk.status} />
          </div>
          <div>
            <div className="subtle">{t('ts.takenAt')}</div>
            <b>{formatTime(tk.createdAt)}</b>
          </div>
          <div>
            <div className="subtle">{t('ts.phone')}</div>
            <b>{tk.phone}</b>
          </div>
          <div>
            <div className="subtle">{t('ts.code')}</div>
            <span className="code-pill">{tk.code}</span>
          </div>
        </div>
        {actionError && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {actionError}
          </div>
        )}
        {tk.status === 'waiting' && (
          <div style={{ marginTop: 18 }}>
            {confirmCancel ? (
              <div className="row">
                <span className="muted">{t('ts.giveUp')}</span>
                <span className="spacer" />
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>
                  {t('ts.keep')}
                </button>
                <button className="btn btn-danger btn-sm" onClick={cancel}>
                  {t('ts.yesCancel')}
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(true)}>
                {t('ts.cancel')}
              </button>
            )}
          </div>
        )}
        {['served', 'no_show', 'cancelled'].includes(tk.status) && (
          <Link to="/kiosk" className="btn btn-primary" style={{ marginTop: 18 }}>
            {t('ts.newTicket')}
          </Link>
        )}
      </div>
      <p className="subtle" style={{ textAlign: 'center', marginTop: 14 }}>
        {t('ts.autoUpdate')}
      </p>
    </div>
  );
}

function ProgressRing({ value, ahead, label }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  return (
    <div className="progress-ring" aria-label={`${ahead} ${label}`}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="#fad201"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.03, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="inner">
        <div>
          <b>{ahead}</b>
          <small>{label}</small>
        </div>
      </div>
    </div>
  );
}
