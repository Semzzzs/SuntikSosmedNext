import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
    Target, LogOut, Moon, Sun, BarChart2, Package, Settings,
    Users, DollarSign, RefreshCw, ChevronRight, Menu, ChevronLeft,
    Layers, Activity, AlertCircle, CheckCircle, X, Search,
    ShoppingCart, TrendingUp, Zap, Globe, Key, ArrowUpRight,
    Filter, Eye, Clock, Database, Percent, Save, Trash2, MessageSquare, Megaphone
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useApi } from '@/context/ApiContext';
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from '@/components/ui/area-chart';
import AdminTickets from '@/components/admin/AdminTickets';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminDeposits from '@/components/admin/AdminDeposits';
import { supabase } from '@/lib/supabase';
import AdminAnnouncement from '@/components/admin/AdminAnnouncement';

const MARKUP_KEY = 'admin_markup';

export default function AdminPanel() {
    const router = useRouter();
    const { dark, toggle } = useTheme();
    const { apiUrl, apiKey } = useApi();
    const [authed, setAuthed] = useState(false);
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
    const [saldoModal, setSaldoModal] = useState(null);
    const [saldoAmount, setSaldoAmount] = useState('');
    const [lastRefresh, setLastRefresh] = useState(null);
    const [nextRefresh, setNextRefresh] = useState(300);
    const REFRESH_INTERVAL = 300; // 5 menit

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

        // Ambil order nyata dari session, build per-hari
        const ordersByDate = {};
        if (typeof window !== 'undefined') {
            // Baca order IDs dari localStorage (persistent)
            let ids = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('smm_orders_')) {
                    try {
                        const userOrders = JSON.parse(localStorage.getItem(key) || '[]');
                        ids = [...ids, ...userOrders.map(o => typeof o === 'object' ? o.orderId : o)];
                    } catch { }
                }
            }
            const sessionIds = JSON.parse(sessionStorage.getItem('smm_order_ids') || '[]');
            ids = [...new Set([...ids, ...sessionIds])];
            // orders state sudah ada, gunakan itu
        }

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dateKey = d.toISOString().slice(0, 10);

            // Hitung order real pada tanggal ini
            const dayOrders = orders.filter(o => {
                if (!o.created_at && !o.date) return false;
                const od = new Date(o.created_at || o.date);
                return od.toISOString().slice(0, 10) === dateKey;
            });
            const dayRevenue = dayOrders.reduce((s, o) => s + Math.round(parseFloat(o.charge || 0) * rate * markup), 0);

            // Hitung user baru pada tanggal ini
            const dayUsers = users.filter(u => {
                if (!u.createdAt) return false;
                return new Date(u.createdAt).toISOString().slice(0, 10) === dateKey;
            }).length;

            data.push({
                date: d,
                revenue: dayRevenue,
                newUsers: dayUsers,
                _rawUsers: dayUsers,
            });
        }
        return data;
    };

    const loadUsers = async () => {
        const { data: blockData } = await supabase.from('settings').select('value').eq('key', 'blocked_emails').maybeSingle();
        const blockedEmails = blockData?.value ? JSON.parse(blockData.value) : [];
        const { data: txData } = await supabase.from('transactions').select('email, created_at').order('created_at', { ascending: true });
        const seen = new Set();
        const userList = (txData || []).filter(t => {
            if (!t.email || seen.has(t.email)) return false;
            seen.add(t.email);
            return true;
        }).map(t => ({
            email: t.email,
            name: t.email?.split('@')[0],
            createdAt: t.created_at,
            blocked: blockedEmails.includes(t.email),
        }));
        setUsers(userList);
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (sessionStorage.getItem('admin_authed') === 'true') setAuthed(true);
        }
        // Load markup dari Supabase
        supabase.from('settings').select('value').eq('key', 'markup').maybeSingle()
            .then(({ data }) => {
                if (data?.value) { setMarkup(parseFloat(data.value)); setMarkupInput(data.value); }
            });
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

    const logout = () => { sessionStorage.removeItem('admin_authed'); router.push('/'); };

    const fetchBalance = useCallback(async () => {
        if (!apiUrl) return;
        setLoadingBalance(true);
        try {
            const res = await fetch('/api/smm?action=balance', { headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || sessionStorage.getItem('admin_token') || '' } });
            const data = await res.json();
            if (data.balance !== undefined) setBalance(parseFloat(data.balance));
        } catch (e) { setOverviewError(e.message); }
        setLoadingBalance(false);
    }, [apiUrl]);

    const fetchServices = useCallback(async () => {
        if (!apiUrl) return;
        setLoadingServices(true);
        try {
            const res = await fetch('/api/smm?action=services', { headers: { 'x-admin-secret': sessionStorage.getItem('admin_token') || '' } });
            const data = await res.json();
            if (Array.isArray(data)) setServices(data);
        } catch (e) { }
        setLoadingServices(false);
    }, [apiUrl]);

    const fetchOrders = useCallback(async () => {
        if (!apiUrl) return;
        setLoadingOrders(true);
        try {
            // Kumpulkan semua order IDs dari semua user (localStorage persistent)
            let ids = [];
            if (typeof window !== 'undefined') {
                // Baca dari semua smm_orders_* keys
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('smm_orders_')) {
                        try {
                            const userOrders = JSON.parse(localStorage.getItem(key) || '[]');
                            ids = [...ids, ...userOrders.map(o => typeof o === 'object' ? o.orderId : o)];
                        } catch { }
                    }
                }
                // Backward compat: juga baca dari sessionStorage
                const sessionIds = JSON.parse(sessionStorage.getItem('smm_order_ids') || '[]');
                ids = [...new Set([...ids, ...sessionIds])];
            }
            if (ids.length === 0) { setOrders([]); setLoadingOrders(false); return; }
            const res = await fetch(`/api/smm?action=status&orders=${ids.slice(0, 100).join(',')}`, { headers: { 'x-admin-secret': sessionStorage.getItem('admin_token') || '' } });
            const data = await res.json();
            if (data && typeof data === 'object' && !data.error) {
                setOrders(Object.entries(data).map(([id, info]) => ({ id, ...info })));
            }
        } catch (e) { }
        setLoadingOrders(false);
    }, [apiUrl]);

    const refreshUsers = () => { loadUsers(); };

    useEffect(() => {
        if (!authed) return;
        const doRefresh = () => {
            fetchBalance();
            fetchServices();
            fetchOrders();
            refreshUsers();
            setLastRefresh(new Date());
            setNextRefresh(300);
        };
        doRefresh();
        const interval = setInterval(doRefresh, 300 * 1000);
        const countdown = setInterval(() => {
            setNextRefresh(prev => prev > 0 ? prev - 1 : 300);
        }, 1000);
        return () => { clearInterval(interval); clearInterval(countdown); };
    }, [authed]);

    const updateUserSaldo = (email, amount, mode) => {
        setSaldoModal(null);
        setSaldoAmount('');
        loadUsers();
    };

    const toggleBlock = async (email) => {
        const user = users.find(u => u.email === email);
        if (!user) return;
        const updated = users.map(u => u.email === email ? { ...u, blocked: !u.blocked } : u);
        setUsers(updated);
        const blockedEmails = updated.filter(u => u.blocked).map(u => u.email);
        await supabase.from('settings').upsert({
            key: 'blocked_emails',
            value: JSON.stringify(blockedEmails),
            updated_at: new Date().toISOString()
        });
    };

    const saveMarkup = async () => {
        const val = parseFloat(markupInput);
        if (isNaN(val) || val < 1) return;
        setMarkup(val);
        // Simpan ke Supabase
        await supabase.from('settings').upsert({ key: 'markup', value: String(val), updated_at: new Date().toISOString() });
        setMarkupSaved(true);
        setTimeout(() => setMarkupSaved(false), 2000);
    };

    const deleteUser = (email) => {
        const updated = users.filter(u => u.email !== email);
        setUsers(updated);
    };

    const fIDR = (usd) => `Rp ${Math.round((usd || 0) * rate).toLocaleString('id-ID')}`;
    const fIDRMarkup = (usd) => `Rp ${Math.round((usd || 0) * rate * markup).toLocaleString('id-ID')}`;

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
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>smmsoc.com</span>
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'var(--green-l)', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} /> API Connected
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Countdown ring */}
                            <div style={{ width: 30, height: 30, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                                    <circle cx="15" cy="15" r="12" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                                    <circle cx="15" cy="15" r="12" fill="none" stroke="var(--blue)" strokeWidth="2.5"
                                        strokeDasharray={`${2 * Math.PI * 12}`}
                                        strokeDashoffset={`${2 * Math.PI * 12 * (nextRefresh / 300)}`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dashoffset 1s linear' }} />
                                </svg>
                                <RefreshCw size={11} style={{ color: 'var(--blue)', position: 'relative', zIndex: 1 }} />
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', minWidth: 30, fontFamily: "'JetBrains Mono',monospace" }}>
                                {Math.floor(nextRefresh / 60)}:{String(nextRefresh % 60).padStart(2, '0')}
                            </span>
                        </div>
                        <button onClick={() => { fetchBalance(); fetchServices(); fetchOrders(); refreshUsers(); setLastRefresh(new Date()); setNextRefresh(300); }}
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                            <RefreshCw size={12} /> Refresh
                        </button>
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

                            {/* Stat cards — sama style dengan user dashboard */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                                {[
                                    { label: 'Provider Balance', value: balance !== null ? `$${balance?.toFixed(2)}` : '...', sub: balance !== null ? fIDR(balance) : 'Loading...', icon: <DollarSign size={20} />, iconBg: 'var(--blue-l)', iconColor: 'var(--blue)', badge: '+0%' },
                                    { label: 'Total Services', value: services.length || '...', sub: `${[...new Set(services.map(s => s.category))].length} kategori`, icon: <Layers size={20} />, iconBg: 'var(--green-l)', iconColor: 'var(--green)', badge: `${services.length} services` },
                                    { label: 'Session Orders', value: orders.length, sub: `${orders.filter(o => o.status?.toLowerCase() === 'completed').length} completed`, icon: <ShoppingCart size={20} />, iconBg: 'var(--yellow-l)', iconColor: 'var(--yellow)', badge: '0 active' },
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
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Revenue Summary (Session)</div>
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
                                        { l: 'Orders This Session', v: orders.length, c: 'var(--text)' },
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
                                    <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{orders.length} order di session ini.</p>
                                </div>
                                <button className="btn btn-outline" onClick={fetchOrders} disabled={loadingOrders} style={{ height: 38, padding: '0 14px', borderRadius: 9, fontSize: 13 }}>
                                    <RefreshCw size={13} style={{ animation: loadingOrders ? 'spin .7s linear infinite' : 'none' }} /> Refresh
                                </button>
                            </div>
                            {orders.length === 0 ? (
                                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                                    <ShoppingCart size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada order di session ini</p>
                                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Order yang dibuat via dashboard user akan muncul di sini.</p>
                                </div>
                            ) : (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                                {['Order ID', 'Status', 'Start Count', 'Remains', 'Modal (USD)', 'Harga User (IDR)'].map(h => (
                                                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12 }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((o, i) => (
                                                <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace" }}>#{o.id}</td>
                                                    <td style={{ padding: '11px 14px' }}>
                                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor(o.status), background: `${statusColor(o.status)}18`, padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{o.status || 'pending'}</span>
                                                    </td>
                                                    <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>{o.start_count || '—'}</td>
                                                    <td style={{ padding: '11px 14px', color: 'var(--text2)' }}>{o.remains || '—'}</td>
                                                    <td style={{ padding: '11px 14px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--red)', fontWeight: 600 }}>${parseFloat(o.charge || 0).toFixed(4)}</td>
                                                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)' }}>{fIDRMarkup(parseFloat(o.charge || 0))}</td>
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
                                <button className="btn btn-outline" onClick={fetchServices} disabled={loadingServices} style={{ height: 38, padding: '0 14px', borderRadius: 9, fontSize: 13 }}>
                                    <RefreshCw size={13} style={{ animation: loadingServices ? 'spin .7s linear infinite' : 'none' }} /> Refresh
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 36 }} placeholder="Cari service..." value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                                </div>
                                <select className="inp" style={{ width: 220 }} value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
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
                                        {filteredSvc.slice(0, 200).map((s, i) => {
                                            const modalIDR = Math.round(parseFloat(s.rate || 0) * rate);
                                            const userIDR = Math.round(parseFloat(s.rate || 0) * rate * markup);
                                            return (
                                                <tr key={s.service} style={{ borderBottom: i < filteredSvc.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                                {filteredSvc.length > 200 && (
                                    <div style={{ padding: '11px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
                                        Menampilkan 200 dari {filteredSvc.length} service. Gunakan filter untuk mempersempit.
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
                                            {/* Dropdown Range Selector */}
                                            <div style={{ position: 'relative' }}>
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