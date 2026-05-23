import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
    Target, LogOut, Moon, Sun, BarChart2, Settings,
    Users, DollarSign, ChevronRight, Menu, ChevronLeft,
    Layers, AlertCircle, CheckCircle, X, Search,
    ShoppingCart, TrendingUp, Zap, ArrowUpRight,
    Percent, Save, Trash2, MessageSquare, Megaphone
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useApi } from '@/context/ApiContext';
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from '@/components/ui/area-chart';
import AdminTickets from '@/components/admin/AdminTickets';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminDeposits from '@/components/admin/AdminDeposits';
// supabase dipakai untuk fetchOrders (query transactions dari client dengan anon key)
// Pastikan RLS aktif di tabel transactions agar admin bisa baca semua row
import { supabase } from '@/lib/supabase';
import AdminAnnouncement from '@/components/admin/AdminAnnouncement';

export default function AdminPanel() {
    const router = useRouter();
    const { dark, toggle } = useTheme();
    const { apiUrl, apiKey } = useApi();
    const [authed, setAuthed] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [passError, setPassError] = useState('');
    const [menu, setMenu] = useState('Overview');
    const [sideOpen, setSideOpen] = useState(true);

    const [balance, setBalance] = useState(null);
    const [rate, setRate] = useState(17687);
    const [services, setServices] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [serviceSearch, setServiceSearch] = useState('');
    const [serviceFilter, setServiceFilter] = useState('All');
    const [overviewError, setOverviewError] = useState('');

    const [markup, setMarkup] = useState(2.5);
    const [markupInput, setMarkupInput] = useState('2.5');
    const [markupSaved, setMarkupSaved] = useState(false);
    const [users, setUsers] = useState([]);
    const [chartRange, setChartRange] = useState('30d');
    const [apiStatus, setApiStatus] = useState('unknown');
    const [dbOrders, setDbOrders] = useState([]); // orders dari Supabase (akurat, semua user)
    const [servicePage, setServicePage] = useState(0); // pagination services
    const SERVICES_PER_PAGE = 100;
    const rangeDropdownRef = useRef(null); // close-on-outside-click

    const RANGE_OPTIONS = [
        { label: 'Last 7 days', value: '7d', days: 7 },
        { label: 'Last 30 days', value: '30d', days: 30 },
        { label: 'Last 90 days', value: '90d', days: 90 },
        { label: 'Last 12 months', value: '12m', days: 365 },
    ];
    const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);

    const generateChartData = (range) => {
        const opt = RANGE_OPTIONS.find(o => o.value === range) || RANGE_OPTIONS[1];
        const days = opt.days;
        const now = new Date();
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dateKey = d.toISOString().slice(0, 10);

            const dayOrders = dbOrders.filter(o => {
                if (!o.created_at) return false;
                return new Date(o.created_at).toISOString().slice(0, 10) === dateKey;
            });
            const dayRevenue = dayOrders.reduce((s, o) => {
                if (o.charge && parseFloat(o.charge) > 0) {
                    return s + Math.round(parseFloat(o.charge) * rate * markup);
                }
                return s + Math.round(parseFloat(o.amount || 0));
            }, 0);

            const dayUsers = users.filter(u => {
                if (!u.createdAt) return false;
                return new Date(u.createdAt).toISOString().slice(0, 10) === dateKey;
            }).length;

            data.push({
                date: d,
                revenue: dayRevenue,
                _rawUsers: dayUsers,
                newUsers: dayUsers, // akan dinormalisasi di bawah
            });
        }

        // ✅ Normalisasi newUsers ke skala revenue supaya terlihat di chart
        // Tooltip tetap pakai _rawUsers (nilai asli)
        const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
        const maxUsers = Math.max(...data.map(d => d._rawUsers), 1);
        const scale = (maxRevenue * 0.6) / maxUsers; // tampilkan max di 60% tinggi chart
        data.forEach(d => { d.newUsers = Math.round(d._rawUsers * scale); });

        return data;
    };

    // ✅ Helper: panggil /api/admin-api dengan JWT token
    // Didefinisikan di sini agar bisa dipakai loadUsers, fetchOrders, toggleBlock, dll.
    const adminFetch = (path, options = {}) => {
        const token = sessionStorage.getItem('admin_token') || '';
        return fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });
    };

    const loadUsers = async () => {
        // ✅ Tidak lagi direct ke Supabase — lewat server-side API yang verifikasi JWT
        const res = await adminFetch('/api/admin-api?action=get_users');
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        if (data.users) setUsers(data.users);
    };

    useEffect(() => {
        // ✅ Cek auth di client-side saja — hindari hydration mismatch
        const isAuthed = sessionStorage.getItem('admin_authed') === 'true' &&
            !!sessionStorage.getItem('admin_token');
        setAuthed(isAuthed);
        setAuthChecked(true);
        // ✅ Load markup via server-side API (bukan direct Supabase dari client)
        if (isAuthed) {
            adminFetch('/api/admin-api?action=get_markup')
                .then(r => r.json())
                .then(data => {
                    if (data?.value) { setMarkup(parseFloat(data.value)); setMarkupInput(data.value); }
                })
                .catch(() => { });
        }
    }, []);

    useEffect(() => {
        fetch('/api/rate').then(r => r.json()).then(d => { if (d.rate) setRate(d.rate); }).catch(() => { });
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setPassError('');
        try {
            const res = await fetch('/api/admin-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: adminUser, password: adminPass }),
            });
            const data = await res.json();
            if (data.ok && data.token) {
                sessionStorage.setItem('admin_authed', 'true');
                sessionStorage.setItem('admin_token', data.token);
                setAuthed(true);
            } else {
                setPassError(data.error || 'Login gagal.');
            }
        } catch {
            setPassError('Koneksi gagal. Coba lagi.');
        }
    };

    const logout = () => {
        sessionStorage.removeItem('admin_authed');
        sessionStorage.removeItem('admin_token');
        router.push('/');
    };

    const fetchBalance = useCallback(async () => {
        // ✅ Fix: hapus guard apiUrl — admin pakai /api/smm yang baca SMM_API_URL dari env server-side
        // Tidak perlu nunggu apiUrl dari ApiContext yang load async dari Supabase
        setLoadingBalance(true);
        try {
            const res = await fetch('/api/smm?action=balance', {
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` }
            });
            const data = await res.json();
            if (data.balance !== undefined) {
                setBalance(parseFloat(data.balance));
                setApiStatus('ok');
            } else {
                setApiStatus('error');
                setOverviewError(prev => data.error || prev || 'Gagal mengambil balance dari provider.');
            }
        } catch (e) {
            setOverviewError(e.message);
            setApiStatus('error');
        }
        setLoadingBalance(false);
    }, [apiUrl]);

    const fetchServices = useCallback(async () => {
        // ✅ Fix: hapus guard apiUrl — /api/smm sudah baca SMM_API_KEY dari env server-side
        setLoadingServices(true);
        try {
            const res = await fetch('/api/smm?action=services', { headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` } });
            const data = await res.json();
            if (Array.isArray(data)) setServices(data);
            else setOverviewError('Gagal memuat daftar services dari provider.');
        } catch (e) {
            setOverviewError(`Services error: ${e.message}`);
        }
        setLoadingServices(false);
    }, [apiUrl]);

    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            // Ambil orders dari Supabase
            const { data: txRaw, error: txError } = await supabase
                .from('transactions')
                .select('*')
                .eq('type', 'order')
                .order('created_at', { ascending: false });

            // Filter hanya SMM orders asli
            const txData = txRaw?.filter(t =>
                (t.order_id && /^\d+$/.test(String(t.order_id))) ||
                (t.description && t.description.startsWith('Order #'))
            ) || [];

            if (!txError && txData.length > 0) {
                setDbOrders(txData);

                // Fetch live status dari SMMSOC
                const orderIds = txData
                    .filter(t => t.order_id && /^\d+$/.test(String(t.order_id)))
                    .map(t => String(t.order_id));

                let liveStatus = {};
                if (orderIds.length > 0) {
                    try {
                        const res = await fetch(`/api/smm?action=status&orders=${orderIds.slice(0, 100).join(',')}`, {
                            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` }
                        });
                        const data = await res.json();
                        if (!data.error) liveStatus = data;
                    } catch { /* pakai status Supabase */ }
                }

                setOrders(txData.map(t => {
                    const live = t.order_id ? liveStatus[t.order_id] : null;
                    return {
                        id: t.order_id || t.id,
                        status: live?.status || 'Pending',
                        charge: t.charge || (t.amount ? t.amount / ((t._rate || 17687) * (t._markup || 1)) : 0),
                        amount_idr: t.amount || 0,
                        start_count: live?.start_count || t.start_count,
                        remains: live?.remains || t.remains,
                        created_at: t.created_at,
                        email: t.email,
                        service: t.service_id || t.description,
                        description: t.description,
                        link: t.link,
                        qty: t.qty,
                    };
                }));
            } else {
                setOrders([]);
                setDbOrders([]);
            }
        } catch (e) {
            setOverviewError(e.message);
        }
        setLoadingOrders(false);
    }, [apiUrl]);


    useEffect(() => {
        if (!authed) return;
        const doRefresh = () => {
            fetchBalance();
            fetchServices();
            fetchOrders();
            loadUsers();
        };
        doRefresh();
        const interval = setInterval(doRefresh, 300 * 1000);
        return () => clearInterval(interval);
    }, [authed, fetchBalance, fetchServices, fetchOrders]);

    // saldo update dipanggil dari AdminUsers child component — reload users setelah update
    const onSaldoUpdated = () => { loadUsers(); };

    const toggleBlock = async (email) => {
        const user = users.find(u => u.email === email);
        if (!user) return;
        const updated = users.map(u => u.email === email ? { ...u, blocked: !u.blocked } : u);
        setUsers(updated);
        const blockedEmails = updated.filter(u => u.blocked).map(u => u.email);
        // ✅ Lewat server-side API — bukan direct Supabase
        await adminFetch('/api/admin-api?action=toggle_block', {
            method: 'POST',
            body: JSON.stringify({ email, blocked_emails: blockedEmails }),
        });
    };

    const saveMarkup = async () => {
        const val = parseFloat(markupInput);
        if (isNaN(val) || val < 1) return;
        setMarkup(val);
        // ✅ Simpan via server-side API — bukan direct Supabase
        const res = await adminFetch('/api/admin-api?action=save_markup', {
            method: 'POST',
            body: JSON.stringify({ value: val }),
        });
        if (res.status === 401) { logout(); return; }
        setMarkupSaved(true);
        setTimeout(() => setMarkupSaved(false), 2000);
    };

    const deleteUser = async (email) => {
        if (!confirm(`Hapus semua data transaksi user ${email}? Tindakan ini tidak bisa dibatalkan.`)) return;
        const updated = users.filter(u => u.email !== email);
        setUsers(updated);
        // ✅ Hapus via server-side API — menghapus transactions + Supabase Auth user
        const res = await adminFetch('/api/admin-api?action=delete_user', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
        if (res.status === 401) { logout(); return; }
    };

    const fIDR = (usd) => `Rp ${Math.round((usd || 0) * rate).toLocaleString('id-ID')}`;
    const fIDRMarkup = (usd) => `Rp ${Math.round((usd || 0) * rate * markup).toLocaleString('id-ID')}`;

    // ✅ Export CSV helper
    const exportCSV = (data, filename) => {
        if (!data.length) return;
        const keys = Object.keys(data[0]);
        const csv = [
            keys.join(','),
            ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    // ✅ Close range dropdown on click-outside
    useEffect(() => {
        if (!rangeDropdownOpen) return;
        const handler = (e) => {
            if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(e.target)) {
                setRangeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [rangeDropdownOpen]);

    const totalSpentUSD = orders.reduce((s, o) => s + parseFloat(o.charge || 0), 0);
    const totalRevenueIDR = Math.round(totalSpentUSD * rate * markup);
    const profitIDR = totalRevenueIDR - Math.round(totalSpentUSD * rate);

    const cats = ['All', ...new Set(services.map(s => s.category))].filter(Boolean);
    const filteredSvc = services.filter(s => {
        const matchCat = serviceFilter === 'All' || s.category === serviceFilter;
        const matchQ = !serviceSearch || s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) || String(s.service).includes(serviceSearch);
        return matchCat && matchQ;
    });

    const statusColor = (st) => ({ completed: 'var(--green)', processing: 'var(--blue)', partial: 'var(--yellow)', canceled: 'var(--red)', pending: 'var(--text3)' }[st?.toLowerCase()] || 'var(--text3)');

    const navItems = [
        { id: 'Overview', icon: <BarChart2 size={16} />, color: 'var(--blue)' },
        { id: 'Orders', icon: <ShoppingCart size={16} />, color: 'var(--yellow)' },
        { id: 'Services', icon: <Layers size={16} />, color: 'var(--green)' },
        { id: 'Users', icon: <Users size={16} />, color: '#8B5CF6' },
        { id: 'Deposits', icon: <DollarSign size={16} />, color: '#10B981' },
        { id: 'Pengumuman', icon: <Megaphone size={16} />, color: '#7C3AED' },
        { id: 'Tickets', icon: <MessageSquare size={16} />, color: '#F59E0B' },
        { id: 'Revenue', icon: <TrendingUp size={16} />, color: '#10B981' },
        { id: 'Markup', icon: <Percent size={16} />, color: '#E91E63' },
        { id: 'Settings', icon: <Settings size={16} />, color: 'var(--text3)' },
    ];


    // ── LOADING (auth check belum selesai) ──
    // Penting: server dan client harus render hal yang sama saat hydration
    if (!authChecked) return null;

    // ── LOGIN ──
    if (!authed) {
        return (
            <div className={`root${dark ? ' dark' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
                <div className="card" style={{ padding: '40px 36px', width: 360, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,var(--blue),#1D4ED8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(37,99,235,.3)' }}>
                        <Target size={24} style={{ color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Admin Panel</h1>
                    <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>SuntikSosmed</p>
                    <form onSubmit={handleLogin}>
                        <input className="inp" type="text" placeholder="Username" value={adminUser} onChange={e => setAdminUser(e.target.value)} style={{ marginBottom: 10, textAlign: 'center' }} autoFocus autoComplete="username" />
                        <input className="inp" type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} style={{ marginBottom: 10, textAlign: 'center' }} autoComplete="current-password" />
                        {passError && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{passError}</div>}
                        <button className="btn btn-blue" type="submit" style={{ width: '100%', padding: 12, borderRadius: 10 }}>Masuk</button>
                    </form>
                </div>
            </div>
        );
    }

    // ── MAIN ──
    return (
        <div className={`root${dark ? ' dark' : ''}`} style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

            {/* SIDEBAR — clean white, same style as user dashboard */}
            <aside style={{ width: sideOpen ? 220 : 0, minWidth: sideOpen ? 220 : 0, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all .25s', position: 'relative', zIndex: 40 }}>

                {/* Logo */}
                <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={17} style={{ color: 'var(--blue)' }} strokeWidth={2.5} />
                        </div>
                        SuntikSosmed
                    </div>
                    <button onClick={() => setSideOpen(false)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 6px', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                        <ChevronLeft size={15} />
                    </button>
                </div>

                {/* Admin badge card */}
                <div style={{ margin: '0 12px 12px' }}>
                    <div style={{ background: 'linear-gradient(135deg,#2563EB,#1D4ED8)', borderRadius: 13, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 3 }}>ADMIN PANEL</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Full Access</div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>{apiUrl ? new URL(apiUrl).hostname : 'smmsoc.com'}</span>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                    {navItems.map(n => (
                        <button key={n.id} onClick={() => setMenu(n.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', background: menu === n.id ? 'var(--blue)' : 'transparent', color: menu === n.id ? '#fff' : 'var(--text2)', fontWeight: menu === n.id ? 700 : 600, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s', whiteSpace: 'nowrap', textAlign: 'left' }}
                            onMouseEnter={e => { if (menu !== n.id) e.currentTarget.style.background = 'var(--bg2)'; }}
                            onMouseLeave={e => { if (menu !== n.id) e.currentTarget.style.background = 'transparent'; }}>
                            <span style={{ color: menu === n.id ? 'rgba(255,255,255,.8)' : 'var(--text3)' }}>{n.icon}</span>
                            {n.id}
                            {menu === n.id && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.6)' }} />}
                        </button>
                    ))}
                </nav>

                {/* Bottom */}
                <div style={{ padding: '10px 10px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text3)', fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {dark ? <Sun size={15} /> : <Moon size={15} />}
                        {dark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--red)', fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--red-l)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <LogOut size={15} /> Sign Out Admin
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
                {/* Topbar */}
                <div style={{ height: 56, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
                    {!sideOpen && (
                        <button onClick={() => setSideOpen(true)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 8px', cursor: 'pointer', color: 'var(--text2)', display: 'flex', marginRight: 4 }}>
                            <Menu size={16} />
                        </button>
                    )}
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>Admin</span>
                    <ChevronRight size={13} style={{ color: 'var(--text3)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{menu}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: apiStatus === 'error' ? 'var(--red)' : apiStatus === 'ok' ? 'var(--green)' : 'var(--text3)', background: apiStatus === 'error' ? 'var(--red-l)' : apiStatus === 'ok' ? 'var(--green-l)' : 'var(--bg2)', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: apiStatus === 'error' ? 'var(--red)' : apiStatus === 'ok' ? 'var(--green)' : 'var(--text3)' }} />
                            {apiStatus === 'error' ? 'API Error' : apiStatus === 'ok' ? 'API Connected' : 'Checking...'}
                        </div>
                    </div>
                </div>

                <div style={{ padding: 24, flex: 1 }}>

                    {/* ── OVERVIEW ── */}
                    {menu === 'Overview' && (
                        <div>
                            <div style={{ marginBottom: 22 }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Overview</h1>
                                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Data real-time dari smmsoc.com API.</p>
                            </div>

                            {/* ✅ Error banner */}
                            {overviewError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                    {overviewError}
                                    <button onClick={() => setOverviewError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={14} /></button>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                                {[
                                    { label: 'Provider Balance', value: loadingBalance ? '...' : balance !== null ? `$${balance?.toFixed(2)}` : '—', sub: loadingBalance ? 'Memuat...' : balance !== null ? fIDR(balance) : 'Gagal memuat', icon: <DollarSign size={20} />, iconBg: 'var(--blue-l)', iconColor: 'var(--blue)', badge: apiStatus === 'ok' ? 'Live' : apiStatus === 'error' ? 'Error' : '...' },
                                    { label: 'Total Services', value: services.length || '...', sub: `${[...new Set(services.map(s => s.category))].length} kategori`, icon: <Layers size={20} />, iconBg: 'var(--green-l)', iconColor: 'var(--green)', badge: `${services.length} layanan` },
                                    { label: 'Total Orders', value: orders.length, sub: `${orders.filter(o => o.status?.toLowerCase() === 'completed').length} completed`, icon: <ShoppingCart size={20} />, iconBg: 'var(--yellow-l)', iconColor: 'var(--yellow)', badge: `${orders.filter(o => o.status?.toLowerCase() === 'processing').length} aktif` },
                                    { label: 'Markup Aktif', value: `${markup}x`, sub: `+${Math.round((markup - 1) * 100)}% keuntungan`, icon: <Percent size={20} />, iconBg: 'rgba(233,30,99,.1)', iconColor: '#E91E63', badge: 'Persistent' },
                                ].map((s, i) => (
                                    <div key={s.label} className="card" style={{ padding: 20 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.iconColor, flexShrink: 0 }}>{s.icon}</div>
                                            <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-l)', padding: '3px 8px', borderRadius: 20 }}>{s.badge}</div>
                                        </div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{s.value}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>{s.label}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Revenue Summary */}
                            <div className="card" style={{ padding: 22, marginBottom: 20 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Revenue Summary (Semua Order)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                                    {[
                                        { l: 'Modal (Harga Provider)', v: `$${totalSpentUSD.toFixed(4)}`, v2: fIDR(totalSpentUSD), c: 'var(--red)' },
                                        { l: 'Revenue (Harga User)', v: fIDRMarkup(totalSpentUSD), v2: `${markup}x markup`, c: 'var(--blue)' },
                                        { l: 'Estimasi Profit', v: `Rp ${profitIDR.toLocaleString('id-ID')}`, v2: `${Math.round((markup - 1) * 100)}% margin`, c: 'var(--green)' },
                                    ].map(r => (
                                        <div key={r.l} style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px 18px' }}>
                                            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>{r.l}</div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: r.c, marginBottom: 3 }}>{r.v}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.v2}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Quick Stats + API Config */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="card" style={{ padding: 20 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Quick Stats</div>
                                    {[
                                        { l: 'Services Loaded', v: services.length, c: 'var(--blue)' },
                                        { l: 'Categories', v: [...new Set(services.map(s => s.category))].length, c: 'var(--blue)' },
                                        { l: 'Total Orders', v: orders.length, c: 'var(--text)' },
                                        { l: 'Completed Orders', v: orders.filter(o => o.status?.toLowerCase() === 'completed').length, c: 'var(--green)' },
                                        { l: 'Active Orders', v: orders.filter(o => o.status?.toLowerCase() === 'processing').length, c: 'var(--yellow)' },
                                    ].map(r => (
                                        <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text2)' }}>{r.l}</span>
                                            <span style={{ fontWeight: 700, color: r.c }}>{r.v}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="card" style={{ padding: 20 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>API Configuration</div>
                                    {[
                                        { l: 'Provider URL', v: apiUrl || 'Not set' },
                                        { l: 'API Key', v: apiKey && typeof apiKey === 'string' ? '••••••' + apiKey.slice(-6) : (apiKey ? '••••••••••••' : 'Not set') },
                                        { l: 'Admin Password', v: '••••••••••• (server-side)' },
                                        { l: 'Proxy', v: '/api/smm (CORS-safe)' },
                                        { l: 'Markup', v: `${markup}x (${Math.round((markup - 1) * 100)}% profit)` },
                                        { l: 'Kurs USD/IDR', v: `Rp ${rate.toLocaleString('id-ID')}` },
                                    ].map(r => (
                                        <div key={r.l} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 140, flexShrink: 0, color: 'var(--text3)', fontWeight: 600 }}>
                                                <CheckCircle size={11} style={{ color: 'var(--green)', flexShrink: 0 }} />{r.l}
                                            </div>
                                            <div style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, wordBreak: 'break-all' }}>{r.v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ORDERS ── */}
                    {menu === 'Orders' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div>
                                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Orders</h1>
                                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{orders.length} total order · semua user.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {orders.length > 0 && (
                                        <button className="btn btn-outline" onClick={() => exportCSV(orders.map(o => ({
                                            order_id: o.id,
                                            email: o.email || '—',
                                            status: o.status || 'pending',
                                            start_count: o.start_count || '',
                                            remains: o.remains || '',
                                            charge_usd: parseFloat(o.charge || 0).toFixed(4),
                                            harga_user_idr: Math.round(parseFloat(o.charge || 0) * rate * markup),
                                            created_at: o.created_at || '',
                                        })), `orders_${new Date().toISOString().slice(0, 10)}.csv`)} style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12 }}>
                                            <ArrowUpRight size={12} /> CSV
                                        </button>
                                    )}
                                </div>
                            </div>
                            {orders.length === 0 ? (
                                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                                    <ShoppingCart size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada order</p>
                                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Order dari semua user akan tampil di sini (dari Supabase).</p>
                                </div>
                            ) : (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                                {['Order ID', 'Email', 'Layanan', 'Status', 'Harga User (IDR)', 'Tanggal'].map(h => (
                                                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((o, i) => (
                                                <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                                        {o.order_id ? `#${o.order_id}` : `${String(o.id).slice(0, 8)}...`}
                                                    </td>
                                                    <td style={{ padding: '11px 14px', color: 'var(--text2)', fontSize: 12 }}>{o.email || '—'}</td>
                                                    <td style={{ padding: '11px 14px', color: 'var(--text)', fontSize: 12, maxWidth: 220 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.description || o.service || '—'}</div>
                                                    </td>
                                                    <td style={{ padding: '11px 14px' }}>
                                                        {(() => {
                                                            const s = o.status;
                                                            const cfg = {
                                                                'Completed': { label: 'Selesai', color: '#059669', bg: '#d1fae5' },
                                                                'In progress': { label: 'Berjalan', color: 'var(--blue)', bg: 'var(--blue-l)' },
                                                                'Processing': { label: 'Diproses', color: 'var(--blue)', bg: 'var(--blue-l)' },
                                                                'Pending': { label: 'Menunggu', color: '#d97706', bg: '#fef3c7' },
                                                                'Canceled': { label: 'Dibatalkan', color: 'var(--red)', bg: 'var(--red-l)' },
                                                            }[s] || { label: s || 'Pending', color: 'var(--text3)', bg: 'var(--bg2)' };
                                                            return <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20 }}>{cfg.label}</span>;
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)' }}>
                                                        {o.amount_idr ? `Rp ${o.amount_idr.toLocaleString('id-ID')}` : fIDRMarkup(parseFloat(o.charge || 0))}
                                                    </td>
                                                    <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                        {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── SERVICES ── */}
                    {menu === 'Services' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div>
                                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Services</h1>
                                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{services.length} layanan · markup {markup}x aktif</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {services.length > 0 && (
                                        <button className="btn btn-outline" onClick={() => exportCSV(services.map(s => ({
                                            id: s.service,
                                            nama: s.name,
                                            kategori: s.category,
                                            harga_modal_idr: Math.round(parseFloat(s.rate || 0) * rate),
                                            harga_user_idr: Math.round(parseFloat(s.rate || 0) * rate * markup),
                                            min: s.min,
                                            max: s.max,
                                        })), `services_${new Date().toISOString().slice(0, 10)}.csv`)} style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12 }}>
                                            <ArrowUpRight size={12} /> CSV
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 36 }} placeholder="Cari service..." value={serviceSearch} onChange={e => { setServiceSearch(e.target.value); setServicePage(0); }} />
                                </div>
                                <select className="inp" style={{ width: 220 }} value={serviceFilter} onChange={e => { setServiceFilter(e.target.value); setServicePage(0); }}>
                                    {cats.map(c => <option key={c} value={c}>{c === 'All' ? 'Semua Kategori' : c}</option>)}
                                </select>
                            </div>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                            {['ID', 'Nama', 'Harga Modal /1K', 'Harga User /1K', 'Min', 'Max'].map(h => (
                                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 11.5 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* ✅ Real pagination */}
                                        {filteredSvc.slice(servicePage * SERVICES_PER_PAGE, (servicePage + 1) * SERVICES_PER_PAGE).map((s, i) => {
                                            const modalIDR = Math.round(parseFloat(s.rate || 0) * rate);
                                            const userIDR = Math.round(parseFloat(s.rate || 0) * rate * markup);
                                            return (
                                                <tr key={s.service} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--text3)', fontWeight: 600, fontSize: 11.5 }}>{s.service}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text)', maxWidth: 280 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }}>{s.name}</div>
                                                        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{s.category}</div>
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--red)', fontWeight: 700 }}>Rp {modalIDR.toLocaleString('id-ID')}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--green)', fontWeight: 700 }}>Rp {userIDR.toLocaleString('id-ID')}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{s.min}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{Number(s.max).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {/* ✅ Pagination controls */}
                                {filteredSvc.length > SERVICES_PER_PAGE && (
                                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                                            Menampilkan {servicePage * SERVICES_PER_PAGE + 1}–{Math.min((servicePage + 1) * SERVICES_PER_PAGE, filteredSvc.length)} dari {filteredSvc.length} service
                                        </span>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => setServicePage(p => Math.max(0, p - 1))} disabled={servicePage === 0}
                                                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: servicePage === 0 ? 'var(--bg2)' : 'var(--white)', color: servicePage === 0 ? 'var(--text3)' : 'var(--text)', cursor: servicePage === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                ← Prev
                                            </button>
                                            {Array.from({ length: Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) }, (_, idx) => idx)
                                                .filter(idx => Math.abs(idx - servicePage) <= 2)
                                                .map(idx => (
                                                    <button key={idx} onClick={() => setServicePage(idx)}
                                                        style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${idx === servicePage ? 'var(--blue)' : 'var(--border)'}`, background: idx === servicePage ? 'var(--blue)' : 'var(--white)', color: idx === servicePage ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                        {idx + 1}
                                                    </button>
                                                ))
                                            }
                                            <button onClick={() => setServicePage(p => Math.min(Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) - 1, p + 1))} disabled={servicePage >= Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) - 1}
                                                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: servicePage >= Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) - 1 ? 'var(--bg2)' : 'var(--white)', color: servicePage >= Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) - 1 ? 'var(--text3)' : 'var(--text)', cursor: servicePage >= Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) - 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── USERS ── */}
                    {menu === 'Users' && <AdminUsers />}

                    {/* ── DEPOSITS ── */}
                    {menu === 'Deposits' && <AdminDeposits />}

                    {/* ── REVENUE ── */}
                    {menu === 'Revenue' && (() => {
                        const chartData = generateChartData(chartRange);
                        return (
                            <div>
                                <div style={{ marginBottom: 22 }}>
                                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Revenue Stats</h1>
                                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Estimasi pendapatan vs user baru · markup {markup}x aktif.</p>
                                </div>

                                {/* Stat cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                                    {[
                                        { l: 'Total Modal', v: `$${totalSpentUSD.toFixed(4)}`, v2: fIDR(totalSpentUSD), c: 'var(--red)', iconBg: 'var(--red-l)', icon: <DollarSign size={20} /> },
                                        { l: 'Total Revenue', v: fIDRMarkup(totalSpentUSD), v2: `Markup ${markup}x`, c: 'var(--blue)', iconBg: 'var(--blue-l)', icon: <TrendingUp size={20} /> },
                                        { l: 'Estimasi Profit', v: `Rp ${profitIDR.toLocaleString('id-ID')}`, v2: `Margin ${Math.round((markup - 1) * 100)}%`, c: 'var(--green)', iconBg: 'var(--green-l)', icon: <Zap size={20} /> },
                                    ].map(s => (
                                        <div key={s.l} className="card" style={{ padding: 22 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c, marginBottom: 14 }}>{s.icon}</div>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: s.c, marginBottom: 4 }}>{s.v}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>{s.l}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.v2}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* AREA CHART */}
                                <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Pendapatan & User Baru</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                                                {RANGE_OPTIONS.find(o => o.value === chartRange)?.label} · data real order
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>
                                                    Rp {chartData.reduce((s, d) => s + d.revenue, 0).toLocaleString('id-ID')}
                                                </div>
                                                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Total periode ini</div>
                                            </div>
                                            {/* ✅ Dropdown Range Selector — close on outside click */}
                                            <div ref={rangeDropdownRef} style={{ position: 'relative' }}>
                                                <button onClick={() => setRangeDropdownOpen(v => !v)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>
                                                    {RANGE_OPTIONS.find(o => o.value === chartRange)?.label}
                                                    <ChevronRight size={13} style={{ transform: rangeDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', color: 'var(--text3)' }} />
                                                </button>
                                                {rangeDropdownOpen && (
                                                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                                                        {RANGE_OPTIONS.map(opt => (
                                                            <button key={opt.value} onClick={() => { setChartRange(opt.value); setRangeDropdownOpen(false); }}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: chartRange === opt.value ? 700 : 500, fontSize: 13, color: chartRange === opt.value ? 'var(--blue)' : 'var(--text)', textAlign: 'left' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                                {chartRange === opt.value && <CheckCircle size={13} style={{ color: 'var(--blue)', flexShrink: 0 }} />}
                                                                {chartRange !== opt.value && <span style={{ width: 13 }} />}
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <AreaChart
                                        data={chartData}
                                        xDataKey="date"
                                        aspectRatio="3 / 1"
                                        margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                                    >
                                        <Grid horizontal />
                                        <Area
                                            dataKey="revenue"
                                            fill="#2563EB"
                                            stroke="#2563EB"
                                            fillOpacity={0.25}
                                            strokeWidth={2.5}
                                        />
                                        <Area
                                            dataKey="newUsers"
                                            fill="#10B981"
                                            stroke="#10B981"
                                            fillOpacity={0.2}
                                            strokeWidth={2}
                                        />
                                        <XAxis numTicks={6} />
                                        <ChartTooltip
                                            rows={(point) => [
                                                { color: '#2563EB', label: 'Pendapatan', value: `Rp ${Number(point.revenue).toLocaleString('id-ID')}` },
                                                { color: '#10B981', label: 'User Baru', value: `${point._rawUsers ?? 0} orang` },
                                            ]}
                                        />
                                    </AreaChart>
                                </div>

                                {/* Simulasi Markup */}
                                <div className="card" style={{ padding: 22 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Simulasi Markup</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                                        {[1.5, 2, 2.5, 3].map(m => {
                                            const rev = Math.round(totalSpentUSD * rate * m);
                                            const mod = Math.round(totalSpentUSD * rate);
                                            return (
                                                <div key={m} style={{ background: m === markup ? 'var(--blue-l)' : 'var(--bg2)', border: `1.5px solid ${m === markup ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800, color: m === markup ? 'var(--blue)' : 'var(--text)', marginBottom: 4 }}>{m}x</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>+{Math.round((m - 1) * 100)}% margin</div>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>+Rp {(rev - mod).toLocaleString('id-ID')}</div>
                                                    {m === markup && <div style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700, marginTop: 6 }}>✓ AKTIF</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── PENGUMUMAN ── */}
                    {menu === 'Pengumuman' && <AdminAnnouncement />}

                    {/* ── TICKETS ── */}
                    {menu === 'Tickets' && <AdminTickets />}

                    {/* ── MARKUP ── */}
                    {menu === 'Markup' && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Markup Settings</h1>
                                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Set keuntungan dari harga modal ke harga yang ditampilkan ke user.</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div className="card" style={{ padding: 26 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>Set Markup Multiplier</div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>Multiplier (2 = 2x harga modal)</label>
                                    <input className="inp" type="number" step="0.1" min="1" style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 14 }} value={markupInput} onChange={e => setMarkupInput(e.target.value)} />
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                        {[1.5, 2, 2.5, 3, 4, 5].map(m => (
                                            <button key={m} onClick={() => setMarkupInput(String(m))}
                                                style={{ padding: '7px 16px', borderRadius: 9, border: `1.5px solid ${markupInput === String(m) ? 'var(--blue)' : 'var(--border)'}`, background: markupInput === String(m) ? 'var(--blue)' : 'transparent', color: markupInput === String(m) ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                {m}x
                                            </button>
                                        ))}
                                    </div>
                                    {markupSaved ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: 'var(--green-l)', borderRadius: 10, color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
                                            <CheckCircle size={15} /> Markup tersimpan!
                                        </div>
                                    ) : (
                                        <button className="btn btn-blue" onClick={saveMarkup} style={{ width: '100%', padding: 12, borderRadius: 10 }}>
                                            <Save size={15} /> Simpan Markup
                                        </button>
                                    )}
                                </div>
                                <div className="card" style={{ padding: 26 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 18 }}>Preview Harga (markup {markupInput}x)</div>
                                    {[
                                        { name: 'Instagram Followers HQ', rate: 0.19 },
                                        { name: 'TikTok Views Ultra Fast', rate: 0.0007 },
                                        { name: 'YouTube Subscribers', rate: 15.835 },
                                        { name: 'TikTok Followers', rate: 1.00 },
                                        { name: 'Spotify Plays', rate: 0.09 },
                                    ].map(s => {
                                        const modal = Math.round(s.rate * rate);
                                        const user = Math.round(s.rate * rate * parseFloat(markupInput || markup));
                                        return (
                                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                                                <div style={{ color: 'var(--text)', fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ color: 'var(--red)', fontWeight: 600 }}>Modal: Rp {modal.toLocaleString('id-ID')}</div>
                                                    <div style={{ color: 'var(--green)', fontWeight: 700 }}>User: Rp {user.toLocaleString('id-ID')}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SETTINGS ── */}
                    {menu === 'Settings' && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Settings</h1>
                                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Konfigurasi sistem admin panel.</p>
                            </div>
                            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Informasi Sistem</div>
                                {[
                                    { l: 'Framework', v: 'Next.js 14 (Pages Router)' },
                                    { l: 'Provider', v: apiUrl || 'smmsoc.com' },
                                    { l: 'API Proxy', v: '/api/smm (server-side)' },
                                    { l: 'Kurs USD/IDR', v: `Rp ${rate.toLocaleString('id-ID')} (real-time)` },
                                    { l: 'Markup Aktif', v: `${markup}x (${Math.round((markup - 1) * 100)}% profit)` },
                                    { l: 'Total Services', v: `${services.length} layanan` },
                                ].map(r => (
                                    <div key={r.l} style={{ display: 'flex', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                        <div style={{ width: 180, color: 'var(--text3)', fontWeight: 600 }}>{r.l}</div>
                                        <div style={{ color: 'var(--text)' }}>{r.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="card" style={{ padding: 20, border: '1.5px solid rgba(239,68,68,.2)' }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--red)', marginBottom: 10 }}>Danger Zone</div>
                                <button onClick={logout} className="btn" style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13 }}>
                                    <LogOut size={14} /> Sign Out Admin
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}