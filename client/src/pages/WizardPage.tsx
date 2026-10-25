import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Estimate, type Recommendations } from '../api.js';

type StepStatus = 'pending' | 'done' | 'stale';
type StepKey = 'basics' | 'guests' | 'budget' | 'theme' | 'location' | 'menu' | 'bar' | 'caterer' | 'attire' | 'gifts' | 'invites';

interface WizardDraft {
  basics: { type: 'wedding' | 'birthday' | 'community' | 'graduation' | 'corporate' | 'baby-shower' | 'other'; name: string; honoree: string; date: string; durationHours: number };
  guests: { count: number; ageMix: { kids: number; teens: number; adults: number; seniors: number }; formality: 'casual' | 'smart-casual' | 'formal' };
  budget: { tier: 'essential' | 'balanced' | 'premium' | 'luxury'; total: number };
  theme: { vibe: string; colors: string };
  location: { setting: 'indoor' | 'outdoor' | 'mixed'; area: string };
  menu: { cuisine: string; serviceStyle: string; packageName: string; pricePerHead: number };
  bar: { option: string };
  caterer: { name: string };
  attire: { dressCode: string };
  gifts: { guidance: string };
  invites: { tone: string; plusOnePolicy: string; rsvpDeadline: string; qr: boolean };
  diet: string[];
}

const stepMeta: Array<{ key: StepKey; label: string; short: string }> = [
  { key: 'basics', label: 'Event basics', short: 'The moment' },
  { key: 'guests', label: 'Guests & audience', short: 'Who is coming' },
  { key: 'budget', label: 'Budget', short: 'Spend with intention' },
  { key: 'theme', label: 'Theme & vibe', short: 'Set the feeling' },
  { key: 'location', label: 'Location', short: 'Find the setting' },
  { key: 'menu', label: 'Menu', short: 'Feed the room' },
  { key: 'bar', label: 'Bar & drinks', short: 'Raise a glass' },
  { key: 'caterer', label: 'Caterer', short: 'Choose your partner' },
  { key: 'attire', label: 'Attire', short: 'Dress the part' },
  { key: 'gifts', label: 'Gifts', short: 'Guide the kindness' },
  { key: 'invites', label: 'Invites', short: 'Open the door' },
];

const eventOptions = [['wedding', '💍', 'Wedding'], ['birthday', '🎂', 'Birthday'], ['community', '🏘️', 'Community'], ['graduation', '🎓', 'Graduation'], ['corporate', '💼', 'Corporate'], ['baby-shower', '👶', 'Baby shower']] as const;
const budgetOptions = [['essential', 'Essential', 'Simple, intentional, warm'], ['balanced', 'Balanced', 'Comfort where it counts'], ['premium', 'Premium', 'Elevated guest experience'], ['luxury', 'Luxury', 'The full vision']] as const;
const cuisineOptions = ['Global / mixed', 'Indian', 'Mediterranean', 'Mexican', 'American', 'East Asian'];
const themeOptions = ['Warm and joyful', 'Garden party', 'Modern minimal', 'Playful and bright', 'Candlelit and intimate', 'Festive and colorful'];

function createDefaultDraft(): WizardDraft {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return {
    basics: { type: 'birthday', name: '', honoree: '', date: date.toISOString().slice(0, 10), durationHours: 4 },
    guests: { count: 40, ageMix: { kids: 0, teens: 0, adults: 40, seniors: 0 }, formality: 'smart-casual' },
    budget: { tier: 'balanced', total: 5000 },
    theme: { vibe: 'Warm and joyful', colors: 'Terracotta, cream, sage' },
    location: { setting: 'indoor', area: '' },
    menu: { cuisine: 'Global / mixed', serviceStyle: 'Buffet', packageName: 'Balanced table', pricePerHead: 42 },
    bar: { option: 'mocktail-bar' },
    caterer: { name: 'Green Table Catering' },
    attire: { dressCode: 'Smart casual' },
    gifts: { guidance: 'Return gifts / favors' },
    invites: { tone: 'Fun', plusOnePolicy: 'Selected guests', rsvpDeadline: date.toISOString().slice(0, 10), qr: true },
    diet: ['Vegetarian'],
  };
}

