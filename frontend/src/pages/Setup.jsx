import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api.js';
import { LANGS, LanguageSwitcher, useApp } from '../i18n.jsx';
import { Loading } from '../components/Layout.jsx';

/** Same split the server uses: cash services on general counters, desk services on the last one. */
function planCounters(count, services) {
  const cash = services.filter((s) => s.group === 'cash');
  const desk = services.filter((s) => s.group === 'desk');
  return Array.from({ length: count }, (_, i) => {
    let list = services;
    if (count > 1 && cash.length && desk.length) list = i === count - 1 ? desk : cash;
    return { name: `Counter ${i + 1}`, services: list };
  });
}

export default function Setup() {
  const { t, svc, svcDesc, lang, setLang, refreshInfo } = useApp();
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    institutionName: '',
    branchName: '',
    defaultLanguage: lang,
    services: [],
    counters: 3,
    managerName: '',
    username: '',
    password: '',
    confirm: '',
  });
  const set = (patch) => {
    setError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    api('/setup/status')
      .then((s) => {
        if (!s.setupRequired) return navigate('/staff/login', { replace: true });
        setCatalogue(s.services);
        setForm((f) => ({ ...f, services: s.services.filter((x) => x.selected).map((x) => x.code) }));
      })
      .catch((e) => setError(e.message));
  }, [navigate]);

  const chosen = useMemo(() => (catalogue || []).filter((s) => form.services.includes(s.code)), [catalogue, form.services]);
  const plan = useMemo(() => planCounters(form.counters, chosen), [form.counters, chosen]);

  const toggleService = (code) =>
    set({ services: form.services.includes(code) ? form.services.filter((c) => c !== code) : [...form.services, code] });

  function validate(s) {
    if (s === 1 && form.institutionName.trim().length < 2) return t('setup.needName');
    if (s === 2 && !form.services.length) return t('setup.needService');
    if (s === 3) {
      if (form.managerName.trim().length < 2 || form.username.trim().length < 3) return t('setup.needManager');
      if (form.password.length < 8) return t('setup.shortPassword');
      if (form.password !== form.confirm) return t('setup.mismatch');
    }
    return null;
  }

  function next(e) {
    e?.preventDefault();
    const problem = validate(step);
    if (problem) return setError(problem);
    if (step < 3) return setStep(step + 1);
    finish();
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const session = await api('/setup', {
        method: 'POST',
        body: {
          institutionName: form.institutionName,
          branchName: form.branchName,
          defaultLanguage: form.defaultLanguage,
          services: form.services,
          counters: form.counters,
          managerName: form.managerName,
          username: form.username,
          password: form.password,
        },
      });
      setSession(session);
      sessionStorage.setItem('sq_welcome', '1');
      await refreshInfo();
      navigate('/staff/admin', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const steps = [t('setup.step1'), t('setup.step2'), t('setup.step3')];

  return (
    <div className="setup-page">
      <div className="setup-top">
        <span className="brand-mark">Q</span>
        <b style={{ fontSize: '1.1rem' }}>SmartQueue</b>
        <span className="spacer" />
        <LanguageSwitcher />
      </div>

      <form className="setup-card" onSubmit={next} noValidate>
        <div className="setup-head">
          <h1>{t('setup.title')}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {t('setup.lead')}
          </p>
          <div className="setup-steps" aria-label="Progress">
            {steps.map((label, i) => (
              <div key={label} style={{ display: 'contents' }}>
                {i > 0 && <span className="sep" />}
                <div className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''} aria-current={step === i + 1 ? 'step' : undefined}>
                  <b>{step > i + 1 ? '✓' : i + 1}</b> {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="setup-body">
          {!catalogue && !error && <Loading />}

          {catalogue && step === 1 && (
            <>
              <div className="field">
                <label htmlFor="inst">{t('setup.instName')} *</label>
                <input
                  id="inst"
                  className="input"
                  style={{ fontSize: '1.15rem', fontWeight: 700 }}
                  placeholder={t('setup.instPlaceholder')}
                  value={form.institutionName}
                  onChange={(e) => set({ institutionName: e.target.value })}
                  autoFocus
                  maxLength={100}
                />
              </div>
              <div className="field">
                <label htmlFor="branch">{t('setup.branch')}</label>
                <input
                  id="branch"
                  className="input"
                  placeholder={t('setup.branchPlaceholder')}
                  value={form.branchName}
                  onChange={(e) => set({ branchName: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div className="field">
                <label>{t('setup.lang')}</label>
                <div className="lang-pick">
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={form.defaultLanguage === l.id ? 'on' : ''}
                      aria-pressed={form.defaultLanguage === l.id}
                      onClick={() => {
                        set({ defaultLanguage: l.id });
                        setLang(l.id);
                      }}
                    >
                      {l.label}
                      <small>{l.id === 'rw' ? 'Murakaza neza' : 'Welcome'}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {catalogue && step === 2 && (
            <>
              <h3 style={{ fontSize: '1.05rem' }}>{t('setup.servicesTitle')}</h3>
              <p className="subtle" style={{ margin: '4px 0 14px' }}>
                {t('setup.servicesHint')}
              </p>
              <div className="grid grid-2" style={{ gap: 10 }}>
                {catalogue.map((s) => {
                  const on = form.services.includes(s.code);
                  return (
                    <label key={s.code} className={`svc-option ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleService(s.code)} />
                      <span>
                        <b>{svc(s)}</b>
                        <small>{svcDesc(s)}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="field" style={{ marginTop: 24 }}>
                <label>{t('setup.counters')}</label>
                <div className="stepper">
                  <button type="button" onClick={() => set({ counters: Math.max(1, form.counters - 1) })} disabled={form.counters <= 1} aria-label="-">
                    −
                  </button>
                  <span aria-live="polite">{form.counters}</span>
                  <button type="button" onClick={() => set({ counters: Math.min(20, form.counters + 1) })} disabled={form.counters >= 20} aria-label="+">
                    +
                  </button>
                </div>
              </div>

              {chosen.length > 0 && (
                <div>
                  <div className="subtle" style={{ fontWeight: 700 }}>
                    {t('setup.plan')}
                  </div>
                  <div className="plan-list">
                    {plan.map((c) => (
                      <div key={c.name}>
                        <b>{c.name}</b>
                        <span className="muted">{c.services.map(svc).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {catalogue && step === 3 && (
            <>
              <div className="field">
                <label htmlFor="mn">{t('setup.managerName')} *</label>
                <input id="mn" className="input" value={form.managerName} onChange={(e) => set({ managerName: e.target.value })} autoFocus autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="un">{t('setup.username')} *</label>
                <input
                  id="un"
                  className="input"
                  value={form.username}
                  onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  autoComplete="username"
                />
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label htmlFor="pw">{t('setup.password')} *</label>
                  <input id="pw" type="password" className="input" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" />
                </div>
                <div className="field">
                  <label htmlFor="pw2">{t('setup.confirm')} *</label>
                  <input id="pw2" type="password" className="input" value={form.confirm} onChange={(e) => set({ confirm: e.target.value })} autoComplete="new-password" />
                </div>
              </div>
              <div className="alert alert-info">
                <div>
                  <b>{t('setup.summary')}:</b>{' '}
                  {t('setup.summaryText', {
                    inst: form.branchName ? `${form.institutionName} (${form.branchName})` : form.institutionName,
                    s: form.services.length,
                    c: form.counters,
                  })}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
        </div>

        <div className="setup-foot">
          {step > 1 && (
            <button type="button" className="btn" onClick={() => (setError(null), setStep(step - 1))} disabled={busy}>
              ← {t('setup.back')}
            </button>
          )}
          <span className="spacer" />
          <button type="submit" className={`btn btn-lg ${step === 3 ? 'btn-success' : 'btn-primary'}`} disabled={busy || !catalogue}>
            {busy ? t('setup.finishing') : step === 3 ? t('setup.finish') : `${t('setup.next')} →`}
          </button>
        </div>
      </form>
    </div>
  );
}
