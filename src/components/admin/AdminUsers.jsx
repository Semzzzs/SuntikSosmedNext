import { useState, useEffect } from 'react';
import { DollarSign, Users, MinusCircle, Ban, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

// ✅ Single query untuk semua user sekaligus — bukan N query terpisah
// ✅ Hitung saldo per-email via admin-api (service role) — bukan anon supabase
//    yang bisa ketolak RLS. Sertakan kolom status agar filter benar.
async function getAllBalances(emails) {
    if (!emails.length) return {};
    const map = {};
    for (const email of emails) map[email] = 0;
    try {
        const res = await adminFetch('/api/admin-api?action=get_transactions_all');
        const json = await res.json();
        const list = json.transactions || [];
        const wanted = new Set(emails);
        for (const t of list) {
            if (!t.email || !wanted.has(t.email) || t.status !== 'success') continue;
            const masuk = ['deposit', 'bonus', 'refund'].includes(t.type) ? (t.amount || 0) : 0;
            const keluar = ['order', 'purchase'].includes(t.type) ? (t.amount || 0) : 0;
            map[t.email] = (map[t.email] || 0) + masuk - keluar;
        }
    } catch (e) {
        // biarkan map default 0 kalau gagal
    }
    // clamp ke 0
    for (const k of Object.keys(map)) map[k] = Math.max(0, map[k]);
    return map;
}

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [balances, setBalances] = useState({});
    const [modal, setModal] = useState(null);
    const [amount, setAmount] = useState('');
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);

    const load = async () => {
        setLoadingUsers(true);

        // Ambil users via admin-api (pakai service role - bypass RLS)
        const res = await adminFetch('/api/admin-api?action=get_users');
        const apiData = await res.json();

        if (apiData.users) {
            // Ambil saldo dari transactions via admin-api
            const txRes = await adminFetch('/api/admin-api?action=get_transactions_all');
            const txData = await txRes.json();
            const txList = txData.transactions || [];

            const balanceMap = {};
            // ✅ Init semua email ke 0 — hindari "Rp ..." untuk user tanpa transaksi
            for (const u of apiData.users) { if (u.email) balanceMap[u.email] = 0; }
            for (const t of txList) {
                if (!t.email || t.status !== 'success') continue;
                const masuk = ['deposit', 'bonus', 'refund'].includes(t.type) ? (t.amount || 0) : 0;
                const keluar = ['order', 'purchase'].includes(t.type) ? (t.amount || 0) : 0;
                balanceMap[t.email] = (balanceMap[t.email] || 0) + masuk - keluar;
            }
            // ✅ Clamp ke 0 — hindari nilai negatif
            for (const k of Object.keys(balanceMap)) balanceMap[k] = Math.max(0, balanceMap[k]);

            setUsers(apiData.users.map(u => ({
                ...u,
                balance: Math.max(0, balanceMap[u.email] || 0),
            })));
            setBalances(balanceMap); // ✅ FIX: sync state saldo agar tabel render angka
            setLoadingUsers(false);
            return;
        }

        // Fallback: coba langsung (mungkin gagal karena RLS)
        const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
        const blockedEmails = blockData?.value ? JSON.parse(blockData.value) : [];
        const { data: authData, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

        let userList = [];
        if (!error && authData && authData.length > 0) {
            // Kalau ada tabel profiles
            userList = authData.map(u => ({
                id: u.id,
                email: u.email,
                name: u.full_name || u.name || u.email?.split('@')[0],
                createdAt: u.created_at,
                blocked: blockedEmails.includes(u.email),
            }));
        } else {
            // Fallback: ambil dari tabel transactions (kumpulkan email unik)
            const { data: txData } = await supabase.from('transactions').select('email, created_at').order('created_at', { ascending: true });
            const seen = new Set();
            userList = (txData || []).filter(t => {
                if (!t.email || seen.has(t.email)) return false;
                seen.add(t.email);
                return true;
            }).map(t => ({
                email: t.email,
                name: t.email?.split('@')[0],
                createdAt: t.created_at,
                blocked: blockedEmails.includes(t.email),
            }));
        }

        setUsers(userList);
        setLoadingUsers(false);

        // ✅ Single query untuk semua balance sekaligus
        const map = await getAllBalances(userList.map(u => u.email).filter(Boolean));
        setBalances(map);
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, []);

    const toggleBlock = async (email) => {
        const user = users.find(u => u.email === email);
        if (!user) return;
        const newBlocked = !user.blocked;
        // Optimistic update UI
        setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked: newBlocked } : u));

        // ✅ Hitung daftar blokir terbaru dari state, lalu kirim via admin-api (service role)
        const blocked_emails = users
            .map(u => u.email === email ? { ...u, blocked: newBlocked } : u)
            .filter(u => u.blocked)
            .map(u => u.email);

        try {
            const res = await adminFetch('/api/admin-api?action=toggle_block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, blocked_emails }),
            });
            if (!res.ok) throw new Error('toggle_block failed');
        } catch (e) {
            // Rollback kalau gagal
            setUsers(prev => prev.map(u => u.email === email ? { ...u, blocked: !newBlocked } : u));
        }
    };

    const handleSaldo = async () => {
        const val = parseInt(amount);
        // ✅ Validasi lebih ketat
        if (!val || val <= 0 || !isFinite(val)) return;
        if (val > 100_000_000) { setMsg('❌ Maksimal Rp 100.000.000 per transaksi'); return; }

        setLoading(true);
        const curBalance = balances[modal.email] || 0;
        if (modal.type === 'kurang' && val > curBalance) {
            setMsg(`❌ Saldo tidak cukup (saldo: Rp ${curBalance.toLocaleString('id-ID')})`);
            setLoading(false);
            return;
        }

        try {
            // ✅ Lewat admin-api (service role) — bukan direct Supabase (ditolak RLS)
            const res = await adminFetch('/api/admin-api?action=manual_deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: modal.email,
                    amount: val,
                    mode: modal.type === 'add' ? 'add' : 'deduct',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                setMsg(`❌ Gagal: ${data.error || `HTTP ${res.status}`}`);
            } else {
                setMsg(modal.type === 'add'
                    ? `✅ +Rp ${val.toLocaleString('id-ID')} berhasil ditambahkan`
                    : `✅ -Rp ${val.toLocaleString('id-ID')} berhasil dikurangi`
                );
                // ✅ Refresh balance user ini saja
                const updated = await getAllBalances([modal.email]);
                setBalances(prev => ({ ...prev, ...updated }));
            }
        } catch (e) {
            setMsg(`❌ Gagal: ${e.message}`);
        }

        setAmount('');
        setLoading(false);
        setTimeout(() => { setModal(null); setMsg(''); }, 2000);
    };

    const [search, setSearch] = useState('');
    const filteredUsers = users.filter(u =>
        !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>User Management</h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{users.length} user terdaftar.</p>
                </div>
                <input className="inp" placeholder="Cari email atau nama..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ width: 260, fontSize: 13 }} />
            </div>

            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--bg)', borderRadius: 18, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
                        <div style={{ padding: '20px 24px', background: modal.type === 'add' ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: '.06em', marginBottom: 6 }}>{modal.type === 'add' ? 'TAMBAH SALDO' : 'KURANGI SALDO'}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{modal.email}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>Saldo saat ini</span>
                                <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Rp {(balances[modal.email] || 0).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                        <div style={{ padding: '22px 24px 24px' }}>
                            {msg ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: msg.startsWith('✅') ? 'var(--green-l)' : 'var(--red-l)', borderRadius: 12, border: `1.5px solid ${msg.startsWith('✅') ? 'var(--green)' : 'var(--red)'}` }}>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg.replace('✅ ', '').replace('❌ ', '')}</span>
                                </div>
                            ) : (
                                <>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>Jumlah (Rp)</label>
                                    <input className="inp" type="number" placeholder="Masukkan jumlah..." value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: 14, fontSize: 18, fontWeight: 700 }} autoFocus />
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                                        {[5000, 10000, 20000, 50000, 100000, 500000].map(n => (
                                            <button key={n} onClick={() => setAmount(String(n))} style={{ padding: '9px 0', borderRadius: 10, border: `1.5px solid ${amount === String(n) ? (modal.type === 'add' ? '#16a34a' : '#dc2626') : 'var(--border)'}`, background: amount === String(n) ? (modal.type === 'add' ? '#dcfce7' : '#fee2e2') : 'var(--bg2)', color: amount === String(n) ? (modal.type === 'add' ? '#16a34a' : '#dc2626') : 'var(--text2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: 'center' }}>
                                                Rp {(n / 1000).toFixed(0)}K
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button onClick={() => { setModal(null); setAmount(''); }} style={{ flex: 1, padding: '11px 0', borderRadius: 11, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Batal</button>
                                        <button onClick={handleSaldo} disabled={!amount || parseInt(amount) <= 0 || loading} style={{ flex: 2, padding: '11px 0', borderRadius: 11, border: 'none', background: modal.type === 'add' ? '#16a34a' : '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: loading ? 0.7 : 1 }}>
                                            {loading ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> : modal.type === 'add' ? <DollarSign size={15} /> : <MinusCircle size={15} />}
                                            {modal.type === 'add' ? 'Tambahkan Saldo' : 'Kurangi Saldo'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loadingUsers ? (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                    <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                </div>
            ) : users.length === 0 ? (
                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                    <Users size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada user terdaftar</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>User yang register via /register akan muncul di sini.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                {['Nama', 'Email', 'Saldo', 'Tanggal Daftar', 'Status', 'Aksi'].map(h => (
                                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u, i) => (
                                <tr key={u.email} style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none', opacity: u.blocked ? 0.6 : 1 }}>
                                    <td style={{ padding: '11px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 10, background: u.blocked ? 'var(--text3)' : 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                                                {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{u.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '11px 14px', color: 'var(--text2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{u.email}</td>
                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>Rp {(balances[u.email] ?? '...').toLocaleString?.('id-ID') ?? '...'}</td>
                                    <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '—'}</td>
                                    <td style={{ padding: '11px 14px' }}>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: u.blocked ? 'var(--red)' : 'var(--green)', background: u.blocked ? 'var(--red-l)' : 'var(--green-l)', padding: '3px 9px', borderRadius: 20 }}>
                                            {u.blocked ? 'Diblokir' : 'Aktif'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '11px 14px' }}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button onClick={() => { setModal({ type: 'add', email: u.email }); setAmount(''); }} style={{ background: 'var(--green-l)', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, padding: '5px 9px', borderRadius: 8 }}>
                                                <DollarSign size={11} /> +Saldo
                                            </button>
                                            <button onClick={() => { setModal({ type: 'kurang', email: u.email }); setAmount(''); }} style={{ background: 'var(--red-l)', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, padding: '5px 9px', borderRadius: 8 }}>
                                                <MinusCircle size={11} /> -Saldo
                                            </button>
                                            <button onClick={() => toggleBlock(u.email)} style={{ background: u.blocked ? 'var(--green-l)' : 'var(--yellow-l)', border: 'none', cursor: 'pointer', color: u.blocked ? 'var(--green)' : 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, padding: '5px 9px', borderRadius: 8 }}>
                                                {u.blocked ? <CheckCircle size={11} /> : <Ban size={11} />} {u.blocked ? 'Unblock' : 'Blokir'}
                                            </button>
                                        </div>
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