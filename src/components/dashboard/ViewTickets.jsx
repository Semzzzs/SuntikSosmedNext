import { useState, useEffect } from 'react';
import { Ticket, Plus, Send, Clock, CheckCircle, X, ChevronDown, ChevronUp, UserCog, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'var(--blue)', bg: 'var(--blue-l)' },
  inprogress: { label: 'In Progress', color: 'var(--yellow)', bg: 'var(--yellow-l)' },
  closed: { label: 'Closed', color: 'var(--green)', bg: 'var(--green-l)' },
};

// Normalisasi status tiket dari berbagai penulisan ('in_progress', 'In Progress',
// 'in-progress', dst) ke key STATUS_CONFIG agar badge tidak salah jatuh ke 'open'.
function getTicketStatus(raw) {
  const key = String(raw || 'open').toLowerCase().replace(/[\s_-]/g, '');
  return STATUS_CONFIG[key] || STATUS_CONFIG.open;
}

export default function ViewTickets() {
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Fix Critical: email dari session Supabase, bukan sessionStorage yang bisa dimanipulasi
  const getAuthEmail = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email || null;
  };

  const load = async () => {
    const email = await getAuthEmail();
    if (!email) return;
    setLoading(true);
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    let interval = null;
    const start = () => { if (!interval) interval = setInterval(load, 30000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => {
      if (document.hidden) { stop(); }
      else { load(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    // ✅ Fix Critical: ambil email dari session Supabase, bukan sessionStorage
    const authEmail = await getAuthEmail();
    if (!authEmail) return;
    const ticket = {
      id: `TKT-${Date.now()}`,
      email: authEmail,
      name: authEmail.split('@')[0],
      subject: form.subject.trim(),
      category: form.category,
      message: form.message.trim(),
      status: 'open',
      replies: [],
    };
    const { error } = await supabase.from('tickets').insert(ticket);
    if (error) {
      console.error('[tickets] insert error:', error.message);
      return;
    }
    setForm({ subject: '', category: 'General', message: '' });
    setShowForm(false);
    setSubmitted(true);
    await load();
    setTimeout(() => setSubmitted(false), 3000);
  };

  const categories = ['General', 'Payment', 'Order Issue', 'Technical', 'Other'];

  return (
    <div className="fu">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Support Tickets</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Ajukan kendala kamu dan tim kami akan membantu.</p>
        </div>
        <button className="btn btn-blue" onClick={() => setShowForm(v => !v)} style={{ borderRadius: 10, padding: '10px 18px', gap: 7 }}>
          <Plus size={15} /> Buat Tiket
        </button>
      </div>

      {submitted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--green-l)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 11, marginBottom: 16, fontSize: 13.5, fontWeight: 600, color: 'var(--green)' }}>
          <CheckCircle size={15} /> Tiket berhasil dikirim! Tim kami akan segera merespons.
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Tiket Baru</div>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}><X size={18} /></button>
          </div>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Subjek</label>
                <input className="inp" placeholder="Deskripsikan masalah secara singkat" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Kategori</label>
                <select className="inp" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Pesan</label>
              <textarea className="inp" rows={5} placeholder="Jelaskan masalah kamu secara detail..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required style={{ resize: 'vertical' }} />
            </div>
            <button className="btn btn-blue" type="submit" style={{ width: 'fit-content', borderRadius: 10, padding: '11px 22px' }}>
              <Send size={14} /> Kirim Tiket
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
          <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Memuat tiket...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Ticket size={28} style={{ color: 'var(--blue)' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Belum ada tiket</div>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Klik "Buat Tiket" jika kamu butuh bantuan.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map(t => {
            const st = getTicketStatus(t.status);
            const isOpen = expanded === t.id;
            return (
              <div key={t.id} className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isOpen ? null : t.id)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ticket size={18} style={{ color: st.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text3)' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{t.id}</span>
                      <span>·</span><span>{t.category}</span>
                      <span>·</span><Clock size={11} /> {new Date(t.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg, padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>{st.label}</span>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--text3)', flexShrink: 0 }} />}
                </div>
                {isOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 11, padding: '14px 16px', marginTop: 16, fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {t.message}
                    </div>
                    {(t.replies || []).length > 0 && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(t.replies || []).map((r, i) => (
                          <div key={i} style={{ background: r.from === 'admin' ? 'var(--blue-l)' : 'var(--bg2)', border: `1px solid ${r.from === 'admin' ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 11, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: r.from === 'admin' ? 'var(--blue)' : 'var(--text3)', marginBottom: 6 }}>
                              {r.from === 'admin' ? <UserCog size={13} /> : <User size={13} />}
                              <span>{r.from === 'admin' ? 'Admin' : 'Kamu'}</span>
                              <span style={{ opacity: 0.6, fontWeight: 500 }}>· {new Date(r.at).toLocaleString('id-ID')}</span>
                            </div>
                            <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6 }}>{r.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
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