function draftFromState(state: Record<string, unknown>): WizardDraft {
  const base = createDefaultDraft();
  const read = <K extends keyof WizardDraft>(key: K): Partial<WizardDraft[K]> => {
    const value = state[key];
    return value && typeof value === 'object' ? value as Partial<WizardDraft[K]> : {};
  };
  return {
    ...base,
    basics: { ...base.basics, ...read('basics') },
    guests: { ...base.guests, ...read('guests') },
    budget: { ...base.budget, ...read('budget') },
    theme: { ...base.theme, ...read('theme') },
    location: { ...base.location, ...read('location') },
    menu: { ...base.menu, ...read('menu') },
    bar: { ...base.bar, ...read('bar') },
    caterer: { ...base.caterer, ...read('caterer') },
    attire: { ...base.attire, ...read('attire') },
    gifts: { ...base.gifts, ...read('gifts') },
    invites: { ...base.invites, ...read('invites') },
    diet: Array.isArray(state.diet) ? state.diet.filter((value): value is string => typeof value === 'string') : base.diet,
  };
}

export function WizardPage() {
  const navigate = useNavigate();
  const { id: partyIdParam } = useParams();
  const [draft, setDraft] = useState<WizardDraft>(() => createDefaultDraft());
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<StepKey[]>([]);
  const [staleSteps, setStaleSteps] = useState<string[]>([]);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [saveState, setSaveState] = useState('Not saved yet');
  const [error, setError] = useState('');
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    if (partyIdParam) {
      api.getParty(partyIdParam)
        .then(({ party }) => {
          setPartyId(party.id);
          setDraft(draftFromState(party.wizardState));
          const savedSteps = party.wizardState.steps && typeof party.wizardState.steps === 'object' ? party.wizardState.steps as Record<string, unknown> : {};
          setCompleted(stepMeta.filter(({ key }) => {
            const step = savedSteps[key];
            return Boolean(step && typeof step === 'object' && (step as Record<string, unknown>).status === 'done');
          }).map(({ key }) => key));
          setSaveState('Loaded from saved draft');
        })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not open this draft.'));
      return;
    }
    api.createParty({ type: draft.basics.type, name: draft.basics.name || 'Untitled celebration', honoree: draft.basics.honoree, date: draft.basics.date, endTime: '22:00', guestCount: draft.guests.count, budgetTotal: draft.budget.total, currency: 'USD', wizardState: {} })
      .then(({ party }) => setPartyId(party.id))
      .catch((createError) => setError(createError instanceof Error ? createError.message : 'Could not start a party draft.'));
  }, [draft.basics.date, draft.basics.honoree, draft.basics.name, draft.basics.type, draft.budget.total, draft.guests.count, partyIdParam]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.estimate(estimatePayload(draft))
        .then(({ estimate: nextEstimate, recommendations: nextRecommendations }) => { setEstimate(nextEstimate); setRecommendations(nextRecommendations); })
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!partyId) return;
    const timer = window.setTimeout(() => {
      setSaveState('Saving…');
      api.saveWizard(partyId, wizardPayload(draft, activeStep, completed))
        .then(({ staleSteps: nextStale }) => { setStaleSteps(nextStale); setSaveState('Saved just now'); })
        .catch(() => setSaveState('Save paused'));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeStep, completed, draft, partyId]);

  const current = stepMeta[activeStep] ?? stepMeta[0]!;
  const setSection = <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const updateSection = <K extends keyof WizardDraft>(key: K, value: Partial<WizardDraft[K]>) => setDraft((previous) => ({ ...previous, [key]: { ...previous[key], ...value } }));

  const next = () => {
    setCompleted((previous) => previous.includes(current.key) ? previous : [...previous, current.key]);
    if (activeStep < stepMeta.length - 1) setActiveStep((value) => value + 1);
  };

  const generate = async () => {
    if (!partyId) return;
    setSaveState('Saving plan…');
    setError('');
    try {
      await api.saveWizard(partyId, wizardPayload(draft, activeStep, [...completed, 'invites']));
      await api.generate(partyId);
      navigate(`/party/${partyId}`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not generate the plan.');
    }
  };

  const isLast = activeStep === stepMeta.length - 1;
  return <div className="page-wrap wizard-page"><div className="wizard-heading"><div><div className="eyebrow">{partyIdParam ? 'Edit celebration · draft' : 'New celebration · draft'}</div><h1>{partyIdParam ? 'Let’s refine the plan.' : 'Let’s make it memorable.'}</h1><p className="muted large">Every choice stays editable. We’ll keep the numbers honest and the ideas generous.</p></div><span className="save-status" aria-live="polite"><span className="status-dot" />{saveState}</span></div><div className="wizard-layout"><aside className="stepper" aria-label="Party plan steps"><ol>{stepMeta.map((item, index) => <li key={item.key}><button className={index === activeStep ? 'step-button active' : 'step-button'} onClick={() => setActiveStep(index)}><span className={`step-number ${completed.includes(item.key) ? 'done' : ''}`}>{completed.includes(item.key) ? '✓' : index + 1}</span><span><strong>{item.label}</strong><small>{staleSteps.includes(item.key) ? 'Needs a fresh look' : item.short}</small></span></button></li>)}</ol></aside><section className="wizard-main"><div className="wizard-step-header"><span className="step-kicker">Step {activeStep + 1} of {stepMeta.length}</span><h2>{current.label}</h2><p>{current.short}</p></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="step-content">{renderStep(activeStep, draft, updateSection, setSection, recommendations)}</div><div className="wizard-footer"><button className="text-button" onClick={() => activeStep === 0 ? navigate('/dashboard') : setActiveStep((value) => value - 1)}>← Back</button>{isLast ? <button className="primary-button" onClick={generate} disabled={!partyId}>Generate my plan <span>✦</span></button> : <button className="primary-button" onClick={next}>Save & continue <span>→</span></button>}</div></section><aside className="estimate-panel"><div className="eyebrow">Live plan estimate</div><div className="estimate-total">{estimate ? formatMoney(estimate.total) : '—'}</div><p className="muted">Planning guidance · updates as you choose</p>{estimate && <div className="estimate-lines">{estimate.lines.filter((line) => line.subtotal > 0).slice(0, 5).map((line) => <div key={line.label}><span>{line.label}</span><strong>{formatMoney(line.subtotal)}</strong></div>)}</div>}<div className="estimate-note">ⓘ Your total includes a 10% contingency so surprises stay small.</div></aside></div></div>;
}

