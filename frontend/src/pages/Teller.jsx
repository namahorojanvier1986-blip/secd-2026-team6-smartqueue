import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { formatTime, minutesSince, useClock, usePolling } from '../hooks.js';
import { Loading, PriorityBadge, StatusBadge } from '../components/Layout.jsx';
import { LANGS, useApp } from '../i18n.jsx';

export default function Teller() {
  const { t, svc, error: errText } = useApp();
  const navigate = useNavigate();
  const now = useClock(15000);
  const { data, error, loading, setData, refresh } = usePolling(() => api('/teller/state', { auth: true }), 4000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) navigate('/staff/login');
  }, [error, navigate]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(id);
  }, [message]);

  async function run(fn, okMessage) {
    setBusy(true);
    try {
      const result = await fn();
      if (okMessage) setMessage({ type: 'success', text: typeof okMessage === 'function' ? okMessage(result) : okMessage });
      await refresh();
      return result;
    } catch (e) {
      setMessage({ type: 'error', text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  const chooseCounter = (counterId) =>
    run(async () => {
      const s = await api('/teller/counter', { method: 'PUT', auth: true, body: { counterId } });
      setData(s);
    }, counterId ? t('tel.opened') : t('tel.closedMsg'));

  const callNext = () =>
    run(
      () => api('/teller/call-next', { method: 'POST', auth: true }),
      (r) => (r.ticket ? t('tel.calledMsg', { n: r.ticket.displayNumber }) : t('tel.emptyMsg'))
    );

  // One click: finish the current customer and call the next one in line
  const completeAndNext = (id) =>
    run(
      async () => {
        await api(`/teller/tickets/${id}/complete`, { method: 'POST', auth: true });
        return api('/teller/call-next', { method: 'POST', auth: true });
      },
      (r) => (r.ticket ? t('tel.servedCalled', { n: r.ticket.displayNumber }) : t('tel.served'))
    );

  const act = (id, action, text) => run(() => api(`/teller/tickets/${id}/${action}`, { method: 'POST', auth: true }), text);

  if (loading && !data) return <Loading />;
  if (!data)
    return (
      <div className="page">
        <div className="alert alert-error">{errText(error)}</div>
      </div>
    );

  const { me, counters, current, queue, stats } = data;
  const langLabel = (id) => LANGS.find((l) => l.id === id)?.label || id;

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{me.counter_name || t('tel.choose')}</h1>
          <p className="muted">
            {me.full_name}
            {me.counter_name && (
              <>
                {' '}
                · <span className="badge badge-open">{t('tel.open')}</span>
              </>
            )}
          </p>
        </div>
        <span className="spacer" />
        {me.counter_id && (
          <button className="btn" onClick={() => chooseCounter(null)} disabled={busy || !!current}>
            {t('tel.close')}
          </button>
        )}
      </div>

      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`} role="status" style={{ marginBottom: 18 }}>
          {message.text}
        </div>
      )}

      {!me.counter_id ? (
        <div className="grid grid-2">
          {counters.map((c) => (
            <button key={c.id} className="counter-pick" disabled={busy || !!c.staffed_by} onClick={() => chooseCounter(c.id)}>
              <div className="row" style={{ width: '100%' }}>
                <h3 style={{ fontSize: '1.2rem' }}>{c.name}</h3>
                <span className="spacer" />
                <span className={`badge ${c.is_open ? 'badge-open' : 'badge-closed'}`}>{c.is_open ? t('tel.open') : t('tel.closed')}</span>
              </div>
              <div>
                {c.services.map((s) => (
                  <span key={s.id} className="tag">
                    {svc(s)}
                  </span>
                ))}
              </div>
              <span className="subtle">{c.staffed_by ? t('tel.inUse', { name: c.staffed_by }) : t('tel.available')}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="staff-layout">
          <div className="stack">
            {current ? (
              <div className="card current-card">
                <div className={`current-top ${current.isPriority ? 'priority' : ''}`}>
                  <div className="big">{current.displayNumber}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ opacity: 0.75, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t('tel.current')}
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{svc(current.service)}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusBadge status={current.status} />
                      {current.isPriority && <PriorityBadge reason={current.priorityReason} />}
                      <span className="badge badge-cancelled">{t('tel.speaks', { lang: langLabel(current.language) })}</span>
                    </div>
                  </div>
                </div>
                <div className="stat-strip" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span className="subtle">{t('tel.phone')}</span>
                    <b style={{ fontSize: '1.05rem' }}>{current.phone}</b>
                  </div>
                  <div>
                    <span className="subtle">{t('tel.calledAt')}</span>
                    <b>{formatTime(current.calledAt)}</b>
                  </div>
                  <div>
                    <span className="subtle">{current.status === 'serving' ? t('tel.servingFor') : t('tel.waitingFor')}</span>
                    <b>{minutesSince(current.status === 'serving' ? current.serviceStartedAt : current.calledAt, now)} min</b>
                  </div>
                </div>
                <div className="current-actions">
                  {current.status === 'called' && (
                    <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => act(current.id, 'start', t('tel.started'))}>
                      {t('tel.arrived')}
                    </button>
                  )}
                  <button className="btn btn-success btn-lg" disabled={busy} onClick={() => act(current.id, 'complete', t('tel.served'))}>
                    {t('tel.complete')}
                  </button>
                  {queue.length > 0 && (
                    <button className="btn btn-success btn-lg" style={{ gridColumn: '1 / -1' }} disabled={busy} onClick={() => completeAndNext(current.id)}>
                      {t('tel.completeNext')}
                    </button>
                  )}
                  {current.status === 'called' && (
                    <>
                      <button className="btn btn-warn btn-lg" disabled={busy} onClick={() => act(current.id, 'recall', t('tel.reminded'))}>
                        {t('tel.recall')}
                        {current.recallCount ? ` (${current.recallCount})` : ''}
                      </button>
                      <button className="btn btn-danger btn-lg" disabled={busy} onClick={() => act(current.id, 'no-show', t('tel.markedMissed'))}>
                        {t('tel.noShow')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button className="call-next" onClick={callNext} disabled={busy || queue.length === 0}>
                {queue.length === 0 ? t('tel.noCustomers') : t('tel.callNext')}
                <small>
                  {queue.length === 0
                    ? t('tel.autoAppear')
                    : `${t('tel.nextIs', { n: queue[0].displayNumber, service: svc(queue[0].service) })}${queue[0].isPriority ? ` · ★ ${t('priority')}` : ''}`}
                </small>
              </button>
            )}

            <div className="card stat-strip">
              <div>
                <span className="subtle">{t('tel.servedToday')}</span>
                <b>{stats.served}</b>
              </div>
              <div>
                <span className="subtle">{t('tel.noShows')}</span>
                <b>{stats.no_show}</b>
              </div>
              <div>
                <span className="subtle">{t('tel.avgService')}</span>
                <b>{stats.avg_service_minutes ?? '-'} min</b>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>{t('tel.queueTitle')}</h3>
              <span className="badge badge-waiting">{queue.length}</span>
            </div>
            {queue.length === 0 ? (
              <div className="center-box" style={{ padding: 40 }}>
                {t('tel.queueEmpty')}
              </div>
            ) : (
              <ul className="queue-list">
                {queue.map((q, i) => (
                  <li key={q.id} className={q.isPriority ? 'prio' : ''}>
                    <span className="queue-pos">{i + 1}</span>
                    <span className="ticket-chip">{q.displayNumber}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{svc(q.service)}</div>
                      {q.isPriority && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--sun-700)', fontWeight: 700 }}>★ {t(`reason.${q.priorityReason}`)}</div>
                      )}
                    </div>
                    <span className="subtle tabular">{minutesSince(q.createdAt, now)} min</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
