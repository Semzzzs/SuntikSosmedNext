import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Package, CheckCircle, Clock, Loader, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Fix #4: Tambah 'Refunded' ke STATUS_CONFIG agar status ini punya tampilan yang konsisten
const STATUS_CONFIG = {
  'Completed': { label: 'Completed', color: '#059669', bg: '#d1fae5', icon: <CheckCircle size={12} /> },
  'In progress': { label: 'In progress', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Loader size={12} /> },
  'Processing': { label: 'Processing', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Loader size={12} /> },
  'Pending': { label: 'Pending', color: '#d97706', bg: '#fef3c7', icon: <Clock size={12} /> },
  'Partial': { label: 'Partial', color: '#d97706', bg: '#fef3c7', icon: <AlertTriangle size={12} /> },
  'Canceled': { label: 'Canceled', color: 'var(--red)', bg: 'var(--red-l)', icon: <XCircle size={12} /> },
  'Refunded': { label: 'Refunded', color: '#6b7280', bg: '#f3f4f6', icon: <RefreshCw size={12} /> },
};

// Normalisasi status dari SMM API — provider kadang kirim casing/penulisan beda
// ('in progress', 'In Progress', 'Cancelled' vs 'Canceled', dst) agar match STATUS_CONFIG.
function normalizeStatus(raw) {
  if (!raw) return 'Pending';
  const s = String(raw).trim().toLowerCase();
  switch (s) {
    case 'completed': return 'Completed';
    case 'in progress':
    case 'inprogress': return 'In progress';
    case 'processing': return 'Processing';
    case 'pending': return 'Pending';
    case 'partial': return 'Partial';
    case 'canceled':
    case 'cancelled': return 'Canceled';
    case 'refunded': return 'Refunded';
    default: return raw; // biarkan apa adanya kalau benar-benar tak dikenal
  }
}

function getOrderKey(user) {
  return `smm_orders_${user?.email || user?.id || 'guest'}`;
}