function renderStep(step: number, draft: WizardDraft, updateSection: <K extends keyof WizardDraft>(key: K, value: Partial<WizardDraft[K]>) => void, setSection: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void, recommendations: Recommendations | null) {
  switch (step) {
    case 0: return <BasicsStep draft={draft} update={updateSection} />;
    case 1: return <GuestsStep draft={draft} update={updateSection} />;
    case 2: return <BudgetStep draft={draft} update={updateSection} />;
    case 3: return <ThemeStep draft={draft} update={updateSection} />;
    case 4: return <LocationStep draft={draft} update={updateSection} />;
    case 5: return <MenuStep draft={draft} update={updateSection} setSection={setSection} />;
    case 6: return <BarStep draft={draft} update={updateSection} recommendations={recommendations} />;
    case 7: return <CatererStep draft={draft} update={updateSection} />;
    case 8: return <AttireStep draft={draft} update={updateSection} recommendations={recommendations} />;
    case 9: return <GiftsStep draft={draft} update={updateSection} recommendations={recommendations} />;
    case 10: return <InvitesStep draft={draft} update={updateSection} />;
    default: return null;
  }
}

function BasicsStep({ draft, update }: StepProps<'basics'>) {
  return <div className="form-stack"><div><span className="field-label">What are you planning?</span><div className="mini-choice-grid">{eventOptions.map(([value, icon, label]) => <button key={value} className={draft.basics.type === value ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('basics', { type: value })}><span>{icon}</span>{label}</button>)}</div></div><div className="two-col"><label>Party name<input value={draft.basics.name} onChange={(event) => update('basics', { name: event.target.value })} placeholder="e.g. Maya turns eight" /></label><label>Who are we celebrating?<input value={draft.basics.honoree} onChange={(event) => update('basics', { honoree: event.target.value })} placeholder="Optional" /></label></div><div className="two-col"><label>Date<input type="date" value={draft.basics.date} onChange={(event) => update('basics', { date: event.target.value })} /></label><label>Duration<select value={draft.basics.durationHours} onChange={(event) => update('basics', { durationHours: Number(event.target.value) })}><option value={2}>2 hours</option><option value={3}>3 hours</option><option value={4}>4 hours</option><option value={6}>6 hours</option></select></label></div></div>;
}

