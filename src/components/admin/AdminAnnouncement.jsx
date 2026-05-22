import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, X, Megaphone, Pin, AlertCircle, Info, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const TYPES = [
    { value: 'info', label: 'Info', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Info size={14} /> },
    { value: 'success', label: 'Sukses', color: '#059669', bg: '#d1fae5', icon: <CheckCircle size={14} /> },
    { value: 'warning', label: 'Peringatan', color: '#d97706', bg: '#fef3c7', icon: <AlertCircle size={14} /> },
    { value: 'promo', label: 'Promo', color: '#7C3AED', bg: '#EDE9FE', icon: <Zap size={14} /> },
];

const emptyForm = { title: '', content: '', type: 'info', pinned: false };

export default function AdminAnnouncement() {
    const [announcements, setAnnouncements] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [saved, setSaved] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false });
        setAnnouncements(data || []);
        setLoading(false);
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 120000);
        return () => clearInterval(interval);
    }, []);

    const save = async () => {
        if (!form.title.trim() || !form.content.trim()) return;
        if (editId) {
            await supabase.from('announcements').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId);
        } else {
            await supabase.from('announcements').insert({ ...form, updated_at: new Date().toISOString() });
        }
        setForm(emptyForm); setEditId(null);
        setSaved(true); setTimeout(() => setSaved(false), 2000);
        load();
    };

    const startEdit = (a) => {
        setForm({ title: a.title, content: a.content, type: a.type, pinned: a.pinned });
        setEditId(a.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const remove = async (id) => {
        await supabase.from('announcements').delete().eq('id', id);
        setDeleteConfirm(null);
        load();
    };

    const selectedType = TYPES.find(t => t.value === form.type) || TYPES[0];
    const formatDate = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Papan Pengumuman</h1>
                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Buat dan kelola pengumuman untuk ditampilkan ke semua user.</p>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editId ? <><Edit2 size={15} /> Edit Pengumuman</> : <><Plus size={15} /> Buat Pengumuman Baru</>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Judul</label>
                        <input className="inp" placeholder="Contoh: Maintenance dijadwalkan 1 Januari..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Isi Pengumuman</label>
                        <textarea className="inp" rows={4} placeholder="Tulis isi pengumuman di sini..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.6 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Tipe</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {TYPES.map(t => (
                                    <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${form.type === t.value ? t.color : 'var(--border)'}`, background: form.type === t.value ? t.bg : 'transparent', color: form.type === t.value ? t.color : 'var(--text3)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                            <button onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: `1.5px solid ${form.pinned ? '#d97706' : 'var(--border)'}`, background: form.pinned ? '#fef3c7' : 'transparent', color: form.pinned ? '#d97706' : 'var(--text3)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                <Pin size={13} /> {form.pinned ? 'Di-pin' : 'Pin'}
                            </button>
                        </div>
                    </div>
                    {(form.title || form.content) && (
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>Preview</label>
                            <div style={{ padding: '14px 16px', borderRadius: 12, background: selectedType.bg, border: `1.5px solid ${selectedType.color}30` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: form.content ? 6 : 0 }}>
                                    <span style={{ color: selectedType.color }}>{selectedType.icon}</span>
                                    <span style={{ fontWeight: 700, fontSize: 13.5, color: selectedType.color }}>{form.title || 'Judul pengumuman'}</span>
                                    {form.pinned && <Pin size={11} style={{ color: '#d97706', marginLeft: 'auto' }} />}
                                </div>
                                {form.content && <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{form.content}</p>}
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                        {saved ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--green-l)', borderRadius: 10, color: '#059669', fontWeight: 700, fontSize: 13 }}>
                                <CheckCircle size={15} /> Tersimpan!
                            </div>
                        ) : (
                            <button className="btn btn-blue" onClick={save} disabled={!form.title.trim() || !form.content.trim()} style={{ padding: '10px 22px', borderRadius: 10, opacity: (!form.title.trim() || !form.content.trim()) ? 0.5 : 1 }}>
                                {editId ? <><CheckCircle size={14} /> Simpan Perubahan</> : <><Plus size={14} /> Publish</>}
                            </button>
                        )}
                        {editId && (
                            <button onClick={() => { setForm(emptyForm); setEditId(null); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                <X size={14} /> Batal
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Megaphone size={15} /> Pengumuman Aktif ({announcements.length})
            </div>

            {loading ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                </div>
            ) : announcements.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <Megaphone size={32} style={{ color: 'var(--text3)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Belum ada pengumuman</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Buat pengumuman pertama di atas.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {announcements.map(a => {
                        const t = TYPES.find(t => t.value === a.type) || TYPES[0];
                        return (
                            <div key={a.id} className="card" style={{ padding: 18, border: `1.5px solid ${a.pinned ? '#d97706' : 'var(--border)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: t.color }}>{t.icon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{a.title}</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: t.color, background: t.bg, padding: '2px 8px', borderRadius: 20 }}>{t.label}</span>
                                            {a.pinned && <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}><Pin size={10} /> Pinned</span>}
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{a.content}</p>
                                        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{formatDate(a.updated_at)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        <button onClick={() => startEdit(a)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                            <Edit2 size={12} /> Edit
                                        </button>
                                        {deleteConfirm === a.id ? (
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                <button onClick={() => remove(a.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Hapus</button>
                                                <button onClick={() => setDeleteConfirm(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}><X size={12} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setDeleteConfirm(a.id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', background: 'var(--red-l)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}