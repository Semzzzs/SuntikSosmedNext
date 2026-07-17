import { useState, useEffect } from 'react';
import { DollarSign, Plus, X, CheckCircle, XCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const adminFetch = async (url, opts = {}) => {
    const res = await fetch(url, {
        ...opts,
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}`, ...(opts.headers || {}) },
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
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminFetch('/api/admin-api?action=get_deposits');
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

    useEffect(() => { setPage(0); }, [search]);

    const totalDeposit = deposits.filter(t => t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    const totalPending = deposits.filter(t => t.status === 'pending' || t.status === 'pending_webhook').length;

    const filtered = deposits.filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return t.email?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.status?.toLowerCase().includes(q);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const paged = filtered.slice(page * perPage, (page + 1) * perPage);

    const handleApprove = async (t) => {
        setApprovingId(t.id);
        const res = await adminFetch('/api/admin-api?action=approve_deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        await adminFetch('/api/admin-api?action=reject_deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const res = await adminFetch('/api/admin-api?action=manual_deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

    // ── Gaya bersama (match desain admin page) ──
    const ghostBtn = (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 7,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        border: '1px solid var(--border)', background: 'var(--white)', color,
    });
    const pill = (color, bg) => ({
        display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
        padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', color, background: bg,
    });
    const inp = {
        width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)',
        fontSize: 13, fontFamily: 'inherit', outline: 'none',
    };
    const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
    const modalBox = { background: 'var(--white)', borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.28)', border: '1px solid var(--border)' };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 2, letterSpacing: '-.3px' }}>Riwayat Deposit</h1>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>{deposits.length} transaksi deposit.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {deposits.length > 0 && (
                        <button onClick={exportCSV} style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            ↑ Export
                        </button>
                    )}
                    {/* CTA gelap ala "Create Workflow" di desain — adaptif dark mode */}
                    <button onClick={() => setShowModal(true)} style={{ height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--text)', border: 'none', color: 'var(--white)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <Plus size={13} /> Deposit Manual
                    </button>
                </div>
            </div>

            {/* Modal Deposit Manual — flat */}
            {showModal && (
                <div style={modalBackdrop} onClick={() => { setShowModal(false); setSubmitMsg(''); }}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--green-l)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={16} /></div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Deposit Manual</div>
                            <button onClick={() => { setShowModal(false); setSubmitMsg(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}><X size={17} /></button>
                        </div>
                        <div style={{ padding: '18px 22px 22px' }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 7 }}>Email User</label>
                            <input type="email" placeholder="user@email.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} style={{ ...inp, marginBottom: 12 }}
                                onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 7 }}>Jumlah (Rp)</label>
                            <input type="number" placeholder="50000" value={manualAmount} onChange={e => setManualAmount(e.target.value)} style={{ ...inp, marginBottom: 12 }}
                                onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 7 }}>Catatan (opsional)</label>
                            <input type="text" placeholder="Transfer BCA, bonus, dll" value={manualNote} onChange={e => setManualNote(e.target.value)} style={{ ...inp, marginBottom: 16 }}
                                onFocus={e => e.target.style.borderColor = 'var(--blue)'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />

                            {submitMsg && (
                                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: `1px solid ${submitMsg.startsWith('✅') ? 'rgba(22,163,74,.25)' : 'rgba(239,68,68,.25)'}`, background: submitMsg.startsWith('✅') ? 'var(--green-l)' : 'var(--red-l)', color: submitMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
                                    {submitMsg.replace('✅ ', '').replace('❌ ', '')}
                                </div>
                            )}

                            <button onClick={handleManualDeposit} disabled={submitting}
                                style={{ width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.6 : 1 }}>
                                {submitting ? 'Memproses...' : 'Tambah Saldo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stat cards flat + segbars (match desain) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                {[
                    { l: 'Total Deposit (Sukses)', v: `Rp ${totalDeposit.toLocaleString('id-ID')}`, c: 'var(--green)', f: 5 },
                    { l: 'Jumlah Transaksi', v: deposits.length, c: 'var(--blue)', f: 4 },
                    { l: 'Menunggu Konfirmasi', v: totalPending, c: 'var(--yellow)', f: 2 },
                ].map(s => (
                    <div key={s.l} className="card" style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 2 }}>{s.l}</div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.v}</div>
                        <SegBars color={s.c} filled={s.f} />
                    </div>
                ))}
            </div>

            {/* Toolbar: search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 260 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input
                        placeholder="Cari email atau keterangan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 30px', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>
            </div>

            {loading ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Memuat data...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <DollarSign size={38} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', marginBottom: 6 }}>{search ? 'Deposit tidak ditemukan' : 'Belum ada deposit'}</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>{search ? `Tidak ada deposit yang cocok dengan "${search}"` : 'Deposit user akan muncul di sini.'}</p>
                </div>
            ) : (
                <>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                        {['Deposit', 'Jumlah', 'Status', 'Tanggal', 'Aksi'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paged.map((t, i) => (
                                        <tr key={t.id || i} style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {/* Deposit: keterangan (bold) + email (sub) — gaya 2 baris seperti desain */}
                                            <td style={{ padding: '11px 14px', maxWidth: 340 }}>
                                                <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t.description || 'Deposit'}
                                                </div>
                                                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t.email || '—'}
                                                </div>
                                            </td>
                                            {/* Jumlah: pill hijau */}
                                            <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                                                <span style={pill('var(--green)', 'var(--green-l)')}>+Rp {(t.amount || 0).toLocaleString('id-ID')}</span>
                                            </td>
                                            {/* Status */}
                                            <td style={{ padding: '11px 14px' }}>
                                                {(() => {
                                                    const s = t.status;
                                                    const color = s === 'success' ? 'var(--green)' : s === 'pending' || s === 'pending_webhook' ? 'var(--yellow)' : 'var(--red)';
                                                    const bg = s === 'success' ? 'var(--green-l)' : s === 'pending' || s === 'pending_webhook' ? 'var(--yellow-l)' : 'var(--red-l)';
                                                    const label = s === 'success' ? 'Sukses' : s === 'pending' ? 'Pending' : s === 'pending_webhook' ? 'Pending Webhook' : s === 'failed' ? 'Gagal' : s || 'Pending';
                                                    return <span style={pill(color, bg)}>{label}</span>;
                                                })()}
                                            </td>
                                            {/* Tanggal */}
                                            <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                {new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            {/* Aksi: ghost buttons */}
                                            <td style={{ padding: '11px 14px' }}>
                                                {(t.status === 'pending' || t.status === 'pending_webhook') ? (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button onClick={() => setConfirmModal({ type: 'approve', t })} disabled={approvingId === t.id}
                                                            style={{ ...ghostBtn('var(--green)'), opacity: approvingId === t.id ? 0.6 : 1 }}>
                                                            <CheckCircle size={11} /> Approve
                                                        </button>
                                                        <button onClick={() => setConfirmModal({ type: 'reject', t })} disabled={approvingId === t.id}
                                                            style={ghostBtn('var(--red)')}>
                                                            <XCircle size={11} /> Tolak
                                                        </button>
                                                    </div>
                                                ) : t.status === 'failed' ? (
                                                    <span style={{ fontSize: 12, color: 'var(--red)' }}>Ditolak</span>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Pagination page={page} totalPages={totalPages} perPage={perPage} setPerPage={setPerPage} setPage={setPage} totalItems={filtered.length} />
                </>
            )}

            {/* Modal Konfirmasi Approve/Reject — flat */}
            {confirmModal && (
                <div style={modalBackdrop} onClick={() => setConfirmModal(null)}>
                    <div style={modalBox} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: confirmModal.type === 'approve' ? 'var(--green-l)' : 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {confirmModal.type === 'approve' ? <CheckCircle size={17} style={{ color: 'var(--green)' }} /> : <XCircle size={17} style={{ color: 'var(--red)' }} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                                    {confirmModal.type === 'approve' ? 'Approve Deposit' : 'Tolak Deposit'}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{confirmModal.t.email}</div>
                            </div>
                        </div>
                        <div style={{ padding: '18px 22px 22px' }}>
                            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                    <span style={{ color: 'var(--text3)' }}>Jumlah</span>
                                    <strong style={{ color: 'var(--text)', fontWeight: 700 }}>Rp {(confirmModal.t.amount || 0).toLocaleString('id-ID')}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text3)' }}>Keterangan</span>
                                    <span style={{ color: 'var(--text2)', maxWidth: 200, textAlign: 'right', fontSize: 12 }}>{confirmModal.t.description || '-'}</span>
                                </div>
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                                {confirmModal.type === 'approve'
                                    ? 'Saldo user akan langsung bertambah setelah di-approve.'
                                    : 'Deposit ini akan ditandai gagal dan saldo tidak akan bertambah.'}
                            </p>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setConfirmModal(null)}
                                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Batal
                                </button>
                                <button
                                    onClick={() => confirmModal.type === 'approve' ? handleApprove(confirmModal.t) : handleReject(confirmModal.t)}
                                    disabled={approvingId === confirmModal.t.id}
                                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: confirmModal.type === 'approve' ? 'var(--green)' : 'var(--red)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: approvingId ? 0.7 : 1 }}>
                                    {approvingId ? 'Memproses...' : confirmModal.type === 'approve' ? 'Approve' : 'Tolak'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}