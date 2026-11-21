import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { playChime, useClock, usePolling } from '../hooks.js';
import { LanguageSwitcher, useApp } from '../i18n.jsx';

const FRESH_SECONDS = 20;

export default function Display() {
  const { t, svc, date, wait } = useApp();
  const now = useClock();
  const { data, error } = usePolling(() => api('/display'), 3000);
  const seen = useRef(null);
  const [soundOn, setSoundOn] = useState(false);

  // Chime when a new ticket is called
  useEffect(() => {
    if (!data) return;
    const latest = data.nowServing[0]?.calledAt || null;
    if (seen.current !== null && latest && latest !== seen.current && soundOn) playChime();
    seen.current = latest || '';
  }, [data, soundOn]);

  const isFresh = (iso) => iso && (now - new Date(iso)) / 1000 < FRESH_SECONDS;

  return (
    <div className="board">
      <header className="board-header">
        <span className="brand-mark" style={{ width: 46, height: 46, fontSize: '1.4rem' }}>
          Q
        </span>
        <div>
          <h1>
            {data?.institutionName}
            {data?.branchName && <span style={{ opacity: 0.6, fontWeight: 600 }}> · {data.branchName}</span>}
          </h1>
          <div style={{ opacity: 0.6 }}>{date(now)}</div>
        </div>
        <div className="row" style={{ marginLeft: 24 }}>
          <LanguageSwitcher />
          {!soundOn && (
            <button className="btn btn-sm" onClick={() => (setSoundOn(true), playChime())}>
              {t('disp.enableSound')}
            </button>
          )}
        </div>
        <div className="board-clock">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      </header>

      {error && !data && <div className="board-empty">{t('disp.connecting')}</div>}

      {data && (
        <div className="board-main">
          <section>
            <h2>{t('disp.nowServing')}</h2>
            {data.nowServing.length === 0 ? (
              <div className="board-empty">{t('disp.empty')}</div>
            ) : (
              data.nowServing.map((r) => (
                <div key={r.displayNumber} className={`board-row ${isFresh(r.calledAt) && r.status === 'called' ? 'fresh' : ''}`}>
                  <div>
                    <div className="n">{r.displayNumber}</div>
                    <div className="s">
                      {r.isPriority ? `★ ${t('priority')} · ` : ''}
                      {svc(r.service)}
                    </div>
                  </div>
                  <div className="arrow" aria-hidden="true">
                    →
                  </div>
                  <div>
                    <div className="c">{r.counter}</div>
                    <div className="s">{r.status === 'called' ? t('disp.proceed') : t('disp.beingServed')}</div>
                  </div>
                </div>
              ))
            )}
          </section>

          <aside className="board-side">
            <div className="board-box">
              <h2>{t('disp.next')}</h2>
              {data.upNext.length === 0 ? (
                <div className="board-empty" style={{ padding: '12px 0' }}>
                  {t('disp.noOne')}
                </div>
              ) : (
                <div className="next-grid">
                  {data.upNext.map((n) => (
                    <div key={n.displayNumber}>
                      {n.displayNumber}
                      {n.isPriority && <span className="p">{t('disp.priorityShort')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="board-box">
              <h2>{t('disp.byService')}</h2>
              {data.services.map((s) => (
                <div key={s.id} className="board-svc">
                  <span>{svc(s)}</span>
                  <b>
                    {s.waiting}{' '}
                    <span style={{ opacity: 0.55, fontWeight: 500 }}>· {s.waiting === 0 ? t('disp.noWait') : `~${wait(s.estimatedWaitMinutes)}`}</span>
                  </b>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      <footer className="board-ticker">
        <span>{t('disp.ticker1')}</span>
        <span>{t('disp.ticker2')}</span>
      </footer>
    </div>
  );
}
