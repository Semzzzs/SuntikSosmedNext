import { useState, useEffect } from 'react';
import { ShoppingCart, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_STYLE = {
    pending: { color: 'var(--yellow)', bg: 'var(--yellow-l)', label: 'Pending' },
    processing: { color: 'var(--blue)', bg: 'var(--blue-l)', label: 'Processing' },
    success: { color: 'var(--green)', bg: 'var(--green-l)', label: 'Sukses' },
    completed: { color: 'var(--green)', bg: 'var(--green-l)', label: 'Selesai' },
    failed: { color: 'var(--red)', bg: 'var(--red-l)', label: 'Gagal' },
    cancelled: { color: 'var(--text3)', bg: 'var(--bg2)', label: 'Dibatalkan' },
};

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

// ── Pagination — match footer tabel di desain ──
function Pagination({ page, totalPages, perPage, setPerPage, setPage, totalItems }) {
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
        if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) pages.push(i);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    const from = totalItems === 0 ? 0 : page * perPage + 1;
    const to = Math.min((page + 1) * perPage, totalItems);
    const pageBtn = (active) => ({
        minWidth: 28, height: 28, border: active ? '1px solid var(--border)' : 'none',
        background: active ? 'var(--white)' : 'none', borderRadius: 7,
        fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? 'var(--text)' : 'var(--text2)',
        cursor: 'pointer', fontFamily: 'inherit', boxShadow: active ? '0 1px 2px rgba(0,0,0,.05)' : 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    });
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <button style={pageBtn(false)} disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft size={13} /></button>
            {pages.map((p, i) => p === '…'
                ? <span key={`e${i}`} style={{ color: 'var(--text3)', fontSize: 12.5, padding: '0 2px' }}>…</span>
                : <button key={p} style={pageBtn(p === page)} onClick={() => setPage(p)}>{p + 1}</button>
            )}
            <button style={pageBtn(false)} disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}><ChevronRight size={13} /></button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', fontSize: 12.5 }}>
                Show:
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}
                    style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--white)', outline: 'none', cursor: 'pointer' }}>
                    {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                Per Page
                <span>{from} - {to} dari {totalItems}</span>
            </div>
        </div>
    );
}

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);

    const fetchOrders = async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            const res = await adminFetch('/api/admin-api?action=get_orders');
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Gagal mengambil data orders.');
                return;
            }
            const data = await res.json();
            setOrders(data.orders || []);
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

    useEffect(() => { setPage(0); }, [search]);

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice(page * perPage, (page + 1) * perPage);

    const totalRevenue = orders
        .filter(o => o.status === 'success' || o.status === 'completed')
        .reduce((sum, o) => sum + (o.amount || 0), 0);

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 2, letterSpacing: '-.3px' }}>Orders</h1>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {orders.length} total order · semua user.
                    </p>
                </div>
            </div>

            {/* Stat cards flat + segbars (match desain) */}
            {!loading && orders.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
                    {[
                        { label: 'Total Order', value: orders.length, color: 'var(--blue)', filled: 5 },
                        { label: 'Sukses', value: orders.filter(o => ['success', 'completed'].includes(o.status)).length, color: 'var(--green)', filled: 5 },
                        { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'var(--yellow)', filled: 2 },
                        { label: 'Gagal', value: orders.filter(o => o.status === 'failed').length, color: 'var(--red)', filled: 1 },
                        { label: 'Revenue', value: 'Rp ' + totalRevenue.toLocaleString('id-ID'), color: '#0e93c4', filled: 4 },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                            <SegBars color={s.color} filled={s.filled} />
                        </div>
                    ))}
                </div>
            )}

            {/* Toolbar: search kiri, refresh kanan (match desain) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 260 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input
                        placeholder="Cari order ID, email, atau layanan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 30px', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>
                <button
                    onClick={() => fetchOrders(true)}
                    disabled={refreshing}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.6 : 1 }}>
                    <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: '12px 16px', background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, color: 'var(--red)', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
                    {error}
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
                    <ShoppingCart size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', marginBottom: 6 }}>
                        {search ? 'Order tidak ditemukan' : 'Belum ada order'}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                        {search ? `Tidak ada order yang cocok dengan "${search}"` : 'Order dari semua user akan tampil di sini (dari Supabase).'}
                    </p>
                </div>

                /* Table */
            ) : (
                <>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                        {['#ID', 'Order', 'Jumlah', 'Status', 'Tanggal'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((o, i) => {
                                        const s = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
                                        return (
                                            <tr key={o.id || i} style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                {/* ID */}
                                                <td style={{ padding: '11px 14px', color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, whiteSpace: 'nowrap' }}>
                                                    #{String(o.id || '—').slice(0, 8)}
                                                </td>
                                                {/* Order: layanan (bold) + email (sub) — gaya 2 baris seperti desain */}
                                                <td style={{ padding: '11px 14px', maxWidth: 380 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {o.description || o.service_name || '—'}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {o.email || '—'}
                                                    </div>
                                                </td>
                                                {/* Jumlah */}
                                                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 99, background: 'var(--red-l)', color: 'var(--red)', fontWeight: 600, fontSize: 11.5 }}>
                                                        −Rp {(o.amount || 0).toLocaleString('id-ID')}
                                                    </span>
                                                </td>
                                                {/* Status */}
                                                <td style={{ padding: '11px 14px' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', display: 'inline-flex' }}>
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
                    </div>

                    <Pagination page={page} totalPages={totalPages} perPage={perPage} setPerPage={setPerPage} setPage={setPage} totalItems={filtered.length} />
                </>
            )}
        </div>
    );
}