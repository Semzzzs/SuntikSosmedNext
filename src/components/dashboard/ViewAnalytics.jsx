import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, ShoppingCart, CreditCard, RefreshCw } from 'lucide-react';

export default function ViewAnalytics({ user }) {
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rate, setRate] = useState(17687);

  useEffect(() => {
    fetch('/api/rate').then(r => r.json()).then(d => { if (d.rate) setRate(d.rate); }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    // ✅ Load transactions dari Supabase
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('transactions').select('*').eq('email', user.email)
        .order('created_at', { ascending: false })
        .then(({ data }) => setTransactions(data || []));
    });
    // Order IDs tetap dari localStorage (metadata lokal)
    const ids = JSON.parse(localStorage.getItem(`smm_orders_${user.email}`) || '[]');
    setOrders(ids);
  }, [user]);

  const totalDeposit = transactions.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const totalSpent = transactions.filter(t => t.type === 'order').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = totalDeposit - totalSpent;

  // Chart data - transaksi per hari 7 hari terakhir
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const dateKey = d.toISOString().slice(0, 10);
    const dayTx = transactions.filter(t => t.created_at?.slice(0, 10) === dateKey);
    const deposit = dayTx.filter(t => ['deposit', 'bonus', 'refund'].includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
    const spent = dayTx.filter(t => t.type === 'order').reduce((s, t) => s + (t.amount || 0), 0);
    return { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), deposit, spent };
  });

  const maxVal = Math.max(...last7.map(d => Math.max(d.deposit, d.spent)), 1);

  const stats = [
    { label: 'Total Deposit', value: `Rp ${totalDeposit.toLocaleString('id-ID')}`, color: 'var(--green)', bg: 'var(--green-l)', icon: <CreditCard size={20} /> },
    { label: 'Total Pengeluaran', value: `Rp ${totalSpent.toLocaleString('id-ID')}`, color: 'var(--red)', bg: 'var(--red-l)', icon: <ShoppingCart size={20} /> },
    { label: 'Estimasi Saldo', value: `Rp ${Math.max(0, balance).toLocaleString('id-ID')}`, color: 'var(--blue)', bg: 'var(--blue-l)', icon: <TrendingUp size={20} /> },
    { label: 'Total Order', value: orders.length, color: 'var(--yellow)', bg: 'var(--yellow-l)', icon: <BarChart2 size={20} /> },
  ];

  return (
    <div className="fu">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 3 }}>Analytics</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>Ringkasan aktivitas akun kamu.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, marginBottom: 12 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Aktivitas 7 Hari Terakhir</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20 }}>Deposit vs Pengeluaran</div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
          {last7.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', flex: 1 }}>
                <div style={{ flex: 1, background: 'var(--green)', borderRadius: '4px 4px 0 0', height: `${maxVal > 0 ? (d.deposit / maxVal) * 100 : 0}%`, minHeight: d.deposit > 0 ? 4 : 0, opacity: 0.85 }} />
                <div style={{ flex: 1, background: 'var(--red)', borderRadius: '4px 4px 0 0', height: `${maxVal > 0 ? (d.spent / maxVal) * 100 : 0}%`, minHeight: d.spent > 0 ? 4 : 0, opacity: 0.85 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap' }}>{d.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Deposit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--red)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Pengeluaran</span>
          </div>
        </div>
      </div>

      {/* Empty state jika belum ada data */}
      {transactions.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <BarChart2 size={32} style={{ color: 'var(--text3)', marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Belum ada data</div>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Analytics akan muncul setelah kamu melakukan deposit atau order.</p>
        </div>
      )}
    </div>
  );
}