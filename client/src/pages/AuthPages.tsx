import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type User } from '../api.js';

interface UserSetter {
  setUser: (user: User | null) => void;
}

const interestOptions = [
  ['wedding', '💍 Wedding'],
  ['birthday', '🎂 Birthday'],
  ['community', '🏘️ Community'],
  ['graduation', '🎓 Graduation'],
  ['corporate', '💼 Corporate'],
  ['baby-shower', '👶 Baby shower'],
] as const;

export function AuthPage({ setUser }: UserSetter) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (user: User) => {
    setUser(user);
    navigate(user.onboarded ? '/dashboard' : '/onboarding', { replace: true });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await api.login({ email, password })
        : await api.signup({ name, email, password });
      finish(result.user);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    setError('');
    try {
      finish((await api.demo()).user);
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : 'Demo mode is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="eyebrow">Your celebration, made clearer</div>
        <h1>Make room for the good part.</h1>
        <p>celebrAItions turns a few decisions into a calm, costed plan for the people and moments you care about.</p>
        <div className="intro-stamp"><span>✦</span> Rules decide. AI decorates.</div>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')} role="tab" aria-selected={mode === 'login'}>Log in</button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')} role="tab" aria-selected={mode === 'signup'}>Create account</button>
        </div>
        <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Start planning beautifully'}</h2>
        <p className="muted">{mode === 'login' ? 'Your party hall is waiting.' : 'A few quick answers help us make better suggestions.'}</p>
        <form onSubmit={submit} className="stack-form">
          {mode === 'signup' && <label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><span className="field-hint">At least 8 characters</span></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button wide" disabled={busy}>{busy ? 'Opening…' : mode === 'login' ? 'Log in' : 'Create my account'} <span>→</span></button>
        </form>
        <div className="divider"><span>or</span></div>
        <button className="secondary-button wide" onClick={demo} disabled={busy}>Explore with demo parties <span>✦</span></button>
        <p className="small-note">Demo mode is preloaded with three sample celebrations.</p>
      </section>
    </main>
  );
}

const onboardingSteps = [
  { title: 'What brings you here?', hint: 'Choose everything you might plan.', key: 'interests' },
  { title: 'What is your role?', hint: 'We will tune the amount of hand-holding.', key: 'role' },
  { title: 'What feels comfortable?', hint: 'This guides the first budget suggestions.', key: 'budgetTier' },
  { title: 'Where do you usually celebrate?', hint: 'We use this for local cost guidance.', key: 'location' },
  { title: 'What should we keep in mind?', hint: 'Dietary coverage is never an afterthought.', key: 'diets' },
  { title: 'How do you like to plan?', hint: 'You can change this for every party.', key: 'planningStyle' },
] as const;

const roleOptions = ['I’m the host', 'Family member', 'Friend helping out', 'Professional planner', 'Community organizer'];
const budgetOptions = [
  ['essential', 'Budget-friendly', 'Keep the essentials, spend with intention'],
  ['balanced', 'Moderate', 'A considered mix of comfort and value'],
  ['premium', 'Premium', 'Elevate the moments guests remember'],
  ['luxury', 'Luxury', 'Bring the full vision to life'],
] as const;
const dietOptions = ['Vegetarian', 'Vegan', 'Jain', 'Halal', 'Kosher', 'Gluten-free', 'Non-veg', 'No preference'];
const planningOptions = [
  ['do-it-for-me', 'Do it for me', 'Pick a strong default and keep me moving.'],
  ['three-choices', 'Give me 3 choices', 'I like a little guidance with room to choose.'],
  ['customize', 'I’ll customize everything', 'Show me the controls and I’ll take it from here.'],
] as const;

export function OnboardingPage({ setUser }: UserSetter) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(['birthday']);
  const [role, setRole] = useState(roleOptions[0]);
  const [budgetTier, setBudgetTier] = useState('balanced');
  const [city, setCity] = useState('New York');
  const [currency, setCurrency] = useState('USD');
  const [diets, setDiets] = useState<string[]>([]);
  const [planningStyle, setPlanningStyle] = useState('three-choices');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const finish = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.updateProfile({ interests, role, budgetTier, city, currency, diets, planningStyle, alcoholPref: 'depends', onboarded: true });
      setUser(result.user);
      navigate('/dashboard', { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your preferences.');
    } finally {
      setBusy(false);
    }
  };

  const next = () => step === onboardingSteps.length - 1 ? void finish() : setStep((current) => current + 1);
  const currentStep = onboardingSteps[step] ?? onboardingSteps[0];

  return (
    <main className="onboarding-shell">
      <div className="onboarding-top"><span className="brand-mark">✦</span><span>Let’s make this yours</span><span className="progress-copy">{step + 1} / {onboardingSteps.length}</span></div>
      <div className="progress-track"><span style={{ width: `${((step + 1) / onboardingSteps.length) * 100}%` }} /></div>
      <section className="onboarding-card" aria-live="polite">
        <div className="eyebrow">A little context goes a long way</div>
        <h1>{currentStep.title}</h1>
        <p className="muted large">{currentStep.hint}</p>
        <div className="choice-grid">
          {step === 0 && interestOptions.map(([value, label]) => <Choice key={value} label={label} selected={interests.includes(value)} onClick={() => toggle(value, interests, setInterests)} multi />)}
          {step === 1 && roleOptions.map((value) => <Choice key={value} label={value} selected={role === value} onClick={() => setRole(value)} />)}
          {step === 2 && budgetOptions.map(([value, label, description]) => <Choice key={value} label={label} description={description} selected={budgetTier === value} onClick={() => setBudgetTier(value)} />)}
          {step === 3 && <div className="location-fields"><label>City<input value={city} onChange={(event) => setCity(event.target.value)} /></label><label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>USD</option><option>INR</option><option>EUR</option><option>GBP</option><option>AED</option></select></label></div>}
          {step === 4 && dietOptions.map((value) => <Choice key={value} label={value} selected={diets.includes(value)} onClick={() => toggle(value, diets, setDiets)} multi />)}
          {step === 5 && planningOptions.map(([value, label, description]) => <Choice key={value} label={label} description={description} selected={planningStyle === value} onClick={() => setPlanningStyle(value)} />)}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="wizard-actions"><button className="text-button" onClick={() => step === 0 ? navigate('/dashboard') : setStep((current) => current - 1)}>← Back</button><button className="primary-button" onClick={next} disabled={busy}>{busy ? 'Saving…' : step === onboardingSteps.length - 1 ? 'Enter my party hall' : 'Next'} <span>→</span></button></div>
      </section>
    </main>
  );
}

function Choice({ label, description, selected, onClick, multi = false }: { label: string; description?: string; selected: boolean; onClick: () => void; multi?: boolean }) {
  return <button className={selected ? 'choice-card selected' : 'choice-card'} onClick={onClick} aria-pressed={selected}><span className="choice-check">{selected ? '✓' : multi ? '+' : '○'}</span><span><strong>{label}</strong>{description && <small>{description}</small>}</span></button>;
}
