import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STATUS_COLOR = { open: 'var(--blue)', inprogress: 'var(--yellow)', closed: 'var(--green)' };
const STATUS_BG = { open: 'var(--blue-l)', inprogress: 'var(--yellow-l)', closed: 'var(--green-l)' };
const STATUS_LABEL = { open: 'Open', inprogress: 'In Progress', closed: 'Closed' };

export default function AdminTickets() {
    const [tickets, setTickets] = useState([]);
    const [replyText, setReplyText] = useState({});
    const [expanded, setExpanded] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
        setTickets(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

    const updateStatus = async (id, status) => {
        await supabase.from('tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        load();
    };

    const sendReply = async (id) => {
        const msg = replyText[id]?.trim();
        if (!msg) return;
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return;
        const replies = [...(ticket.replies || []), { from: 'admin', message: msg, at: new Date().toISOString() }];
        await supabase.from('tickets').update({ replies, status: 'inprogress', updated_at: new Date().toISOString() }).eq('id', id);
        setReplyText(r => ({ ...r, [id]: '' }));
        load();
    };

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Support Tickets</h1>
                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{tickets.length} tiket masuk.</p>
            </div>

            {loading ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                </div>
            ) : tickets.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <MessageSquare size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada tiket</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Tiket dari user akan muncul di sini.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tickets.map(t => {
                        const isOpen = expanded === t.id;
                        const sc = STATUS_COLOR[t.status] || 'var(--text3)';
                        const sb = STATUS_BG[t.status] || 'var(--bg2)';
                        return (
                            <div key={t.id} className="card" style={{ overflow: 'hidden' }}>
                                <div onClick={() => setExpanded(isOpen ? null : t.id)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>{t.subject}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: 'monospace' }}>{t.id}</span>
                                            <span>·</span><span>{t.name} ({t.email})</span>
                                            <span>·</span><span>{t.category}</span>
                                            <span>·</span><span>{new Date(t.created_at).toLocaleDateString('id-ID')}</span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: sc, background: sb, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>
                                        {STATUS_LABEL[t.status] || t.status}
                                    </span>
                                </div>
                                {isOpen && (
                                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                                        <div style={{ background: 'var(--bg2)', borderRadius: 11, padding: '14px 16px', marginTop: 16, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
                                            {t.message}
                                        </div>
                                        {(t.replies || []).map((r, i) => (
                                            <div key={i} style={{ background: r.from === 'admin' ? 'var(--blue-l)' : 'var(--bg2)', border: `1px solid ${r.from === 'admin' ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 11, padding: '12px 16px', marginBottom: 10 }}>
                                                <div style={{ fontSize: 11.5, fontWeight: 700, color: r.from === 'admin' ? 'var(--blue)' : 'var(--text3)', marginBottom: 6 }}>
                                                    {r.from === 'admin' ? '👤 Admin' : `🙋 ${t.name}`} · {new Date(r.at).toLocaleString('id-ID')}
                                                </div>
                                                <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{r.message}</div>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                            <textarea className="inp" rows={2} placeholder="Tulis balasan..." value={replyText[t.id] || ''} onChange={e => setReplyText(r => ({ ...r, [t.id]: e.target.value }))} style={{ flex: 1, resize: 'none', fontSize: 13 }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <button className="btn btn-blue" onClick={() => sendReply(t.id)} style={{ borderRadius: 9, padding: '8px 14px', fontSize: 12.5 }}>Balas</button>
                                                <select className="inp" value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{ fontSize: 12, padding: '8px 10px' }}>
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