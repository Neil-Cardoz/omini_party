import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate } from '../formatters.js';

export function RsvpPage() {
  const { token } = useParams();
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof api.publicInvite>>['invite'] | null>(null);
  const [rsvp, setRsvp] = useState<'yes' | 'maybe' | 'no'>('yes');
  const [plusOneName, setPlusOneName] = useState('');
  const [message, setMessage] = useState('');
  const [entryToken, setEntryToken] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (token) api.publicInvite(token).then(({ invite: nextInvite }) => { setInvite(nextInvite); setRsvp(nextInvite.rsvp as 'yes' | 'maybe' | 'no' || 'yes'); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'This invite is no longer available.'));
  }, [token]);

  if (!invite) return <div className="loading-screen"><span className="spinner" />Opening your invitation…</div>;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    try {
      const result = await api.respondToInvite(token, { rsvp, plusOneName: plusOneName || undefined, message: message || undefined });
      setEntryToken(result.invite.entryToken ?? '');
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save your RSVP.');
    }
  };

  return <main className="rsvp-shell"><section className="rsvp-card"><div className="brand"><span className="brand-mark">✦</span><span>celebrAItions</span></div><div className="rsvp-hero"><div className="eyebrow">You’re invited</div><h1>{invite.party.name}</h1><p className="muted large">{formatDate(invite.party.date)} · {invite.party.endTime}</p>{invite.party.honoree && <p>Celebrating {invite.party.honoree}</p>}</div>{sent ? <div className="rsvp-success"><div className="success-mark">✓</div><h2>{rsvp === 'yes' ? 'We’ll see you there.' : 'Thanks for letting us know.'}</h2><p className="muted">Your response has been shared with the host.</p>{entryToken && <div className="entry-token"><span>Entry code</span><code>{entryToken}</code><small>Keep this page handy for check-in.</small></div>}<button className="secondary-button" onClick={() => window.print()}>Save this invite</button></div> : <form className="rsvp-form" onSubmit={submit}><div className="rsvp-options"><button type="button" className={rsvp === 'yes' ? 'rsvp-option active' : 'rsvp-option'} onClick={() => setRsvp('yes')}>✓ Attending</button><button type="button" className={rsvp === 'maybe' ? 'rsvp-option active' : 'rsvp-option'} onClick={() => setRsvp('maybe')}>? Maybe</button><button type="button" className={rsvp === 'no' ? 'rsvp-option active' : 'rsvp-option'} onClick={() => setRsvp('no')}>× Can’t make it</button></div>{rsvp === 'yes' && <label>+1 name (optional)<input value={plusOneName} onChange={(event) => setPlusOneName(event.target.value)} placeholder="If your invite allows one" /></label>}<label>A note for the host (optional)<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="A little message…" rows={4} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button wide">Send RSVP <span>→</span></button></form>}</section></main>;
}

export function CheckinPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entryToken, setEntryToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const checkIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !entryToken.trim()) return;
    setBusy(true);
    try {
      const result = await api.checkIn(id, entryToken.trim());
      setMessage(`Welcome, ${result.guest.name}${result.guest.plusOneName ? ` (+1: ${result.guest.plusOneName})` : ''}.`);
      setEntryToken('');
    } catch (checkinError) {
      setMessage(checkinError instanceof Error ? checkinError.message : 'Invalid invite.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-wrap checkin-page"><button className="back-link" onClick={() => navigate(`/party/${id}`)}>← Party detail</button><section className="checkin-card"><div className="eyebrow">Day-of tools</div><h1>Welcome people in.</h1><p className="muted large">Scan support can be added when a camera is available. For now, paste or type the signed entry code from the guest’s invite.</p><form onSubmit={checkIn}><label>Entry code<input value={entryToken} onChange={(event) => setEntryToken(event.target.value)} placeholder="Paste the invite code" required /></label><button className="primary-button wide" disabled={busy}>{busy ? 'Checking…' : 'Check in guest'}</button></form>{message && <div className={message.startsWith('Welcome') ? 'checkin-success' : 'form-error'} role="status">{message}</div>}</section></div>;
}