function GuestsStep({ draft, update }: StepProps<'guests'>) {
  return <div className="form-stack"><div className="big-input-row"><label>Expected guests<input className="big-input" type="number" min={1} value={draft.guests.count} onChange={(event) => update('guests', { count: Number(event.target.value) })} /></label><span className="muted">A first estimate is enough. You can refine it later.</span></div><div><span className="field-label">Age mix</span><div className="age-grid">{(Object.keys(draft.guests.ageMix) as Array<keyof WizardDraft['guests']['ageMix']>).map((age) => <label key={age}>{age}<input type="number" min={0} value={draft.guests.ageMix[age]} onChange={(event) => update('guests', { ageMix: { ...draft.guests.ageMix, [age]: Number(event.target.value) } })} /></label>)}</div></div><label>Formality<select value={draft.guests.formality} onChange={(event) => update('guests', { formality: event.target.value as WizardDraft['guests']['formality'] })}><option value="casual">Casual and easy</option><option value="smart-casual">Smart casual</option><option value="formal">Formal celebration</option></select></label></div>;
}

function BudgetStep({ draft, update }: StepProps<'budget'>) {
  return <div className="form-stack"><div className="choice-stack">{budgetOptions.map(([value, label, description]) => <button key={value} className={draft.budget.tier === value ? 'option-row selected' : 'option-row'} onClick={() => update('budget', { tier: value, total: budgetForTier(value, draft.guests.count) })}><span className="option-radio">{draft.budget.tier === value ? '●' : '○'}</span><span><strong>{label}</strong><small>{description}</small></span><b>{formatMoney(budgetForTier(value, draft.guests.count))}</b></button>)}</div><label>Or set a total budget<input type="number" min={0} value={draft.budget.total} onChange={(event) => update('budget', { total: Number(event.target.value) })} /></label></div>;
}

function ThemeStep({ draft, update }: StepProps<'theme'>) {
  return <div className="form-stack"><div className="mini-choice-grid">{themeOptions.map((vibe) => <button key={vibe} className={draft.theme.vibe === vibe ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('theme', { vibe })}>{vibe}</button>)}</div><label>Colors or palette direction<input value={draft.theme.colors} onChange={(event) => update('theme', { colors: event.target.value })} /></label><div className="palette-preview"><span style={{ background: '#cb705d' }} /><span style={{ background: '#e5c7a8' }} /><span style={{ background: '#879b7a' }} /><span style={{ background: '#2d2533' }} /><div><strong>{draft.theme.vibe}</strong><small>{draft.theme.colors}</small></div></div></div>;
}

