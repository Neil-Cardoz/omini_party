import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type PartyDetail } from '../api.js';
import { formatDate, formatMoney } from '../formatters.js';

export function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PartyDetail | null>(null);

  useEffect(() => {
    if (id) api.getParty(id).then(setData).catch(() => undefined);
  }, [id]);

  if (!data) return <div className="loading-screen"><span className="spinner" />Preparing the printable report…</div>;
  const { party, tasks, budget, guests } = data;
  const total = budget.reduce((sum, line) => sum + line.estimated, 0);

  return <div className="report-page"><div className="report-toolbar no-print"><button className="back-link" onClick={() => navigate(`/party/${party.id}`)}>← Back to party</button><button className="primary-button" onClick={() => window.print()}>Print / Save as PDF ↗</button></div><article className="report-paper"><header className="report-cover"><div className="brand"><span className="brand-mark">✦</span><span>celebrAItions</span></div><div className="eyebrow">Celebration plan</div><h1>{party.name}</h1><p>{formatDate(party.date)} · {party.endTime} · {party.guestCount} guests</p><div className="cover-orbit">✦</div></header><section className="report-section"><div className="eyebrow">Executive summary</div><div className="report-stats"><span><small>Estimated total</small><strong>{formatMoney(total)}</strong></span><span><small>Planned budget</small><strong>{party.budgetTotal ? formatMoney(party.budgetTotal) : 'Not set'}</strong></span><span><small>Tasks</small><strong>{tasks.length}</strong></span><span><small>Guests added</small><strong>{guests.length}</strong></span></div></section><section className="report-section"><div className="eyebrow">Cost breakdown</div><h2>Where the plan goes</h2><table><thead><tr><th>Category</th><th>Item</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead><tbody>{budget.map((line) => <tr key={line.id}><td>{line.category}</td><td>{line.label}</td><td>{line.qty}</td><td>{formatMoney(line.unitCost)}</td><td>{formatMoney(line.estimated)}</td></tr>)}</tbody></table><div className="report-total"><span>Estimated total with contingency</span><strong>{formatMoney(total)}</strong></div></section><section className="report-section report-columns"><div><div className="eyebrow">Planning checklist</div><h2>Do the next right thing</h2>{tasks.map((task) => <div className="report-task" key={task.id}><span className="task-box" /><span>{task.title}</span><small>{formatDate(task.dueDate)}</small></div>)}</div><div><div className="eyebrow">Guest summary</div><h2>The room at a glance</h2><p>{guests.length} named guests have been added. RSVP statuses will appear here as invitations are answered.</p><div className="report-callout">Keep guest data private by default. Share only what your celebration needs.</div></div></section><footer className="report-footer">Made thoughtfully with celebrAItions · Planning guidance, not a vendor quote.</footer></article></div>;
}
