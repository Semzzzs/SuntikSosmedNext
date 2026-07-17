import { useState, useEffect } from 'react';
import { DollarSign, Users, MinusCircle, Ban, CheckCircle, ArrowDownCircle, ArrowUpCircle, ShoppingCart, ChevronLeft, ChevronRight, Search } from 'lucide-react';

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

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [balances, setBalances] = useState({});
    const [spends, setSpends] = useState({}); // total belanja (order) per email
    const [deposits, setDeposits] = useState({}); // total masuk per email
    const [detailUser, setDetailUser] = useState(null); // baris user yang dibuka detailnya
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
            const spendMap = {};
            const depositMap = {};
            // ✅ Init semua email ke 0 — hindari "Rp ..." untuk user tanpa transaksi
            for (const u of apiData.users) { if (u.email) { balanceMap[u.email] = 0; spendMap[u.email] = 0; depositMap[u.email] = 0; } }
            for (const t of txList) {
                if (!t.email || t.status !== 'success') continue;
                const masuk = ['deposit', 'bonus', 'refund'].includes(t.type) ? (t.amount || 0) : 0;
                const keluar = ['order', 'purchase'].includes(t.type) ? (t.amount || 0) : 0;
                balanceMap[t.email] = (balanceMap[t.email] || 0) + masuk - keluar;
                if (keluar) spendMap[t.email] = (spendMap[t.email] || 0) + keluar; // akumulasi belanja
                if (masuk) depositMap[t.email] = (depositMap[t.email] || 0) + masuk; // akumulasi deposit
            }
            // ✅ Clamp ke 0 — hindari nilai negatif
            for (const k of Object.keys(balanceMap)) balanceMap[k] = Math.max(0, balanceMap[k]);

            setUsers(apiData.users.map(u => ({
                ...u,
                balance: Math.max(0, balanceMap[u.email] || 0),
                spend: spendMap[u.email] || 0,
                deposit: depositMap[u.email] || 0,
            })));
            setBalances(balanceMap); // ✅ FIX: sync state saldo agar tabel render angka
            setSpends(spendMap);
            setDeposits(depositMap);
            setLoadingUsers(false);
            return;
        }

        // Fallback: ambil via admin-api (service role, bypass RLS)
        // Ambil blocked emails via admin-api
        let blockedEmails = [];
        try {
            const blockRes = await adminFetch('/api/admin-api?action=get_settings&key=blocked_emails');
            const blockData = await blockRes.json();
            blockedEmails = blockData?.value ? JSON.parse(blockData.value) : [];
        } catch (e) { /* biarkan kosong jika gagal */ }

        // Ambil transaksi untuk derive email unik sebagai fallback user list
        let userList = [];
        try {
            const txRes = await adminFetch('/api/admin-api?action=get_transactions_all');
            const txData = await txRes.json();
            const seen = new Set();
            userList = (txData.transactions || []).filter(t => {
                if (!t.email || seen.has(t.email)) return false;
                seen.add(t.email);
                return true;
            }).map(t => ({
                email: t.email,
                name: t.email?.split('@')[0],
                createdAt: t.created_at,
                blocked: blockedEmails.includes(t.email),
            }));
        } catch (e) { /* userList tetap kosong */ }

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
                    note: creditNote || undefined,
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
        setTimeout(() => { setModal(null); setMsg(''); setCreditNote(''); }, 2000);
    };

    const [userTx, setUserTx] = useState([]); // transaksi untuk user yang dibuka detailnya
    const [loadingTx, setLoadingTx] = useState(false);
    const [showTx, setShowTx] = useState(false); // toggle tampil riwayat
    const [txTab, setTxTab] = useState('order'); // 'order' | 'deposit'
    const [userDetailData, setUserDetailData] = useState(null); // { orders, deposits, balance, totalMasuk, totalKeluar }
    const [creditNote, setCreditNote] = useState('');

    const loadUserTx = async (email) => {
        setLoadingTx(true);
        setUserTx([]);
        setUserDetailData(null);
        setTxTab('order');
        try {
            // Coba endpoint get_user_detail dulu (returns orders & deposits terpisah)
            const res = await adminFetch(`/api/admin-api?action=get_user_detail&email=${encodeURIComponent(email)}`);
            if (res.ok) {
                const json = await res.json();
                if (json.orders || json.deposits) {
                    setUserDetailData(json);
                    setUserTx(json.orders || []);
                    setLoadingTx(false);
                    return;
                }
            }
            // Fallback: get_user_transactions (campur semua tipe)
            const res2 = await adminFetch(`/api/admin-api?action=get_user_transactions&email=${encodeURIComponent(email)}`);
            const json2 = await res2.json();
            setUserTx(json2.transactions || []);
        } catch (e) {
            setUserTx([]);
        }
        setLoadingTx(false);
    };

    const txTypeLabel = (type) => {
        const map = { deposit: 'Deposit', bonus: 'Bonus', refund: 'Refund', order: 'Order', purchase: 'Pembelian' };
        return map[type] || type || '—';
    };
    const txTypeIcon = (type) => {
        if (['deposit', 'bonus', 'refund'].includes(type)) return <ArrowDownCircle size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />;
        if (['order', 'purchase'].includes(type)) return <ArrowUpCircle size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />;
        return <ShoppingCart size={13} style={{ color: 'var(--text3)', flexShrink: 0 }} />;
    };
    const txSign = (type) => ['deposit', 'bonus', 'refund'].includes(type) ? '+' : '-';
    const txColor = (type) => ['deposit', 'bonus', 'refund'].includes(type) ? 'var(--green)' : 'var(--red)';

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [perPage, setPerPage] = useState(10);
    useEffect(() => { setPage(0); }, [search]);

    const filteredUsers = users.filter(u =>
        !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
    );
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / perPage));
    const pagedUsers = filteredUsers.slice(page * perPage, (page + 1) * perPage);

    const totalSaldo = Object.values(balances).reduce((s, v) => s + Math.max(0, v || 0), 0);
    const blockedCount = users.filter(u => u.blocked).length;

    // ── Gaya bersama (match desain admin page) ──
    const ghostBtn = (color, bg) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 7,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        border: '1px solid var(--border)', background: 'var(--white)', color,
    });
    const pill = (color, bg) => ({
        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
        padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', color, background: bg,
    });

    return (
        <div>
            <style dangerouslySetInnerHTML={{
                __html: `
                .au-tr { cursor: pointer; transition: background .12s; }
                .au-td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                .au-tr:last-child .au-td { border-bottom: none; }
                .au-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn .15s ease; }
                .au-modal { background: var(--white); border-radius: 16px; width: 100%; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.28); border: 1px solid var(--border); animation: popIn .18s cubic-bezier(.2,.9,.3,1); }
                .spin { animation: spin .7s linear infinite; display: inline-block; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes popIn { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            ` }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 2, letterSpacing: '-.3px' }}>User Management</h1>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Kelola saldo, status, dan riwayat transaksi pengguna.</p>
                </div>
            </div>

            {/* Stat cards flat + segbars (match desain) */}
            {!loadingUsers && users.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
                    {[
                        { label: 'Total User', value: users.length, color: 'var(--blue)', filled: 5 },
                        { label: 'Aktif', value: users.length - blockedCount, color: 'var(--green)', filled: 5 },
                        { label: 'Diblokir', value: blockedCount, color: 'var(--red)', filled: 1 },
                        { label: 'Total Saldo User', value: 'Rp ' + Math.round(totalSaldo).toLocaleString('id-ID'), color: '#0e93c4', filled: 4 },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                            <SegBars color={s.color} filled={s.filled} />
                        </div>
                    ))}
                </div>
            )}

            {/* Toolbar: search kiri (match desain) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: 260 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                    <input
                        placeholder="Cari nama atau email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 30px', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)' }}>{filteredUsers.length} user</span>
            </div>

            {/* ── Detail user modal — flat, tanpa gradien (match desain) ── */}
            {detailUser && (
                <div className="au-modal-backdrop" onClick={() => setDetailUser(null)}>
                    <div className="au-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                        {/* Header flat */}
                        <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: '#fff', flexShrink: 0, background: detailUser.blocked ? 'var(--text3)' : 'var(--blue)' }}>
                                {(detailUser.name || detailUser.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detailUser.name || '—'}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detailUser.email}</div>
                            </div>
                            <span style={pill(detailUser.blocked ? 'var(--red)' : 'var(--green)', detailUser.blocked ? 'var(--red-l)' : 'var(--green-l)')}>
                                {detailUser.blocked ? 'Diblokir' : 'Aktif'}
                            </span>
                        </div>
                        <div style={{ padding: '18px 22px 22px' }}>
                            {/* Stat grid flat */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                                {[
                                    { l: 'Saldo', v: balances[detailUser.email] || 0, c: 'var(--green)' },
                                    { l: 'Total Deposit', v: deposits[detailUser.email] || 0, c: 'var(--blue)' },
                                    { l: 'Total Spend', v: spends[detailUser.email] || 0, c: '#9f3b5e' },
                                ].map(s => (
                                    <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 10px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 5 }}>{s.l}</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word', color: s.c }}>Rp {Math.round(s.v).toLocaleString('id-ID')}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
                                Terdaftar: {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                            </div>
                            {/* Aksi */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <button onClick={() => { setModal({ type: 'add', email: detailUser.email }); setAmount(''); setDetailUser(null); }} style={{ ...ghostBtn('var(--green)'), flex: 1, justifyContent: 'center', padding: '9px 0' }}><DollarSign size={13} /> Tambah</button>
                                <button onClick={() => { setModal({ type: 'kurang', email: detailUser.email }); setAmount(''); setDetailUser(null); }} style={{ ...ghostBtn('var(--red)'), flex: 1, justifyContent: 'center', padding: '9px 0' }}><MinusCircle size={13} /> Kurangi</button>
                                <button onClick={() => { toggleBlock(detailUser.email); setDetailUser(d => d ? { ...d, blocked: !d.blocked } : d); }} style={{ ...ghostBtn(detailUser.blocked ? 'var(--green)' : 'var(--yellow)'), flex: 1, justifyContent: 'center', padding: '9px 0' }}>{detailUser.blocked ? <CheckCircle size={13} /> : <Ban size={13} />} {detailUser.blocked ? 'Unblock' : 'Blokir'}</button>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 14px' }} />

                            {/* Tab: Riwayat Order vs Deposit — gaya tabs desain */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                                {[{ k: 'order', l: 'Order', count: userDetailData ? userDetailData.orderCount : userTx.filter(t => ['order', 'purchase'].includes(t.type)).length },
                                { k: 'deposit', l: 'Deposit', count: userDetailData ? userDetailData.depositCount : userTx.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).length }
                                ].map(tab => {
                                    const on = txTab === tab.k && showTx;
                                    return (
                                        <button key={tab.k}
                                            onClick={() => { setTxTab(tab.k); setShowTx(true); }}
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 0', borderRadius: 8, border: `1px solid ${on ? 'var(--text)' : 'var(--border)'}`, background: on ? 'var(--bg2)' : 'var(--white)', color: on ? 'var(--text)' : 'var(--text2)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                                            {tab.l}
                                            {tab.count > 0 && <span style={{ fontSize: 10, fontWeight: 600, background: on ? 'var(--text)' : 'var(--text3)', color: 'var(--white)', borderRadius: 20, padding: '2px 7px' }}>{tab.count}</span>}
                                        </button>
                                    );
                                })}
                                {showTx && <button onClick={() => setShowTx(false)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>✕</button>}
                            </div>

                            {showTx && (
                                <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)' }}>
                                    {loadingTx ? (
                                        <div style={{ padding: '28px 0', textAlign: 'center' }}>
                                            <span style={{ width: 20, height: 20, border: '2.5px solid var(--border)', borderTop: '2.5px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                                        </div>
                                    ) : (() => {
                                        // Pilih data dari get_user_detail jika tersedia, fallback ke userTx
                                        const listOrders = userDetailData
                                            ? (userDetailData.orders || [])
                                            : userTx.filter(t => ['order', 'purchase'].includes(t.type));
                                        const listDeposits = userDetailData
                                            ? (userDetailData.deposits || [])
                                            : userTx.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type));
                                        const list = txTab === 'order' ? listOrders : listDeposits;

                                        if (list.length === 0) return (
                                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                                                {txTab === 'order' ? 'Belum ada order.' : 'Belum ada deposit.'}
                                            </div>
                                        );
                                        return list.map((t, i) => (
                                            <div key={t.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <div style={{ marginTop: 2 }}>{txTypeIcon(t.type)}</div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                                                            {txTypeLabel(t.type)}
                                                            {t.order_id && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>#{t.order_id}</span>}
                                                            {t.status && t.status !== 'success' && (
                                                                <span style={{ marginLeft: 6, ...pill(t.status === 'pending' ? 'var(--yellow)' : 'var(--red)', t.status === 'pending' ? 'var(--yellow-l)' : 'var(--red-l)'), fontSize: 10, padding: '2px 7px' }}>{t.status}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: txColor(t.type), flexShrink: 0 }}>
                                                            {txSign(t.type)}Rp {Math.round(t.amount || 0).toLocaleString('id-ID')}
                                                        </div>
                                                    </div>
                                                    {(t.description || t.service_id) && (
                                                        <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {t.description || `Layanan #${t.service_id}`}
                                                        </div>
                                                    )}
                                                    {(t.qty || t.link) && (
                                                        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                                                            {t.qty && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Qty: <b style={{ color: 'var(--text2)' }}>{Number(t.qty).toLocaleString('id-ID')}</b></span>}
                                                            {t.link && <a href={t.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.link}</a>}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                                                        {t.created_at ? new Date(t.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        {t.provider && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text3)' }}>via {t.provider}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                            <button onClick={() => setDetailUser(null)} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Saldo modal — flat (match desain) ── */}
            {modal && (
                <div className="au-modal-backdrop" onClick={() => { setModal(null); setAmount(''); setMsg(''); setCreditNote(''); }}>
                    <div className="au-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: modal.type === 'add' ? 'var(--green-l)' : 'var(--red-l)', color: modal.type === 'add' ? 'var(--green)' : 'var(--red)' }}>
                                {modal.type === 'add' ? <DollarSign size={17} /> : <MinusCircle size={17} />}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{modal.type === 'add' ? 'Tambah Saldo' : 'Kurangi Saldo'}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modal.email}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 500 }}>Saldo saat ini</div>
                                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Rp {(balances[modal.email] || 0).toLocaleString('id-ID')}</div>
                            </div>
                        </div>
                        <div style={{ padding: '18px 22px 22px' }}>
                            {msg ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: msg.startsWith('✅') ? 'var(--green-l)' : 'var(--red-l)', borderRadius: 10, border: `1px solid ${msg.startsWith('✅') ? 'rgba(22,163,74,.25)' : 'rgba(239,68,68,.25)'}` }}>
                                    <span style={{ fontWeight: 600, fontSize: 13.5, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg.replace('✅ ', '').replace('❌ ', '')}</span>
                                </div>
                            ) : (
                                <>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 7 }}>Jumlah (Rp)</label>
                                    <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', fontSize: 18, fontWeight: 700, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }}
                                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 7 }}>Catatan (opsional)</label>
                                    <input type="text" placeholder="mis. kompensasi, bonus, dll" value={creditNote} onChange={e => setCreditNote(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 14 }}
                                        onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                                        {[5000, 10000, 20000, 50000, 100000, 500000].map(n => {
                                            const sel = amount === String(n);
                                            const c = modal.type === 'add' ? 'var(--green)' : 'var(--red)';
                                            const cl = modal.type === 'add' ? 'var(--green-l)' : 'var(--red-l)';
                                            return (
                                                <button key={n} onClick={() => setAmount(String(n))}
                                                    style={{ padding: '9px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', border: `1px solid ${sel ? c : 'var(--border)'}`, background: sel ? cl : 'var(--white)', color: sel ? c : 'var(--text2)' }}>
                                                    Rp {(n / 1000).toFixed(0)}K
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button onClick={() => { setModal(null); setAmount(''); setCreditNote(''); }}
                                            style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                                        <button onClick={handleSaldo} disabled={!amount || parseInt(amount) <= 0 || loading}
                                            style={{ flex: 2, padding: '11px 0', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: modal.type === 'add' ? 'var(--green)' : 'var(--red)', opacity: (!amount || parseInt(amount) <= 0 || loading) ? 0.55 : 1 }}>
                                            {loading ? <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', borderRadius: '50%' }} className="spin" /> : modal.type === 'add' ? <DollarSign size={14} /> : <MinusCircle size={14} />}
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
                <div className="card" style={{ padding: 52, textAlign: 'center' }}>
                    <span style={{ width: 26, height: 26, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                    <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>Memuat data user...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Users size={22} style={{ color: 'var(--text3)' }} />
                    </div>
                    <p style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)', marginBottom: 6 }}>Belum ada user terdaftar</p>
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>User yang register via /register akan muncul di sini.</p>
                </div>
            ) : (
                <>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                        {['User', 'Saldo', 'Terdaftar', 'Status', 'Aksi'].map(h => (
                                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedUsers.map((u) => (
                                        <tr key={u.email} className="au-tr" onClick={() => { setDetailUser(u); setShowTx(false); loadUserTx(u.email); }} title="Klik untuk lihat detail" style={{ opacity: u.blocked ? 0.6 : 1 }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            {/* User: avatar + nama (bold) + email (sub) — gaya 2 baris seperti desain */}
                                            <td className="au-td">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0, background: u.blocked ? 'var(--text3)' : 'var(--blue)' }}>
                                                        {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{u.name || '—'}</div>
                                                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Saldo: pill hijau seperti "Enrolled" di desain */}
                                            <td className="au-td" style={{ whiteSpace: 'nowrap' }}>
                                                <span style={pill('var(--green)', 'var(--green-l)')}>Rp {(balances[u.email] ?? 0).toLocaleString?.('id-ID') ?? '0'}</span>
                                            </td>
                                            <td className="au-td" style={{ color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '—'}</td>
                                            <td className="au-td">
                                                <span style={pill(u.blocked ? 'var(--red)' : 'var(--green)', u.blocked ? 'var(--red-l)' : 'var(--green-l)')}>
                                                    {u.blocked ? 'Diblokir' : 'Aktif'}
                                                </span>
                                            </td>
                                            <td className="au-td">
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'add', email: u.email }); setAmount(''); }} style={ghostBtn('var(--green)')}>
                                                        <DollarSign size={11} /> Saldo
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setModal({ type: 'kurang', email: u.email }); setAmount(''); }} style={ghostBtn('var(--red)')}>
                                                        <MinusCircle size={11} /> Kurangi
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); toggleBlock(u.email); }} style={ghostBtn(u.blocked ? 'var(--green)' : 'var(--yellow)')}>
                                                        {u.blocked ? <CheckCircle size={11} /> : <Ban size={11} />} {u.blocked ? 'Unblock' : 'Blokir'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Pagination page={page} totalPages={totalPages} perPage={perPage} setPerPage={setPerPage} setPage={setPage} totalItems={filteredUsers.length} />
                </>
            )}
        </div>
    );
}