function LocationStep({ draft, update }: StepProps<'location'>) {
  return <div className="form-stack"><div className="mini-choice-grid"><button className={draft.location.setting === 'indoor' ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('location', { setting: 'indoor' })}>⌂ Indoor</button><button className={draft.location.setting === 'outdoor' ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('location', { setting: 'outdoor' })}>☼ Outdoor</button><button className={draft.location.setting === 'mixed' ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('location', { setting: 'mixed' })}>◌ Mixed</button></div><label>Neighborhood or city area<input value={draft.location.area} onChange={(event) => update('location', { area: event.target.value })} placeholder="e.g. Brooklyn, Bandra, Shoreditch" /></label><div className="suggestion-box"><span>✦</span><div><strong>We’ll show venue ideas next</strong><p>For {draft.guests.count} guests, we’ll prioritize capacity, accessibility and the setting you chose.</p></div></div></div>;
}

function MenuStep({ draft, update, setSection }: StepProps<'menu'> & { setSection: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void }) {
  const packageOptions = [['Essential table', 24, 'A simple, satisfying spread'], ['Balanced table', 42, 'Variety with a few memorable touches'], ['Celebration table', 70, 'A full experience with chef-led details']] as const;
  return <div className="form-stack"><div className="two-col"><label>Cuisine<select value={draft.menu.cuisine} onChange={(event) => update('menu', { cuisine: event.target.value })}>{cuisineOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Service style<select value={draft.menu.serviceStyle} onChange={(event) => update('menu', { serviceStyle: event.target.value })}><option>Buffet</option><option>Plated</option><option>Family-style</option><option>Food stations</option><option>Potluck</option></select></label></div><div className="choice-stack">{packageOptions.map(([name, price, description]) => <button key={name} className={draft.menu.packageName === name ? 'option-row selected' : 'option-row'} onClick={() => { update('menu', { packageName: name, pricePerHead: price }); setSection('diet', draft.diet); }}><span className="option-radio">{draft.menu.packageName === name ? '●' : '○'}</span><span><strong>{name}</strong><small>{description}</small></span><b>${price}/head</b></button>)}</div><div className="coverage-meter"><span>Dietary coverage</span><strong>{draft.diet.length ? `Covers ${draft.diet.length} declared preference${draft.diet.length > 1 ? 's' : ''}` : 'Add preferences in your profile'}</strong><div><i style={{ width: `${Math.min(100, Math.max(25, draft.diet.length * 25))}%` }} /></div></div></div>;
}

function BarStep({ draft, update, recommendations }: StepProps<'bar'> & { recommendations: Recommendations | null }) {
  const options = recommendations?.bar.offeredOptions ?? ['full-bar', 'beer-wine', 'signature-cocktails', 'mocktail-bar', 'none'];
  return <div className="form-stack"><div className="choice-stack">{options.map((option) => <button key={option} className={draft.bar.option === option ? 'option-row selected' : 'option-row'} onClick={() => update('bar', { option })}><span className="option-radio">{draft.bar.option === option ? '●' : '○'}</span><span><strong>{prettyOption(option)}</strong><small>{option === recommendations?.bar.defaultOption ? 'Recommended for your guest mix' : 'A flexible option for the day'}</small></span><b>{option === 'none' ? '—' : option === 'mocktail-bar' ? '$' : '$$'}</b></button>)}</div>{recommendations?.bar.reason && <div className="why-box"><span>Why this suggestion?</span>{recommendations.bar.reason}</div>}</div>;
}

function CatererStep({ draft, update }: StepProps<'caterer'>) {
  const vendors = [['Green Table Catering', 'Vegetarian · Vegan', '$42/head', '4.8'], ['Gather & Grain', 'Vegetarian · Gluten-free', '$38/head', '4.6'], ['Sunroom Kitchen', 'Global · Family-style', '$52/head', '4.7']] as const;
  return <div className="form-stack"><div className="vendor-list">{vendors.map(([name, fit, price, rating]) => <button key={name} className={draft.caterer.name === name ? 'vendor-row selected' : 'vendor-row'} onClick={() => update('caterer', { name })}><span className="vendor-avatar">{name.charAt(0)}</span><span><strong>{name}</strong><small>{fit}</small></span><span className="vendor-price">{price}<small>★ {rating}</small></span></button>)}</div><button className="secondary-button">＋ I already have a caterer</button></div>;
}

function AttireStep({ draft, update, recommendations }: StepProps<'attire'> & { recommendations: Recommendations | null }) {
  return <div className="form-stack"><div className="suggestion-box"><span>✦</span><div><strong>Suggested dress code</strong><p>{recommendations?.attire.value ?? 'Smart casual'}</p><small>{recommendations?.attire.reason}</small></div></div><label>Make it yours<input value={draft.attire.dressCode} onChange={(event) => update('attire', { dressCode: event.target.value })} /></label></div>;
}

function GiftsStep({ draft, update, recommendations }: StepProps<'gifts'> & { recommendations: Recommendations | null }) {
  const options = recommendations?.gifts.options ?? ['Gift guidance', 'Optional favors', 'No gifts please'];
  return <div className="form-stack"><div className="choice-stack">{options.map((option) => <button key={option} className={draft.gifts.guidance === option ? 'option-row selected' : 'option-row'} onClick={() => update('gifts', { guidance: option })}><span className="option-radio">{draft.gifts.guidance === option ? '●' : '○'}</span><span><strong>{option}</strong><small>Include this in the guest-facing note</small></span></button>)}</div><div className="why-box">{recommendations?.gifts.reason ?? 'Keep the note warm, clear and optional.'}</div></div>;
}

function InvitesStep({ draft, update }: StepProps<'invites'>) {
  return <div className="form-stack"><div><span className="field-label">Invite voice</span><div className="mini-choice-grid">{['Formal', 'Fun', 'Minimal'].map((tone) => <button key={tone} className={draft.invites.tone === tone ? 'mini-choice selected' : 'mini-choice'} onClick={() => update('invites', { tone })}>{tone}</button>)}</div></div><div className="two-col"><label>+1 policy<select value={draft.invites.plusOnePolicy} onChange={(event) => update('invites', { plusOnePolicy: event.target.value })}><option>None</option><option>Allowed for all</option><option>Selected guests</option><option>Limit 1</option></select></label><label>RSVP deadline<input type="date" value={draft.invites.rsvpDeadline} onChange={(event) => update('invites', { rsvpDeadline: event.target.value })} /></label></div><label className="toggle-row"><input type="checkbox" checked={draft.invites.qr} onChange={(event) => update('invites', { qr: event.target.checked })} /><span><strong>QR entry on</strong><small>Guests receive an entry QR with their invite.</small></span></label></div>;
}

type StepProps<K extends keyof WizardDraft> = { draft: WizardDraft; update: (key: K, value: Partial<WizardDraft[K]>) => void };

function wizardPayload(draft: WizardDraft, currentStep: number, completed: StepKey[]) {
  const steps = Object.fromEntries(stepMeta.map(({ key }, index) => [key, { value: draft[key], status: completed.includes(key) || index < currentStep ? 'done' : 'pending' as StepStatus }])) as Record<string, { value: unknown; status: StepStatus }>;
  return { currentStep: currentStep + 1, version: 1, steps, budgetTier: draft.budget.tier, diet: draft.diet, guests: draft.guests, basics: draft.basics, options: { alcoholPref: draft.bar.option === 'none' || draft.bar.option === 'mocktail-bar' ? 'no' : 'yes', indoorOutdoor: draft.location.setting }, cuisine: draft.menu.cuisine, culture: '' };
}

function estimatePayload(draft: WizardDraft) {
  return { eventType: draft.basics.type, guestCount: draft.guests.count, date: draft.basics.date, budgetTier: draft.budget.tier, durationHours: draft.basics.durationHours, ageMix: draft.guests.ageMix, diet: draft.diet, alcoholPref: draft.bar.option === 'none' || draft.bar.option === 'mocktail-bar' ? 'no' : 'yes', indoorOutdoor: draft.location.setting, formality: draft.guests.formality };
}

function budgetForTier(tier: string, guests: number): number {
  const perHead: Record<string, number> = { essential: 80, balanced: 125, premium: 210, luxury: 350 };
  return (perHead[tier] ?? 125) * Math.max(1, guests);
}

function prettyOption(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}
