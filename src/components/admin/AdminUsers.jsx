import { useState, useEffect } from 'react';
import { DollarSign, Users, MinusCircle, Ban, CheckCircle, History, ArrowDownCircle, ArrowUpCircle, ShoppingCart, Gift, RefreshCw } from 'lucide-react';
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

    const [userTx, setUserTx] = useState([]); // transaksi untuk user yang dibuka detailnya
    const [loadingTx, setLoadingTx] = useState(false);
    const [showTx, setShowTx] = useState(false); // toggle tampil riwayat

    const loadUserTx = async (email) => {
        setLoadingTx(true);
        setUserTx([]);
        try {
            const res = await adminFetch(`/api/admin-api?action=get_user_transactions&email=${encodeURIComponent(email)}`);
            const json = await res.json();
            setUserTx(json.transactions || []);
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
    const filteredUsers = users.filter(u =>
        !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');

                .admin-users-wrap { font-family: 'Inter', sans-serif; }

                /* ── Header ── */
                .au-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 24px;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .au-title { font-size: 24px; font-weight: 900; color: var(--text); letter-spacing: -.5px; margin: 0 0 2px; }
                .au-subtitle { font-size: 13px; color: var(--text3); margin: 0; font-weight: 500; }
                .au-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 11.5px;
                    font-weight: 700;
                    color: var(--blue);
                    background: color-mix(in srgb, var(--blue) 12%, transparent);
                    border: 1px solid color-mix(in srgb, var(--blue) 25%, transparent);
                    padding: 3px 10px;
                    border-radius: 20px;
                    margin-left: 10px;
                    vertical-align: middle;
                }
                .au-search-wrap { position: relative; }
                .au-search-wrap svg.search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text3); pointer-events: none; }
                .au-search { 
                    padding: 10px 14px 10px 36px; 
                    border-radius: 12px; 
                    border: 1.5px solid var(--border); 
                    background: var(--bg2); 
                    color: var(--text);
                    font-size: 13px;
                    font-family: 'Inter', sans-serif;
                    font-weight: 500;
                    width: 260px;
                    outline: none;
                    transition: border-color .15s, box-shadow .15s;
                }
                .au-search:focus { border-color: var(--blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 15%, transparent); }
                .au-search::placeholder { color: var(--text3); }

                /* ── Table ── */
                .au-table-wrap { border-radius: 16px; border: 1px solid var(--border); overflow: hidden; background: var(--bg); }
                .au-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .au-thead th {
                    padding: 12px 16px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--text3);
                    letter-spacing: .06em;
                    text-transform: uppercase;
                    background: var(--bg2);
                    border-bottom: 1px solid var(--border);
                    white-space: nowrap;
                }
                .usr-tr { cursor: pointer; transition: background .1s; }
                .usr-tr:hover td { background: color-mix(in srgb, var(--blue) 5%, var(--bg2)); }
                .au-td { padding: 13px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                .usr-tr:last-child .au-td { border-bottom: none; }

                /* Avatar */
                .au-avatar {
                    width: 36px; height: 36px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 14px; color: #fff; flex-shrink: 0;
                    background: linear-gradient(135deg, #2563eb, #1d4ed8);
                    box-shadow: 0 2px 8px rgba(37,99,235,.3);
                }
                .au-avatar.blocked { background: linear-gradient(135deg, #6b7280, #4b5563); box-shadow: none; }
                .au-name { font-weight: 700; color: var(--text); font-size: 13.5px; }
                .au-email { color: var(--text2); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; letter-spacing: -.2px; }
                .au-balance { font-weight: 800; color: var(--green); font-size: 13.5px; font-variant-numeric: tabular-nums; }

                /* Status pill */
                .au-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
                .au-pill-active { color: var(--green); background: var(--green-l); border: 1px solid color-mix(in srgb, var(--green) 20%, transparent); }
                .au-pill-blocked { color: var(--red); background: var(--red-l); border: 1px solid color-mix(in srgb, var(--red) 20%, transparent); }

                /* Action buttons */
                .usr-act {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 11.5px; font-weight: 700;
                    padding: 6px 11px; border-radius: 9px; cursor: pointer;
                    font-family: 'Inter', sans-serif;
                    transition: filter .15s, transform .12s, box-shadow .15s;
                    white-space: nowrap;
                }
                .usr-act:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
                .usr-act:active { transform: translateY(0); box-shadow: none; }

                /* ── Detail Modal ── */
                .au-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .au-modal { background: var(--bg); border-radius: 20px; width: 100%; max-width: 460px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.4); border: 1px solid var(--border); }
                .au-modal-header { padding: 24px 26px 20px; display: flex; align-items: center; gap: 16px; }
                .au-modal-avatar { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; color: #fff; flex-shrink: 0; background: rgba(255,255,255,.2); }
                .au-modal-name { font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .au-modal-email { font-size: 12px; color: rgba(255,255,255,.75); font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .au-modal-body { padding: 20px 24px 24px; }
                .au-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
                .au-stat { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; padding: 14px 10px; text-align: center; }
                .au-stat-label { font-size: 10px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
                .au-stat-val { font-size: 13px; font-weight: 800; line-height: 1.2; word-break: break-word; }
                .au-meta-row { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; color: var(--text3); margin-bottom: 18px; }
                .au-actions-row { display: flex; gap: 8px; margin-bottom: 16px; }
                .au-divider { border: none; border-top: 1px solid var(--border); margin: 0 0 14px; }
                .au-tx-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--bg2); color: var(--text2); font-weight: 700; font-size: 13px; cursor: pointer; font-family: 'Inter',sans-serif; transition: background .15s, border-color .15s; }
                .au-tx-toggle.open { background: color-mix(in srgb, var(--blue) 10%, var(--bg2)); border-color: color-mix(in srgb, var(--blue) 35%, transparent); color: var(--blue); }
                .au-tx-list { margin-top: 10px; max-height: 280px; overflow-y: auto; border-radius: 12px; border: 1px solid var(--border); scrollbar-width: thin; }
                .au-tx-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); transition: background .1s; }
                .au-tx-item:last-child { border-bottom: none; }
                .au-tx-item:hover { background: var(--bg2); }
                .au-close-btn { width: 100%; margin-top: 12px; padding: 10px 0; border-radius: 12px; border: 1.5px solid var(--border); background: transparent; color: var(--text2); font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: 'Inter',sans-serif; transition: background .15s; }
                .au-close-btn:hover { background: var(--bg2); }

                /* ── Saldo Modal ── */
                .au-saldo-modal { background: var(--bg); border-radius: 20px; width: 100%; max-width: 400px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,.4); border: 1px solid var(--border); }
                .au-saldo-header { padding: 22px 26px; }
                .au-saldo-header-label { font-size: 10.5px; font-weight: 700; color: rgba(255,255,255,.65); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
                .au-saldo-header-email { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 10px; opacity: .9; }
                .au-saldo-curr { display: flex; align-items: baseline; gap: 6px; }
                .au-saldo-curr-label { font-size: 11px; color: rgba(255,255,255,.6); font-weight: 600; }
                .au-saldo-curr-val { font-size: 24px; font-weight: 900; color: #fff; letter-spacing: -.5px; }
                .au-saldo-body { padding: 22px 24px 24px; }
                .au-inp-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--text2); margin-bottom: 8px; letter-spacing: .03em; text-transform: uppercase; }
                .au-inp { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--border); background: var(--bg2); color: var(--text); font-size: 20px; font-weight: 800; font-family: 'Inter',sans-serif; outline: none; box-sizing: border-box; margin-bottom: 14px; transition: border-color .15s; }
                .au-inp:focus { border-color: var(--blue); }
                .au-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
                .au-preset { padding: 9px 0; border-radius: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: 'Inter',sans-serif; text-align: center; transition: all .12s; border-width: 1.5px; border-style: solid; }
                .au-btn-row { display: flex; gap: 10px; }
                .au-btn-cancel { flex: 1; padding: 12px 0; border-radius: 12px; border: 1.5px solid var(--border); background: transparent; color: var(--text2); font-weight: 700; font-size: 14px; cursor: pointer; font-family: 'Inter',sans-serif; transition: background .15s; }
                .au-btn-cancel:hover { background: var(--bg2); }
                .au-btn-confirm { flex: 2; padding: 12px 0; border-radius: 12px; border: none; color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; font-family: 'Inter',sans-serif; display: flex; align-items: center; justify-content: center; gap: 7px; transition: opacity .15s, transform .1s; }
                .au-btn-confirm:hover { opacity: .9; transform: translateY(-1px); }
                .au-btn-confirm:disabled { opacity: .5; cursor: not-allowed; transform: none; }

                /* ── Empty / Loading ── */
                .au-empty { padding: 60px 32px; text-align: center; }
                .au-loading { padding: 52px 32px; text-align: center; }
                .spin { animation: spin .7s linear infinite; display: inline-block; }
                @keyframes spin { to { transform: rotate(360deg); } }
            ` }} />

            <div className="admin-users-wrap">
                <div className="au-header">
                    <div>
                        <h1 className="au-title">
                            User Management
                            <span className="au-badge"><Users size={11} />{users.length} user</span>
                        </h1>
                        <p className="au-subtitle">Kelola saldo, status, dan riwayat transaksi pengguna</p>
                    </div>
                    <div className="au-search-wrap">
                        <svg className="search-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                        <input className="au-search" placeholder="Cari nama atau email..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {detailUser && (
                    <div className="au-modal-backdrop" onClick={() => setDetailUser(null)}>
                        <div className="au-modal" onClick={e => e.stopPropagation()}>
                            <div className="au-modal-header" style={{ background: detailUser.blocked ? 'linear-gradient(135deg,#374151,#1f2937)' : 'linear-gradient(135deg,#1e40af,#2563eb)' }}>
                                <div className="au-modal-avatar">{(detailUser.name || detailUser.email || 'U').charAt(0).toUpperCase()}</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className="au-modal-name">{detailUser.name || '—'}</div>
                                    <div className="au-modal-email">{detailUser.email}</div>
                                </div>
                                <span className={`au-pill ${detailUser.blocked ? 'au-pill-blocked' : 'au-pill-active'}`} style={{ flexShrink: 0 }}>
                                    {detailUser.blocked ? 'Diblokir' : 'Aktif'}
                                </span>
                            </div>
                            <div className="au-modal-body">
                                <div className="au-stat-grid">
                                    {[
                                        { l: 'Saldo', v: balances[detailUser.email] || 0, c: 'var(--green)' },
                                        { l: 'Total Deposit', v: deposits[detailUser.email] || 0, c: 'var(--blue)' },
                                        { l: 'Total Spend', v: spends[detailUser.email] || 0, c: 'var(--yellow)' },
                                    ].map(s => (
                                        <div key={s.l} className="au-stat">
                                            <div className="au-stat-label">{s.l}</div>
                                            <div className="au-stat-val" style={{ color: s.c }}>Rp {Math.round(s.v).toLocaleString('id-ID')}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="au-meta-row">
                                    <span>Terdaftar: {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
                                </div>
                                <div className="au-actions-row">
                                    <button className="usr-act" onClick={() => { setModal({ type: 'add', email: detailUser.email }); setAmount(''); setDetailUser(null); }} style={{ flex: 1, justifyContent: 'center', padding: '10px 0', background: 'var(--green-l)', color: 'var(--green)', border: '1.5px solid color-mix(in srgb, var(--green) 28%, transparent)' }}><DollarSign size={13} /> Tambah</button>
                                    <button className="usr-act" onClick={() => { setModal({ type: 'kurang', email: detailUser.email }); setAmount(''); setDetailUser(null); }} style={{ flex: 1, justifyContent: 'center', padding: '10px 0', background: 'var(--red-l)', color: 'var(--red)', border: '1.5px solid color-mix(in srgb, var(--red) 28%, transparent)' }}><MinusCircle size={13} /> Kurangi</button>
                                    <button className="usr-act" onClick={() => { toggleBlock(detailUser.email); setDetailUser(d => d ? { ...d, blocked: !d.blocked } : d); }} style={{ flex: 1, justifyContent: 'center', padding: '10px 0', background: detailUser.blocked ? 'var(--green-l)' : 'var(--yellow-l)', color: detailUser.blocked ? 'var(--green)' : 'var(--yellow)', border: `1.5px solid color-mix(in srgb, ${detailUser.blocked ? 'var(--green)' : 'var(--yellow)'} 28%, transparent)` }}>{detailUser.blocked ? <CheckCircle size={13} /> : <Ban size={13} />} {detailUser.blocked ? 'Unblock' : 'Blokir'}</button>
                                </div>
                                <hr className="au-divider" />
                                <button className={`au-tx-toggle ${showTx ? 'open' : ''}`} onClick={() => setShowTx(v => !v)}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <History size={14} /> Riwayat Transaksi
                                        {userTx.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, background: 'var(--blue)', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>{userTx.length}</span>}
                                    </span>
                                    <span style={{ fontSize: 11, opacity: .6 }}>{showTx ? '▲' : '▼'}</span>
                                </button>
                                {showTx && (
                                    <div className="au-tx-list">
                                        {loadingTx ? (
                                            <div style={{ padding: '28px 0', textAlign: 'center' }}>
                                                <span style={{ width: 20, height: 20, border: '2.5px solid var(--border)', borderTop: '2.5px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                                            </div>
                                        ) : userTx.length === 0 ? (
                                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Belum ada transaksi.</div>
                                        ) : (
                                            userTx.map((t, i) => (
                                                <div key={t.id || i} className="au-tx-item">
                                                    <div style={{ marginTop: 2 }}>{txTypeIcon(t.type)}</div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                                                                {txTypeLabel(t.type)}
                                                                {t.order_id && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>#{t.order_id}</span>}
                                                                {t.status && t.status !== 'success' && (
                                                                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: t.status === 'pending' ? 'var(--yellow)' : 'var(--red)', background: t.status === 'pending' ? 'var(--yellow-l)' : 'var(--red-l)', padding: '2px 7px', borderRadius: 10 }}>{t.status}</span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 800, color: txColor(t.type), flexShrink: 0 }}>
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
                                            ))
                                        )}
                                    </div>
                                )}
                                <button className="au-close-btn" onClick={() => setDetailUser(null)}>Tutup</button>
                            </div>
                        </div>
                    </div>
                )}

                {modal && (
                    <div className="au-modal-backdrop" onClick={() => { setModal(null); setAmount(''); setMsg(''); }}>
                        <div className="au-saldo-modal" onClick={e => e.stopPropagation()}>
                            <div className="au-saldo-header" style={{ background: modal.type === 'add' ? 'linear-gradient(135deg,#15803d,#16a34a)' : 'linear-gradient(135deg,#b91c1c,#dc2626)' }}>
                                <div className="au-saldo-header-label">{modal.type === 'add' ? '✦ Tambah Saldo' : '✦ Kurangi Saldo'}</div>
                                <div className="au-saldo-header-email">{modal.email}</div>
                                <div className="au-saldo-curr">
                                    <span className="au-saldo-curr-label">Saldo saat ini</span>
                                    <span className="au-saldo-curr-val">Rp {(balances[modal.email] || 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                            <div className="au-saldo-body">
                                {msg ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: msg.startsWith('✅') ? 'var(--green-l)' : 'var(--red-l)', borderRadius: 14, border: `1.5px solid ${msg.startsWith('✅') ? 'var(--green)' : 'var(--red)'}` }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg.replace('✅ ', '').replace('❌ ', '')}</span>
                                    </div>
                                ) : (
                                    <>
                                        <label className="au-inp-label">Jumlah (Rp)</label>
                                        <input className="au-inp" type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
                                        <div className="au-presets">
                                            {[5000, 10000, 20000, 50000, 100000, 500000].map(n => {
                                                const sel = amount === String(n);
                                                const ac = modal.type === 'add';
                                                return (
                                                    <button key={n} className="au-preset" onClick={() => setAmount(String(n))} style={{
                                                        borderColor: sel ? (ac ? '#16a34a' : '#dc2626') : 'var(--border)',
                                                        background: sel ? (ac ? 'color-mix(in srgb,#16a34a 12%,transparent)' : 'color-mix(in srgb,#dc2626 12%,transparent)') : 'var(--bg2)',
                                                        color: sel ? (ac ? '#16a34a' : '#dc2626') : 'var(--text2)',
                                                    }}>
                                                        Rp {(n / 1000).toFixed(0)}K
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="au-btn-row">
                                            <button className="au-btn-cancel" onClick={() => { setModal(null); setAmount(''); }}>Batal</button>
                                            <button className="au-btn-confirm" onClick={handleSaldo} disabled={!amount || parseInt(amount) <= 0 || loading} style={{ background: modal.type === 'add' ? '#16a34a' : '#dc2626' }}>
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
                    <div className="au-table-wrap au-loading">
                        <span style={{ width: 26, height: 26, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Memuat data user...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="au-table-wrap au-empty">
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Users size={24} style={{ color: 'var(--text3)' }} />
                        </div>
                        <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada user terdaftar</p>
                        <p style={{ fontSize: 13, color: 'var(--text3)' }}>User yang register via /register akan muncul di sini.</p>
                    </div>
                ) : (
                    <div className="au-table-wrap">
                        <table className="au-table">
                            <thead className="au-thead">
                                <tr>
                                    {['Nama', 'Email', 'Saldo', 'Terdaftar', 'Status', 'Aksi'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u) => (
                                    <tr key={u.email} className="usr-tr" onClick={() => { setDetailUser(u); setShowTx(false); loadUserTx(u.email); }} title="Klik untuk lihat detail" style={{ opacity: u.blocked ? 0.65 : 1 }}>
                                        <td className="au-td">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className={`au-avatar ${u.blocked ? 'blocked' : ''}`}>
                                                    {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="au-name">{u.name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="au-td au-email">{u.email}</td>
                                        <td className="au-td au-balance">Rp {(balances[u.email] ?? 0).toLocaleString?.('id-ID') ?? '0'}</td>
                                        <td className="au-td" style={{ color: 'var(--text3)', fontSize: 12 }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '—'}</td>
                                        <td className="au-td">
                                            <span className={`au-pill ${u.blocked ? 'au-pill-blocked' : 'au-pill-active'}`}>
                                                {u.blocked ? 'Diblokir' : 'Aktif'}
                                            </span>
                                        </td>
                                        <td className="au-td">
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button className="usr-act" onClick={(e) => { e.stopPropagation(); setModal({ type: 'add', email: u.email }); setAmount(''); }} style={{ background: 'var(--green-l)', color: 'var(--green)', border: '1.5px solid color-mix(in srgb, var(--green) 28%, transparent)' }}>
                                                    <DollarSign size={11} /> Saldo
                                                </button>
                                                <button className="usr-act" onClick={(e) => { e.stopPropagation(); setModal({ type: 'kurang', email: u.email }); setAmount(''); }} style={{ background: 'var(--red-l)', color: 'var(--red)', border: '1.5px solid color-mix(in srgb, var(--red) 28%, transparent)' }}>
                                                    <MinusCircle size={11} /> Kurangi
                                                </button>
                                                <button className="usr-act" onClick={(e) => { e.stopPropagation(); toggleBlock(u.email); }} style={{ background: u.blocked ? 'var(--green-l)' : 'var(--yellow-l)', color: u.blocked ? 'var(--green)' : 'var(--yellow)', border: `1.5px solid color-mix(in srgb, ${u.blocked ? 'var(--green)' : 'var(--yellow)'} 28%, transparent)` }}>
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
        </div>
    );
}