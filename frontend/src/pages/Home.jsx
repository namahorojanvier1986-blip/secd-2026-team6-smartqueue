import { Link } from 'react-router-dom';
import { myTicket } from '../api.js';
import { useApp } from '../i18n.jsx';

export default function Home() {
  const { t, info } = useApp();
  const saved = myTicket.get();

  const actions = [
    { to: '/kiosk', icon: '🎫', title: t('nav.kiosk'), text: t('home.kioskText') },
    { to: '/track', icon: '📍', title: t('nav.track'), text: t('home.trackText') },
    { to: '/display', icon: '📺', title: t('nav.display'), text: t('home.displayText') },
    { to: '/staff/login', icon: '🧑‍💼', title: t('nav.staff'), text: t('home.staffText') },
  ];
  const steps = [
    [t('home.step1'), t('home.step1Text')],
    [t('home.step2'), t('home.step2Text')],
    [t('home.step3'), t('home.step3Text')],
  ];

  return (
    <div className="page">
      <section className="hero">
        <div style={{ fontWeight: 700, opacity: 0.8, marginBottom: 10 }}>
          {info?.institutionName}
          {info?.branchName ? ` · ${info.branchName}` : ''}
        </div>
        <h1>
          {t('home.title1')} <span>{t('home.title2')}</span>
        </h1>
        <p>{t('home.lead')}</p>
        <div className="row">
          <Link to="/kiosk" className="btn btn-warn btn-lg">
            {t('nav.kiosk')}
          </Link>
          <Link to={saved ? `/track/${saved}` : '/track'} className="btn btn-ghost btn-lg">
            {saved ? t('home.openTicket') : t('home.trackTicket')}
          </Link>
        </div>
        <div className="hero-ticket" aria-hidden="true">
          <div className="subtle">{t('home.yourNumber')}</div>
          <div className="num">006</div>
          <div className="subtle">{t('home.sampleService')}</div>
          <div className="perf" />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="subtle">{t('home.ahead')}</span>
            <b>5</b>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="subtle">{t('home.estWait')}</span>
            <b>~12 min</b>
          </div>
        </div>
      </section>

      <h2 className="section-title">{t('home.where')}</h2>
      <div className="grid grid-4">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="card action-card">
            <div className="action-icon" aria-hidden="true">
              {a.icon}
            </div>
            <h3>{a.title}</h3>
            <p className="muted" style={{ fontSize: '0.9rem' }}>
              {a.text}
            </p>
          </Link>
        ))}
      </div>

      <h2 className="section-title">{t('home.how')}</h2>
      <div className="grid grid-3">
        {steps.map(([title, text], i) => (
          <div key={i} className="card card-pad row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <div className="step-num">{i + 1}</div>
            <div>
              <h3 style={{ fontSize: '1.05rem' }}>{title}</h3>
              <p className="muted" style={{ marginTop: 6, fontSize: '0.92rem' }}>
                {text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ marginTop: 24, display: 'flex', gap: 16, alignItems: 'center', borderLeft: '6px solid var(--sun-400)' }}>
        <span style={{ fontSize: '1.8rem' }} aria-hidden="true">
          ★
        </span>
        <div>
          <h3 style={{ fontSize: '1rem' }}>{t('home.priorityTitle')}</h3>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            {t('home.priorityText')}
          </p>
        </div>
      </div>
    </div>
  );
}
