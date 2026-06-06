import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
    Target, LogOut, Moon, Sun, BarChart2, Settings,
    Users, DollarSign, ChevronRight, Menu, ChevronLeft,
    Layers, AlertCircle, CheckCircle, X, Search,
    ShoppingCart, TrendingUp, Zap, ArrowUpRight,
    Percent, Save, Trash2, MessageSquare, Megaphone,
    RefreshCw, Eye, Ban, RotateCw, ChevronDown, Check
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useApi } from '@/context/ApiContext';
import { AreaChart, Area, Grid, XAxis, YAxis, ChartTooltip } from '@/components/ui/area-chart';
import AdminTickets from '@/components/admin/AdminTickets';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminDeposits from '@/components/admin/AdminDeposits';
import AdminAnnouncement from '@/components/admin/AdminAnnouncement';

// ── Dropdown custom — pengganti <select> native agar match tema dark & tidak numpuk ──
function Dropdown({ value, options, onChange, width = 180, placeholder = 'Pilih...', maxHeight = 320 }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    // options: array of { label, value }
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', width }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    height: 40, padding: '0 12px', borderRadius: 10,
                    border: `1.5px solid ${open ? 'var(--blue)' : 'var(--border)'}`,
                    background: 'var(--white)', color: 'var(--text)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: 'left',
                    transition: 'border-color .15s',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={15} style={{ color: 'var(--text3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, left: 0,
                    background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,.25)', zIndex: 200,
                    maxHeight, overflowY: 'auto', padding: 5,
                }}>
                    {options.map(o => {
                        const active = o.value === value;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                    padding: '9px 11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: active ? 'var(--blue)' : 'transparent',
                                    color: active ? '#fff' : 'var(--text)',
                                    fontSize: 12.5, fontWeight: active ? 700 : 600, textAlign: 'left',
                                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                                }}
                                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg2)'; }}
                                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                                {active && <Check size={14} style={{ flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

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
    const [disabledServices, setDisabledServices] = useState([]); // service id yang dimatikan admin
    const SERVICES_PER_PAGE = 100;
    const rangeDropdownRef = useRef(null); // close-on-outside-click

    // ── Orders: search / filter / pagination / aksi ──
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState('All');
    const [orderPage, setOrderPage] = useState(0);
    const ORDERS_PER_PAGE = 50;
    const [refreshingOrder, setRefreshingOrder] = useState(null); // id order yang lagi di-refresh
    const [actioningOrder, setActioningOrder] = useState(null);   // id order yang lagi cancel/refill
    const [orderDetail, setOrderDetail] = useState(null);         // order untuk modal detail
    const ORDER_STATUS_OPTIONS = ['All', 'Pending', 'In progress', 'Processing', 'Completed', 'Partial', 'Canceled'];

    // ── Periode (filter waktu) untuk stats & orders ──
    const PERIOD_OPTIONS = [
        { label: 'Semua waktu', value: 'all' },
        { label: 'Hari ini', value: 'today' },
        { label: '7 hari terakhir', value: '7d' },
        { label: '30 hari terakhir', value: '30d' },
    ];
    const [statsPeriod, setStatsPeriod] = useState('all'); // untuk ringkasan revenue
    const [orderPeriod, setOrderPeriod] = useState('all');  // untuk daftar orders

    // ── Toast & confirm modal (pengganti alert/confirm) ──
    const [toasts, setToasts] = useState([]);          // {id, msg, type}
    const [confirmState, setConfirmState] = useState(null); // {msg, resolve}
    const toastIdRef = useRef(0);

    // ── Responsif: deteksi layar kecil ──
    const [isMobile, setIsMobile] = useState(false);

    // ── Badge pending di sidebar (best-effort; perlu endpoint backend) ──
    const [pendingCounts, setPendingCounts] = useState({ deposits: 0, tickets: 0 });

    // ── Settings: edit kurs & ganti password (perlu endpoint backend) ──
    const [rateInput, setRateInput] = useState('');
    const [savingRate, setSavingRate] = useState(false);
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [savingPw, setSavingPw] = useState(false);

    // ── Markup per-kategori / per-service ──
    const [markupRules, setMarkupRules] = useState({ categories: {}, services: {} });
    const [rulesDraft, setRulesDraft] = useState({ categories: {}, services: {} });
    const [savingRules, setSavingRules] = useState(false);
    const [svcOverrideSearch, setSvcOverrideSearch] = useState('');

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
                newUsers: dayUsers, // dipetakan ke sumbu-Y sekunder (skala sendiri)
            });
        }

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
            adminFetch('/api/admin-api?action=get_markup_rules')
                .then(r => r.json())
                .then(data => {
                    if (data?.rules) { setMarkupRules(data.rules); setRulesDraft(data.rules); }
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
            if (res.status === 401) { logout(); return; }
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
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            if (Array.isArray(data)) setServices(data);
            else setOverviewError('Gagal memuat daftar services dari provider.');
        } catch (e) {
            setOverviewError(`Services error: ${e.message}`);
        }
        setLoadingServices(false);
    }, [apiUrl]);

    // Load daftar layanan yang dimatikan admin
    const fetchDisabledServices = useCallback(async () => {
        try {
            const res = await adminFetch('/api/admin-api?action=get_disabled_services');
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            setDisabledServices(Array.isArray(data.disabled) ? data.disabled.map(String) : []);
        } catch { }
    }, []);

    // Toggle on/off satu layanan (optimistic update)
    const toggleService = async (serviceId, makeEnabled) => {
        const id = String(serviceId);
        // optimistic
        setDisabledServices(prev => makeEnabled ? prev.filter(x => x !== id) : [...new Set([...prev, id])]);
        try {
            const res = await adminFetch('/api/admin-api?action=toggle_service', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service_id: id, enabled: makeEnabled }),
            });
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            if (Array.isArray(data.disabled)) setDisabledServices(data.disabled.map(String));
        } catch {
            // revert kalau gagal
            setDisabledServices(prev => makeEnabled ? [...new Set([...prev, id])] : prev.filter(x => x !== id));
        }
    };

    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            // ✅ Pakai adminFetch (service role) — bypass RLS, bisa baca semua transaksi
            const res = await adminFetch('/api/admin-api?action=get_orders');
            if (res.status === 401) { logout(); return; }
            const json = await res.json();
            const txRaw = json.orders || [];

            // Filter hanya SMM orders asli (punya order_id numerik atau desc 'Order #')
            const txData = txRaw.filter(t =>
                (t.order_id && /^\d+$/.test(String(t.order_id))) ||
                (t.description && t.description.startsWith('Order #'))
            );

            setDbOrders(txData);

            if (txData.length === 0) {
                setOrders([]);
                setLoadingOrders(false);
                return;
            }

            // Fetch live status dari SMMSOC
            const orderIds = txData
                .filter(t => t.order_id && /^\d+$/.test(String(t.order_id)))
                .map(t => String(t.order_id));

            let liveStatus = {};
            if (orderIds.length > 0) {
                try {
                    // Batch per 100 supaya order ke-101+ juga dapat status live
                    for (let i = 0; i < orderIds.length; i += 100) {
                        const chunk = orderIds.slice(i, i + 100);
                        const statusRes = await fetch(`/api/smm?action=status&orders=${chunk.join(',')}`, {
                            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` }
                        });
                        if (statusRes.status === 401) { logout(); return; }
                        const statusData = await statusRes.json();
                        if (!statusData.error) liveStatus = { ...liveStatus, ...statusData };
                    }
                } catch { /* pakai status dari Supabase */ }
            }

            setOrders(txData.map(t => {
                const live = t.order_id ? liveStatus[t.order_id] : null;
                return {
                    id: t.order_id || t.id,
                    status: live?.status || t.status || 'Pending',
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
        } catch (e) {
            setOverviewError(e.message);
        }
        setLoadingOrders(false);
    }, []);

    // ── Aksi per-order ──
    const smmFetch = async (qs) => {
        const res = await fetch(`/api/smm?${qs}`, {
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` },
        });
        if (res.status === 401) { logout(); throw new Error('SESSION_EXPIRED'); }
        return res;
    };

    // Refresh status 1 order dari provider (pakai endpoint status yang sudah ada)
    const refreshOrderStatus = async (orderId) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        setRefreshingOrder(orderId);
        try {
            const res = await smmFetch(`action=status&orders=${orderId}`);
            const data = await res.json();
            const live = data && !data.error ? data[orderId] : null;
            if (live) {
                setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? {
                    ...o,
                    status: live.status || o.status,
                    start_count: live.start_count ?? o.start_count,
                    remains: live.remains ?? o.remains,
                    charge: live.charge ?? o.charge,
                } : o));
                showToast(`Status order #${orderId} diperbarui.`, 'success');
            } else if (data?.error) {
                showToast(`Gagal refresh status: ${data.error}`, 'error');
            }
        } catch (e) {
            if (e.message !== 'SESSION_EXPIRED') showToast(`Error: ${e.message}`, 'error');
        }
        setRefreshingOrder(null);
    };

    // Minta pembatalan order ke provider (butuh /api/smm meneruskan action=cancel)
    const cancelOrder = async (orderId) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        const ok = await askConfirm(`Minta pembatalan order #${orderId} ke provider? Sebagian provider hanya mengizinkan cancel saat status belum diproses.`);
        if (!ok) return;
        setActioningOrder(orderId);
        try {
            const res = await smmFetch(`action=cancel&orders=${orderId}`);
            const data = await res.json();
            if (data?.error) showToast(`Gagal cancel: ${data.error}`, 'error');
            else { showToast('Permintaan cancel terkirim.', 'success'); refreshOrderStatus(orderId); }
        } catch (e) {
            if (e.message !== 'SESSION_EXPIRED') showToast(`Error: ${e.message}`, 'error');
        }
        setActioningOrder(null);
    };

    // Minta refill/garansi (butuh /api/smm meneruskan action=refill)
    const refillOrder = async (orderId) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        const ok = await askConfirm(`Minta refill (garansi) untuk order #${orderId}?`);
        if (!ok) return;
        setActioningOrder(orderId);
        try {
            const res = await smmFetch(`action=refill&order=${orderId}`);
            const data = await res.json();
            if (data?.error) showToast(`Gagal refill: ${data.error}`, 'error');
            else showToast('Permintaan refill terkirim.', 'success');
        } catch (e) {
            if (e.message !== 'SESSION_EXPIRED') showToast(`Error: ${e.message}`, 'error');
        }
        setActioningOrder(null);
    };


    useEffect(() => {
        if (!authed) return;
        const doRefresh = () => {
            fetchBalance();
            fetchServices();
            fetchDisabledServices();
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

    // Simpan kurs USD/IDR. Butuh endpoint backend: POST /api/admin-api?action=save_rate { value }
    const saveRate = async () => {
        const val = parseInt(String(rateInput).replace(/[^\d]/g, ''), 10);
        if (!val || val < 1000) { showToast('Kurs tidak valid.', 'error'); return; }
        setSavingRate(true);
        try {
            const res = await adminFetch('/api/admin-api?action=save_rate', { method: 'POST', body: JSON.stringify({ value: val }) });
            if (res.status === 401) { logout(); return; }
            const d = await res.json().catch(() => ({}));
            if (res.ok && !d.error) { setRate(val); setRateInput(''); showToast('Kurs disimpan.', 'success'); }
            else showToast(d.error || 'Endpoint save_rate belum tersedia di backend.', 'error');
        } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
        setSavingRate(false);
    };

    // Ganti password admin. Butuh endpoint backend: POST /api/admin-api?action=change_password { current, next }
    const changePassword = async () => {
        if (!pwForm.current || !pwForm.next) { showToast('Lengkapi semua field.', 'error'); return; }
        if (pwForm.next.length < 6) { showToast('Password baru minimal 6 karakter.', 'error'); return; }
        if (pwForm.next !== pwForm.confirm) { showToast('Konfirmasi password tidak cocok.', 'error'); return; }
        setSavingPw(true);
        try {
            const res = await adminFetch('/api/admin-api?action=change_password', { method: 'POST', body: JSON.stringify({ current: pwForm.current, next: pwForm.next }) });
            if (res.status === 401) { logout(); return; }
            const d = await res.json().catch(() => ({}));
            if (res.ok && !d.error) { setPwForm({ current: '', next: '', confirm: '' }); showToast('Password admin diperbarui.', 'success'); }
            else showToast(d.error || 'Endpoint change_password belum tersedia di backend.', 'error');
        } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
        setSavingPw(false);
    };

    const deleteUser = async (email) => {
        const ok = await askConfirm(`Hapus semua data transaksi user ${email}? Tindakan ini tidak bisa dibatalkan.`);
        if (!ok) return;
        const updated = users.filter(u => u.email !== email);
        setUsers(updated);
        // ✅ Hapus via server-side API — menghapus transactions + Supabase Auth user
        const res = await adminFetch('/api/admin-api?action=delete_user', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
        if (res.status === 401) { logout(); return; }
        showToast(`User ${email} dihapus.`, 'success');
    };

    const fIDR = (usd) => `Rp ${Math.round((usd || 0) * rate).toLocaleString('id-ID')}`;
    const fIDRMarkup = (usd) => `Rp ${Math.round((usd || 0) * rate * markup).toLocaleString('id-ID')}`;

    // Resolusi markup efektif untuk sebuah service: service → kategori → global
    const resolveMarkup = (svc) => {
        if (!svc) return markup;
        const sid = String(svc.service);
        if (markupRules.services && markupRules.services[sid] != null) return markupRules.services[sid];
        if (svc.category && markupRules.categories && markupRules.categories[svc.category] != null) return markupRules.categories[svc.category];
        return markup;
    };

    const saveMarkupRules = async () => {
        setSavingRules(true);
        try {
            const res = await adminFetch('/api/admin-api?action=save_markup_rules', { method: 'POST', body: JSON.stringify(rulesDraft) });
            if (res.status === 401) { logout(); return; }
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.rules) { setMarkupRules(d.rules); setRulesDraft(d.rules); showToast('Markup rules disimpan.', 'success'); }
            else showToast(d.error || 'Gagal menyimpan rules.', 'error');
        } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
        setSavingRules(false);
    };

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

    // ── Toast & confirm helpers ──
    const showToast = (msg, type = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(t => [...t, { id, msg, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    };
    const askConfirm = (msg) => new Promise(resolve => setConfirmState({ msg, resolve }));
    const resolveConfirm = (val) => {
        if (confirmState?.resolve) confirmState.resolve(val);
        setConfirmState(null);
    };

    // ── Deteksi layar kecil + atur sidebar ──
    useEffect(() => {
        const check = () => {
            const m = window.innerWidth < 820;
            setIsMobile(m);
            setSideOpen(!m); // mobile: sidebar default tertutup
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ── Ambil jumlah pending untuk badge sidebar (best-effort) ──
    // Butuh endpoint backend: GET /api/admin-api?action=get_pending_counts
    // → { deposits: <number>, tickets: <number> }. Kalau belum ada, badge tidak muncul.
    useEffect(() => {
        if (!authed) return;
        const load = () => {
            adminFetch('/api/admin-api?action=get_pending_counts')
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d) setPendingCounts({ deposits: Number(d.deposits) || 0, tickets: Number(d.tickets) || 0 });
                })
                .catch(() => { });
        };
        load();
        const iv = setInterval(load, 120 * 1000);
        return () => clearInterval(iv);
    }, [authed]);

    const totalSpentUSD = orders.reduce((s, o) => s + parseFloat(o.charge || 0), 0);
    const totalRevenueIDR = Math.round(totalSpentUSD * rate * markup);
    const profitIDR = totalRevenueIDR - Math.round(totalSpentUSD * rate);

    // ── Helper periode waktu ──
    const periodStartDate = (period) => {
        const now = new Date();
        if (period === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
        if (period === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
        if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
        return null; // 'all'
    };
    const inPeriod = (ts, period) => {
        const start = periodStartDate(period);
        if (!start) return true;
        if (!ts) return false;
        return new Date(ts) >= start;
    };

    // Stats berdasarkan statsPeriod (dipakai di Overview & Revenue)
    const statsOrders = orders.filter(o => inPeriod(o.created_at, statsPeriod));
    const statsSpentUSD = statsOrders.reduce((s, o) => s + parseFloat(o.charge || 0), 0);
    const statsRevenueIDR = Math.round(statsSpentUSD * rate * markup);
    const statsProfitIDR = statsRevenueIDR - Math.round(statsSpentUSD * rate);

    // Stats "hari ini"
    const ordersToday = orders.filter(o => inPeriod(o.created_at, 'today'));
    const revenueTodayIDR = ordersToday.reduce((s, o) => s + (o.amount_idr || Math.round(parseFloat(o.charge || 0) * rate * markup)), 0);
    const newUsersToday = users.filter(u => inPeriod(u.createdAt, 'today')).length;

    const cats = ['All', ...new Set(services.map(s => s.category))].filter(Boolean);
    const filteredSvc = services.filter(s => {
        const matchCat = serviceFilter === 'All' || s.category === serviceFilter;
        const matchQ = !serviceSearch || s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) || String(s.service).includes(serviceSearch);
        return matchCat && matchQ;
    });

    // ── Orders terfilter + paginated ──
    const filteredOrders = orders.filter(o => {
        const q = orderSearch.trim().toLowerCase();
        const matchQ = !q ||
            String(o.id).toLowerCase().includes(q) ||
            (o.email || '').toLowerCase().includes(q) ||
            (o.description || o.service || '').toLowerCase().includes(q);
        const matchStatus = orderStatusFilter === 'All' ||
            (o.status || '').toLowerCase() === orderStatusFilter.toLowerCase();
        const matchPeriod = inPeriod(o.created_at, orderPeriod);
        return matchQ && matchStatus && matchPeriod;
    });
    const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
    const safeOrderPage = Math.min(orderPage, orderPageCount - 1);
    const pagedOrders = filteredOrders.slice(safeOrderPage * ORDERS_PER_PAGE, (safeOrderPage + 1) * ORDERS_PER_PAGE);
    const canCancel = (st) => ['pending', 'in progress', 'processing'].includes((st || '').toLowerCase());
    const canRefill = (st) => ['completed', 'partial'].includes((st || '').toLowerCase());

    const statusColor = (st) => ({ completed: 'var(--green)', processing: 'var(--blue)', partial: 'var(--yellow)', canceled: 'var(--red)', pending: 'var(--text3)' }[st?.toLowerCase()] || 'var(--text3)');

    const navItems = [
        { id: 'Overview', icon: <BarChart2 size={16} />, color: 'var(--blue)' },
        { id: 'Orders', icon: <ShoppingCart size={16} />, color: 'var(--yellow)' },
        { id: 'Services', icon: <Layers size={16} />, color: 'var(--green)' },
        { id: 'Users', icon: <Users size={16} />, color: '#8B5CF6' },
        { id: 'Deposits', icon: <DollarSign size={16} />, color: '#10B981', badgeKey: 'deposits' },
        { id: 'Pengumuman', icon: <Megaphone size={16} />, color: '#7C3AED' },
        { id: 'Tickets', icon: <MessageSquare size={16} />, color: '#F59E0B', badgeKey: 'tickets' },
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

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            {/* Backdrop mobile saat sidebar terbuka */}
            {isMobile && sideOpen && (
                <div onClick={() => setSideOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 55 }} />
            )}

            {/* SIDEBAR — clean white, same style as user dashboard */}
            <aside style={{ width: sideOpen ? 220 : 0, minWidth: sideOpen ? 220 : 0, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all .25s', position: isMobile ? 'fixed' : 'relative', top: 0, left: 0, height: '100%', zIndex: isMobile ? 60 : 40, boxShadow: isMobile && sideOpen ? '4px 0 24px rgba(0,0,0,.18)' : 'none' }}>

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
                    {navItems.map(n => {
                        const badge = n.badgeKey ? (pendingCounts[n.badgeKey] || 0) : 0;
                        return (
                            <button key={n.id} onClick={() => { setMenu(n.id); if (isMobile) setSideOpen(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', background: menu === n.id ? 'var(--blue)' : 'transparent', color: menu === n.id ? '#fff' : 'var(--text2)', fontWeight: menu === n.id ? 700 : 600, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s', whiteSpace: 'nowrap', textAlign: 'left' }}
                                onMouseEnter={e => { if (menu !== n.id) e.currentTarget.style.background = 'var(--bg2)'; }}
                                onMouseLeave={e => { if (menu !== n.id) e.currentTarget.style.background = 'transparent'; }}>
                                <span style={{ color: menu === n.id ? 'rgba(255,255,255,.8)' : 'var(--text3)' }}>{n.icon}</span>
                                {n.id}
                                {badge > 0 && (
                                    <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: menu === n.id ? 'rgba(255,255,255,.25)' : 'var(--red)', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                                {menu === n.id && badge === 0 && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.6)' }} />}
                            </button>
                        );
                    })}
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
                            {/* Statistik hari ini */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                                {[
                                    { l: 'Order Hari Ini', v: ordersToday.length, c: 'var(--yellow)', icon: <ShoppingCart size={16} /> },
                                    { l: 'Revenue Hari Ini', v: `Rp ${revenueTodayIDR.toLocaleString('id-ID')}`, c: 'var(--green)', icon: <TrendingUp size={16} /> },
                                    { l: 'User Baru Hari Ini', v: newUsersToday, c: '#8B5CF6', icon: <Users size={16} /> },
                                ].map(s => (
                                    <div key={s.l} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c, flexShrink: 0 }}>{s.icon}</div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: s.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.v}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.l}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Revenue Summary · {statsOrders.length} order</div>
                                    <Dropdown width={170} value={statsPeriod} options={PERIOD_OPTIONS} onChange={setStatsPeriod} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                                    {[
                                        { l: 'Modal (Harga Provider)', v: `$${statsSpentUSD.toFixed(4)}`, v2: fIDR(statsSpentUSD), c: 'var(--red)' },
                                        { l: 'Revenue (Harga User)', v: `Rp ${statsRevenueIDR.toLocaleString('id-ID')}`, v2: `${markup}x markup`, c: 'var(--blue)' },
                                        { l: 'Estimasi Profit', v: `Rp ${statsProfitIDR.toLocaleString('id-ID')}`, v2: `${Math.round((markup - 1) * 100)}% margin`, c: 'var(--green)' },
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
                                    <button className="btn btn-outline" onClick={fetchOrders} disabled={loadingOrders}
                                        style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12, opacity: loadingOrders ? 0.6 : 1 }}>
                                        <RefreshCw size={12} style={{ animation: loadingOrders ? 'spin 1s linear infinite' : 'none' }} /> {loadingOrders ? 'Memuat...' : 'Refresh'}
                                    </button>
                                    {orders.length > 0 && (
                                        <button className="btn btn-outline" onClick={() => exportCSV(filteredOrders.map(o => ({
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

                            {/* Toolbar: search + filter status */}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 36 }} placeholder="Cari order ID, email, atau layanan..." value={orderSearch} onChange={e => { setOrderSearch(e.target.value); setOrderPage(0); }} />
                                </div>
                                <Dropdown width={180} value={orderStatusFilter}
                                    options={ORDER_STATUS_OPTIONS.map(s => ({ value: s, label: s === 'All' ? 'Semua Status' : s }))}
                                    onChange={v => { setOrderStatusFilter(v); setOrderPage(0); }} />
                                <Dropdown width={180} value={orderPeriod} options={PERIOD_OPTIONS}
                                    onChange={v => { setOrderPeriod(v); setOrderPage(0); }} />
                            </div>
                            {orders.length === 0 ? (
                                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                                    <ShoppingCart size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada order</p>
                                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Order dari semua user akan tampil di sini (dari Supabase).</p>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                                    <Search size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Tidak ada order yang cocok</p>
                                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Coba ubah kata kunci pencarian atau filter status.</p>
                                </div>
                            ) : (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                                    {['Order ID', 'Email', 'Layanan', 'Status', 'Harga User (IDR)', 'Tanggal', 'Aksi'].map(h => (
                                                        <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Aksi' ? 'right' : 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedOrders.map((o, i) => {
                                                    const isNumeric = /^\d+$/.test(String(o.id));
                                                    const busy = actioningOrder === o.id;
                                                    const iconBtn = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: bg, color, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 });
                                                    return (
                                                        <tr key={o.id} style={{ borderBottom: i < pagedOrders.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--blue)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                                                {isNumeric ? `#${o.id}` : `${String(o.id).slice(0, 8)}...`}
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
                                                                        'Partial': { label: 'Sebagian', color: '#d97706', bg: '#fef3c7' },
                                                                        'Pending': { label: 'Menunggu', color: '#d97706', bg: '#fef3c7' },
                                                                        'Canceled': { label: 'Dibatalkan', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                    }[s] || { label: s || 'Pending', color: 'var(--text3)', bg: 'var(--bg2)' };
                                                                    return <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{cfg.label}</span>;
                                                                })()}
                                                            </td>
                                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                                                                {o.amount_idr ? `Rp ${o.amount_idr.toLocaleString('id-ID')}` : fIDRMarkup(parseFloat(o.charge || 0))}
                                                            </td>
                                                            <td style={{ padding: '11px 14px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                                                                {o.created_at ? new Date(o.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td style={{ padding: '11px 14px' }}>
                                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                    <button title="Detail" onClick={() => setOrderDetail(o)} style={iconBtn('var(--white)', 'var(--text2)')}>
                                                                        <Eye size={14} />
                                                                    </button>
                                                                    {isNumeric && (
                                                                        <button title="Refresh status" disabled={refreshingOrder === o.id || busy} onClick={() => refreshOrderStatus(o.id)} style={iconBtn('var(--white)', 'var(--blue)')}>
                                                                            <RefreshCw size={14} style={{ animation: refreshingOrder === o.id ? 'spin 1s linear infinite' : 'none' }} />
                                                                        </button>
                                                                    )}
                                                                    {isNumeric && canCancel(o.status) && (
                                                                        <button title="Minta cancel" disabled={busy} onClick={() => cancelOrder(o.id)} style={iconBtn('var(--red-l)', 'var(--red)')}>
                                                                            <Ban size={14} />
                                                                        </button>
                                                                    )}
                                                                    {isNumeric && canRefill(o.status) && (
                                                                        <button title="Minta refill" disabled={busy} onClick={() => refillOrder(o.id)} style={iconBtn('var(--green-l)', 'var(--green)')}>
                                                                            <RotateCw size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination orders */}
                                    {filteredOrders.length > ORDERS_PER_PAGE && (
                                        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                                                Menampilkan {safeOrderPage * ORDERS_PER_PAGE + 1}–{Math.min((safeOrderPage + 1) * ORDERS_PER_PAGE, filteredOrders.length)} dari {filteredOrders.length} order
                                            </span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setOrderPage(p => Math.max(0, p - 1))} disabled={safeOrderPage === 0}
                                                    style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: safeOrderPage === 0 ? 'var(--bg2)' : 'var(--white)', color: safeOrderPage === 0 ? 'var(--text3)' : 'var(--text)', cursor: safeOrderPage === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                    ← Prev
                                                </button>
                                                {Array.from({ length: orderPageCount }, (_, idx) => idx)
                                                    .filter(idx => Math.abs(idx - safeOrderPage) <= 2)
                                                    .map(idx => (
                                                        <button key={idx} onClick={() => setOrderPage(idx)}
                                                            style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${idx === safeOrderPage ? 'var(--blue)' : 'var(--border)'}`, background: idx === safeOrderPage ? 'var(--blue)' : 'var(--white)', color: idx === safeOrderPage ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                            {idx + 1}
                                                        </button>
                                                    ))
                                                }
                                                <button onClick={() => setOrderPage(p => Math.min(orderPageCount - 1, p + 1))} disabled={safeOrderPage >= orderPageCount - 1}
                                                    style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: safeOrderPage >= orderPageCount - 1 ? 'var(--bg2)' : 'var(--white)', color: safeOrderPage >= orderPageCount - 1 ? 'var(--text3)' : 'var(--text)', cursor: safeOrderPage >= orderPageCount - 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                    Next →
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Modal detail order */}
                            {orderDetail && (
                                <div onClick={() => setOrderDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
                                    <div onClick={e => e.stopPropagation()} className="card" style={{ padding: 0, width: 440, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                                                Detail Order {/^\d+$/.test(String(orderDetail.id)) ? `#${orderDetail.id}` : ''}
                                            </div>
                                            <button onClick={() => setOrderDetail(null)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 6px', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
                                                <X size={15} />
                                            </button>
                                        </div>
                                        <div style={{ padding: '8px 20px 18px' }}>
                                            {[
                                                { l: 'Order ID', v: String(orderDetail.id) },
                                                { l: 'Email', v: orderDetail.email || '—' },
                                                { l: 'Layanan', v: orderDetail.description || orderDetail.service || '—' },
                                                { l: 'Status', v: orderDetail.status || 'Pending' },
                                                { l: 'Link', v: orderDetail.link || '—' },
                                                { l: 'Qty', v: orderDetail.qty != null ? String(orderDetail.qty) : '—' },
                                                { l: 'Start Count', v: orderDetail.start_count != null ? String(orderDetail.start_count) : '—' },
                                                { l: 'Sisa (Remains)', v: orderDetail.remains != null ? String(orderDetail.remains) : '—' },
                                                { l: 'Modal (USD)', v: `$${parseFloat(orderDetail.charge || 0).toFixed(4)}` },
                                                { l: 'Harga User', v: orderDetail.amount_idr ? `Rp ${orderDetail.amount_idr.toLocaleString('id-ID')}` : fIDRMarkup(parseFloat(orderDetail.charge || 0)) },
                                                { l: 'Tanggal', v: orderDetail.created_at ? new Date(orderDetail.created_at).toLocaleString('id-ID') : '—' },
                                            ].map(r => (
                                                <div key={r.l} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'flex-start' }}>
                                                    <div style={{ width: 120, flexShrink: 0, color: 'var(--text3)', fontWeight: 600 }}>{r.l}</div>
                                                    <div style={{ color: 'var(--text)', wordBreak: 'break-all', flex: 1 }}>
                                                        {r.l === 'Link' && orderDetail.link
                                                            ? <a href={orderDetail.link} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{orderDetail.link}</a>
                                                            : r.v}
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                                {/^\d+$/.test(String(orderDetail.id)) && (
                                                    <button className="btn btn-outline" onClick={() => refreshOrderStatus(orderDetail.id)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13 }}>
                                                        <RefreshCw size={14} /> Refresh Status
                                                    </button>
                                                )}
                                                {/^\d+$/.test(String(orderDetail.id)) && canCancel(orderDetail.status) && (
                                                    <button className="btn" onClick={() => cancelOrder(orderDetail.id)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13, background: 'var(--red)', color: '#fff', border: 'none' }}>
                                                        <Ban size={14} /> Minta Cancel
                                                    </button>
                                                )}
                                                {/^\d+$/.test(String(orderDetail.id)) && canRefill(orderDetail.status) && (
                                                    <button className="btn" onClick={() => refillOrder(orderDetail.id)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13, background: 'var(--green)', color: '#fff', border: 'none' }}>
                                                        <RotateCw size={14} /> Minta Refill
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
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
                                            harga_user_idr: Math.round(parseFloat(s.rate || 0) * rate * resolveMarkup(s)),
                                            markup_x: resolveMarkup(s),
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
                                <Dropdown width={220} value={serviceFilter}
                                    options={cats.map(c => ({ value: c, label: c === 'All' ? 'Semua Kategori' : c }))}
                                    onChange={v => { setServiceFilter(v); setServicePage(0); }} />
                            </div>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                            {['ID', 'Nama', 'Harga Modal /1K', 'Harga User /1K', 'Min', 'Max', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 11.5 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* ✅ Real pagination */}
                                        {filteredSvc.slice(servicePage * SERVICES_PER_PAGE, (servicePage + 1) * SERVICES_PER_PAGE).map((s, i) => {
                                            const eff = resolveMarkup(s);
                                            const modalIDR = Math.round(parseFloat(s.rate || 0) * rate);
                                            const userIDR = Math.round(parseFloat(s.rate || 0) * rate * eff);
                                            const overridden = eff !== markup;
                                            return (
                                                <tr key={s.service} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", color: 'var(--text3)', fontWeight: 600, fontSize: 11.5 }}>{s.service}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text)', maxWidth: 280 }}>
                                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }}>{s.name}</div>
                                                        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{s.category}</div>
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--red)', fontWeight: 700 }}>Rp {modalIDR.toLocaleString('id-ID')}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--green)', fontWeight: 700 }}>
                                                        Rp {userIDR.toLocaleString('id-ID')}
                                                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: overridden ? 'var(--blue)' : 'var(--text3)', background: overridden ? 'var(--blue-l)' : 'var(--bg2)', padding: '1px 6px', borderRadius: 10 }}>{eff}x</span>
                                                    </td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{s.min}</td>
                                                    <td style={{ padding: '9px 12px', color: 'var(--text3)' }}>{Number(s.max).toLocaleString()}</td>
                                                    <td style={{ padding: '9px 12px' }}>
                                                        {(() => {
                                                            const isOff = disabledServices.includes(String(s.service));
                                                            return (
                                                                <button onClick={() => toggleService(s.service, isOff)}
                                                                    title={isOff ? 'Layanan dimatikan — klik untuk aktifkan' : 'Layanan aktif — klik untuk matikan'}
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${isOff ? 'var(--red)' : 'var(--green)'}`, background: isOff ? 'var(--red-l)' : 'var(--green-l)', color: isOff ? 'var(--red)' : 'var(--green)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", whiteSpace: 'nowrap' }}>
                                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOff ? 'var(--red)' : 'var(--green)' }} />
                                                                    {isOff ? 'Off' : 'On'}
                                                                </button>
                                                            );
                                                        })()}
                                                    </td>
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
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Revenue Stats</h1>
                                        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Estimasi pendapatan vs user baru · markup {markup}x aktif.</p>
                                    </div>
                                    <Dropdown width={170} value={statsPeriod} options={PERIOD_OPTIONS} onChange={setStatsPeriod} />
                                </div>

                                {/* Stat cards (ringkasan sesuai periode) */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                                    {[
                                        { l: 'Total Modal', v: `$${statsSpentUSD.toFixed(4)}`, v2: fIDR(statsSpentUSD), c: 'var(--red)', iconBg: 'var(--red-l)', icon: <DollarSign size={20} /> },
                                        { l: 'Total Revenue', v: `Rp ${statsRevenueIDR.toLocaleString('id-ID')}`, v2: `Markup ${markup}x`, c: 'var(--blue)', iconBg: 'var(--blue-l)', icon: <TrendingUp size={20} /> },
                                        { l: 'Estimasi Profit', v: `Rp ${statsProfitIDR.toLocaleString('id-ID')}`, v2: `Margin ${Math.round((markup - 1) * 100)}%`, c: 'var(--green)', iconBg: 'var(--green-l)', icon: <Zap size={20} /> },
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
                                        margin={{ top: 20, right: 56, bottom: 40, left: 60 }}
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
                                            secondary
                                            fill="#10B981"
                                            stroke="#10B981"
                                            fillOpacity={0.2}
                                            strokeWidth={2}
                                        />
                                        <XAxis numTicks={6} />
                                        <YAxis numTicks={5} formatValue={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : Math.round(v).toLocaleString('id-ID')} />
                                        <YAxis secondary numTicks={5} formatValue={(v) => `${Math.round(v)}`} />
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
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
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

                            {/* Markup per Kategori & per Service */}
                            <div className="card" style={{ padding: 26, marginTop: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Markup per Kategori / Service</div>
                                    <button className="btn btn-blue" onClick={saveMarkupRules} disabled={savingRules} style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, opacity: savingRules ? 0.6 : 1 }}>
                                        <Save size={14} /> {savingRules ? 'Menyimpan...' : 'Simpan Rules'}
                                    </button>
                                </div>
                                <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 18 }}>Kosongkan untuk pakai markup global ({markup}x). Prioritas: override service → kategori → global.</p>

                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>Per Kategori</div>
                                {cats.filter(c => c !== 'All').length === 0 ? (
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 16 }}>Belum ada kategori (services belum termuat).</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 22 }}>
                                        {cats.filter(c => c !== 'All').map(c => (
                                            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}>
                                                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c}>{c}</div>
                                                <input className="inp" type="number" step="0.1" min="1" placeholder={`${markup}x`} value={rulesDraft.categories[c] ?? ''} onChange={e => {
                                                    const v = e.target.value;
                                                    setRulesDraft(d => { const categories = { ...d.categories }; if (v === '') delete categories[c]; else categories[c] = parseFloat(v); return { ...d, categories }; });
                                                }} style={{ width: 80, height: 34, padding: '0 8px', textAlign: 'center', fontWeight: 700 }} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text2)', marginBottom: 10 }}>Override per Service</div>
                                <div style={{ position: 'relative', marginBottom: 12 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 36 }} placeholder="Cari service untuk override (nama / ID)..." value={svcOverrideSearch} onChange={e => setSvcOverrideSearch(e.target.value)} />
                                </div>
                                {svcOverrideSearch.trim() && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, maxHeight: 180, overflowY: 'auto', marginBottom: 14 }}>
                                        {services.filter(s => {
                                            const q = svcOverrideSearch.toLowerCase();
                                            return (s.name?.toLowerCase().includes(q) || String(s.service).includes(svcOverrideSearch)) && rulesDraft.services[String(s.service)] == null;
                                        }).slice(0, 20).map(s => (
                                            <button key={s.service} onClick={() => { setRulesDraft(d => ({ ...d, services: { ...d.services, [String(s.service)]: resolveMarkup(s) } })); setSvcOverrideSearch(''); }}
                                                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text3)' }}>{s.service}</span>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                                <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>+ override</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {Object.keys(rulesDraft.services).length === 0 ? (
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Belum ada override per-service.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {Object.entries(rulesDraft.services).map(([sid, mult]) => {
                                            const svc = services.find(s => String(s.service) === sid);
                                            return (
                                                <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px' }}>
                                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text3)' }}>{sid}</span>
                                                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc?.name || '(service tidak ada di daftar)'}</span>
                                                    <input className="inp" type="number" step="0.1" min="1" value={mult} onChange={e => {
                                                        const v = parseFloat(e.target.value);
                                                        setRulesDraft(d => ({ ...d, services: { ...d.services, [sid]: isNaN(v) ? 1 : v } }));
                                                    }} style={{ width: 80, height: 34, padding: '0 8px', textAlign: 'center', fontWeight: 700 }} />
                                                    <button onClick={() => setRulesDraft(d => { const s2 = { ...d.services }; delete s2[sid]; return { ...d, services: s2 }; })}
                                                        style={{ background: 'var(--red-l)', border: 'none', borderRadius: 8, padding: '7px', cursor: 'pointer', color: 'var(--red)', display: 'flex' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
                                {/* Edit Kurs */}
                                <div className="card" style={{ padding: 22 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>Kurs USD/IDR</div>
                                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Saat ini: Rp {rate.toLocaleString('id-ID')}. Ubah jika ingin override kurs manual.</p>
                                    <input className="inp" inputMode="numeric" placeholder={`Rp ${rate.toLocaleString('id-ID')}`} value={rateInput} onChange={e => setRateInput(e.target.value)} style={{ marginBottom: 12 }} />
                                    <button className="btn btn-blue" onClick={saveRate} disabled={savingRate} style={{ width: '100%', padding: 11, borderRadius: 10, opacity: savingRate ? 0.6 : 1 }}>
                                        <Save size={15} /> {savingRate ? 'Menyimpan...' : 'Simpan Kurs'}
                                    </button>
                                </div>
                                {/* Ganti Password */}
                                <div className="card" style={{ padding: 22 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Ganti Password Admin</div>
                                    <input className="inp" type="password" placeholder="Password saat ini" autoComplete="current-password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} style={{ marginBottom: 10 }} />
                                    <input className="inp" type="password" placeholder="Password baru (min. 6 karakter)" autoComplete="new-password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} style={{ marginBottom: 10 }} />
                                    <input className="inp" type="password" placeholder="Konfirmasi password baru" autoComplete="new-password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} style={{ marginBottom: 12 }} />
                                    <button className="btn btn-blue" onClick={changePassword} disabled={savingPw} style={{ width: '100%', padding: 11, borderRadius: 10, opacity: savingPw ? 0.6 : 1 }}>
                                        <Save size={15} /> {savingPw ? 'Menyimpan...' : 'Ubah Password'}
                                    </button>
                                </div>
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

            {/* Toast notifications */}
            {toasts.length > 0 && (
                <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'calc(100% - 32px)' }}>
                    {toasts.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.15)', fontSize: 13, fontWeight: 600, background: t.type === 'error' ? 'var(--red-l)' : t.type === 'success' ? 'var(--green-l)' : 'var(--white)', color: t.type === 'error' ? 'var(--red)' : t.type === 'success' ? 'var(--green)' : 'var(--text)', border: '1px solid var(--border)' }}>
                            {t.type === 'success' ? <CheckCircle size={15} style={{ flexShrink: 0 }} /> : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
                            <span>{t.msg}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm modal */}
            {confirmState && (
                <div onClick={() => resolveConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320, padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} className="card" style={{ padding: 24, width: 380, maxWidth: '100%' }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', marginBottom: 18, lineHeight: 1.5 }}>{confirmState.msg}</div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => resolveConfirm(false)} className="btn btn-outline" style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13 }}>Batal</button>
                            <button onClick={() => resolveConfirm(true)} className="btn" style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, background: 'var(--red)', color: '#fff', border: 'none' }}>Ya, lanjutkan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}