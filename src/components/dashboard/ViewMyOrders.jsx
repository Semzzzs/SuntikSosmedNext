import { useState, useEffect, useCallback } from 'react';
import { Search, Package, CheckCircle, Clock, Loader, XCircle, AlertTriangle } from 'lucide-react';
import { useApi } from '@/context/ApiContext';
import { supabase } from '@/lib/supabase';

const STATUS_CONFIG = {
  'Completed': { label: 'Selesai', color: '#059669', bg: '#d1fae5', icon: <CheckCircle size={12} /> },
  'In progress': { label: 'Berjalan', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Loader size={12} /> },
  'Processing': { label: 'Diproses', color: 'var(--blue)', bg: 'var(--blue-l)', icon: <Loader size={12} /> },
  'Pending': { label: 'Menunggu', color: '#d97706', bg: '#fef3c7', icon: <Clock size={12} /> },
  'Partial': { label: 'Sebagian', color: '#d97706', bg: '#fef3c7', icon: <AlertTriangle size={12} /> },
  'Canceled': { label: 'Dibatalkan', color: 'var(--red)', bg: 'var(--red-l)', icon: <XCircle size={12} /> },
  'Refunded': { label: 'Dana Kembali', color: 'var(--text3)', bg: 'var(--bg2)', icon: <XCircle size={12} /> },
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
  const [filterStatus, setFilterStatus] = useState('Semua');
  const { apiUrl, apiKey } = useApi();

  // ✅ Fix: email dari supabase.auth.getSession(), bukan sessionStorage
  // sessionStorage tidak lagi menyimpan email sejak fix sebelumnya
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
    try {
      // Baca orders dari Supabase — akurat & persisten lintas device
      const { data: txRaw, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('email', authEmail)
        .eq('type', 'order')
        .order('created_at', { ascending: false });

      // Filter hanya order SMM asli (punya order_id numerik atau deskripsi "Order #...")
      const txData = txRaw?.filter(t =>
        (t.order_id && /^\d+$/.test(String(t.order_id))) ||
        (t.description && t.description.startsWith('Order #'))
      );

      // Baca metadata dari localStorage sebagai tambahan (serviceName, link, qty)
      const { meta } = getOrderData();

      if (!txError && txData && txData.length > 0) {
        // Kumpulkan order_id numerik untuk fetch live status ke SMMSOC.
        // ✅ Hanya order yang BELUM final (status final tak akan berubah lagi → hemat call).
        const FINAL = new Set(['Completed', 'Canceled', 'Refunded']);
        const orderIds = txData
          .filter(t => t.order_id && /^\d+$/.test(String(t.order_id)) && !FINAL.has(normalizeStatus(t.status)))
          .map(t => String(t.order_id));

        let liveStatus = {};
        // Fetch live status dari SMM API kalau ada order_id
        if (orderIds.length > 0) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`/api/smm?action=status&orders=${orderIds.slice(0, 100).join(',')}`, {
              headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
            });
            const data = await res.json();
            if (!data.error) liveStatus = data;
          } catch { /* pakai status Pending */ }
        }

        const parsed = txData.map(t => {
          const live = (t.order_id && liveStatus[t.order_id]) ? liveStatus[t.order_id] : null;
          const localMeta = meta[t.order_id] || {};
          // ✅ Kalau live status ada → pakai itu. Kalau gagal/tidak ada → fallback ke status tersimpan
          //    di Supabase (jangan paksa jadi 'Pending' — itu bikin order Completed tampil Menunggu).
          const effStatus = live?.status ? normalizeStatus(live.status) : normalizeStatus(t.status);
          return {
            id: t.order_id || t.id,
            status: effStatus,
            charge: live?.charge ?? t.charge,
            startCount: live?.start_count ?? null,
            remains: live?.remains ?? null,
            error: live?.error,
            serviceName: localMeta.serviceName || t.description?.replace(/^Order #\d+ - /, '') || '—',
            link: t.link || localMeta.link || '—',
            qty: t.qty || localMeta.qty || '—',
            createdAt: t.created_at,
            amountIDR: t.amount,
          };
        });
        setOrders(parsed);
        setLoading(false);
        return;
      }

      // Fallback: baca dari localStorage (backward compat)
      const { ids, meta: metaFallback } = getOrderData();
      if (!apiUrl || !apiKey || ids.length === 0) { setOrders([]); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/smm?action=status&orders=${ids.slice(0, 100).join(',')}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed = Object.entries(data).map(([id, info]) => ({
        id,
        status: normalizeStatus(info.status),
        charge: info.charge,
        startCount: info.start_count,
        remains: info.remains,
        error: info.error,
        serviceName: metaFallback[id]?.serviceName || '—',
        link: metaFallback[id]?.link || '—',
        qty: metaFallback[id]?.qty || '—',
        createdAt: metaFallback[id]?.createdAt || null,
      }));
      parsed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setOrders(parsed);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [authEmail, getOrderData]);

  useEffect(() => {
    fetchOrders();
    let interval = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(fetchOrders, 30000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchOrders();  // refresh langsung saat tab kembali aktif
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

  const statuses = ['Semua', ...Object.keys(STATUS_CONFIG)];
  const shown = orders.filter(o => {
    const matchSearch = !search || String(o.id).includes(search) || (o.status || '').toLowerCase().includes(search.toLowerCase()) || (o.serviceName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const noOrders = !loading && orders.length === 0;

  const completedCount = orders.filter(o => o.status === 'Completed').length;
  const activeCount = orders.filter(o => ['In progress', 'Processing', 'Pending'].includes(o.status)).length;

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fu">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>My Orders</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>{orders.length > 0 ? `${orders.length} order ditemukan` : 'Riwayat order kamu'}</p>
        </div>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Total Order', value: orders.length, color: 'var(--blue)', bg: 'var(--blue-l)' },
            { label: 'Selesai', value: completedCount, color: '#059669', bg: '#d1fae5' },
            { label: 'Aktif', value: activeCount, color: '#d97706', bg: '#fef3c7' },
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
        <input className="inp" style={{ paddingLeft: 38 }} placeholder="Cari order ID, service, atau status..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {statuses.map(s => {
          const cfg = STATUS_CONFIG[s];
          const isActive = filterStatus === s;
          const color = isActive ? (cfg?.color || 'var(--blue)') : 'var(--text3)';
          const bg = isActive ? (cfg?.bg || 'var(--blue-l)') : 'transparent';
          const count = s === 'Semua' ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
              border: `1.5px solid ${isActive ? (cfg?.color || 'var(--blue)') : 'var(--border)'}`,
              background: bg, color, fontWeight: 700, fontSize: 12.5,
              fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .15s',
            }}>
              {cfg?.icon && <span style={{ display: 'flex' }}>{cfg.icon}</span>}
              {s === 'Semua' ? 'Semua' : cfg?.label || s}
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
                        <td style={{ padding: '13px 16px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{o.qty !== '—' ? Number(o.qty).toLocaleString('id-ID') : '—'}</td>
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap', fontSize: 12.5 }}>
                          {o.amountIDR ? `Rp ${Number(o.amountIDR).toLocaleString('id-ID')}` : '—'}
                        </td>
                        <td style={{ padding: '13px 16px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(o.createdAt)}</td>
                        <td style={{ padding: '13px 16px', minWidth: 120 }}>
                          {progress !== null ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                                <span>{o.startCount > 0 ? `${Math.max(0, o.startCount - o.remains)}/${o.startCount}` : ''}</span>
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