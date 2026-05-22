import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminDeposits() {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', 'deposit')
            .order('created_at', { ascending: false });
        setDeposits(data || []);
        setLoading(false);
    };

    // ✅ Auto-refresh setiap 60 detik
    useEffect(() => {
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    const totalDeposit = deposits.filter(t => t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPending = deposits.filter(t => t.status === 'pending').length;

    const exportCSV = () => {
        if (!deposits.length) return;
        const keys = ['id', 'email', 'amount', 'description', 'status', 'created_at'];
        const csv = [keys.join(','), ...deposits.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `deposits_${new Date().toISOString().slice(0, 10)}.csv` });
        a.click();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Riwayat Deposit</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{deposits.length} transaksi deposit.</p>
                </div>
                {/* ✅ Hanya tombol Export CSV, lebih kecil */}
                {deposits.length > 0 && (
                    <button onClick={exportCSV} style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                        ↓ CSV
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                {[
                    { l: 'Total Deposit (Sukses)', v: `Rp ${totalDeposit.toLocaleString('id-ID')}`, c: 'var(--green)' },
                    { l: 'Jumlah Transaksi', v: deposits.length, c: 'var(--blue)' },
                    { l: 'Menunggu Konfirmasi', v: totalPending, c: 'var(--yellow)' },
                ].map(s => (
                    <div key={s.l} className="card" style={{ padding: 20 }}>
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>{s.l}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Memuat data...</p>
                </div>
            ) : deposits.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <DollarSign size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada deposit</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Deposit user akan muncul di sini.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                {['Tanggal', 'Email User', 'Keterangan', 'Jumlah', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {deposits.map((t, i) => (
                                <tr key={t.id || i} style={{ borderBottom: i < deposits.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12 }}>
                                        {new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '11px 14px', color: 'var(--text2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t.email || '-'}</td>
                                    <td style={{ padding: '11px 14px', color: 'var(--text2)', fontSize: 12 }}>{t.description || '-'}</td>
                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)' }}>+Rp {(t.amount || 0).toLocaleString('id-ID')}</td>
                                    <td style={{ padding: '11px 14px' }}>
                                        {(() => {
                                            const s = t.status;
                                            const color = s === 'success' ? 'var(--green)' : s === 'pending' ? 'var(--yellow)' : 'var(--red)';
                                            const bg = s === 'success' ? 'var(--green-l)' : s === 'pending' ? 'var(--yellow-l)' : 'var(--red-l)';
                                            const label = s === 'success' ? 'Sukses' : s === 'pending' ? 'Pending' : s === 'failed' ? 'Gagal' : s || 'Pending';
                                            return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 20 }}>{label}</span>;
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}