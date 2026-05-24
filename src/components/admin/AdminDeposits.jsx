import { useState, useEffect } from 'react';
import { DollarSign, Plus, X, CheckCircle, XCircle } from 'lucide-react';
export default function AdminDeposits() {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [manualEmail, setManualEmail] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [manualNote, setManualNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState('');
    const [approvingId, setApprovingId] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null); // { type: 'approve'|'reject', t }

    const load = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('admin_token') || '';
            const res = await fetch('/api/admin-api?action=get_deposits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setDeposits(data.deposits || []);
        } catch (e) {
            console.error('Gagal load deposits:', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    const totalDeposit = deposits.filter(t => t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPending = deposits.filter(t => t.status === 'pending' || t.status === 'pending_webhook').length;

    const handleApprove = async (t) => {
        setApprovingId(t.id);
        const token = sessionStorage.getItem('admin_token') || '';
        const res = await fetch('/api/admin-api?action=approve_deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: t.id, email: t.email, amount: t.amount }),
        });
        const data = await res.json();
        setApprovingId(null);
        setConfirmModal(null);
        if (data.ok) { load(); }
        else { alert('Gagal approve: ' + (data.error || 'Unknown error')); }
    };

    const handleReject = async (t) => {
        setApprovingId(t.id);
        const token = sessionStorage.getItem('admin_token') || '';
        await fetch('/api/admin-api?action=reject_deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: t.id }),
        });
        setApprovingId(null);
        setConfirmModal(null);
        load();
    };

    const exportCSV = () => {
        if (!deposits.length) return;
        const keys = ['id', 'email', 'amount', 'description', 'status', 'created_at'];
        const csv = [keys.join(','), ...deposits.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `deposits_${new Date().toISOString().slice(0, 10)}.csv` });
        a.click();
    };

    const handleManualDeposit = async () => {
        setSubmitMsg('');
        const amount = parseInt(manualAmount);
        if (!manualEmail || !manualEmail.includes('@')) return setSubmitMsg('Email tidak valid.');
        if (!amount || amount <= 0) return setSubmitMsg('Jumlah tidak valid.');

        setSubmitting(true);
        const token = sessionStorage.getItem('admin_token') || '';
        const res = await fetch('/api/admin-api?action=manual_deposit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                email: manualEmail.trim().toLowerCase(),
                amount,
                note: manualNote || 'Deposit manual oleh admin',
            }),
        });
        const data = await res.json();
        setSubmitting(false);
        if (data.ok) {
            setSubmitMsg('✅ Deposit berhasil ditambahkan!');
            setManualEmail('');
            setManualAmount('');
            setManualNote('');
            load();
            setTimeout(() => { setShowModal(false); setSubmitMsg(''); }, 1500);
        } else {
            setSubmitMsg('❌ ' + (data.error || 'Gagal menambahkan deposit.'));
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Riwayat Deposit</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{deposits.length} transaksi deposit.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowModal(true)} style={{ height: 36, padding: '0 14px', borderRadius: 9, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--blue)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                        <Plus size={14} /> Deposit Manual
                    </button>
                    {deposits.length > 0 && (
                        <button onClick={exportCSV} style={{ height: 36, padding: '0 10px', borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                            ↓ CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Modal Deposit Manual */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Deposit Manual</div>
                            <button onClick={() => { setShowModal(false); setSubmitMsg(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={18} /></button>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Email User</label>
                            <input
                                className="inp"
                                type="email"
                                placeholder="user@email.com"
                                value={manualEmail}
                                onChange={e => setManualEmail(e.target.value)}
                                style={{ width: '100%', fontSize: 13 }}
                            />
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Jumlah (Rp)</label>
                            <input
                                className="inp"
                                type="number"
                                placeholder="50000"
                                value={manualAmount}
                                onChange={e => setManualAmount(e.target.value)}
                                style={{ width: '100%', fontSize: 13 }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Catatan (opsional)</label>
                            <input
                                className="inp"
                                type="text"
                                placeholder="Transfer BCA, bonus, dll"
                                value={manualNote}
                                onChange={e => setManualNote(e.target.value)}
                                style={{ width: '100%', fontSize: 13 }}
                            />
                        </div>

                        {submitMsg && (
                            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 9, background: submitMsg.startsWith('✅') ? 'var(--green-l)' : 'var(--red-l)', color: submitMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                                {submitMsg}
                            </div>
                        )}

                        <button
                            onClick={handleManualDeposit}
                            disabled={submitting}
                            className="btn btn-blue"
                            style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14 }}
                        >
                            {submitting ? 'Memproses...' : 'Tambah Saldo'}
                        </button>
                    </div>
                </div>
            )}

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
                                {['Tanggal', 'Email User', 'Keterangan', 'Jumlah', 'Status', 'Aksi'].map(h => (
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
                                            const color = s === 'success' ? 'var(--green)' : s === 'pending' || s === 'pending_webhook' ? 'var(--yellow)' : 'var(--red)';
                                            const bg = s === 'success' ? 'var(--green-l)' : s === 'pending' || s === 'pending_webhook' ? 'var(--yellow-l)' : 'var(--red-l)';
                                            const label = s === 'success' ? 'Sukses' : s === 'pending' ? 'Pending' : s === 'pending_webhook' ? 'Pending Webhook' : s === 'failed' ? 'Gagal' : s || 'Pending';
                                            return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: '3px 9px', borderRadius: 20 }}>{label}</span>;
                                        })()}
                                    </td>
                                    <td style={{ padding: '11px 14px' }}>
                                        {(t.status === 'pending' || t.status === 'pending_webhook') && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button
                                                    onClick={() => setConfirmModal({ type: 'approve', t })}
                                                    disabled={approvingId === t.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: approvingId === t.id ? 0.6 : 1 }}>
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                                <button
                                                    onClick={() => setConfirmModal({ type: 'reject', t })}
                                                    disabled={approvingId === t.id}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: 'var(--red-l)', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                    <XCircle size={12} /> Tolak
                                                </button>
                                            </div>
                                        )}
                                        {t.status === 'success' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>}
                                        {t.status === 'failed' && <span style={{ fontSize: 12, color: 'var(--red)' }}>Ditolak</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* Modal Konfirmasi Approve/Reject */}
            {confirmModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: confirmModal.type === 'approve' ? 'var(--green-l)' : 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {confirmModal.type === 'approve' ? <CheckCircle size={20} style={{ color: 'var(--green)' }} /> : <XCircle size={20} style={{ color: 'var(--red)' }} />}
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                                    {confirmModal.type === 'approve' ? 'Approve Deposit' : 'Tolak Deposit'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{confirmModal.t.email}</div>
                            </div>
                        </div>
                        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                <span style={{ color: 'var(--text3)' }}>Jumlah</span>
                                <strong style={{ color: 'var(--text)' }}>Rp {(confirmModal.t.amount || 0).toLocaleString('id-ID')}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: 'var(--text3)' }}>Keterangan</span>
                                <span style={{ color: 'var(--text2)', maxWidth: 200, textAlign: 'right', fontSize: 12 }}>{confirmModal.t.description || '-'}</span>
                            </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
                            {confirmModal.type === 'approve'
                                ? 'Saldo user akan langsung bertambah setelah di-approve.'
                                : 'Deposit ini akan ditandai gagal dan saldo tidak akan bertambah.'}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setConfirmModal(null)}
                                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                Batal
                            </button>
                            <button
                                onClick={() => confirmModal.type === 'approve' ? handleApprove(confirmModal.t) : handleReject(confirmModal.t)}
                                disabled={approvingId === confirmModal.t.id}
                                style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', background: confirmModal.type === 'approve' ? 'var(--green)' : 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", opacity: approvingId ? 0.7 : 1 }}>
                                {approvingId ? 'Memproses...' : confirmModal.type === 'approve' ? '✓ Approve' : '✕ Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}