import { useState, useEffect } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';

const STATUS_COLOR = { open: 'var(--blue)', inprogress: 'var(--yellow)', closed: 'var(--green)' };
const STATUS_BG = { open: 'var(--blue-l)', inprogress: 'var(--yellow-l)', closed: 'var(--green-l)' };
const STATUS_LABEL = { open: 'Open', inprogress: 'In Progress', closed: 'Closed' };

const adminFetch = async (url, opts = {}) => {
    const res = await fetch(url, {
        ...opts,
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 401) {
        sessionStorage.removeItem('admin_authed');
        sessionStorage.removeItem('admin_token');
        window.location.reload();
        throw new Error('SESSION_EXPIRED');
    }
    return res;
};

// ── SegBars — segmented progress bar (match desain admin) ──
function SegBars({ color = 'var(--blue)', filled = 4, total = 6 }) {
    return (
        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {Array.from({ length: total }).map((_, i) => (
                <i key={i} style={{ height: 4, flex: 1, borderRadius: 99, background: i < filled ? color : 'var(--border)' }} />
            ))}
        </div>
    );
}

export default function AdminTickets() {
    const [tickets, setTickets] = useState([]);
    const [replyText, setReplyText] = useState({});
    const [expanded, setExpanded] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminFetch('/api/admin-api?action=get_tickets');
            const data = await res.json();
            setTickets(data.tickets || []);
        } catch (e) { console.error('load tickets:', e); }
        setLoading(false);
    };

    useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

    const updateStatus = async (id, status) => {
        await adminFetch('/api/admin-api?action=update_ticket', {
            method: 'POST',
            body: JSON.stringify({ id, status }),
        });
        load();
    };

    const sendReply = async (id) => {
        const msg = replyText[id]?.trim();
        if (!msg) return;
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return;
        const replies = [...(ticket.replies || []), { from: 'admin', message: msg, at: new Date().toISOString() }];
        await adminFetch('/api/admin-api?action=update_ticket', {
            method: 'POST',
            body: JSON.stringify({ id, replies, status: 'inprogress' }),
        });
        setReplyText(r => ({ ...r, [id]: '' }));
        load();
    };

    const filteredTickets = filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus);
    const countOpen = tickets.filter(t => t.status === 'open').length;
    const countProgress = tickets.filter(t => t.status === 'inprogress').length;
    const countClosed = tickets.filter(t => t.status === 'closed').length;

    const pill = (color, bg) => ({
        display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
        padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', color, background: bg,
    });

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 2, letterSpacing: '-.3px' }}>Support Tickets</h1>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>{tickets.length} tiket masuk.</p>
            </div>

            {/* Stat cards flat + segbars — clickable sebagai filter (match desain) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
                {[
                    { label: 'Open', value: countOpen, color: 'var(--blue)', status: 'open', f: 4 },
                    { label: 'In Progress', value: countProgress, color: 'var(--yellow)', status: 'inprogress', f: 3 },
                    { label: 'Closed', value: countClosed, color: 'var(--green)', status: 'closed', f: 5 },
                ].map(s => {
                    const active = filterStatus === s.status;
                    return (
                        <div key={s.label} className="card" onClick={() => setFilterStatus(active ? 'all' : s.status)}
                            style={{ padding: '14px 16px', cursor: 'pointer', border: `1px solid ${active ? s.color : 'var(--border)'}`, transition: 'border-color .15s' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>{s.value}</div>
                            <SegBars color={s.color} filled={s.f} />
                        </div>
                    );
                })}
            </div>

            {/* Tabs underline (match desain "All workflow / Active / Inactive") */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
                {[['all', 'Semua Tiket'], ['open', 'Open'], ['inprogress', 'In Progress'], ['closed', 'Closed']].map(([v, l]) => {
                    const on = filterStatus === v;
                    const count = v === 'open' ? countOpen : v === 'inprogress' ? countProgress : v === 'closed' ? countClosed : null;
                    return (
                        <button key={v} onClick={() => setFilterStatus(v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 2px', marginBottom: -1, background: 'none', border: 'none', borderBottom: `2px solid ${on ? 'var(--text)' : 'transparent'}`, color: on ? 'var(--text)' : 'var(--text2)', fontWeight: on ? 600 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s' }}>
                            {l}
                            {count !== null && count > 0 && (
                                <span style={{ fontSize: 10.5, fontWeight: 600, background: on ? 'var(--text)' : 'var(--bg2)', color: on ? 'var(--white)' : 'var(--text2)', borderRadius: 20, padding: '1px 7px' }}>{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                </div>
            ) : filteredTickets.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <MessageSquare size={38} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', marginBottom: 6 }}>
                        {filterStatus === 'all' ? 'Belum ada tiket' : `Tidak ada tiket ${STATUS_LABEL[filterStatus] || ''}`}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Tiket dari user akan muncul di sini.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredTickets.map(t => {
                        const isOpen = expanded === t.id;
                        const sc = STATUS_COLOR[t.status] || 'var(--text3)';
                        const sb = STATUS_BG[t.status] || 'var(--bg2)';
                        return (
                            <div key={t.id} className="card" style={{ overflow: 'hidden' }}>
                                {/* Baris tiket: subject (bold) + meta (sub) — gaya 2 baris seperti desain */}
                                <div onClick={() => setExpanded(isOpen ? null : t.id)} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{t.id}</span>
                                            <span>·</span><span>{t.name} ({t.email})</span>
                                            <span>·</span><span>{t.category}</span>
                                            <span>·</span><span>{new Date(t.created_at).toLocaleDateString('id-ID')}</span>
                                        </div>
                                    </div>
                                    <span style={{ ...pill(sc, sb), flexShrink: 0 }}>
                                        {STATUS_LABEL[t.status] || t.status}
                                    </span>
                                    <ChevronDown size={14} style={{ color: 'var(--text3)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                                </div>
                                {isOpen && (
                                    <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                                        {/* Pesan awal */}
                                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 15px', marginTop: 16, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                                            {t.message}
                                        </div>
                                        {/* Balasan */}
                                        {(t.replies || []).map((r, i) => (
                                            <div key={i} style={{ background: r.from === 'admin' ? 'var(--blue-l)' : 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 15px', marginBottom: 8 }}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: r.from === 'admin' ? 'var(--blue)' : 'var(--text3)', marginBottom: 5 }}>
                                                    {r.from === 'admin' ? 'Admin' : t.name} · {new Date(r.at).toLocaleString('id-ID')}
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{r.message}</div>
                                            </div>
                                        ))}
                                        {/* Form balas */}
                                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                            <textarea rows={2} placeholder="Tulis balasan..." value={replyText[t.id] || ''} onChange={e => setReplyText(r => ({ ...r, [t.id]: e.target.value }))}
                                                style={{ flex: 1, resize: 'none', fontSize: 13, boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
                                                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <button onClick={() => sendReply(t.id)}
                                                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--text)', color: 'var(--white)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Balas</button>
                                                <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)}
                                                    style={{ fontSize: 12, padding: '7px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                                                    <option value="open">Open</option>
                                                    <option value="inprogress">In Progress</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}