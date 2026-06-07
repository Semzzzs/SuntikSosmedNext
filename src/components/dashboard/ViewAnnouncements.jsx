import { useState, useEffect } from 'react';
import { Megaphone, Pin, Info, CheckCircle, AlertCircle, Zap, Bell } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

const TYPES = {
    info: { label: 'Info', color: '#2563EB', darkColor: '#60A5FA', icon: <Info size={16} /> },
    success: { label: 'Sukses', color: '#059669', darkColor: '#34D399', icon: <CheckCircle size={16} /> },
    warning: { label: 'Peringatan', color: '#D97706', darkColor: '#FCD34D', icon: <AlertCircle size={16} /> },
    promo: { label: 'Promo', color: '#7C3AED', darkColor: '#A78BFA', icon: <Zap size={16} /> },
};

export default function ViewAnnouncements() {
    const { dark } = useTheme();
    const [announcements, setAnnouncements] = useState([]);
    const [filter, setFilter] = useState('Semua');
    const [expanded, setExpanded] = useState({});

    const load = async () => {
        const { data } = await supabase.from('announcements').select('*')
            .order('pinned', { ascending: false })
            .order('updated_at', { ascending: false });
        setAnnouncements(data || []);
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

    const filters = ['Semua', 'info', 'success', 'warning', 'promo'];
    const shown = announcements.filter(a => filter === 'Semua' || a.type === filter);
    const pinned = shown.filter(a => a.pinned);
    const regular = shown.filter(a => !a.pinned);

    const formatDate = (iso) => new Date(iso).toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const getColor = (type) => {
        const t = TYPES[type] || TYPES.info;
        return dark ? t.darkColor : t.color;
    };

    const Card = ({ a }) => {
        const t = TYPES[a.type] || TYPES.info;
        const color = dark ? t.darkColor : t.color;
        const content = a.content || '';
        const isLong = content.length > 180;
        const isOpen = expanded[a.id];

        return (
            <div style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--white)',
                overflow: 'hidden',
                transition: 'box-shadow .2s',
            }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = dark ? '0 4px 20px rgba(0,0,0,.4)' : '0 4px 20px rgba(0,0,0,.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>

                {/* Left accent bar */}
                <div style={{ display: 'flex' }}>
                    <div style={{ width: 4, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, padding: '16px 18px' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                                {t.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: dark ? '#f1f5f9' : '#0f172a' }}>{a.title}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color, background: dark ? 'rgba(255,255,255,0.08)' : `${color}15`, padding: '2px 8px', borderRadius: 20 }}>
                                        {t.label}
                                    </span>
                                    {a.pinned && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: dark ? '#FCD34D' : '#92400E', background: dark ? 'rgba(252,211,77,0.12)' : '#FEF3C7', padding: '2px 8px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            <Pin size={9} /> Penting
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: 11.5, color: dark ? '#475569' : '#94a3b8' }}>🕐 {formatDate(a.updated_at)}</span>
                            </div>
                        </div>

                        {/* Content */}
                        <p style={{
                            fontSize: 13.5, color: dark ? '#94a3b8' : '#475569',
                            lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap',
                            display: '-webkit-box',
                            WebkitLineClamp: isLong && !isOpen ? 3 : 'unset',
                            WebkitBoxOrient: 'vertical',
                            overflow: isLong && !isOpen ? 'hidden' : 'visible',
                        }}>{content}</p>
                        {isLong && (
                            <button onClick={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                                style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                {isOpen ? '▲ Lebih sedikit' : '▼ Baca selengkapnya'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fu">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,99,235,.3)', flexShrink: 0 }}>
                    <Megaphone size={20} style={{ color: '#fff' }} />
                </div>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Pengumuman</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Info & update terbaru dari admin</p>
                </div>
            </div>

            {/* Stats */}
            {announcements.length > 0 && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total', value: announcements.length, color: dark ? '#60A5FA' : '#2563EB' },
                        { label: 'Penting', value: announcements.filter(a => a.pinned).length, color: dark ? '#FCD34D' : '#D97706' },
                        { label: 'Promo', value: announcements.filter(a => a.type === 'promo').length, color: dark ? '#A78BFA' : '#7C3AED' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 800, fontSize: 15, color: s.color }}>{s.value}</span>
                            <span style={{ fontSize: 12, color: dark ? '#475569' : '#94a3b8', fontWeight: 600 }}>{s.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {filters.map(f => {
                    const t = TYPES[f];
                    const isActive = filter === f;
                    const color = t ? (dark ? t.darkColor : t.color) : (dark ? '#60A5FA' : '#2563EB');
                    const count = f === 'Semua' ? announcements.length : announcements.filter(a => a.type === f).length;
                    return (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 99,
                            border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                            background: isActive ? `${color}18` : 'transparent',
                            color: isActive ? color : 'var(--text3)',
                            fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                            fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s',
                        }}>
                            {t?.icon} {t?.label || 'Semua'}
                            <span style={{ fontSize: 11, opacity: 0.7 }}>({count})</span>
                        </button>
                    );
                })}
            </div>

            {shown.length === 0 ? (
                <div style={{ padding: 64, textAlign: 'center', background: 'var(--white)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Bell size={28} style={{ color: 'var(--blue)' }} />
                    </div>
                    <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>Belum ada pengumuman</p>
                    <p style={{ fontSize: 13.5, color: 'var(--text3)', maxWidth: 300, margin: '0 auto' }}>Pantau terus ya, admin akan posting info & promo terbaru di sini.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pinned.length > 0 && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: dark ? '#FCD34D' : '#92400E', letterSpacing: '.04em' }}>
                                <Pin size={11} /> PENTING
                            </div>
                            {pinned.map(a => <Card key={a.id} a={a} />)}
                            {regular.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: dark ? '#334155' : '#cbd5e1', letterSpacing: '.04em', marginTop: 4 }}>
                                    <Megaphone size={11} /> LAINNYA
                                </div>
                            )}
                        </>
                    )}
                    {regular.map(a => <Card key={a.id} a={a} />)}
                </div>
            )}
        </div>
    );
}