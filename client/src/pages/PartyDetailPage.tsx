import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type PartyDetail, type Task } from '../api.js';
import { formatDate, formatMoney } from '../formatters.js';

type DetailTab = 'overview' | 'tasks' | 'budget' | 'guests' | 'vendors';

export function PartyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PartyDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.getParty(id).then(setData).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load this party.')).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of data?.tasks ?? []) groups.set(task.category, [...(groups.get(task.category) ?? []), task]);
    return [...groups.entries()];
  }, [data?.tasks]);

  if (loading) return <div className="loading-screen"><span className="spinner" />Opening your plan…</div>;
  if (!data) return <div className="page-wrap"><div className="form-error" role="alert">{error || 'Party not found.'}</div></div>;

  const { party, tasks, budget, guests } = data;
  const totalEstimated = budget.reduce((sum, line) => sum + line.estimated, 0);
  const completedTasks = tasks.filter((task) => task.status === 'done').length;
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const addGuest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !guestName.trim()) return;
    const body = guestEmail ? { name: guestName.trim(), email: guestEmail } : { name: guestName.trim() };
    await api.addGuest(id, body).then(({ guest }) => setData((previous) => previous ? { ...previous, guests: [...previous.guests, guest] } : previous)).catch((addError) => setError(addError instanceof Error ? addError.message : 'Could not add guest.'));
    setGuestName('');
    setGuestEmail('');
  };

  return <div className="page-wrap detail-page"><button className="back-link" onClick={() => navigate('/dashboard')}>← Party hall</button><section className="detail-hero"><div><div className="eyebrow">{party.type} · {party.status}</div><h1>{party.name}</h1><p className="muted large">{formatDate(party.date)} · {party.endTime} · {party.guestCount} guests</p></div><div className="detail-actions"><button className="secondary-button" onClick={() => navigate(`/party/${party.id}/report`)}>Print report</button><button className="primary-button" onClick={() => navigate('/party/new')}>Edit plan <span>→</span></button></div></section><div className="detail-tabs" role="tablist" aria-label="Party details">{(['overview', 'tasks', 'budget', 'guests', 'vendors'] as DetailTab[]).map((value) => <button key={value} className={tab === value ? 'detail-tab active' : 'detail-tab'} onClick={() => setTab(value)} role="tab" aria-selected={tab === value}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div>{error && <div className="form-error" role="alert">{error}</div>}{tab === 'overview' && <Overview party={party} totalEstimated={totalEstimated} progress={progress} tasks={tasks} guests={guests.length} />}{tab === 'tasks' && <section className="detail-grid">{groupedTasks.length ? groupedTasks.map(([category, categoryTasks]) => <div className="detail-card task-group" key={category}><div className="card-heading"><h2>{category}</h2><span>{categoryTasks.length} tasks</span></div>{categoryTasks.map((task) => <div className="task-row" key={task.id}><span className={task.status === 'done' ? 'task-box checked' : 'task-box'}>{task.status === 'done' ? '✓' : ''}</span><span><strong>{task.title}</strong><small>Due {formatDate(task.dueDate)}</small></span><em className={task.priority === 'high' ? 'priority high' : 'priority'}>{task.priority}</em></div>)}</div>) : <EmptyDetail title="Your task plan is ready to generate" text="Use the wizard to turn your decisions into a dated checklist." />}</section>}{tab === 'budget' && <BudgetTab budget={budget} totalEstimated={totalEstimated} planned={party.budgetTotal} />}{tab === 'guests' && <GuestsTab guests={guests} guestName={guestName} guestEmail={guestEmail} setGuestName={setGuestName} setGuestEmail={setGuestEmail} onSubmit={addGuest} />}{tab === 'vendors' && <VendorsTab party={party} />}</div>;
}

function Overview({ party, totalEstimated, progress, tasks, guests }: { party: PartyDetail['party']; totalEstimated: number; progress: number; tasks: Task[]; guests: number }) {
  return <section className="overview-grid"><div className="detail-card overview-card accent-card"><div className="eyebrow">The big picture</div><h2>{party.honoree ? `A beautiful day for ${party.honoree}` : 'A plan with room to breathe.'}</h2><p className="muted">Your plan keeps the practical details close so you can stay present for the good stuff.</p><div className="mini-stat-grid"><span><small>Guests</small><strong>{party.guestCount}</strong></span><span><small>Planning progress</small><strong>{progress}%</strong></span><span><small>Tasks</small><strong>{tasks.length}</strong></span></div></div><div className="detail-card budget-highlight"><div className="eyebrow">Live budget</div><strong className="big-number">{formatMoney(totalEstimated)}</strong><p className="muted">estimated plan total</p><div className="budget-bar"><i style={{ width: `${Math.min(100, party.budgetTotal ? (totalEstimated / party.budgetTotal) * 100 : 0)}%` }} /></div><span>{party.budgetTotal ? `${formatMoney(party.budgetTotal)} planned` : 'Set a budget in the wizard'}</span></div><div className="detail-card idea-card"><div className="eyebrow">Idea of the day</div><h2>Give one moment a little more room.</h2><p>Choose one detail guests can feel: a welcome drink, a handwritten note, or the song that starts the evening.</p><button className="text-button">Save this idea ✦</button></div><div className="detail-card next-card"><div className="card-heading"><h2>Next up</h2><span>Keep it light</span></div>{tasks.slice(0, 3).map((task) => <div className="task-row" key={task.id}><span className="task-box" /><span><strong>{task.title}</strong><small>{formatDate(task.dueDate)}</small></span></div>)}{!tasks.length && <p className="muted">Your next steps will appear here.</p>}</div><div className="detail-card"><div className="eyebrow">Guest pulse</div><strong className="big-number">{guests}</strong><p className="muted">guests added so far</p><button className="text-button">Open guest list →</button></div></section>;
}

function BudgetTab({ budget, totalEstimated, planned }: { budget: PartyDetail['budget']; totalEstimated: number; planned: number }) {
  return <section className="detail-card"><div className="card-heading"><div><div className="eyebrow">Rules keep the numbers grounded</div><h2>Budget breakdown</h2></div><strong className="big-number">{formatMoney(totalEstimated)}</strong></div><div className="budget-table">{budget.length ? budget.map((line) => <div className="budget-line" key={line.id}><span><strong>{line.label}</strong><small>{line.category} · {line.qty} × {formatMoney(line.unitCost)}</small></span><b>{formatMoney(line.estimated)}</b></div>) : <p className="muted">Generate the plan to add estimated budget lines.</p>}</div>{planned > 0 && <div className="budget-summary"><span>Planned budget</span><strong>{formatMoney(planned)}</strong><span>Variance</span><strong className={totalEstimated > planned ? 'over-budget' : ''}>{formatMoney(totalEstimated - planned)}</strong></div>}</section>;
}

function GuestsTab({ guests, guestName, guestEmail, setGuestName, setGuestEmail, onSubmit }: { guests: PartyDetail['guests']; guestName: string; guestEmail: string; setGuestName: (value: string) => void; setGuestEmail: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <section className="detail-card"><div className="card-heading"><div><div className="eyebrow">Invitations & RSVP</div><h2>Guest list</h2></div><span>{guests.length} added</span></div><form className="guest-add" onSubmit={onSubmit}><input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Guest name" aria-label="Guest name" required /><input value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} placeholder="Email (optional)" type="email" aria-label="Guest email" /><button className="secondary-button">Add guest</button></form><div className="guest-list">{guests.length ? guests.map((guest) => <div className="guest-row" key={guest.id}><span className="avatar">{guest.name.charAt(0)}</span><span><strong>{guest.name}</strong><small>{guest.email || 'No email added'}{guest.diet ? ` · ${guest.diet}` : ''}</small></span><span className="status-chip">{guest.rsvp}</span></div>) : <p className="muted">Add the first guest to start your list.</p>}</div></section>;
}

function VendorsTab({ party }: { party: PartyDetail['party'] }) {
  return <section className="detail-card vendor-empty"><div className="empty-orbit">✦</div><h2>Your vendor shortlist belongs here.</h2><p className="muted">We’ll keep recommendations aligned with {party.guestCount} guests, your budget and your menu preferences.</p></section>;
}

function EmptyDetail({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-orbit">✦</div><h2>{title}</h2><p className="muted">{text}</p></div>;
}
