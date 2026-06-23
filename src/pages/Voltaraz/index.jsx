import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
    Target, LogOut, Moon, Sun, BarChart2, Settings,
    Users, DollarSign, ChevronRight, Menu, ChevronLeft,
    Layers, AlertCircle, CheckCircle, X, Search,
    ShoppingCart, TrendingUp, Zap, ArrowUpRight,
    Percent, Save, Trash2, MessageSquare, Megaphone,
    RefreshCw, Eye, Ban, RotateCw, ChevronDown, Check, Download, FileText, Power, PowerOff
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useApi } from '@/context/ApiContext';
import { AreaChart, Area, Grid, XAxis, YAxis, ChartTooltip } from '@/components/ui/area-chart';
import AdminTickets from '@/components/admin/AdminTickets';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminDeposits from '@/components/admin/AdminDeposits';
import AdminAnnouncement from '@/components/admin/AdminAnnouncement';
import { serviceCode, PROVIDER_ALIAS } from '@/lib/platforms';

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

// Skeleton tabel — tampil saat data sedang dimuat (refresh).
// rows/cols bisa diatur agar mirip layout tabel aslinya.
function TableSkeleton({ cols = 5, rows = 6, headers = null }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: 'var(--bg2)', textAlign: 'left' }}>
                            {Array.from({ length: cols }).map((_, i) => (
                                <th key={i} style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                                    {headers && headers[i] ? headers[i] : <span className="sk-line" style={{ width: 60, height: 11, display: 'inline-block' }} />}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, r) => (
                            <tr key={r} style={{ borderTop: '1px solid var(--border)' }}>
                                {Array.from({ length: cols }).map((_, c) => (
                                    <td key={c} style={{ padding: '13px 14px' }}>
                                        <span className="sk-line" style={{ width: c === 0 ? '50%' : `${60 + ((r + c) % 3) * 12}%`, height: 12, display: 'block' }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <style>{`
                .sk-line {
                    border-radius: 6px;
                    background: linear-gradient(90deg, var(--bg2) 25%, color-mix(in srgb, var(--bg2) 55%, var(--border)) 37%, var(--bg2) 63%);
                    background-size: 400% 100%;
                    animation: skShimmer 1.4s ease-in-out infinite;
                }
                @keyframes skShimmer {
                    0% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .sk-line { animation: skPulse 1.4s ease-in-out infinite; background: var(--bg2); }
                    @keyframes skPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
                }
            `}</style>
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
    const [providerBalances, setProviderBalances] = useState([]); // [{key,label,currency,balance,error}]
    const [rate, setRate] = useState(17687);
    const [services, setServices] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [serviceSearch, setServiceSearch] = useState('');
    const [serviceProviderFilter, setServiceProviderFilter] = useState('All'); // 'All' | 'smmsoc' | 'buzzer' | ...
    const [overviewError, setOverviewError] = useState('');

    const [markup, setMarkup] = useState(2.5);
    const [markupInput, setMarkupInput] = useState('2.5');
    const [markupLoaded, setMarkupLoaded] = useState(false); // false sampai nilai markup asli dari DB ke-load
    const [markupSaved, setMarkupSaved] = useState(false);
    const [users, setUsers] = useState([]);
    const [apiStatus, setApiStatus] = useState('unknown');
    const [dbOrders, setDbOrders] = useState([]); // orders dari Supabase (akurat, semua user)
    const [servicePage, setServicePage] = useState(0); // pagination services
    const [disabledServices, setDisabledServices] = useState([]); // service id yang dimatikan admin
    const [bulkBusy, setBulkBusy] = useState(false); // sedang proses on/off massal per provider
    const SERVICES_PER_PAGE = 100;

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

    // ── Audit Log ──
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');

    // ── Settings: edit kurs & ganti password (perlu endpoint backend) ──
    const [rateInput, setRateInput] = useState('');
    const [savingRate, setSavingRate] = useState(false);
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
    const [savingPw, setSavingPw] = useState(false);

    // ── Bonus deposit bertingkat (disimpan di settings 'deposit_bonus_tiers') ──
    const [bonusTiers, setBonusTiers] = useState([]);
    const [savingBonus, setSavingBonus] = useState(false);

    // ── Markup per-kategori / per-service ──
    const [markupRules, setMarkupRules] = useState({ categories: {}, services: {}, providers: {} });
    const [rulesDraft, setRulesDraft] = useState({ categories: {}, services: {}, providers: {} });
    const [savingRules, setSavingRules] = useState(false);
    const [svcOverrideSearch, setSvcOverrideSearch] = useState('');

    // Mapping periode (statsPeriod) → jumlah hari yang digambar di grafik.
    // 'Semua waktu' digambar 90 hari terakhir biar grafik tetap informatif.
    const PERIOD_TO_DAYS = { all: 90, today: 7, '7d': 7, '30d': 30 };

    const generateChartData = (period) => {
        const days = PERIOD_TO_DAYS[period] ?? 30;
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
                // Modal IDR: prioritaskan charge_idr (akurat historis), fallback charge × rate.
                const ci = parseFloat(o.charge_idr);
                const costIDR = (Number.isFinite(ci) && ci > 0)
                    ? Math.round(ci)
                    : (o.charge && parseFloat(o.charge) > 0
                        ? Math.round(parseFloat(o.charge) * fxForOrder(o))
                        : null);
                if (costIDR != null) return s + Math.round(costIDR * markup);
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

    const loadAuditLogs = async () => {
        setLoadingAudit(true);
        try {
            const res = await adminFetch('/api/admin-api?action=get_audit_logs');
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
        } catch {
            setAuditLogs([]);
        } finally {
            setLoadingAudit(false);
        }
    };

    useEffect(() => {
        // ✅ Cek auth di client-side saja — hindari hydration mismatch
        const isAuthed = sessionStorage.getItem('admin_authed') === 'true' &&
            !!sessionStorage.getItem('admin_token');
        setAuthed(isAuthed);
        setAuthChecked(true);
    }, []);

    // ✅ Load markup & rules SETIAP authed berubah jadi true (bukan cuma saat mount).
    // Fix: dulu effect ini pakai dep [] tapi baca isAuthed, jadi setelah login (tanpa reload)
    // markup tak pernah ke-load dan markupLoaded stuck false.
    useEffect(() => {
        if (!authed) return;
        adminFetch('/api/admin-api?action=get_markup')
            .then(r => r.json())
            .then(data => {
                if (data?.value) { setMarkup(parseFloat(data.value)); setMarkupInput(data.value); }
            })
            .catch(() => { })
            .finally(() => setMarkupLoaded(true));
        adminFetch('/api/admin-api?action=get_markup_rules')
            .then(r => r.json())
            .then(data => {
                if (data?.rules) { setMarkupRules(data.rules); setRulesDraft(data.rules); }
            })
            .catch(() => { });
    }, [authed]);

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
        setLoadingBalance(true);
        try {
            // Ambil saldo SEMUA provider terkonfigurasi sekaligus (endpoint admin-only).
            const res = await fetch('/api/smm?action=provider_balances', {
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` }
            });
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            const list = Array.isArray(data?.providers) ? data.providers : [];
            setProviderBalances(list);
            // Backward-compat + status badge: SMMSOC (USD) dipakai sebagai 'balance' utama.
            const smm = list.find(p => p.key === 'smmsoc');
            if (smm && smm.balance != null) setBalance(parseFloat(smm.balance));
            const anyOk = list.some(p => p.balance != null);
            if (list.length && anyOk) {
                setApiStatus('ok');
            } else {
                setApiStatus('error');
                const firstErr = list.find(p => p.error)?.error;
                setOverviewError(prev => firstErr || data?.error || prev || 'Gagal mengambil balance dari provider.');
            }
        } catch (e) {
            setOverviewError(e.message);
            setApiStatus('error');
        }
        setLoadingBalance(false);
    }, []);

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

    // Matikan / aktifkan SEMUA layanan satu provider sekaligus.
    // matikan: kirim daftar id provider (dari services yg sudah dimuat) ke server.
    // aktifkan: server cukup buang berdasarkan prefix, jadi service_ids boleh kosong.
    const bulkToggleProvider = async (providerKey, enabled) => {
        const lbl = providerKey === 'smmsoc' ? 'SMMSOC' : providerKey === 'buzzer' ? 'BuzzerPanel' : providerKey;
        const ok = await askConfirm(`${enabled ? 'AKTIFKAN' : 'MATIKAN'} SEMUA layanan ${lbl}? Ini langsung mempengaruhi yang tampil ke user.`);
        if (!ok) return;

        // Daftar service_ids milik provider ini
        const providerServiceIds = services
            .filter(s => (s._provider || 'smmsoc') === providerKey)
            .map(s => String(s.service));

        // Optimistic update: langsung cerminkan perubahan di UI sebelum tunggu server
        const prevDisabled = disabledServices;
        setDisabledServices(prev => {
            const prevSet = new Set(prev);
            if (enabled) {
                return prev.filter(id => !providerServiceIds.includes(id));
            } else {
                providerServiceIds.forEach(id => prevSet.add(id));
                return [...prevSet];
            }
        });

        setBulkBusy(true);
        try {
            const res = await adminFetch('/api/admin-api?action=bulk_toggle_provider', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerKey, enabled, service_ids: providerServiceIds }),
            });
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            if (data?.error) {
                // Rollback optimistic update kalau server gagal
                setDisabledServices(prevDisabled);
                showToast(`Gagal: ${data.error}`, 'error');
            } else {
                // Kalau server kembalikan state terbaru pakai itu, kalau tidak optimistic sudah cukup
                if (Array.isArray(data.disabled)) setDisabledServices(data.disabled.map(String));
                showToast(`${enabled ? 'Diaktifkan' : 'Dimatikan'}: semua layanan ${lbl}.`, 'success');
                // Sync ulang dari server untuk mastiin konsisten
                fetchDisabledServices();
            }
        } catch (e) {
            // Rollback optimistic update kalau koneksi gagal
            setDisabledServices(prevDisabled);
            showToast(`Error: ${e.message}`, 'error');
        }
        setBulkBusy(false);
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

            // Status live per provider — JANGAN campur provider dalam 1 request
            // (ID antar provider beda; server butuh tahu provider yang benar).
            // Key liveStatus pakai "provider:order_id" supaya ID yang kebetulan
            // sama antar provider tidak saling timpa.
            const byProvider = {};
            for (const t of txData) {
                if (t.order_id && /^\d+$/.test(String(t.order_id))) {
                    const p = t.provider || 'smmsoc';
                    (byProvider[p] ||= []).push(String(t.order_id));
                }
            }

            let liveStatus = {};
            for (const [prov, ids] of Object.entries(byProvider)) {
                for (let i = 0; i < ids.length; i += 100) {
                    const chunk = ids.slice(i, i + 100);
                    try {
                        const statusRes = await fetch(`/api/smm?action=status&orders=${chunk.join(',')}&provider=${prov}`, {
                            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token') || ''}` }
                        });
                        if (statusRes.status === 401) { logout(); return; }
                        const statusData = await statusRes.json();
                        if (!statusData.error) {
                            for (const [oid, st] of Object.entries(statusData)) liveStatus[`${prov}:${oid}`] = st;
                        }
                    } catch { /* fallback ke status Supabase */ }
                }
            }

            setOrders(txData.map(t => {
                const live = t.order_id ? liveStatus[`${t.provider || 'smmsoc'}:${t.order_id}`] : null;
                return {
                    id: t.order_id || t.id,
                    provider: t.provider || 'smmsoc',
                    status: live?.status || t.status || 'Pending',
                    charge: t.charge || (t.amount ? t.amount / ((t._rate || 17687) * (t._markup || 1)) : 0),
                    // Modal provider yang SUDAH dinormalisasi ke IDR saat order dibuat (dari smm.js).
                    // Ini sumber kebenaran modal historis — tak terpengaruh perubahan rate USD.
                    charge_idr: t.charge_idr ?? null,
                    amount_idr: t.amount || 0,
                    start_count: live?.start_count || t.start_count,
                    remains: live?.remains || t.remains,
                    created_at: t.created_at,
                    email: t.email,
                    service: t.service_id || t.description,
                    description: t.description,
                    link: t.link,
                    qty: t.qty,
                    is_refunded: t.is_refunded ?? false,
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
    const refreshOrderStatus = async (orderId, provider) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        setRefreshingOrder(orderId);
        try {
            const res = await smmFetch(`action=status&orders=${orderId}${provider ? `&provider=${provider}` : ''}`);
            const data = await res.json();
            // Coba key "provider:orderId" dulu (format konsisten dengan fetchOrders),
            // fallback ke orderId langsung untuk kompatibilitas response API lama.
            const prov = provider || 'smmsoc';
            const live = data && !data.error
                ? (data[`${prov}:${orderId}`] ?? data[orderId] ?? null)
                : null;
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
    const cancelOrder = async (orderId, provider) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        const ok = await askConfirm(`Minta pembatalan order #${orderId} ke provider? Sebagian provider hanya mengizinkan cancel saat status belum diproses.`);
        if (!ok) return;
        setActioningOrder(orderId);
        try {
            const res = await smmFetch(`action=cancel&orders=${orderId}${provider ? `&provider=${provider}` : ''}`);
            const data = await res.json();
            if (data?.error) showToast(`Gagal cancel: ${data.error}`, 'error');
            else { showToast('Permintaan cancel terkirim.', 'success'); refreshOrderStatus(orderId, provider); }
        } catch (e) {
            if (e.message !== 'SESSION_EXPIRED') showToast(`Error: ${e.message}`, 'error');
        }
        setActioningOrder(null);
    };

    // Minta refill/garansi (butuh /api/smm meneruskan action=refill)
    const refillOrder = async (orderId, provider) => {
        if (!orderId || !/^\d+$/.test(String(orderId))) return;
        const ok = await askConfirm(`Minta refill (garansi) untuk order #${orderId}?`);
        if (!ok) return;
        setActioningOrder(orderId);
        try {
            const res = await smmFetch(`action=refill&order=${orderId}${provider ? `&provider=${provider}` : ''}`);
            const data = await res.json();
            if (data?.error) showToast(`Gagal refill: ${data.error}`, 'error');
            else showToast('Permintaan refill terkirim.', 'success');
        } catch (e) {
            if (e.message !== 'SESSION_EXPIRED') showToast(`Error: ${e.message}`, 'error');
        }
        setActioningOrder(null);
    };

    // Refund saldo user untuk order yang dibatalkan / sebagian gagal (MANUAL oleh admin)
    const refundOrder = async (order) => {
        const orderId = order?.id;
        if (!orderId || !/^\d+$/.test(String(orderId))) return;

        const st = (order.status || '').toLowerCase();
        const paid = Math.round(order.amount_idr || 0);
        const qty = parseInt(order.qty) || 0;
        const remains = parseInt(order.remains) || 0;

        // Tentukan mode + estimasi nominal untuk ditampilkan di konfirmasi
        let mode = 'full';
        let estimasi = paid;
        if (st === 'partial' && qty > 0 && remains > 0) {
            mode = 'partial';
            estimasi = Math.round(paid * (remains / qty));
        }

        if (estimasi <= 0) { showToast('Nominal refund tidak valid (data order kurang lengkap).', 'error'); return; }

        const rincian = mode === 'partial'
            ? `Order #${orderId} sebagian gagal (${remains}/${qty}).\nRefund proporsional: Rp ${estimasi.toLocaleString('id-ID')} ke ${order.email}.`
            : `Order #${orderId} dibatalkan.\nRefund penuh: Rp ${estimasi.toLocaleString('id-ID')} ke ${order.email}.`;
        const ok = await askConfirm(`${rincian}\n\nLanjutkan refund? Saldo akan langsung bertambah ke user.`);
        if (!ok) return;

        setActioningOrder(orderId);
        try {
            const res = await adminFetch('/api/admin-api?action=refund_order', {
                method: 'POST',
                body: JSON.stringify({ order_id: String(orderId), mode, qty, remains }),
            });
            if (res.status === 401) { logout(); return; }
            const data = await res.json();
            if (data?.error) showToast(`Gagal refund: ${data.error}`, 'error');
            else {
                showToast(`Refund Rp ${Number(data.refunded || estimasi).toLocaleString('id-ID')} berhasil ke ${data.email || order.email}.`, 'success');
                // Update state lokal langsung agar tombol $ hilang seketika tanpa nunggu fetchOrders
                setOrders(prev => prev.map(o =>
                    String(o.id) === String(orderId) ? { ...o, is_refunded: true } : o
                ));
                fetchOrders();
                loadUsers();
            }
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
            loadBonusTiers();
        };
        doRefresh();
        const interval = setInterval(doRefresh, 300 * 1000);
        return () => clearInterval(interval);
    }, [authed, fetchBalance, fetchServices, fetchOrders]);

    // saldo update dipanggil dari AdminUsers child component — reload users setelah update
    const onSaldoUpdated = () => { loadUsers(); };

    // Load audit logs saat menu Audit Log dibuka
    useEffect(() => {
        if (authed && menu === 'Audit Log') loadAuditLogs();
    }, [authed, menu]);

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
        if (isNaN(val) || val < 1) { showToast('Markup tidak valid (minimal 1).', 'error'); return; }
        const prev = markup; // simpan nilai lama untuk rollback kalau gagal
        setMarkup(val);
        try {
            // ✅ Simpan via server-side API — bukan direct Supabase
            const res = await adminFetch('/api/admin-api?action=save_markup', {
                method: 'POST',
                body: JSON.stringify({ value: val }),
            });
            if (res.status === 401) { logout(); return; }

            let ok = res.ok;
            // ✅ Verifikasi body: pastikan server benar-benar menyimpan, bukan sekadar status 200
            try {
                const d = await res.json();
                if (d && (d.error || d.success === false)) ok = false;
            } catch { /* body kosong tapi res.ok → anggap sukses */ }

            if (!ok) {
                // ❌ Gagal simpan: kembalikan nilai lama agar UI tidak menyesatkan
                setMarkup(prev);
                setMarkupInput(String(prev));
                showToast('Gagal menyimpan markup. Coba lagi.', 'error');
                return;
            }

            setMarkupSaved(true);
            setTimeout(() => setMarkupSaved(false), 2000);
        } catch (e) {
            setMarkup(prev);
            setMarkupInput(String(prev));
            showToast('Gagal menyimpan markup (koneksi/server).', 'error');
        }
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

    // ── Bonus deposit: load dari settings, simpan via admin-api ──
    // Default tier kalau belum ada konfigurasi.
    const DEFAULT_BONUS_TIERS = [
        { min: 50000, percent: 2 },
        { min: 100000, percent: 3 },
        { min: 250000, percent: 5 },
        { min: 500000, percent: 7 },
        { min: 1000000, percent: 10 },
    ];

    const loadBonusTiers = useCallback(async () => {
        try {
            const res = await adminFetch('/api/admin-api?action=get_bonus_tiers');
            if (res.ok) {
                const d = await res.json().catch(() => ({}));
                const val = d.value ?? d.tiers ?? d;
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                if (Array.isArray(parsed) && parsed.length > 0) { setBonusTiers(parsed); return; }
            }
            setBonusTiers(DEFAULT_BONUS_TIERS);
        } catch { setBonusTiers(DEFAULT_BONUS_TIERS); }
    }, []);

    const updateTier = (i, field, val) => {
        setBonusTiers(prev => prev.map((t, idx) => idx === i
            ? { ...t, [field]: parseInt(String(val).replace(/[^\d]/g, ''), 10) || 0 }
            : t));
    };
    const addTier = () => setBonusTiers(prev => [...prev, { min: 0, percent: 0 }]);
    const removeTier = (i) => setBonusTiers(prev => prev.filter((_, idx) => idx !== i));

    // Simpan tier. Butuh endpoint: POST /api/admin-api?action=save_bonus_tiers { value: [...] }
    const saveBonusTiers = async () => {
        // Validasi: min & percent harus angka >= 0, buang baris kosong, urutkan
        const clean = bonusTiers
            .filter(t => t.min != null && t.percent != null)
            .map(t => ({ min: Number(t.min), percent: Number(t.percent) }))
            .filter(t => t.min >= 0 && t.percent >= 0 && t.percent <= 100)
            .sort((a, b) => a.min - b.min);
        setSavingBonus(true);
        try {
            const res = await adminFetch('/api/admin-api?action=save_bonus_tiers', { method: 'POST', body: JSON.stringify({ value: clean }) });
            if (res.status === 401) { logout(); return; }
            const d = await res.json().catch(() => ({}));
            if (res.ok && !d.error) { setBonusTiers(clean); showToast('Tier bonus disimpan.', 'success'); }
            else showToast(d.error || 'Endpoint save_bonus_tiers belum tersedia di backend.', 'error');
        } catch (e) { showToast(`Error: ${e.message}`, 'error'); }
        setSavingBonus(false);
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

    // Kartu saldo PER PROVIDER (currency-aware): SMMSOC=USD ($, + perkiraan IDR),
    // BuzzerPanel=IDR (Rp). Provider lain yang terkonfigurasi otomatis ikut tampil.
    const providerBalanceCards = (providerBalances.length
        ? providerBalances
        : [{ key: 'smmsoc', label: 'SMMSOC', currency: 'USD', balance: null, error: null }]
    ).map(pb => {
        const isIDR = String(pb.currency || 'USD').toUpperCase() === 'IDR';
        const hasVal = pb.balance != null && !pb.error;
        const value = loadingBalance ? '...'
            : hasVal ? (isIDR ? `Rp ${Math.round(Number(pb.balance)).toLocaleString('id-ID')}` : `$${Number(pb.balance).toFixed(2)}`)
                : '—';
        const sub = loadingBalance ? 'Memuat...'
            : hasVal ? (isIDR ? pb.label : `≈ ${fIDR(pb.balance)}`)
                : (pb.error || 'Gagal memuat');
        return {
            label: `Saldo ${pb.label}`, value, sub,
            icon: <DollarSign size={20} />, iconBg: 'var(--blue-l)', iconColor: 'var(--blue)',
            badge: loadingBalance ? '...' : hasVal ? 'Live' : 'Error',
        };
    });

    // Resolusi markup efektif: service → kategori → provider → global
    const resolveMarkup = (svc) => {
        if (!svc) return markup;
        const sid = String(svc.service);
        if (markupRules.services && markupRules.services[sid] != null) return markupRules.services[sid];
        if (svc.category && markupRules.categories && markupRules.categories[svc.category] != null) return markupRules.categories[svc.category];
        const prov = svc._provider || String(svc.service).split(':')[0];
        if (prov && markupRules.providers && markupRules.providers[prov] != null) return markupRules.providers[prov];
        return markup;
    };

    // ⚡ Faktor konversi harga ke IDR.
    //   Service: kalau currency-nya IDR (BuzzerPanel) → faktor 1; selain itu (USD) → kurs.
    const fxFor = (svc) => String(svc?.currency || 'USD').toUpperCase() === 'IDR' ? 1 : rate;

    // Map provider → currency dari data yang dimuat server (provider_balances).
    // Future-proof: provider IDR baru otomatis dikenali tanpa ubah kode. Fallback ke
    // konstanta untuk provider yang sudah dikenal bila daftar balance belum dimuat.
    const KNOWN_PROVIDER_CURRENCY = { smmsoc: 'USD', buzzer: 'IDR' };
    const providerCurrency = (providerKey) => {
        const k = String(providerKey || 'smmsoc').toLowerCase();
        const fromList = providerBalances.find(p => String(p.key).toLowerCase() === k)?.currency;
        const cur = fromList || KNOWN_PROVIDER_CURRENCY[k] || 'USD';
        return String(cur).toUpperCase();
    };
    //   Order: tentukan faktor dari CURRENCY provider order (bukan nama). Order ber-currency
    //   IDR → faktor 1; USD → kurs. Order lama tanpa provider dianggap smmsoc (USD).
    const fxForOrder = (o) => providerCurrency(o?.provider) === 'IDR' ? 1 : rate;

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
        // BOM agar Excel membaca UTF-8 dengan benar (Rp, karakter Indonesia)
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

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

    // Charge campur satuan (USD untuk smmsoc, IDR untuk buzzer) → konversi PER ORDER
    // ke IDR dulu, baru dijumlah. Menjumlah charge mentah lalu × rate akan salah.
    //
    // Prioritas modal:
    //   1. charge_idr — modal sudah dinormalisasi ke IDR SAAT order dibuat (akurat
    //      historis; tak bergeser saat rate USD berubah). Ini yang benar.
    //   2. Fallback charge × fxForOrder(rate sekarang) — hanya untuk order lama yang
    //      belum punya charge_idr (dibuat sebelum kolom itu ada).
    const orderCostIDR = (o) => {
        const ci = parseFloat(o.charge_idr);
        if (Number.isFinite(ci) && ci > 0) return Math.round(ci);
        return Math.round(parseFloat(o.charge || 0) * fxForOrder(o));
    };
    const totalCostIDR = orders.reduce((s, o) => s + orderCostIDR(o), 0);
    const totalRevenueIDR = Math.round(totalCostIDR * markup);
    const profitIDR = totalRevenueIDR - totalCostIDR;

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
    const statsCostIDR = statsOrders.reduce((s, o) => s + orderCostIDR(o), 0);
    const statsRevenueIDR = Math.round(statsCostIDR * markup);
    const statsProfitIDR = statsRevenueIDR - statsCostIDR;
    // Catatan: modal kini ditampilkan dalam IDR (charge campur USD/IDR antar provider,
    // jadi total dalam USD tidak lagi bermakna). statsCostIDR sudah benar per-order.

    // Stats "hari ini"
    const ordersToday = orders.filter(o => inPeriod(o.created_at, 'today'));
    const revenueTodayIDR = ordersToday.reduce((s, o) => s + (o.amount_idr || Math.round(orderCostIDR(o) * markup)), 0);
    const newUsersToday = users.filter(u => inPeriod(u.createdAt, 'today')).length;

    // Set untuk lookup O(1) (jauh lebih cepat dari array .includes saat disabled banyak)
    const disabledSet = useMemo(() => new Set(disabledServices.map(String)), [disabledServices]);

    const cats = useMemo(() => ['All', ...new Set(services.map(s => s.category))].filter(Boolean), [services]);

    // Daftar provider yang ADA di data (untuk tombol tab). Urut sesuai huruf alias (A,B,...).
    const serviceProviders = useMemo(() => {
        const set = new Set(services.map(s => s._provider || 'smmsoc'));
        return [...set].sort((a, b) =>
            (PROVIDER_ALIAS[a] || 'Z').localeCompare(PROVIDER_ALIAS[b] || 'Z'));
    }, [services]);

    const filteredSvc = useMemo(() => {
        const q = serviceSearch.toLowerCase();
        const out = services.filter(s => {
            const prov = s._provider || 'smmsoc';
            const matchProvider = serviceProviderFilter === 'All' || prov === serviceProviderFilter;
            const matchQ = !q || s.name?.toLowerCase().includes(q) || String(s.service).toLowerCase().includes(q) || String(s._rawId ?? '').toLowerCase().includes(q) || serviceCode(s).toLowerCase().includes(q);
            return matchProvider && matchQ;
        });
        // Urut: provider dulu (A=smmsoc, lalu B=buzzer, dst sesuai huruf alias),
        // di dalam provider urut by _rawId numerik biar rapi.
        return out.sort((a, b) => {
            const pa = PROVIDER_ALIAS[a._provider || 'smmsoc'] || 'Z';
            const pb = PROVIDER_ALIAS[b._provider || 'smmsoc'] || 'Z';
            if (pa !== pb) return pa.localeCompare(pb);
            const na = parseInt(a._rawId, 10), nb = parseInt(b._rawId, 10);
            if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
            return String(a._rawId ?? a.service).localeCompare(String(b._rawId ?? b.service));
        });
    }, [services, serviceProviderFilter, serviceSearch]);

    // Clamp service page agar tak pernah out-of-bound (mis. data berubah saat di page tinggi).
    const servicePageCount = Math.max(1, Math.ceil(filteredSvc.length / SERVICES_PER_PAGE));
    const safeServicePage = Math.min(servicePage, servicePageCount - 1);

    // Statistik per provider untuk tombol on/off massal — dihitung sekali, bukan
    // tiap render. off-count pakai disabledSet (O(1)).
    const providerStats = useMemo(() => {
        const m = {};
        for (const s of services) {
            const p = s._provider || 'smmsoc';
            if (!m[p]) m[p] = { total: 0, off: 0 };
            m[p].total++;
            if (disabledSet.has(String(s.service))) m[p].off++;
        }
        return Object.entries(m).map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key));
    }, [services, disabledSet]);

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
    const canCancel = (st) => { const s = (st || '').toLowerCase(); if (['canceled', 'cancelled', 'completed', 'success'].includes(s)) return false; return ['pending', 'in progress', 'processing'].includes(s); };
    const canRefill = (st) => { const s = (st || '').toLowerCase(); if (['canceled', 'cancelled'].includes(s)) return false; return ['completed', 'success', 'partial'].includes(s); };
    // Refund saldo hanya relevan untuk order yang dibatalkan / sebagian gagal
    const canRefund = (st) => { const s = (st || '').toLowerCase(); return ['canceled', 'cancelled', 'partial'].includes(s); };

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
        { id: 'Audit Log', icon: <FileText size={16} />, color: '#64748B' },
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

    // ── LOADING (tahan render sampai markup asli dari DB siap, supaya tidak ada flash nilai default 2.5) ──
    if (!markupLoaded) {
        return (
            <div className={`root${dark ? ' dark' : ''}`} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
                {/* Skeleton sidebar */}
                <div style={{ width: 248, borderRight: '1px solid var(--border)', background: 'var(--card-bg, var(--bg))', padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                        <span className="sk-line" style={{ width: 34, height: 34, borderRadius: 9 }} />
                        <span className="sk-line" style={{ width: 120, height: 16 }} />
                    </div>
                    <span className="sk-line" style={{ width: '100%', height: 64, borderRadius: 12, marginBottom: 10 }} />
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
                            <span className="sk-line" style={{ width: 18, height: 18, borderRadius: 5 }} />
                            <span className="sk-line" style={{ width: `${50 + (i % 4) * 14}%`, height: 13 }} />
                        </div>
                    ))}
                </div>

                {/* Skeleton konten */}
                <div style={{ flex: 1, padding: '26px 30px' }}>
                    <span className="sk-line" style={{ width: 160, height: 24, marginBottom: 8, display: 'block' }} />
                    <span className="sk-line" style={{ width: 240, height: 13, marginBottom: 26, display: 'block' }} />

                    {/* Stat cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
                                <span className="sk-line" style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 14, display: 'block' }} />
                                <span className="sk-line" style={{ width: '70%', height: 22, marginBottom: 8, display: 'block' }} />
                                <span className="sk-line" style={{ width: '45%', height: 12, display: 'block' }} />
                            </div>
                        ))}
                    </div>

                    {/* Panel besar */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
                        <span className="sk-line" style={{ width: 180, height: 16, marginBottom: 18, display: 'block' }} />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                                <span className="sk-line" style={{ width: `${30 + (i % 3) * 12}%`, height: 13 }} />
                                <span className="sk-line" style={{ width: 80, height: 13 }} />
                            </div>
                        ))}
                    </div>
                </div>

                <style>{`
                    .sk-line {
                        border-radius: 6px;
                        background: linear-gradient(90deg, var(--bg2) 25%, color-mix(in srgb, var(--bg2) 55%, var(--border)) 37%, var(--bg2) 63%);
                        background-size: 400% 100%;
                        animation: skShimmer 1.4s ease-in-out infinite;
                        display: inline-block;
                    }
                    @keyframes skShimmer {
                        0% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .sk-line { animation: skPulse 1.4s ease-in-out infinite; background: var(--bg2); }
                        @keyframes skPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
                    }
                `}</style>
            </div>
        );
    }

    // ── MAIN ──
    return (
        <div className={`root admin-shell${dark ? ' dark' : ''}`} style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .adm-kpi-card { transition: transform .18s ease, box-shadow .18s ease; }
                .adm-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,.12); }
                .adm-hero-card { isolation: isolate; }
                .adm-bento-pattern {
                    position: absolute; inset: 0; pointer-events: none; opacity: .5;
                    background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.16) 1px, transparent 0);
                    background-size: 15px 15px;
                    -webkit-mask-image: linear-gradient(135deg, #000 0%, transparent 70%);
                    mask-image: linear-gradient(135deg, #000 0%, transparent 70%);
                }
                .adm-bento-glow {
                    position: absolute; top: -55px; right: -45px; width: 200px; height: 200px;
                    border-radius: 50%; pointer-events: none; filter: blur(8px);
                    background: radial-gradient(circle, rgba(255,255,255,.2) 0%, transparent 70%);
                }
                @media (max-width: 920px) {
                    .adm-bento-top { grid-template-columns: 1fr 1fr !important; }
                    .adm-bento-top > .adm-hero-card { grid-column: 1 / -1 !important; }
                }
                @media (max-width: 560px) {
                    .adm-bento-top { grid-template-columns: 1fr !important; }
                    .adm-bento-top > .adm-hero-card { grid-column: auto !important; }
                }
            `}</style>

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
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>{apiUrl ? new URL(apiUrl).hostname : 'Multi-provider'}</span>
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
                                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Data real-time dari API provider.</p>
                            </div>

                            {/* ✅ Error banner */}
                            {overviewError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
                                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                    {overviewError}
                                    <button onClick={() => setOverviewError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={14} /></button>
                                </div>
                            )}
                            {/* ── BENTO: hero revenue + quick stats ── */}
                            <div className="adm-bento-top" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                                {/* Hero — Revenue hari ini */}
                                <div className="adm-hero-card" style={{ position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '22px 24px', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 55%, #1E3A8A 100%)', color: '#fff', boxShadow: '0 12px 32px rgba(37,99,235,.3), inset 0 1px 0 rgba(255,255,255,.16)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 150 }}>
                                    <div className="adm-bento-pattern" />
                                    <div className="adm-bento-glow" />
                                    <div style={{ position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(255,255,255,.8)' }}>REVENUE HARI INI</span>
                                            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={18} /></div>
                                        </div>
                                        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', textShadow: '0 2px 8px rgba(0,0,0,.18)', lineHeight: 1.1 }}>Rp {revenueTodayIDR.toLocaleString('id-ID')}</div>
                                    </div>
                                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 18, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.18)' }}>
                                        <div>
                                            <div style={{ fontSize: 19, fontWeight: 800 }}>{ordersToday.length}</div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Order hari ini</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 19, fontWeight: 800 }}>{users.length}</div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Total user</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2 KPI ringkas */}
                                {[
                                    { label: 'Total Orders', value: orders.length, sub: `${orders.filter(o => o.status?.toLowerCase() === 'completed').length} completed · ${orders.filter(o => o.status?.toLowerCase() === 'processing').length} aktif`, icon: <ShoppingCart size={19} />, iconBg: 'var(--yellow-l)', iconColor: 'var(--yellow)' },
                                    { label: 'Markup Aktif', value: `${markup}x`, sub: `+${Math.round((markup - 1) * 100)}% keuntungan`, icon: <Percent size={19} />, iconBg: 'rgba(233,30,99,.1)', iconColor: '#E91E63' },
                                ].map(s => (
                                    <div key={s.label} className="card adm-kpi-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 150, borderRadius: 16 }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, color: s.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                                        <div>
                                            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 2 }}>{s.value}</div>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 2 }}>{s.label}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.sub}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── BENTO: saldo provider + total services ── */}
                            <div className="adm-bento-mid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                                {[
                                    ...providerBalanceCards,
                                    { label: 'Total Services', value: services.length || '...', sub: `${[...new Set(services.map(s => s.category))].length} kategori`, icon: <Layers size={20} />, iconBg: 'var(--green-l)', iconColor: 'var(--green)', badge: `${services.length} layanan` },
                                ].map((s) => (
                                    <div key={s.label} className="card adm-kpi-card" style={{ padding: 18, borderRadius: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.iconColor, flexShrink: 0 }}>{s.icon}</div>
                                            <div style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: s.badge === 'Error' ? 'var(--red)' : 'var(--blue)', background: s.badge === 'Error' ? 'var(--red-l)' : 'var(--blue-l)', padding: '3px 9px', borderRadius: 20 }}>{s.badge}</div>
                                        </div>
                                        <div style={{ fontSize: 23, fontWeight: 800, color: 'var(--text)', marginBottom: 2, letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 1 }}>{s.label}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{s.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Revenue Summary */}
                            <div className="card" style={{ padding: 22, marginBottom: 14, borderRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Revenue Summary · {statsOrders.length} order</div>
                                    <Dropdown width={170} value={statsPeriod} options={PERIOD_OPTIONS} onChange={setStatsPeriod} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                                    {[
                                        { l: 'Modal (Harga Provider)', v: `Rp ${statsCostIDR.toLocaleString('id-ID')}`, v2: `${statsOrders.length} order`, c: 'var(--red)' },
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                                <div className="card" style={{ padding: 20, borderRadius: 16 }}>
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
                                <div className="card" style={{ padding: 20, borderRadius: 16 }}>
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
                                            provider: o.provider || 'smmsoc',
                                            start_count: o.start_count || '',
                                            remains: o.remains || '',
                                            charge: parseFloat(o.charge || 0).toFixed(4),
                                            harga_user_idr: o.amount_idr || Math.round(orderCostIDR(o) * markup),
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
                            {loadingOrders ? (
                                <TableSkeleton cols={7} rows={6} headers={['Order ID', 'Email', 'Layanan', 'Status', 'Harga User (IDR)', 'Tanggal', 'Aksi']} />
                            ) : orders.length === 0 ? (
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
                                                    const busy = String(actioningOrder) === String(o.id);
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
                                                                    // Normalize status: API provider bisa kirim berbagai format
                                                                    // mis. 'success', 'completed', 'Completed', 'in progress', dll.
                                                                    const sRaw = o.status || '';
                                                                    const sLow = sRaw.toLowerCase().trim();
                                                                    const STATUS_MAP = {
                                                                        completed: { label: 'Selesai', color: '#059669', bg: '#d1fae5' },
                                                                        success: { label: 'Selesai', color: '#059669', bg: '#d1fae5' },
                                                                        'in progress': { label: 'Berjalan', color: 'var(--blue)', bg: 'var(--blue-l)' },
                                                                        inprogress: { label: 'Berjalan', color: 'var(--blue)', bg: 'var(--blue-l)' },
                                                                        processing: { label: 'Diproses', color: 'var(--blue)', bg: 'var(--blue-l)' },
                                                                        partial: { label: 'Sebagian', color: '#d97706', bg: '#fef3c7' },
                                                                        pending: { label: 'Menunggu', color: '#d97706', bg: '#fef3c7' },
                                                                        canceled: { label: 'Dibatalkan', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                        cancelled: { label: 'Dibatalkan', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                        refunded: { label: 'Direfund', color: '#7c3aed', bg: '#ede9fe' },
                                                                        error: { label: 'Error', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                        fail: { label: 'Gagal', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                        failed: { label: 'Gagal', color: 'var(--red)', bg: 'var(--red-l)' },
                                                                    };
                                                                    const cfg = STATUS_MAP[sLow] || { label: sRaw || 'Pending', color: 'var(--text3)', bg: 'var(--bg2)' };
                                                                    return <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{cfg.label}</span>;
                                                                })()}
                                                            </td>
                                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>
                                                                {o.amount_idr ? `Rp ${o.amount_idr.toLocaleString('id-ID')}` : `Rp ${Math.round(orderCostIDR(o) * markup).toLocaleString('id-ID')}`}
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
                                                                        <button title="Refresh status" disabled={String(refreshingOrder) === String(o.id) || busy} onClick={() => refreshOrderStatus(o.id, o.provider)} style={iconBtn('var(--white)', 'var(--blue)')}>
                                                                            <RefreshCw size={14} style={{ animation: String(refreshingOrder) === String(o.id) ? 'spin 1s linear infinite' : 'none' }} />
                                                                        </button>
                                                                    )}
                                                                    {isNumeric && canCancel(o.status) && (
                                                                        <button title="Minta cancel" disabled={busy} onClick={() => cancelOrder(o.id, o.provider)} style={iconBtn('var(--red-l)', 'var(--red)')}>
                                                                            <Ban size={14} />
                                                                        </button>
                                                                    )}
                                                                    {isNumeric && canRefill(o.status) && (
                                                                        <button title="Minta refill" disabled={busy} onClick={() => refillOrder(o.id, o.provider)} style={iconBtn('var(--green-l)', 'var(--green)')}>
                                                                            <RotateCw size={14} />
                                                                        </button>
                                                                    )}
                                                                    {isNumeric && canRefund(o.status) && !o.is_refunded && (
                                                                        <button title="Refund saldo ke user" disabled={busy} onClick={() => refundOrder(o)} style={iconBtn('var(--blue-l)', 'var(--blue)')}>
                                                                            <DollarSign size={14} />
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
                                                { l: 'Status', v: (() => { const sLow = (orderDetail.status || '').toLowerCase().trim(); return { 'completed': 'Selesai', 'success': 'Selesai', 'in progress': 'Berjalan', 'inprogress': 'Berjalan', 'processing': 'Diproses', 'partial': 'Sebagian', 'pending': 'Menunggu', 'canceled': 'Dibatalkan', 'cancelled': 'Dibatalkan', 'refunded': 'Direfund', 'error': 'Error', 'fail': 'Gagal', 'failed': 'Gagal' }[sLow] || orderDetail.status || 'Pending'; })() },
                                                { l: 'Link', v: orderDetail.link || '—' },
                                                { l: 'Qty', v: orderDetail.qty != null ? String(orderDetail.qty) : '—' },
                                                { l: 'Start Count', v: orderDetail.start_count != null ? String(orderDetail.start_count) : '—' },
                                                { l: 'Sisa (Remains)', v: orderDetail.remains != null ? String(orderDetail.remains) : '—' },
                                                { l: 'Provider', v: orderDetail.provider || 'smmsoc' },
                                                { l: 'Modal', v: `Rp ${orderCostIDR(orderDetail).toLocaleString('id-ID')}` },
                                                { l: 'Harga User', v: orderDetail.amount_idr ? `Rp ${orderDetail.amount_idr.toLocaleString('id-ID')}` : `Rp ${Math.round(orderCostIDR(orderDetail) * markup).toLocaleString('id-ID')}` },
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
                                                    <button className="btn btn-outline" onClick={() => refreshOrderStatus(orderDetail.id, orderDetail.provider)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13 }}>
                                                        <RefreshCw size={14} /> Refresh Status
                                                    </button>
                                                )}
                                                {/^\d+$/.test(String(orderDetail.id)) && canCancel(orderDetail.status) && (
                                                    <button className="btn" onClick={() => cancelOrder(orderDetail.id, orderDetail.provider)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13, background: 'var(--red)', color: '#fff', border: 'none' }}>
                                                        <Ban size={14} /> Minta Cancel
                                                    </button>
                                                )}
                                                {/^\d+$/.test(String(orderDetail.id)) && canRefill(orderDetail.status) && (
                                                    <button className="btn" onClick={() => refillOrder(orderDetail.id, orderDetail.provider)} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13, background: 'var(--green)', color: '#fff', border: 'none' }}>
                                                        <RotateCw size={14} /> Minta Refill
                                                    </button>
                                                )}
                                                {/^\d+$/.test(String(orderDetail.id)) && canRefund(orderDetail.status) && !orderDetail.is_refunded && (
                                                    <button className="btn" onClick={() => { refundOrder(orderDetail); setOrderDetail(null); }} style={{ flex: 1, minWidth: 120, padding: 10, borderRadius: 9, fontSize: 13, background: 'var(--blue)', color: '#fff', border: 'none' }}>
                                                        <DollarSign size={14} /> Refund Saldo
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
                                            id: s._rawId || s.service,
                                            provider: s._provider || 'smmsoc',
                                            nama: s.name,
                                            kategori: s.category,
                                            harga_modal_idr: Math.round(parseFloat(s.rate || 0) * fxFor(s)),
                                            harga_user_idr: Math.round(parseFloat(s.rate || 0) * fxFor(s) * resolveMarkup(s)),
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
                                <Dropdown width={220} value={serviceProviderFilter}
                                    options={[{ value: 'All', label: 'Semua Provider' }, ...serviceProviders.map(p => ({
                                        value: p,
                                        label: `Provider ${p === 'smmsoc' ? 'SMMSOC' : p === 'buzzer' ? 'BuzzerPanel' : p}`,
                                    }))]}
                                    onChange={v => { setServiceProviderFilter(v); setServicePage(0); }} />
                            </div>
                            {providerStats.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'stretch' }}>
                                    {providerStats.map(({ key: p, total, off }) => {
                                        const lbl = p === 'smmsoc' ? 'SMMSOC' : p === 'buzzer' ? 'BuzzerPanel' : p;
                                        const code = PROVIDER_ALIAS[p] || '?';
                                        const on = total - off;
                                        return (
                                            <div key={p} style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                border: '1px solid var(--border)', borderRadius: 12,
                                                padding: '10px 12px', background: 'var(--bg2)',
                                            }}>
                                                {/* Identitas provider */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                                                    <div style={{
                                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: 'var(--blue)', color: '#fff',
                                                        fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: 13,
                                                    }}>{code}</div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{lbl}</div>
                                                        <div style={{ fontSize: 10.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: on > 0 ? 'var(--green)' : 'var(--text3)', display: 'inline-block' }} />
                                                            {on.toLocaleString('id-ID')} aktif · {off.toLocaleString('id-ID')} mati
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Tombol aksi */}
                                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                    <button disabled={bulkBusy} onClick={() => bulkToggleProvider(p, true)}
                                                        title={`Aktifkan semua layanan ${lbl}`}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8,
                                                            border: '1px solid var(--green)', cursor: bulkBusy ? 'wait' : 'pointer',
                                                            background: 'transparent', color: 'var(--green)', opacity: bulkBusy ? 0.5 : 1,
                                                            transition: 'background .15s',
                                                        }}
                                                        onMouseEnter={e => { if (!bulkBusy) e.currentTarget.style.background = 'var(--green-l)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                        <Power size={13} /> Aktifkan
                                                    </button>
                                                    <button disabled={bulkBusy} onClick={() => bulkToggleProvider(p, false)}
                                                        title={`Matikan semua layanan ${lbl}`}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8,
                                                            border: '1px solid var(--red)', cursor: bulkBusy ? 'wait' : 'pointer',
                                                            background: 'transparent', color: 'var(--red)', opacity: bulkBusy ? 0.5 : 1,
                                                            transition: 'background .15s',
                                                        }}
                                                        onMouseEnter={e => { if (!bulkBusy) e.currentTarget.style.background = 'var(--red-l)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                                        <PowerOff size={13} /> Matikan
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {loadingServices && services.length === 0 ? (
                                <TableSkeleton cols={7} rows={8} headers={['ID', 'Nama', 'Harga Modal /1K', 'Harga User /1K', 'Min', 'Max', 'Status']} />
                            ) : (
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
                                            {filteredSvc.slice(safeServicePage * SERVICES_PER_PAGE, (safeServicePage + 1) * SERVICES_PER_PAGE).map((s, i) => {
                                                const eff = resolveMarkup(s);
                                                const modalIDR = Math.round(parseFloat(s.rate || 0) * fxFor(s));
                                                const userIDR = Math.round(parseFloat(s.rate || 0) * fxFor(s) * eff);
                                                const overridden = eff !== markup;
                                                return (
                                                    <tr key={s.service} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace" }}>
                                                            <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>{serviceCode(s)}</div>
                                                            <div style={{ color: 'var(--text3)', fontWeight: 500, fontSize: 10, marginTop: 1 }}>{s.service}</div>
                                                        </td>
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
                                                                const isOff = disabledSet.has(String(s.service));
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
                                                Menampilkan {safeServicePage * SERVICES_PER_PAGE + 1}–{Math.min((safeServicePage + 1) * SERVICES_PER_PAGE, filteredSvc.length)} dari {filteredSvc.length} service
                                            </span>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setServicePage(p => Math.max(0, p - 1))} disabled={safeServicePage === 0}
                                                    style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: safeServicePage === 0 ? 'var(--bg2)' : 'var(--white)', color: safeServicePage === 0 ? 'var(--text3)' : 'var(--text)', cursor: safeServicePage === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                    ← Prev
                                                </button>
                                                {Array.from({ length: Math.ceil(filteredSvc.length / SERVICES_PER_PAGE) }, (_, idx) => idx)
                                                    .filter(idx => Math.abs(idx - safeServicePage) <= 2)
                                                    .map(idx => (
                                                        <button key={idx} onClick={() => setServicePage(idx)}
                                                            style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${idx === safeServicePage ? 'var(--blue)' : 'var(--border)'}`, background: idx === safeServicePage ? 'var(--blue)' : 'var(--white)', color: idx === safeServicePage ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                            {idx + 1}
                                                        </button>
                                                    ))
                                                }
                                                <button onClick={() => setServicePage(p => Math.min(servicePageCount - 1, p + 1))} disabled={safeServicePage >= servicePageCount - 1}
                                                    style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: safeServicePage >= servicePageCount - 1 ? 'var(--bg2)' : 'var(--white)', color: safeServicePage >= servicePageCount - 1 ? 'var(--text3)' : 'var(--text)', cursor: safeServicePage >= servicePageCount - 1 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                    Next →
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── USERS ── */}
                    {menu === 'Users' && <AdminUsers />}

                    {/* ── DEPOSITS ── */}
                    {menu === 'Deposits' && <AdminDeposits />}

                    {/* ── REVENUE ── */}
                    {menu === 'Revenue' && (() => {
                        const chartData = generateChartData(statsPeriod);
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
                                        { l: 'Total Modal', v: `Rp ${statsCostIDR.toLocaleString('id-ID')}`, v2: `${statsOrders.length} order`, c: 'var(--red)', iconBg: 'var(--red-l)', icon: <DollarSign size={20} /> },
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
                                                {PERIOD_OPTIONS.find(o => o.value === statsPeriod)?.label} · data real order
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>
                                                    Rp {chartData.reduce((s, d) => s + d.revenue, 0).toLocaleString('id-ID')}
                                                </div>
                                                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Total periode ini</div>
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
                                        {[1.2, 1.3, 1.5, 2].map(m => {
                                            const rev = Math.round(totalCostIDR * m);
                                            const mod = totalCostIDR;
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
                            <div style={{ marginBottom: 24 }}>
                                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Markup Settings</h1>
                                <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Set keuntungan dari harga modal ke harga yang ditampilkan ke user.</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                                <div className="card" style={{ padding: 30 }}>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Set Markup Multiplier</div>
                                    <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 22 }}>Berlaku untuk semua layanan kecuali yang punya override.</p>
                                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Multiplier (2 = 2× harga modal)</label>
                                    <input className="inp" type="number" step="0.1" min="1" style={{ fontSize: 30, fontWeight: 800, textAlign: 'center', padding: '18px 14px', marginBottom: 18 }} value={markupInput} onChange={e => setMarkupInput(e.target.value)} />
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9, marginBottom: 24 }}>
                                        {[1.1, 1.15, 1.2, 1.3, 1.5, 2].map(m => (
                                            <button key={m} onClick={() => setMarkupInput(String(m))}
                                                style={{ padding: '11px 0', borderRadius: 11, border: `1.5px solid ${markupInput === String(m) ? 'var(--blue)' : 'var(--border)'}`, background: markupInput === String(m) ? 'var(--blue)' : 'transparent', color: markupInput === String(m) ? '#fff' : 'var(--text2)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s' }}>
                                                {m}×
                                            </button>
                                        ))}
                                    </div>
                                    {markupSaved ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', background: 'var(--green-l)', borderRadius: 12, color: 'var(--green)', fontWeight: 700, fontSize: 13.5 }}>
                                            <CheckCircle size={16} /> Markup tersimpan!
                                        </div>
                                    ) : (
                                        <button className="btn btn-blue" onClick={saveMarkup} style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 14 }}>
                                            <Save size={16} /> Simpan Markup
                                        </button>
                                    )}
                                </div>
                                <div className="card" style={{ padding: 30 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Preview Harga</div>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-l)', padding: '4px 10px', borderRadius: 20 }}>{markupInput}× markup</span>
                                    </div>
                                    <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>Contoh perhitungan harga jadi ke user.</p>
                                    {[
                                        { name: 'Instagram Followers HQ', rate: 0.19 },
                                        { name: 'TikTok Views Ultra Fast', rate: 0.0007 },
                                        { name: 'YouTube Subscribers', rate: 15.835 },
                                        { name: 'TikTok Followers', rate: 1.00 },
                                        { name: 'Spotify Plays', rate: 0.09 },
                                    ].map((s, i, arr) => {
                                        const modal = Math.round(s.rate * rate);
                                        const user = Math.round(s.rate * rate * parseFloat(markupInput || markup));
                                        return (
                                            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                                <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ color: 'var(--text3)', fontWeight: 500, fontSize: 11.5, textDecoration: 'line-through' }}>Rp {modal.toLocaleString('id-ID')}</div>
                                                    <div style={{ color: 'var(--green)', fontWeight: 800, fontSize: 14 }}>Rp {user.toLocaleString('id-ID')}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Markup per Kategori & per Service */}
                            <div className="card" style={{ padding: 30, marginTop: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Markup per Kategori / Service</div>
                                        <p style={{ fontSize: 12.5, color: 'var(--text3)', maxWidth: 520 }}>Kosongkan untuk pakai markup global ({markup}×). Prioritas: <b style={{ color: 'var(--text2)' }}>service → kategori → provider → global</b>.</p>
                                    </div>
                                    <button className="btn btn-blue" onClick={saveMarkupRules} disabled={savingRules} style={{ padding: '10px 18px', borderRadius: 11, fontSize: 13.5, opacity: savingRules ? 0.6 : 1, flexShrink: 0 }}>
                                        <Save size={15} /> {savingRules ? 'Menyimpan...' : 'Simpan Rules'}
                                    </button>
                                </div>

                                <div style={{ height: 1, background: 'var(--border)', margin: '22px 0' }} />

                                {providerStats.length > 0 && (<>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Per Provider</div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 9px', borderRadius: 20 }}>{providerStats.length}</span>
                                        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>— 1 angka buat SEMUA layanan provider itu</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
                                        {providerStats.map(({ key: p }) => {
                                            const lbl = p === 'smmsoc' ? 'SMMSOC' : p === 'buzzer' ? 'BuzzerPanel' : p;
                                            const on = rulesDraft.providers && rulesDraft.providers[p] != null;
                                            return (
                                                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px' }}>
                                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{lbl}</div>
                                                    <input className="inp" type="number" step="0.1" min="1" placeholder={`${markup}×`} value={(rulesDraft.providers && rulesDraft.providers[p]) ?? ''} onChange={e => {
                                                        const v = e.target.value;
                                                        setRulesDraft(d => { const providers = { ...(d.providers || {}) }; if (v === '') delete providers[p]; else providers[p] = parseFloat(v); return { ...d, providers }; });
                                                    }} style={{ width: 76, height: 38, padding: '0 8px', textAlign: 'center', fontWeight: 800, flexShrink: 0 }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Per Kategori</div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', padding: '2px 9px', borderRadius: 20 }}>{cats.filter(c => c !== 'All').length}</span>
                                </div>
                                {cats.filter(c => c !== 'All').length === 0 ? (
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 16 }}>Belum ada kategori (services belum termuat).</div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 30 }}>
                                        {cats.filter(c => c !== 'All').map(c => {
                                            const overridden = rulesDraft.categories[c] != null;
                                            return (
                                                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: `1px solid ${overridden ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px', transition: 'border-color .15s' }}>
                                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c}>{c}</div>
                                                    <input className="inp" type="number" step="0.1" min="1" placeholder={`${markup}×`} value={rulesDraft.categories[c] ?? ''} onChange={e => {
                                                        const v = e.target.value;
                                                        setRulesDraft(d => { const categories = { ...d.categories }; if (v === '') delete categories[c]; else categories[c] = parseFloat(v); return { ...d, categories }; });
                                                    }} style={{ width: 76, height: 38, padding: '0 8px', textAlign: 'center', fontWeight: 800, flexShrink: 0 }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Override per Service</div>
                                    {Object.keys(rulesDraft.services).length > 0 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'var(--blue-l)', padding: '2px 9px', borderRadius: 20 }}>{Object.keys(rulesDraft.services).length} aktif</span>
                                    )}
                                </div>
                                <div style={{ position: 'relative', marginBottom: 14 }}>
                                    <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 38, height: 42 }} placeholder="Cari service untuk override (nama / ID)..." value={svcOverrideSearch} onChange={e => setSvcOverrideSearch(e.target.value)} />
                                </div>
                                {svcOverrideSearch.trim() && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 12, maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
                                        {services.filter(s => {
                                            const q = svcOverrideSearch.toLowerCase();
                                            return (s.name?.toLowerCase().includes(q) || String(s.service).toLowerCase().includes(q) || serviceCode(s).toLowerCase().includes(q)) && rulesDraft.services[String(s.service)] == null;
                                        }).slice(0, 20).map(s => (
                                            <button key={s.service} onClick={() => { setRulesDraft(d => ({ ...d, services: { ...d.services, [String(s.service)]: resolveMarkup(s) } })); setSvcOverrideSearch(''); }}
                                                style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text3)', flexShrink: 0 }} title={s.service}>{serviceCode(s)}</span>
                                                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                                <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700, flexShrink: 0 }}>+ override</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {Object.keys(rulesDraft.services).length === 0 ? (
                                    <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '16px', textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, border: '1px dashed var(--border)' }}>Belum ada override per-service. Cari layanan di atas untuk menambahkan.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {Object.entries(rulesDraft.services).map(([sid, mult]) => {
                                            const svc = services.find(s => String(s.service) === sid);
                                            return (
                                                <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)', border: '1px solid var(--blue)', borderRadius: 12, padding: '12px 14px' }}>
                                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{sid}</span>
                                                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc?.name || '(service tidak ada di daftar)'}</span>
                                                    <input className="inp" type="number" step="0.1" min="1" value={mult} onChange={e => {
                                                        const v = parseFloat(e.target.value);
                                                        setRulesDraft(d => ({ ...d, services: { ...d.services, [sid]: isNaN(v) ? 1 : v } }));
                                                    }} style={{ width: 76, height: 38, padding: '0 8px', textAlign: 'center', fontWeight: 800, flexShrink: 0 }} />
                                                    <button onClick={() => setRulesDraft(d => { const s2 = { ...d.services }; delete s2[sid]; return { ...d, services: s2 }; })}
                                                        style={{ background: 'var(--red-l)', border: 'none', borderRadius: 9, padding: '9px', cursor: 'pointer', color: 'var(--red)', display: 'flex', flexShrink: 0 }}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── AUDIT LOG ── */}
                    {menu === 'Audit Log' && (() => {
                        const ACTION_LABELS = {
                            manual_deposit: { l: 'Tambah Saldo Manual', c: '#10B981' },
                            approve_deposit: { l: 'Approve Deposit', c: 'var(--green)' },
                            reject_deposit: { l: 'Tolak Deposit', c: 'var(--red)' },
                            toggle_block: { l: 'Blokir/Unblokir User', c: '#F59E0B' },
                            delete_user: { l: 'Hapus User', c: 'var(--red)' },
                            toggle_service: { l: 'On/Off Layanan', c: 'var(--blue)' },
                            save_markup: { l: 'Ubah Markup', c: '#E91E63' },
                            save_markup_rules: { l: 'Ubah Markup Rules', c: '#E91E63' },
                            save_rate: { l: 'Ubah Kurs', c: '#7C3AED' },
                            change_password: { l: 'Ganti Password Admin', c: 'var(--text2)' },
                        };
                        const fmtDetail = (d) => {
                            if (!d) return '';
                            let obj = d;
                            if (typeof d === 'string') { try { obj = JSON.parse(d); } catch { return d; } }
                            if (obj && typeof obj === 'object') {
                                return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
                            }
                            return String(obj);
                        };
                        const q = auditSearch.trim().toLowerCase();
                        const filtered = auditLogs.filter(log =>
                            !q ||
                            (log.action || '').toLowerCase().includes(q) ||
                            (log.target || '').toLowerCase().includes(q) ||
                            (ACTION_LABELS[log.action]?.l || '').toLowerCase().includes(q)
                        );
                        return (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10, flexWrap: 'wrap' }}>
                                    <div>
                                        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Audit Log</h1>
                                        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Riwayat aktivitas admin · 200 terbaru.</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-outline" onClick={loadAuditLogs} disabled={loadingAudit}
                                            style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12, opacity: loadingAudit ? 0.6 : 1 }}>
                                            <RefreshCw size={12} style={{ animation: loadingAudit ? 'spin 1s linear infinite' : 'none' }} /> {loadingAudit ? 'Memuat...' : 'Refresh'}
                                        </button>
                                        {auditLogs.length > 0 && (
                                            <button className="btn btn-outline" onClick={() => exportCSV(auditLogs.map(log => ({
                                                waktu: log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '',
                                                aksi: ACTION_LABELS[log.action]?.l || log.action || '',
                                                action_code: log.action || '',
                                                target: log.target || '',
                                                detail: fmtDetail(log.detail),
                                                ip: log.ip || '',
                                            })), `audit_log_${new Date().toISOString().slice(0, 10)}.csv`)}
                                                style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 12 }}>
                                                <Download size={12} /> CSV
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                                    <input className="inp" style={{ paddingLeft: 36 }} placeholder="Cari aksi atau target..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                                </div>

                                {loadingAudit ? (
                                    <TableSkeleton cols={5} rows={6} headers={['Waktu', 'Aksi', 'Target', 'Detail', 'IP']} />
                                ) : filtered.length === 0 ? (
                                    <div className="card" style={{ padding: 56, textAlign: 'center' }}>
                                        <FileText size={40} style={{ color: 'var(--text3)', marginBottom: 14 }} />
                                        <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{auditLogs.length === 0 ? 'Belum ada aktivitas tercatat' : 'Tidak ada hasil'}</p>
                                        <p style={{ fontSize: 13, color: 'var(--text3)' }}>{auditLogs.length === 0 ? 'Aksi admin (deposit, blokir, markup, dll) akan tercatat di sini.' : 'Coba kata kunci lain.'}</p>
                                    </div>
                                ) : (
                                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg2)', textAlign: 'left' }}>
                                                        <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Waktu</th>
                                                        <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)' }}>Aksi</th>
                                                        <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)' }}>Target</th>
                                                        <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)' }}>Detail</th>
                                                        <th style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>IP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filtered.map(log => {
                                                        const meta = ACTION_LABELS[log.action] || { l: log.action, c: 'var(--text3)' };
                                                        return (
                                                            <tr key={log.id} style={{ borderTop: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '10px 14px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '—'}</td>
                                                                <td style={{ padding: '10px 14px' }}>
                                                                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: meta.c, background: `color-mix(in srgb, ${meta.c} 12%, transparent)`, whiteSpace: 'nowrap' }}>{meta.l}</span>
                                                                </td>
                                                                <td style={{ padding: '10px 14px', color: 'var(--text)', wordBreak: 'break-word' }}>{log.target || '—'}</td>
                                                                <td style={{ padding: '10px 14px', color: 'var(--text2)', wordBreak: 'break-word', maxWidth: 280 }}>{fmtDetail(log.detail) || '—'}</td>
                                                                <td style={{ padding: '10px 14px', color: 'var(--text3)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{log.ip || '—'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

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
                                    { l: 'Provider', v: providerBalances.length ? providerBalances.map(p => p.label || p.key).join(', ') : 'SMMSOC' },
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
                            {/* Bonus Deposit Bertingkat */}
                            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Bonus Deposit Bertingkat</div>
                                        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Makin besar deposit, makin besar bonus. Berlaku untuk QRIS & crypto.</p>
                                    </div>
                                    <button onClick={addTier} className="btn btn-outline" style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12.5 }}>
                                        + Tambah Tier
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
                                    {bonusTiers.length === 0 && (
                                        <p style={{ fontSize: 12.5, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>Belum ada tier. Klik "Tambah Tier" untuk membuat.</p>
                                    )}
                                    {bonusTiers.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, minWidth: 70 }}>Deposit ≥</span>
                                            <div style={{ position: 'relative', flex: '1 1 130px' }}>
                                                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>Rp</span>
                                                <input className="inp" inputMode="numeric" value={t.min ? Number(t.min).toLocaleString('id-ID') : ''}
                                                    onChange={e => updateTier(i, 'min', e.target.value)}
                                                    placeholder="50.000" style={{ paddingLeft: 34, height: 38 }} />
                                            </div>
                                            <span style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>bonus</span>
                                            <div style={{ position: 'relative', width: 90 }}>
                                                <input className="inp" inputMode="numeric" value={t.percent ?? ''}
                                                    onChange={e => updateTier(i, 'percent', e.target.value)}
                                                    placeholder="5" style={{ paddingRight: 26, height: 38 }} />
                                                <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>%</span>
                                            </div>
                                            <button onClick={() => removeTier(i)} aria-label="Hapus tier"
                                                style={{ background: 'var(--red-l)', border: 'none', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--red)', flexShrink: 0 }}>
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-blue" onClick={saveBonusTiers} disabled={savingBonus} style={{ width: '100%', padding: 11, borderRadius: 10, opacity: savingBonus ? 0.6 : 1 }}>
                                    <Save size={15} /> {savingBonus ? 'Menyimpan...' : 'Simpan Tier Bonus'}
                                </button>
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