export default function ViewMyOrders() {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Fix #2: pakai useRef untuk interval agar tidak ada stale closure / race condition
  const intervalRef = useRef(null);

  // ✅ Fix session expired: kalau API balas 401, token di localStorage sudah basi
  // (revoked/expired di server) walau getSession() masih anggap valid. Daripada
  // retry diam-diam tiap 30s pakai token yang sama (loop error tak berkesudahan),
  // langsung sign-out paksa + stop polling + lempar ke /login.
  const loggingOutRef = useRef(false); // cegah signOut()/redirect dipanggil berkali-kali
  const handleAuthExpired = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    supabase.auth.signOut().finally(() => {
      if (typeof window !== 'undefined') window.location.href = '/login';
    });
  }, []);

  // Fix: email dari supabase.auth.getSession(), bukan sessionStorage
  const [authEmail, setAuthEmail] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthEmail(session?.user?.email || '');
    });
  }, []);

  // getOrderData untuk baca metadata lokal (serviceName, link, qty) dari localStorage
  const getOrderData = useCallback(() => {
    if (typeof window === 'undefined' || !authEmail) return { ids: [], meta: {} };
    const key = getOrderKey({ email: authEmail });
    const local = JSON.parse(localStorage.getItem(key) || '[]');

    const metaMap = {};
    const ids = [];
    local.forEach(item => {
      const id = typeof item === 'object' ? String(item.orderId) : String(item);
      if (!ids.includes(id)) {
        ids.push(id);
        if (typeof item === 'object') metaMap[id] = item;
      }
    });
    return { ids, meta: metaMap };
  }, [authEmail]);

  const fetchOrders = useCallback(async () => {
    if (!authEmail) { setOrders([]); return; }

    setLoading(true);
    setError('');

    // Fix #6: AbortController untuk cegah state update setelah unmount
    const controller = new AbortController();

    try {
      // ✅ Satu fetch ke /api/orders/mine — grouping per-provider & live status
      // sekarang dikerjakan SERVER-SIDE, jadi browser gak pernah lihat kolom
      // provider/charge/charge_idr/service_id.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/orders/mine', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      // ✅ 401 = token sudah tidak valid di server → jangan retry, sign-out saja
      if (res.status === 401) { handleAuthExpired(); return; }
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      // Lengkapi dari localStorage kalau ada metadata lama (serviceName/link/qty)
      // dari order sebelum kolom-kolom itu ada di DB — server gak bisa baca localStorage.
      const { meta } = getOrderData();
      const parsed = (Array.isArray(data) ? data : []).map(o => {
        const localMeta = meta[o.id] || {};
        return {
          ...o,
          serviceName: o.serviceName && o.serviceName !== '—' ? o.serviceName : (localMeta.serviceName || '—'),
          link: o.link && o.link !== '—' ? o.link : (localMeta.link || '—'),
          qty: o.qty && o.qty !== '—' ? o.qty : (localMeta.qty || '—'),
        };
      });

      setOrders(parsed);

    } catch (e) {
      // Abaikan error akibat abort (unmount / tab switch) — bukan error nyata
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      // Fix #1: setLoading(false) selalu terpanggil di sini, tidak ada duplikat
      setLoading(false);
    }

    // Kembalikan fungsi cleanup AbortController agar bisa dibatalkan dari luar jika perlu
    return () => controller.abort();
  }, [authEmail, getOrderData, handleAuthExpired]);

  useEffect(() => {
    fetchOrders();

    // Fix #2: Gunakan ref untuk interval agar tidak ada stale reference
    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(fetchOrders, 30000);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchOrders(); // refresh langsung saat tab kembali aktif
        start();
      }
    };

    // Mulai polling hanya kalau tab sedang terlihat
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchOrders]);

  // Fix #5: statuses dibangun dari STATUS_CONFIG + filter hanya status yang benar-benar ada di orders
  // agar pill 'Refunded' (dan status lain) muncul kalau ada datanya
  const existingStatuses = new Set(orders.map(o => o.status));
  const statuses = ['All', ...Object.keys(STATUS_CONFIG).filter(s => existingStatuses.has(s))];

  const shown = orders.filter(o => {
    const matchSearch = !search
      || String(o.id).includes(search)
      || (o.status || '').toLowerCase().includes(search.toLowerCase())
      || (o.serviceName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const noOrders = !loading && orders.length === 0;
  const completedCount = orders.filter(o => o.status === 'Completed').length;
  const activeCount = orders.filter(o => ['In progress', 'Processing', 'Pending'].includes(o.status)).length;

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fu">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>My Orders</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>
            {orders.length > 0 ? `${orders.length} order ditemukan` : 'Riwayat order kamu'}
          </p>
        </div>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Total Order', value: orders.length, color: 'var(--blue)', bg: 'var(--blue-l)' },
            { label: 'Completed', value: completedCount, color: '#059669', bg: '#d1fae5' },
            { label: 'Active', value: activeCount, color: '#d97706', bg: '#fef3c7' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package size={18} style={{ color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          className="inp"
          style={{ paddingLeft: 38 }}
          placeholder="Cari order ID, service, atau status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {statuses.map(s => {
          const cfg = STATUS_CONFIG[s];
          const isActive = filterStatus === s;
          const color = isActive ? (cfg?.color || 'var(--blue)') : 'var(--text3)';
          const bg = isActive ? (cfg?.bg || 'var(--blue-l)') : 'transparent';
          const count = s === 'All' ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
              border: `1.5px solid ${isActive ? (cfg?.color || 'var(--blue)') : 'var(--border)'}`,
              background: bg, color, fontWeight: 700, fontSize: 12.5,
              fontFamily: "'Outfit',sans-serif", transition: 'all .15s',
            }}>
              {cfg?.icon && <span style={{ display: 'flex' }}>{cfg.icon}</span>}
              {s === 'All' ? 'All' : cfg?.label || s}
              <span style={{ fontSize: 11, opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ background: 'var(--red-l)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <span style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTop: '3px solid var(--blue)', borderRadius: '50%', display: 'inline-block' }} className="spin" />
              <p style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Memuat order...</p>
            </div>
          ) : noOrders ? (
            <div style={{ padding: 56, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--blue-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Package size={30} style={{ color: 'var(--blue)' }} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Belum ada order</p>
              <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Order yang kamu buat akan muncul di sini secara otomatis.</p>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                    {['Order ID', 'Layanan', 'Link / Target', 'Qty', 'Harga', 'Tgl Order', 'Progress', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o, i) => {
                    const cfg = STATUS_CONFIG[o.status] || { label: o.status, color: 'var(--text3)', bg: 'var(--bg2)', icon: null };
                    const progress = o.status === 'Completed' ? 100
                      : (o.startCount && o.startCount > 0 && o.remains != null && o.status !== 'Canceled')
                        ? Math.max(0, Math.min(100, Math.round(((o.startCount - o.remains) / o.startCount) * 100)))
                        : null;
                    return (
                      <tr key={o.id} style={{ borderBottom: i < shown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: 'var(--blue)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, whiteSpace: 'nowrap' }}>#{o.id}</td>
                        <td style={{ padding: '13px 16px', color: 'var(--text)', fontWeight: 600, maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.serviceName}>{o.serviceName}</div>
                        </td>
                        <td style={{ padding: '13px 16px', color: 'var(--text3)', maxWidth: 160 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={o.link}>{o.link}</div>
                        </td>
                        {/* Fix #3: guard qty — cegah string kosong/null jadi Number(0) */}
                        <td style={{ padding: '13px 16px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {o.qty && o.qty !== '—' ? Number(o.qty).toLocaleString('id-ID') : '—'}
                        </td>
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                          {o.amountIDR ? `Rp ${Number(o.amountIDR).toLocaleString('id-ID')}` : '—'}
                        </td>
                        <td style={{ padding: '13px 16px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                        <td style={{ padding: '13px 16px', minWidth: 120 }}>
                          {progress !== null ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                                <span>{o.startCount > 0 && o.remains != null ? `${Math.max(0, o.startCount - o.remains)}/${o.startCount}` : ''}</span>
                                <span style={{ fontWeight: 700 }}>{progress}%</span>
                              </div>
                              <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#059669' : 'var(--blue)', borderRadius: 99, transition: 'width .3s' }} />
                              </div>
                            </div>
                          ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          {o.error ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--red)', background: 'var(--red-l)', padding: '4px 10px', borderRadius: 20 }}>
                              Error
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '4px 10px', borderRadius: 20 }}>
                              {cfg.icon} {cfg.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shown.length === 0 && (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Tidak ada order yang cocok</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}