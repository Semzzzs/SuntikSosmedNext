import { useState, useEffect } from 'react';
import { ShoppingCart, RefreshCw, Search, ExternalLink } from 'lucide-react';

const STATUS_STYLE = {
    pending: { color: 'var(--yellow)', bg: 'var(--yellow-l)', label: 'Pending' },
    processing: { color: 'var(--blue)', bg: 'var(--blue-l)', label: 'Processing' },
    success: { color: 'var(--green)', bg: 'var(--green-l)', label: 'Sukses' },
    completed: { color: 'var(--green)', bg: 'var(--green-l)', label: 'Selesai' },
    failed: { color: 'var(--red)', bg: 'var(--red-l)', label: 'Gagal' },
    cancelled: { color: 'var(--text3)', bg: 'var(--bg2)', label: 'Dibatalkan' },
};

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            const token = sessionStorage.getItem('admin_token') || '';
            const res = await fetch('/api/admin-api?action=get_orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Gagal mengambil data orders.');
            } else {
                setOrders(data.orders || []);
            }
        } catch (e) {
            setError('Network error: ' + e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(() => fetchOrders(), 60000);
        return () => clearInterval(interval);
    }, []);

    const filtered = orders.filter(o => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            o.email?.toLowerCase().includes(q) ||
            o.description?.toLowerCase().includes(q) ||
            o.status?.toLowerCase().includes(q) ||
            String(o.id)?.includes(q)
        );
    });

    const totalRevenue = orders
        .filter(o => o.status === 'success' || o.status === 'completed')
        .reduce((sum, o) => sum + (o.amount || 0), 0);

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Orders</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>
                        {orders.length} total order · semua user.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                        <input
                            className="inp"
                            placeholder="Cari email, deskripsi..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 32, width: 220, fontSize: 13 }}
                        />
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={() => fetchOrders(true)}
                        disabled={refreshing}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 10,
                            border: '1.5px solid var(--border)',
                            background: 'var(--bg2)', color: 'var(--text2)',
                            fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            fontFamily: "'Plus Jakarta Sans',sans-serif",
                            opacity: refreshing ? 0.6 : 1,
                        }}
                    >
                        <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            {!loading && orders.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total Order', value: orders.length, color: 'var(--blue)' },
                        { label: 'Sukses', value: orders.filter(o => ['success', 'completed'].includes(o.status)).length, color: 'var(--green)' },
                        { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'var(--yellow)' },
                        { label: 'Gagal', value: orders.filter(o => o.status === 'failed').length, color: 'var(--red)' },
                        { label: 'Revenue', value: 'Rp ' + totalRevenue.toLocaleString('id-ID'), color: 'var(--green)' },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: '12px 18px', flex: '1 1 120px', minWidth: 110 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, letterSpacing: '.04em' }}>{s.label.toUpperCase()}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ padding: '14px 18px', background: 'var(--red-l)', border: '1.5px solid var(--red)', borderRadius: 12, color: 'var(--red)', fontWeight: 700, fontSize: 13.5, marginBottom: 16 }}>
                    ❌ {error}
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Mengambil data orders via service role...</p>
                </div>

                /* Empty */
            ) : filtered.length === 0 ? (
                <div className="card" style={{ padding: 64, textAlign: 'center' }}>
                    <ShoppingCart size={44} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
                        {search ? 'Order tidak ditemukan' : 'Belum ada order'}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {search ? `Tidak ada order yang cocok dengan "${search}"` : 'Order dari semua user akan tampil di sini (dari Supabase).'}
                    </p>
                </div>

                /* Table */
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
                            <thead>
                                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                    {['#ID', 'Email', 'Deskripsi', 'Jumlah', 'Status', 'Tanggal'].map(h => (
                                        <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((o, i) => {
                                    const s = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
                                    return (
                                        <tr key={o.id || i} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                            {/* ID */}
                                            <td style={{ padding: '11px 14px', color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                                                #{String(o.id || '—').slice(0, 8)}
                                            </td>
                                            {/* Email */}
                                            <td style={{ padding: '11px 14px', color: 'var(--text2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {o.email || '—'}
                                            </td>
                                            {/* Deskripsi */}
                                            <td style={{ padding: '11px 14px', color: 'var(--text)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {o.description || o.service_name || '—'}
                                            </td>
                                            {/* Jumlah */}
                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>
                                                −Rp {(o.amount || 0).toLocaleString('id-ID')}
                                            </td>
                                            {/* Status */}
                                            <td style={{ padding: '11px 14px' }}>
                                                <span style={{ fontSize: 11.5, fontWeight: 700, color: s.color, background: s.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                                    {s.label}
                                                </span>
                                            </td>
                                            {/* Tanggal */}
                                            <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                {o.created_at
                                                    ? new Date(o.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer count */}
                    {search && (
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
                            Menampilkan {filtered.length} dari {orders.length} order
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}