import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Party, type User } from '../api.js';
import { formatDate, formatMoney } from '../formatters.js';

const typeMeta: Record<Party['type'], { icon: string; color: string }> = {
  wedding: { icon: '💍', color: 'rose' },
  birthday: { icon: '🎂', color: 'gold' },
  community: { icon: '🏘️', color: 'sage' },
  graduation: { icon: '🎓', color: 'blue' },
  corporate: { icon: '💼', color: 'ink' },
  'baby-shower': { icon: '👶', color: 'lilac' },
  other: { icon: '✦', color: 'coral' },
};

export function DashboardPage({ user }: { user: User; setUser: (user: User | null) => void }) {
  const navigate = useNavigate();
  const [parties, setParties] = useState<Party[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'planning' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.listParties(query)
      .then(({ parties: result }) => setParties(result))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load parties.'))
      .finally(() => setLoading(false));
  }, [query]);

  const visibleParties = useMemo(() => parties.filter((party) => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return new Date(`${party.date}T23:59:00`).getTime() >= Date.now();
    if (filter === 'completed') return party.status === 'completed';
    return party.status === 'planning' || party.status === 'draft';
  }), [filter, parties]);

  return (
    <div className="page-wrap dashboard-page">
      <section className="dashboard-hero">
        <div><div className="eyebrow">Sunday, October 25, 2026</div><h1>Welcome back, {user.name.split(' ')[0]} <span className="wave">✦</span></h1><p className="muted large">A little structure for the moments worth celebrating.</p></div>
        <button className="primary-button" onClick={() => navigate('/party/new')}>＋ New party</button>
      </section>
      <div className="toolbar"><div className="filter-pills" role="tablist" aria-label="Party filters">{(['all', 'upcoming', 'planning', 'completed'] as const).map((value) => <button key={value} className={filter === value ? 'filter-pill active' : 'filter-pill'} onClick={() => setFilter(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search parties" aria-label="Search parties" /></label></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <div className="loading-card"><span className="spinner" />Loading your party hall…</div> : visibleParties.length === 0 ? <EmptyState onCreate={() => navigate('/party/new')} /> : <div className="party-grid"><button className="new-party-card" onClick={() => navigate('/party/new')}><span className="new-party-plus">＋</span><strong>Start a new celebration</strong><span>Build a plan in a few thoughtful steps.</span></button>{visibleParties.map((party) => <PartyCard key={party.id} party={party} onClick={() => navigate(`/party/${party.id}`)} />)}</div>}
      <section className="week-panel"><div><div className="eyebrow">A gentle nudge</div><h2>This week</h2></div><div className="week-item"><span className="task-box" />Confirm the next decision for your nearest party<span className="muted">Keep the momentum kind.</span></div><button className="text-button" onClick={() => navigate('/party/new')}>See all planning tools →</button></section>
    </div>
  );
}

function PartyCard({ party, onClick }: { party: Party; onClick: () => void }) {
  const meta = typeMeta[party.type];
  const days = Math.ceil((new Date(`${party.date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  return <button className={`party-card ${meta.color}`} onClick={onClick}><div className="party-card-top"><span className="party-icon">{meta.icon}</span><span className="status-chip">{party.status}</span></div><div className="party-card-title"><h2>{party.name}</h2><span>{party.honoree || 'Your celebration'}</span></div><div className="party-date"><strong>{formatDate(party.date)}</strong><span>{days >= 0 ? `${days} days to go` : 'Past celebration'}</span></div><div className="party-metrics"><span><small>Guests</small><strong>{party.guestCount}</strong></span><span><small>Budget</small><strong>{formatMoney(party.budgetTotal, party.currency)}</strong></span></div><span className="card-arrow">↗</span></button>;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="empty-state"><div className="empty-orbit">✦</div><h2>Your next good thing starts here.</h2><p className="muted">Create a party and let us turn the blank page into a plan.</p><button className="primary-button" onClick={onCreate}>Plan my first party →</button></div>;
}
