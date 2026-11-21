import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { formatTime, usePolling } from '../hooks.js';
import { Loading, PriorityBadge, StatusBadge } from '../components/Layout.jsx';
import { LANGS, useApp } from '../i18n.jsx';

const TABS = [
  ['overview', '📊'],
  ['tickets', '🎫'],
  ['services', '🧾'],
  ['counters', '🪟'],
  ['staff', '👥'],
  ['settings', '⚙️'],
];

const todayLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Admin endpoints return snake_case service rows
const asSvc = (s) => ({ name: s.name, nameRw: s.name_rw });

export default function Admin() {
  const { t, info } = useApp();
  const [tab, setTab] = useState('overview');
  const [toast, setToast] = useState(null);
  const [welcome, setWelcome] = useState(() => sessionStorage.getItem('sq_welcome') === '1');
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const onAuthError = (e) => {
    if (e instanceof ApiError && e.status === 401) navigate('/staff/login');
  };

  const dismissWelcome = () => {
    sessionStorage.removeItem('sq_welcome');
    setWelcome(false);
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>{info?.institutionName}</h1>
        <p className="muted">
          {t('adm.title')}
          {info?.branchName ? ` · ${info.branchName}` : ''}
        </p>
      </div>

      {welcome && (
        <div className="card card-pad welcome-card" style={{ marginBottom: 22 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.8rem' }} aria-hidden="true">
              🎉
            </span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h3 style={{ fontSize: '1.1rem' }}>{t('adm.welcomeTitle')}</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {t('adm.welcomeText')}
              </p>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('staff')}>
                  {t('adm.addTellers')}
                </button>
                <Link className="btn btn-sm" to="/kiosk" target="_blank">
                  {t('adm.openKiosk')} ↗
                </Link>
                <Link className="btn btn-sm" to="/display" target="_blank">
                  {t('adm.openDisplay')} ↗
                </Link>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={dismissWelcome}>
              {t('adm.dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="admin-layout">
        <nav className="side-nav" aria-label={t('adm.title')}>
          {TABS.map(([id, icon]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <span aria-hidden="true">{icon}</span> {t(`adm.tab.${id}`)}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'overview' && <Overview onAuthError={onAuthError} />}
          {tab === 'tickets' && <Tickets />}
          {tab === 'services' && <Services notify={setToast} />}
          {tab === 'counters' && <Counters notify={setToast} />}
          {tab === 'staff' && <Staff notify={setToast} />}
          {tab === 'settings' && <Settings notify={setToast} />}
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ onAuthError }) {
  const { t, svc, error: errText } = useApp();
  const [date, setDate] = useState(todayLocal());
  const { data, error } = usePolling(() => api(`/admin/stats?date=${date}`, { auth: true }), 10000, [date]);

  useEffect(() => {
    if (error) onAuthError(error);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return error ? <div className="alert alert-error">{errText(error)}</div> : <Loading />;
  const tt = data.totals;

  const kpis = [
    [t('adm.kpi.issued'), tt.total, t('adm.kpi.issuedSub', { n: tt.priority })],
    [t('adm.kpi.waiting'), tt.waiting, t('adm.kpi.waitingSub', { n: tt.in_service })],
    [t('adm.kpi.served'), tt.served, t('adm.kpi.servedSub', { a: tt.no_show, b: tt.cancelled })],
    [
      t('adm.kpi.avgWait'),
      tt.avg_wait_minutes != null ? `${tt.avg_wait_minutes} min` : '-',
      tt.max_wait_minutes != null ? t('adm.kpi.avgWaitSub', { n: tt.max_wait_minutes }) : t('adm.kpi.avgWaitNone'),
    ],
    [t('adm.kpi.avgService'), tt.avg_service_minutes != null ? `${tt.avg_service_minutes} min` : '-', t('adm.kpi.avgServiceSub')],
    [t('adm.kpi.notifications'), data.notificationsSent, t('adm.kpi.notificationsSub')],
  ];

  // Business hours 7:00-18:00 plus any hour that has data
  const hours = new Set([...Array(12).keys()].map((i) => i + 7));
  data.byHour.forEach((h) => hours.add(h.hour));
  const hourRows = [...hours].sort((a, b) => a - b).map((h) => ({ hour: h, tickets: data.byHour.find((x) => x.hour === h)?.tickets || 0 }));
  const maxHour = Math.max(1, ...hourRows.map((h) => h.tickets));
  const niceMax = Math.max(4, Math.ceil(maxHour / 4) * 4);
  const maxSvc = Math.max(1, ...data.byService.map((s) => s.total));
  const hh = (h) => String(h).padStart(2, '0');

  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ fontSize: '1.15rem' }}>{t('adm.daily')}</h2>
        <span className="spacer" />
        <label className="subtle" htmlFor="date">
          {t('adm.date')}
        </label>
        <input id="date" type="date" className="input" style={{ width: 170 }} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="grid grid-3">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="card kpi">
            <span>{label}</span>
            <b>{value}</b>
            <small>{sub}</small>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{t('adm.perHour')}</h3>
        <p className="subtle" style={{ marginBottom: 18 }}>
          {t('adm.perHourHint')}
        </p>
        <div className="bar-chart" role="img" aria-label={t('adm.perHour')}>
          {[0.5, 1].map((f) => (
            <div key={f} className="gridline" style={{ bottom: `${f * 100}%` }}>
              <span>{Math.round(niceMax * f)}</span>
            </div>
          ))}
          {hourRows.map((h) => (
            <div key={h.hour} className="bar-col">
              <div className="tip">{t('adm.tooltip', { h: hh(h.hour), n: h.tickets })}</div>
              <div className="bar" style={{ height: `${(h.tickets / niceMax) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="bar-axis" aria-hidden="true">
          {hourRows.map((h) => (
            <span key={h.hour}>{hh(h.hour)}h</span>
          ))}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="subtle" style={{ cursor: 'pointer' }}>
            {t('adm.asTable')}
          </summary>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>{t('adm.hour')}</th>
                <th className="num">{t('adm.tickets')}</th>
              </tr>
            </thead>
            <tbody>
              {hourRows.map((h) => (
                <tr key={h.hour}>
                  <td>{hh(h.hour)}:00</td>
                  <td className="num">{h.tickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 style={{ fontSize: '1rem', marginBottom: 14 }}>{t('adm.byService')}</h3>
          {data.byService.map((s) => (
            <div key={s.id} className="hbar" title={`${svc(asSvc(s))}: ${s.total}`}>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{svc(asSvc(s))}</span>
              <div className="hbar-track">
                <div className="hbar-fill" style={{ width: `${(s.total / maxSvc) * 100}%` }} />
              </div>
              <b className="tabular" style={{ textAlign: 'right' }}>
                {s.total}
              </b>
            </div>
          ))}
          <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('adm.service')}</th>
                <th className="num">{t('adm.waiting')}</th>
                <th className="num">{t('adm.served')}</th>
                <th className="num">{t('adm.avgWait')}</th>
              </tr>
            </thead>
            <tbody>
              {data.byService.map((s) => (
                <tr key={s.id}>
                  <td>{svc(asSvc(s))}</td>
                  <td className="num">{s.waiting}</td>
                  <td className="num">{s.served}</td>
                  <td className="num">{s.avg_wait_minutes != null ? `${s.avg_wait_minutes} min` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-header">
              <h3>{t('adm.counterPerf')}</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('adm.counter')}</th>
                  <th>{t('adm.status')}</th>
                  <th className="num">{t('adm.served')}</th>
                  <th className="num">{t('adm.avgService')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byCounter.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      <span className={`badge ${c.is_open ? 'badge-open' : 'badge-closed'}`}>{c.is_open ? t('tel.open') : t('tel.closed')}</span>
                    </td>
                    <td className="num">{c.served}</td>
                    <td className="num">{c.avg_service_minutes != null ? `${c.avg_service_minutes} min` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card card-pad">
            <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>{t('adm.priorityCustomers')}</h3>
            {data.byPriority.length === 0 ? (
              <p className="subtle">{t('adm.noPriority')}</p>
            ) : (
              data.byPriority.map((p) => (
                <div key={p.reason} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                  <PriorityBadge reason={p.reason} />
                  <b className="tabular">{p.tickets}</b>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tickets ---------------- */

function Tickets() {
  const { t, lang, error: errText } = useApp();
  const [date, setDate] = useState(todayLocal());
  const [status, setStatus] = useState('');
  const { data, error } = usePolling(() => api(`/admin/tickets?date=${date}${status ? `&status=${status}` : ''}`, { auth: true }), 8000, [date, status]);
  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap' }}>
        <h3>{t('adm.tab.tickets')}</h3>
        <div className="row">
          <select className="select" style={{ width: 190 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('adm.status')}>
            <option value="">{t('adm.allStatuses')}</option>
            {['waiting', 'called', 'serving', 'served', 'no_show', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <input type="date" className="input" style={{ width: 170 }} value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} aria-label={t('adm.date')} />
        </div>
      </div>
      {error && <div className="alert alert-error">{errText(error)}</div>}
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <div className="center-box">{t('adm.noTickets')}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('adm.col.no')}</th>
                <th>{t('adm.service')}</th>
                <th>{t('adm.col.phone')}</th>
                <th>{t('adm.status')}</th>
                <th>{t('adm.col.lang')}</th>
                <th>{t('adm.col.issued')}</th>
                <th>{t('adm.col.called')}</th>
                <th>{t('adm.counter')}</th>
                <th>{t('adm.col.servedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="ticket-chip">{r.display_number}</span>
                    {r.is_priority && (
                      <span title={t(`reason.${r.priority_reason}`)} style={{ color: 'var(--sun-700)', marginLeft: 6 }}>
                        ★
                      </span>
                    )}
                  </td>
                  <td>{lang === 'rw' ? r.service_rw : r.service}</td>
                  <td className="tabular">{r.phone}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{(r.language || 'en').toUpperCase()}</td>
                  <td className="tabular">{formatTime(r.created_at)}</td>
                  <td className="tabular">{r.called_at ? formatTime(r.called_at) : '-'}</td>
                  <td>{r.counter || '-'}</td>
                  <td>{r.served_by || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared form modal ---------------- */

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="card-pad">{children}</div>
      </div>
    </div>
  );
}

function useSave(notify, after) {
  const { error: errText } = useApp();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (fn, okText) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      notify(okText);
      after();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, save, setError };
}

/* ---------------- Services ---------------- */

function Services({ notify }) {
  const { t, svc } = useApp();
  const { data, refresh } = usePolling(() => api('/admin/services', { auth: true }), 30000);
  const [editing, setEditing] = useState(null);
  const close = () => setEditing(null);
  const { error, busy, save, setError } = useSave(notify, () => {
    close();
    refresh();
  });
  const set = (patch) => setEditing({ ...editing, ...patch });

  const submit = (e) => {
    e.preventDefault();
    const body = {
      code: editing.code,
      name: editing.name,
      nameRw: editing.name_rw,
      description: editing.description,
      descriptionRw: editing.description_rw,
      avgServiceMinutes: editing.avg_service_minutes,
      isActive: editing.is_active,
    };
    save(
      () => (editing.id ? api(`/admin/services/${editing.id}`, { method: 'PUT', auth: true, body }) : api('/admin/services', { method: 'POST', auth: true, body })),
      t('adm.serviceSaved')
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{t('adm.tab.services')}</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => (setError(null), setEditing({ code: '', name: '', name_rw: '', description: '', description_rw: '', avg_service_minutes: 5, is_active: true }))}
        >
          {t('adm.addService')}
        </button>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('adm.code')}</th>
                <th>{t('adm.name')}</th>
                <th className="num">{t('adm.defaultTime')}</th>
                <th>{t('adm.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="code-pill">{s.code}</span>
                  </td>
                  <td>
                    <b>{svc(asSvc(s))}</b>
                    <div className="subtle">
                      EN: {s.name} · RW: {s.name_rw || '-'}
                    </div>
                  </td>
                  <td className="num">{s.avg_service_minutes} min</td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-open' : 'badge-closed'}`}>{s.is_active ? t('adm.active') : t('adm.hidden')}</span>
                  </td>
                  <td className="num">
                    <button className="btn btn-sm" onClick={() => (setError(null), setEditing({ ...s }))}>
                      {t('adm.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? t('adm.editService') : t('adm.newService')} onClose={close}>
          <form onSubmit={submit}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="sc">{t('adm.code')}</label>
              <input id="sc" className="input" maxLength={4} value={editing.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} required />
            </div>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="sn">{t('adm.nameEn')}</label>
                <input id="sn" className="input" value={editing.name} onChange={(e) => set({ name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="snr">{t('adm.nameRw')}</label>
                <input id="snr" className="input" value={editing.name_rw || ''} onChange={(e) => set({ name_rw: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sd">{t('adm.descEn')}</label>
                <input id="sd" className="input" value={editing.description || ''} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="sdr">{t('adm.descRw')}</label>
                <input id="sdr" className="input" value={editing.description_rw || ''} onChange={(e) => set({ description_rw: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sm">{t('adm.minutes')}</label>
              <input
                id="sm"
                type="number"
                min={1}
                max={120}
                className="input"
                style={{ maxWidth: 140 }}
                value={editing.avg_service_minutes}
                onChange={(e) => set({ avg_service_minutes: e.target.value })}
                required
              />
              <span className="hint">{t('adm.minutesHint')}</span>
            </div>
            <label className="check" style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={editing.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
              {t('adm.showKiosk')}
            </label>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? t('adm.saving') : t('adm.saveService')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Counters ---------------- */

function Counters({ notify }) {
  const { t, svc } = useApp();
  const counters = usePolling(() => api('/admin/counters', { auth: true }), 10000);
  const services = usePolling(() => api('/admin/services', { auth: true }), 60000);
  const [editing, setEditing] = useState(null);
  const close = () => setEditing(null);
  const { error, busy, save, setError } = useSave(notify, () => {
    close();
    counters.refresh();
  });

  const toggle = (id) => {
    const ids = editing.service_ids.includes(id) ? editing.service_ids.filter((x) => x !== id) : [...editing.service_ids, id];
    setEditing({ ...editing, service_ids: ids });
  };

  const submit = (e) => {
    e.preventDefault();
    const body = { name: editing.name, serviceIds: editing.service_ids };
    save(
      () => (editing.id ? api(`/admin/counters/${editing.id}`, { method: 'PUT', auth: true, body }) : api('/admin/counters', { method: 'POST', auth: true, body })),
      t('adm.counterSaved')
    );
  };

  const svcName = (id) => {
    const s = services.data?.find((x) => x.id === id);
    return s ? svc(asSvc(s)) : id;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{t('adm.tab.counters')}</h3>
        <button className="btn btn-primary btn-sm" onClick={() => (setError(null), setEditing({ name: '', service_ids: [] }))}>
          {t('adm.addCounter')}
        </button>
      </div>
      {!counters.data ? (
        <Loading />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('adm.counter')}</th>
              <th>{t('adm.servicesHandled')}</th>
              <th>{t('adm.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {counters.data.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                  <div className="subtle">{c.staffed_by ? t('adm.staffedBy', { name: c.staffed_by }) : t('adm.unstaffed')}</div>
                </td>
                <td>
                  {c.service_ids.map((id) => (
                    <span key={id} className="tag">
                      {svcName(id)}
                    </span>
                  ))}
                </td>
                <td>
                  <span className={`badge ${c.is_open ? 'badge-open' : 'badge-closed'}`}>{c.is_open ? t('tel.open') : t('tel.closed')}</span>
                </td>
                <td className="num">
                  <button className="btn btn-sm" onClick={() => (setError(null), setEditing({ ...c }))}>
                    {t('adm.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <Modal title={editing.id ? t('adm.editCounter') : t('adm.newCounter')} onClose={close}>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="cn">{t('adm.name')}</label>
              <input id="cn" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required placeholder={t('adm.counterPlaceholder')} />
            </div>
            <div className="field">
              <label>{t('adm.counterServices')}</label>
              <div className="check-grid">
                {(services.data || []).map((s) => (
                  <label key={s.id} className="check">
                    <input type="checkbox" checked={editing.service_ids.includes(s.id)} onChange={() => toggle(s.id)} />
                    {svc(asSvc(s))}
                  </label>
                ))}
              </div>
            </div>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? t('adm.saving') : t('adm.saveCounter')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Staff ---------------- */

function Staff({ notify }) {
  const { t } = useApp();
  const { data, refresh } = usePolling(() => api('/admin/staff', { auth: true }), 15000);
  const [editing, setEditing] = useState(null);
  const close = () => setEditing(null);
  const { error, busy, save, setError } = useSave(notify, () => {
    close();
    refresh();
  });

  const submit = (e) => {
    e.preventDefault();
    if (editing.id) {
      const body = { fullName: editing.full_name, role: editing.role };
      if (editing.password) body.password = editing.password;
      save(() => api(`/admin/staff/${editing.id}`, { method: 'PUT', auth: true, body }), t('adm.staffUpdated'));
    } else {
      save(
        () =>
          api('/admin/staff', {
            method: 'POST',
            auth: true,
            body: { fullName: editing.full_name, username: editing.username, password: editing.password, role: editing.role },
          }),
        t('adm.staffAdded')
      );
    }
  };

  const setActive = (s, isActive) =>
    save(() => api(`/admin/staff/${s.id}`, { method: 'PUT', auth: true, body: { isActive } }), isActive ? t('adm.accountEnabled') : t('adm.accountDisabled'));

  return (
    <div className="card">
      <div className="card-header">
        <h3>{t('adm.staffTitle')}</h3>
        <button className="btn btn-primary btn-sm" onClick={() => (setError(null), setEditing({ full_name: '', username: '', password: '', role: 'teller' }))}>
          {t('adm.addStaff')}
        </button>
      </div>
      {error && !editing && <div className="alert alert-error">{error}</div>}
      {!data ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('adm.fullName')}</th>
                <th>{t('adm.username')}</th>
                <th>{t('adm.role')}</th>
                <th>{t('adm.counter')}</th>
                <th>{t('adm.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.full_name}</b>
                  </td>
                  <td>{s.username}</td>
                  <td>{t(`role.${s.role}`)}</td>
                  <td>{s.counter || '-'}</td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-open' : 'badge-closed'}`}>{s.is_active ? t('adm.active') : t('adm.disabled')}</span>
                  </td>
                  <td className="num">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => (setError(null), setEditing({ ...s, password: '' }))}>
                        {t('adm.edit')}
                      </button>
                      <button className={`btn btn-sm ${s.is_active ? 'btn-danger' : ''}`} onClick={() => setActive(s, !s.is_active)} disabled={busy}>
                        {s.is_active ? t('adm.disable') : t('adm.enable')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? t('adm.editStaff', { u: editing.username }) : t('adm.newStaff')} onClose={close}>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="fn">{t('adm.fullName')}</label>
              <input id="fn" className="input" value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} required />
            </div>
            {!editing.id && (
              <div className="field">
                <label htmlFor="un">{t('adm.username')}</label>
                <input id="un" className="input" value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value.toLowerCase() })} required />
              </div>
            )}
            <div className="field">
              <label htmlFor="pw">{editing.id ? t('adm.newPassword') : t('adm.password')}</label>
              <input
                id="pw"
                type="password"
                className="input"
                value={editing.password}
                minLength={6}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                required={!editing.id}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="rl">{t('adm.role')}</label>
              <select id="rl" className="select" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                <option value="teller">{t('adm.roleTeller')}</option>
                <option value="admin">{t('adm.roleAdmin')}</option>
              </select>
            </div>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? t('adm.saving') : t('adm.save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Settings ---------------- */

function Settings({ notify }) {
  const { t, refreshInfo, error: errText } = useApp();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/settings', { auth: true })
      .then(setForm)
      .catch((e) => setError(errText(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { institution_name, branch_name, default_language, approach_threshold, priority_policy, webhook_url } = form;
      setForm(
        await api('/admin/settings', {
          method: 'PUT',
          auth: true,
          body: { institution_name, branch_name, default_language, approach_threshold, priority_policy, webhook_url },
        })
      );
      await refreshInfo();
      notify(t('adm.settingsSaved'));
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!form) return error ? <div className="alert alert-error">{error}</div> : <Loading />;
  const set = (patch) => setForm({ ...form, ...patch });
  return (
    <form className="card card-pad" onSubmit={submit} style={{ maxWidth: 680 }}>
      <h3 style={{ fontSize: '1.05rem', marginBottom: 18 }}>{t('adm.settingsTitle')}</h3>
      <div className="field">
        <label htmlFor="in">{t('adm.instName')}</label>
        <input id="in" className="input" value={form.institution_name || ''} onChange={(e) => set({ institution_name: e.target.value })} required />
        <span className="hint">{t('adm.instHint')}</span>
      </div>
      <div className="field">
        <label htmlFor="bn">{t('adm.branchName')}</label>
        <input id="bn" className="input" value={form.branch_name || ''} onChange={(e) => set({ branch_name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="dl">{t('adm.defaultLang')}</label>
        <select id="dl" className="select" style={{ maxWidth: 240 }} value={form.default_language || 'en'} onChange={(e) => set({ default_language: e.target.value })}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="hint">{t('adm.defaultLangHint')}</span>
      </div>
      <div className="field">
        <label htmlFor="at">{t('adm.approach')}</label>
        <input id="at" type="number" min={1} max={20} className="input" style={{ maxWidth: 140 }} value={form.approach_threshold || ''} onChange={(e) => set({ approach_threshold: e.target.value })} />
        <span className="hint">{t('adm.approachHint')}</span>
      </div>
      <div className="field">
        <label htmlFor="pp">{t('adm.policy')}</label>
        <textarea id="pp" className="textarea" value={form.priority_policy || ''} onChange={(e) => set({ priority_policy: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="wh">{t('adm.webhook')}</label>
        <input id="wh" className="input" placeholder="https://your-bank-app.rw/api/queue-events" value={form.webhook_url || ''} onChange={(e) => set({ webhook_url: e.target.value })} />
        <span className="hint">{t('adm.webhookHint')}</span>
      </div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? t('adm.saving') : t('adm.saveSettings')}
      </button>
    </form>
  );
}
